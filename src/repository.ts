import { cp, lstat, mkdir, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { command } from "./util.ts";

const SKIP = new Set([".git", "node_modules", "runs", "coverage", ".next", "dist", "build"]);

export function contained(root: string, target: string) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function assertSafeTree(root: string, limits = { maxFiles: 5_000, maxFileBytes: 2_000_000, maxTotalBytes: 50_000_000 }) {
  const base = await realpath(root);
  let files = 0, bytes = 0;
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) throw new Error(`Symlinks are not accepted: ${path.relative(base, absolute)}`);
      if (!contained(base, absolute)) throw new Error(`Path escapes repository: ${absolute}`);
      if (info.isDirectory()) await walk(absolute);
      else {
        files++;
        bytes += info.size;
        if (files > limits.maxFiles) throw new Error(`Repository exceeds ${limits.maxFiles} files`);
        if (info.size > limits.maxFileBytes) throw new Error(`File exceeds size limit: ${path.relative(base, absolute)}`);
        if (bytes > limits.maxTotalBytes) throw new Error(`Repository exceeds ${limits.maxTotalBytes} scanned bytes`);
      }
    }
  }
  await walk(base);
  return { files, bytes };
}

export async function sourceIdentity(source: string) {
  if (/^https?:\/\//i.test(source)) throw new Error("Public GitHub URL ingestion is P1 and is not enabled in this verified P0");
  const root = await realpath(path.resolve(source));
  let packageName: string | undefined;
  try { packageName = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).name; } catch { /* Discovery-only repositories need no Node manifest. */ }
  const git = await command("git", ["rev-parse", "HEAD"], root, 10_000);
  return { root, name: packageName ?? path.basename(root), resolvedCommit: git.exitCode === 0 ? git.stdout.trim() : null };
}

export async function copyRepository(source: string, destination: string, limits?: Parameters<typeof assertSafeTree>[1]) {
  const identity = await sourceIdentity(source);
  await assertSafeTree(identity.root, limits);
  await mkdir(destination, { recursive: true });
  await cp(identity.root, destination, {
    recursive: true,
    filter: item => !SKIP.has(path.basename(item))
  });
  await assertSafeTree(destination, limits);
  return identity;
}
