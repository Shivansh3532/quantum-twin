import path from "node:path";
import { inspectRepository } from "./capabilities.ts";
import { runDemo, runRepository } from "./engine.ts";
import { preflight } from "./preflight.ts";
import { verifyReportFile } from "./report.ts";

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
}
else throw new Error(`Unknown command: ${action ?? "(missing)"}`);
