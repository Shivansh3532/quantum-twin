import { Codex } from "@openai/codex-sdk";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MODEL, SDK_VERSION, type Gate } from "./domain.ts";
import { assembleSystemAt, runSystemPass, type SystemPass } from "./system-execution.ts";
import { assertContractApproved, buildSystemCryptoGraph, type SystemBundle, type SystemContract, type SystemCryptoGraph, type SystemRepository } from "./system-bundle.ts";
import { contained } from "./repository.ts";
import { command, fileSha256, manifest, sha256 } from "./util.ts";

const strategies = ["direct", "bridge"] as const;
type Strategy = typeof strategies[number];
export type SystemCandidate = { strategy: Strategy; threadId: string | null; generationStatus: "generated" | "failed" | "timed_out"; generationDurationMs: number; commit: string | null; diff: string; diffSha256: string; changedFiles: string[]; changedRepositories: string[]; gates: Gate[]; passes: SystemPass[]; measurements?: { baselineCommandMs: number; candidateMeanCommandMs: number; baselineCryptoOutputBytes: number; candidateMeanCryptoOutputBytes: number; payloadExpansionPercent: number | null }; eligible: boolean; error?: string };
export type RolloutPackage = { upgradeOrder: string[]; keyGeneration: string[]; publicKeyDistribution: string[]; privateKeyHandling: string[]; environmentChanges: string[]; envelopeVersions: string[]; compatibilityWindow: string; healthSignals: string[]; performanceAndPayload: string[]; rollback: string[]; rsaRetirementCondition: string; remainingBoundaries: string[] };
export type SystemRunReport = { version: 1; runId: string; startedAt: string; completedAt: string; nodeVersion: string; platform: string; codexSdkVersion: string; model: string; bundleManifestSha256: string; graphSha256: string; observedGraph: SystemCryptoGraph; contractSha256: string; baseline: SystemPass; candidates: SystemCandidate[]; selectedCandidate: Strategy | null; decision: string; rollout: RolloutPackage; reportSha256: string };
export type CandidateBuilder = (strategy: Strategy, worktree: string, evidence: unknown, timeoutMs: number) => Promise<{ threadId: string | null; status: "generated" | "failed" | "timed_out"; durationMs: number; error?: string }>;

const defaultBuilder: CandidateBuilder = async (strategy, worktree, evidence, timeoutMs) => {
  const started = performance.now(), controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  const thread = new Codex().startThread({ model: MODEL, modelReasoningEffort: "high", workingDirectory: worktree, sandboxMode: "workspace-write", networkAccessEnabled: false, webSearchMode: "disabled", approvalPolicy: "never" });
  const plan = strategy === "direct"
    ? "Direct Cutover: coordinate every controlled producer and consumer; use ML-DSA-65 for signatures and ML-KEM-768 plus HKDF-SHA256 plus AES-256-GCM for declared RSA encryption envelopes; remove RSA only inside migrated controlled boundaries."
    : "Compatibility Bridge: add the same post-quantum paths, retain only RSA required by frozen consumers, version the envelope, reject downgrade, and encode an explicit RSA retirement condition.";
  try {
    await thread.run(`Implement one coordinated system migration. ${plan}\nModify only contract writablePaths. Never edit protected paths, package metadata, lockfiles, tests, evaluator, or contract. Never add dependencies, keys, credentials, network calls, deployment, commits, or pushes. Use native node:crypto. ML-DSA sign/verify must use algorithm null and exact Buffer context. Preserve unrelated behavior. Run approved checks. Frozen immutable evidence:\n${JSON.stringify(evidence)}`, { signal: controller.signal });
    return { threadId: thread.id, status: "generated", durationMs: Math.round(performance.now() - started) };
  } catch (error) { return { threadId: thread.id, status: controller.signal.aborted ? "timed_out" : "failed", durationMs: Math.round(performance.now() - started), error: error instanceof Error ? error.message : String(error) }; }
  finally { clearTimeout(timer); }
};

function allowed(file: string, roots: string[]) { const normalized = file.replaceAll("\\", "/"); return roots.some(root => normalized === root || normalized.startsWith(`${root.replace(/\/$/, "")}/`)); }

async function protectedHashes(root: string, contract: SystemContract) {
  const result: Record<string, string> = {};
  for (const relative of contract.protectedPaths.value) {
    const absolute = path.join(root, relative);
    if (!contained(root, absolute)) throw new Error("Protected path escapes system root");
    const info = await stat(absolute);
    result[relative] = info.isDirectory() ? (await manifest(absolute)).sha256 : fileSha256(await readFile(absolute));
  }
  return result;
}

