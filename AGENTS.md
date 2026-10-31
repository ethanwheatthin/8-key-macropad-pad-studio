# AGENTS.md

Guidance for AI coding agents working in this repository. (`CLAUDE.md` imports this file.)

## What this repo is
The EezBotFun **8-key macropad with a 3.5" LCD** project. Two kinds of content live here:

| Path | What | May I edit it? |
|---|---|---|
| `pad-studio/` | **Our own** config + screen app (Node helper + one-page browser UI) | Yes, this is the project |
| `config-app/`, `web-config/`, `3rd-party -integrations/`, `user-manual/`, `3d-printed-case/`, `eezbotfun_config.exe`, `LICENSE`, root `readme.txt` | Vendor material (the official app, docs, protocols, CAD) | **No**, unless explicitly asked. Treat as read-only reference |
| root `README.md` | Vendor README plus a short "Pad Studio" section | Only that section |

This folder is **not a git repository** (it was a downloaded zip). Do not `git init` or commit unless asked.

## Pad Studio at a glance
No dependencies. Node 18+ (developed on 22). The UI needs Chrome or Edge (WebSerial).

```
cd pad-studio
node server.js              # helper on http://127.0.0.1:8777 (serves the app, reads/writes the pad's USB drive)
node server.js --read-only   # never write to the pad
node server.js --run-actions # key presses may launch programs (Launch App actions)
node test.js                # unit + golden tests (offline; hits no network)
node ui-test.js             # drives the page in headless Edge; stubs all pad writes (server must be running)
```

| File | Role |
|---|---|
| `core.js` | Protocol encoders (`ebf`, `cus`, `pcs` frames), LCD simulator, animations, mock device. UMD: browser + Node |
| `library.js` | Presets, layouts, **action model in the official file format**, widgets, ESPN parsing, Excel mode, key-event parsing. UMD |
| `leagues.js` | Generated list of 359 ESPN leagues (from a discovery sweep). Data only |
| `index.html` | The whole UI (Keys / Screen / Excel / Device tabs). Plain JS, no build step |
| `server.js` | Localhost helper: static files, `/api/key|icon|status|stats|backup|press|lcd` (`/api/lcd` = agent status for the LCD widget) |
| `agent-status.js` | CLI that POSTs a status to `/api/lcd`; exits 0 even if the helper is down (safe in hooks) |
| `test.js`, `ui-test.js`, `test-fixtures/` | Tests. Fixtures are **real files written by the official app v1.8.0** |

Keep logic that can be pure in `core.js` / `library.js` so `test.js` can cover it; keep `index.html` thin.

## Hardware and protocol facts (verified unless marked)
- USB device VID `0x303A` PID `0x4007` (Espressif). Interfaces: HID keyboard/mouse/consumer, **CDC serial** (115200), **mass storage** (~1.5 MB FAT).
- The pad's drive holds `configs/`, `scripts/`, `app_icons/` (64x64 RGBA PNG per key), `display_names/`. Files are named `profile_P_key_K.txt/png`, CRLF.
- **Official key format** (see `library.js`, golden-tested): `configs/` = per action an `ACT <code> <param>` line then the keystrokes the PC app would type; `scripts/` = what the pad itself runs (no ACT lines, max 20 lines).
  Codes: 1 web, 2 app, 3 folder, 4 text, 5 shortcut, 7 wait, 8 mouse move (absolute), 9 mouse click, a media (`MK_*`), b shell, c profile, d functional key, e device ctrl (`CC_*`), f open file. Code 6 never seen.
- Serial frames: `ebf` + 1-byte length + command (key config/queries); `cus` + u16be length + JSON (draw on the top **480x200** of the LCD; one panel per frame, 48 panels max, payload <= 2043 B, **no images**); `pcs` (built-in PC monitor, unverified on hardware).
- `cus` with `activate:true` switches the pad to its custom screen; overlays/toasts use `activate:false`.
- The pad sends `ebf.k.<profile>.<key>` on every key press (confirmed for keys 1-8).
- Only **one program can hold the serial port**: Pad Studio's page, the official app and the web config exclude each other.
- Double-clicking the scroll wheel toggles the pad's USB drive (saving needs it on).
- ESPN scoreboard API is unofficial: personal use only, poll >= 20 s, it can change without notice.

## Rules that protect the user's pad
1. **Never write to the pad drive except through `server.js`** (`PUT/DELETE /api/key|icon`). It backs up first and keeps the previous version of every overwritten file in `pad-studio/pad-backup-changes/`.
2. **Look before you write.** List the target profile's files first (`ls /g/configs /g/scripts /g/app_icons | grep profile_N_`). As of 2026-10-31 profiles 1, 2, 3 and 5 hold the user's keys and profile 4 is empty. Re-check; never assume a profile is free.
3. Tests must not touch the pad: `ui-test.js` stubs `api()`. Do not point new tests at the real drive.
4. Take a snapshot (`md5sum` of `configs scripts app_icons display_names`) before experiments and diff afterwards.
5. Don't send firmware-update, profile-count or LED frames to the pad as a test without the user's say-so.
6. If you run the official app (computer use): the user must first click **Disconnect** in Pad Studio, use a spare profile, and **close the official app afterwards** so the port is free again.

## Working conventions
- Match the surrounding style: terse, comments only for non-obvious facts, no new dependencies.
- Windows paths in tests: use `String.raw` or double backslashes. Bash on this machine mangles `/x/...` arguments.
- Add a test for every behaviour change; prefer golden tests built from real device/app output.
- The user prefers Pad Studio opened in **Chrome/Edge**, not the in-app browser. Headless Edge for tests is fine.
- Start long-running things (the helper) as a **detached** process and **verify** it responds before saying it is running; a plain `&` job died when the shell session ended.
- Personal data: `pad-studio/pad-backup-*` hold the user's key configs. Keep them out of anything shared (they are in `.gitignore`).

## Known gaps (do not claim these work)
Dynamic Profile Switch (command to switch the pad's profile unknown), Clear pairing information, multi-language UI, running non-HID actions other than Launch App on the PC, official gallery preset import, firmware update over Wi-Fi, `pcs` monitor screen, and whether the pad reloads files without a replug (always say "unplug and replug if it doesn't update").
