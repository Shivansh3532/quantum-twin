import { Codex } from "@openai/codex-sdk";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { evaluateCrypto } from "../evaluator/acceptance.ts";
import { classifyWithGpt, explainWithGpt } from "./ai.ts";
import { type CandidateResult, MODEL, SDK_VERSION } from "./domain.ts";
import { command, manifest, sha256 } from "./util.ts";
import { scanCrypto } from "./scanner.ts";

const root = process.cwd();
const promptBase = `Modify only src/signatures.ts. Use native node:crypto. Target key type ml-dsa-65. sign/verify algorithm must be null. Use the function's context string as Buffer.from(context) via { key, context }. Keep exported signManifest and verifyManifest API compatible with original tests. Key object also provides mlDsaPrivateKey and mlDsaPublicKey. Do not edit tests, package.json, or lockfile. No dependencies. Run tests. `;

async function buildCandidate(strategy: "direct" | "bridge", worktree: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const thread = new Codex().startThread({ model: MODEL, modelReasoningEffort: "high", workingDirectory: worktree, sandboxMode: "workspace-write", networkAccessEnabled: false, webSearchMode: "disabled", approvalPolicy: "never" });
  const strategyPrompt = strategy === "direct"
    ? "Implement Direct Cutover: envelope contains only mlDsa signature; verification uses ML-DSA only; remove RSA signing."
    : "Implement Compatibility Bridge: envelope contains rsa and mlDsa signatures; verification for current clients uses ML-DSA; keep RSA output for frozen legacy clients.";
  try {
    await thread.run(`${promptBase}${strategyPrompt}`, { signal: controller.signal });
    return { threadId: thread.id, status: "ok" as const };
  } catch (error) {
    return { threadId: thread.id, status: controller.signal.aborted ? "generation_timed_out" as const : "generation_failed" as const, error: error instanceof Error ? error.message : String(error) };
  } finally { clearTimeout(timer); }
}

