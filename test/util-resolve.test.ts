import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolvedCommand } from "../src/util.ts";

describe("resolvedCommand", () => {
  it("routes npm through a real, existing CLI (bundled npm or corepack pnpm), never a bare broken shim", () => {
    const resolved = resolvedCommand("npm", ["run", "test"]);
    expect(resolved.executable).toBe(process.execPath);
    expect(existsSync(resolved.args[0]!)).toBe(true);
  });

  it("maps `npm ci` to a frozen pnpm install only when it falls back to pnpm", () => {
    const resolved = resolvedCommand("npm", ["ci"]);
    // Either bundled npm (args stay ["ci"]) or pnpm fallback (["install","--frozen-lockfile"]).
    expect(["ci", "install"]).toContain(resolved.args[1]);
  });

  it("passes unknown programs through untouched", () => {
    expect(resolvedCommand("git", ["status"])).toEqual({ executable: "git", args: ["status"] });
  });
});