async function protectedUnchanged(root: string, hashes: Record<string, string>) {
  for (const [relative, expected] of Object.entries(hashes)) {
    try { const absolute = path.join(root, relative), info = await stat(absolute), actual = info.isDirectory() ? (await manifest(absolute)).sha256 : fileSha256(await readFile(absolute)); if (actual !== expected) return false; }
    catch { return false; }
  }
  return true;
}

async function sourceText(root: string, changed: string[]) {
  const values: string[] = [];
  for (const file of changed.filter(file => /\.[cm]?[jt]sx?$/.test(file))) try { values.push(await readFile(path.join(root, file), "utf8")); } catch { /* deletion */ }
  return values.join("\n");
}

async function protectedTestText(root: string, contract: SystemContract) {
  const values: string[] = [];
  async function walk(target: string) {
    const info = await stat(target);
    if (info.isDirectory()) for (const name of await readdir(target)) await walk(path.join(target, name));
    else if (/\.[cm]?[jt]sx?$/.test(target)) values.push(await readFile(target, "utf8"));
  }
  for (const relative of contract.protectedPaths.value.filter(value => /(?:^|\/)(?:test|tests)(?:\/|$)/.test(value))) await walk(path.join(root, relative));
  return values.join("\n");
}

const commandDuration = (pass: SystemPass) => pass.commands.filter(item => item.stage !== "install").reduce((total, item) => total + item.durationMs, 0);

