import { describe, expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { approveSystemContract, assertContractApproved, createSystemBundle } from "../src/system-bundle.ts";
import { decryptKemDem, encryptKemDem, generateMlDsaSigner, generateMlKemRecipient, signMlDsa, verifyMlDsa, type KemDemEnvelope } from "../src/crypto-boundaries.ts";
import { traceCryptoCommand } from "../src/runtime-trace.ts";
import { validateSupportMatrix } from "../src/support.ts";
import { analyzeSystemIntakes, approveAnalyzedSystem, createFolderIntake, discardIntake } from "../src/intake.ts";
import { assembleSystem, establishBaseline, runSystemPass } from "../src/system-execution.ts";
import { rm } from "node:fs/promises";
import { runSystemTournament, selectSystemCandidate, type CandidateBuilder, type SystemCandidate } from "../src/system-engine.ts";
import { createSystemEvidenceBundle } from "../src/system-export.ts";
import { createCoordinatedLocalBranches } from "../src/system-export.ts";
import { command } from "../src/util.ts";

async function repository(name: string, manager: "npm" | "pnpm" | "yarn" = "npm") {
  const root = await mkdtemp(path.join(os.tmpdir(), `qt-${name}-`));
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name, type: "module", scripts: { build: "node --check src/index.js", test: "node src/index.js" }, main: "src/index.js" }));
  await writeFile(path.join(root, manager === "npm" ? "package-lock.json" : manager === "pnpm" ? "pnpm-lock.yaml" : "yarn.lock"), manager === "npm" ? JSON.stringify({ name, lockfileVersion: 3, requires: true, packages: { "": { name } } }) : "lockfileVersion: '9.0'\n");
  await writeFile(path.join(root, "src/index.js"), 'import { sign, verify } from "node:crypto"; export const produce = (data, key) => sign("RSA-SHA256", data, key); export const consume = (data, key, signature) => verify("RSA-SHA256", data, key, signature);\n');
  return root;
}

