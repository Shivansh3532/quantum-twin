import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const exec = promisify(execFile);
export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export async function command(program: string, args: string[], cwd: string, timeout = 120_000) {
  const started = performance.now();
  const pnpmEntrypoint = program === "pnpm" ? process.env.npm_execpath : undefined;
  const npmCandidate = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", program === "npx" ? "npx-cli.js" : "npm-cli.js");
  const npmEntrypoint = ["npm", "npx"].includes(program) && existsSync(npmCandidate) ? npmCandidate : undefined;
  const entrypoint = pnpmEntrypoint ?? npmEntrypoint;
  const executable = entrypoint ? process.execPath : program;
  const executableArgs = entrypoint ? [entrypoint, ...args] : args;
  try {
    const result = await exec(executable, executableArgs, { cwd, timeout, windowsHide: true, maxBuffer: 10_000_000, shell: process.platform === "win32" && !pnpmEntrypoint && program === "pnpm" });
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
      else entries.push(`${sha256(await readFile(absolute))}  ${relative}`);
    }
  }
  await walk(root);
  return { text: entries.join("\n"), sha256: sha256(entries.join("\n")) };
}
