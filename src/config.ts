import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const relativePath = z.string().min(1).refine(value => {
  const normalized = value.replaceAll("\\", "/");
  return !path.isAbsolute(value) && !normalized.split("/").includes("..");
}, "must be a contained repository-relative path");

const commandSchema = z.array(z.string().min(1)).min(1);

export const quantumTwinConfigSchema = z.object({
  version: z.literal(1),
  repository: z.object({ name: z.string().min(1) }),
  sourcePrimitive: z.literal("RSA").optional(),
  includedSourceGlobs: z.array(z.string().min(1)).min(1),
  excludedGlobs: z.array(z.string().min(1)).default([]),
  writablePaths: z.array(relativePath).min(1),
  protectedPaths: z.array(relativePath).min(1),
  packageManager: z.enum(["auto", "npm", "pnpm"]),
  commands: z.object({
    install: commandSchema,
    typecheck: commandSchema,
    test: commandSchema,
    build: commandSchema.optional(),
    compatibility: commandSchema.optional()
  }),
  compatibilityHarness: relativePath.optional(),
  legacyCompatibilityRequired: z.boolean(),
  target: z.object({
    primitive: z.literal("ml-dsa-65"),
    context: z.string().min(8).max(255)
  }),
  dependencyPolicy: z.enum(["forbid", "allow-declared"]),
  timeouts: z.object({
    scanMs: z.number().int().min(1_000).max(120_000),
    commandMs: z.number().int().min(1_000).max(600_000),
    candidateMs: z.number().int().min(10_000).max(1_200_000)
  }),
  limits: z.object({
    maxFiles: z.number().int().min(1).max(20_000),
    maxFileBytes: z.number().int().min(1_024).max(10_000_000),
    maxTotalBytes: z.number().int().min(1_024).max(200_000_000)
  })
}).strict().refine(config => config.compatibilityHarness || config.commands.compatibility, {
  message: "compatibilityHarness or commands.compatibility is required"
}).superRefine((config, context) => {
  const normalize = (value: string) => value.replaceAll("\\", "/").replace(/\/$/, "");
  for (const writable of config.writablePaths.map(normalize)) for (const protectedPath of config.protectedPaths.map(normalize)) {
    if (writable === protectedPath || writable.startsWith(`${protectedPath}/`) || protectedPath.startsWith(`${writable}/`)) context.addIssue({ code: "custom", path: ["writablePaths"], message: `writable and protected paths overlap: ${writable}, ${protectedPath}` });
  }
});

export type QuantumTwinConfig = z.infer<typeof quantumTwinConfigSchema>;

export async function loadConfig(file: string): Promise<QuantumTwinConfig> {
  const parsed = JSON.parse(await readFile(file, "utf8"));
  return quantumTwinConfigSchema.parse(parsed);
}

export function detectPackageManager(root: string, requested: QuantumTwinConfig["packageManager"] = "auto") {
  if (requested !== "auto") return requested;
  const files = new Set(readdirSync(root));
  if (files.has("pnpm-lock.yaml")) return "pnpm" as const;
  if (files.has("package-lock.json")) return "npm" as const;
  return "unknown" as const;
}
