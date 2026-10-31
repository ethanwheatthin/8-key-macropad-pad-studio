#!/usr/bin/env node
// Push a status message to the pad's "Agent status" widget via the Pad Studio helper (node server.js must be running).
//   node agent-status.js done "Tests passed"          states: working | done | error | waiting | info
//   node agent-status.js waiting                      (text defaults to the state's label)
// Meant for hooks and scripts: it never fails loudly. If the helper is not running it just exits 0 after a short timeout.
const state = process.argv[2] || 'info', text = process.argv.slice(3).join(' ') || ({ working: 'Working…', done: 'Finished', error: 'Something failed', waiting: 'Needs your input' }[state] || '');
const port = process.env.PAD_STUDIO_PORT || 8777;
fetch(`http://127.0.0.1:${port}/api/lcd`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, text }), signal: AbortSignal.timeout(1500) })
  .then((r) => process.exit(r.ok ? 0 : 0), () => process.exit(0));
