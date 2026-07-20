import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { detectPackageManager, loadConfig, type QuantumTwinConfig } from "./config.ts";
import type { CapabilityReport } from "./domain.ts";
import { sourceIdentity } from "./repository.ts";
import { scanRepository } from "./scanner.ts";

async function exists(file: string) {
  try { await access(file); return true; } catch { return false; }
}

export async function inspectRepository(source: string, configPath?: string, repositoryOverride?: CapabilityReport["repository"], tolerateInvalidConfig = false): Promise<{ report: CapabilityReport; config?: QuantumTwinConfig; configError?: string }> {
  const identity = await sourceIdentity(source);
  const defaultConfig = path.join(identity.root, "quantum-twin.config.json");
  const selectedConfig = configPath ? path.resolve(configPath) : await exists(defaultConfig) ? defaultConfig : undefined;
  let config: QuantumTwinConfig | undefined, configError: string | undefined;
  if (selectedConfig) try { config = await loadConfig(selectedConfig); }
  catch (error) {
    if (!tolerateInvalidConfig) throw error;
    configError = error instanceof Error ? error.message : String(error);
  }
  let packageJson: { type?: string } = {};
  try { packageJson = JSON.parse(await readFile(path.join(identity.root, "package.json"), "utf8")); } catch { /* Discovery-only repository. */ }
  const findings = await scanRepository(identity.root, config);
  const supported = findings.filter(item => item.status === "supported");
  const discoveryOnly = findings.filter(item => item.status === "discovery-only");
  const blockers = findings.filter(item => item.status === "unknown");
  const operations = new Set(supported.map(item => item.operation));
  const extensions = new Set(findings.map(item => path.extname(item.file).toLowerCase()));
  const language = [extensions.has(".ts") || extensions.has(".tsx") ? "TypeScript" : "", extensions.has(".js") || extensions.has(".jsx") || extensions.has(".cjs") || extensions.has(".mjs") ? "JavaScript" : ""].filter(Boolean);
  const moduleType = packageJson.type === "module" ? "esm" : extensions.has(".mjs") && extensions.has(".cjs") ? "mixed" : packageJson.type === "commonjs" || extensions.has(".cjs") ? "commonjs" : "unknown";
  return {
    config, configError,
    report: {
      repository: repositoryOverride ?? { name: config?.repository.name ?? identity.name, source: `local:${identity.name}`, resolvedCommit: identity.resolvedCommit },
      language,
      moduleType,
      packageManager: detectPackageManager(identity.root, config?.packageManager),
      findings,
      supported,
      discoveryOnly,
      blockers,
      automaticMigrationSupported: Boolean(config && operations.has("signing") && operations.has("verification") && !discoveryOnly.length && !blockers.length),
      configuration: selectedConfig ? "found" : "needed"
    }
  };
}
