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
  await ev(`window.calls = []; window.realLoadProfile = loadProfile; api = async (p, o) => { calls.push([(o && o.method) || 'GET', p, o && typeof o.body === 'string' ? o.body : undefined]); return { json: async () => ({ drive: 'G:/', writable: true, runActions: false, exists: false, alias: '', hid: false, actions: [] }) }; }; window.confirm = () => true; window.alert = (m) => { window.lastAlert = m; }; 1`);

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

  // --- assigning single keys (bug: a preset moved the selection on, Save key then wrote nothing, and the reload wiped the assignment)
  await ev(`loadProfile = window.realLoadProfile; window.fakeDrive = {};
    api = async (p, o) => { const m = (o && o.method) || 'GET', u = new URL(p, 'http://x'), k = u.searchParams.get('p') + '.' + u.searchParams.get('k'); calls.push([m, p]);
      if (u.pathname === '/api/key' && m === 'PUT') { const b = JSON.parse(o.body); fakeDrive[k] = { exists: true, alias: b.alias, hid: b.hid, actions: b.actions }; return { json: async () => ({}) }; }
      if (u.pathname === '/api/key' && m === 'GET') return { json: async () => fakeDrive[k] || { exists: false, alias: '', hid: false, actions: [] } };
      return { json: async () => ({ drive: 'G:/', writable: true, runActions: false, exists: false, alias: '', hid: false, actions: [] }) }; };
    window.confirm = () => true; state.drive = { drive: 'G:/', writable: true }; state.profile = 4; delete state.drafts[4]; buildTabs(); loadProfile(4).then(() => 1)`);
  await sleep(300);
  const keyBtn = (i) => `document.querySelectorAll('#keys .key')[${i}].click()`, preset = (i) => `document.querySelectorAll('#gallery .pre')[${i}].click()`, lastLog = () => ev(`document.querySelector('#log div:last-child').textContent`);
  await ev(keyBtn(2)); await ev(preset(0));
  check('a preset goes on the selected key and the selection stays there', (await ev(`state.key === 2 && draft()[2].alias === 'Copy' && draft()[2].dirty === true && draft()[3].dirty === false`)) === true, await ev(`[state.key, draft()[2].alias]`));
  await ev(`window.calls.length = 0; $('btnSaveKey').click()`); await sleep(500);
  const wrote = (await ev(`calls`)).filter((c) => c[0] === 'PUT' && c[1].startsWith('/api/key'));
  check('Save key writes that key (profile 4, key 3) and nothing else', wrote.length === 1 && wrote[0][1] === '/api/key?p=4&k=3', wrote);
  check('...and the assignment is still there after the reload that follows a save', (await ev(`draft()[2].alias === 'Copy' && draft()[2].dirty === false`)) === true, await ev(`draft()[2].alias`));
  await ev(keyBtn(0)); await ev(preset(0)); await ev(keyBtn(1)); await ev(preset(1));
  await ev(`window.calls.length = 0; $('btnSaveKey').click()`); await sleep(500);
  const wrote2 = (await ev(`calls`)).filter((c) => c[0] === 'PUT' && c[1].startsWith('/api/key'));
  check('saving one key writes only that key', wrote2.length === 1 && wrote2[0][1] === '/api/key?p=4&k=2', wrote2);
  check('...and another key that is still unsaved keeps its new assignment', (await ev(`draft()[0].alias === 'Copy' && draft()[0].dirty === true && draft()[1].alias === 'Paste' && draft()[1].dirty === false`)) === true, await ev(`draft().map((e) => [e.alias, e.dirty])`));
  await ev(keyBtn(4)); await ev(`window.calls.length = 0; $('btnSaveKey').click()`); await sleep(400);
  check('Save key on a key with nothing to save writes nothing and does not claim it saved', (await ev(`calls`)).filter((c) => c[0] === 'PUT').length === 0 && /no unsaved/i.test(await lastLog()) && !/saved to the pad/i.test(await lastLog()), await lastLog());
  await ev(`window.confirm = () => false; $('btnReload').click()`); await sleep(300);
  check('Reload asks first when keys are unsaved, and declining keeps them', (await ev(`draft()[0].alias === 'Copy' && draft()[0].dirty === true`)) === true);
  await ev(`window.confirm = () => true; $('btnReload').click()`); await sleep(400);
  check('...and accepting reloads the pad\'s version', (await ev(`draft()[0].dirty === false && draft()[0].alias === ''`)) === true, await ev(`draft().map((e) => [e.alias, e.dirty])`));
  await ev(`state.profile = 3; buildTabs(); 1`);

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
  check('Live sports defaults to the score bug + ticker and has a league search box', (await ev(`$('wp_mode').value === 'bug' && !!$('wp_league_q')`)) === true);
  await ev(`$('wp_league_q').value = 'prem'; $('wp_league_q').dispatchEvent(new Event('input', { bubbles: true })); 1`);
  const hits = await ev(`[...document.querySelectorAll('#wp_league option')].map((o) => o.textContent)`);
  check('typing narrows the league list to matches (Premier League)', hits.length > 0 && hits.length < 60 && hits.some((n) => /premier/i.test(n)) && (await ev(`$('wp_league').size`)) > 1, hits.length);
  check('the first match is selected so Start uses it', (await ev(`document.querySelector('#wp_league option:checked') !== null && $('wp_league').value !== ''`)) === true);
  await ev(`$('wp_league_q').value = ''; $('wp_league_q').dispatchEvent(new Event('input', { bubbles: true })); 1`);
  check('clearing the search brings every league back', (await ev(`document.querySelectorAll('#wp_league option').length`)) > 300 && (await ev(`$('wp_league').size`)) === 1);
  await ev(`rememberLeague('football/nfl'); fillLeagues($('wp_league'), ''); 1`);
  check('a league you started shows first under Recent', (await ev(`document.querySelector('#wp_league optgroup').label`)).includes('Recent') && (await ev(`document.querySelector('#wp_league optgroup option').value`)) === 'football/nfl');
  check('ticker has one emoji chip per league and a plain-text switch', (await ev(`document.querySelectorAll('#tickChips button').length === L.TICKER_CHIPS.length && $('wp_emoji').value === 'on' && $('wp_also').value === ''`)) === true);
  check('chips show the sport emoji', (await ev(`document.querySelector('#tickChips button').textContent.startsWith('🏈')`)) === true);
  await ev(`document.querySelectorAll('#tickChips button')[0].click(); document.querySelectorAll('#tickChips button')[1].click(); 1`);
  check('tapping chips fills the ticker leagues and marks them on', (await ev(`$('wp_also').value === 'football/nfl,basketball/nba' && document.querySelectorAll('#tickChips button.on').length === 2`)) === true, await ev(`$('wp_also').value`));
  await ev(`document.querySelectorAll('#tickChips button')[0].click(); 1`);
  check('tapping a chip again removes that league', (await ev(`$('wp_also').value === 'basketball/nba'`)) === true);
  const emo = await ev(`[$('navScreen').textContent, document.querySelector('#wp_league option').textContent, $('pConn').textContent]`);
  const hasEmoji = (x) => /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(x);
  check('web app shows emoji in the tabs, the league list and the connection pill', emo.every(hasEmoji), emo);
  await ev(`document.getElementById('w_pcmonitor').click(); 1`); check('PC monitor widget selectable', (await ev(`run.selected.id`)) === 'pcmonitor');
  await ev(`showPage('keys'); state.drive = { drive: 'G:/', writable: true }; Object.assign(curKey(), { actions: [] }); renderEditor(curKey()); ['Mouse Click', 'Media Control', 'Device Ctrl', 'Functional Key', 'Input Text', 'Mouse Move'].forEach((n) => [...document.querySelectorAll('#palette button')].find((b) => b.textContent.includes(n)).click()); 1`);
  const opts = await ev(`[...document.querySelectorAll('#seq .arow')].map((r) => [...r.querySelectorAll('select')].map((s) => s.options.length).join('/'))`);
  check('dropdown sizes match the official app (clicks 5, media 7, device 9, keys 80+)', opts[0] === '5' && opts[1] === '7' && opts[2] === '9' && +opts[3] > 50, opts);
  check('Input Text has an "End with Enter" box and Mouse Move a "drag" box', (await ev(`document.querySelectorAll('#seq .arow')[4].querySelector('input[type=checkbox]') !== null && document.querySelectorAll('#seq .arow')[5].querySelector('input[type=checkbox]') !== null`)) === true);
  await ev(`document.querySelectorAll('#seq .arow')[4].querySelector('input[type=checkbox]').click()`); check('"End with Enter" is saved as ACT 4 ... ENTER', (await ev(`curKey().actions.join('|')`)).includes('ACT 4 Hello ENTER|STRING Hello|ENTER'), await ev(`curKey().actions.join('|')`));
  // --- context-aware profiles: stubbed window feed and serial writer, nothing reaches the pad
  await ev(`showPage('device'); renderContext(); 1`);
  check('context panel starts off and lists the 8 default rules', (await ev(`$('ctxOn').checked === false && document.querySelectorAll('#ctxRules .ctxrow').length === 8`)) === true);
  await ev(`clearInterval(ctxTimer); window.writes = []; window.fakeWin = { ok: true, process: 'notepad', title: 'Untitled' };
    api = async (p, o) => { const body = p === '/api/window' ? window.fakeWin : p === '/api/context' ? { enabled: true, fallback: 1, rules: [{ name: 'Notepad', process: ['notepad'], titleContains: '', profile: 4 }, { name: 'Far', process: ['far'], titleContains: '', profile: 9 }] } : { drive: 'G:/', writable: true, runActions: false, exists: false, alias: '', hid: false, actions: [] }; return { json: async () => body }; };
    state.t = { kind: 'serial', write: async (b) => { window.writes.push(Array.from(b)); } }; state.profiles = 5; switcher.reset(); loadContext().then(() => 1)`);
  const sws = () => ev(`writes.filter((w) => w[0] === 0x65 && w[4] === 0x39)`);
  check('rules come from the helper and the panel shows them', (await ev(`$('ctxOn').checked && document.querySelectorAll('#ctxRules .ctxrow').length === 2`)) === true);
  await ev(`ctxTick(0)`); check('Notepad in front for under 600 ms sends nothing', (await sws()).length === 0);
  await ev(`ctxTick(700)`); check('...and after 700 ms exactly one switch to profile 4', JSON.stringify(await sws()) === JSON.stringify([[0x65, 0x62, 0x66, 4, 0x39, 0x34, 0x2e, 0x30]]), await sws());
  await ev(`ctxTick(1700)`); check('the same profile is never sent twice', (await sws()).length === 1);
  await ev(`onKeyPress(2, 1)`); await ev(`ctxTick(4000)`); await ev(`ctxTick(4700)`);
  check('a pad key press in another profile pauses switching', (await sws()).length === 1 && (await ev(`$('ctxStatus').textContent`)).includes('paused'), await ev(`$('ctxStatus').textContent`));
  await ev(`fakeWin = { ok: true, process: 'notepad', title: 'Untitled 2' }; ctxTick(5000)`); await ev(`ctxTick(5700)`);
  check('...a new title in the same app does not end the pause', (await sws()).length === 1);
  await ev(`fakeWin = { ok: true, process: 'explorer', title: 'Docs' }; ctxTick(6000)`); await ev(`ctxTick(6700)`);
  check('...another app ends it and goes to the fallback profile 1', (await sws()).length === 2 && JSON.stringify((await sws())[1]) === JSON.stringify([0x65, 0x62, 0x66, 4, 0x39, 0x31, 0x2e, 0x30]));
  await ev(`fakeWin = { ok: true, process: 'notepad', title: 'Untitled 3' }; ctxTick(6800)`); await ev(`ctxTick(7500)`);
  check('back to Notepad goes to profile 4 again', (await sws()).length === 3 && JSON.stringify((await sws())[2]) === JSON.stringify([0x65, 0x62, 0x66, 4, 0x39, 0x34, 0x2e, 0x30]));
  await ev(`fakeWin = { ok: true, process: 'far', title: 'x' }; ctxTick(8000)`); await ev(`ctxTick(8700)`);
  check('a profile the pad does not have sends nothing and says so', (await sws()).length === 3 && (await ev(`$('ctxStatus').textContent`)).includes('not on the pad'), await ev(`$('ctxStatus').textContent`));
  await ev(`fakeWin = { ok: true, process: '', title: '' }; ctxTick(9000)`); await ev(`ctxTick(9800)`);
  check('an empty window (lock screen) sends nothing', (await sws()).length === 3);
  await ev(`fakeWin = { ok: false, process: '', title: '' }; ctxTick(9500)`);
  check('helper that cannot read the window shows switching is off', (await ev(`$('ctxStatus').textContent`)).startsWith('Off'), await ev(`$('ctxStatus').textContent`));
  await ev(`state.t = null; ctxTick(9900)`);
  check('not connected shows Off and sends nothing', (await ev(`$('ctxStatus').textContent`)).includes('connect the pad') && (await sws()).length === 3);
  await ev(`state.t = { kind: 'serial', write: async (b) => { if (window.failNext) { window.failNext = false; throw new Error('WritableStream is locked'); } window.writes.push(Array.from(b)); } }; switcher.reset(); window.failNext = true; fakeWin = { ok: true, process: 'notepad', title: 'N' }; ctxTick(20000)`); await ev(`ctxTick(20700)`); const before = (await sws()).length; await ev(`ctxTick(21000)`); await ev(`ctxTick(21700)`);
  check('a failed switch write is retried on the next stable ticks', (await sws()).length === before + 1, [before, (await sws()).length]);
  await ev(`navigator.serial.requestPort = null; window.endRead = null; Object.defineProperty(navigator, 'serial', { configurable: true, value: { requestPort: async () => ({ open: async () => {}, close: async () => {}, readable: { getReader: () => ({ read: () => new Promise((res) => { window.endRead = () => res({ done: true }); }), cancel: async () => {}, releaseLock: () => {} }) }, writable: { getWriter: () => ({ write: async () => {}, releaseLock: () => {} }) } }) } }); state.t = null; $('btnSerial').click()`); await sleep(400);
  check('test connection is up', (await ev(`state.t !== null`)) === true);
  await ev(`window.endRead()`); await sleep(400); await ev(`ctxTick(30000)`);
  check('unplugging the pad (read loop ends) disconnects and the panel says Off', (await ev(`state.t === null && $('ctxStatus').textContent.includes('connect the pad')`)) === true, await ev(`$('ctxStatus').textContent`));
  // --- auto reconnect after a page refresh (WebSerial remembers a port the user already allowed)
  await ev(`window.mkPort = (o = {}) => ({ getInfo: () => ({ usbVendorId: o.vid || 0x303a }), open: async () => { if (o.failOpen) throw new Error('Failed to open serial port'); }, close: async () => {}, readable: { getReader: () => ({ read: () => new Promise((res) => { window.endRead = () => res({ done: true }); }), cancel: async () => {}, releaseLock: () => {} }) }, writable: { getWriter: () => ({ write: async () => {}, releaseLock: () => {} }) } });
    window.setPorts = (list) => Object.defineProperty(navigator, 'serial', { configurable: true, value: { getPorts: async () => list, requestPort: async () => list[0], addEventListener: () => {} } }); localStorage.removeItem('padAutoConnect'); state.t = null; setPorts([]); 1`);
  await ev(`autoConnect()`); check('no remembered port: nothing happens and nothing breaks', (await ev(`state.t === null`)) === true);
  await ev(`setPorts([mkPort({ vid: 0x1234 })])`); await ev(`autoConnect()`); check('a port that is not the pad is ignored', (await ev(`state.t === null`)) === true);
  await ev(`setPorts([mkPort({ failOpen: true })])`); await ev(`autoConnect()`); check('a port that will not open (official app running) fails quietly, logged', (await ev(`state.t === null && [...document.querySelectorAll('#log div')].some((d) => d.textContent.includes('auto-reconnect failed'))`)) === true);
  await ev(`setPorts([mkPort()])`); await ev(`autoConnect()`); await sleep(300); check('the pad is reopened without clicking Connect', (await ev(`state.t !== null && $('pConn').textContent.includes('connected')`)) === true);
  await ev(`$('btnDisc').click()`); await sleep(300); await ev(`autoConnect()`);
  check('after you click Disconnect it stays disconnected, even after a refresh', (await ev(`state.t === null && localStorage.getItem('padAutoConnect') === '0'`)) === true);
  await ev(`$('btnSerial').click()`); await sleep(300);
  check('clicking Connect turns auto-reconnect back on', (await ev(`state.t !== null && localStorage.getItem('padAutoConnect') === '1'`)) === true);
  await ev(`window.endRead(); 1`); await sleep(300); await ev(`autoConnect()`); await sleep(300);
  check('after the cable is replugged (read loop ended) it reconnects', (await ev(`state.t !== null`)) === true);
  await ev(`state.t = { kind: 'serial', write: async (b) => { window.writes.push(Array.from(b)); } }; $('ctxTestProfile').value = '3'; $('btnCtxTest').click()`); await sleep(200);
  check('test button sends the frame for the chosen profile', JSON.stringify((await sws()).slice(-1)[0]) === JSON.stringify([0x65, 0x62, 0x66, 4, 0x39, 0x33, 0x2e, 0x30]), await sws());
  check('no uncaught page exceptions during the whole run', errors.length === 0, errors);
  console.log(`\n${ok} passed, ${bad} failed`);
  ws.close(); proc.kill(); await sleep(1500);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* Edge may still hold a file; the temp folder is disposable */ }
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR', e.message); proc.kill(); process.exit(2); });
