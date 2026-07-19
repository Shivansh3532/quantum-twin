import { describe, expect, test } from "vitest";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import { scanCrypto, scanRepository } from "../src/scanner.ts";
import { select } from "../src/engine.ts";
import { manifest, sha256 } from "../src/util.ts";
import { quantumTwinConfigSchema, detectPackageManager } from "../src/config.ts";
import { assertSafeTree, contained } from "../src/repository.ts";
import { isRecordedMode } from "../src/mode.ts";
import { POST } from "../app/api/runs/route.ts";

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
  test("sample report and evaluator hashes verify", async () => {
    const report = JSON.parse(await readFile(path.join(process.cwd(), "sample/run.json"), "utf8"));
    const expected = report.reportSha256;
    delete report.reportSha256;
    expect(sha256(JSON.stringify(report, null, 2))).toBe(expected);
    expect((await manifest(path.join(process.cwd(), "evaluator"))).sha256).toBe(report.verifierManifestSha256);
  });
});

describe("general repository boundary", () => {
  test("recursive scanner handles named, namespace, CommonJS, and createSign forms without generic false positives", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qt-scan-"));
    await mkdir(path.join(root, "src", "nested"), { recursive: true });
    await writeFile(path.join(root, "src", "named.ts"), 'import { sign as rsaSign } from "node:crypto"; rsaSign("sha256", data, key); function sign() { return true; }');
    await writeFile(path.join(root, "src", "nested", "namespace.js"), 'import * as crypto from "node:crypto"; crypto.verify("RSA-SHA384", data, key, sig);');
    await writeFile(path.join(root, "src", "common.cjs"), 'const { createSign: makeSigner } = require("crypto"); makeSigner("RSA-SHA512");');
    const hits = await scanRepository(root);
    expect(hits.map(hit => hit.importForm).sort()).toEqual(["commonjs", "named", "namespace"]);
    expect(hits.some(hit => hit.snippet === "sign()" )).toBe(false);
  });

  test("ambiguous crypto blocks and discovery-only systems name required adapters", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qt-discovery-"));
    await writeFile(path.join(root, "ambiguous.ts"), 'import { sign } from "node:crypto"; sign(algorithm, data, key);');
    await writeFile(path.join(root, "service.py"), 'from cryptography.hazmat.primitives import hashes');
    const hits = await scanRepository(root);
    expect(hits.find(hit => hit.status === "unknown")?.technology).toContain("ambiguous");
    expect(hits.find(hit => hit.technology === "Python cryptography")?.requiredAdapter).toBe("Python repository adapter");
  });

  test("config rejects traversal and unsafe command strings", () => {
    const base = {
      version: 1, repository: { name: "fixture" }, includedSourceGlobs: ["src/*.ts"], excludedGlobs: [], writablePaths: ["src/a.ts"], protectedPaths: ["test/a.ts"], packageManager: "pnpm",
      commands: { install: ["pnpm", "install"], typecheck: ["pnpm", "typecheck"], test: ["pnpm", "test"] }, compatibilityHarness: "harness.ts", legacyCompatibilityRequired: true,
      target: { primitive: "ml-dsa-65", context: "quantum-twin:test:v1" }, dependencyPolicy: "forbid", timeouts: { scanMs: 1000, commandMs: 1000, candidateMs: 10000 }, limits: { maxFiles: 10, maxFileBytes: 1024, maxTotalBytes: 2048 }
    };
    expect(quantumTwinConfigSchema.parse(base).commands.install).toEqual(["pnpm", "install"]);
    expect(() => quantumTwinConfigSchema.parse({ ...base, writablePaths: ["../escape.ts"] })).toThrow(/contained/);
    expect(() => quantumTwinConfigSchema.parse({ ...base, commands: { ...base.commands, install: "pnpm install" } })).toThrow();
  });

  test("path containment and symlink rejection protect copied repositories", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qt-tree-")), outside = await mkdtemp(path.join(os.tmpdir(), "qt-outside-"));
    await writeFile(path.join(root, "safe.ts"), "export {};");
    await symlink(outside, path.join(root, "escape"), "junction");
    expect(contained(root, path.join(root, "safe.ts"))).toBe(true);
    expect(contained(root, path.join(root, "..", "escape.ts"))).toBe(false);
    await expect(assertSafeTree(root)).rejects.toThrow(/Symlinks/);
  });

  test("package managers and recorded boundary are deterministic", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qt-manager-"));
    await writeFile(path.join(root, "package-lock.json"), "{}");
    expect(detectPackageManager(root)).toBe("npm");
    expect(isRecordedMode({ VERCEL: "1" })).toBe(true);
    expect(isRecordedMode({ QT_RECORDED_MODE: "1" })).toBe(true);
    expect(isRecordedMode({})).toBe(false);
  });

  test("Vercel POST is always read-only without checking OPENAI_API_KEY", async () => {
    const previous = process.env.VERCEL;
    process.env.VERCEL = "1";
    try {
      const response = await POST(new Request("http://localhost/api/runs", { method: "POST", body: "{}" }));
      expect(response.status).toBe(403);
    } finally { if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous; }
  });

  test("local API validates repository input before execution", async () => {
    const previousVercel = process.env.VERCEL, previousRecorded = process.env.QT_RECORDED_MODE;
    delete process.env.VERCEL; delete process.env.QT_RECORDED_MODE;
    try {
      const missingConfig = await POST(new Request("http://localhost/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repositoryPath: "fixture" }) }));
      expect(missingConfig.status).toBe(400);
      const noAcknowledgment = await POST(new Request("http://localhost/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repositoryPath: "fixture", configPath: "fixture/quantum-twin.config.json" }) }));
      expect(noAcknowledgment.status).toBe(400);
    } finally {
      if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
      if (previousRecorded === undefined) delete process.env.QT_RECORDED_MODE; else process.env.QT_RECORDED_MODE = previousRecorded;
    }
  });
});
