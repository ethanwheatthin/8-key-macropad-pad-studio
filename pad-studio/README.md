# Pad Studio

Own config + screen app for the EezBotFun 8-key macropad. No dependencies (Node 18+ for the helper, Chrome/Edge for the app).

## Run
```
node server.js              # helper on http://127.0.0.1:8777 (saving to the pad drive is on; backup is taken before the first write)
node server.js --read-only  # never write to the pad drive
node test.js                # offline tests
```
Open http://127.0.0.1:8777 in **Chrome or Edge** (not an embedded browser: WebSerial needs the real picker).
Click **Connect pad** and pick *USB Serial Device*. After that the page reconnects by itself when you refresh it or replug the pad (no popup); it stays off after you click **Disconnect** until you click Connect pad again, and it says in the log if the port is busy (close the official app). Close the official config app first; only one program can hold the port.

## What it does
- **Keys:** click a key, click a preset (about 40, with emoji icons that are generated and saved), or fill all 8 from a layout. Save writes the pad's drive.
- **Screen:** low-rate widgets (clock, CPU/RAM, focus timer, countdown, banner, message, rotating lines, live sports).
  Fast animations are under "Experimental" because the LCD cannot keep up.
- **Key presses:** the pad reports each press; the tile flashes and the key's action can pop up on the LCD.
- **Sports:** ESPN's unofficial public scoreboard (personal use; it may change without notice). All 359 leagues in 16 sports (`leagues.js`, found by a discovery sweep on 2026-10-31). Games are drawn in the teams' own colours; MMA bouts, tennis matches, golf leaderboards and racing weekends have their own layouts. Rotate / list / follow one team, with a SCORE! alert.
- **Score bug + ticker (default mode):** fills the whole 480x200 drawable area (the bottom 120 px of the LCD belong to the key captions): league and status on top, a big score bar in the teams' colours with records, and a ticker of every other game along the bottom. The big bar follows *My team* if you set one, otherwise the first live game, otherwise the next game to start. The ticker uses the pad's own `long_mode: SCROLL_CIRCULAR`, so nothing streams; it shows `LIVE` / `FINAL` / start time, never a clock, so it only restarts when a score changes. **Not yet seen on the real LCD:** whether the pad scrolls it, and how the blank-line vertical centring looks (the font cannot be resized).
- **Ticker leagues, emoji and primetime:** tap the sport chips (🏈 NFL, 🏀 NBA, ⚾ MLB, 🏒 NHL, ⚽ Premier League, 🥊 UFC…) to scroll those leagues too. The ticker shows live primetime games first (🌙 MNF / TNF / SNF for NFL games starting 7 pm or later in this computer's time zone, PRIMETIME for other NFL evenings and for evening games on a national network), then live games, then upcoming primetime, the rest, and finals last. A live primetime game of any chosen league also takes the big bar (your *My team* still wins). The *Emoji on the pad* switch turns the emoji into plain text (NFL, MNF); **whether the LCD font can draw emoji is not verified**, so if you see empty boxes, switch it to plain text. The web page itself uses emoji in the tabs, league list and connection light.
- **League picker:** type in the search box above the list (`nfl`, `premier`, `soccer prem`, `ufc`); matches show as a list, and leagues you started appear under *Recent*.
- **Logos:** the LCD canvas (`cus` protocol) cannot draw images. ESPN logos are fetched as 64x64 PNGs and written as the pad's *key icons* ("Put logos on keys" on the Sports widget). Whether the pad re-reads icons without a replug is not verified.

## Parity with the official EezBotFun config app (v1.8.0, checked by running it)
The official app's file format was learned by creating every action in it and reading the files it saved (`test-fixtures/official-app-v1.8.0/`).
`configs/profile_P_key_K.txt` holds, per action, an `ACT <code> <parameter>` line plus the keystrokes the PC app would type;
`scripts/profile_P_key_K.txt` holds what the pad itself runs. Pad Studio writes exactly this, so the two apps can edit each other's keys
(a golden test regenerates the official app's real files byte for byte).

| Official control | Pad Studio |
|---|---|
| Profiles 1..N and the green **+** | Profile tabs with **+ / −** (sets the count over serial). |
| Key grid, Title, Select Icon File, Clear Icon | Yes. |
| **Save key** / **Save Profile** | Yes, both. |
| Import Presets / Import Profile / Export Key Config For Sharing | Import `.txt` (official per-key format) and `.json` (whole profile); export key `.txt` and profile `.json`. The official gallery's preset file format is not published, so gallery presets may not import. |
| Action sequence with ↑ ↓ delete and drag from the action list | Yes. |
| All 14 actions | Access Web (1), Launch App (2), Open Folder (3), Open File (f), Input Text (4, with *End with Enter*), Shortcut (5), Wait (7), Mouse Move (8, absolute x y + *drag*), Mouse Click (9: left, double, right, middle, wheel), Media Control (a: `MK_*`), Shell Cmd (b, via PowerShell), Change Profile (c), Functional Key (d), Device Ctrl (e: `CC_*`). Code 6 was never seen. |
| HID Mode checkbox | Yes. |
| Device list; Set RGB backlight; Sync configuration; Switch theme; Upgrade firmware | **Device** tab. *Sync configuration* in the official app copies the pad's config to the PC so non-HID keys work; here "Sync" reloads every profile from the pad. Firmware upgrade over Wi-Fi is untested (the pad needs **2.4 GHz** Wi-Fi). |
| Settings: language, time zone, Wi-Fi, auto-start, named pipe, toolbar | Only Wi-Fi for firmware. Not available: language (official has English / 中文 / 日本語), time zone, auto-start, named-pipe service. |
| **Dynamic Profile Switch** | **Context-aware profiles** (Device tab): the pad changes profile to match the window in front. It sends the change-profile frame found in the official app; **not yet confirmed on the pad**. See the section below. |
| Clear pairing information | NOT available (2.4G dongle only; command unknown). |
| Running non-HID keys on the PC (launching apps, absolute mouse moves, shell commands…) | Only **Launch App** can start programs, and only with `node server.js --run-actions`. Mouse Move/Shell and the other PC-side actions are saved in the official format but not executed by Pad Studio. |
| Double-click the scroll wheel: toggles the pad's USB drive | Pad hardware feature. Pad Studio's saving needs the drive on. |
| PC-status screen | **PC monitor (built-in screen)** widget (`pcs` frames, unverified on the pad). |
| Official web site / presets gallery links | Yes (Device tab). |

## Context-aware profiles
The pad follows the window in front, like the official app's Dynamic Profile Switch. **Device tab -> Context-aware profiles**: tick the box, connect the pad (the page must stay open and connected), and edit the rules (program names, optional title keyword, profile number; first match wins; everything else uses the fallback profile).
- The helper (`node server.js`, Windows) reports the foreground program and title at `/api/window`; the rules are saved beside `server.js` in `context-rules.json` (`/api/context`).
- The switch frame is `ebf` + length + `9<profile>.0` (profile 4 = `65 62 66 04 39 34 2e 30`), read from the official app's code (`Device.SetActiveProfileId`). Unit-tested byte for byte; **whether this pad obeys it has not been checked yet**. The **Test: go to profile** button in the panel sends it by hand. The official app also sends a `g<time>` handshake when it connects; if the pad ignores the switch, that is the first thing to copy.
- Switching waits 600 ms on a stable window, never repeats a profile, never goes to a profile above the pad's count (add profiles with + on the Keys tab), and pauses when you press a key on the pad that reports a different profile than the one it sent, until you move to another program (a new title in the same program does not end the pause). Lock screens and "no window" never switch anything. If a switch fails to send, it is retried.
- The defaults (profile 1 for anything else; Claude Code 6, VS Code 7, Visual Studio 8, Edge 9, Steam 10, Spotify 11, Claude Desktop 12, Terminal 13) only work once the pad has that many profiles. Claude Code is told apart from a plain terminal by "claude" or a ✳ star in the terminal's window title (use `|` in the title box for alternatives); VS Code's title never shows Claude Code, so VS Code always uses the VS Code profile. Check this against your real window titles.
- The Profile tabs on the Keys tab only choose which profile you are editing; they do not switch the pad.

## AI agents
The pad types into whatever window has focus, so it can drive Claude Code, ChatGPT, Cursor or any terminal agent.
- **Keys tab → Layout menu:** *AI agent: control* (Approve = Enter, Yes always = 2, Reject/stop = Esc, Switch mode = Shift+Tab, Continue, Undo = Esc Esc, Dictate = Win+H, Paste & send),
  *AI agent: prompts* (run tests, explain, review, commit, summarize, fix errors, simplify) and *AI agent: slash commands* (`/clear /compact /cost /status /model /resume /init /help`).
  Gallery category **AI agents** has all of them plus *Slash command…* and *Custom prompt…* (you type the text). The key choices follow Claude Code; other tools differ.
- **Screen tab → Agent status:** shows the latest message pushed to the helper, coloured by state (`working`, `done`, `error`, `waiting`, `info`).
  Push one with `node agent-status.js done "Tests passed"` (never fails loudly, exits 0 if the helper is down) or `POST http://127.0.0.1:8777/api/lcd` with `{"state":"done","text":"..."}`
  (200 characters max; cross-site browser requests are refused).
- **Example Claude Code hooks** (add to your own `~/.claude/settings.json`; this repo does not change it; the endpoint and script are tested, running them from inside Claude Code is not):
```json
{ "hooks": {
  "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node /path/to/pad-studio/agent-status.js working Working" }] }],
  "Notification":     [{ "hooks": [{ "type": "command", "command": "node /path/to/pad-studio/agent-status.js waiting" }] }],
  "Stop":             [{ "hooks": [{ "type": "command", "command": "node /path/to/pad-studio/agent-status.js done" }] }]
} }
```

## How the pad talks (all observed or from the vendor docs)
- **Drive:** the pad exposes a ~1.5 MB FAT drive: `configs/profile_P_key_K.txt` (`Alias=`, `HidMode=`, action lines), `scripts/…` (same lines without `ACT`), `app_icons/profile_P_key_K.png` (64x64). Chrome cannot open a drive root, so `server.js` does it.
- **Serial (USB CDC, VID 0x303A, 115200):**
  - `ebf` + 1-byte length + command: key config and queries (see `core.js`).
  - `cus` + u16be length + JSON: draws on the top 480x200 of the LCD (one panel per frame; see the vendor doc in `3rd-party -integrations/customised-display-on-lcd`).
  - **Key events from the pad:** a line `ebf.k.<profile>.<key>` for each key press (confirmed for keys 1 to 8).
- A `cus` frame with `activate` true switches the pad to its custom screen; toasts use `activate:false` unless you tick the option.

## Files
`core.js` protocol + simulator, `library.js` presets/layouts/widgets/sports/key events, `index.html` UI, `server.js` helper, `test.js`, `pad-backup-initial/` copy of the pad drive taken before any write.

## Not verified on hardware
Whether the pad re-reads saved files without a replug; serial saves (`ebf` types 0/2/6); backlight frames; `WINDOWS .` and `ALT TAB` presets; the wheel's messages.
