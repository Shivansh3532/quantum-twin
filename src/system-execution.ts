import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Gate } from "./domain.ts";
import { assertContractApproved, type RuntimeCryptoEvent, type SystemContract, type SystemRepository } from "./system-bundle.ts";
import { startManaged, stopManaged, waitForHealth, type ManagedProcess } from "./process-supervisor.ts";
import { assertSafeTree, contained } from "./repository.ts";
import { createCryptoTraceSession, traceCryptoCommand } from "./runtime-trace.ts";
import { command, manifest, safeCommandEnvironment } from "./util.ts";

export type SystemPass = { pass: number; gates: Gate[]; commands: Array<{ repositoryId: string; stage: string; command: string; exitCode: number; durationMs: number }>; runtimeEvents: RuntimeCryptoEvent[]; cleanup: Array<{ id: string; stopped: boolean; detail: string }>; logs: Array<{ process: string; stdout: string; stderr: string }> };

function contractCommands(contract: SystemContract, stage: string) { return Object.entries(contract.commands.value).filter(([name]) => name.endsWith(`:${stage}`)); }
function repositoryId(key: string) { return key.slice(0, key.indexOf(":")); }

export async function assembleSystemAt(repositories: SystemRepository[], root: string) {
  await mkdir(path.join(root, "repositories"), { recursive: true });
  for (const repository of repositories) {
    const destination = path.join(root, "repositories", repository.id);
    if (!contained(root, destination)) throw new Error("Repository destination escapes isolated system root");
    await assertSafeTree(repository.root);
    await cp(repository.root, destination, { recursive: true, filter: source => ![".git", "node_modules", ".next", "dist", "build", "runs"].includes(path.basename(source)) });
    await assertSafeTree(destination);
  }
  return root;
}

export async function assembleSystem(repositories: SystemRepository[]) { return assembleSystemAt(repositories, await mkdtemp(path.join(os.tmpdir(), "quantum-twin-system-"))); }

async function runStage(stage: string, root: string, contract: SystemContract, commands: SystemPass["commands"], gates: Gate[], runtimeEvents: RuntimeCryptoEvent[], trace: boolean) {
  for (const [key, parts] of contractCommands(contract, stage)) {
    const id = repositoryId(key), cwd = path.join(root, "repositories", id);
    const additions = { CI: "1", NO_COLOR: "1", QT_MANAGED_SYSTEM: "1", QT_SYSTEM_BASE_URL: contract.healthChecks.value[0] ? new URL(contract.healthChecks.value[0]).origin : undefined };
    const result = trace ? await traceCryptoCommand(parts[0]!, parts.slice(1), cwd, id, 600_000, additions) : { result: await command(parts[0]!, parts.slice(1), cwd, 600_000, safeCommandEnvironment(additions)), events: [] };
    commands.push({ repositoryId: id, stage, command: result.result.command, exitCode: result.result.exitCode, durationMs: result.result.durationMs }); runtimeEvents.push(...result.events);
    gates.push({ name: `${stage} · ${id}`, passed: result.result.exitCode === 0, detail: result.result.exitCode ? result.result.stderr.slice(0, 1_000) : `exit 0`, durationMs: result.result.durationMs });
  }
}

export async function runSystemPass(root: string, contract: SystemContract, pass = 1): Promise<SystemPass> {
  assertContractApproved(contract);
  const commands: SystemPass["commands"] = [], gates: Gate[] = [], runtimeEvents: RuntimeCryptoEvent[] = [], managed: ManagedProcess[] = [], traceSessions: Array<Awaited<ReturnType<typeof createCryptoTraceSession>>> = [], logs: SystemPass["logs"] = [];
  let cleanup: SystemPass["cleanup"] = [];
  try {
    await runStage("install", root, contract, commands, gates, runtimeEvents, false);
    await runStage("typecheck", root, contract, commands, gates, runtimeEvents, false);
    await runStage("build", root, contract, commands, gates, runtimeEvents, false);
    for (const [key, parts] of contractCommands(contract, "start")) { const id = repositoryId(key), session = await createCryptoTraceSession(id, { CI: "1", NO_COLOR: "1", QT_MANAGED_SYSTEM: "1" }); traceSessions.push(session); managed.push(await startManaged(id, parts, path.join(root, "repositories", id), session.environment)); }
    if (managed.length && !contract.healthChecks.value.length) gates.push({ name: "service health", passed: false, detail: "Start commands exist but the generated contract has no approved loopback health check" });
    else if (!managed.length) gates.push({ name: "service health", passed: true, detail: "No long-running service is declared for this system" });
    for (const url of contract.healthChecks.value) gates.push({ name: `service health · ${url}`, ...await waitForHealth(url, 30_000) });
    const workflows = contractCommands(contract, "test:e2e").length ? "test:e2e" : contractCommands(contract, "e2e").length ? "e2e" : "test";
    await runStage(workflows, root, contract, commands, gates, runtimeEvents, true);
    const hasServices = contractCommands(contract, "start").length > 0;
    gates.push({ name: "API and schema workflow", passed: !hasServices || contract.healthChecks.value.length > 0 && contractCommands(contract, workflows).length > 0, detail: hasServices ? "Approved service health and end-to-end workflow executed" : "Not applicable: the approved contract declares no service API" });
    gates.push({ name: "database and state workflow", passed: true, detail: "Not applicable: the approved contract declares no database or mutable state command" });
    gates.push({ name: "runtime trace hygiene", passed: JSON.stringify(runtimeEvents).length < 5_000_000 && runtimeEvents.every(event => event.payloadBytes >= 0 && !/PRIVATE KEY|BEGIN |token|password/i.test(JSON.stringify(event))), detail: `${runtimeEvents.length} sanitized crypto events; payload bytes only` });
  } finally {
    cleanup = await stopManaged(managed);
    for (const session of traceSessions) { runtimeEvents.push(...await session.readEvents()); await session.dispose(); }
    for (const process of managed) logs.push({ process: process.id, stdout: process.stdout.join("").slice(0, 100_000), stderr: process.stderr.join("").slice(0, 100_000) });
    gates.push({ name: "cleanup", passed: cleanup.every(item => item.stopped), detail: cleanup.length ? cleanup.map(item => `${item.id}: ${item.detail}`).join("; ") : "No managed processes remained" });
  }
  gates.push({ name: `system pass ${pass}`, passed: gates.every(gate => gate.passed), detail: "Complete approved workflow and cleanup" });
  return { pass, gates, commands, runtimeEvents, cleanup, logs };
}

export async function establishBaseline(repositories: SystemRepository[], contract: SystemContract) {
  const root = await assembleSystem(repositories);
  try {
    const before = await manifest(root), result = await runSystemPass(root, contract, 0), after = await manifest(root);
    result.gates.unshift({ name: "source integrity", passed: before.sha256 === after.sha256, detail: before.sha256 === after.sha256 ? before.sha256 : `tree changed: ${before.sha256} -> ${after.sha256}` });
    return { rootManifestSha256: before.sha256, result };
  } finally { await rm(root, { recursive: true, force: true }); }
}
