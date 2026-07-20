import { z } from "zod";

// ponytail: gpt-5.6-sol only accepts API-billing Codex; ChatGPT-account login (the documented judge path) rejects it.
// Default to a ChatGPT-Codex-compatible model; QT_MODEL overrides for API-billing users who want gpt-5.6-sol.
export const MODEL = process.env.QT_MODEL ?? "gpt-5-codex";
export const SDK_VERSION = "0.144.6";
export const CONTEXT = "quantum-twin:update-manifest:v1";

export type FindingStatus = "supported" | "discovery-only" | "unknown";
export type NistPrimitive = "RSA-SIG" | "RSA-KEM" | "ECDSA" | "ECDH" | "DH" | "EXTERNAL" | "SYMMETRIC" | "UNKNOWN";
export type ScannerHit = {
  file: string;
  line: number;
  operation: "signing" | "verification" | "key-management" | "transport" | "token" | "unknown";
  technology: string;
  importForm: "named" | "namespace" | "commonjs" | "syntax";
  algorithmEvidence: string;
  confidence: number;
  status: FindingStatus;
  snippet: string;
  reason?: string;
  requiredAdapter?: string;
  // Optional NIST primitive annotation. Set only by the expanded detector for
  // non-RSA boundaries; existing RSA hits omit it and stay byte-identical.
  primitive?: NistPrimitive;
};

export type CapabilityReport = {
  repository: { name: string; source: string; resolvedCommit: string | null };
  language: string[];
  moduleType: "esm" | "commonjs" | "mixed" | "unknown";
  packageManager: "pnpm" | "npm" | "unknown";
  findings: ScannerHit[];
  supported: ScannerHit[];
  discoveryOnly: ScannerHit[];
  blockers: ScannerHit[];
  automaticMigrationSupported: boolean;
  configuration: "found" | "needed";
};

export const cryptoOperationSchema = z.enum(["signing", "verification"]);
export const cryptoFindingSchema = z.object({
  primitive: z.literal("RSA"),
  operations: z.array(cryptoOperationSchema).min(1).refine(values => new Set(values).size === values.length, "operations must be unique"),
  keyLocation: z.string(),
  publicBoundary: z.string(),
  affectedFiles: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).min(1)
});
export type CryptoFinding = z.infer<typeof cryptoFindingSchema>;
export const historicalCryptoFindingSchema = cryptoFindingSchema.omit({ operations: true }).extend({ operation: cryptoOperationSchema });
export type HistoricalCryptoFinding = z.infer<typeof historicalCryptoFindingSchema>;

export const explanationSchema = z.object({
  summary: z.string(),
  whySelected: z.string(),
  limitations: z.array(z.string())
});

export type Gate = { name: string; passed: boolean; detail: string; durationMs?: number };
export type HarnessResult = { gates: Gate[]; measurements: CandidateResult["measurements"] };
export type CandidateResult = {
  strategy: "direct" | "bridge";
  branch: string;
  threadId: string | null;
  generationDurationMs: number;
  repairAttempted: boolean;
  generationStatus: "eligible" | "generation_timed_out" | "generation_failed" | "gate_failed";
  worktreeCommit: string | null;
  diffSha256: string;
  diff: string;
  changedLines: number;
  commands: Array<{ command: string; exitCode: number; durationMs: number }>;
  gates: Gate[];
  measurements: { rsaSignatures: number; envelopeBytes: number; signMedianMs: number; signP95Ms: number; verifyMedianMs: number; verifyP95Ms: number } | null;
  error?: string;
};

export type RunReport = {
  runId: string;
  startedAt: string;
  completedAt: string;
  repository?: CapabilityReport["repository"];
  capabilities?: CapabilityReport;
  baselineCommit: string;
  fixtureManifestSha256: string;
  configSha256?: string;
  nodeVersion: string;
  platform: string;
  codexSdkVersion: string;
  model: string;
  constraintProfile: { legacyCompatibilityRequired: boolean };
  repositoryContract?: {
    version: 1;
    target: { primitive: "ml-dsa-65"; context: string };
    writablePaths: string[];
    protectedPaths: string[];
    dependencyPolicy: "forbid" | "allow-declared";
  };
  finding: CryptoFinding | HistoricalCryptoFinding;
  candidates: CandidateResult[];
  selectedCandidate: "direct" | "bridge" | null;
  verifierManifestSha256: string;
  permissionNormalizations?: string[];
  explanation: unknown;
  reportSha256: string;
};
