import { z } from "zod";

export const MODEL = "gpt-5.6-sol";
export const SDK_VERSION = "0.144.6";
export const CONTEXT = "quantum-twin:update-manifest:v1";

export type FindingStatus = "supported" | "discovery-only" | "unknown";
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

export const cryptoFindingSchema = z.object({
  primitive: z.literal("RSA"),
  operation: z.enum(["signing", "verification"]),
  keyLocation: z.string(),
  publicBoundary: z.string(),
  affectedFiles: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).min(1)
});
export type CryptoFinding = z.infer<typeof cryptoFindingSchema>;

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
  finding: CryptoFinding;
  candidates: CandidateResult[];
  selectedCandidate: "direct" | "bridge" | null;
  verifierManifestSha256: string;
  explanation: unknown;
  reportSha256?: string;
  sourceReportSha256?: string;
  presentationReportSha256?: string;
  redaction?: {
    applied: true;
    scope: string;
    description: string;
    byteIdenticalToSourceReport: false;
  };
};
