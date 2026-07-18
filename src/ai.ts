import { Codex } from "@openai/codex-sdk";
import { cryptoFindingSchema, explanationSchema, MODEL } from "./domain.ts";

const findingJsonSchema = {
  type: "object", properties: {
    primitive: { type: "string", enum: ["RSA"] }, operation: { type: "string", enum: ["signing", "verification"] },
    keyLocation: { type: "string" }, publicBoundary: { type: "string" },
    affectedFiles: { type: "array", items: { type: "string" }, minItems: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "array", items: { type: "string" }, minItems: 1 }
  }, required: ["primitive", "operation", "keyLocation", "publicBoundary", "affectedFiles", "confidence", "evidence"], additionalProperties: false
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

export async function classifyWithGpt(workingDirectory: string, scannerEvidence: unknown) {
  const turn = await readOnlyThread(workingDirectory).run(
    `Classify this deterministic scanner evidence. Do not claim more than evidence supports. JSON only.\n${JSON.stringify(scannerEvidence)}`,
    { outputSchema: findingJsonSchema }
  );
  return cryptoFindingSchema.parse(JSON.parse(turn.finalResponse));
}

export async function explainWithGpt(workingDirectory: string, immutableEvidence: unknown) {
  const turn = await readOnlyThread(workingDirectory).run(
    `Explain immutable Quantum Twin result. Never change selection, gates, or measurements. JSON only.\n${JSON.stringify(immutableEvidence)}`,
    { outputSchema: explanationJsonSchema }
  );
  return explanationSchema.parse(JSON.parse(turn.finalResponse));
}