async function verifyCandidate(strategy: Strategy, worktree: string, baselineCommit: string, contract: SystemContract, protectedBaseline: Record<string, string>, evaluatorHash: string, runRoot: string, baseline: SystemPass, requiredRepositories: string[]): Promise<Omit<SystemCandidate, "threadId" | "generationStatus" | "generationDurationMs">> {
  const gates: Gate[] = [];
  const changedResult = await command("git", ["diff", "--name-only", baselineCommit], worktree), changedFiles = changedResult.stdout.split(/\r?\n/).filter(Boolean).map(value => value.replaceAll("\\", "/"));
  const diff = (await command("git", ["diff", "--binary", baselineCommit], worktree)).stdout;
  gates.push({ name: "writable path policy", passed: changedFiles.length > 0 && changedFiles.every(file => allowed(file, contract.writablePaths.value)), detail: changedFiles.length ? changedFiles.join(", ") : "no candidate changes" });
  gates.push({ name: "protected-file policy", passed: await protectedUnchanged(worktree, protectedBaseline), detail: "all frozen package, lock, CI, test, and evaluator paths match baseline" });
  gates.push({ name: "dependency policy", passed: !changedFiles.some(file => /(?:^|\/)(?:package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file)), detail: contract.dependencyChanges.value });
  gates.push({ name: "secret hygiene", passed: !/-----BEGIN (?:RSA |EC |OPENSSH |ML-DSA |ML-KEM )?PRIVATE KEY-----|(?:OPENAI|AWS|GITHUB|NPM)_?(?:API_)?KEY\s*[:=]/i.test(diff), detail: "candidate diff scanned" });
  const changedRepositories = [...new Set(changedFiles.map(file => file.split("/")[1]).filter(Boolean))];
  gates.push({ name: "coordinated repository coverage", passed: requiredRepositories.every(repository => changedRepositories.includes(repository)), detail: requiredRepositories.length ? `required: ${requiredRepositories.join(", ")}; changed: ${changedRepositories.join(", ") || "none"}` : "No supported controlled repository requires a migration" });
  try { assertContractApproved(contract); gates.push({ name: "contract integrity", passed: true, detail: contract.sha256 }); }
  catch (error) { gates.push({ name: "contract integrity", passed: false, detail: error instanceof Error ? error.message : String(error) }); }
  const source = await sourceText(worktree, changedFiles), mlDsa = /ml-dsa-65/i.test(source) && /sign\s*\(\s*null/.test(source) && /verify\s*\(\s*null/.test(source) && /context/.test(source);
  if (contract.boundaries.value.includes("ml-dsa-65")) gates.push({ name: "ML-DSA-65 adapter", passed: mlDsa, detail: "native algorithm-null sign and verify with context binding" });
  const frozen = contract.frozenConsumers.value.length > 0, rsa = /RSA[-_ ]?(?:SHA)?\d*|createSign|createVerify|publicEncrypt|privateDecrypt/i.test(source);
  gates.push({ name: "strategy contract", passed: strategy === "direct" ? !rsa && !frozen : frozen ? rsa : !rsa, detail: strategy === "direct" ? frozen ? `direct cutover cannot satisfy frozen consumers: ${contract.frozenConsumers.value.join(", ")}` : "controlled migrated boundary contains no RSA continuity" : frozen ? `RSA continuity limited to ${contract.frozenConsumers.value.join(", ")}` : "no frozen consumer requires RSA" });
  const tests = await protectedTestText(worktree, contract), signatureNegatives = [/tamper/i, /wrong.{0,20}key/is, /context/i, /truncat/i, /downgrade/i];
  if (contract.boundaries.value.includes("ml-dsa-65")) gates.push({ name: "protected cryptographic negative coverage", passed: signatureNegatives.every(pattern => pattern.test(tests)), detail: "tamper, wrong-key, context, truncation, and downgrade cases are frozen outside candidate write roots" });
  if (contract.boundaries.value.includes("ml-kem-768-kem-dem")) gates.push({ name: "protected ML-KEM negative coverage", passed: [/wrong.{0,20}recipient/is, /ciphertext/i, /encapsulated/i, /nonce|tag|aad/i, /truncat/i, /context/i].every(pattern => pattern.test(tests)), detail: "recipient and authenticated-envelope corruption cases are frozen" });
  if (contract.boundaries.value.includes("ml-kem-768-kem-dem")) gates.push({ name: "ML-KEM-768 KEM-DEM adapter", passed: /ml-kem-768/i.test(source) && /encapsulate/.test(source) && /decapsulate/.test(source) && /hkdf/i.test(source) && /aes-256-gcm/i.test(source), detail: "ML-KEM, HKDF-SHA256, and AES-256-GCM are all present" });
  const passes: SystemPass[] = [];
  if (gates.every(gate => gate.passed)) {
    await command("git", ["add", "--", ...changedFiles], worktree); await command("git", ["-c", "user.name=Quantum Twin", "-c", "user.email=quantum-twin@local", "commit", "-m", `feat: coordinated ${strategy} system migration`], worktree);
    const commit = (await command("git", ["rev-parse", "HEAD"], worktree)).stdout.trim();
    for (let pass = 1; pass <= 2; pass++) {
      const evaluation = path.join(runRoot, `${strategy}-evaluation-${pass}`);
      const added = await command("git", ["worktree", "add", "--detach", evaluation, commit], worktree);
      if (added.exitCode) { gates.push({ name: `clean evaluator pass ${pass}`, passed: false, detail: added.stderr }); continue; }
      const result = await runSystemPass(evaluation, contract, pass); passes.push(result);
      const clean = await command("git", ["diff", "--quiet", "HEAD", "--", "."], evaluation);
      result.gates.splice(-1, 0, { name: "source integrity", passed: clean.exitCode === 0, detail: clean.exitCode === 0 ? commit : "tracked files changed during evaluation" });
      result.gates[result.gates.length - 1]!.passed = result.gates.slice(0, -1).every(gate => gate.passed);
      gates.push({ name: `clean evaluator pass ${pass}`, passed: result.gates.every(gate => gate.passed), detail: `${result.gates.filter(gate => gate.passed).length}/${result.gates.length} gates passed` });
    }
    gates.push({ name: "repeatability", passed: passes.length === 2 && passes.every(pass => pass.gates.every(gate => gate.passed)), detail: "two independent worktrees completed the approved system workflow" });
    const baselineMs = commandDuration(baseline), candidateMs = passes.length ? Math.round(passes.reduce((total, pass) => total + commandDuration(pass), 0) / passes.length) : Number.POSITIVE_INFINITY;
    const performanceLimit = Math.round(baselineMs * (1 + contract.performanceLimitPercent.value / 100) + 1_000);
    gates.push({ name: "performance budget", passed: candidateMs <= performanceLimit, detail: `baseline ${baselineMs} ms; candidate mean ${candidateMs} ms; approved limit ${performanceLimit} ms` });
    const baselineOutput = Math.max(0, ...baseline.runtimeEvents.map(event => event.outputBytes ?? 0)), candidateOutput = Math.round(passes.reduce((total, pass) => total + Math.max(0, ...pass.runtimeEvents.map(event => event.outputBytes ?? 0)), 0) / Math.max(1, passes.length));
    const measurements = { baselineCommandMs: baselineMs, candidateMeanCommandMs: candidateMs, baselineCryptoOutputBytes: baselineOutput, candidateMeanCryptoOutputBytes: candidateOutput, payloadExpansionPercent: baselineOutput ? Math.round((candidateOutput - baselineOutput) / baselineOutput * 10_000) / 100 : null };
    const rollbackRoot = path.join(runRoot, `${strategy}-rollback`), rollbackAdded = await command("git", ["worktree", "add", "--detach", rollbackRoot, baselineCommit], worktree);
    if (rollbackAdded.exitCode) gates.push({ name: "rollback", passed: false, detail: rollbackAdded.stderr });
    else {
      const rollbackPass = await runSystemPass(rollbackRoot, contract, 3), rollbackClean = await command("git", ["diff", "--quiet", "HEAD", "--", "."], rollbackRoot);
      gates.push({ name: "rollback", passed: rollbackPass.gates.every(gate => gate.passed) && rollbackClean.exitCode === 0, detail: "Baseline commit restored in an independent worktree and approved workflow repeated" });
    }
    const currentEvaluator = sha256(await Promise.all(["crypto-boundaries.ts", "system-execution.ts"].map(file => readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "src", file), "utf8"))).then(parts => parts.join("\n")));
    gates.push({ name: "evaluator integrity", passed: currentEvaluator === evaluatorHash, detail: evaluatorHash });
    return { strategy, commit, diff, diffSha256: sha256(diff), changedFiles, changedRepositories, gates, passes, measurements, eligible: gates.every(gate => gate.passed) };
  }
  return { strategy, commit: null, diff, diffSha256: sha256(diff), changedFiles, changedRepositories, gates, passes, eligible: false };
}

