import type { SystemRunReport } from "./system-engine.ts";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { command, sha256 } from "./util.ts";

function splitRepositoryPatch(diff: string) {
  const result: Record<string, string[]> = {}; let current: string | undefined;
  for (const line of diff.split(/(?=^diff --git )/m)) {
    const match = /^diff --git a\/repositories\/([^/]+)\//.exec(line); if (!match) continue;
    current = match[1]!; (result[current] ??= []).push(line);
  }
  return Object.fromEntries(Object.entries(result).map(([repository, sections]) => [repository, sections.join("")]));
}

export function createSystemEvidenceBundle(report: SystemRunReport) {
  const selected = report.candidates.find(candidate => candidate.strategy === report.selectedCandidate), patches = selected ? splitRepositoryPatch(selected.diff) : {};
  const body = { version: 1, run: report, selection: report.selectedCandidate, patches, migrationPlan: { decision: report.decision, changedRepositories: selected?.changedRepositories ?? [], rollout: report.rollout, warning: "Passing engineering gates is not certification or production approval. Applying requires clean repositories and separate typed confirmation." } };
  return { ...body, evidenceBundleSha256: sha256(JSON.stringify(body)) };
}

export async function createCoordinatedLocalBranches(evidence: { run: Pick<SystemRunReport, "runId">; selection: string | null; patches: Record<string, string> }, repositories: Record<string, string>, typedApproval: string) {
  if (typedApproval !== "CREATE COORDINATED LOCAL BRANCHES") throw new Error("Typed confirmation must be CREATE COORDINATED LOCAL BRANCHES");
  if (!evidence.selection || !Object.keys(evidence.patches).length) throw new Error("Evidence has no selected coordinated patch");
  const ids = Object.keys(evidence.patches).sort();
  if (ids.some(id => !repositories[id])) throw new Error(`Explicit repository mapping required for: ${ids.filter(id => !repositories[id]).join(", ")}`);
  const branch = `quantum-twin/${evidence.run.runId.replace(/[^A-Za-z0-9-]/g, "-")}-${evidence.selection}`;
  const temporary = await mkdtemp(path.join(os.tmpdir(), "quantum-twin-apply-")), prepared: Array<{ id: string; root: string; patchFile: string }> = [];
  try {
    for (const id of ids) {
      const root = path.resolve(repositories[id]!);
      const status = await command("git", ["status", "--porcelain"], root); if (status.exitCode || status.stdout.trim()) throw new Error(`${id}: repository must be a clean Git working tree`);
      const exists = await command("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], root); if (exists.exitCode === 0) throw new Error(`${id}: branch already exists: ${branch}`);
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), normalized = evidence.patches[id]!.replace(new RegExp(`([ab])/repositories/${escaped}/`, "g"), "$1/");
      if (/-----BEGIN (?:RSA |EC |OPENSSH |ML-DSA |ML-KEM )?PRIVATE KEY-----/i.test(normalized)) throw new Error(`${id}: patch contains private-key material`);
      const patchFile = path.join(temporary, `${id}.patch`); await writeFile(patchFile, normalized, { mode: 0o600 });
      const check = await command("git", ["apply", "--check", patchFile], root); if (check.exitCode) throw new Error(`${id}: patch preflight failed: ${check.stderr}`);
      prepared.push({ id, root, patchFile });
    }
    const results: Array<{ repositoryId: string; branch: string; commit: string }> = [];
    for (const item of prepared) {
      const worktree = path.join(temporary, `worktree-${item.id}`), added = await command("git", ["worktree", "add", "-b", branch, worktree, "HEAD"], item.root); if (added.exitCode) throw new Error(`${item.id}: ${added.stderr}`);
      try {
        const applied = await command("git", ["apply", item.patchFile], worktree); if (applied.exitCode) throw new Error(`${item.id}: ${applied.stderr}`);
        await command("git", ["add", "--all"], worktree);
        const committed = await command("git", ["-c", "user.name=Quantum Twin", "-c", "user.email=quantum-twin@local", "commit", "-m", `feat: apply coordinated ${evidence.selection} migration`], worktree); if (committed.exitCode) throw new Error(`${item.id}: ${committed.stderr}`);
        results.push({ repositoryId: item.id, branch, commit: (await command("git", ["rev-parse", "HEAD"], worktree)).stdout.trim() });
      } finally { await command("git", ["worktree", "remove", "--force", worktree], item.root); }
    }
    return results;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
