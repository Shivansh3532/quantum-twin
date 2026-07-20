import { describe, expect, test } from "vitest";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeIntake, clonePublicRepository, createFolderIntake, createGitHubIntake, createZipIntake, discardIntake, IntakeError, parseGitHubRepositoryUrl, readyIntake, validateAnalysisTree, type GitRunner } from "../src/intake.ts";
import { assertSafeTree, safeRelativePath } from "../src/repository.ts";
import type { QuantumTwinConfig } from "../src/config.ts";
import { POST as intakePost } from "../app/api/intake/route.ts";
import { POST as analyzePost } from "../app/api/intake/analyze/route.ts";
import { POST as validatePost } from "../app/api/intake/validate/route.ts";

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipEntry(name: string, data = Buffer.from("safe"), options: { encrypted?: boolean; mode?: number } = {}) {
  const file = Buffer.from(name), crc = crc32(data), flag = options.encrypted ? 1 : 0, mode = options.mode ?? 0o100644;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(flag, 6); local.writeUInt16LE(0, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(file.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(0x0314, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(flag, 8); central.writeUInt16LE(0, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(file.length, 28); central.writeUInt32LE((mode << 16) >>> 0, 38);
  const centralRecord = Buffer.concat([central, file]), localRecord = Buffer.concat([local, file, data]), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(centralRecord.length, 12); end.writeUInt32LE(localRecord.length, 16);
  return Buffer.concat([localRecord, centralRecord, end]);
}

describe("public repository intake", () => {
  test("accepts only canonical credential-free GitHub HTTPS URLs", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/OpenAI/example.git")).toEqual({ owner: "OpenAI", repository: "example", canonicalUrl: "https://github.com/OpenAI/example" });
    for (const value of ["http://github.com/a/b", "ssh://git@github.com/a/b", "git://github.com/a/b", "file:///tmp/a", "https://user:pass@github.com/a/b", "https://github.com:443/a/b", "https://127.0.0.1/a/b", "https://localhost/a/b", "https://gitlab.com/a/b", "https://github.com/a/b/extra", "https://github.com/a/b?q=1", "https://github.com/a/b#x", "https://github.com/a/../b"]) expect(() => parseGitHubRepositoryUrl(value)).toThrow(IntakeError);
  });

  test("clone uses argument arrays, no credentials, no redirects, no tags, and records commit", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "qt-clone-test-")), destination = path.join(parent, "repo"), calls: Array<{ args: string[]; environment: NodeJS.ProcessEnv }> = [];
    const previousGitDir = process.env.GIT_DIR; process.env.GIT_DIR = "unsafe-inherited-value";
    const runner: GitRunner = async (_program, args, _cwd, _timeout, environment) => {
      calls.push({ args, environment });
      if (args[0] === "rev-parse") return { exitCode: 0, stdout: `${"a".repeat(40)}\n`, stderr: "" };
      await mkdir(destination); await writeFile(path.join(destination, "package.json"), "{}");
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const result = await clonePublicRepository("https://github.com/owner/project", destination, { runner });
    if (previousGitDir === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = previousGitDir;
    expect(result.resolvedCommit).toBe("a".repeat(40));
    expect(calls[0]?.args).toEqual(expect.arrayContaining(["http.followRedirects=false", "--depth=1", "--no-tags", "--no-recurse-submodules"]));
    expect(calls[0]?.environment.GIT_TERMINAL_PROMPT).toBe("0");
    expect(calls[0]?.environment.GIT_CONFIG_NOSYSTEM).toBe("1");
    expect(calls[0]?.environment.GIT_DIR).toBeUndefined();
  });

  test("clone fails closed for timeout, missing Git, limits, and symlinks", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qt-clone-fail-"));
    await expect(clonePublicRepository("https://github.com/a/b", path.join(root, "timeout"), { runner: async () => ({ exitCode: 1, stdout: "", stderr: "", timedOut: true }) })).rejects.toMatchObject({ code: "clone_timeout", status: 504 });
    await expect(clonePublicRepository("https://github.com/a/b", path.join(root, "missing"), { runner: async () => ({ exitCode: 1, stdout: "", stderr: "", missing: true }) })).rejects.toMatchObject({ code: "git_missing", status: 503 });
    const oversized = path.join(root, "oversized");
    await expect(clonePublicRepository("https://github.com/a/b", oversized, { diskLimitBytes: 3, limits: { maxFiles: 1, maxFileBytes: 3, maxTotalBytes: 3 }, runner: async (_p, args) => { if (args[0] === "rev-parse") return { exitCode: 0, stdout: "a".repeat(40), stderr: "" }; await mkdir(oversized); await writeFile(path.join(oversized, "x"), "large"); return { exitCode: 0, stdout: "", stderr: "" }; } })).rejects.toThrow(/on disk/);
    const linked = path.join(root, "linked"), outside = await mkdtemp(path.join(os.tmpdir(), "qt-clone-outside-"));
    await expect(clonePublicRepository("https://github.com/a/b", linked, { runner: async (_p, args) => { if (args[0] === "rev-parse") return { exitCode: 0, stdout: "a".repeat(40), stderr: "" }; await mkdir(linked); await symlink(outside, path.join(linked, "escape"), "junction"); return { exitCode: 0, stdout: "", stderr: "" }; } })).rejects.toThrow(/Symlinks/);
  });

  test("analysis skips an oversized non-source fixture, reports it, and still scans source without executing", async () => {
    const runner: GitRunner = async (_program, args, _cwd) => {
      if (args[0] === "rev-parse") return { exitCode: 0, stdout: "b".repeat(40), stderr: "" };
      const destination = args.at(-1)!;
      await mkdir(path.join(destination, "src"), { recursive: true });
      await mkdir(path.join(destination, "tests"), { recursive: true });
      await writeFile(path.join(destination, "package.json"), JSON.stringify({ name: "oversized-analysis-fixture", type: "module" }));
      await writeFile(path.join(destination, "src", "crypto.ts"), 'import { sign, verify } from "node:crypto";\nsign("RSA-SHA256", data, key);\nverify("RSA-SHA256", data, key, signature);\n');
      await writeFile(path.join(destination, "tests", "nocks.db"), Buffer.alloc(2_000_001));
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const intake = await createGitHubIntake("https://github.com/example/oversized-analysis-fixture", "github", { runner });
    try {
      const analysis = await analyzeIntake(intake.id);
      expect(analysis.status).toBe("contract-missing");
      expect(analysis.skippedFiles).toEqual([{ path: "tests/nocks.db", size: 2_000_001, reason: "Skipped from analysis: non-source artifact exceeds source-file limit" }]);
      expect(analysis.report.supported.map(hit => hit.operation)).toEqual(expect.arrayContaining(["signing", "verification"]));
      await expect(readyIntake(intake.id)).rejects.toMatchObject({ code: "intake_not_ready", status: 409 });
    } finally { await discardIntake(intake.id); }
  });

  test("analysis rejects oversized source, config, and declared harness files precisely", async () => {
    const limits = { maxFiles: 20, maxFileBytes: 64, maxTotalBytes: 4_096 };
    const sourceRoot = await mkdtemp(path.join(os.tmpdir(), "qt-large-source-"));
    await writeFile(path.join(sourceRoot, "source.ts"), "x".repeat(65));
    await expect(validateAnalysisTree(sourceRoot, limits)).rejects.toThrow(/Oversized source code.*source\.ts/);

    const configRoot = await mkdtemp(path.join(os.tmpdir(), "qt-large-config-"));
    await writeFile(path.join(configRoot, "quantum-twin.config.json"), "x".repeat(65));
    await expect(validateAnalysisTree(configRoot, limits)).rejects.toThrow(/Oversized Quantum Twin configuration/);

    const harnessRoot = await mkdtemp(path.join(os.tmpdir(), "qt-large-harness-"));
    await writeFile(path.join(harnessRoot, "compatibility.bin"), "x".repeat(65));
    const config: QuantumTwinConfig = {
      version: 1, repository: { name: "fixture" }, sourcePrimitive: "RSA", includedSourceGlobs: ["src/**/*.ts"], excludedGlobs: [], writablePaths: ["src"], protectedPaths: ["test"], packageManager: "pnpm",
      commands: { install: ["pnpm", "install"], typecheck: ["pnpm", "typecheck"], test: ["pnpm", "test"] }, compatibilityHarness: "compatibility.bin", legacyCompatibilityRequired: true,
      target: { primitive: "ml-dsa-65", context: "quantum-twin:test:v1" }, dependencyPolicy: "forbid", timeouts: { scanMs: 1_000, commandMs: 1_000, candidateMs: 10_000 }, limits
    };
    await expect(validateAnalysisTree(harnessRoot, limits, config)).rejects.toThrow(/Oversized declared compatibility harness.*compatibility\.bin/);

    const skippedRoot = await mkdtemp(path.join(os.tmpdir(), "qt-large-irrelevant-"));
    await writeFile(path.join(skippedRoot, "fixture.db"), "x".repeat(65));
    await expect(validateAnalysisTree(skippedRoot, limits)).resolves.toEqual([{ path: "fixture.db", size: 65, reason: "Skipped from analysis: non-source artifact exceeds source-file limit" }]);
    await expect(assertSafeTree(skippedRoot, limits)).rejects.toThrow(/File exceeds size limit: fixture\.db/);
  });
});

describe("local import safety", () => {
  test("path validation rejects traversal, absolute paths, devices, nulls, and Git metadata", () => {
    expect(safeRelativePath("src/file.ts")).toBe("src/file.ts");
    for (const value of ["../escape", "/absolute", "C:\\escape", "src/CON", "src/bad?.ts", "src/end. ", "src/\0x", ".git/config"]) expect(() => safeRelativePath(value)).toThrow();
  });

  test("folder import rejects normalized collisions and analysis never executes code", async () => {
    await expect(createFolderIntake([{ relativePath: "A.ts", data: Buffer.from("a") }, { relativePath: "a.ts", data: Buffer.from("b") }])).rejects.toMatchObject({ code: "path_collision" });
    const intake = await createFolderIntake([{ relativePath: "src/index.ts", data: Buffer.from('throw new Error("must never execute during analysis")') }], "no-contract");
    try {
      const analysis = await analyzeIntake(intake.id);
      expect(analysis.status).toBe("contract-missing");
      expect(analysis.message).toMatch(/Automatic migration is unavailable/);
    } finally { await discardIntake(intake.id); }
  });

  test("ZIP import rejects traversal, encrypted entries, symlinks, and nested archives", async () => {
    await expect(createZipIntake(zipEntry("../escape.ts"))).rejects.toThrow();
    await expect(createZipIntake(zipEntry("secret.ts", Buffer.from("x"), { encrypted: true }))).rejects.toThrow(/Encrypted|encrypted/);
    await expect(createZipIntake(zipEntry("link", Buffer.from("target"), { mode: 0o120777 }))).rejects.toThrow(/symlinks|special/i);
    await expect(createZipIntake(zipEntry("nested.zip"))).rejects.toThrow(/Nested archives/);
    const intake = await createZipIntake(zipEntry("src/index.ts", Buffer.from("export {};")), "safe.zip");
    try { expect((await analyzeIntake(intake.id)).status).toBe("contract-missing"); }
    finally { await discardIntake(intake.id); }
  });

  test("hosted intake and analysis endpoints fail closed", async () => {
    const previous = process.env.VERCEL; process.env.VERCEL = "1";
    try {
      expect((await intakePost(new Request("http://localhost/api/intake", { method: "POST", body: "{}" }))).status).toBe(403);
      expect((await analyzePost(new Request("http://localhost/api/intake/analyze", { method: "POST", body: "{}" }))).status).toBe(403);
      expect((await validatePost(new Request("http://localhost/api/intake/validate", { method: "POST", body: "{}" }))).status).toBe(403);
    } finally { if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous; }
  });

  test("URL validation endpoint returns structured client errors", async () => {
    const response = await validatePost(new Request("http://localhost/api/intake/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "http://github.com/a/b" }) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_url" });
  });
});
