import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { command, safeCommandEnvironment } from "./util.ts";
import type { RuntimeCryptoEvent } from "./system-bundle.ts";

const hook = String.raw`
const fs = require("node:fs");
const crypto = require("node:crypto");
const output = process.env.QT_TRACE_FILE;
const componentId = process.env.QT_TRACE_COMPONENT;
const bytes = value => Buffer.isBuffer(value) || ArrayBuffer.isView(value) ? value.byteLength : typeof value === "string" ? Buffer.byteLength(value) : 0;
const keyType = value => { try { const key = value && value.key ? value.key : value; return key && typeof key === "object" && key.asymmetricKeyType ? key.asymmetricKeyType : typeof key; } catch { return "unknown"; } };
const callSite = () => { const line = (new Error().stack || "").split("\n").slice(3).find(value => !value.includes("qt-runtime-trace.cjs")) || "unknown"; return line.replace(process.cwd(), "<repository>").replace(/file:\/\/\/.*?\/repositories\/([^/]+)\//i, "<repository>/$1/").replace(/(?:[A-Za-z]:[\\/]|\/)(?:[^():\r\n]+[\\/])+repositories[\\/]([^\\/():\r\n]+)[\\/]/i, "<repository>/$1/").trim(); };
const record = event => { if (output) fs.appendFileSync(output, JSON.stringify({ ...event, callSite: callSite(), componentId }) + "\n", { encoding: "utf8", mode: 0o600 }); };
for (const name of ["sign", "verify", "publicEncrypt", "privateDecrypt", "encapsulate", "decapsulate"]) {
  const original = crypto[name]; if (typeof original !== "function") continue;
  crypto[name] = function (...args) {
    const operation = name === "publicEncrypt" ? "encrypt" : name === "privateDecrypt" ? "decrypt" : name;
    const algorithm = name === "sign" || name === "verify" ? String(args[0]) : name === "encapsulate" || name === "decapsulate" ? "ml-kem" : "rsa";
    const payload = name === "verify" ? args[1] : name === "sign" ? args[1] : args[1] || args[0];
    const key = name === "verify" ? args[2] : name === "sign" ? args[2] : args[0];
    let result; try { result = original.apply(this, args); return result; }
    finally { record({ operation, algorithm, keyType: keyType(key), payloadBytes: bytes(payload), outputBytes: bytes(result) }); }
  };
}
require("node:module").syncBuiltinESMExports();
`;

function safeEnvironment(traceFile: string, componentId: string, preload: string) {
  const environment = safeCommandEnvironment();
  environment.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ""} --require=${JSON.stringify(preload)}`.trim();
  environment.QT_TRACE_FILE = traceFile; environment.QT_TRACE_COMPONENT = componentId;
  return environment;
}

export async function traceCryptoCommand(program: string, args: string[], cwd: string, componentId: string, timeout = 120_000, additions: Partial<NodeJS.ProcessEnv> = {}) {
  const session = await createCryptoTraceSession(componentId, additions);
  try {
    const result = await command(program, args, cwd, timeout, session.environment);
    return { result, events: await session.readEvents() };
  } finally { await session.dispose(); }
}

export async function createCryptoTraceSession(componentId: string, additions: Partial<NodeJS.ProcessEnv> = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "quantum-twin-trace-")), preload = path.join(directory, "qt-runtime-trace.cjs"), output = path.join(directory, "events.ndjson");
  await writeFile(preload, hook, { mode: 0o600 }); await writeFile(output, "", { mode: 0o600 });
  return {
    environment: { ...safeEnvironment(output, componentId, preload), ...additions } as NodeJS.ProcessEnv,
    async readEvents() { return (await readFile(output, "utf8")).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as RuntimeCryptoEvent); },
    async dispose() { await rm(directory, { recursive: true, force: true }); }
  };
}
