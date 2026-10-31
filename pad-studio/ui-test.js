// Pad Studio interface test. Run:  node server.js  (in another terminal), then:  node ui-test.js
// Needs Microsoft Edge installed. It opens a throwaway headless Edge profile, drives the page through the DevTools protocol,
// and STUBS every helper-server call, so nothing is ever written to the pad. Exit code 1 if any check fails.
// Drives Pad Studio in a throwaway headless Edge profile via the DevTools protocol. api() is stubbed so NOTHING is written to the pad.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const edge = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'padui-')), PORT = 9333;
const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${dir}`, `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, bad = 0; const check = (name, cond, extra) => { if (cond) { ok++; console.log('ok   ' + name); } else { bad++; console.log('FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } };
(async () => {
  let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch (e) { await sleep(200); } }
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
  let id = 0; const pend = new Map(), errors = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text); };
  const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception.description); return r.result.result.value; };
  await cmd('Runtime.enable'); await cmd('Page.enable'); await cmd('Page.navigate', { url: 'http://127.0.0.1:8777/' }); await sleep(2500);

  // never touch the pad: stub the helper-server calls and record them
  await ev(`window.calls = []; api = async (p, o) => { calls.push([(o && o.method) || 'GET', p, o && typeof o.body === 'string' ? o.body : undefined]); return { json: async () => ({ drive: 'G:/', writable: true, runActions: false, exists: false, alias: '', hid: false, actions: [] }) }; }; window.confirm = () => true; window.alert = (m) => { window.lastAlert = m; }; 1`);

  // --- action sequence editor
  await ev(`state.drive = { drive: 'G:/', writable: true }; state.profile = 3; state.key = 0; buildTabs(); renderKeys(); 1`);
    check('palette has all 14 official actions in the official order', (await ev(`[...document.querySelectorAll('#palette button')].map((b) => b.textContent.slice(b.textContent.indexOf(' ') + 1)).join(',')`)) === 'Access Web,Launch App,Open Folder,Open File,Input Text,Shortcut,Wait,Mouse Move,Mouse Click,Media Control,Shell Cmd,Change Profile,Functional Key,Device Ctrl');
  await ev(`document.querySelectorAll('#palette button')[5].click()`); // Shortcut
  check('add Shortcut -> CONTROL c', JSON.stringify(await ev(`curKey().actions`)) === '["ACT 5 CONTROL c"]', await ev(`curKey().actions`));
  await ev(`(() => { const i = document.querySelector('#seq .arow input[type=text]'); i.value = 's'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  check('edit key field -> ACT 5 CONTROL s', (await ev(`curKey().actions[0]`)) === 'ACT 5 CONTROL s');
  await ev(`document.querySelector('#seq .arow input[type=checkbox]:not(:checked)').click()`); // tick Shift (Ctrl is already ticked)
  check('tick Shift -> ACT 5 CONTROL SHIFT s', (await ev(`curKey().actions[0]`)) === 'ACT 5 CONTROL SHIFT s', await ev(`curKey().actions`));
  await ev(`document.querySelectorAll('#palette button')[6].click()`); // Wait
  check('add Wait -> ACT 7 500 + Delay 500', JSON.stringify(await ev(`curKey().actions`)) === '["ACT 5 CONTROL SHIFT s","ACT 7 500","Delay 500"]', await ev(`curKey().actions`));
  await ev(`document.querySelectorAll('#seq .arow')[1].querySelector('button[title="Move up"]').click()`);
  check('move up reorders', JSON.stringify(await ev(`curKey().actions`)) === '["ACT 7 500","Delay 500","ACT 5 CONTROL SHIFT s"]');
  await ev(`document.querySelectorAll('#seq .arow')[0].querySelector('button[title="Delete"]').click()`);
  check('delete row', JSON.stringify(await ev(`curKey().actions`)) === '["ACT 5 CONTROL SHIFT s"]');
  for (const [idx, name, line] of [[0, 'Access Web', 'ACT 1 www.google.com'], [1, 'Launch App', 'ACT 2 C:\\Windows\\System32\\notepad.exe'], [2, 'Open Folder', 'ACT 3 C:\\Users'], [3, 'Open File', 'ACT f C:\\Users\\Public\\notes.txt'], [4, 'Input Text', 'ACT 4 Hello'], [7, 'Mouse Move', 'ACT 8 260 820'], [8, 'Mouse Click', 'ACT 9 LMOUSE'], [9, 'Media Control', 'ACT a MK_PP'], [10, 'Shell Cmd', 'ACT b echo hello'], [11, 'Change Profile', 'ACT c NEXT_PROFILE'], [12, 'Functional Key', 'ACT d ENTER'], [13, 'Device Ctrl', 'ACT e CC_CALCULATOR']]) {
    await ev(`loadProfile = async () => {}; Object.assign(curKey(), { actions: [] }); renderEditor(curKey()); document.querySelectorAll('#palette button')[${idx}].click()`);
    check(`add ${name}`, (await ev(`curKey().actions.join('|')`)).includes(line), await ev(`curKey().actions`));
  }
  check('dirty flag set and tile shows it', (await ev(`curKey().dirty && document.querySelector('#keys .key.dirty') !== null`)) === true);

  // --- title, HID, icon controls, delete, export/import
  await ev(`(() => { const a = $('alias'); a.value = 'My key'; a.dispatchEvent(new Event('input', { bubbles: true })); $('hid').click(); })()`);
  check('title + HID mode update the draft', (await ev(`curKey().alias === 'My key' && curKey().hid === true`)) === true);
  await ev(`$('btnEmptyIcon').click()`); check('Empty icon marks the icon for removal', (await ev(`curKey().clearIcon === true && !curKey().iconCanvas`)) === true);
  check('Export key uses the official text format', (await ev(`cfgText(curKey())`)).startsWith('Alias=My key\r\nHidMode=True\r\n'));
  await ev(`(() => { const dt = new DataTransfer(); dt.items.add(new File(['Alias=Steam\\r\\nHidMode=False\\r\\nACT 2 C:\\\\Program Files (x86)\\\\Steam\\\\steam.exe\\r\\nWINDOWS\\r\\nDelay 20\\r\\nSTRING steam.exe\\r\\nENTER\\r\\n'], 'x.txt')); $('importFile').files = dt.files; return $('importFile').onchange(); })()`);
  await sleep(300);
  check('Import official .txt -> Launch App + original lines kept', (await ev(`curKey().alias === 'Steam' && seq[0].type === 'app' && curKey().actions.length === 5`)) === true, await ev(`curKey().actions`));
  check('...and the official config round-trips byte for byte', (await ev(`cfgText(curKey())`)) === 'Alias=Steam\r\nHidMode=False\r\nACT 2 C:\\Program Files (x86)\\Steam\\steam.exe\r\nWINDOWS\r\nDelay 20\r\nSTRING steam.exe\r\nENTER\r\n');
  await ev(`$('btnDeleteKey').click()`); check('Delete key empties the draft', (await ev(`curKey().deleted === true && curKey().actions.length === 0 && curKey().alias === ''`)) === true);

  // --- layouts, presets, save (stubbed)
  await ev(`applyLayout('excel-essentials')`);
  check('Excel layout fills 8 keys', (await ev(`draft().filter((e) => e.actions.length).length`)) === 8);
  await ev(`state.key = 5; renderKeys()`);
  check('Paste values parses into editable rows', (await ev(`seq.map((a) => a.type).join(',')`)) === 'shortcut,wait,shortcut,fkey', await ev(`seq.map((a) => a.type).join(',')`));
  await ev(`window.calls.length = 0; $('btnSave').onclick()`); await sleep(500);
  const calls = await ev(`calls`);
  check('Save sends 8 key PUTs and 8 icon PUTs for the dirty keys', calls.filter((c) => c[0] === 'PUT' && c[1].startsWith('/api/key')).length === 8 && calls.filter((c) => c[0] === 'PUT' && c[1].startsWith('/api/icon')).length === 8, calls.map((c) => c.join(' ')).slice(0, 4));
  const keyBodies = calls.filter((c) => c[0] === 'PUT' && c[1].startsWith('/api/key')).map((c) => JSON.parse(c[2]));
  check('Save sends the pad script separately, without ACT lines, and the ACT lines in the config', keyBodies.every((b) => Array.isArray(b.script) && b.script.every((l) => !/^ACT\b/.test(l)) && b.actions.some((l) => /^ACT /.test(l))), keyBodies[0]);
  await ev(`window.calls.length = 0; state.key = 5; renderKeys(); draft().forEach((e) => { e.dirty = true; }); $('btnSaveKey').onclick()`); await sleep(500);
  const one = await ev(`calls`); check('Save key writes only the selected key', one.filter((c) => c[0] === 'PUT' && c[1].startsWith('/api/key')).length === 1 && one.some((c) => c[1].includes('k=6')), one.map((c) => c.slice(0, 2).join(' ')));
  await ev(`draft().forEach((e) => { e.dirty = true; })`);
  await ev(`Object.assign(draft()[0], emptyKey(), { deleted: true, dirty: true }); window.calls.length = 0; $('btnSave').onclick()`); await sleep(500);
  const c2 = await ev(`calls`); check('Saving a deleted key sends DELETE for key and icon', c2.some((c) => c[0] === 'DELETE' && c[1].startsWith('/api/key')) && c2.some((c) => c[0] === 'DELETE' && c[1].startsWith('/api/icon')), c2.map((c) => c.join(' ')));

  // --- profiles, theme, device page, widgets
  await ev(`state.t = { kind: 'serial', write: async (b) => { window.lastWrite = Array.from(b); } }; changeProfiles(1)`); await sleep(200);
  check('"+" sends the profile count command and adds a tab', (await ev(`state.profiles`)) === 6 && String.fromCharCode(...(await ev(`lastWrite`)).slice(4)) === 'm6');
  await ev(`$('btnTheme').click()`); check('theme toggles to light and back', (await ev(`document.documentElement.dataset.theme`)) === 'light' && (await ev(`$('btnTheme2').click(); document.documentElement.dataset.theme`)) === 'dark');
  await ev(`$('fwSsid').value = 'My.Net'; $('fwPass').value = 'x'; $('btnFw').onclick(); 1`); await sleep(200);
  check('firmware: SSID containing a dot is refused, nothing sent', (await ev(`lastWrite[3]`)) !== 11 && !(await ev(`String.fromCharCode(...lastWrite.slice(4))`)).startsWith('4My'), await ev(`String.fromCharCode(...lastWrite.slice(4))`));
  await ev(`$('fwSsid').value = 'MyNet'; $('fwPass').value = 'pw'; $('btnFw').onclick(); 1`); await sleep(300);
  check('firmware: valid Wi-Fi sends the type-4 frame', (await ev(`String.fromCharCode(...lastWrite.slice(4))`)) === '4MyNet.pw');
  await ev(`state.t = null; showPage('device'); renderDevice(); 1`);
  check('Device page shows drive and disables unavailable items', (await ev(`$('devRow').textContent`)).includes('G:/') && (await ev(`document.querySelectorAll('#pageDevice button[disabled]').length`)) >= 2 && (await ev(`$('runActs').disabled`)) === true);
  await ev(`showPage('screen'); document.getElementById('w_sports').click()`);
  check('Sports widget lists every league and offers logos on keys', (await ev(`document.querySelectorAll('#wp_league option').length`)) > 300 && (await ev(`!!document.getElementById('btnLogos')`)) === true, await ev(`document.querySelectorAll('#wp_league option').length`));
  await ev(`document.getElementById('w_pcmonitor').click(); 1`); check('PC monitor widget selectable', (await ev(`run.selected.id`)) === 'pcmonitor');
  await ev(`showPage('keys'); state.drive = { drive: 'G:/', writable: true }; Object.assign(curKey(), { actions: [] }); renderEditor(curKey()); ['Mouse Click', 'Media Control', 'Device Ctrl', 'Functional Key', 'Input Text', 'Mouse Move'].forEach((n) => [...document.querySelectorAll('#palette button')].find((b) => b.textContent.includes(n)).click()); 1`);
  const opts = await ev(`[...document.querySelectorAll('#seq .arow')].map((r) => [...r.querySelectorAll('select')].map((s) => s.options.length).join('/'))`);
  check('dropdown sizes match the official app (clicks 5, media 7, device 9, keys 80+)', opts[0] === '5' && opts[1] === '7' && opts[2] === '9' && +opts[3] > 50, opts);
  check('Input Text has an "End with Enter" box and Mouse Move a "drag" box', (await ev(`document.querySelectorAll('#seq .arow')[4].querySelector('input[type=checkbox]') !== null && document.querySelectorAll('#seq .arow')[5].querySelector('input[type=checkbox]') !== null`)) === true);
  await ev(`document.querySelectorAll('#seq .arow')[4].querySelector('input[type=checkbox]').click()`); check('"End with Enter" is saved as ACT 4 ... ENTER', (await ev(`curKey().actions.join('|')`)).includes('ACT 4 Hello ENTER|STRING Hello|ENTER'), await ev(`curKey().actions.join('|')`));
  check('no uncaught page exceptions during the whole run', errors.length === 0, errors);
  console.log(`\n${ok} passed, ${bad} failed`);
  ws.close(); proc.kill(); await sleep(1500);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* Edge may still hold a file; the temp folder is disposable */ }
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR', e.message); proc.kill(); process.exit(2); });
