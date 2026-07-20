import path from "node:path";
import { approveSystemContract, createSystemBundle } from "../src/system-bundle.ts";
import { runSystemTournament } from "../src/system-engine.ts";

const root = path.join(process.cwd(), "proof-systems", "multi-repository");
const bundle = await createSystemBundle("Quantum Twin coordinated multi-repository demo", [
  { root: path.join(root, "producer"), id: "producer", source: "project-proof:producer" },
  { root: path.join(root, "consumer"), id: "consumer", source: "project-proof:consumer" }
], { frozenConsumers: ["frozen-rsa-client-v1"] });
bundle.contract = approveSystemContract(bundle.contract);
const report = await runSystemTournament(bundle, { allowExec: true, onEvent: (stage, detail) => console.error(`[${stage}] ${detail}`) });
console.log(JSON.stringify({ runId: report.runId, selectedCandidate: report.selectedCandidate, reportSha256: report.reportSha256, bundleManifestSha256: report.bundleManifestSha256, graphSha256: report.graphSha256, contractSha256: report.contractSha256, candidates: report.candidates.map(candidate => ({ strategy: candidate.strategy, threadId: candidate.threadId, status: candidate.generationStatus, eligible: candidate.eligible, commit: candidate.commit, diffSha256: candidate.diffSha256, changedRepositories: candidate.changedRepositories, failedGates: candidate.gates.filter(gate => !gate.passed).map(gate => `${gate.name}: ${gate.detail}`) })) }, null, 2));
if (!report.selectedCandidate) process.exitCode = 1;