async function verifyCandidate(strategy: "direct" | "bridge", worktree: string, baselineHashes: Record<string, string>, evaluatorHash: string): Promise<CandidateResult> {
  const gates = [] as CandidateResult["gates"];
  const protect = async (relative: string) => sha256(await readFile(path.join(worktree, relative))) === baselineHashes[relative];
  const install = await command("pnpm", ["install", "--offline", "--frozen-lockfile"], worktree);
  gates.push({ name: "offline frozen install", passed: install.exitCode === 0, detail: `exit ${install.exitCode}`, durationMs: install.durationMs });
  for (const [name, args] of [["compilation", ["typecheck"]], ["original tests", ["test"]]] as const) {
    const result = await command("pnpm", [...args], worktree);
    gates.push({ name, passed: result.exitCode === 0, detail: `exit ${result.exitCode}`, durationMs: result.durationMs });
  }
  const protectedOk = (await Promise.all(Object.keys(baselineHashes).map(protect))).every(Boolean);
  gates.push({ name: "baseline integrity", passed: protectedOk, detail: "package scripts, lockfile, original tests unchanged" });
  gates.push({ name: "evaluator integrity", passed: (await manifest(path.join(root, "evaluator"))).sha256 === evaluatorHash, detail: "external evaluator manifest unchanged" });
  const diff = (await command("git", ["diff", "HEAD"], worktree)).stdout;
  const secret = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|OPENAI_API_KEY\s*=\s*\S+/i.test(diff);
  gates.push({ name: "secret hygiene", passed: !secret, detail: "candidate diff scanned" });
  const packageChanged = (await command("git", ["diff", "--quiet", "HEAD", "--", "package.json", "pnpm-lock.yaml"], worktree)).exitCode !== 0;
  gates.push({ name: "no dependency changes", passed: !packageChanged, detail: "manifest and lockfile unchanged" });
  const source = await readFile(path.join(worktree, "src/signatures.ts"), "utf8");
  gates.push({ name: "approved native API", passed: /node:crypto/.test(source) && /ml-dsa-65/.test(source) && !/from\s+["'](?!node:crypto)/.test(source), detail: "native node:crypto ML-DSA-65" });
  let measurements: CandidateResult["measurements"] = null;
  try {
    for (let pass = 1; pass <= 2; pass++) {
      const result = await evaluateCrypto(worktree, true);
      gates.push(...result.gates.map(g => ({ ...g, name: `${g.name} (pass ${pass})` })));
      measurements = result.measurements;
    }
  } catch (error) { gates.push({ name: "external evaluator", passed: false, detail: error instanceof Error ? error.message : String(error) }); }
  gates.push({ name: "repeatability", passed: gates.filter(g => /\(pass [12]\)/.test(g.name)).every(g => g.passed), detail: "external verifier completed twice" });
  await command("git", ["add", "src/signatures.ts"], worktree);
  await command("git", ["-c", "user.name=Quantum Twin", "-c", "user.email=quantum-twin@local", "commit", "-m", `feat: ${strategy} migration candidate`], worktree);
  const commit = (await command("git", ["rev-parse", "HEAD"], worktree)).stdout.trim();
  const committedDiff = (await command("git", ["show", "--format=", "--numstat", "HEAD"], worktree)).stdout;
  const changedLines = committedDiff.trim().split(/\r?\n/).reduce((sum, line) => sum + line.split("\t").slice(0, 2).reduce((n, x) => n + (Number(x) || 0), 0), 0);
  return { strategy, branch: `candidate/${strategy}`, threadId: null, generationStatus: gates.every(g => g.passed) ? "eligible" : "gate_failed", worktreeCommit: commit, diffSha256: sha256(diff), changedLines, gates, measurements };
}

export function select(candidates: CandidateResult[]) {
  const eligible = candidates.filter(c => c.generationStatus === "eligible" && c.gates.every(g => g.passed));
  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => (a.measurements!.rsaSignatures - b.measurements!.rsaSignatures) || (a.changedLines - b.changedLines) || (a.measurements!.envelopeBytes - b.measurements!.envelopeBytes))[0]!.strategy;
}

export async function runDemo() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runRoot = path.join(root, "runs", runId), baseline = path.join(runRoot, "baseline");
  await mkdir(runRoot, { recursive: true }); await cp(path.join(root, "fixture"), baseline, { recursive: true });
  await command("pnpm", ["install"], baseline, 300_000);
  await command("git", ["init"], baseline); await command("git", ["add", "."], baseline);
  await command("git", ["-c", "user.name=Quantum Twin", "-c", "user.email=quantum-twin@local", "commit", "-m", "fixture baseline"], baseline);
  const baselineCommit = (await command("git", ["rev-parse", "HEAD"], baseline)).stdout.trim();
  const fixtureManifest = await manifest(baseline);
  const protectedFiles = ["package.json", "pnpm-lock.yaml", "test/original/signatures.test.ts"];
  const baselineHashes = Object.fromEntries(await Promise.all(protectedFiles.map(async f => [f, sha256(await readFile(path.join(baseline, f)))])));
  const evaluatorHash = (await manifest(path.join(root, "evaluator"))).sha256;
  const hits = await scanCrypto(path.join(baseline, "src/signatures.ts"));
  const finding = await classifyWithGpt(root, hits);
  const worktrees = Object.fromEntries(await Promise.all((["direct", "bridge"] as const).map(async strategy => {
    const location = path.join(runRoot, strategy);
    const result = await command("git", ["worktree", "add", "-b", `candidate/${strategy}`, location, baselineCommit], baseline);
    if (result.exitCode) throw new Error(result.stderr);
    return [strategy, location];
  })));
  const built = await Promise.allSettled((["direct", "bridge"] as const).map(s => buildCandidate(s, worktrees[s], 600_000)));
  const candidates: CandidateResult[] = [];
  for (const [index, strategy] of (["direct", "bridge"] as const).entries()) {
    const outcome = built[index]!;
    if (outcome.status === "rejected") candidates.push({ strategy, branch: `candidate/${strategy}`, threadId: null, generationStatus: "generation_failed", worktreeCommit: null, diffSha256: sha256(""), changedLines: 0, gates: [], measurements: null, error: String(outcome.reason) });
    else if (outcome.value.status !== "ok") candidates.push({ strategy, branch: `candidate/${strategy}`, threadId: outcome.value.threadId, generationStatus: outcome.value.status, worktreeCommit: null, diffSha256: sha256(""), changedLines: 0, gates: [], measurements: null, error: outcome.value.error });
    else { const result = await verifyCandidate(strategy, worktrees[strategy], baselineHashes, evaluatorHash); result.threadId = outcome.value.threadId; candidates.push(result); }
  }
  const selectedCandidate = select(candidates);
  const immutable = { runId, baselineCommit, fixtureManifestSha256: fixtureManifest.sha256, nodeVersion: process.version, codexSdkVersion: SDK_VERSION, model: MODEL, constraintProfile: { legacyCompatibilityRequired: true }, finding, candidates, selectedCandidate, verifierManifestSha256: evaluatorHash };
  let explanation: unknown;
  try { explanation = await explainWithGpt(root, immutable); } catch (error) { explanation = { unavailable: error instanceof Error ? error.message : String(error) }; }
  const withoutHash = JSON.stringify({ ...immutable, explanation }, null, 2);
  const report = { ...immutable, explanation, reportSha256: sha256(withoutHash) };
  await writeFile(path.join(runRoot, "run.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(root, "runs", "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
