import { Codex } from "@openai/codex-sdk";
import { statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// The Codex SDK finds its native binary via createRequire(import.meta.url).resolve(...).
// Next/Turbopack bundles the SDK, which breaks that lookup ("Unable to locate Codex CLI
// binaries"). We resolve the binary ourselves from real node_modules and hand it to the SDK
// through codexPathOverride, which skips the fragile lookup entirely. See dist/index.js in
// @openai/codex-sdk: resolveNativePackage (modern "bin" + legacy "codex" layouts).

const TRIPLE: Record<string, string> = {
  "linux-x64": "x86_64-unknown-linux-musl", "linux-arm64": "aarch64-unknown-linux-musl",
  "darwin-x64": "x86_64-apple-darwin", "darwin-arm64": "aarch64-apple-darwin",
  "win32-x64": "x86_64-pc-windows-msvc", "win32-arm64": "aarch64-pc-windows-msvc"
};

const isFile = (p: string) => { try { return statSync(p).isFile(); } catch { return false; } };
const isDir = (p: string) => { try { return statSync(p).isDirectory(); } catch { return false; } };

export function resolveCodex(): { executablePath: string; pathDirs: string[] } | null {
  const triple = TRIPLE[`${process.platform}-${process.arch}`];
  if (!triple) return null;
  const exe = process.platform === "win32" ? "codex.exe" : "codex";
  const platformPkg = `@openai/codex-${process.platform}-${process.arch}`;
  const require_ = createRequire(path.join(process.cwd(), "index.js"));
  const vendorRoots: string[] = [];
  // 1. Through the SDK's dependency chain, rooted at the real project node_modules (not a bundle).
  try {
    const codexPkg = require_.resolve("@openai/codex/package.json");
    vendorRoots.push(path.join(path.dirname(createRequire(codexPkg).resolve(`${platformPkg}/package.json`)), "vendor"));
  } catch { /* try the next root */ }
  // 2. A directly installed platform package.
  try { vendorRoots.push(path.join(path.dirname(require_.resolve(`${platformPkg}/package.json`)), "vendor")); } catch { /* try the next root */ }
  // 3. A global `npm i -g @openai/codex` on Windows.
  if (process.env.APPDATA) vendorRoots.push(path.join(process.env.APPDATA, "npm", "node_modules", "@openai", "codex", "node_modules", platformPkg, "vendor"));

  for (const vendor of vendorRoots) {
    const root = path.join(vendor, triple);
    const binExe = path.join(root, "bin", exe);
    if (isFile(binExe) && isFile(path.join(root, "codex-package.json"))) return { executablePath: binExe, pathDirs: [path.join(root, "codex-path")].filter(isDir) };
    const legacy = path.join(root, "codex", exe);
    if (isFile(legacy)) return { executablePath: legacy, pathDirs: [path.join(root, "path")].filter(isDir) };
  }
  return null;
}

// Drop-in replacement for `new Codex()` that always locates the binary. Falls back to the SDK's
// own resolution if our search misses, so nothing regresses on layouts we do not know about.
export function codexClient(): Codex {
  const found = resolveCodex();
  if (!found) return new Codex();
  if (!found.pathDirs.length) return new Codex({ codexPathOverride: found.executablePath });
  // Override env drops the SDK's default process.env copy, so rebuild it and prepend the PATH
  // dirs (rg.exe lives there) that codexPathOverride would otherwise skip.
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  const pathKey = process.platform === "win32" ? (Object.keys(env).find(key => key.toLowerCase() === "path") ?? "Path") : "PATH";
  env[pathKey] = [...found.pathDirs, env[pathKey] ?? ""].filter(Boolean).join(path.delimiter);
  return new Codex({ codexPathOverride: found.executablePath, env });
}
