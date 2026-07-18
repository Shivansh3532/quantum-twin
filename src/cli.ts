import { preflight } from "./preflight.ts";
import { runDemo } from "./engine.ts";

const action = process.argv[2];
if (action === "preflight") console.log(JSON.stringify(await preflight(), null, 2));
else if (action === "demo") {
  const report = await runDemo();
  console.log(JSON.stringify({ runId: report.runId, selectedCandidate: report.selectedCandidate, reportSha256: report.reportSha256, candidates: report.candidates.map(c => ({ strategy: c.strategy, status: c.generationStatus, threadId: c.threadId })) }, null, 2));
  if (!report.selectedCandidate) process.exitCode = 1;
} else if (action === "verify") console.log("Use pnpm demo to create and verify a run twice.");
else throw new Error(`Unknown command: ${action ?? "(missing)"}`);
