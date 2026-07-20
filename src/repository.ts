import { chmod, cp, lstat, mkdir, readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { command } from "./util.ts";

const SKIP = new Set([".git", "node_modules", "runs", "coverage", ".next", "dist", "build"]);

export function contained(root: string, target: string) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
export function safeRelativePath(value: string) {
  if (!value || value.includes("\0") || path.isAbsolute(value) || /^[A-Za-z]:/.test(value)) throw new Error("Path must be repository-relative");
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === ".." || /[<>:"|?*]/.test(segment) || /[. ]$/.test(segment) || WINDOWS_DEVICE.test(segment))) throw new Error("Path contains an unsafe segment");
  if (segments[0]!.toLowerCase() === ".git") throw new Error("Git metadata cannot be imported");
  return segments.join("/");
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
  if (/^https?:\/\//i.test(source)) throw new Error("Use Local Repository Lab public GitHub intake instead of a local source path");
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

export async function normalizeWritablePermissions(root: string, writablePaths: string[]) {
  const normalized: string[] = [];
  async function walk(target: string) {
    if (!contained(root, target)) throw new Error("Writable path escapes isolated repository");
    const info = await stat(target);
    if ((info.mode & 0o200) === 0) {
      await chmod(target, info.mode | 0o200);
      normalized.push(path.relative(root, target).replaceAll("\\", "/"));
    }
    if (info.isDirectory()) for (const entry of await readdir(target)) await walk(path.join(target, entry));
  }
  for (const relative of writablePaths) await walk(path.join(root, safeRelativePath(relative)));
  return normalized;
}
