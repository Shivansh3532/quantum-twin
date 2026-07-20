import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inspectRepository } from "../src/capabilities.ts";
import { clonePublicRepository, validateAnalysisTree } from "../src/intake.ts";
import { command } from "../src/util.ts";

const URL = "https://github.com/nodejs/corepack";
const COMMIT = "436b358a19f6d2592cff740078db1b06953c3578";

const root = await mkdtemp(path.join(os.tmpdir(), "quantum-twin-corepack-"));
const repository = path.join(root, "repository");
try {
  const hooks = path.join(root, "empty-hooks");
  await mkdir(hooks);
  const cloned = await clonePublicRepository(URL, repository, { timeoutMs: 180_000 });
  if (cloned.resolvedCommit !== COMMIT) {
    const fetched = await command("git", ["-c", "credential.helper=", "fetch", "--depth=1", "--no-tags", "origin", COMMIT], repository);
    if (fetched.exitCode) throw new Error(`Could not fetch pinned Corepack commit: ${fetched.stderr}`);
    const checkedOut = await command("git", ["-c", `core.hooksPath=${hooks}`, "checkout", "--detach", COMMIT], repository);
    if (checkedOut.exitCode) throw new Error(`Could not check out pinned Corepack commit: ${checkedOut.stderr}`);
  }

  const skippedFiles = await validateAnalysisTree(repository);
  const { report } = await inspectRepository(repository, undefined, { name: "corepack", source: URL, resolvedCommit: COMMIT }, true, { nodeOnly: true });
  const skipped = skippedFiles.find(file => file.path === "tests/nocks.db");
  if (!skipped) throw new Error("Pinned Corepack regression did not report tests/nocks.db as skipped");
  if (report.configuration !== "needed" || report.automaticMigrationSupported) throw new Error("Pinned Corepack scan must remain analysis-only and contract-required");
  process.stdout.write(`${JSON.stringify({ commit: COMMIT, skipped, findings: { total: report.findings.length, supported: report.supported.length, discoveryOnly: report.discoveryOnly.length, ambiguous: report.blockers.length }, configuration: report.configuration, automaticMigrationSupported: report.automaticMigrationSupported, repositoryCommandsExecuted: 0, migrationAttempted: false }, null, 2)}\n`);
} finally {
  await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
