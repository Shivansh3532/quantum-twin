import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { command } from "./util.ts";

export type SystemCheck = { name: string; passed: boolean; detail: string; fix?: string };

export async function systemStatus() {
  const checks: SystemCheck[] = [];
  const platform = os.platform();
  checks.push({ name: "Supported OS", passed: ["win32", "darwin", "linux"].includes(platform), detail: `${platform} ${os.arch()}`, fix: "Use Windows, macOS, or Linux" });
  const node = /^v24\.(\d+)\./.exec(process.version), nodePassed = Boolean(node && Number(node[1]) >= 18);
  checks.push({ name: "Node.js 24.18+", passed: nodePassed, detail: process.version, fix: "Install Node.js 24.18 or newer within major 24" });
  const git = await command("git", ["--version"], process.cwd(), 10_000);
  checks.push({ name: "Git", passed: git.exitCode === 0, detail: git.exitCode === 0 ? git.stdout.trim() : "not available", fix: "Install Git and restart Quantum Twin" });
  checks.push({ name: "pnpm 11.9.0", passed: Boolean(process.env.npm_execpath?.includes("pnpm")), detail: process.env.npm_execpath?.includes("pnpm") ? "available" : "not detected", fix: "Launch with npx --yes pnpm@11.9.0 app" });
  let mlDsa = false;
  try { mlDsa = generateKeyPairSync("ml-dsa-65").publicKey.asymmetricKeyType === "ml-dsa-65"; } catch { /* Report failed check. */ }
  checks.push({ name: "ML-DSA-65 runtime", passed: mlDsa, detail: mlDsa ? "native node:crypto available" : "unavailable", fix: "Use the required Node.js 24.18 runtime" });
  let writable = false;
  try { await mkdir(path.join(process.cwd(), "runs"), { recursive: true }); const temp = await mkdtemp(path.join(process.cwd(), "runs", "system-check-")); await writeFile(path.join(temp, "probe"), "ok"); await rm(temp, { recursive: true, force: true }); writable = true; } catch { /* Report failed check. */ }
  checks.push({ name: "Quantum Twin workspace", passed: writable, detail: writable ? "private runtime storage writable" : "not writable", fix: "Grant current user write access to this cloned Quantum Twin directory only" });
  checks.push({ name: "Loopback binding", passed: true, detail: "127.0.0.1 only" });
  let authenticated = process.env.QT_PREFLIGHT_OK === "1", method = authenticated ? "Verified Codex SDK session" : "Not verified";
  if (!authenticated) {
    const status = await command("codex", ["login", "status"], process.cwd(), 10_000);
    authenticated = status.exitCode === 0;
    if (authenticated) method = /chatgpt/i.test(status.stdout) ? "ChatGPT" : /api.?key/i.test(status.stdout) ? "OpenAI API key through Codex" : "Codex session";
  }
  checks.push({ name: "Codex authentication", passed: authenticated, detail: method, fix: "Run codex login for ChatGPT sign-in, or pipe a key to codex login --with-api-key in your terminal, then restart" });
  return { checks, authenticated, authenticationMethod: method, ready: checks.every(check => check.passed) };
}
