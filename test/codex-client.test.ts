import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolveCodex, codexClient } from "../src/codex-client.ts";

describe("resolveCodex", () => {
  it("finds a real codex binary on this platform, or returns null without throwing", () => {
    const found = resolveCodex();
    if (found) {
      expect(existsSync(found.executablePath)).toBe(true);
      for (const dir of found.pathDirs) expect(existsSync(dir)).toBe(true);
    } else {
      expect(found).toBeNull();
    }
  });

  it("constructs a Codex client without the locate-binaries error", () => {
    expect(() => codexClient()).not.toThrow();
  });
});
