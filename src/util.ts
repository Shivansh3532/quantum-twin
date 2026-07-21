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

// Node's bundled corepack shim for pnpm/yarn/corepack (dist/<program>.js).
function corepackEntry(program: string) {
  const js = path.join(path.dirname(process.execPath), "node_modules", "corepack", "dist", `${program}.js`);
  return existsSync(js) ? js : undefined;
}

// Node's bundled npm/npx CLI, tried across Windows, Linux/mac prefix, and npm_execpath layouts,
// so a broken global `npm` shim on the host is bypassed entirely.
function npmCli(program: "npm" | "npx") {
  const cli = program === "npx" ? "npx-cli.js" : "npm-cli.js";
  const dir = path.dirname(process.execPath), execpath = process.env.npm_execpath;
  return [
    execpath && /npm-cli\.js$/i.test(execpath) ? path.join(path.dirname(execpath), cli) : undefined,
    path.join(dir, "node_modules", "npm", "bin", cli),
    path.join(dir, "..", "lib", "node_modules", "npm", "bin", cli)
  ].find((candidate): candidate is string => Boolean(candidate) && existsSync(candidate!));
}

// npm verbs → their pnpm equivalents for the broken-npm fallback (pnpm mirrors most).
function npmArgsToPnpm(args: string[]) { return args[0] === "ci" ? ["install", "--frozen-lockfile", ...args.slice(1)] : args; }

export function resolvedCommand(program: string, args: string[]) {
  if (program === "pnpm") { const entry = process.env.npm_execpath ?? corepackEntry("pnpm"); return entry ? { executable: process.execPath, args: [entry, ...args] } : { executable: program, args }; }
  if (program === "corepack") { const entry = corepackEntry("corepack"); return entry ? { executable: process.execPath, args: [entry, ...args] } : { executable: program, args }; }
  if (program === "npm" || program === "npx") {
    const cli = npmCli(program);
    if (cli) return { executable: process.execPath, args: [cli, ...args] };
    const pnpm = corepackEntry("pnpm"); // npm missing/broken → fall back to Node's bundled corepack pnpm
    if (pnpm) return { executable: process.execPath, args: [pnpm, ...(program === "npm" ? npmArgsToPnpm(args) : ["dlx", ...args])] };
  }
  return { executable: program, args };
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
