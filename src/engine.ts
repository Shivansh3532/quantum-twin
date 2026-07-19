import { Codex } from "@openai/codex-sdk";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { inspectRepository } from "./capabilities.ts";
import { loadConfig, type QuantumTwinConfig } from "./config.ts";
import { classifyWithGpt, explainWithGpt } from "./ai.ts";
import { type CandidateResult, type Gate, type HarnessResult, MODEL, SDK_VERSION, type RunReport } from "./domain.ts";
import { copyRepository } from "./repository.ts";
import { command, fileSha256, manifest, sha256 } from "./util.ts";
import { scanRepository } from "./scanner.ts";

const root = process.cwd();
const strategies = ["direct", "bridge"] as const;

const execute = (parts: string[], cwd: string, timeout: number) => command(parts[0]!, parts.slice(1), cwd, timeout);
const pathMatches = (file: string, allowed: string[]) => allowed.some(item => file === item.replaceAll("\\", "/") || file.startsWith(`${item.replaceAll("\\", "/").replace(/\/$/, "")}/`));

async function buildCandidate(strategy: typeof strategies[number], worktree: string, config: QuantumTwinConfig, evidence: unknown) {
  const started = performance.now(), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeouts.candidateMs);
  const thread = new Codex().startThread({ model: MODEL, modelReasoningEffort: "high", workingDirectory: worktree, sandboxMode: "workspace-write", networkAccessEnabled: false, webSearchMode: "disabled", approvalPolicy: "never" });
  const shared = `Implement this immutable repository migration contract. Modify only writablePaths. Never edit protectedPaths, tests, evaluator, package manifest, lockfile, or configuration. Use native node:crypto, target ml-dsa-65, sign/verify algorithm null, and exact context binding via Buffer.from(context). Do not add dependencies. Run declared checks. Contract:\n${JSON.stringify(evidence)}`;
  const different = strategy === "direct"
    ? "Strategy: Direct Cutover. Emit and verify ML-DSA-65 only; remove RSA signing from writable paths."
    : "Strategy: Compatibility Bridge. Emit ML-DSA-65 plus legacy RSA output; current verification must use ML-DSA-65.";
  try {
    await thread.run(`${shared}\n${different}`, { signal: controller.signal });
    return { threadId: thread.id, status: "ok" as const, durationMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { threadId: thread.id, status: controller.signal.aborted ? "generation_timed_out" as const : "generation_failed" as const, error: error instanceof Error ? error.message : String(error), durationMs: Math.round(performance.now() - started) };
  } finally { clearTimeout(timer); }
}

async function runHarness(harness: string, worktree: string, config: QuantumTwinConfig): Promise<HarnessResult> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  const module = await dynamicImport(`${pathToFileURL(harness).href}?t=${Date.now()}-${Math.random()}`) as { evaluate?: (worktree: string, compatibility: boolean, context: string) => Promise<HarnessResult> };
  if (!module.evaluate) throw new Error("Compatibility harness must export evaluate(worktree, compatibilityRequired, context)");
  return module.evaluate(worktree, config.legacyCompatibilityRequired, config.target.context);
}

