import { describe, expect, test } from "vitest";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import { scanCrypto, scanRepository } from "../src/scanner.ts";
import { select } from "../src/engine.ts";
import { command, fileSha256, sha256 } from "../src/util.ts";
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
  test("sample report hash verifies and text hashes are cross-platform", async () => {
    const report = JSON.parse(await readFile(path.join(process.cwd(), "sample/run.json"), "utf8"));
    const expected = report.presentationReportSha256;
    delete report.presentationReportSha256;
    expect(sha256(JSON.stringify(report, null, 2))).toBe(expected);
    expect(report.sourceReportSha256).toBe("b994bcee601b93c35a20939ca30ced73f43d257f09287875a1fc260aef877761");
    expect(report.redaction).toMatchObject({ applied: true, scope: "local filesystem path only", byteIdenticalToSourceReport: false });
    expect(fileSha256(Buffer.from("portable\r\ntext\r\n"))).toBe(fileSha256(Buffer.from("portable\ntext\n")));
  });
  test("tracked files contain no absolute Windows user paths", async () => {
    const tracked = await command("git", ["ls-files", "-z"], process.cwd());
    expect(tracked.exitCode).toBe(0);
    const prefixes = [["C:", "Users"].join("\\") + "\\", ["C:", "Users"].join("/") + "/"];
    const hits: string[] = [];
    for (const file of tracked.stdout.split("\0").filter(Boolean)) {
      const content = await readFile(path.join(process.cwd(), file), "utf8");
      if (prefixes.some(prefix => content.includes(prefix))) hits.push(file);
    }
    expect(hits).toEqual([]);
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

  test("capability intake does not require package.json for discovery-only code", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qt-python-"));
    await writeFile(path.join(root, "signer.py"), "from cryptography.hazmat.primitives import hashes");
    const { inspectRepository } = await import("../src/capabilities.ts");
    const { report } = await inspectRepository(root);
    expect(report.discoveryOnly[0]?.technology).toBe("Python cryptography");
    expect(report.repository.source).toBe(`local:${path.basename(root)}`);
    expect(report.automaticMigrationSupported).toBe(false);
    expect(report.configuration).toBe("needed");
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
    expect(() => quantumTwinConfigSchema.parse({ ...base, writablePaths: ["test"] })).toThrow(/overlap/);
  });

  test("command arguments are passed without shell interpolation", async () => {
    const marker = "literal; echo not-executed";
    const result = await command(process.execPath, ["-e", "console.log(process.argv[1])", marker], process.cwd());
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(marker);
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
