import { z } from "zod";

export const MODEL = "gpt-5.6-sol";
export const SDK_VERSION = "0.144.6";
export const CONTEXT = "quantum-twin:update-manifest:v1";

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
export type CandidateResult = {
  strategy: "direct" | "bridge";
  branch: string;
  threadId: string | null;
  generationStatus: "eligible" | "generation_timed_out" | "generation_failed" | "gate_failed";
  worktreeCommit: string | null;
  diffSha256: string;
  changedLines: number;
  gates: Gate[];
  measurements: { rsaSignatures: number; envelopeBytes: number; signMedianMs: number; signP95Ms: number; verifyMedianMs: number; verifyP95Ms: number } | null;
  error?: string;
};