export function selectSystemCandidate(candidates: SystemCandidate[]) {
  const eligible = candidates.filter(candidate => candidate.eligible && candidate.gates.every(gate => gate.passed));
  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => a.changedFiles.length - b.changedFiles.length || (a.strategy === "direct" ? -1 : 1))[0]!.strategy;
}

function rollout(bundle: SystemBundle, selected: SystemCandidate | null): RolloutPackage {
  const measurement = selected?.measurements;
  return { upgradeOrder: bundle.components.filter(component => component.kind !== "service").map(component => component.name).concat(bundle.components.filter(component => component.kind === "service").map(component => component.name)), keyGeneration: ["Generate ML-DSA-65 and, where declared, ML-KEM-768 keys in the deployment secret manager; never in the repository"], publicKeyDistribution: ["Distribute versioned public keys to every controlled verifier before producer cutover"], privateKeyHandling: ["Keep private keys non-exportable where possible; never place key material in patches or evidence"], environmentChanges: ["Supply only deployment-specific key references after operator review"], envelopeVersions: bundle.contract.envelopeVersions.value, compatibilityWindow: selected?.strategy === "bridge" ? "Keep the reviewed bridge only until every named frozen consumer upgrades" : "No legacy compatibility window selected", healthSignals: bundle.contract.healthChecks.value, performanceAndPayload: measurement ? [`Approved workflow command time: baseline ${measurement.baselineCommandMs} ms; candidate mean ${measurement.candidateMeanCommandMs} ms`, `Observed maximum crypto output: baseline ${measurement.baselineCryptoOutputBytes} bytes; candidate mean ${measurement.candidateMeanCryptoOutputBytes} bytes; expansion ${measurement.payloadExpansionPercent ?? "unavailable"}%`] : ["No eligible candidate measurements"], rollback: ["Stop rollout", "restore previous key references", "revert coordinated repository patches in reverse upgrade order", "repeat baseline E2E"], rsaRetirementCondition: selected?.strategy === "bridge" ? `Remove RSA only after ${bundle.contract.frozenConsumers.value.join(", ") || "all frozen consumers"} accept the post-quantum version and downgrade tests still pass` : "RSA is removed from the migrated controlled boundary after direct-cutover gates pass", remainingBoundaries: bundle.graph.staticFindings.filter(item => item.status !== "supported").map(item => `${item.file}:${item.line} ${item.technology}`) };
}

