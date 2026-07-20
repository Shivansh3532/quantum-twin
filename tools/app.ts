import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { preflight } from "../src/preflight.ts";

const root = process.cwd();

export function assertLauncherRuntime(version = process.version, packageManager = process.env.npm_execpath) {
  const match = version.match(/^v24\.(\d+)\./);
  if (!match || Number(match[1]) < 18) throw new Error(`Node.js 24.18 or newer within major 24 is required; found ${version}`);
  if (!packageManager?.toLowerCase().includes("pnpm")) throw new Error("Launch with npx --yes pnpm@11.9.0 app");
}

export async function findAvailablePort(start = 3000) {
  for (let port = start; port < start + 100; port++) {
    const available = await new Promise<boolean>(resolve => { const server = createServer(); server.once("error", () => resolve(false)); server.listen(port, "127.0.0.1", () => server.close(() => resolve(true))); });
    if (available) return port;
  }
  throw new Error("No available loopback port found");
}

async function newestSource(directory: string): Promise<number> {
  let newest = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", ".next", "runs", ".git", "graphify-out"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? await newestSource(target) : (await stat(target)).mtimeMs);
  }
  return newest;
}

export async function buildRequired() {
  try { return (await stat(path.join(root, ".next", "BUILD_ID"))).mtimeMs < await newestSource(root); }
  catch { return true; }
}

export function browserCommand(url: string, platform = process.platform) {
  if (platform === "win32") return { program: "explorer.exe", args: [url] };
  if (platform === "darwin") return { program: "open", args: [url] };
  return { program: "xdg-open", args: [url] };
}

function runPnpm(script: string) {
  const entrypoint = process.env.npm_execpath;
  if (!entrypoint) throw new Error("Launch through npx --yes pnpm@11.9.0 app");
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint, script], { cwd: root, stdio: "inherit", shell: false, windowsHide: true });
    child.once("error", reject); child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${script} failed with exit ${code}`)));
  });
}

export async function launch() {
  assertLauncherRuntime();
  console.log("Quantum Twin system check and Codex authentication…");
  const result = await preflight();
  if (result.authentication.codexSdk !== "authenticated" || !result.crypto.verify) throw new Error("Preflight failed closed");
  if (await buildRequired()) { console.log("Building production application…"); await runPnpm("build"); }
  const port = await findAvailablePort(), url = `http://127.0.0.1:${port}`;
  console.log(`Quantum Twin Repository Lab: ${url}`);
  const next = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [next, "start", "-H", "127.0.0.1", "-p", String(port)], { cwd: root, stdio: "inherit", shell: false, windowsHide: true, env: { ...process.env, QT_PREFLIGHT_OK: "1" } });
  const stop = () => child.kill("SIGINT"); process.once("SIGINT", stop); process.once("SIGTERM", stop);
  if (process.env.QT_NO_OPEN !== "1") setTimeout(() => { const open = browserCommand(url); const browser = spawn(open.program, open.args, { detached: true, stdio: "ignore", shell: false, windowsHide: true }); browser.once("error", () => undefined); browser.unref(); }, 1_200);
  await new Promise<void>((resolve, reject) => { child.once("error", reject); child.once("exit", code => code === 0 || code === null ? resolve() : reject(new Error(`Next.js exited with ${code}`))); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) launch().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
