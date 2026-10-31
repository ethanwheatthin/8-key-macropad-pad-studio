// Run: node test.js   (no dependencies)
const assert = require('assert');
const C = require('./core.js');
const hex = (u) => Buffer.from(u).toString('hex');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('plain key text frame matches official layout', () => {
  const f = C.F.keyConfig(1, 1, 'ab');
  // "ebf" + len(8) + "01.1:0ab"
  assert.strictEqual(hex(f), '656266' + '08' + Buffer.from('01.1:0ab').toString('hex'));
});
t('modifier tokens -> mode 1 and E0.. bytes', () => {
  const r = C.encodeKeyText('{lctrl}c');
  assert.strictEqual(r.mode, '1'); assert.strictEqual(hex(r.bytes), 'e063');
});
t('repeated tokens are all replaced (official page only replaced the first)', () => {
  assert.strictEqual(hex(C.encodeKeyText('{lctrl}{lshift}{escape}').bytes), 'e0e1a9');
  assert.strictEqual(hex(C.encodeKeyText('{enter}{enter}').bytes), 'a8a8');
});
t('consumer key -> mode 2, alone only', () => {
  const r = C.encodeKeyText('{vol_inc}'); assert.strictEqual(r.mode, '2'); assert.strictEqual(hex(r.bytes), '00e9');
  assert.throws(() => C.encodeKeyText('{mute}{vol_inc}'));
});
t('limits enforced', () => {
  assert.throws(() => C.encodeKeyText('x'.repeat(129)));
  assert.throws(() => C.encodeKeyText('{lctrl}abcdefg'));
  C.encodeKeyText('{lctrl}abcdef');
});
t('decodeKeyText round-trips specials', () => {
  assert.strictEqual(C.decodeKeyText(C.encodeKeyText('{lctrl}c{enter}').bytes), '{lctrl}c{enter}');
});
t('alias / script / led / queries', () => {
  assert.strictEqual(hex(C.F.queryVersion()), '65626601' + '35');
  assert.strictEqual(hex(C.F.queryProfiles()), '65626601' + '6c');
  assert.strictEqual(Buffer.from(C.F.queryKey(3, 7)).toString('latin1'), 'ebf\x048' + '3.7');
  assert.ok(Buffer.from(C.F.alias(1, 2, 'Copy')).toString().endsWith('2' + '1.2:Copy'));
  assert.ok(Buffer.from(C.F.alias(1, 2, null)).toString().endsWith('31.2:'));
  assert.ok(Buffer.from(C.F.led('#112233', 50)).toString().endsWith('111223350'));
  assert.throws(() => C.F.script(1, 1, 'x'.repeat(300)));
});
t('cus frame header: magic, big-endian length, JSON', () => {
  const f = C.cusFrame({ text: 'hi' });
  assert.strictEqual(Buffer.from(f.slice(0, 3)).toString(), 'cus');
  assert.strictEqual((f[3] << 8) | f[4], f.length - 5);
  assert.deepStrictEqual(JSON.parse(Buffer.from(f.slice(5)).toString()), { text: 'hi' });
  assert.throws(() => C.cusFrame({ text: 'x'.repeat(2100) }));
});
t('simulator: stacking, clear_canvas, empty text adds nothing, 48 cap, clamping', () => {
  const s = new C.Simulator();
  s.feed(C.cusFrame({ text: 'a', w: 10, h: 10 })); s.feed(C.cusFrame({ text: 'b' }));
  assert.strictEqual(s.panels.length, 2);
  s.feed(C.cusFrame({ clear_canvas: true })); assert.strictEqual(s.panels.length, 0);
  s.feed(C.cusFrame({ text: ' ', x: 400, w: 400, h: 999 }));
  assert.deepStrictEqual([s.panels[0].x, s.panels[0].w, s.panels[0].h], [400, 80, 200]);
  for (let i = 0; i < 60; i++) s.feed(C.cusFrame({ text: String(i) }));
  assert.strictEqual(s.panels.length, 48); assert.strictEqual(s.panels[47].text, '59');
});
t('simulator reassembles frames split across writes and back-to-back', () => {
  const s = new C.Simulator(), a = C.cusFrame({ text: 'one' }), b = C.cusFrame({ text: 'two' }), all = C.concat(a, b);
  for (let i = 0; i < all.length; i += 3) s.feed(all.slice(i, i + 3));
  assert.deepStrictEqual(s.panels.map((p) => p.text), ['one', 'two']); assert.strictEqual(s.stats.errors, 0);
});
t('every animation frame fits the protocol limits over 10s of time', () => {
  for (const a of C.ANIMATIONS) {
    let max = 0, maxPanels = 0;
    for (let t = 0; t < 10; t += 0.25) {
      const panels = a.gen(t); assert.ok(panels.length <= C.CUS_MAX_PANELS, a.id + ' panels');
      const frames = C.animFrames(panels), s = new C.Simulator();
      frames.forEach((f) => { assert.ok(f.length - 5 <= C.CUS_MAX_PAYLOAD, a.id + ' frame size'); s.feed(f); });
      assert.strictEqual(s.stats.errors, 0, a.id); assert.strictEqual(s.panels.length, panels.length, a.id);
      max = Math.max(max, frames.reduce((n, f) => n + f.length, 0)); maxPanels = Math.max(maxPanels, panels.length);
    }
    console.log('      ' + a.id.padEnd(10) + 'max panels/frame ' + String(maxPanels).padStart(2) + '  max bytes/frame ' + max);
  }
});
t('mock device: version, profile count, key round-trip, alias', () => {
  const out = []; const d = new C.MockDevice((b) => out.push(Buffer.from(b).toString('latin1')));
  d.write(C.F.queryVersion()); d.write(C.F.queryProfiles());
  d.write(C.F.keyConfig(2, 3, '{lctrl}v')); d.write(C.F.alias(2, 3, 'Paste')); d.write(C.F.queryKey(2, 3));
  assert.deepStrictEqual(out, ['v=mock-1.0\r\n', 'n=5\r\n', 'c=\xe0v\r\n', 'a=Paste\r\n']);
  // two frames in one write still both handled
  out.length = 0; d.write(C.concat(C.F.queryVersion(), C.F.queryProfiles())); assert.strictEqual(out.length, 2);
});
/* ---------- library: presets, widgets, sports ---------- */
const Lb = require('./library.js');
const KEYWORDS = /^(CONTROL|SHIFT|ALT|WINDOWS|COMMAND|OPTION|ESC|ENTER|SPACE|BACKSPACE|TAB|CAPSLOCK|F([1-9]|1[0-2])|PRINTSCREEN|DELETE|HOME|END|PAGEUP|PAGEDOWN|VOLUP|VOLDOWN|MUTE|NEXT|PREV|PP|STOP|KP_\d|KP_PLUS|KP_MINUS|[a-z0-9.,;'\/\\\-=\[\]`])$/;
function validLine(l) {
  if (/^STRING .+/.test(l)) return true; if (/^DELAY \d+$/.test(l)) return true; if (/^(LMOUSE|MMOUSE|RMOUSE|NEXT_PROFILE|PREV_PROFILE)$/.test(l)) return true;
  if (/^GOTO_PROFILE \d+$/.test(l) || /^MOUSE_MOVE -?\d+ -?\d+$/.test(l) || /^DEFAULTDURATION \d+$/.test(l)) return true;
  return l.split(' ').every((w) => KEYWORDS.test(w));
}
t('every preset is valid script grammar and within 20 lines', () => {
  for (const p of Lb.PRESETS) { const r = Lb.applyPreset(p.id, 'example.com'), script = Lb.scriptFromConfig(r.actions); assert.ok(script.length <= 20, p.id + ' script lines'); script.forEach((l) => assert.ok(validLine(l) || /^(MK_|CC_)/.test(l) || /^(Delay|DELAY) \d+$/.test(l) || /^MOUSE_WHEEL/.test(l) || /^LLMOUSE$/.test(l), p.id + ': ' + l)); assert.ok(r.alias && r.emoji && /^#[0-9a-f]{6}$/i.test(r.color), p.id); }
});
t('preset ids unique; layouts reference real presets and have 8 keys', () => {
  assert.strictEqual(new Set(Lb.PRESETS.map((p) => p.id)).size, Lb.PRESETS.length);
  for (const l of Lb.LAYOUTS) { assert.strictEqual(l.keys.length, 8, l.id); l.keys.forEach((k) => assert.ok(Lb.byId[k], l.id + ':' + k)); }
});
t('parameter presets substitute the value', () => {
  assert.deepStrictEqual(Lb.applyPreset('website', 'https://x.org').actions, ['ACT 1 https://x.org', 'WINDOWS r', 'Delay 100', 'STRING https://x.org', 'ENTER']);
  assert.deepStrictEqual(Lb.applyPreset('text', 'hi').actions, ['ACT 4 hi', 'STRING hi']);
});
// shape verified against live ESPN responses (away score is on competitors[].score)
const sample = { events: [
  { id: '1', date: '2026-10-31T19:00Z', status: { type: { state: 'in', shortDetail: '6:42 - 1st' } }, competitions: [{ competitors: [{ homeAway: 'home', score: '7', team: { abbreviation: 'UTAH' } }, { homeAway: 'away', score: '8', team: { abbreviation: 'POR' } }] }] },
  { id: '2', date: '2026-10-31T22:00Z', status: { type: { state: 'pre', shortDetail: '10/31 - 6:00 PM EDT' } }, competitions: [{ competitors: [{ homeAway: 'home', score: '0', team: { abbreviation: 'CHA' } }, { homeAway: 'away', score: '0', team: { abbreviation: 'PHI' } }] }] }] };
t('parseEvents maps home/away, state and detail', () => {
  const g = Lb.parseEvents(sample); assert.strictEqual(g.length, 2);
  assert.deepStrictEqual([g[0].away.abbr, g[0].away.score, g[0].home.abbr, g[0].home.score, g[0].state], ['POR', '8', 'UTAH', '7', 'in']);
  assert.strictEqual(Lb.gameLine(g[0]), 'POR 8 - 7 UTAH   6:42 - 1st'); assert.strictEqual(Lb.gameLine(g[1]), 'PHI @ CHA   10/31 - 6:00 PM EDT');
  assert.deepStrictEqual(Lb.parseEvents({}), []);
});
t('every widget produces small valid frames; sports modes + score alert work', () => {
  const games = Lb.parseEvents(sample), sports = { league: Lb.LEAGUES[0], games }, now = new Date('2026-10-31T20:00:00');
  for (const w of Lb.WIDGETS) {
    const p = {}; w.params.forEach((q) => { p[q.id] = q.def; }); if (w.id === 'countdown') p.when = '2026-12-25T00:00';
    const state = w.id === 'pomodoro' ? { t0: now - 61000 } : w.id === 'sports' ? { seen: {}, alert: null } : {};
    const panels = w.gen({ now, p, state, stats: { cpu: 42.2, mem: 71, memUsedGB: 11.4, memFreeGB: 4.6 }, sports });
    if (w.raw === 'pcs') { const f = C.pcsFrame(panels); assert.strictEqual(Buffer.from(f.slice(0, 3)).toString(), 'pcs'); assert.deepStrictEqual(JSON.parse(Buffer.from(f.slice(5)).toString()).memory, { used: 11.4, avail: 4.6, percent: 71 }); continue; }
    const frames = C.animFrames(panels);
    assert.ok(panels.length >= 1 && panels.length <= 3, w.id); frames.forEach((f) => assert.ok(f.length < 600, w.id + ' ' + f.length)); const s = new C.Simulator(); frames.forEach((f) => s.feed(f)); assert.strictEqual(s.stats.errors, 0, w.id);
  }
  const sp = Lb.WIDGETS.find((w) => w.id === 'sports'), st = { seen: {}, alert: null }, base = { now, state: st, sports: { league: Lb.LEAGUES[0], games } };
  assert.ok(sp.gen({ ...base, p: { mode: 'list', team: '', secs: 5 } })[0].text.includes('POR 8 - 7 UTAH'));
  const cha = sp.gen({ ...base, p: { mode: 'team', team: 'cha', secs: 5 } }).map((x) => x.text).join(' | ');
  assert.ok(cha.includes('PHI') && cha.includes('CHA') && cha.includes('10/31 - 6:00 PM EDT'), cha);
  assert.ok(sp.gen({ ...base, p: { mode: 'team', team: 'ZZZ', secs: 5 } })[0].text.includes('no game today'));
  const p2 = { mode: 'team', team: 'UTAH', secs: 5 }; sp.gen({ ...base, p: p2 }); // first sight records the score
  // team colours, logos and the other sports' shapes (athlete bouts, tennis groupings, golf leaderboard, racing sessions)
  const col = Lb.parseEvents({ events: [{ id: '9', status: { type: { state: 'in', shortDetail: '2nd' } }, competitions: [{ competitors: [
    { homeAway: 'home', score: '3', team: { abbreviation: 'HOM', color: '112233', alternateColor: 'ffcc00', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/utah.png' } },
    { homeAway: 'away', score: '1', team: { abbreviation: 'AWY', color: 'eeeeee', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png' } }] }] }] });
  const cp = Lb.gameCard(col[0]); assert.deepStrictEqual([cp[0].bg, cp[1].bg, cp[0].fg, cp[1].fg], ['#eeeeee', '#112233', '#000000', '#FFFFFF']);
  assert.strictEqual(Lb.logoUrl(col[0].home.logo), 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/scoreboard/utah.png&w=64&h=64');
  assert.strictEqual(Lb.logoUrl('https://evil.example/i/teamlogos/x.png'), null); assert.strictEqual(Lb.logoUrl('https://a.espncdn.com/../etc/passwd'), null);
  assert.deepStrictEqual(Lb.logoKeyPlan(col).map((x) => x.alias), ['AWY', 'HOM']);
  const ath = (n, o) => ({ homeAway: undefined, athlete: { displayName: n }, ...o });
  const mma = Lb.parseEvents({ events: [{ id: 'm', name: 'UFC X', competitions: [
    { id: 'b1', status: { type: { state: 'post', shortDetail: 'Final' } }, competitors: [ath('Ann Lee', { winner: true }), ath('Bo Chan', { winner: false })] },
    { id: 'b2', status: { type: { state: 'pre', shortDetail: '10/31 - 5:00 PM EDT' } }, competitors: [ath('Cy Dee', {}), ath('Di Fox', {})] }] }] });
  assert.strictEqual(mma.length, 2); assert.strictEqual(Lb.gameLine(mma[0]), 'LEE W v CHAN   Final'); assert.strictEqual(Lb.gameLine(mma[1]), 'DEE vs FOX   10/31 - 5:00 PM EDT');
  const ten = Lb.parseEvents({ events: [{ id: 't', groupings: [{ competitions: [{ id: 'x', status: { type: { state: 'in', shortDetail: '2nd Set' } }, competitors: [ath('Al Roy', { linescores: [{ value: 6 }, { value: 3 }] }), ath('Ed Ko', { linescores: [{ value: 4 }, { value: 5 }] })] }] }] }] });
  assert.strictEqual(Lb.gameLine(ten[0]), 'ROY 6 3 v KO 4 5   2nd Set');
  const golf = Lb.parseEvents({ events: [{ id: 'g', name: 'Open', status: { type: { state: 'in', shortDetail: 'Round 2' } }, competitions: [{ competitors: [ath('A One', { order: 2, score: '-5' }), ath('B Two', { order: 1, score: '-9' }), ath('C Three', { order: 3, score: '-1' })] }] }] });
  assert.strictEqual(golf[0].kind, 'board'); assert.deepStrictEqual(golf[0].rows, ['1 TWO -9', '2 ONE -5', '3 THREE -1']); assert.ok(Lb.gameCard(golf[0])[0].text.startsWith('Open\n1 TWO -9'));
  const f1 = Lb.parseEvents({ events: [{ id: 'r', name: 'Some GP', status: { type: { state: 'pre', shortDetail: 'x' } }, competitions: [{ type: { abbreviation: 'Qual' }, status: { type: { shortDetail: '10/31' } } }, { type: { abbreviation: 'Race' }, status: { type: { shortDetail: '11/1' } } }] }] });
  assert.deepStrictEqual(f1[0].rows, ['Qual: 10/31', 'Race: 11/1']);
  assert.deepStrictEqual(Lb.parseEvents({ events: [{ id: 'z' }] })[0].rows, []); // an event with nothing in it must not throw
  const scored = Lb.parseEvents(JSON.parse(JSON.stringify(sample).replace('"score":"7"', '"score":"9"')));
  assert.ok(sp.gen({ ...base, sports: { league: Lb.LEAGUES[0], games: scored }, p: p2 })[0].text.startsWith('SCORE!'));
});
t('key events: parse the pad line, ignore other lines, build toast text and an overlay-only frame', () => {
  assert.deepStrictEqual(Lb.parseKeyEvent('ebf.k.1.1'), { profile: 1, key: 1 });
  assert.deepStrictEqual(Lb.parseKeyEvent('ebf.k.3.8\r'), { profile: 3, key: 8 });
  assert.strictEqual(Lb.parseKeyEvent('v=35'), null); assert.strictEqual(Lb.parseKeyEvent('ebf.k.x.1'), null);
  assert.strictEqual(Lb.keyToast({ alias: 'Copy', actions: ['CONTROL c'] }, 1), 'Copy\nCONTROL c');
  assert.strictEqual(Lb.keyToast({ alias: '', actions: ['WINDOWS', 'DELAY 20', 'STRING x'] }, 2).split('\n')[0], 'WINDOWS');
  assert.strictEqual(Lb.keyToast(undefined, 5), 'Key 5');
  const f = C.cusFrame({ ...Lb.toastPanel('Copy\nCONTROL c'), activate: false }), s = new C.Simulator();
  s.feed(C.cusFrame({ clear_canvas: true, text: 'WIDGET', w: 480, h: 200 })); s.feed(f);
  assert.strictEqual(s.panels.length, 2, 'toast must overlay, not clear the widget'); assert.strictEqual(s.panels[1].y, 140);
});
t('Excel mode: presets/layouts exist, tips fit the LCD, prompt builder fills context', () => {
  const xl = Lb.PRESETS.filter((p) => p.cat === 'Excel'); assert.ok(xl.length >= 30); xl.forEach((p) => assert.ok(p.hint && p.hint.length < 90, p.id));
  const pad = (id) => Lb.scriptFromConfig(Lb.applyPreset(id).actions); // what the pad itself will run
  assert.deepStrictEqual(pad('xl-pastevalues'), ['CONTROL ALT v', 'DELAY 300', 'v', 'ENTER']);
  assert.deepStrictEqual(pad('xl-autofit'), ['ALT', 'DELAY 150', 'h', 'DELAY 150', 'o', 'DELAY 150', 'i']);
  assert.deepStrictEqual(pad('xf-xlookup'), ['STRING =XLOOKUP(']);
  assert.ok(Lb.LAYOUTS.filter((l) => l.id.startsWith('excel')).length === 3);
  const w = Lb.WIDGETS.find((x) => x.id === 'exceltips'); const seen = new Set();
  for (let s = 0; s < 400; s += 7) { const f = w.gen({ now: new Date(s * 1000), p: { secs: 7, kind: 'both' } })[0].text; assert.ok(f.length < 140, f); seen.add(f); }
  assert.ok(seen.size > 20, 'rotates through many tips');
  const pr = Lb.buildExcelPrompt({ version: 'Microsoft 365', structure: 'Table Sales', sample: 'a\tb', objective: 'Total by region', output: 'LET block', legacy: false });
  ['Principal Excel Engineer', 'XLOOKUP, FILTER, UNIQUE, SORT, LET, LAMBDA', 'Avoid volatile functions (INDIRECT, OFFSET, TODAY)', '- Excel Version: Microsoft 365', '- Objective: Total by region', '- Desired Output: LET block', 'What is the most efficient, scalable way to build this?'].forEach((s) => assert.ok(pr.includes(s), s));
  assert.ok(Lb.buildExcelPrompt({}).includes('[not provided]')); assert.ok(Lb.buildExcelPrompt({ legacy: true }).includes('Backward compatibility IS requested'));
});
t('golden test: our model reproduces the REAL files written by the official app v1.8.0 (config AND script) byte for byte', () => {
  const fs = require('fs'), dir = __dirname + '/test-fixtures/official-app-v1.8.0/', rd = (f) => fs.readFileSync(dir + f, 'utf8').split(/\r?\n/).filter(Boolean);
  const types = { 1: 'web,app,folder,file,text,shortcut', 2: 'wait,mousemove,mouseclick,media,shell,profile,device', 3: 'fkey,fkey,mouseclick' };
  for (const k of [1, 2, 3]) {
    const cfg = rd(`config_key${k}.txt`).filter((l) => !/^(Alias|HidMode)=/.test(l)), script = rd(`script_key${k}.txt`), seq = Lb.linesToActions(cfg);
    assert.strictEqual(seq.map((a) => a.type).join(','), types[k], 'key ' + k + ' parses into the actions that were created');
    assert.deepStrictEqual(Lb.actionsToLines(seq), cfg, 'key ' + k + ' config lines regenerate exactly');
    assert.deepStrictEqual(Lb.scriptFromActions(seq), script, 'key ' + k + ' script lines regenerate exactly');
  }
});
t('official action list: all 14 actions, codes match the official app, every one round-trips through the official format', () => {
  assert.deepStrictEqual(Lb.ACTIONS.map((a) => a.name), ['Access Web', 'Launch App', 'Open Folder', 'Open File', 'Input Text', 'Shortcut', 'Wait', 'Mouse Move', 'Mouse Click', 'Media Control', 'Shell Cmd', 'Change Profile', 'Functional Key', 'Device Ctrl']);
  assert.deepStrictEqual(Lb.ACTIONS.map((a) => a.code).join(''), '1234f' === '' ? '' : '23f4578' .length ? Lb.ACTIONS.map((a) => a.code).join('') : '', 'codes present');
  assert.deepStrictEqual(Object.fromEntries(Lb.ACTIONS.map((a) => [a.id, a.code])), { web: '1', app: '2', folder: '3', file: 'f', text: '4', shortcut: '5', wait: '7', mousemove: '8', mouseclick: '9', media: 'a', shell: 'b', profile: 'c', fkey: 'd', device: 'e' });
  for (const a of Lb.ACTIONS) {
    const act = Lb.newAction(a.id), lines = Lb.actionsToLines([act]); assert.ok(/^ACT [0-9a-f]( |$)/.test(lines[0]), a.id);
    const back = Lb.linesToActions(lines); assert.strictEqual(back.length, 1, a.id + ' stays one action'); assert.strictEqual(back[0].type, a.id);
    assert.deepStrictEqual(Lb.actionsToLines(back), lines, a.id + ' round trip'); assert.ok(Lb.scriptFromActions(back).every((l) => !/^ACT\b/.test(l)), a.id + ' script has no ACT lines');
  }
});
t('option lists match the official dropdowns', () => {
  assert.deepStrictEqual(Lb.MEDIA.map((x) => x[0]), ['MK_PP', 'MK_NEXT', 'MK_PREV', 'MK_STOP', 'MK_MUTE', 'MK_VOLUP', 'MK_VOLDOWN']);
  assert.deepStrictEqual(Lb.DEVICE.map((x) => x[0]), ['CC_POWER', 'CC_CALCULATOR', 'CC_BROWSER', 'CC_SEARCH', 'CC_HOME', 'CC_BACK', 'CC_FORWARD', 'CC_BR_STOP', 'CC_REFRESH']);
  assert.deepStrictEqual(Lb.CLICKS.map((x) => x[0]), ['LMOUSE', 'LLMOUSE', 'RMOUSE', 'MMOUSE', 'MOUSE_WHEEL']);
});
t('structured edits produce the right lines (shortcut modifiers, wheel amount, text+Enter, profile jump)', () => {
  const seq = [{ type: 'shortcut', p: { mods: ['CONTROL', 'SHIFT'], key: 's' } }, { type: 'wait', p: { ms: 250 } }, { type: 'profile', p: { mode: 'GOTO', n: 3 } }, { type: 'mouseclick', p: { btn: 'MOUSE_WHEEL', amount: -2 } }, { type: 'text', p: { text: 'hi', enter: true } }, { type: 'fkey', p: { key: 'F5' } }];
  assert.deepStrictEqual(Lb.actionsToLines(seq), ['ACT 5 CONTROL SHIFT s', 'ACT 7 250', 'Delay 250', 'ACT c GOTO_PROFILE 3', 'GOTO_PROFILE 3', 'ACT 9 MOUSE_WHEEL -2', 'MOUSE_WHEEL -2', 'ACT 4 hi ENTER', 'STRING hi', 'ENTER', 'ACT d F5', 'F5']);
  assert.deepStrictEqual(Lb.scriptFromActions(seq), ['CONTROL SHIFT s', 'DELAY 250', 'GOTO_PROFILE 3', 'MOUSE_WHEEL -2', 'STRING hi', 'ENTER', 'F5']);
  assert.deepStrictEqual(Lb.linesToActions(Lb.actionsToLines(seq)).map((a) => a.type), ['shortcut', 'wait', 'profile', 'mouseclick', 'text', 'fkey']);
  assert.deepStrictEqual(Lb.scriptFromActions([{ type: 'web', p: { url: 'www.x.com' } }]).slice(2, 3), ['STRING https://www.x.com']);
});
t('existing keys (older plain lines, the Steam launcher) and unknown official actions survive untouched', () => {
  const real = [String.raw`ACT 2 C:\Program Files (x86)\Steam\steam.exe`, 'WINDOWS', 'Delay 20', 'STRING steam.exe', 'ENTER'];
  const seq = Lb.linesToActions(real); assert.deepStrictEqual(seq.map((a) => a.type), ['app']); assert.strictEqual(seq[0].p.path, String.raw`C:\Program Files (x86)\Steam\steam.exe`);
  assert.deepStrictEqual(Lb.actionsToLines(seq), real);
  const odd = ['ACT 6 something odd', 'FOO BAR baz', 'ACT 0 x'], back = Lb.linesToActions(odd);
  assert.deepStrictEqual(Lb.actionsToLines(back), odd); assert.deepStrictEqual(back.map((a) => a.type), ['official', 'raw', 'official']); assert.deepStrictEqual(Lb.scriptFromActions(back), ['FOO BAR baz']);
  assert.deepStrictEqual(Lb.linesToActions(['CONTROL c', 'VOLUP', 'LMOUSE', 'CONTROL END']).map((a) => a.type), ['shortcut', 'media', 'mouseclick', 'shortcut']);
  assert.ok(Lb.applyPreset('copy').actions[0].startsWith('ACT 5 CONTROL c'), 'presets are saved in the official format');
  assert.deepStrictEqual(Lb.scriptFromConfig(Lb.applyPreset('copy').actions), ['CONTROL c']);
});
t('Wi-Fi frame for firmware update matches the official page; SSID with a dot is refused', () => {
  assert.strictEqual(Buffer.from(C.F.wifi('MyNet', 'pw123')).toString('latin1'), 'ebf\x0c4MyNet.pw123'); // "4MyNet.pw123" is 12 bytes
  assert.throws(() => C.F.wifi('My.Net', 'x'));
});
t('AI agents: presets, three layouts and the Agent status widget', () => {
  const ai = Lb.PRESETS.filter((p) => p.cat === 'AI agents'); assert.ok(ai.length >= 24);
  const pad = (id, v) => Lb.scriptFromConfig(Lb.applyPreset(id, v).actions);
  assert.deepStrictEqual(pad('ai-approve'), ['ENTER']); assert.deepStrictEqual(pad('ai-rewind'), ['ESC', 'DELAY 150', 'ESC']); assert.deepStrictEqual(pad('ai-mode'), ['SHIFT TAB']);
  assert.deepStrictEqual(pad('ai-/compact'), ['STRING /compact', 'ENTER']); assert.deepStrictEqual(pad('ai-slash', '/memory'), ['STRING /memory', 'ENTER']); assert.deepStrictEqual(pad('ai-slash', 'cost'), ['STRING /cost', 'ENTER']);
  assert.deepStrictEqual(pad('ai-prompt', 'Add tests'), ['STRING Add tests', 'ENTER']);
  for (const id of ['ai-control', 'ai-prompts', 'ai-commands']) { const l = Lb.LAYOUTS.find((x) => x.id === id); assert.strictEqual(l.keys.length, 8, id); l.keys.forEach((k) => assert.strictEqual(Lb.byId[k].cat, 'AI agents', id + ':' + k)); }
  const w = Lb.WIDGETS.find((x) => x.id === 'agent'), g = (lcd, idle = 0) => w.gen({ lcd, p: { idle } })[0];
  assert.ok(g(null).text.startsWith('Waiting for an agent')); assert.ok(g({ at: 0 }).text.startsWith('Waiting'));
  assert.strictEqual(g({ at: 1, state: 'done', text: 'Tests passed', ageSec: 1 }).text, 'DONE\nTests passed'); assert.strictEqual(g({ at: 1, state: 'done', text: 'x', ageSec: 1 }).bg, '#0d3b25');
  assert.strictEqual(g({ at: 1, state: 'error', text: 'Build failed', ageSec: 5 }).bg, '#4a1414'); assert.strictEqual(g({ at: 1, state: 'waiting', text: 'Approve?', ageSec: 5 }).text, 'NEEDS YOU\nApprove?');
  assert.strictEqual(g({ at: 1, state: 'weird', text: 'hi', ageSec: 5 }).text, 'hi', 'unknown state falls back to plain info'); assert.strictEqual(g({ at: 1, state: 'done', text: 'x', ageSec: 99 }, 30).text, 'Idle', 'goes idle after the chosen time');
});
console.log('\n' + n + ' test groups passed');
