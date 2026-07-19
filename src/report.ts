import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { cryptoFindingSchema, explanationSchema } from "./domain.ts";
import { sha256 } from "./util.ts";

const hex = z.string().regex(/^[a-f0-9]{64}$/);
const repositorySchema = z.object({ name: z.string().min(1), source: z.string().min(1), resolvedCommit: z.string().nullable() });
const scannerHitSchema = z.object({
  file: z.string().min(1), line: z.number().int().positive(),
  operation: z.enum(["signing", "verification", "key-management", "transport", "token", "unknown"]),
  technology: z.string().min(1), importForm: z.enum(["named", "namespace", "commonjs", "syntax"]),
  algorithmEvidence: z.string(), confidence: z.number().min(0).max(1), status: z.enum(["supported", "discovery-only", "unknown"]),
  snippet: z.string(), reason: z.string().optional(), requiredAdapter: z.string().optional(),
});
const capabilitySchema = z.object({
  repository: repositorySchema, language: z.array(z.string()), moduleType: z.enum(["esm", "commonjs", "mixed", "unknown"]),
  packageManager: z.enum(["pnpm", "npm", "unknown"]), findings: z.array(scannerHitSchema), supported: z.array(scannerHitSchema),
  discoveryOnly: z.array(scannerHitSchema), blockers: z.array(scannerHitSchema), automaticMigrationSupported: z.boolean(), configuration: z.enum(["found", "needed"]),
});
const gateSchema = z.object({ name: z.string().min(1), passed: z.boolean(), detail: z.string(), durationMs: z.number().nonnegative().optional() });
const measurementSchema = z.object({ rsaSignatures: z.number().nonnegative(), envelopeBytes: z.number().nonnegative(), signMedianMs: z.number().nonnegative(), signP95Ms: z.number().nonnegative(), verifyMedianMs: z.number().nonnegative(), verifyP95Ms: z.number().nonnegative() });
const candidateSchema = z.object({
  strategy: z.enum(["direct", "bridge"]), branch: z.string().min(1), threadId: z.string().nullable(), generationDurationMs: z.number().nonnegative(),
  repairAttempted: z.boolean(), generationStatus: z.enum(["eligible", "generation_timed_out", "generation_failed", "gate_failed"]),
  worktreeCommit: z.string().nullable(), diffSha256: hex, diff: z.string(), changedLines: z.number().int().nonnegative(),
  commands: z.array(z.object({ command: z.string().min(1), exitCode: z.number().int(), durationMs: z.number().nonnegative() })),
  gates: z.array(gateSchema), measurements: measurementSchema.nullable(), error: z.string().optional(),
});

export const runReportSchema = z.object({
  runId: z.string().min(1), startedAt: z.string().min(1), completedAt: z.string().min(1), repository: repositorySchema, capabilities: capabilitySchema,
  baselineCommit: z.string().min(1), fixtureManifestSha256: hex, configSha256: hex, nodeVersion: z.string().min(1), platform: z.string().min(1),
  codexSdkVersion: z.string().min(1), model: z.string().min(1), constraintProfile: z.object({ legacyCompatibilityRequired: z.boolean() }),
  repositoryContract: z.object({ version: z.literal(1), target: z.object({ primitive: z.literal("ml-dsa-65"), context: z.string().min(8) }), writablePaths: z.array(z.string()).min(1), protectedPaths: z.array(z.string()).min(1), dependencyPolicy: z.enum(["forbid", "allow-declared"]) }),
  finding: cryptoFindingSchema, candidates: z.array(candidateSchema).min(2), selectedCandidate: z.enum(["direct", "bridge"]).nullable(),
  verifierManifestSha256: hex, explanation: explanationSchema.or(z.object({ unavailable: z.string() })), reportSha256: hex,
}).strict();

export type VerifiedRunReport = z.infer<typeof runReportSchema>;
export type VerificationCheck = { name: string; passed: boolean; detail: string };
export type VerificationResult = { valid: boolean; report: string; reportSha256: string | null; selectedCandidate: "direct" | "bridge" | null; checks: VerificationCheck[] };

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

