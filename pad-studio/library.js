/* Pad Studio library: one-click key presets, layouts, low-rate screen widgets, live sports (ESPN public scoreboard).
   Browser: window.PadLib. Node: module.exports (for tests). Script grammar comes from the "Script Quick Start" PDF. */
(function (root) {
  /* ---------- key presets ---------- */
  const web = (url) => ['WINDOWS r', 'DELAY 500', 'STRING ' + url, 'ENTER'];
  const app = (name) => ['WINDOWS', 'DELAY 400', 'STRING ' + name, 'DELAY 600', 'ENTER'];
  const P = (cat, id, name, emoji, color, lines, param) => ({ cat, id, name, emoji, color, lines, param });
  const PRESETS = [
    P('Editing', 'copy', 'Copy', '📋', '#3b6fd4', ['CONTROL c']),
    P('Editing', 'paste', 'Paste', '📌', '#2f9e6f', ['CONTROL v']),
    P('Editing', 'cut', 'Cut', '✂️', '#c2562f', ['CONTROL x']),
    P('Editing', 'undo', 'Undo', '↩️', '#7b5bd6', ['CONTROL z']),
    P('Editing', 'redo', 'Redo', '↪️', '#7b5bd6', ['CONTROL y']),
    P('Editing', 'selectall', 'Select all', '🔲', '#4a5568', ['CONTROL a']),
    P('Editing', 'save', 'Save', '💾', '#2b7a9e', ['CONTROL s']),
    P('Editing', 'find', 'Find', '🔍', '#b08a1e', ['CONTROL f']),
    P('Windows', 'screenshot', 'Screenshot', '📸', '#c2417a', ['WINDOWS SHIFT s']),
    P('Windows', 'taskmgr', 'Task Manager', '📊', '#3b8a4a', ['CONTROL SHIFT ESC']),
    P('Windows', 'lock', 'Lock PC', '🔒', '#a33b3b', ['WINDOWS l']),
    P('Windows', 'desktop', 'Show desktop', '🖥️', '#2f6fa0', ['WINDOWS d']),
    P('Windows', 'clipboard', 'Clipboard history', '🗂️', '#5a6fd6', ['WINDOWS v']),
    P('Windows', 'emoji', 'Emoji picker', '😀', '#d19a1e', ['WINDOWS .']),
    P('Windows', 'switch', 'Switch window', '🪟', '#2f7fa0', ['ALT TAB']),
    P('Windows', 'close', 'Close window', '❌', '#a33b3b', ['ALT F4']),
    P('Windows', 'run', 'Run…', '▶️', '#4a5568', ['WINDOWS r']),
    P('Windows', 'settings', 'Settings', '⚙️', '#56606f', ['WINDOWS i']),
    P('Media', 'playpause', 'Play / Pause', '⏯️', '#1f8a5a', ['PP']),
    P('Media', 'next', 'Next track', '⏭️', '#2f6fa0', ['NEXT']),
    P('Media', 'prev', 'Previous', '⏮️', '#2f6fa0', ['PREV']),
    P('Media', 'mute', 'Mute', '🔇', '#a33b3b', ['MUTE']),
    P('Media', 'volup', 'Volume up', '🔊', '#3b8a4a', ['VOLUP']),
    P('Media', 'voldown', 'Volume down', '🔉', '#b08a1e', ['VOLDOWN']),
    P('Web & apps', 'google', 'Google', '🌐', '#3b6fd4', web('https://google.com')),
    P('Web & apps', 'youtube', 'YouTube', '▶️', '#c23030', web('https://youtube.com')),
    P('Web & apps', 'github', 'GitHub', '🐙', '#3a3f4b', web('https://github.com')),
    P('Web & apps', 'gmail', 'Gmail', '✉️', '#c2562f', web('https://mail.google.com')),
    P('Web & apps', 'terminal', 'Terminal', '⌨️', '#2d3340', web('wt')),
    P('Web & apps', 'website', 'Open website…', '🔗', '#2f7fa0', null, { id: 'url', label: 'Website address', placeholder: 'https://example.com', tpl: web }),
    P('Web & apps', 'launch', 'Launch app…', '🚀', '#7b5bd6', null, { id: 'name', label: 'App name (as you would search it)', placeholder: 'Spotify', tpl: app }),
    P('Text', 'text', 'Type text…', '💬', '#2b7a9e', null, { id: 'text', label: 'Text to type', placeholder: 'Hello!', tpl: (t) => ['STRING ' + t] }),
    P('Text', 'textenter', 'Type text + Enter…', '↵', '#2b7a9e', null, { id: 'text', label: 'Text to type', placeholder: '/command', tpl: (t) => ['STRING ' + t, 'ENTER'] }),
    P('Pad', 'nextprof', 'Next profile', '➡️', '#56606f', ['NEXT_PROFILE']),
    P('Pad', 'prevprof', 'Previous profile', '⬅️', '#56606f', ['PREV_PROFILE']),
    P('Pad', 'prof1', 'Go to profile 1', '1️⃣', '#56606f', ['GOTO_PROFILE 1']),
    P('Pad', 'empty', 'Empty key', '▫️', '#222833', []),
  ];
  /* Excel mode: shortcut keys, ribbon sequences and formula snippets. `hint` is shown on the cheat sheet and the LCD tips widget. */
  const X = (id, name, emoji, color, lines, hint) => PRESETS.push({ ...P('Excel', id, name, emoji, color, lines), hint });
  const rib = (...keys) => ['ALT', ...keys.flatMap((k) => ['DELAY 150', k])]; // ribbon accelerator: Alt, then one key per step
  X('xl-filldown', 'Fill down', '⬇️', '#1f7a4a', ['CONTROL d'], 'Ctrl+D copies the cell above down the selection');
  X('xl-fillright', 'Fill right', '➡️', '#1f7a4a', ['CONTROL r'], 'Ctrl+R fills right');
  X('xl-autosum', 'AutoSum', '➕', '#1f7a4a', ['ALT ='], 'Alt+= inserts SUM for the adjacent range');
  X('xl-table', 'Make table', '🔳', '#1f7a4a', ['CONTROL t'], 'Ctrl+T: tables auto-expand and give structured refs');
  X('xl-filter', 'Toggle filter', '🔽', '#1f7a4a', ['CONTROL SHIFT l'], 'Ctrl+Shift+L toggles filter buttons');
  X('xl-format', 'Format cells', '🎨', '#1f7a4a', ['CONTROL 1'], 'Ctrl+1 opens Format Cells');
  X('xl-edit', 'Edit cell', '✏️', '#1f7a4a', ['F2'], 'F2 edits the active cell');
  X('xl-absref', 'Cycle $ refs', '💲', '#1f7a4a', ['F4'], 'F4 cycles A1 / $A$1 / A$1 / $A1 while editing');
  X('xl-pastevalues', 'Paste values', '🔢', '#1f7a4a', ['CONTROL ALT v', 'DELAY 300', 'v', 'ENTER'], 'Ctrl+Alt+V, V, Enter pastes values only');
  X('xl-flash', 'Flash fill', '⚡', '#1f7a4a', ['CONTROL e'], 'Ctrl+E fills a pattern you started typing');
  X('xl-selcol', 'Select column', '↕️', '#1f7a4a', ['CONTROL SPACE'], 'Ctrl+Space selects the column');
  X('xl-selrow', 'Select row', '↔️', '#1f7a4a', ['SHIFT SPACE'], 'Shift+Space selects the row');
  X('xl-prevsheet', 'Previous sheet', '◀️', '#1f7a4a', ['CONTROL PAGEUP'], 'Ctrl+PgUp');
  X('xl-nextsheet', 'Next sheet', '▶️', '#1f7a4a', ['CONTROL PAGEDOWN'], 'Ctrl+PgDn');
  X('xl-newsheet', 'New sheet', '🆕', '#1f7a4a', ['SHIFT F11'], 'Shift+F11 inserts a worksheet');
  X('xl-insertfn', 'Insert function', '🧮', '#1f7a4a', ['SHIFT F3'], 'Shift+F3 opens Insert Function');
  X('xl-names', 'Name manager', '🏷️', '#1f7a4a', ['CONTROL F3'], 'Ctrl+F3 opens the Name Manager');
  X('xl-showformulas', 'Show formulas', '👁️', '#1f7a4a', ['CONTROL `'], 'Ctrl+` toggles formula view');
  X('xl-date', 'Insert date', '📅', '#1f7a4a', ['CONTROL ;'], 'Ctrl+; inserts a static date (not volatile like TODAY)');
  X('xl-time', 'Insert time', '🕐', '#1f7a4a', ['CONTROL SHIFT ;'], 'Ctrl+Shift+; inserts a static time');
  X('xl-autofit', 'Autofit columns', '📏', '#1f7a4a', rib('h', 'o', 'i'), 'Alt, H, O, I autofits column width');
  X('xl-freeze', 'Freeze panes', '🧊', '#1f7a4a', rib('w', 'f', 'f'), 'Alt, W, F, F freezes panes');
  X('xl-pivot', 'Pivot table', '🔄', '#1f7a4a', rib('n', 'v', 't'), 'Alt, N, V, T inserts a PivotTable');
  X('xl-gotoend', 'Last cell', '⏬', '#1f7a4a', ['CONTROL END'], 'Ctrl+End jumps to the last used cell');
  X('xl-gotostart', 'Go to A1', '⏫', '#1f7a4a', ['CONTROL HOME'], 'Ctrl+Home jumps to A1');
  const XF = (id, name, fn, hint) => X(id, name, '𝑓', '#175c8a', ['STRING =' + fn + '('], hint);
  XF('xf-xlookup', 'XLOOKUP', 'XLOOKUP', 'XLOOKUP replaces VLOOKUP / INDEX-MATCH: any direction, exact by default');
  XF('xf-filter', 'FILTER', 'FILTER', 'FILTER returns all matching rows and spills');
  XF('xf-unique', 'UNIQUE', 'UNIQUE', 'UNIQUE returns distinct values and spills');
  XF('xf-sort', 'SORT', 'SORT', 'SORT / SORTBY return a sorted spill range');
  XF('xf-let', 'LET', 'LET', 'LET names sub-expressions: faster and readable');
  XF('xf-sumifs', 'SUMIFS', 'SUMIFS', 'SUMIFS sums with multiple criteria');
  XF('xf-iferror', 'IFERROR', 'IFERROR', 'IFERROR wraps a formula with a fallback');
  /* AI agents: the pad types into whatever window has focus, so these drive Claude Code, ChatGPT, Cursor, any terminal agent.
     Key choices follow Claude Code (Enter approves, Esc rejects/interrupts, Esc Esc rewinds, Shift+Tab switches mode); other tools differ. */
  const AI = (id, name, emoji, lines, hint) => PRESETS.push({ ...P('AI agents', id, name, emoji, '#6b46c1', lines), hint });
  const say = (text) => ['STRING ' + text, 'ENTER'];
  AI('ai-approve', 'Approve', '✅', ['ENTER'], 'Enter accepts the highlighted choice');
  AI('ai-always', 'Yes, always', '✔️', ['2'], 'Option 2: allow and do not ask again');
  AI('ai-reject', 'Reject / stop', '⛔', ['ESC'], 'Esc rejects a prompt or interrupts the agent');
  AI('ai-rewind', 'Undo (Esc Esc)', '⏪', ['ESC', 'DELAY 150', 'ESC'], 'Esc twice rewinds the conversation');
  AI('ai-mode', 'Switch mode', '🔀', ['SHIFT TAB'], 'Shift+Tab cycles plan / accept-edits modes');
  AI('ai-dictate', 'Dictate', '🎙️', ['WINDOWS h'], 'Win+H: speak your prompt');
  AI('ai-pastesend', 'Paste & send', '📨', ['CONTROL v', 'DELAY 200', 'ENTER'], 'Pastes the clipboard and submits it');
  AI('ai-newline', 'New line', '↩️', ['SHIFT ENTER'], 'Shift+Enter: line break without sending');
  AI('ai-continue', 'Continue', '▶️', say('continue'), 'Types "continue" and sends');
  AI('ai-tests', 'Run tests', '🧪', say('Run the tests and fix any failures'), 'Prompt');
  AI('ai-explain', 'Explain', '💡', say('Explain what you just did in plain language'), 'Prompt');
  AI('ai-review', 'Review', '🔍', say('Review these changes for bugs and risks'), 'Prompt');
  AI('ai-commit', 'Commit', '📦', say('Commit these changes with a clear message'), 'Prompt');
  AI('ai-summary', 'Summarize', '📝', say('Summarize where we are and the next steps'), 'Prompt');
  AI('ai-fix', 'Fix errors', '🛠️', say('Fix the errors above'), 'Prompt');
  AI('ai-simplify', 'Simplify', '✂️', say('Simplify this without changing its behavior'), 'Prompt');
  for (const [c, e] of [['clear', '🧹'], ['compact', '🗜️'], ['cost', '💲'], ['status', '📊'], ['model', '🧠'], ['resume', '⏯️'], ['init', '🆕'], ['help', '❓']]) AI('ai-/' + c, '/' + c, e, say('/' + c), 'Claude Code slash command');
  PRESETS.push(P('AI agents', 'ai-slash', 'Slash command…', '⚡', '#6b46c1', null, { id: 'cmd', label: 'Command (without the slash)', placeholder: 'compact', tpl: (t) => say('/' + t.replace(/^\//, '')) }),
    P('AI agents', 'ai-prompt', 'Custom prompt…', '💬', '#6b46c1', null, { id: 'text', label: 'Prompt to type and send', placeholder: 'Add tests for the new function', tpl: say }));
  const byId = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
  const LAYOUTS = [
    { id: 'editing', name: 'Editing', keys: ['copy', 'paste', 'cut', 'undo', 'redo', 'selectall', 'save', 'find'] },
    { id: 'media', name: 'Media & volume', keys: ['prev', 'playpause', 'next', 'mute', 'voldown', 'volup', 'screenshot', 'lock'] },
    { id: 'power', name: 'Windows power', keys: ['screenshot', 'taskmgr', 'lock', 'desktop', 'clipboard', 'emoji', 'switch', 'run'] },
    { id: 'launcher', name: 'Web launcher', keys: ['google', 'youtube', 'github', 'gmail', 'terminal', 'settings', 'screenshot', 'nextprof'] },
  ];
  LAYOUTS.push(
    { id: 'ai-control', name: 'AI agent: control', keys: ['ai-approve', 'ai-always', 'ai-reject', 'ai-mode', 'ai-continue', 'ai-rewind', 'ai-dictate', 'ai-pastesend'] },
    { id: 'ai-prompts', name: 'AI agent: prompts', keys: ['ai-continue', 'ai-tests', 'ai-explain', 'ai-review', 'ai-commit', 'ai-summary', 'ai-fix', 'ai-simplify'] },
    { id: 'ai-commands', name: 'AI agent: slash commands', keys: ['ai-/clear', 'ai-/compact', 'ai-/cost', 'ai-/status', 'ai-/model', 'ai-/resume', 'ai-/init', 'ai-/help'] },
    { id: 'excel-essentials', name: 'Excel essentials', keys: ['xl-filldown', 'xl-autosum', 'xl-filter', 'xl-table', 'xl-format', 'xl-pastevalues', 'xl-autofit', 'xl-freeze'] },
    { id: 'excel-formulas', name: 'Excel formulas', keys: ['xf-xlookup', 'xf-filter', 'xf-unique', 'xf-sort', 'xf-let', 'xf-sumifs', 'xf-iferror', 'xl-insertfn'] },
    { id: 'excel-navigation', name: 'Excel navigation', keys: ['xl-selcol', 'xl-selrow', 'xl-prevsheet', 'xl-nextsheet', 'xl-gotostart', 'xl-gotoend', 'xl-absref', 'xl-edit'] });

  /** Fill a preset's script (and parameter) into {alias, hid, actions, emoji, color}. */
  function applyPreset(id, value) {
    const p = byId[id]; if (!p) throw new Error('unknown preset ' + id);
    const plain = p.param ? p.param.tpl(String(value || '').trim() || p.param.placeholder) : p.lines.slice();
    const actions = officialLines(plain); // saved in the official app's file format so the official app can open and edit these keys
    return { alias: p.name.replace('…', ''), hid: true, actions, emoji: p.emoji, color: p.color, presetId: id };
  }

  /* ---------- ESPN public scoreboard ---------- */
  const LEAGUES = [
    { id: 'nba', name: 'NBA', path: 'basketball/nba', periods: 'Q' }, { id: 'nfl', name: 'NFL', path: 'football/nfl' },
    { id: 'mlb', name: 'MLB', path: 'baseball/mlb' }, { id: 'nhl', name: 'NHL', path: 'hockey/nhl' },
    { id: 'epl', name: 'Premier League', path: 'soccer/eng.1' }, { id: 'mls', name: 'MLS', path: 'soccer/usa.1' },
    { id: 'ucl', name: 'Champions League', path: 'soccer/uefa.champions' },
    { id: 'ncaaf', name: 'College football', path: 'football/college-football', q: '?groups=80&limit=100' },
    { id: 'ncaam', name: "Men's college basketball", path: 'basketball/mens-college-basketball', q: '?groups=50&limit=100' },
  ];
  // College scoreboards truncate unless asked for the whole division.
  const QUERY = { 'football/college-football': '?groups=80&limit=100', 'basketball/mens-college-basketball': '?groups=50&limit=100', 'basketball/womens-college-basketball': '?groups=50&limit=100' };
  const scoreboardUrl = (lg) => { const path = typeof lg === 'string' ? lg : lg.path; return 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/scoreboard' + (QUERY[path] || (lg && lg.q) || ''); };

  /* One parser for every ESPN sport. Shapes seen live: team vs team (most sports), athlete vs athlete (MMA bouts, tennis matches
     in event.groupings), leaderboards (golf: many competitors) and multi-session events (racing). Output items are either
     kind 'game' (two sides) or kind 'board' (a title with a few rows). */
  const lastName = (n) => String(n || '?').trim().split(/\s+/).pop().toUpperCase().slice(0, 12);
  const stOf = (o) => { const t = (o && o.status && o.status.type) || {}; return { state: t.state || 'pre', detail: t.shortDetail || t.detail || '' }; };
  const hexc = (c) => (c && /^[0-9a-f]{6}$/i.test(c) ? '#' + c : null);
  function sideOf(x) {
    if (!x) return { abbr: '?', name: '', score: '' };
    const t = x.team, a = x.athlete, name = (t && t.displayName) || (a && (a.displayName || a.fullName)) || '';
    const abbr = (t && (t.abbreviation || t.shortDisplayName)) || lastName((a && (a.shortName || a.displayName)) || name);
    let score = x.score == null ? (t ? '0' : '') : String(x.score);
    if (!t && !score && Array.isArray(x.linescores) && x.linescores.length && x.linescores[0].value !== undefined) score = x.linescores.map((l) => l.value).join(' ');
    return { abbr, name, score, logo: t && t.logo, color: hexc(t && t.color), alt: hexc(t && t.alternateColor) };
  }
  function gameOf(c, id, sep, st, date) {
    const cs = c.competitors, ra = cs.find((x) => x.homeAway === 'away') || cs[0], rh = cs.find((x) => x.homeAway === 'home') || cs[1], A = sideOf(ra), H = sideOf(rh);
    if (!ra.team && !A.score) { A.score = ra.winner ? 'W' : ''; H.score = rh.winner ? 'W' : ''; } // MMA etc: mark the winner
    return { id, kind: 'game', sep, away: A, home: H, state: st.state, detail: st.detail, date };
  }
  function parseEvents(json) {
    const out = [], head = (c) => c && (c.competitors || []).length === 2;
    for (const e of (json && json.events) || []) {
      const es = stOf(e), comps = e.competitions || [];
      if (e.groupings) { for (const g of e.groupings) for (const c of g.competitions || []) if (head(c)) out.push(gameOf(c, e.id + ':' + c.id, 'vs', stOf(c), c.date || e.date)); continue; } // tennis matches
      if (comps.length > 1 && comps.every(head)) { for (const c of comps) out.push(gameOf(c, e.id + ':' + c.id, 'vs', stOf(c), c.date || e.date)); continue; } // MMA card: one item per bout
      if (head(comps[0])) { out.push(gameOf(comps[0], e.id, '@', es, e.date)); continue; } // normal two-team game
      let rows = [];
      const cs = (comps[0] && comps[0].competitors) || [];
      if (cs.length > 2) rows = cs.slice().sort((a, b) => (a.order || 99) - (b.order || 99)).slice(0, 5).map((x) => `${x.order || ''} ${sideOf(x).abbr} ${x.score == null ? '' : x.score}`.trim()); // leaderboard
      else if (comps.length > 1) rows = comps.map((c) => `${(c.type && (c.type.abbreviation || c.type.text)) || 'Session'}: ${stOf(c).detail}`).slice(0, 5); // racing weekend sessions
      out.push({ id: e.id, kind: 'board', title: e.shortName || e.name || 'Event', rows, state: es.state, detail: es.detail, date: e.date, away: { abbr: '', name: '', score: '' }, home: { abbr: '', name: '', score: '' } });
    }
    return out;
  }
  const sideTxt = (s) => s.abbr + (s.score !== '' ? ' ' + s.score : '');
  const gameLine = (g) => g.kind === 'board' ? g.title + (g.rows[0] ? '  ' + g.rows[0] : '') + '   ' + g.detail
    : g.sep === '@' && /^\d+$/.test(g.away.score + g.home.score) || (g.sep === '@' && g.state === 'pre') ? (g.state === 'pre' ? `${g.away.abbr} @ ${g.home.abbr}   ${g.detail}` : `${g.away.abbr} ${g.away.score} - ${g.home.score} ${g.home.abbr}   ${g.detail}`)
    : (g.state === 'pre' ? `${g.away.abbr} vs ${g.home.abbr}   ${g.detail}` : `${sideTxt(g.away)} v ${sideTxt(g.home)}   ${g.detail}`);
  const tint = (state) => state === 'in' ? '#0d3b25' : state === 'post' ? '#262a33' : '#10284a';
  const textOn = (bg) => { const n = parseInt(bg.slice(1), 16), l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l > 150 ? '#000000' : '#FFFFFF'; };
  /** One game as 3 panels: away half and home half in the TEAMS' OWN COLOURS, status strip underneath. Boards are a plain text card. */
  function gameCard(g) {
    if (g.kind === 'board') return card(g.title + '\n' + g.rows.slice(0, 4).join('\n') + (g.detail ? '\n' + g.detail : ''), tint(g.state));
    const ab = g.away.color || '#2a3550', hb = (g.home.color && g.home.color !== ab ? g.home.color : g.home.alt) || '#503a2a';
    const half = (s, bg, x) => ({ x, y: 0, w: 240, h: 150, text: s.abbr + (g.state === 'pre' || s.score === '' ? '' : '\n' + s.score), bg, fg: textOn(bg), align: 'CENTER' });
    return [half(g.away, ab, 0), half(g.home, hb, 240), { x: 0, y: 150, w: 480, h: 50, text: g.detail || ' ', bg: tint(g.state), fg: '#FFFFFF', align: 'CENTER' }];
  }
  /** ESPN serves team logos as 64x64 RGBA PNGs: the pad's key-icon format. The LCD canvas itself cannot show images. */
  const logoUrl = (logo) => { const m = /^https:\/\/a\.espncdn\.com(\/i\/teamlogos\/[A-Za-z0-9_\/.\-]+\.png)$/.exec(logo || ''); return m ? 'https://a.espncdn.com/combiner/i?img=' + m[1] + '&w=64&h=64' : null; };
  /** Up to 8 keys: away logo then home logo for each game, whole games only. */
  function logoKeyPlan(games) {
    const out = [];
    for (const g of games) { if (g.kind !== 'game') continue; const a = logoUrl(g.away.logo), h = logoUrl(g.home.logo); if (!a || !h || out.length > 6) continue; out.push({ alias: g.away.abbr, url: a }, { alias: g.home.abbr, url: h }); }
    return out;
  }

  /* ---------- screen widgets (1-2 updates/sec max: the LCD cannot take heavy streaming) ---------- */
  const z = (n) => String(n).padStart(2, '0');
  const bar = (pct, n = 10) => '[' + '#'.repeat(Math.round((pct / 100) * n)).padEnd(n, '-') + ']';
  const card = (text, bg, extra) => [{ x: 0, y: 0, w: 480, h: 200, text, bg, fg: '#FFFFFF', align: 'CENTER', ...extra }];
  const WIDGETS = [
    { id: 'clock', name: 'Clock', emoji: '🕒', every: 1000, params: [{ id: 'date', label: 'Show date', type: 'select', def: 'yes', options: ['yes', 'no'] }, { id: 'h24', label: 'Time format', type: 'select', def: '12-hour', options: ['12-hour', '24-hour'] }],
      gen: ({ now, p }) => { const h = p.h24 === '24-hour' ? z(now.getHours()) : String(now.getHours() % 12 || 12), ap = p.h24 === '24-hour' ? '' : now.getHours() < 12 ? ' AM' : ' PM';
        return card((p.date === 'no' ? '' : now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + '\n') + `${h}:${z(now.getMinutes())}:${z(now.getSeconds())}${ap}`, '#05070d', { fg: '#7CFFB2' }); } },
    { id: 'system', name: 'CPU & memory', emoji: '📈', every: 2000, needs: 'stats', params: [],
      gen: ({ stats }) => { if (!stats) return card('Waiting for the helper server…\n(run node server.js)', '#2a1a1a'); const w = Math.max(stats.cpu, stats.mem);
        return card(`CPU ${String(Math.round(stats.cpu)).padStart(3)}%  ${bar(stats.cpu)}\nRAM ${String(Math.round(stats.mem)).padStart(3)}%  ${bar(stats.mem)}`, w > 85 ? '#4a1414' : w > 60 ? '#4a3a10' : '#0f2a3a'); } },
    { id: 'pomodoro', name: 'Focus timer', emoji: '🍅', every: 1000, stateful: true, params: [{ id: 'work', label: 'Focus minutes', type: 'number', def: 25 }, { id: 'rest', label: 'Break minutes', type: 'number', def: 5 }],
      gen: ({ now, p, state }) => { const W = +p.work * 60, R = +p.rest * 60, t = Math.floor((now - state.t0) / 1000) % (W + R), focus = t < W, left = focus ? W - t : W + R - t;
        return card(`${focus ? 'FOCUS' : 'BREAK'}\n${z(Math.floor(left / 60))}:${z(left % 60)}`, focus ? '#4a1a1a' : '#103a24'); } },
    { id: 'countdown', name: 'Countdown', emoji: '⏳', every: 1000, params: [{ id: 'label', label: 'Event name', type: 'text', def: 'Launch day' }, { id: 'when', label: 'Date & time', type: 'datetime-local', def: '' }],
      gen: ({ now, p }) => { const t = new Date(p.when); if (!p.when || isNaN(t)) return card('Pick a date & time', '#222833'); let s = Math.floor((t - now) / 1000);
        if (s <= 0) return card(p.label + '\nIT\'S TIME!', '#4a3a10'); const d = Math.floor(s / 86400); s %= 86400;
        return card(`${p.label}\n${d}d ${z(Math.floor(s / 3600))}:${z(Math.floor((s % 3600) / 60))}:${z(s % 60)}`, '#1b1030'); } },
    { id: 'banner', name: 'Scrolling banner', emoji: '📣', every: 0, params: [{ id: 'text', label: 'Message', type: 'text', def: 'Hello from Pad Studio - the pad scrolls this by itself' }],
      gen: ({ p }) => [{ x: 0, y: 70, w: 480, h: 50, text: p.text + '      ', bg: '#1b1030', fg: '#FFD166', long_mode: 'SCROLL_CIRCULAR' }] },
    { id: 'message', name: 'Message card', emoji: '🪧', every: 0, params: [{ id: 'text', label: 'Text', type: 'text', def: 'In a meeting' }, { id: 'bg', label: 'Colour', type: 'select', def: '#7a1f1f', options: ['#7a1f1f', '#1f5a3a', '#1b3a7a', '#5a3a7a', '#7a5a1f'] }],
      gen: ({ p }) => card(p.text, p.bg) },
    { id: 'ticker', name: 'Rotating lines', emoji: '🔁', every: 1000, params: [{ id: 'lines', label: 'Lines (one per row)', type: 'textarea', def: 'Stay hydrated\nStretch your legs\nCheck the build' }, { id: 'secs', label: 'Seconds per line', type: 'number', def: 5 }],
      gen: ({ now, p }) => { const L = p.lines.split('\n').filter(Boolean); return card(L.length ? L[Math.floor(now / 1000 / Math.max(1, +p.secs)) % L.length] : '(no lines)', '#101820'); } },
    { id: 'sports', name: 'Live sports', emoji: '🏟️', every: 1000, needs: 'sports', stateful: true,
      params: [{ id: 'league', label: 'Sport & league (every ESPN league: soccer, football, basketball, MMA, golf, tennis, racing, rugby…)', type: 'league', def: 'basketball/nba' },
        { id: 'mode', label: 'Show', type: 'select', def: 'rotate', options: ['rotate', 'list', 'team'], labels: ['One game at a time (rotating)', 'All games as a list', 'Only my team'] },
        { id: 'team', label: 'My team abbreviation (for "my team" + score alerts)', type: 'text', def: '' }, { id: 'secs', label: 'Seconds per game (rotating)', type: 'number', def: 5 }],
      gen: ({ now, p, state, sports }) => {
        if (!sports) return card('Loading scores…', '#10284a');
        const games = sports.games, mine = (p.team || '').trim().toUpperCase(), isMine = (g) => g.kind === 'game' && (g.away.abbr === mine || g.home.abbr === mine || (mine.length > 3 && (g.away.name + ' ' + g.home.name).toUpperCase().includes(mine)));
        if (mine) { // score-change alert for the followed team
          for (const g of games.filter(isMine)) { const sig = g.away.score + '-' + g.home.score, old = state.seen[g.id]; if (old !== undefined && old !== sig && g.state === 'in') state.alert = { until: now.getTime() + 10000, g }; state.seen[g.id] = sig; }
          if (state.alert && now.getTime() < state.alert.until) return card('SCORE!\n' + gameLine(state.alert.g), '#7a5a00', { fg: '#FFFFFF' });
        }
        if (!games.length) return card('No games right now\n(' + sports.league.name + ')', '#222833');
        if (p.mode === 'list') return card(games.slice(0, 7).map(gameLine).join('\n'), '#0f1a2a', { align: 'LEFT' });
        let g;
        if (p.mode === 'team' && mine) { g = games.find(isMine); if (!g) return card(mine + ': no game today\n(' + sports.league.name + ')', '#222833'); }
        else g = games[Math.floor(now / 1000 / Math.max(2, +p.secs)) % games.length];
        return gameCard(g); } },
  ];

  /* ---------- Excel helper: tips on the LCD and a prompt builder ---------- */
  const EXCEL_TIPS = [
    'Prefer XLOOKUP over VLOOKUP / INDEX-MATCH', 'Use LET to name sub-expressions and avoid recalculating them', 'Avoid volatile functions (INDIRECT, OFFSET, TODAY) on big sheets',
    'Use Tables (Ctrl+T): structured refs and auto-expanding ranges', 'FILTER / UNIQUE / SORT spill results: reference them with A1#', 'Power Query beats formulas for repeatable cleaning of big data',
    'Use Ctrl+; for a static date instead of volatile TODAY()', 'Set calculation to Manual while editing huge workbooks', 'Prefer SUMIFS / COUNTIFS over array-style SUMPRODUCT on large ranges'];
  WIDGETS.push({ id: 'exceltips', name: 'Excel tips', emoji: '📗', every: 1000, params: [{ id: 'secs', label: 'Seconds per tip', type: 'number', def: 7 },
    { id: 'kind', label: 'Show', type: 'select', def: 'both', options: ['both', 'shortcuts', 'tips'], labels: ['Shortcuts and tips', 'Shortcuts only', 'Best-practice tips only'] }],
    gen: ({ now, p }) => {
      const sc = PRESETS.filter((x) => x.cat === 'Excel').map((x) => x.name + '\n' + x.hint), all = p.kind === 'shortcuts' ? sc : p.kind === 'tips' ? EXCEL_TIPS : [...sc, ...EXCEL_TIPS];
      return card(all[Math.floor(now / 1000 / Math.max(2, +p.secs)) % all.length], '#0e2a1c', { fg: '#CFFFE2' }); } });
  /** Fills the "Excel expert" prompt with the user's context. Wording of the persona and constraints is the user's own. */
  function buildExcelPrompt(c) {
    const v = (s) => (s && String(s).trim()) || '[not provided]';
    return [
      'Act as a Principal Excel Engineer, VBA Developer, and Senior Data Analyst. Your goal is to provide optimized, modern, and high-performance solutions for Excel.',
      '', 'When generating solutions, strictly adhere to these power-user constraints:',
      '1. FORMULAS: Prioritize modern dynamic arrays (XLOOKUP, FILTER, UNIQUE, SORT, LET, LAMBDA) over legacy formulas (VLOOKUP, INDEX/MATCH) unless backward compatibility is requested.' + (c.legacy ? ' Backward compatibility IS requested: avoid dynamic arrays and LET/LAMBDA.' : ''),
      '2. PERFORMANCE: Optimize for large datasets. Avoid volatile functions (INDIRECT, OFFSET, TODAY) where possible to prevent workbook lag.',
      '3. CODE QUALITY: If VBA, Office Scripts, or Power Query (M) is required, provide clean, modular, and fully commented code with structured error handling.',
      '4. CLARITY: Skip conversational fluff. Provide the exact syntax, step-by-step implementation, and brief reasoning for why your approach is optimal.',
      '', 'Context:', '- Excel Version: ' + v(c.version), '- Spreadsheet Structure: ' + v(c.structure), '- Sample Data (5-10 rows):', v(c.sample), '- Objective: ' + v(c.objective), '- Desired Output: ' + v(c.output),
      '', 'What is the most efficient, scalable way to build this?'].join('\n');
  }

  /* ---------- action sequence editor, in the OFFICIAL file format ----------
     Learned by making every action in the official app (v1.8.0) and reading the files it saved (see test-fixtures/):
       configs/profile_P_key_K.txt  per action: "ACT <code> <parameter>" then the keystrokes the PC app would type for it.
       scripts/profile_P_key_K.txt  what the pad itself runs (HID mode): the same actions without the ACT lines.
     Codes: 1 Access Web, 2 Launch App, 3 Open Folder, 4 Input Text, 5 Shortcut, 7 Wait, 8 Mouse Move, 9 Mouse Click,
            a Media Control, b Shell Cmd, c Change Profile, d Functional Key, e Device Ctrl, f Open File. (6 was not seen.) */
  const MODS = ['CONTROL', 'SHIFT', 'ALT', 'WINDOWS'];
  const FKEYS = ['TAB', 'SPACE', 'ESC', 'ENTER', 'BACKSPACE', 'DELETE', 'INSERT', 'HOME', 'END', 'PAGEUP', 'PAGEDOWN', 'PRINTSCREEN', 'CAPSLOCK', 'UP', 'DOWN', 'LEFT', 'RIGHT',
    ...Array.from({ length: 24 }, (_, i) => 'F' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'KP_' + i), 'KP_PLUS', 'KP_MINUS'];
  const MEDIA = [['MK_PP', 'Play / Pause'], ['MK_NEXT', 'Next track'], ['MK_PREV', 'Previous track'], ['MK_STOP', 'Stop'], ['MK_MUTE', 'Mute'], ['MK_VOLUP', 'Volume up'], ['MK_VOLDOWN', 'Volume down']];
  const DEVICE = [['CC_POWER', 'Power'], ['CC_CALCULATOR', 'Launch calculator'], ['CC_BROWSER', 'Launch browser'], ['CC_SEARCH', 'Search'], ['CC_HOME', 'Browser home'],
    ['CC_BACK', 'Browser back'], ['CC_FORWARD', 'Browser forward'], ['CC_BR_STOP', 'Browser stop loading'], ['CC_REFRESH', 'Browser refresh']];
  const CLICKS = [['LMOUSE', 'Left click'], ['LLMOUSE', 'Double left click'], ['RMOUSE', 'Right click'], ['MMOUSE', 'Middle click'], ['MOUSE_WHEEL', 'Mouse wheel (+ scrolls up, − down)']];
  const base = (p) => String(p).trim().replace(/^"|"$/g, '').split(/[\\/]/).pop();
  const runDlg = (cmd, d) => ['WINDOWS r', 'Delay ' + d, 'STRING ' + cmd, 'ENTER'];
  const sel = (id, label, options, def) => ({ id, label, type: 'select', options: options.map((o) => o[0]), labels: options.map((o) => o[1]), def });
  /* A(id, code, name, emoji, params, param(p) -> string, cfg(p, param) -> lines, script(p, param) -> lines, parse(param) -> p) */
  const A = (id, code, name, emoji, params, param, cfg, script, parse) => ({ id, code, name, emoji, params, param, cfg, script, parse });
  const same = (f) => [f, f];
  const ACTIONS = [
    A('web', '1', 'Access Web', '🌐', [{ id: 'url', label: 'Website address (e.g. www.google.com)', type: 'text', def: 'www.google.com' }], (p) => p.url.trim(),
      (p, s) => runDlg(s, 100), (p, s) => ['WINDOWS r', 'Delay 200', 'STRING ' + (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s), 'Delay 200', 'ENTER'], (s) => ({ url: s })),
    A('app', '2', 'Launch App', '🚀', [{ id: 'path', label: 'Full path to the program (.exe)', type: 'text', def: 'C:\\Windows\\System32\\notepad.exe' }], (p) => p.path.trim(),
      ...same((p, s) => ['WINDOWS', 'Delay 20', 'STRING ' + base(s), 'ENTER']), (s) => ({ path: s })),
    A('folder', '3', 'Open Folder', '📁', [{ id: 'path', label: 'Folder path', type: 'text', def: 'C:\\Users' }], (p) => p.path.trim(),
      ...same((p, s) => runDlg(s, 100)), (s) => ({ path: s })),
    A('file', 'f', 'Open File', '📄', [{ id: 'path', label: 'File path (opens with its default app)', type: 'text', def: 'C:\\Users\\Public\\notes.txt' }], (p) => p.path.trim(),
      ...same((p, s) => runDlg(s, 100)), (s) => ({ path: s })),
    A('text', '4', 'Input Text', '⌨️', [{ id: 'text', label: 'Text to type', type: 'text', def: 'Hello' }, { id: 'enter', label: 'End with Enter key', type: 'bool', def: false }], (p) => p.text + (p.enter ? ' ENTER' : ''),
      ...same((p) => ['STRING ' + p.text, ...(p.enter ? ['ENTER'] : [])]), (s) => (/ ENTER$/.test(s) ? { text: s.slice(0, -6), enter: true } : { text: s, enter: false })),
    A('shortcut', '5', 'Shortcut', '⌘', [{ id: 'mods', label: 'Modifiers', type: 'mods', def: ['CONTROL'] }, { id: 'key', label: 'Key (a letter, digit, symbol or key name)', type: 'text', def: 'c' }],
      (p) => [...(p.mods || []), p.key].filter(Boolean).join(' '), () => [], (p, s) => [s],
      (s) => { const w = s.split(/\s+/), mods = []; while (w.length > 1 && MODS.includes(w[0].toUpperCase())) mods.push(w.shift().toUpperCase()); return mods.length || w.length ? (MODS.includes(w[0].toUpperCase()) && w.length === 1 ? { mods: [w[0].toUpperCase()], key: '' } : { mods, key: w.join(' ') }) : { mods: [], key: '' }; }),
    A('wait', '7', 'Wait', '⏳', [{ id: 'ms', label: 'Wait time in milliseconds', type: 'number', def: 500 }], (p) => String(Math.max(0, parseInt(p.ms, 10) || 0)),
      (p, s) => ['Delay ' + s], (p, s) => ['DELAY ' + s], (s) => ({ ms: +s })),
    A('mousemove', '8', 'Mouse Move', '🖱️', [{ id: 'x', label: 'X (pixels from the top-left corner of the screen)', type: 'number', def: 260 }, { id: 'y', label: 'Y (pixels from the top)', type: 'number', def: 820 }, { id: 'drag', label: 'Hold the left button while moving (drag)', type: 'bool', def: false }],
      (p) => `${parseInt(p.x, 10) || 0} ${parseInt(p.y, 10) || 0}` + (p.drag ? ' DRAG' : ''), () => [], () => [], (s) => { const m = /^(-?\d+) (-?\d+)( DRAG)?$/.exec(s) || []; return { x: +m[1] || 0, y: +m[2] || 0, drag: !!m[3] }; }),
    A('mouseclick', '9', 'Mouse Click', '👆', [sel('btn', 'How to click', CLICKS, 'LMOUSE'), { id: 'amount', label: 'Wheel amount (only for the mouse wheel)', type: 'number', def: 3 }],
      (p) => (p.btn === 'MOUSE_WHEEL' ? 'MOUSE_WHEEL ' + (parseInt(p.amount, 10) || 1) : p.btn), ...same((p, s) => [s]),
      (s) => { const m = /^MOUSE_WHEEL (-?\d+)$/.exec(s); return m ? { btn: 'MOUSE_WHEEL', amount: +m[1] } : { btn: s, amount: 3 }; }),
    A('media', 'a', 'Media Control', '🎵', [sel('cmd', 'Media key', MEDIA, 'MK_PP')], (p) => p.cmd, ...same((p, s) => [s]), (s) => ({ cmd: s })),
    A('shell', 'b', 'Shell Cmd', '💻', [{ id: 'cmd', label: 'Windows shell (PowerShell) command', type: 'text', def: 'echo hello' }], (p) => p.cmd.trim(),
      (p, s) => ['WINDOWS', 'STRING powershell', 'ENTER', 'STRING ' + s, 'ENTER'], (p, s) => ['WINDOWS', 'STRING powershell', 'ENTER', 'DELAY 500', 'STRING ' + s, 'ENTER'], (s) => ({ cmd: s })),
    A('profile', 'c', 'Change Profile', '🗂️', [sel('mode', 'Go to', [['NEXT', 'Next profile'], ['PREV', 'Previous profile'], ['GOTO', 'A specific profile']], 'NEXT'), { id: 'n', label: 'Profile number (for "A specific profile")', type: 'number', def: 1 }],
      (p) => (p.mode === 'GOTO' ? 'GOTO_PROFILE ' + (parseInt(p.n, 10) || 1) : p.mode + '_PROFILE'), ...same((p, s) => [s]),
      (s) => { const m = /^GOTO_PROFILE (\d+)$/.exec(s); return m ? { mode: 'GOTO', n: +m[1] } : { mode: /^PREV/.test(s) ? 'PREV' : 'NEXT', n: 1 }; }),
    A('fkey', 'd', 'Functional Key', '🔑', [sel('key', 'Key', FKEYS.map((k) => [k, k]), 'ENTER')], (p) => p.key, ...same((p, s) => [s]), (s) => ({ key: s })),
    A('device', 'e', 'Device Ctrl', '📟', [sel('cmd', 'Consumer control', DEVICE, 'CC_CALCULATOR')], (p) => p.cmd, ...same((p, s) => [s]), (s) => ({ cmd: s })),
  ];
  const actionById = Object.fromEntries(ACTIONS.map((a) => [a.id, a])), actionByCode = Object.fromEntries(ACTIONS.map((a) => [a.code, a]));
  const defaults = (a) => Object.fromEntries(a.params.map((q) => [q.id, Array.isArray(q.def) ? q.def.slice() : q.def]));
  const newAction = (id) => ({ type: id, p: defaults(actionById[id]) });
  /** Structured actions -> the lines of configs/profile_P_key_K.txt (ACT line + PC-side keystrokes). */
  const actionsToLines = (seq) => seq.flatMap((a) => { if (a.type === 'raw') return [a.line]; if (a.type === 'official') return [`ACT ${a.code} ${a.arg}`.trimEnd()]; const d = actionById[a.type], s = d.param(a.p); return [`ACT ${d.code} ${s}`, ...d.cfg(a.p, s)]; });
  /** Structured actions -> the lines of scripts/profile_P_key_K.txt (what the pad runs itself). */
  const scriptFromActions = (seq) => seq.flatMap((a) => { if (a.type === 'raw') return [a.line]; if (a.type === 'official') return []; const d = actionById[a.type]; return d.script(a.p, d.param(a.p)); });
  const same1 = (x, y) => x.toLowerCase() === y.toLowerCase();
  /** Lines -> structured actions. Official ACT lines consume their expected keystroke lines; older plain script lines are understood too;
      anything else is kept verbatim ('raw' / 'official ACT n') so nothing is ever lost. */
  function linesToActions(lines) {
    const out = [], L = lines.map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < L.length; i++) {
      let m = /^ACT ([0-9a-fA-F])(?: (.*))?$/.exec(L[i]);
      if (m) {
        const d = actionByCode[m[1].toLowerCase()], s = m[2] || '';
        if (!d) { out.push({ type: 'official', code: m[1], arg: s }); continue; }
        const p = d.parse(s), exp = d.cfg(p, s), nxt = L.slice(i + 1, i + 1 + exp.length);
        if (nxt.length === exp.length && nxt.every((x, j) => same1(x, exp[j]))) i += exp.length;
        out.push({ type: d.id, p }); continue;
      }
      if (/^WINDOWS r$/i.test(L[i]) && /^DELAY \d+$/i.test(L[i + 1] || '') && /^STRING /.test(L[i + 2] || '') && /^ENTER$/i.test(L[i + 3] || '')) {
        const cmd = L[i + 2].slice(7); i += 3;
        if (/^(https?:\/\/|www\.)/i.test(cmd)) out.push({ type: 'web', p: { url: cmd } });
        else if (/^(cmd|powershell|pwsh|wt)\b/i.test(cmd)) out.push({ type: 'shell', p: { cmd } });
        else out.push({ type: 'folder', p: { path: cmd.replace(/^"|"$/g, '') } });
        continue;
      }
      if ((m = /^STRING (.*)$/.exec(L[i]))) out.push({ type: 'text', p: { text: m[1], enter: false } });
      else if ((m = /^DELAY (\d+)$/i.exec(L[i]))) out.push({ type: 'wait', p: { ms: +m[1] } });
      else if (/^[LMR]MOUSE$/.test(L[i]) || /^LLMOUSE$/.test(L[i])) out.push({ type: 'mouseclick', p: { btn: L[i], amount: 3 } });
      else if (MEDIA.some((x) => x[0] === L[i].toUpperCase())) out.push({ type: 'media', p: { cmd: L[i].toUpperCase() } });
      else if (/^(VOLUP|VOLDOWN|MUTE|NEXT|PREV|PP|STOP)$/i.test(L[i])) out.push({ type: 'media', p: { cmd: 'MK_' + L[i].toUpperCase() } });
      else if (/^CC_/.test(L[i])) out.push({ type: 'device', p: { cmd: L[i] } });
      else if ((m = /^GOTO_PROFILE (\d+)$/i.exec(L[i]))) out.push({ type: 'profile', p: { mode: 'GOTO', n: +m[1] } });
      else if (/^(NEXT|PREV)_PROFILE$/i.test(L[i])) out.push({ type: 'profile', p: { mode: L[i].slice(0, 4).toUpperCase(), n: 1 } });
      else if (FKEYS.includes(L[i].toUpperCase()) && !/\s/.test(L[i])) out.push({ type: 'fkey', p: { key: L[i].toUpperCase() } });
      else {
        const w = L[i].split(/\s+/), mods = []; while (w.length && MODS.includes(w[0].toUpperCase())) mods.push(w.shift().toUpperCase());
        if (mods.length && w.length <= 1) out.push({ type: 'shortcut', p: { mods, key: w[0] || '' } });
        else if (!mods.length && w.length === 1 && w[0].length === 1) out.push({ type: 'shortcut', p: { mods: [], key: w[0] } });
        else out.push({ type: 'raw', line: L[i] });
      }
    }
    return out;
  }
  const scriptFromConfig = (lines) => scriptFromActions(linesToActions(lines));
  /** Plain script lines (as used by the presets) -> official config lines. */
  const officialLines = (plain) => actionsToLines(linesToActions(plain));

  /* ---------- Agent status: shows the latest message POSTed to the helper's /api/lcd (e.g. from a Claude Code hook) ---------- */
  const AGENT_STATES = { working: ['#3a3208', '#FFE9A8', 'WORKING'], done: ['#0d3b25', '#CFFFE2', 'DONE'], error: ['#4a1414', '#FFD6D6', 'ERROR'], waiting: ['#10284a', '#CFE3FF', 'NEEDS YOU'], info: ['#101820', '#FFFFFF', ''] };
  WIDGETS.push({ id: 'agent', name: 'Agent status', emoji: '🤖', every: 1000, needs: 'lcd', params: [{ id: 'idle', label: 'Go back to "idle" after this many seconds without news (0 = never)', type: 'number', def: 0 }],
    gen: ({ lcd, p }) => {
      if (!lcd || !lcd.at) return card('Waiting for an agent…\nPOST to http://127.0.0.1:8777/api/lcd', '#101820');
      if (+p.idle > 0 && lcd.ageSec > +p.idle) return card('Idle', '#101820', { fg: '#8a93a8' });
      const [bg, fg, label] = AGENT_STATES[lcd.state] || AGENT_STATES.info;
      return card((label ? label + '\n' : '') + (lcd.text || ''), bg, { fg });
    } });

  /* ---------- PC monitor on the pad's own built-in screen ("pcs" frames; fields follow the vendor's example JSON) ---------- */
  WIDGETS.push({ id: 'pcmonitor', name: 'PC monitor (built-in screen)', emoji: '🖥️', every: 2000, needs: 'stats', raw: 'pcs', params: [],
    gen: ({ stats }) => { const s = stats || { cpu: 0, mem: 0, memUsedGB: 0, memFreeGB: 0 }; return { time: Math.floor(Date.now() / 1000), cpu: { load: s.cpu }, memory: { used: s.memUsedGB, avail: s.memFreeGB, percent: s.mem } }; } });

  /* ---------- key-press events: the pad sends a line like "ebf.k.1.1" (observed; profile 1, key 1) ---------- */
  const parseKeyEvent = (line) => { const m = /^ebf\.k\.(\d+)\.(\d+)$/.exec(String(line).trim()); return m ? { profile: +m[1], key: +m[2] } : null; };
  /** Two-line toast text for a pressed key, from its saved entry ({alias, actions}) or null if unknown. */
  function keyToast(entry, key) {
    const name = (entry && entry.alias) || (entry && entry.actions && entry.actions[0]) || 'Key ' + key;
    const detail = entry && entry.actions && entry.actions.length ? entry.actions.filter((a) => !/^ACT\b/i.test(a)).slice(0, 2).join(' , ') : '';
    return detail && detail !== name ? name + '\n' + detail : name;
  }
  const toastPanel = (text) => ({ x: 0, y: 140, w: 480, h: 60, text, bg: '#1b3a7a', fg: '#FFFFFF', align: 'CENTER', 'border-radius': 8, activate: false });

  const api = { PRESETS, LAYOUTS, applyPreset, byId, LEAGUES, scoreboardUrl, parseEvents, gameLine, gameCard, logoUrl, logoKeyPlan, WIDGETS, parseKeyEvent, keyToast, toastPanel, buildExcelPrompt, EXCEL_TIPS, ACTIONS, actionById, actionByCode, newAction, actionsToLines, scriptFromActions, scriptFromConfig, officialLines, linesToActions, MODS, FKEYS, MEDIA, DEVICE, CLICKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PadLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
