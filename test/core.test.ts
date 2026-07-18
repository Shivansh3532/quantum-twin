import { describe, expect, test } from "vitest";
import path from "node:path";
import { scanCrypto } from "../src/scanner.ts";
import { select } from "../src/engine.ts";

describe("deterministic core", () => {
  test("scanner identifies RSA sign and verify", async () => {
    const hits = await scanCrypto(path.join(process.cwd(), "fixture/src/signatures.ts"));
    expect(hits.map(h => h.operation).sort()).toEqual(["signing", "verification"]);
  });
  test("selection rejects failures and prefers fewer RSA signatures", () => {
    const candidate = (strategy: "direct"|"bridge", eligible: boolean, rsa: number) => ({ strategy, branch: strategy, threadId: "t", generationDurationMs: 1, repairAttempted: false, generationStatus: eligible ? "eligible" as const : "gate_failed" as const, worktreeCommit: "c", diffSha256: "d", diff: "", changedLines: strategy === "direct" ? 5 : 10, commands: [], gates: [{ name: "all", passed: eligible, detail: "" }], measurements: { rsaSignatures: rsa, envelopeBytes: 1, signMedianMs: 1, signP95Ms: 1, verifyMedianMs: 1, verifyP95Ms: 1 } });
    expect(select([candidate("direct", true, 0), candidate("bridge", true, 1)])).toBe("direct");
    expect(select([candidate("direct", false, 0), candidate("bridge", true, 1)])).toBe("bridge");
    expect(select([candidate("direct", false, 0), candidate("bridge", false, 1)])).toBeNull();
  });
});