describe("system bundle and synthesized contract", () => {
  test("support matrix refuses unproven fully-supported claims", () => {
    expect(validateSupportMatrix()).toBe(true);
  });

  test("public live-system presentation evidence is redacted and hash-verifiable", async () => {
    const artifact = JSON.parse(await readFile(path.join(process.cwd(), "evidence", "system-demo-run.json"), "utf8")) as Record<string, unknown>;
    const presentationHash = artifact.presentationReportSha256; delete artifact.presentationReportSha256;
    const { sha256 } = await import("../src/util.ts");
    expect(sha256(JSON.stringify(artifact))).toBe(presentationHash);
    expect((artifact.presentation as { sourceReportSha256: string }).sourceReportSha256).toBe("4b488bcc8eb69d8d149390e0a9cc82b3673edf2ba54146dacd6525efb0a9af16");
    expect(JSON.stringify(artifact)).not.toMatch(/[A-Za-z]:[\\/]Users[\\/]|C:\/Users\/|\/home\/[^/]+\//i);
    expect(artifact.selectedCandidate).toBe("bridge");
  });

  test("contract-free intake can combine repositories and requires exact hash approval", async () => {
    const source = 'import { sign, verify } from "node:crypto"; sign("RSA-SHA256", data, rsaPrivateKey); verify("RSA-SHA256", data, rsaPublicKey, signature);';
    const first = await createFolderIntake([{ relativePath: "package.json", data: Buffer.from('{"name":"producer","type":"module"}') }, { relativePath: "src/index.js", data: Buffer.from(source) }], "producer");
    const second = await createFolderIntake([{ relativePath: "package.json", data: Buffer.from('{"name":"consumer","type":"module"}') }, { relativePath: "src/index.js", data: Buffer.from(source) }], "consumer");
    try {
      const analysis = await analyzeSystemIntakes("orders", [first.id, second.id], ["mobile-v1"]);
      expect(analysis.status).toBe("review-required");
      expect(analysis.bundle.repositories).toHaveLength(2);
      await expect(approveAnalyzedSystem("orders", [first.id, second.id], "0".repeat(64), ["mobile-v1"])).rejects.toMatchObject({ code: "contract_changed" });
      const approved = await approveAnalyzedSystem("orders", [first.id, second.id], analysis.contract.sha256, ["mobile-v1"]);
      expect(approved.contract.approved).toBe(true);
    } finally { await discardIntake(first.id); await discardIntake(second.id); }
  });
  test("one and multiple repositories produce a contract without a prewritten config", async () => {
    const producer = await repository("producer", "npm"), consumer = await repository("consumer", "pnpm");
    const bundle = await createSystemBundle("orders", [{ root: producer, id: "producer" }, { root: consumer, id: "consumer" }], { frozenConsumers: ["mobile-v1"], now: "2026-01-01T00:00:00.000Z" });
    expect(bundle.repositories.map(item => item.packageManager)).toEqual(["npm", "pnpm"]);
    expect(bundle.contract.commands.value["producer:install"]).toEqual(["npm", "ci"]);
    expect(bundle.contract.repositories.provenance).toBe("observed-source");
    expect(bundle.graph.staticFindings.filter(item => item.status === "supported")).toHaveLength(4);
    expect(bundle.graph.edges.some(edge => edge.kind === "frozen-compatibility")).toBe(true);
    expect(bundle.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(() => assertContractApproved(bundle.contract)).toThrow(/explicit review/);
    const approved = approveSystemContract(bundle.contract);
    expect(() => assertContractApproved(approved)).not.toThrow();
    expect(approved.sha256).not.toBe(bundle.contract.sha256);
    expect(() => assertContractApproved({ ...approved, approved: false })).toThrow(/review and approval/);
    expect(() => assertContractApproved({ ...approved, systemName: { ...approved.systemName, value: "tampered" } })).toThrow(/hash is invalid/);
  });

  test("Yarn is detected and its frozen install is inferred", async () => {
    const root = await repository("yarn-service", "yarn");
    const bundle = await createSystemBundle("yarn system", [{ root }]);
    expect(bundle.repositories[0]?.packageManager).toBe("yarn");
    expect(bundle.repositories[0]?.commands.install).toEqual(["corepack", "yarn", "install", "--immutable"]);
  });

  test("mixed ESM/CommonJS scheduled worker is discovered without a prewritten contract", async () => {
    const root = path.join(process.cwd(), "proof-systems", "worker-mixed-npm"), bundle = await createSystemBundle("worker", [{ root, id: "worker" }]);
    expect(bundle.repositories[0]?.moduleType).toBe("mixed");
    expect(bundle.components[0]?.kind).toBe("worker");
    expect(bundle.graph.staticFindings.filter(item => item.status === "supported")).toHaveLength(2);
  });

  test("approved contract runs a clean isolated baseline with runtime crypto metadata", async () => {
    const root = await repository("baseline", "npm");
    await writeFile(path.join(root, "src/index.js"), 'import {generateKeyPairSync,sign,verify} from "node:crypto"; const k=generateKeyPairSync("rsa",{modulusLength:2048}); const data=Buffer.from("workflow"); const signature=sign("RSA-SHA256",data,k.privateKey); if(!verify("RSA-SHA256",data,k.publicKey,signature)) process.exit(2);\n');
    const bundle = await createSystemBundle("baseline", [{ root, id: "repository" }]);
    const contract = approveSystemContract(bundle.contract);
    const baseline = await establishBaseline(bundle.repositories, contract);
    expect(baseline.result.gates.every(gate => gate.passed)).toBe(true);
    expect(baseline.result.runtimeEvents.map(event => event.operation)).toEqual(["sign", "verify"]);
    const assembled = await assembleSystem(bundle.repositories);
    try {
      const first = await runSystemPass(assembled, contract, 1), second = await runSystemPass(assembled, contract, 2);
      expect(first.gates.at(-1)?.passed).toBe(true);
      expect(second.gates.at(-1)?.passed).toBe(true);
    } finally { await rm(assembled, { recursive: true, force: true }); }
  }, 30_000);

  test("coordinated tournament selects bridge for a frozen consumer and refuses failed candidates", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qt-tournament-fixture-"));
    await mkdir(path.join(root, "src")); await mkdir(path.join(root, "test"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "tournament", type: "module", scripts: { test: "node test/system.test.js" }, main: "src/index.js" }));
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ name: "tournament", lockfileVersion: 3, requires: true, packages: { "": { name: "tournament" } } }));
    await writeFile(path.join(root, "src/index.js"), 'import {generateKeyPairSync,sign,verify} from "node:crypto"; export function run(){const k=generateKeyPairSync("rsa",{modulusLength:2048});const d=Buffer.from("workflow");return verify("RSA-SHA256",d,k.publicKey,sign("RSA-SHA256",d,k.privateKey));}\n');
    await writeFile(path.join(root, "test/system.test.js"), 'import {run} from "../src/index.js"; if(!run()) process.exit(2); // protected cases: tampered data, tampered signature, wrong public key, wrong context, truncated signature, downgrade attempt\n');
    const created = await createSystemBundle("tournament", [{ root, id: "repository" }], { frozenConsumers: ["frozen-rsa-v1"] });
    const bundle = { ...created, contract: approveSystemContract(created.contract) };
    const direct = 'import {generateKeyPairSync,sign,verify} from "node:crypto"; const context=Buffer.from("quantum-twin:update-manifest:v1"); export function run(){const k=generateKeyPairSync("ml-dsa-65");const d=Buffer.from("workflow");return verify(null,d,{key:k.publicKey,context},sign(null,d,{key:k.privateKey,context}));}\n';
    const bridge = 'import {generateKeyPairSync,sign,verify} from "node:crypto"; const context=Buffer.from("quantum-twin:update-manifest:v1"); export function run(){const pq=generateKeyPairSync("ml-dsa-65");const rsa=generateKeyPairSync("rsa",{modulusLength:2048});const d=Buffer.from("workflow");const current=verify(null,d,{key:pq.publicKey,context},sign(null,d,{key:pq.privateKey,context}));const legacy=verify("RSA-SHA256",d,rsa.publicKey,sign("RSA-SHA256",d,rsa.privateKey));return current&&legacy;}\n';
    const builder: CandidateBuilder = async (strategy, worktree) => { await writeFile(path.join(worktree, "repositories/repository/src/index.js"), strategy === "direct" ? direct : bridge); return { threadId: `fake-${strategy}`, status: "generated", durationMs: 1 }; };
    const report = await runSystemTournament(bundle, { allowExec: true, builder });
    expect(report.selectedCandidate).toBe("bridge");
    expect(report.candidates.find(candidate => candidate.strategy === "direct")?.gates.find(gate => gate.name === "strategy contract")?.passed).toBe(false);
    expect(report.candidates.find(candidate => candidate.strategy === "bridge")?.passes).toHaveLength(2);
    expect(report.observedGraph.runtimeEvents.length).toBeGreaterThan(0);
    expect(report.observedGraph.edges.some(edge => edge.evidence.includes("observed-runtime"))).toBe(true);
    expect(report.candidates.find(candidate => candidate.strategy === "bridge")?.gates.find(gate => gate.name === "rollback")?.passed).toBe(true);
    expect(report.candidates.find(candidate => candidate.strategy === "bridge")?.gates.find(gate => gate.name === "performance budget")?.passed).toBe(true);
    const failed = (strategy: "direct" | "bridge"): SystemCandidate => ({ strategy, threadId: null, generationStatus: "failed", generationDurationMs: 0, commit: null, diff: "", diffSha256: "", changedFiles: [], changedRepositories: [], gates: [], passes: [], eligible: false });
    expect(selectSystemCandidate([failed("direct"), failed("bridge")])).toBeNull();
  }, 60_000);

  test("ML-KEM envelope fixture migrates to native ML-KEM-768 KEM-DEM and selects direct", async () => {
    const root = path.join(process.cwd(), "proof-systems", "ml-kem-envelope-npm"), created = await createSystemBundle("envelope", [{ root, id: "envelope" }]);
    expect(created.contract.boundaries.value).toEqual(["ml-kem-768-kem-dem"]);
    const bundle = { ...created, contract: approveSystemContract(created.contract) };
    const migrated = 'import {generateKeyPairSync,encapsulate,decapsulate,hkdfSync,randomBytes,createCipheriv,createDecipheriv} from "node:crypto";const context="quantum-twin:kem-dem-envelope:v1";const derive=s=>Buffer.from(hkdfSync("sha256",s,Buffer.alloc(0),Buffer.from(context),32));export function generateRecipient(){return generateKeyPairSync("ml-kem-768")}export function encrypt(data,publicKey){const kem=encapsulate(publicKey),nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",derive(kem.sharedKey),nonce);cipher.setAAD(Buffer.from(context));const ciphertext=Buffer.concat([cipher.update(data),cipher.final()]);return{version:"qt-kem-dem-v1",context,encapsulatedKey:kem.ciphertext,nonce,ciphertext,tag:cipher.getAuthTag()}}export function decrypt(envelope,privateKey){if(envelope.version!=="qt-kem-dem-v1"||envelope.context!==context)throw new Error("downgrade");const shared=decapsulate(privateKey,envelope.encapsulatedKey),cipher=createDecipheriv("aes-256-gcm",derive(shared),envelope.nonce);cipher.setAAD(Buffer.from(context));cipher.setAuthTag(envelope.tag);return Buffer.concat([cipher.update(envelope.ciphertext),cipher.final()])}\n';
    const builder: CandidateBuilder = async (strategy, worktree) => { await writeFile(path.join(worktree, "repositories/envelope/src/envelope.js"), migrated); return { threadId: `fake-kem-${strategy}`, status: "generated", durationMs: 1 }; };
    const report = await runSystemTournament(bundle, { allowExec: true, builder });
    expect(report.selectedCandidate).toBe("direct");
    expect(report.candidates.every(candidate => candidate.gates.find(gate => gate.name === "ML-KEM-768 KEM-DEM adapter")?.passed)).toBe(true);
    expect(JSON.stringify(report.candidates.flatMap(candidate => candidate.passes).flatMap(pass => pass.runtimeEvents))).not.toContain("envelope-workflow");
  }, 60_000);

  test("multi-repository direct cutover changes every controlled producer and consumer together", async () => {
    const root = path.join(process.cwd(), "proof-systems", "multi-repository"), created = await createSystemBundle("multi", [{ root: path.join(root, "producer"), id: "producer" }, { root: path.join(root, "consumer"), id: "consumer" }]);
    const bundle = { ...created, contract: approveSystemContract(created.contract) };
    const migrated = 'import {generateKeyPairSync,sign,verify} from "node:crypto";export const context="quantum-twin:update-manifest:v1";const contextBytes=Buffer.from(context);export function createKeys(){return generateKeyPairSync("ml-dsa-65")}export function signEnvelope(payload,privateKey){return{version:"ml-dsa-v1",algorithm:"ML-DSA-65",context,payload:Buffer.from(payload),signature:sign(null,payload,{key:privateKey,context:contextBytes})}}export function verifyEnvelope(envelope,publicKey){return envelope.version==="ml-dsa-v1"&&envelope.algorithm==="ML-DSA-65"&&envelope.context===context&&verify(null,envelope.payload,{key:publicKey,context:contextBytes},envelope.signature)}export function run(){const keys=createKeys(),envelope=signEnvelope(Buffer.from("multi-order"),keys.privateKey);return verifyEnvelope(envelope,keys.publicKey)}\n';
    const builder: CandidateBuilder = async (strategy, worktree) => { for (const repository of ["producer", "consumer"]) await writeFile(path.join(worktree, `repositories/${repository}/src/index.js`), migrated); return { threadId: `fake-multi-${strategy}`, status: "generated", durationMs: 1 }; };
    const report = await runSystemTournament(bundle, { allowExec: true, builder });
    expect(report.selectedCandidate).toBe("direct");
    expect(report.candidates.find(candidate => candidate.strategy === "direct")?.changedRepositories.sort()).toEqual(["consumer", "producer"]);
    const evidence = createSystemEvidenceBundle(report); expect(Object.keys(evidence.patches).sort()).toEqual(["consumer", "producer"]); expect(evidence.evidenceBundleSha256).toMatch(/^[a-f0-9]{64}$/);
  }, 60_000);

  test("deliberately impossible system returns NO SAFE WINNER", async () => {
    const root = path.join(process.cwd(), "proof-systems", "no-safe-winner"), created = await createSystemBundle("impossible", [{ root, id: "impossible" }], { frozenConsumers: ["frozen-rsa-only"] }), bundle = { ...created, contract: approveSystemContract(created.contract) };
    const builder: CandidateBuilder = async strategy => ({ threadId: `fake-impossible-${strategy}`, status: "generated", durationMs: 1 });
    const report = await runSystemTournament(bundle, { allowExec: true, builder });
    expect(report.selectedCandidate).toBeNull(); expect(report.decision).toContain("NO SAFE WINNER"); expect(report.candidates.every(candidate => !candidate.eligible)).toBe(true);
  }, 30_000);

  test("coordinated apply creates a reviewed local branch without switching main", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qt-apply-repository-")); await writeFile(path.join(root, "value.txt"), "old\n");
    await command("git", ["init", "-b", "main"], root); await command("git", ["add", "."], root); await command("git", ["-c", "user.name=Test", "-c", "user.email=test@local", "commit", "-m", "base"], root);
    const patch = "diff --git a/repositories/repo/value.txt b/repositories/repo/value.txt\n--- a/repositories/repo/value.txt\n+++ b/repositories/repo/value.txt\n@@ -1 +1 @@\n-old\n+new\n";
    const evidence = { run: { runId: "2026-01-01T00-00-00-000Z" }, selection: "direct", patches: { repo: patch } };
    await expect(createCoordinatedLocalBranches(evidence, { repo: root }, "wrong")).rejects.toThrow(/Typed confirmation/);
    const result = await createCoordinatedLocalBranches(evidence, { repo: root }, "CREATE COORDINATED LOCAL BRANCHES");
    expect(result).toHaveLength(1); expect((await readFile(path.join(root, "value.txt"), "utf8"))).toBe("old\n");
    expect((await command("git", ["branch", "--show-current"], root)).stdout.trim()).toBe("main");
    expect((await command("git", ["show", `${result[0]!.branch}:value.txt`], root)).stdout.trim()).toBe("new");
  });
});