export function verifyReportData(value: unknown, report = "inline"): VerificationResult {
  const checks: VerificationCheck[] = [];
  const add = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail });
  const parsed = runReportSchema.safeParse(value);
  add("schema", parsed.success, parsed.success ? "current generalized report schema" : parsed.error?.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") ?? "invalid JSON");
  if (!parsed.success) return { valid: false, report, reportSha256: null, selectedCandidate: null, checks };
  const data = parsed.data;
  const { reportSha256, ...withoutHash } = value as Record<string, unknown> & { reportSha256: string };
  const actualHash = sha256(JSON.stringify(withoutHash, null, 2));
  add("report hash", actualHash === reportSha256, actualHash === reportSha256 ? actualHash : `expected ${reportSha256}; computed ${actualHash}`);
  for (const candidate of data.candidates) add(`diff hash: ${candidate.strategy}`, sha256(candidate.diff) === candidate.diffSha256, candidate.diffSha256);
  const selected = data.candidates.find(candidate => candidate.strategy === data.selectedCandidate);
  const eligible = data.candidates.filter(candidate => candidate.generationStatus === "eligible" && candidate.gates.every(gate => gate.passed));
  const expectedSelection = [...eligible].sort((a, b) =>
    (a.measurements?.rsaSignatures ?? Number.MAX_SAFE_INTEGER) - (b.measurements?.rsaSignatures ?? Number.MAX_SAFE_INTEGER)
    || a.changedLines - b.changedLines
    || (a.measurements?.envelopeBytes ?? Number.MAX_SAFE_INTEGER) - (b.measurements?.envelopeBytes ?? Number.MAX_SAFE_INTEGER)
  )[0]?.strategy ?? null;
  add("selection exists", data.selectedCandidate === null || Boolean(selected), data.selectedCandidate ?? "NO SAFE WINNER");
  add("selected eligibility", data.selectedCandidate === null || Boolean(selected && selected.generationStatus === "eligible" && selected.gates.every(gate => gate.passed)), data.selectedCandidate ?? "none");
  add("deterministic selection", data.selectedCandidate === expectedSelection, `recorded=${data.selectedCandidate ?? "none"}; expected=${expectedSelection ?? "none"}`);
  add("no-safe-winner policy", data.selectedCandidate !== null || eligible.length === 0, `${eligible.length} eligible candidate(s)`);
  if (data.constraintProfile.legacyCompatibilityRequired && selected) {
    const compatibility = selected.gates.filter(gate => gate.name.startsWith("legacy compatibility"));
    add("required compatibility", compatibility.length >= 2 && compatibility.every(gate => gate.passed), `${compatibility.length} compatibility gate(s)`);
  } else add("required compatibility", true, "not required or no selected candidate");
  for (const candidate of data.candidates.filter(item => item.gates.length)) {
    const pass1 = candidate.gates.filter(gate => gate.name.includes("(pass 1)"));
    const pass2 = candidate.gates.filter(gate => gate.name.includes("(pass 2)"));
    add(`two evaluator passes: ${candidate.strategy}`, pass1.length > 0 && pass2.length > 0, `pass1=${pass1.length}; pass2=${pass2.length}`);
    const repeatability = candidate.gates.find(gate => gate.name === "repeatability");
    const expectedRepeatability = [...pass1, ...pass2].every(gate => gate.passed);
    add(`repeatability: ${candidate.strategy}`, Boolean(repeatability && repeatability.passed === expectedRepeatability), `recorded=${repeatability?.passed ?? "missing"}; expected=${expectedRepeatability}`);
  }
  add("provenance", data.model.length > 0 && data.codexSdkVersion.length > 0 && data.repository.source.startsWith("local:"), `${data.model}; SDK ${data.codexSdkVersion}; ${data.repository.source}`);
  const text = strings(data);
  const personalPath = /(?:[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/]+|\/Users\/[^/]+\/|\/home\/[^/]+\/)/i;
  add("personal paths", !text.some(item => personalPath.test(item)), "no absolute personal path");
  const secret = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|OPENAI_API_KEY\s*=\s*\S+|\bsk-[A-Za-z0-9_-]{20,}\b/i;
  add("secret material", !text.some(item => secret.test(item)), "no obvious secret, private key, or token");
  return { valid: checks.every(check => check.passed), report, reportSha256, selectedCandidate: data.selectedCandidate, checks };
}

export async function verifyReportFile(file: string) {
  const resolved = path.resolve(file);
  const label = file.replaceAll("\\", "/");
  try { return verifyReportData(JSON.parse(await readFile(resolved, "utf8")), label); }
  catch (error) { return { valid: false, report: label, reportSha256: null, selectedCandidate: null, checks: [{ name: "JSON", passed: false, detail: error instanceof Error ? error.message : String(error) }] } satisfies VerificationResult; }
}
