// Pad Studio helper: serves the app on http://127.0.0.1:8777 and gives it access to the pad's USB drive
// (configs/, scripts/, app_icons/). Browsers can't open a drive root, so this does it. No dependencies.
//   node server.js                       key configs/icons can be saved (auto-backup of the drive before the first write)
//   node server.js --read-only           never write to the pad drive
//   node server.js --drive G: --port 8777
const http = require('http'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const PORT = +opt('--port', 8777), WRITABLE = !args.includes('--read-only'), RUN = args.includes('--run-actions');
const { spawn } = require('child_process');
const os = require('os');
let prevCpu = os.cpus(), cpuPct = 0;
setInterval(() => { // CPU % from tick deltas over the last second
  const cur = os.cpus(); let idle = 0, total = 0;
  cur.forEach((c, i) => { const p = prevCpu[i].times, t = c.times; idle += t.idle - p.idle; total += (t.user - p.user) + (t.nice - p.nice) + (t.sys - p.sys) + (t.irq - p.irq) + (t.idle - p.idle); });
  cpuPct = total ? 100 * (1 - idle / total) : 0; prevCpu = cur;
}, 1000).unref();
const REQUIRED = ['configs', 'scripts', 'app_icons'];

function findDrive() {
  const want = opt('--drive');
  const letters = want ? [want[0].toUpperCase()] : 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (const l of letters) { try { if (REQUIRED.every((d) => fs.existsSync(l + ':/' + d))) return l + ':/'; } catch (e) { /* ignore */ } }
  return null;
}
let backedUp = false;
function backup(drive) {
  const dest = path.join(__dirname, 'pad-backup-' + new Date().toISOString().replace(/[:.]/g, '-'));
  for (const d of [...REQUIRED, 'display_names']) if (fs.existsSync(drive + d)) fs.cpSync(drive + d, path.join(dest, d), { recursive: true });
  backedUp = true; return dest;
}
// Every overwrite keeps the previous version of that file under pad-backup-changes/<time>/<folder>/<file>.
function writeKeeping(drive, rel, data) {
  const f = drive + rel;
  if (fs.existsSync(f)) { const dest = path.join(__dirname, 'pad-backup-changes', new Date().toISOString().replace(/[:.]/g, '-'), rel); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(f, dest); }
  fs.writeFileSync(f, data);
}
function removeKeeping(drive, rel) { // delete, but keep the previous version
  const f = drive + rel; if (!fs.existsSync(f)) return false;
  const dest = path.join(__dirname, 'pad-backup-changes', new Date().toISOString().replace(/[:.]/g, '-'), rel); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(f, dest); fs.unlinkSync(f); return true;
}
/** Launch App actions ("ACT 2 <path>") from the pad's own config file for that key. Only runs with --run-actions, only existing files, never through a shell. */
function pressKey(drive, stem) {
  const f = drive + 'configs/' + stem + '.txt'; if (!fs.existsSync(f)) return { launched: [], skipped: 'no config' };
  const cfg = parseConfig(fs.readFileSync(f, 'utf8')); if (cfg.hid) return { launched: [], skipped: 'HID mode key: the pad types it itself' };
  const launched = [];
  for (const a of cfg.actions) {
    const m = /^ACT 2 (.+)$/.exec(a); if (!m) continue;
    const p = m[1].trim().replace(/^"|"$/g, '');
    if (!/^[A-Za-z]:\\/.test(p) || /[\x00-\x1f"<>|*?]/.test(p) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { launched.push({ path: p, ok: false, why: 'not an existing absolute file path' }); continue; }
    spawn('explorer.exe', [p], { detached: true, stdio: 'ignore' }).unref(); launched.push({ path: p, ok: true });
  }
  return { launched };
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readBody = (req, max = 70000) => new Promise((ok, no) => { const c = []; let n = 0; req.on('data', (d) => { n += d.length; if (n > max) { no(new Error('body too large')); req.destroy(); } else c.push(d); }); req.on('end', () => ok(Buffer.concat(c))); });

function pk(u) { // validated profile/key -> file stem. Only digits ever reach a path.
  const p = +u.searchParams.get('p'), k = +u.searchParams.get('k');
  if (!Number.isInteger(p) || !Number.isInteger(k) || p < 1 || p > 255 || k < 1 || k > 8) return null;
  return `profile_${p}_key_${k}`;
}
function parseConfig(text) {
  const lines = text.split(/\r?\n/); const out = { alias: '', hid: false, actions: [] };
  for (const l of lines) { if (l.startsWith('Alias=')) out.alias = l.slice(6); else if (l.startsWith('HidMode=')) out.hid = l.slice(8).trim().toLowerCase() === 'true'; else if (l.length) out.actions.push(l); }
  return out;
}

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (req.headers.host && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host)) return send(res, 403, { error: 'bad host' });
    // Block cross-site writes: browsers always send Origin on cross-origin PUT/POST.
    if (req.method !== 'GET' && req.headers.origin && !new RegExp(`^http://(127\\.0\\.0\\.1|localhost):${PORT}$`).test(req.headers.origin)) return send(res, 403, { error: 'bad origin' });
    const drive = findDrive();
    const GB = 1024 ** 3, r1 = (n) => Math.round(n * 10) / 10;
    if (u.pathname === '/api/stats') return send(res, 200, { cpu: r1(cpuPct), mem: r1(100 * (1 - os.freemem() / os.totalmem())), memUsedGB: r1((os.totalmem() - os.freemem()) / GB), memFreeGB: r1(os.freemem() / GB) });
    if (u.pathname === '/api/status') return send(res, 200, { drive, writable: WRITABLE && !!drive, backedUp, runActions: RUN });
    if (u.pathname.startsWith('/api/')) {
      if (!drive) return send(res, 503, { error: 'pad drive not found (is it plugged in?)' });
      if (u.pathname === '/api/backup' && req.method === 'POST') return send(res, 200, { dest: backup(drive) });
      const stem = pk(u); if (!stem) return send(res, 400, { error: 'bad profile/key' });
      if (u.pathname === '/api/key' && req.method === 'GET') {
        const f = drive + 'configs/' + stem + '.txt';
        return send(res, 200, fs.existsSync(f) ? { exists: true, ...parseConfig(fs.readFileSync(f, 'utf8')) } : { exists: false, alias: '', hid: false, actions: [] });
      }
      if (u.pathname === '/api/icon' && req.method === 'GET') {
        const f = drive + 'app_icons/' + stem + '.png';
        return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), 'image/png') : send(res, 404, { error: 'no icon' });
      }
      if (u.pathname === '/api/press' && req.method === 'POST') {
        if (!RUN) return send(res, 403, { error: 'start the helper with --run-actions to let key presses launch programs' });
        return send(res, 200, pressKey(drive, stem));
      }
      if (req.method === 'DELETE') {
        if (!WRITABLE) return send(res, 403, { error: 'server started with --read-only' });
        if (!backedUp) backup(drive);
        if (u.pathname === '/api/key') return send(res, 200, { removed: ['configs/' + stem + '.txt', 'scripts/' + stem + '.txt'].filter((r) => removeKeeping(drive, r)) });
        if (u.pathname === '/api/icon') return send(res, 200, { removed: ['app_icons/' + stem + '.png'].filter((r) => removeKeeping(drive, r)) });
      }
      if (req.method === 'PUT') {
        if (!WRITABLE) return send(res, 403, { error: 'server started with --read-only' });
        if (!backedUp) backup(drive);
        const body = await readBody(req);
        if (u.pathname === '/api/key') {
          const j = JSON.parse(body.toString('utf8')); const actions = (j.actions || []).map(String);
          if (actions.some((a) => /[\r\n]/.test(a)) || /[\r\n]/.test(j.alias || '')) return send(res, 400, { error: 'newline in field' });
          const cfg = `Alias=${j.alias || ''}\r\nHidMode=${j.hid ? 'True' : 'False'}\r\n` + actions.map((a) => a + '\r\n').join('');
          // The pad's own script is sent by the app (the official format differs from the config lines); older callers get the ACT-less lines.
          const scriptLines = Array.isArray(j.script) ? j.script.map(String) : actions.filter((a) => !/^ACT\b/i.test(a));
          if (scriptLines.some((a) => /[\r\n]/.test(a))) return send(res, 400, { error: 'newline in field' });
          const scr = scriptLines.map((a) => a + '\r\n').join('');
          writeKeeping(drive, 'configs/' + stem + '.txt', cfg); writeKeeping(drive, 'scripts/' + stem + '.txt', scr);
          return send(res, 200, { ok: true });
        }
        if (u.pathname === '/api/icon') {
          if (body.length < 8 || body.readUInt32BE(0) !== 0x89504e47) return send(res, 400, { error: 'not a PNG' });
          if (body.readUInt32BE(16) !== 64 || body.readUInt32BE(20) !== 64) return send(res, 400, { error: 'icon must be 64x64' });
          writeKeeping(drive, 'app_icons/' + stem + '.png', body); return send(res, 200, { ok: true });
        }
      }
      return send(res, 404, { error: 'unknown endpoint' });
    }
    const file = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
    if (!['index.html', 'core.js', 'library.js', 'leagues.js'].includes(file)) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, fs.readFileSync(path.join(__dirname, file)), MIME[path.extname(file)]);
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, '127.0.0.1', () => {
  const d = findDrive();
  console.log(`Pad Studio on http://127.0.0.1:${PORT}   drive: ${d || 'NOT FOUND'}   writes: ${WRITABLE ? 'on (auto-backup before the first write)' : 'read-only'}   key presses may launch programs: ${RUN ? 'YES (--run-actions)' : 'no'}`);
});
