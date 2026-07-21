import type { NextConfig } from "next";
// @openai/codex-sdk spawns a native Codex binary it locates via createRequire(import.meta.url).
// Bundling it breaks that lookup ("Unable to locate Codex CLI binaries"), so keep it external
// on the server — the SDK then resolves the binary (and its rg.exe PATH dirs) from node_modules.
const config: NextConfig = { turbopack: { root: import.meta.dirname }, serverExternalPackages: ["@openai/codex-sdk"] };
export default config;
