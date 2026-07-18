import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);
export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export async function command(program: string, args: string[], cwd: string, timeout = 120_000) {
  const started = performance.now();
  const windowsPnpm = process.platform === "win32" && program === "pnpm";
  const executable = windowsPnpm ? (process.env.ComSpec ?? "cmd.exe") : program;
  const executableArgs = windowsPnpm ? ["/d", "/s", "/c", `pnpm ${args.map(arg => `"${arg.replaceAll('"', '""')}"`).join(" ")}`] : args;
  try {
    const result = await exec(executable, executableArgs, { cwd, timeout, windowsHide: true, maxBuffer: 10_000_000 });
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
