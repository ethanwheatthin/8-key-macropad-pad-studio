@AGENTS.md

# Claude Code notes

- Work in `pad-studio/`. Everything outside it is vendor material; read it, don't edit it.
- Before changing behaviour, run `node pad-studio/test.js`. After UI changes also run `node pad-studio/ui-test.js` (needs the helper running and Edge installed).
- Before saying a server, port or app is running or closed, **check it** (`curl localhost:8777/api/status`, a COM7 open test, `Get-Process`). Earlier in this project a claim of "running" was wrong.
- Report test results as they are. If a check fails, say so with the output; if something was not tried on the real pad, say that plainly.
- Don't open the in-app browser for Pad Studio. For real-pad tests use PowerShell's `System.IO.Ports.SerialPort` on COM7 only when Pad Studio's page is disconnected.
- Scratch files go in the session scratchpad, not in the repo.
