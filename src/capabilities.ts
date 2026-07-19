import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { detectPackageManager, loadConfig, type QuantumTwinConfig } from "./config.ts";
import type { CapabilityReport } from "./domain.ts";
import { sourceIdentity } from "./repository.ts";
import { scanRepository } from "./scanner.ts";

async function exists(file: string) {
  try { await access(file); return true; } catch { return false; }
}

export async function inspectRepository(source: string, configPath?: string): Promise<{ report: CapabilityReport; config?: QuantumTwinConfig }> {
  const identity = await sourceIdentity(source);
  const defaultConfig = path.join(identity.root, "quantum-twin.config.json");
  const selectedConfig = configPath ? path.resolve(configPath) : await exists(defaultConfig) ? defaultConfig : undefined;
  const config = selectedConfig ? await loadConfig(selectedConfig) : undefined;
  let packageJson: { type?: string } = {};
  try { packageJson = JSON.parse(await readFile(path.join(identity.root, "package.json"), "utf8")); } catch { /* Discovery-only repository. */ }
  const findings = await scanRepository(identity.root, config);
  const supported = findings.filter(item => item.status === "supported");
  const discoveryOnly = findings.filter(item => item.status === "discovery-only");
  const blockers = findings.filter(item => item.status === "unknown");
  const extensions = new Set(findings.map(item => path.extname(item.file).toLowerCase()));
  const language = [extensions.has(".ts") || extensions.has(".tsx") ? "TypeScript" : "", extensions.has(".js") || extensions.has(".jsx") || extensions.has(".cjs") || extensions.has(".mjs") ? "JavaScript" : ""].filter(Boolean);
  const moduleType = packageJson.type === "module" ? "esm" : extensions.has(".mjs") && extensions.has(".cjs") ? "mixed" : packageJson.type === "commonjs" || extensions.has(".cjs") ? "commonjs" : "unknown";
  return {
    config,
    report: {
      repository: { name: config?.repository.name ?? identity.name, source: `local:${identity.name}`, resolvedCommit: identity.resolvedCommit },
      language,
      moduleType,
      packageManager: detectPackageManager(identity.root, config?.packageManager),
      findings,
      supported,
      discoveryOnly,
      blockers,
      automaticMigrationSupported: Boolean(config && supported.length && !discoveryOnly.length && !blockers.length),
      configuration: config ? "found" : "needed"
    }
  };
}