export async function runSystemTournament(bundle: SystemBundle, options: { allowExec: boolean; builder?: CandidateBuilder; candidateTimeoutMs?: number; onEvent?: (stage: "baseline" | "building" | "evaluating", detail: string) => void } = { allowExec: false }): Promise<SystemRunReport> {
  if (!options.allowExec) throw new Error("System execution blocked: explicit command and Codex authorization is required");
  if (!bundle.contract.approved) throw new Error("System execution blocked: contract is not approved");
  const startedAt = new Date().toISOString(), runId = startedAt.replace(/[:.]/g, "-");
  const runRoot = await mkdtemp(path.join(os.tmpdir(), "quantum-twin-tournament-")), baselineRoot = path.join(runRoot, "baseline");
  try {
    await assembleSystemAt(bundle.repositories, baselineRoot);
    await command("git", ["init"], baselineRoot); await command("git", ["config", "core.autocrlf", "false"], baselineRoot); await command("git", ["add", "."], baselineRoot); await command("git", ["-c", "user.name=Quantum Twin", "-c", "user.email=quantum-twin@local", "commit", "-m", "isolated system baseline"], baselineRoot);
    const baselineCommit = (await command("git", ["rev-parse", "HEAD"], baselineRoot)).stdout.trim(), frozen = await protectedHashes(baselineRoot, bundle.contract);
    options.onEvent?.("baseline", "Running approved baseline system and sanitized crypto trace");
    const baseline = await runSystemPass(baselineRoot, bundle.contract, 0);
    const baselineClean = await command("git", ["diff", "--quiet", "HEAD", "--", "."], baselineRoot);
    baseline.gates.splice(-1, 0, { name: "source integrity", passed: baselineClean.exitCode === 0, detail: baselineClean.exitCode === 0 ? baselineCommit : "tracked files changed during baseline execution" });
    baseline.gates[baseline.gates.length - 1]!.passed = baseline.gates.slice(0, -1).every(gate => gate.passed);
    if (!baseline.gates.every(gate => gate.passed)) throw new Error(`Baseline system failed: ${baseline.gates.filter(gate => !gate.passed).map(gate => `${gate.name}: ${gate.detail}`).join("; ")}`);
    const observedGraph = await buildSystemCryptoGraph(bundle.repositories, bundle.components, baseline.runtimeEvents, bundle.contract.frozenConsumers.value);
    const evaluatorHash = sha256((await Promise.all(["crypto-boundaries.ts", "system-execution.ts"].map(file => readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "src", file), "utf8")))).join("\n"));
    const worktrees = Object.fromEntries(await Promise.all(strategies.map(async strategy => { const location = path.join(runRoot, strategy), added = await command("git", ["worktree", "add", "-b", `candidate/${strategy}-${Date.now()}`, location, baselineCommit], baselineRoot); if (added.exitCode) throw new Error(added.stderr); return [strategy, location]; }))) as Record<Strategy, string>;
    const evidence = { contract: bundle.contract, graph: bundle.graph, baselineCommit, baselineManifest: await manifest(baselineRoot), candidatePolicy: { model: MODEL, network: false, approval: "never" } };
    const builder = options.builder ?? defaultBuilder;
    options.onEvent?.("building", "Two isolated Codex builders are coordinating repository changes");
    const generations = await Promise.all(strategies.map(strategy => builder(strategy, worktrees[strategy], evidence, options.candidateTimeoutMs ?? 1_200_000)));
    options.onEvent?.("evaluating", "Deterministic system gates are running twice from independent worktrees");
    const candidates: SystemCandidate[] = [], requiredRepositories = [...new Set(bundle.graph.nodes.filter(node => node.controlled && (node.kind === "producer" || node.kind === "consumer") && node.repositoryId).map(node => node.repositoryId!))];
    for (const [index, strategy] of strategies.entries()) {
      const generation = generations[index]!;
      if (generation.status !== "generated") { candidates.push({ strategy, threadId: generation.threadId, generationStatus: generation.status, generationDurationMs: generation.durationMs, commit: null, diff: "", diffSha256: sha256(""), changedFiles: [], changedRepositories: [], gates: [], passes: [], eligible: false, error: generation.error }); continue; }
      const verified = await verifyCandidate(strategy, worktrees[strategy], baselineCommit, bundle.contract, frozen, evaluatorHash, runRoot, baseline, requiredRepositories);
      candidates.push({ ...verified, threadId: generation.threadId, generationStatus: generation.status, generationDurationMs: generation.durationMs });
    }
    const selectedCandidate = selectSystemCandidate(candidates), selected = candidates.find(candidate => candidate.strategy === selectedCandidate) ?? null, immutable = { version: 1 as const, runId, startedAt, completedAt: new Date().toISOString(), nodeVersion: process.version, platform: `${os.platform()} ${os.release()} ${os.arch()}`, codexSdkVersion: SDK_VERSION, model: MODEL, bundleManifestSha256: bundle.manifestSha256, graphSha256: bundle.graph.sha256, observedGraph, contractSha256: bundle.contract.sha256, baseline, candidates, selectedCandidate, decision: selectedCandidate ? `${selectedCandidate} is the only or smallest fully eligible coordinated migration.` : "NO SAFE WINNER: every generated candidate failed at least one deterministic system gate.", rollout: rollout(bundle, selected) };
    const report = { ...immutable, reportSha256: sha256(JSON.stringify(immutable)) };
    await mkdir(path.join(/*turbopackIgnore: true*/ process.cwd(), "runs"), { recursive: true }); await writeFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "runs", `system-${runId}.json`), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally { await rm(runRoot, { recursive: true, force: true }); }
}