async function verifyCandidate(strategy: typeof strategies[number], worktree: string, config: QuantumTwinConfig, protectedHashes: Record<string, string>, harness: string, harnessHash: string): Promise<CandidateResult> {
  const gates: Gate[] = [], commands: CandidateResult["commands"] = [];
  for (const [name, parts] of Object.entries({ install: config.commands.install, typecheck: config.commands.typecheck, "original tests": config.commands.test, build: config.commands.build }).filter((entry): entry is [string, string[]] => Boolean(entry[1]))) {
    const result = await execute(parts, worktree, config.timeouts.commandMs);
    commands.push({ command: result.command, exitCode: result.exitCode, durationMs: result.durationMs });
    gates.push({ name, passed: result.exitCode === 0, detail: `exit ${result.exitCode}`, durationMs: result.durationMs });
  }
  const protectedOk = (await Promise.all(Object.entries(protectedHashes).map(async ([file, hash]) => fileSha256(await readFile(path.join(worktree, file))) === hash))).every(Boolean);
  gates.push({ name: "baseline integrity", passed: protectedOk, detail: "declared protected paths unchanged" });
  const diff = (await command("git", ["diff", "HEAD"], worktree, config.timeouts.commandMs)).stdout;
  const changed = (await command("git", ["diff", "--name-only", "HEAD"], worktree, config.timeouts.commandMs)).stdout.split(/\r?\n/).filter(Boolean).map(item => item.replaceAll("\\", "/"));
  gates.push({ name: "writable boundary", passed: changed.length > 0 && changed.every(file => pathMatches(file, config.writablePaths)), detail: changed.length ? changed.join(", ") : "no candidate changes" });
  const secret = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|OPENAI_API_KEY\s*=\s*\S+/i.test(diff);
  gates.push({ name: "secret hygiene", passed: !secret, detail: "candidate diff scanned" });
  const dependencyFiles = ["package.json", "pnpm-lock.yaml", "package-lock.json"];
  gates.push({ name: "dependency policy", passed: config.dependencyPolicy !== "forbid" || !changed.some(file => dependencyFiles.includes(file)), detail: config.dependencyPolicy });
  const writableSource = (await Promise.all(changed.filter(file => /\.[cm]?[jt]sx?$/.test(file)).map(file => readFile(path.join(worktree, file), "utf8")))).join("\n");
  gates.push({ name: "approved native API", passed: /(?:node:crypto|require\(["'](?:node:)?crypto["']\))/.test(writableSource) && /sign\s*\(\s*null/.test(writableSource) && /verify\s*\(\s*null/.test(writableSource) && /Buffer\.from\(\s*context\s*\)/.test(writableSource), detail: "native node:crypto ML-DSA with context binding" });
  let measurements: CandidateResult["measurements"] = null;
  for (let pass = 1; pass <= 2; pass++) {
    try {
      const before = fileSha256(await readFile(harness));
      const result = config.compatibilityHarness
        ? await runHarness(harness, worktree, config)
        : { gates: [{ name: "compatibility command", passed: (await execute(config.commands.compatibility!, worktree, config.timeouts.commandMs)).exitCode === 0, detail: "declared compatibility command" }], measurements: null };
      const after = fileSha256(await readFile(harness));
      gates.push({ name: `evaluator integrity (pass ${pass})`, passed: before === harnessHash && after === harnessHash, detail: "copied external harness hash unchanged" });
      gates.push(...result.gates.map(gate => ({ ...gate, name: `${gate.name} (pass ${pass})` })));
      measurements = result.measurements;
    } catch (error) {
      gates.push({ name: `external evaluator (pass ${pass})`, passed: false, detail: error instanceof Error ? error.message : String(error) });
    }
  }
  const passGates = gates.filter(gate => /\(pass [12]\)/.test(gate.name));
  gates.push({ name: "repeatability", passed: passGates.length > 0 && passGates.every(gate => gate.passed), detail: "complete external evaluator ran twice" });
  if (changed.length) {
    await command("git", ["add", "--", ...changed], worktree, config.timeouts.commandMs);
    await command("git", ["-c", "user.name=Quantum Twin", "-c", "user.email=quantum-twin@local", "commit", "-m", `feat: ${strategy} migration candidate`], worktree, config.timeouts.commandMs);
  }
  const commit = changed.length ? (await command("git", ["rev-parse", "HEAD"], worktree)).stdout.trim() : null;
  const committedDiff = changed.length ? (await command("git", ["show", "--format=", "--numstat", "HEAD"], worktree)).stdout : "";
  const changedLines = committedDiff.trim().split(/\r?\n/).filter(Boolean).reduce((sum, line) => sum + line.split("\t").slice(0, 2).reduce((count, value) => count + (Number(value) || 0), 0), 0);
  return { strategy, branch: `candidate/${strategy}`, threadId: null, generationDurationMs: 0, repairAttempted: false, generationStatus: gates.every(gate => gate.passed) ? "eligible" : "gate_failed", worktreeCommit: commit, diffSha256: sha256(diff), diff, changedLines, commands, gates, measurements };
}

async function repairCandidate(threadId: string, worktree: string, config: QuantumTwinConfig, failedGates: Gate[]) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), config.timeouts.candidateMs);
  try {
    const thread = new Codex().resumeThread(threadId, { model: MODEL, modelReasoningEffort: "high", workingDirectory: worktree, sandboxMode: "workspace-write", networkAccessEnabled: false, webSearchMode: "disabled", approvalPolicy: "never" });
    await thread.run(`One repair turn. Modify only ${JSON.stringify(config.writablePaths)}. Immutable failed gates:\n${JSON.stringify(failedGates)}\nDo not edit protected files or dependencies.`, { signal: controller.signal });
    return true;
  } catch { return false; } finally { clearTimeout(timer); }
}

export function select(candidates: CandidateResult[]) {
  const eligible = candidates.filter(candidate => candidate.generationStatus === "eligible" && candidate.gates.every(gate => gate.passed));
  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => (a.measurements?.rsaSignatures ?? Number.MAX_SAFE_INTEGER) - (b.measurements?.rsaSignatures ?? Number.MAX_SAFE_INTEGER) || a.changedLines - b.changedLines || (a.measurements?.envelopeBytes ?? Number.MAX_SAFE_INTEGER) - (b.measurements?.envelopeBytes ?? Number.MAX_SAFE_INTEGER))[0]!.strategy;
}

export async function runRepository(source: string, configPath: string, allowExec: boolean, compatibilityOverride?: boolean): Promise<RunReport> {
  if (!allowExec) throw new Error("Repository execution blocked. Re-run with explicit --allow-exec acknowledgment.");
  const startedAt = new Date().toISOString(), runId = startedAt.replace(/[:.]/g, "-");
  const runRoot = path.join(root, "runs", runId), baseline = path.join(runRoot, "baseline");
  const inspected = await inspectRepository(source, configPath);
  const loaded = inspected.config ?? await loadConfig(configPath);
  const config = compatibilityOverride === undefined ? loaded : { ...loaded, legacyCompatibilityRequired: compatibilityOverride };
  if (!inspected.report.automaticMigrationSupported) throw new Error(`Automatic migration blocked: ${inspected.report.configuration === "needed" ? "configuration needed" : "unsupported or ambiguous findings detected"}`);
  await mkdir(runRoot, { recursive: true });
  await copyRepository(source, baseline, config.limits);
  const install = await execute(config.commands.install, baseline, config.timeouts.commandMs);
  if (install.exitCode) throw new Error(`Baseline install failed: ${install.stderr}`);
  const harness = path.join(runRoot, "external-compatibility-harness.ts");
  if (config.compatibilityHarness) await copyFile(path.join(baseline, config.compatibilityHarness), harness);
  else await writeFile(harness, "export {};\n");
  const harnessHash = fileSha256(await readFile(harness));
  await command("git", ["init"], baseline); await command("git", ["config", "core.autocrlf", "false"], baseline); await command("git", ["add", "."], baseline);
  await command("git", ["-c", "user.name=Quantum Twin", "-c", "user.email=quantum-twin@local", "commit", "-m", "isolated source baseline"], baseline);
  const baselineCommit = (await command("git", ["rev-parse", "HEAD"], baseline)).stdout.trim();
  const baselineManifest = await manifest(baseline);
  const protectedHashes = Object.fromEntries(await Promise.all(config.protectedPaths.map(async file => [file, fileSha256(await readFile(path.join(baseline, file)))])));
  const findings = await scanRepository(baseline, config);
  const supported = findings.filter(item => item.status === "supported");
  const finding = await classifyWithGpt(root, supported);
  const contract = { version: 1, sourceCommit: baselineCommit, scannerEvidence: findings, writablePaths: config.writablePaths, protectedPaths: config.protectedPaths, commands: config.commands, target: config.target, dependencyPolicy: config.dependencyPolicy, legacyCompatibilityRequired: config.legacyCompatibilityRequired, timeouts: config.timeouts, candidatePolicy: { model: MODEL, network: false, webSearch: false, approval: "never" } };
  const worktrees = Object.fromEntries(await Promise.all(strategies.map(async strategy => {
    const location = path.join(runRoot, strategy);
    const result = await command("git", ["worktree", "add", "-b", `candidate/${strategy}`, location, baselineCommit], baseline);
    if (result.exitCode) throw new Error(result.stderr);
    return [strategy, location];
  }))) as Record<typeof strategies[number], string>;
  const built = await Promise.allSettled(strategies.map(strategy => buildCandidate(strategy, worktrees[strategy], config, contract)));
  const candidates: CandidateResult[] = [];
  for (const [index, strategy] of strategies.entries()) {
    const outcome = built[index]!;
    if (outcome.status === "rejected" || outcome.value.status !== "ok") {
      const value = outcome.status === "fulfilled" ? outcome.value : null;
      candidates.push({ strategy, branch: `candidate/${strategy}`, threadId: value?.threadId ?? null, generationDurationMs: value?.durationMs ?? 0, repairAttempted: false, generationStatus: value?.status === "generation_timed_out" ? "generation_timed_out" : "generation_failed", worktreeCommit: null, diffSha256: sha256(""), diff: "", changedLines: 0, commands: [], gates: [], measurements: null, error: outcome.status === "rejected" ? String(outcome.reason) : value?.error });
      continue;
    }
    let result = await verifyCandidate(strategy, worktrees[strategy], config, protectedHashes, harness, harnessHash);
    result.threadId = outcome.value.threadId; result.generationDurationMs = outcome.value.durationMs;
    const repairable = result.gates.filter(gate => !gate.passed && !/^legacy compatibility|^repeatability/.test(gate.name));
    if (repairable.length && outcome.value.threadId && await repairCandidate(outcome.value.threadId, worktrees[strategy], config, repairable)) {
      result = await verifyCandidate(strategy, worktrees[strategy], config, protectedHashes, harness, harnessHash);
      result.threadId = outcome.value.threadId; result.generationDurationMs = outcome.value.durationMs; result.repairAttempted = true;
    }
    candidates.push(result);
  }
  const selectedCandidate = select(candidates);
  const repositoryContract = { version: config.version, target: config.target, writablePaths: config.writablePaths, protectedPaths: config.protectedPaths, dependencyPolicy: config.dependencyPolicy };
  const immutable = { runId, startedAt, completedAt: new Date().toISOString(), repository: inspected.report.repository, capabilities: inspected.report, baselineCommit, fixtureManifestSha256: baselineManifest.sha256, configSha256: fileSha256(await readFile(configPath)), nodeVersion: process.version, platform: `${os.platform()} ${os.release()} ${os.arch()}`, codexSdkVersion: SDK_VERSION, model: MODEL, constraintProfile: { legacyCompatibilityRequired: config.legacyCompatibilityRequired }, repositoryContract, finding, candidates, selectedCandidate, verifierManifestSha256: harnessHash };
  let explanation: unknown;
  try { explanation = await explainWithGpt(root, immutable); } catch (error) { explanation = { unavailable: error instanceof Error ? error.message : String(error) }; }
  const withoutHash = JSON.stringify({ ...immutable, explanation }, null, 2);
  const report = { ...immutable, explanation, reportSha256: sha256(withoutHash) };
  await writeFile(path.join(runRoot, "run.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(root, "runs", "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function runDemo(legacyCompatibilityRequired = true) {
  const fixture = path.join(root, "fixture");
  return runRepository(fixture, path.join(fixture, "quantum-twin.config.json"), true, legacyCompatibilityRequired);
}
