# Context-aware profiles: design

Status: implemented per `docs/superpowers/plans/2026-11-01-context-aware-profiles.md`; tests pass; **not yet checked on the real pad**.

## Intent
The pad should change profile by itself to match the window in front, so the keys always fit the app: Claude Code layout in a Claude Code terminal, Photoshop-style layouts elsewhere. The official app does this ("Dynamic Profile Switch") but excludes Pad Studio, because only one program can hold the serial port, and matches on window title only.

## Goals
- The pad's active profile follows the foreground app, for these apps (the user's list): Claude Code, VS Code, Visual Studio, Microsoft Edge, Steam, Spotify, Claude Desktop, Terminal. Anything else goes to a fallback profile.
- Claude Code beats Terminal and VS Code when it is the thing running in them (the user said "whatever you recommend"; this is the recommended rule).
- Rules are editable in Pad Studio (app, optional title keyword, profile), first match wins.
- Real profile switch on the pad, no drive writes, no changes to the user's keys.

## Non-goals
- Rewriting keys on app change (rejected: slow, wears the pad's flash, overwrites the user's keys, reload without replug unverified).
- Designing the eight layouts' keys. That is a follow-up; this work only maps apps to profile numbers.
- Running the official app alongside Pad Studio.
- Firmware, LED or profile-count frames beyond what is needed to learn the switch command.

## Anti-goals
- Switching so eagerly that the pad flickers between profiles while the user alt-tabs.
- Anything that sends untested frames to the pad without the user's say-so (AGENTS.md rule 5).
- Silent failure: if the page is closed or the pad disconnected, the UI must say switching is off.

## Constraints
- No dependencies, Node 18+, Chrome/Edge page. Node cannot open a COM port without a package, so **the page sends the frame** (it holds the port via WebSerial); the helper only reports the foreground window.
- Foreground window is read on Windows by a PowerShell helper process (user32 `GetForegroundWindow`, process name and title), polled about once a second. It runs only while the helper runs.
- The switch frame is **unknown**. Known `ebf` commands: `0 1 2 3 5 6 7 8 a l m`. The firmware does understand `GOTO_PROFILE n` as a key action (script line), so a serial equivalent likely exists.
- Profiles 1, 2, 3 and 5 hold the user's keys, 4 is empty (as of 2026-10-31; re-check). Eight apps plus a fallback need more profiles than exist unless apps share one. The pad's maximum profile count is unknown.
- Official app and Pad Studio exclude each other on the port (AGENTS.md rule 6: user clicks Disconnect first, official app closed afterwards).

## Approaches considered
1. **Learn the real command, drive it from Pad Studio.** Chosen. True switch, no flash wear. Cost: a discovery step, and the Pad Studio page must be open and connected.
2. Use the official app's Dynamic Profile Switch as is. No build, but it blocks Pad Studio's screen and key events and can't tell Claude Code from a plain terminal.
3. Rewrite keys on window change. Rejected for the reasons above.

## Design (approach 1)
### Phase 0: the frame (found 2026-11-01, by reading the official app, no capture needed)
The installed official app (`C:\Program Files\EezBotFun Config\EezBotFun Config.dll`, .NET) was disassembled with a throwaway `System.Reflection.Metadata` tool. Findings:
- `Command2Device` command characters: `0` key config, `1` rgb colour, `2`/`3` add/del alias, `4` wifi, `5` version, `6`/`7` add/del script, `8` query key, **`9` change profile**, `a` set HID, `b` reset HID, `c` reboot, `d` reset, `e` query type, `f` query id, `g` authenticate, `h` bright theme, `i` clear paired dongle, `j` rgb mode, `k` rotate, `l` query profile count, `m` set profile count, `n` upgrade firmware, `z` restore last version.
- `Device::SetActiveProfileId(p)` sends `ConstructCmd('9', p, 0)`, which is the same shape as `enableHid`: `ebf` + length byte + `9` + `<p>` + `.` + `0`. For profile 4: bytes `65 62 66 04 39 34 2E 30` (`ebf`, 4, `"94.0"`). Profile numbers are 1-based, as in the file names.
- The official dynamic-switching loop (`ActiveWindowHelper::monitor_task`) polls the active window title once a second, only acts when the title changed, finds the first profile whose keywords match (`FindProfileByCaption`), else sends the default profile.
- The captured session showed the official app sends `ebf`+`g<unixtime>` (authenticate, pad answers a 64-hex string) and a `pcs` time frame when it connects. Whether the pad needs authentication before it obeys `9` is **unknown**.
- In the user's official-app settings `EnableDynamicProfileSwitching` was `false` during the capture, which is why that capture holds no switch frame.
- **Not yet verified on the pad.** First real-pad test (needs the user to watch the pad, Pad Studio's page connected): send the `9` frame for profile 4, then 1, and see whether the pad changes profile. If it ignores the frame, try sending `g<unixtime>` first. Profile 4 is the empty one.
- Also note whether the pad answers a profile change, which would let the UI show the real current profile.
- Falling back to approach 3 still needs a new decision.

### Phase 1: foreground window
- `server.js`: `GET /api/window` returns `{process, title, ts}`; works only with the PowerShell poller running; `--read-only` does not affect it (it reads no pad data).
- Pure matcher in `library.js`: `matchContext(rules, {process, title}, fallback)` returns a profile number. Rules are ordered, each `{process, titleContains?, profile}`, case-insensitive. Default rule set for the eight apps, with Claude Code (title keyword) above Terminal and VS Code.

### Phase 2: switching in the page
- A **Context** panel (Device tab or its own): on/off toggle, rule list editor, current window, current matched profile, last switch time.
- The page polls `/api/window`, and when the matched profile changes and stays stable for about 600 ms, sends the frame. It never sends the same profile twice in a row, and never while off, disconnected, or when the pad's profile is unknown to be different.
- A manual profile choice pauses auto-switching until the foreground app changes again. (Correction found while planning: Pad Studio's profile tabs only select which profile to edit; they do not switch the pad. A manual switch is detected when a pad key press reports a profile other than the one we last sent.)
- Rules persist in the helper (`context-rules.json`, not secret).

### Tests
- `test.js`: matcher cases (Claude Code over Terminal, fallback, case, empty title), frame encoder golden test once captured.
- `ui-test.js`: panel renders, toggling, a stubbed `/api/window` sequence produces exactly the expected stubbed pad writes. Tests never touch the real pad or drive.
- Real-pad check, reported honestly as such: after the frame is learned, switch profiles from the page with Pad Studio's page connected, and say if the pad did not follow.

## Left to the builder
Poll interval and debounce values, the PowerShell snippet, panel layout, the rule editor's look, where the toggle lives.

## Known risks
- The frame may be unfindable, or may need a handshake we haven't seen.
- Window titles for Claude Code vary by terminal and are unchecked here; the default rule may need tuning against the user's real titles.
- Pad profile limit may be below what nine mappings need; apps may have to share profiles.
