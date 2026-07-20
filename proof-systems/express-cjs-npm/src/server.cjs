const express = require("express"); const { workflow } = require("./crypto.cjs");
const app = express(); app.get("/health", (_request, response) => response.json({ ok: true })); app.post("/workflow", (_request, response) => response.json(workflow()));
if (require.main === module) app.listen(Number(process.env.PORT || 3101), "127.0.0.1"); module.exports = app;
