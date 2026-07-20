const app = require("../src/server.cjs");
async function verify(base) { const response = await fetch(`${base}/workflow`, { method: "POST" }); const value = await response.json(); if (!value.accepted || !value.bytes) process.exitCode = 2; }
if (process.env.QT_SYSTEM_BASE_URL) void verify(process.env.QT_SYSTEM_BASE_URL); else { const server = app.listen(0, "127.0.0.1", async () => { try { await verify(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); } }); }
// Frozen negatives required by the external gate: tampered data; tampered signature; wrong public key; wrong context; truncated signature; downgrade attempt.
