# Context-aware profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The pad switches to the profile mapped to the foreground app (Claude Code, VS Code, Visual Studio, Edge, Steam, Spotify, Claude Desktop, Terminal, else a fallback) while Pad Studio's page is connected.

**Architecture:** `server.js` reports the foreground window (a PowerShell poller, Windows only). The page polls it, a pure state machine in `library.js` decides when to switch (debounce, no repeats, manual-hold), and the page sends the `9<profile>.0` frame built by `core.js`. Rules persist in `context-rules.json` via the helper.

**Tech Stack:** plain JS, Node 18+, no dependencies, headless Edge for `ui-test.js`. UMD modules `core.js` / `library.js` stay pure so `test.js` covers them.

**Spec:** `pad-studio/docs/superpowers/specs/2026-11-01-context-aware-profiles-design.md`

## Global Constraints

- No new dependencies. Match surrounding style: terse, comments only for non-obvious facts. `index.html` stays thin; logic that can be pure goes in `core.js` / `library.js`.
- **Do not commit** (user's project rule: commit only when asked; this folder's git state already has unrelated uncommitted work). Leave changes in the working tree.
- Tests never touch the pad: `ui-test.js` stubs `api()` and the serial transport. Real-pad checks (Task 5) happen only with the user present.
- Switch frame (verified by disassembling the official app, **not yet seen working on the pad**): `ebf` + length byte + `9` + `<profile>` + `.0`. Profile 4 is bytes `65 62 66 04 39 34 2e 30`; profile 1 is `65 62 66 04 39 31 2e 30`; profile 12 is `65 62 66 05 39 31 32 2e 30`. Profiles are 1-based.
- Never send a switch to a profile greater than the pad's profile count (`state.profiles`) or below 1.
- Debounce 600 ms; never send the same profile twice in a row; poll the window once a second.
- Default app→profile mapping (my call, editable in the UI): fallback 1; Claude Code 6, VS Code 7, Visual Studio 8, Edge 9, Steam 10, Spotify 11, Claude Desktop 12, Terminal 13. Profiles 1, 2, 3, 5 hold the user's keys, 4 is empty; the pad's profile limit is unknown.
- AGENTS.md rules apply: look before you write to the pad drive (this feature writes none), `node test.js` before and after, `node ui-test.js` after UI changes (helper must be running), verify the helper responds before saying it is running.

## Review Focus

