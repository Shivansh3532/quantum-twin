import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const exec = promisify(execFile);
export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const fileSha256 = (value: Buffer) => sha256(value.includes(0) ? value : value.toString("utf8").replaceAll("\r\n", "\n"));

export function safeCommandEnvironment(additions: Partial<NodeJS.ProcessEnv> = {}) {
  const environment = {} as NodeJS.ProcessEnv;
  for (const name of ["PATH", "Path", "PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "COMSPEC", "LANG", "LC_ALL", "CI", "NO_COLOR", "NODE_EXTRA_CA_CERTS"]) if (process.env[name] !== undefined) environment[name] = process.env[name];
  return { ...environment, ...additions } as NodeJS.ProcessEnv;
}

export function resolvedCommand(program: string, args: string[]) {
  const nodeModules = path.join(path.dirname(process.execPath), "node_modules");
  const corepack = path.join(nodeModules, "corepack", "dist", `${program}.js`);
  const npm = path.join(nodeModules, "npm", "bin", program === "npx" ? "npx-cli.js" : "npm-cli.js");
  const entrypoint = program === "pnpm" ? process.env.npm_execpath ?? (existsSync(corepack) ? corepack : undefined) : program === "corepack" ? (existsSync(path.join(nodeModules, "corepack", "dist", "corepack.js")) ? path.join(nodeModules, "corepack", "dist", "corepack.js") : undefined) : ["npm", "npx"].includes(program) && existsSync(npm) ? npm : undefined;
  return entrypoint ? { executable: process.execPath, args: [entrypoint, ...args] } : { executable: program, args };
}

export async function command(program: string, args: string[], cwd: string, timeout = 120_000, environment?: NodeJS.ProcessEnv) {
  const started = performance.now();
  const resolved = resolvedCommand(program, args);
  try {
    const result = await exec(resolved.executable, resolved.args, { cwd, timeout, windowsHide: true, maxBuffer: 10_000_000, shell: false, env: environment });
    return { command: [program, ...args].join(" "), exitCode: 0, stdout: result.stdout, stderr: result.stderr, durationMs: Math.round(performance.now() - started) };
  } catch (error) {
    const e = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number };
    return { command: [program, ...args].join(" "), exitCode: typeof e.code === "number" ? e.code : 1, stdout: e.stdout ?? "", stderr: e.stderr || e.message, durationMs: Math.round(performance.now() - started) };
  }
}

export async function manifest(root: string) {
  const entries: string[] = [];
  async function walk(dir: string) {
    for (const name of (await readdir(dir)).sort()) {
      if (name === ".git" || name === "node_modules") continue;
      const absolute = path.join(dir, name);
      const relative = path.relative(root, absolute).replaceAll("\\", "/");
      if ((await stat(absolute)).isDirectory()) await walk(absolute);
      else entries.push(`${fileSha256(await readFile(absolute))}  ${relative}`);
    }
  }
  await walk(root);
  return { text: entries.join("\n"), sha256: sha256(entries.join("\n")) };
}
