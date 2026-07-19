import { Codex } from "@openai/codex-sdk";
import { cryptoFindingSchema, explanationSchema, MODEL, type CryptoFinding, type ScannerHit } from "./domain.ts";

const findingJsonSchema = {
  type: "object", properties: {
    primitive: { type: "string", enum: ["RSA"] }, operations: { type: "array", items: { type: "string", enum: ["signing", "verification"] }, minItems: 1 },
    keyLocation: { type: "string" }, publicBoundary: { type: "string" },
    affectedFiles: { type: "array", items: { type: "string" }, minItems: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "array", items: { type: "string" }, minItems: 1 }
  }, required: ["primitive", "operations", "keyLocation", "publicBoundary", "affectedFiles", "confidence", "evidence"], additionalProperties: false
} as const;

const explanationJsonSchema = {
  type: "object", properties: {
    summary: { type: "string" }, whySelected: { type: "string" },
    limitations: { type: "array", items: { type: "string" } }
  }, required: ["summary", "whySelected", "limitations"], additionalProperties: false
} as const;

const readOnlyThread = (workingDirectory: string) => new Codex().startThread({
  model: MODEL, modelReasoningEffort: "high", workingDirectory,
  sandboxMode: "read-only", networkAccessEnabled: false, webSearchMode: "disabled", approvalPolicy: "never"
});

export function validateClassification(finding: CryptoFinding, scannerEvidence: ScannerHit[]) {
  const expectedFiles = [...new Set(scannerEvidence.map(item => item.file))].sort();
  const expectedOperations = [...new Set(scannerEvidence.map(item => item.operation).filter((operation): operation is "signing" | "verification" => operation === "signing" || operation === "verification"))].sort();
  const actualFiles = [...new Set(finding.affectedFiles)].sort();
  const actualOperations = [...finding.operations].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error("GPT affectedFiles contradict deterministic scanner evidence");
  if (JSON.stringify(actualOperations) !== JSON.stringify(expectedOperations)) throw new Error("GPT operations contradict deterministic scanner evidence");
  return finding;
}

export async function classifyWithGpt(workingDirectory: string, scannerEvidence: ScannerHit[]) {
  const turn = await readOnlyThread(workingDirectory).run(
    `Classify this deterministic scanner evidence. Do not claim more than evidence supports. JSON only.\n${JSON.stringify(scannerEvidence)}`,
    { outputSchema: findingJsonSchema }
  );
  return validateClassification(cryptoFindingSchema.parse(JSON.parse(turn.finalResponse)), scannerEvidence);
}

export async function explainWithGpt(workingDirectory: string, immutableEvidence: unknown) {
  const turn = await readOnlyThread(workingDirectory).run(
    `Explain immutable Quantum Twin result. Never change selection, gates, or measurements. JSON only.\n${JSON.stringify(immutableEvidence)}`,
    { outputSchema: explanationJsonSchema }
  );
  return explanationSchema.parse(JSON.parse(turn.finalResponse));
}
