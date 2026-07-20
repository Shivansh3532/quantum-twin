import path from "node:path";
import { inspectRepository } from "./capabilities.ts";
import { runDemo, runRepository } from "./engine.ts";
import { preflight } from "./preflight.ts";
import { verifyReportFile } from "./report.ts";
import { scanRepository } from "./scanner.ts";
import { assessNistPosture } from "./nist.ts";

const args = process.argv.slice(2);
const action = args[0];
const value = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const required = (flag: string) => value(flag) ?? (() => { throw new Error(`${flag} is required`); })();

if (action === "preflight") console.log(JSON.stringify(await preflight(), null, 2));
else if (action === "demo" || action === "demo-no-compat") {
  const report = await runDemo(action === "demo");
  console.log(JSON.stringify({ runId: report.runId, selectedCandidate: report.selectedCandidate, reportSha256: report.reportSha256, candidates: report.candidates.map(candidate => ({ strategy: candidate.strategy, status: candidate.generationStatus, threadId: candidate.threadId })) }, null, 2));
  if (!report.selectedCandidate) process.exitCode = 1;
} else if (action === "scan" || action === "capabilities") {
  const { report } = await inspectRepository(required("--repo"), value("--config"));
  console.log(JSON.stringify(report, null, 2));
  if (report.blockers.length) process.exitCode = 2;
} else if (action === "run") {
  const report = await runRepository(required("--repo"), path.resolve(required("--config")), args.includes("--allow-exec"));
  console.log(JSON.stringify({ runId: report.runId, selectedCandidate: report.selectedCandidate, reportSha256: report.reportSha256 }, null, 2));
  if (!report.selectedCandidate) process.exitCode = 1;
} else if (action === "verify") {
  const result = await verifyReportFile(required("--report"));
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
} else if (action === "nist") {
  const hits = await scanRepository(path.resolve(required("--repo")));
  const posture = assessNistPosture(hits);
  console.log(JSON.stringify({ badge: posture.badge, badgeLabel: posture.badgeLabel, completePercent: posture.completePercent, achievable: posture.achievable, counts: posture.counts, ownerActions: posture.ownerActions, remainingPlan: posture.remainingPlan, boundaries: posture.boundaries, sha256: posture.sha256 }, null, 2));
  if (posture.counts.external > 0) process.exitCode = 2;
}
else throw new Error(`Unknown command: ${action ?? "(missing)"}`);