describe("native post-quantum boundaries", () => {
  test("ML-DSA-65 rejects data, signature, key, context, and truncation changes", () => {
    const payload = Buffer.from("approved update"), signer = generateMlDsaSigner(), wrong = generateMlDsaSigner(), signature = signMlDsa(payload, signer.privateKey);
    expect(verifyMlDsa(payload, signature, signer.publicKey)).toBe(true);
    expect(verifyMlDsa(Buffer.from("changed"), signature, signer.publicKey)).toBe(false);
    const changed = Buffer.from(signature); changed[0] ^= 1;
    expect(verifyMlDsa(payload, changed, signer.publicKey)).toBe(false);
    expect(verifyMlDsa(payload, signature, wrong.publicKey)).toBe(false);
    expect(verifyMlDsa(payload, signature, signer.publicKey, "wrong-context")).toBe(false);
    expect(verifyMlDsa(payload, signature.subarray(0, -1), signer.publicKey)).toBe(false);
  });

  test("ML-KEM-768 KEM-DEM rejects recipient, ciphertext, encapsulation, nonce, tag, context, and truncation changes", () => {
    const plaintext = Buffer.from("private business payload"), recipient = generateMlKemRecipient(), wrong = generateMlKemRecipient(), envelope = encryptKemDem(plaintext, recipient.publicKey);
    const changed = (value: string) => { const bytes = Buffer.from(value, "base64url"); bytes[0] ^= 1; return bytes.toString("base64url"); };
    expect(decryptKemDem(envelope, recipient.privateKey)).toEqual(plaintext);
    const mutations: KemDemEnvelope[] = [
      { ...envelope, ciphertext: changed(envelope.ciphertext) },
      { ...envelope, encapsulatedKey: changed(envelope.encapsulatedKey) },
      { ...envelope, nonce: changed(envelope.nonce) },
      { ...envelope, tag: changed(envelope.tag) },
      { ...envelope, context: "wrong" as typeof envelope.context },
      { ...envelope, ciphertext: envelope.ciphertext.slice(0, -2) }
    ];
    expect(() => decryptKemDem(envelope, wrong.privateKey)).toThrow();
    for (const mutation of mutations) expect(() => decryptKemDem(mutation, recipient.privateKey)).toThrow();
    expect(JSON.stringify(envelope)).not.toContain(plaintext.toString());
  });
});

describe("sanitized runtime crypto tracing", () => {
  test("records metadata and lengths but never payload or private key", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qt-trace-target-")), script = path.join(root, "run.cjs");
    await writeFile(script, 'const {generateKeyPairSync,sign,verify}=require("node:crypto"); const k=generateKeyPairSync("rsa",{modulusLength:2048}); const data=Buffer.from("never-record-this"); const s=sign("sha256",data,k.privateKey); if(!verify("sha256",data,k.publicKey,s)) process.exit(2);');
    const traced = await traceCryptoCommand(process.execPath, [script], root, "orders-api");
    expect(traced.result.exitCode).toBe(0);
    expect(traced.events.map(event => event.operation)).toEqual(["sign", "verify"]);
    expect(traced.events.every(event => event.payloadBytes === 17 && event.componentId === "orders-api")).toBe(true);
    expect(traced.events[0]?.outputBytes).toBeGreaterThan(0);
    expect(JSON.stringify(traced.events)).not.toContain("never-record-this");
    expect(JSON.stringify(traced.events)).not.toContain("PRIVATE KEY");
  });
});