1. Empty process/title (lock screen, UAC prompt, desktop): no switch, no error, current profile kept.
2. Rapid alt-tab shorter than 600 ms: no frame sent at all.
3. Rule profile above the pad's count (default Terminal = 13 on a 5-profile pad): no frame, and the panel says why.
4. Pad Studio disconnected or helper stopped: panel shows switching is off; reconnecting re-sends the current match (the pad's real profile is unknown after a reconnect).
5. Overlapping apps: Claude Code rule beats Terminal and VS Code when the title contains "claude" (any case); a plain terminal still gets the Terminal profile. Plus: the user pressing a key on the pad that reports a different profile than the one we sent pauses switching until the foreground window changes.
6. `/api/window` on a machine where PowerShell fails or is missing: `{ok:false}`, helper keeps running.

---

### Task 1: Switch frame encoder and mock pad

**Files:**
- Modify: `core.js` (`F` object near line 66; `MockDevice` constructor near line 195 and `handle` near line 210; the exported `F` already covers the new method)
- Test: `test.js`

**Interfaces:**
- Produces: `PadCore.F.gotoProfile(profile: number): Uint8Array`, throws `RangeError` unless `Number.isInteger(profile) && profile >= 1 && profile <= 255`. `PadCore.MockDevice` gains field `active: number` (starts 1) set by a `9` command.

- [ ] **Step 1: Write failing tests in `test.js`** (next to the other frame tests):
  - `'gotoProfile builds the official change-profile frame'`: `hex(C.F.gotoProfile(4)) === '656266' + '04' + '39342e30'`; `hex(C.F.gotoProfile(1)) === '65626604' + '39312e30'`; `hex(C.F.gotoProfile(12)) === '65626605' + '3931322e30'`.
  - `'gotoProfile rejects values the pad cannot have'`: `assert.throws` for `0`, `256`, `1.5`, `'4'`, `NaN`.
  - `'mock pad follows a change-profile frame'`: `const d = new C.MockDevice(() => {}); d.write(C.F.gotoProfile(3)); assert.strictEqual(d.active, 3)`.
- [ ] **Step 2: Run `node test.js`**; expected: the three new tests FAIL (`gotoProfile is not a function`).
- [ ] **Step 3: Implement** `F.gotoProfile` in `core.js` as `ebf(str('9' + p + '.0'))` after the range check; in `MockDevice` set `this.active = 1` in the constructor and handle `type === '9'` by parsing the leading integer of `td.decode(rest)`.
- [ ] **Step 4: Run `node test.js`**; expected: all tests pass, count increased by 3.

---

### Task 2: Context matching and switch state machine (pure logic)

**Files:**
- Modify: `library.js` (add near `parseKeyEvent`, and add to the exported `api` object at the end)
- Test: `test.js`

**Interfaces:**
- Produces, all on `PadLib`:
  - `DEFAULT_CONTEXT: { enabled: false, fallback: 1, rules: Rule[] }` with the eight default rules in the order listed in Global Constraints, Claude Code first. `Rule = { name: string, process: string[], titleContains: string, profile: number }`; `process` entries are lower-case exe names without `.exe` (`windowsterminal`, `pwsh`, `powershell`, `cmd`, `conhost`, `code`, `devenv`, `msedge`, `steam`, `steamwebhelper`, `spotify`, `claude`); `titleContains: ''` means any title. Claude Code: processes `windowsterminal, pwsh, powershell, cmd, conhost, code`, `titleContains: 'claude'`, profile 6. Terminal: `windowsterminal, pwsh, powershell, cmd, conhost`, profile 13.
  - `matchContext(cfg: {rules, fallback}, win: {process: string, title: string} | null): { profile: number, rule: Rule | null } | null`. `null` when `win` is null or its `process` is empty. Process compare is case-insensitive and ignores a trailing `.exe`; an empty `rule.process` matches any process; `titleContains` is a case-insensitive substring; first matching rule wins; no match gives `{ profile: cfg.fallback, rule: null }`.
  - `parseWindowLine(line: string): { process: string, title: string } | null` for a JSON line `{"p":"Code","t":"title"}`; `null` for bad JSON or an empty `p`; `process` lower-cased with `.exe` stripped; `title` truncated to 300 characters.
  - `normalizeContext(input: unknown): { enabled: boolean, fallback: number, rules: Rule[] }`, throws `Error` for: not an object, more than 32 rules, a profile not an integer 1..255, `fallback` the same, a string over 200 characters, `process` not an array of strings. Lower-cases and strips `.exe` from `process` entries; coerces `enabled` with `=== true`.
  - `createSwitcher(opts?: { debounceMs?: number }): { update(win, nowMs, ctx: { rules, fallback, profiles }): number | null, hold(win): void, observePad(profile: number, win): void, reset(): void, status(): { lastSent: number | null, pending: number | null, held: boolean, skipped: string | null } }`.
    - `update` returns the profile to send, or `null`. It returns a profile only when the matched profile has stayed the same, and differs from `lastSent`, for at least `debounceMs` (default 600) of consecutive updates; it then records `lastSent`.
    - A matched profile above `ctx.profiles` or below 1 is never returned; `status().skipped` becomes `'profile N is not on the pad (it has M)'`; cleared when a valid profile is matched.
    - `null` window or empty process: returns `null`, changes nothing.
    - `hold(win)`: while held, `update` returns `null`; the hold ends as soon as `win`'s `process + '|' + title` differs from the held one.
    - `observePad(profile, win)`: when `profile !== status().lastSent`, set `lastSent = profile` and `hold(win)`; otherwise no change.
    - `reset()` clears `lastSent`, pending, hold and skipped (called on connect so the current match is re-sent).

- [ ] **Step 1: Write failing tests in `test.js`:**
  - `matchContext`: Claude Code beats Terminal (`{process:'WindowsTerminal', title:'✳ Claude Code'}` → profile 6, rule name `'Claude Code'`); same process with title `'PowerShell'` → 13; `{process:'Code.exe', title:'main.js - Visual Studio Code'}` → 7; `{process:'msedge', title:'Claude - Microsoft Edge'}` → 9 (title keyword does not leak to Edge); `{process:'notepad', title:'x'}` → fallback `1` with `rule === null`; `null` window and `{process:'', title:''}` → `null`.
  - `parseWindowLine`: valid line, `.exe` stripped and lower-cased; garbage → `null`; `{"p":"","t":"x"}` → `null`.
  - `normalizeContext`: accepts `DEFAULT_CONTEXT`; throws for profile 0, 256, 33 rules, `process: 'code'`; `'Code.EXE'` in `process` becomes `'code'`.
  - `createSwitcher` with ctx `{rules: DEFAULT_CONTEXT.rules, fallback: 1, profiles: 13}` and a fake clock:
    - stable VS Code window: update at t=0 → `null`, t=599 → `null`, t=600 → `7`, t=1600 → `null` (no repeat);
    - alt-tab flicker: Edge at t=0, Steam at t=300, Edge at t=500 … never returns a value before 600 ms of the same match;
    - out of range: with `profiles: 5`, Terminal never returned and `status().skipped` contains `'not on the pad'`;
    - `observePad(2, win)` after `lastSent === 7` → following updates for the same window return `null`; a different window title releases it after the debounce;
    - `reset()` makes the same stable window return its profile again;
    - empty-process window mid-debounce returns `null` and does not restart or complete the debounce.
- [ ] **Step 2: Run `node test.js`**; expected: the new tests FAIL (`matchContext is not a function` etc).
- [ ] **Step 3: Implement** the five exports above in `library.js` as pure functions/closure state; share one `winKey(win) = process + '|' + title` helper.
- [ ] **Step 4: Run `node test.js`**; expected: all pass.

---

### Task 3: Helper: foreground window and rules endpoints

**Files:**
- Modify: `server.js` (add near the `/api/lcd` block, before the `/api/status` route; require `./library.js` for `parseWindowLine`, `normalizeContext`, `DEFAULT_CONTEXT`)
- Create (at runtime, by the endpoint): `context-rules.json` in `pad-studio/`

**Interfaces:**
- Consumes: `PadLib.parseWindowLine`, `PadLib.normalizeContext`, `PadLib.DEFAULT_CONTEXT` (Task 2).
- Produces:
  - `GET /api/window` → `{ ok: boolean, process: string, title: string, ageMs: number | null }`. `ok` is true only while the PowerShell watcher is alive and its last line is under 3000 ms old. On non-Windows or a watcher that exited, `{ ok: false, process: '', title: '', ageMs: null }`.
  - `GET /api/context` → the stored config, or `DEFAULT_CONTEXT` when the file is missing or invalid.
  - `PUT /api/context` with a JSON body → validates with `normalizeContext`, writes `context-rules.json` (write a temp file then rename), returns the normalized config; `400 { error }` on validation failure. Allowed with `--read-only` (it does not touch the pad drive). Body limit 20000 bytes via the existing `readBody`.
- Behaviour: the watcher is started once at server start (Windows only), spawned with `powershell.exe -NoProfile -NonInteractive -Command <script>`; the script loads `user32` (`GetForegroundWindow`, `GetWindowThreadProcessId`, `GetWindowText`) with `Add-Type`, and every 1000 ms prints one compact JSON line `{"p":<process name>,"t":<window title>}` (empty strings when no foreground window). stdout lines go through `parseWindowLine`. If the process exits, mark not alive and do not restart (the UI shows it). The child is killed when the helper exits.

- [ ] **Step 1: Implement** the watcher and the two routes as specified; keep them under ~40 lines.
- [ ] **Step 2: Restart the helper detached** (`Start-Process node server.js` in `pad-studio`, as in `start-pad-studio.bat`) and verify `curl http://127.0.0.1:8777/api/status` responds.
- [ ] **Step 3: Check the window endpoint by hand**: `curl http://127.0.0.1:8777/api/window` returns `ok:true` and the terminal's process name; click another window within 2 s and repeat; the process/title change. Expected: `ok:true`, `ageMs` under 3000.
- [ ] **Step 4: Check the rules endpoint**: `GET /api/context` returns the defaults with `enabled:false`; `PUT` the same body with `fallback` changed to 2 (`Content-Type: application/json`, no `Origin` header); a second `GET` shows 2 and `context-rules.json` exists; `PUT` with `fallback: 0` returns 400; `PUT` back to `fallback: 1`. Expected: as stated.
- [ ] **Step 5: Run `node test.js`**; expected: still passing.

---

### Task 4: Context panel and switching in the page

**Files:**
- Modify: `index.html`: new panel in `#pageDevice` after the existing Device panels; script additions near `onKeyPress` (line ~490) and the connect handler (line ~205); the interval setup at the end (line ~520).
- Test: `ui-test.js` (new section before the "no uncaught page exceptions" check)

**Interfaces:**
- Consumes: `PadLib.createSwitcher`, `PadLib.matchContext`, `PadLib.DEFAULT_CONTEXT` (Task 2); `PadCore.F.gotoProfile` (Task 1); `GET /api/window`, `GET/PUT /api/context` (Task 3); existing `state.t`, `state.profiles`, `send(bytes)`, `api(path, opts)`, `log(msg, cls)`, `$`.
- Produces (globals in the page, so `ui-test.js` can call them): `loadContext(): Promise<void>`, `saveContext(): Promise<void>`, `renderContext(): void`, `ctxTick(nowMs?: number): Promise<void>` (does one poll+decision; the 1 s `setInterval` calls it), `state.ctx = { enabled, fallback, rules }`, `const switcher`.

Element ids: `ctxOn` (checkbox, off by default), `ctxStatus` (text), `ctxRules` (container), `ctxFallback` (number input), `btnCtxSave`, `btnCtxDefaults`, `ctxTestProfile` (number input), `btnCtxTest`.

Behaviour:
- `ctxTick`: does nothing unless `state.ctx.enabled`. If `state.t` is null (not connected) status reads `'Off: connect the pad first'`. Fetch `/api/window`; if `!ok` status reads `'Off: the helper cannot read the foreground window'`. Otherwise call `switcher.update(win, nowMs, { rules, fallback, profiles: state.profiles })`; when it returns a profile, `await send(C.F.gotoProfile(p))`, `log('switched pad to profile ' + p + ' (' + matchedName + ')', 'good')`, and put the same in the status. Status also shows the current window `process | title`, the matched rule name, and `switcher.status().skipped` when set. A thrown error is logged, never uncaught.
- On serial connect (existing connect handler) call `switcher.reset()`. In `onKeyPress(p, k)` call `switcher.observePad(p, lastWin)` where `lastWin` is the last window `ctxTick` fetched.
- `ctxOn` change updates `state.ctx.enabled` and saves via `saveContext`; editing a rule row (name, process list as comma-separated text, title keyword, profile number) or the fallback and clicking `btnCtxSave` saves; `btnCtxDefaults` loads `DEFAULT_CONTEXT` into the editor (not saved until Save).
- `btnCtxTest` sends `F.gotoProfile(+ctxTestProfile.value)` directly (for checking the frame on a real pad; logs the profile, shows an error text instead of throwing for invalid numbers or when not connected).

- [ ] **Step 1: Write the failing UI checks in `ui-test.js`.** After a stub override of `api` that serves `/api/context` → `{enabled:true, fallback:1, rules:[{name:'Notepad',process:['notepad'],titleContains:'',profile:4},{name:'Far',process:['far'],titleContains:'',profile:9}]}` and `/api/window` from a settable `window.fakeWin`, with `state.t = { kind:'serial', write: async (b) => { window.writes.push(Array.from(b)); } }`, `state.profiles = 5`, `await loadContext()`, `switcher.reset()`:
  - `'context panel renders the rules and starts off'`: before enabling, a fresh `DEFAULT_CONTEXT` render shows `#ctxOn` unchecked and 8 rows in `#ctxRules`.
  - `'Notepad in front for 700 ms sends exactly one switch to profile 4'`: `fakeWin = {ok:true,process:'notepad',title:'Untitled'}`; `await ctxTick(0)`, `await ctxTick(700)`; `writes` deep-equals `[[0x65,0x62,0x66,4,0x39,0x34,0x2e,0x30]]`; `await ctxTick(1700)`; still one write.
  - `'back to the fallback profile after the window changes'`: `fakeWin = {ok:true,process:'explorer',title:'Docs'}`; `await ctxTick(2000)`, `await ctxTick(2700)`; second write is `[0x65,0x62,0x66,4,0x39,0x31,0x2e,0x30]`.
  - `'a profile the pad does not have sends nothing and says so'`: `fakeWin` = process `far`; ticks at 3000 and 3700; `writes.length` unchanged and `$('ctxStatus').textContent` contains `'not on the pad'`.
  - `'a pad key press in another profile pauses switching'`: after `onKeyPress(2, 1)` (stubbed key lookup is already stubbed by `api`), a Notepad window ticked at 4000 and 4700 adds no write; changing `fakeWin.title` and ticking at 5000 and 5700 adds one.
  - `'not connected shows Off and sends nothing'`: `state.t = null`; `await ctxTick(9000)`; status contains `'connect the pad'`.
  - `'test button sends the frame'`: reconnect stub, `$('ctxTestProfile').value = '3'`, click `btnCtxTest`; last write is `[0x65,0x62,0x66,4,0x39,0x33,0x2e,0x30]`.
- [ ] **Step 2: Run `node ui-test.js`** (helper running); expected: the new checks FAIL (`ctxTick is not defined`), earlier checks pass.
- [ ] **Step 3: Implement** the panel markup and script as specified.
- [ ] **Step 4: Run `node ui-test.js`**; expected: every check ok, `0 failed`, and the existing "no uncaught page exceptions" check still passes.
- [ ] **Step 5: Run `node test.js`**; expected: pass.

---

### Task 5: Docs and the real-pad check (user present)

**Files:**
- Modify: `README.md` (pad-studio): add a "Context-aware profiles" section and update the parity table row for Dynamic Profile Switch; `AGENTS.md` (repo root): hardware facts line for the `9` command and the Known gaps list; update the status line at the top of the design doc.

- [ ] **Step 1: Update the docs** with: how to turn it on (Device tab → Context panel, connect pad first), the frame format, that Pad Studio's page must be open and connected, that tabs edit keys but do not switch the pad, defaults and that profiles 6–13 must exist, and what is verified (tests) versus not (pad behaviour until Step 3). In AGENTS.md remove "Dynamic Profile Switch" from Known gaps only after Step 3 passes; until then write "frame found by disassembly, unverified on the pad".
- [ ] **Step 2: Real-pad check, with the user at the pad and the official app closed.** Pad Studio page connected, helper running. In the Context panel set the test profile to `4` (empty profile, pad has 5) and click the test button; ask the user whether the pad switched and which profile its screen shows; repeat with `1`. Expected: the pad changes profile each time. Report exactly what the user says.
- [ ] **Step 3a: If the pad switches:** enable context switching, set one rule to profile 4 for a harmless app (Notepad), have the user click Notepad then Explorer, confirm the pad follows within about 2 seconds, update AGENTS.md and README to "verified", report the result.
- [ ] **Step 3b: If the pad ignores the frame:** do not guess. The official app sends `ebf` + `g<unix seconds>` first and the pad answers with a 64-character hex string. Read how the official app computes and sends it (its disassembly dumper is in the session scratchpad: `ildump/out/ildump.dll`, run as `dotnet ildump.dll ezbf.dll Authenticate`; the full dump is `all.txt` next to it), then add a failing test in `test.js`, implement it in `core.js`, and ask the user before sending anything but the switch frame to the real pad.
- [ ] **Step 4: Final run**: `node test.js` and `node ui-test.js`; expected: all pass. Report results as they are, and say plainly whether the pad switching was tried on the real hardware.
