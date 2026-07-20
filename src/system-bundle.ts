import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileSha256, manifest, sha256 } from "./util.ts";
import { scanRepository } from "./scanner.ts";
import type { ScannerHit } from "./domain.ts";

export type ProvenanceKind = "observed-source" | "observed-runtime" | "inferred-deterministically" | "suggested-gpt" | "supplied-user";
export type Provenance<T> = { value: T; provenance: ProvenanceKind; evidence: string[] };
export type PackageManager = "npm" | "pnpm" | "yarn" | "unknown";
export type SystemRepository = {
  id: string;
  name: string;
  source: string;
  root: string;
  commit: string | null;
  treeSha256: string;
  packageManager: PackageManager;
  runtime: "node";
  moduleType: "esm" | "commonjs" | "mixed" | "unknown";
  commands: Record<string, string[]>;
  entryPoints: string[];
  sourceDirectories: string[];
  protectedPaths: string[];
  ports: number[];
  healthChecks: string[];
};
export type SystemComponent = {
  id: string;
  repositoryId: string;
  name: string;
  kind: "service" | "package" | "cli" | "worker";
  root: string;
  dependencies: string[];
  ports: number[];
  healthChecks: string[];
};
export type CryptoNode = { id: string; kind: "repository" | "package" | "service" | "endpoint" | "producer" | "consumer" | "verification" | "encryption" | "envelope" | "external" | "key-source" | "deployment"; label: string; repositoryId?: string; location?: string; controlled: boolean };
export type CryptoEdge = { from: string; to: string; kind: "signs" | "verifies" | "encrypts" | "decrypts" | "sends" | "receives" | "stores" | "reads" | "depends-on" | "deployed-with" | "frozen-compatibility"; evidence: string[] };
export type RuntimeCryptoEvent = { operation: "sign" | "verify" | "encrypt" | "decrypt" | "encapsulate" | "decapsulate"; algorithm: string; keyType: string; callSite: string; payloadBytes: number; outputBytes?: number; context?: string; componentId?: string };
export type SystemCryptoGraph = { nodes: CryptoNode[]; edges: CryptoEdge[]; staticFindings: ScannerHit[]; runtimeEvents: RuntimeCryptoEvent[]; unaccountedConsumers: string[]; sha256: string };
export type SystemContract = {
  version: 2;
  systemName: Provenance<string>;
  repositories: Provenance<Array<Pick<SystemRepository, "id" | "source" | "commit" | "treeSha256">>>;
  commands: Provenance<Record<string, string[]>>;
  entryPoints: Provenance<string[]>;
  healthChecks: Provenance<string[]>;
  workflows: Provenance<string[][]>;
  protectedPaths: Provenance<string[]>;
  writablePaths: Provenance<string[]>;
  frozenConsumers: Provenance<string[]>;
  dependencyChanges: Provenance<"forbid" | "allow-reviewed">;
  runtime: Provenance<"node>=24.18.0 <25">;
  boundaries: Provenance<Array<"ml-dsa-65" | "ml-kem-768-kem-dem">>;
  envelopeVersions: Provenance<string[]>;
  performanceLimitPercent: Provenance<number>;
  rollbackRequired: Provenance<boolean>;
  cleanupRequired: Provenance<boolean>;
  forbiddenOperations: Provenance<string[]>;
  approved: boolean;
  sha256: string;
};
export type SystemBundle = { version: 1; name: string; repositories: SystemRepository[]; components: SystemComponent[]; graph: SystemCryptoGraph; contract: SystemContract; createdAt: string; manifestSha256: string };

const sourceExtensions = new Set([".js", ".cjs", ".mjs", ".jsx", ".ts", ".cts", ".mts", ".tsx"]);
const normalized = (value: string) => value.replaceAll("\\", "/");
const unique = <T>(values: T[]) => [...new Set(values)];
const inferred = <T>(value: T, ...evidence: string[]): Provenance<T> => ({ value, provenance: "inferred-deterministically", evidence });
const observed = <T>(value: T, ...evidence: string[]): Provenance<T> => ({ value, provenance: "observed-source", evidence });

async function exists(file: string) { try { await stat(file); return true; } catch { return false; } }
async function json(file: string) { try { return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>; } catch { return {}; } }

function manager(files: Set<string>): PackageManager {
  if (files.has("pnpm-lock.yaml")) return "pnpm";
  if (files.has("yarn.lock")) return "yarn";
  if (files.has("package-lock.json") || files.has("npm-shrinkwrap.json")) return "npm";
  return "unknown";
}

function installCommand(packageManager: PackageManager) {
  if (packageManager === "pnpm") return ["pnpm", "install", "--frozen-lockfile"];
  if (packageManager === "npm") return ["npm", "ci"];
  if (packageManager === "yarn") return ["corepack", "yarn", "install", "--immutable"];
  return [];
}

function packageCommand(packageManager: PackageManager, script: string) {
  return packageManager === "yarn" ? ["corepack", "yarn", script] : [packageManager, "run", script];
}

async function entryPoints(root: string, manifest: Record<string, unknown>) {
  const declared = [manifest.main, manifest.module, manifest.bin].flatMap(value => typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).filter((item): item is string => typeof item === "string") : []);
  const conventional = ["src/index.ts", "src/index.js", "src/server.ts", "src/server.js", "server.ts", "server.js", "index.ts", "index.js", "app/api/route.ts"];
  const found: string[] = [];
  for (const candidate of unique([...declared, ...conventional]).map(normalized)) if (await exists(path.join(root, candidate))) found.push(candidate);
  return found;
}

async function repositoryPolicyPaths(root: string, packageManager: PackageManager) {
  const protectedCandidates = ["package.json", packageManager === "npm" ? "package-lock.json" : packageManager === "pnpm" ? "pnpm-lock.yaml" : packageManager === "yarn" ? "yarn.lock" : "", ".github/workflows", "test", "tests", "evaluator", "quantum-twin.config.json"].filter(Boolean);
  const protectedPaths: string[] = [];
  for (const candidate of protectedCandidates) if (await exists(path.join(root, candidate))) protectedPaths.push(candidate);
  const sourceDirectories: string[] = [];
  async function walk(directory: string, relative: string, depth: number) {
    if (depth > 4) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if ([".git", "node_modules", ".next", "dist", "build", "coverage", "test", "tests", "evaluator"].includes(entry.name)) continue;
      const childRelative = normalized(path.join(relative, entry.name)), absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute, childRelative, depth + 1);
      else if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) sourceDirectories.push(relative || ".");
    }
  }
  await walk(root, "", 0);
  return { protectedPaths, sourceDirectories: unique(sourceDirectories).filter(value => !protectedPaths.some(protectedPath => value === protectedPath || value.startsWith(`${protectedPath}/`))) };
}

async function runtimeHints(root: string, manifest: Record<string, unknown>) {
  const texts: string[] = [];
  async function walk(directory: string, depth: number) {
    if (depth > 4) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if ([".git", "node_modules", ".next", "dist", "build", "coverage"].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute, depth + 1); else if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) texts.push(await readFile(absolute, "utf8"));
    }
  }
  await walk(root, 0); const source = texts.join("\n"), dependencies = manifest.dependencies && typeof manifest.dependencies === "object" ? manifest.dependencies as Record<string, unknown> : {};
  const ports = unique([...source.matchAll(/PORT\s*\|\|\s*(\d{2,5})|port\s*:\s*(\d{2,5})/g)].map(match => Number(match[1] ?? match[2])));
  if (!ports.length && "next" in dependencies && manifest.scripts && typeof manifest.scripts === "object" && "start" in manifest.scripts) ports.push(3000);
  const healthPath = /["'`]\/health["'`]/.test(source) ? "/health" : "next" in dependencies ? "/" : undefined;
  return { ports, healthChecks: healthPath ? ports.map(port => `http://127.0.0.1:${port}${healthPath}`) : [] };
}

function scriptsFrom(manifest: Record<string, unknown>, packageManager: PackageManager) {
  const scripts = manifest.scripts && typeof manifest.scripts === "object" ? manifest.scripts as Record<string, unknown> : {};
  const commands: Record<string, string[]> = {};
  const install = installCommand(packageManager); if (install.length) commands.install = install;
  for (const name of ["typecheck", "build", "start", "test", "test:e2e", "e2e", "stop"] as const) if (typeof scripts[name] === "string") commands[name] = packageCommand(packageManager, name);
  return commands;
}

async function moduleType(root: string, manifest: Record<string, unknown>): Promise<SystemRepository["moduleType"]> {
  let esm = manifest.type === "module", commonjs = manifest.type === "commonjs" || manifest.type === undefined;
  async function walk(directory: string, depth: number) {
    if (depth > 4 || esm && commonjs) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if ([".git", "node_modules", ".next", "dist", "build", "coverage"].includes(entry.name)) continue;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), depth + 1);
      else if (entry.name.endsWith(".mjs") || entry.name.endsWith(".mts")) esm = true;
      else if (entry.name.endsWith(".cjs") || entry.name.endsWith(".cts")) commonjs = true;
    }
  }
  await walk(root, 0);
  return esm && commonjs ? "mixed" : esm ? "esm" : commonjs ? "commonjs" : "unknown";
}

export async function inspectSystemRepository(root: string, identity: { id?: string; name?: string; source?: string; commit?: string | null } = {}): Promise<SystemRepository> {
  const packageJson = await json(path.join(root, "package.json"));
  const files = new Set(await readdir(root));
  const packageManager = manager(files);
  const tree = await manifest(root);
  const name = identity.name ?? (typeof packageJson.name === "string" ? packageJson.name : path.basename(root));
  const policy = await repositoryPolicyPaths(root, packageManager), hints = await runtimeHints(root, packageJson);
  return { id: identity.id ?? name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase(), name, source: identity.source ?? `local:${name}`, root, commit: identity.commit ?? null, treeSha256: tree.sha256, packageManager, runtime: "node", moduleType: await moduleType(root, packageJson), commands: scriptsFrom(packageJson, packageManager), entryPoints: await entryPoints(root, packageJson), ...policy, ...hints };
}

async function workspaceRoots(repository: SystemRepository) {
  const result = new Set<string>(["."]);
  const packageJson = await json(path.join(repository.root, "package.json"));
  const workspaces = Array.isArray(packageJson.workspaces) ? packageJson.workspaces : packageJson.workspaces && typeof packageJson.workspaces === "object" && Array.isArray((packageJson.workspaces as Record<string, unknown>).packages) ? (packageJson.workspaces as { packages: unknown[] }).packages : [];
  for (const pattern of workspaces.filter((item): item is string => typeof item === "string")) {
    if (!pattern.endsWith("/*")) continue;
    const parent = path.join(repository.root, pattern.slice(0, -2));
    if (!await exists(parent)) continue;
    for (const name of await readdir(parent)) if (await exists(path.join(parent, name, "package.json"))) result.add(normalized(path.join(pattern.slice(0, -2), name)));
  }
  if (await exists(path.join(repository.root, "pnpm-workspace.yaml"))) {
    const text = await readFile(path.join(repository.root, "pnpm-workspace.yaml"), "utf8");
    for (const match of text.matchAll(/^\s*-\s*['"]?([^'"\r\n]+\/\*)/gm)) {
      const parentName = match[1]!.slice(0, -2), parent = path.join(repository.root, parentName);
      if (await exists(parent)) for (const name of await readdir(parent)) if (await exists(path.join(parent, name, "package.json"))) result.add(normalized(path.join(parentName, name)));
    }
  }
  return [...result];
}

export async function discoverComponents(repository: SystemRepository): Promise<SystemComponent[]> {
  const components: SystemComponent[] = [];
  for (const relative of await workspaceRoots(repository)) {
    const root = path.join(repository.root, relative), pkg = await json(path.join(root, "package.json"));
    const name = typeof pkg.name === "string" ? pkg.name : relative === "." ? repository.name : path.basename(relative);
    const dependencies = [...Object.keys(pkg.dependencies && typeof pkg.dependencies === "object" ? pkg.dependencies : {}), ...Object.keys(pkg.devDependencies && typeof pkg.devDependencies === "object" ? pkg.devDependencies : {})];
    const bin = Boolean(pkg.bin), scripts = pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts as Record<string, unknown> : {};
    const kind: SystemComponent["kind"] = bin ? "cli" : /worker|scheduled|scheduler|job/i.test(name) ? "worker" : typeof scripts.start === "string" ? "service" : "package";
    components.push({ id: `${repository.id}:${name}`, repositoryId: repository.id, name, kind, root: normalized(relative), dependencies, ports: relative === "." ? repository.ports : [], healthChecks: relative === "." ? repository.healthChecks : [] });
  }
  for (const file of ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"]) {
    const absolute = path.join(repository.root, file); if (!await exists(absolute)) continue;
    const lines = (await readFile(absolute, "utf8")).split(/\r?\n/); let inServices = false, current: SystemComponent | undefined;
    for (const line of lines) {
      if (/^services:\s*$/.test(line)) { inServices = true; continue; }
      if (inServices && /^\S/.test(line) && line.trim()) { inServices = false; current = undefined; }
      const service = inServices ? /^\s{2}([A-Za-z0-9_.-]+):\s*$/.exec(line) : null;
      if (service) { current = { id: `${repository.id}:compose:${service[1]}`, repositoryId: repository.id, name: service[1]!, kind: "service", root: file, dependencies: [], ports: [], healthChecks: [] }; components.push(current); continue; }
      if (!current) continue;
      const inlineDependencies = /^\s{4}depends_on:\s*\[([^\]]+)\]/.exec(line); if (inlineDependencies) current.dependencies.push(...inlineDependencies[1]!.split(",").map(value => value.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean));
      const inlinePorts = /^\s{4}ports:\s*\[([^\]]+)\]/.exec(line); if (inlinePorts) for (const value of inlinePorts[1]!.split(",")) { const match = /(?:\d+:)?(\d+)/.exec(value); if (match) current.ports.push(Number(match[1])); }
      const dependency = /^\s{6}-\s*([A-Za-z0-9_.-]+)\s*$/.exec(line); if (/^\s{4}depends_on:/.test(line)) continue; if (dependency && lines[Math.max(0, lines.indexOf(line) - 1)]?.includes("depends_on")) current.dependencies.push(dependency[1]!);
      const port = /^\s{6}-\s*["']?(?:\d+:)?(\d+)["']?\s*$/.exec(line); if (port) current.ports.push(Number(port[1]));
    }
  }
  return components;
}

function graphHash(graph: Omit<SystemCryptoGraph, "sha256">) { return sha256(JSON.stringify(graph)); }

export async function buildSystemCryptoGraph(repositories: SystemRepository[], components: SystemComponent[], runtimeEvents: RuntimeCryptoEvent[] = [], frozenConsumers: string[] = []): Promise<SystemCryptoGraph> {
  const nodes: CryptoNode[] = repositories.map(repo => ({ id: `repository:${repo.id}`, kind: "repository", label: repo.name, repositoryId: repo.id, controlled: true }));
  const edges: CryptoEdge[] = [];
  for (const component of components) {
    nodes.push({ id: `component:${component.id}`, kind: component.kind === "service" || component.kind === "worker" ? "service" : "package", label: component.name, repositoryId: component.repositoryId, location: component.root, controlled: true });
    edges.push({ from: `component:${component.id}`, to: `repository:${component.repositoryId}`, kind: "deployed-with", evidence: [component.root] });
    const deploymentId = `deployment:${component.id}`; nodes.push({ id: deploymentId, kind: "deployment", label: `${component.name} deployment unit`, repositoryId: component.repositoryId, location: component.root, controlled: true }); edges.push({ from: `component:${component.id}`, to: deploymentId, kind: "deployed-with", evidence: component.ports.map(String) });
  }
  for (const component of components) for (const dependency of component.dependencies) {
    const target = components.find(item => item.name === dependency || item.dependencies.includes(component.name) && item.name === dependency);
    if (target) edges.push({ from: `component:${component.id}`, to: `component:${target.id}`, kind: "depends-on", evidence: ["workspace or Compose dependency"] });
  }
  const staticFindings: ScannerHit[] = [];
  for (const repository of repositories) {
    const hits = await scanRepository(repository.root, undefined, { nodeOnly: true }); staticFindings.push(...hits);
    for (const [index, hit] of hits.entries()) {
      const producer = hit.operation === "signing" || hit.operation === "transport" && /publicEncrypt/.test(hit.technology) ? "producer" : "consumer";
      const id = `crypto:${repository.id}:${index}`;
      nodes.push({ id, kind: producer, label: `${hit.technology} ${hit.operation}`, repositoryId: repository.id, location: `${hit.file}:${hit.line}`, controlled: hit.status === "supported" });
      edges.push({ from: `repository:${repository.id}`, to: id, kind: hit.operation === "signing" ? "signs" : hit.operation === "verification" ? "verifies" : /publicEncrypt/.test(hit.technology) ? "encrypts" : /privateDecrypt/.test(hit.technology) ? "decrypts" : "depends-on", evidence: [hit.snippet] });
      const keyId = `key:${repository.id}:${index}`; nodes.push({ id: keyId, kind: "key-source", label: "sanitized key reference", repositoryId: repository.id, location: `${hit.file}:${hit.line}`, controlled: hit.status === "supported" }); edges.push({ from: id, to: keyId, kind: "depends-on", evidence: ["key metadata only; no key material"] });
      if (hit.operation === "verification") { const verificationId = `verification:${repository.id}:${index}`; nodes.push({ id: verificationId, kind: "verification", label: "verification boundary", repositoryId: repository.id, location: `${hit.file}:${hit.line}`, controlled: hit.status === "supported" }); edges.push({ from: id, to: verificationId, kind: "verifies", evidence: [hit.snippet] }); }
      if (hit.operation === "transport") { const envelopeId = `envelope:${repository.id}:${index}`; nodes.push({ id: envelopeId, kind: "envelope", label: "RSA encryption envelope", repositoryId: repository.id, location: `${hit.file}:${hit.line}`, controlled: hit.status === "supported" }); edges.push({ from: id, to: envelopeId, kind: producer === "producer" ? "encrypts" : "decrypts", evidence: [hit.snippet] }); }
      if (/(?:^|\/)app\/api\/|(?:^|\/)routes?\//.test(hit.file)) { const endpointId = `endpoint:${repository.id}:${hit.file}`; if (!nodes.some(node => node.id === endpointId)) nodes.push({ id: endpointId, kind: "endpoint", label: hit.file, repositoryId: repository.id, location: hit.file, controlled: true }); edges.push({ from: id, to: endpointId, kind: producer === "producer" ? "sends" : "receives", evidence: [hit.snippet] }); }
    }
  }
  for (const name of frozenConsumers) {
    const id = `external:${sha256(name).slice(0, 12)}`;
    nodes.push({ id, kind: "external", label: name, controlled: false });
    for (const producer of nodes.filter(node => node.kind === "producer")) edges.push({ from: producer.id, to: id, kind: "frozen-compatibility", evidence: ["supplied-user"] });
  }
  for (const [index, event] of runtimeEvents.entries()) {
    const id = `runtime:${index}`, producer = event.operation === "sign" || event.operation === "encrypt" || event.operation === "encapsulate";
    nodes.push({ id, kind: producer ? "producer" : "consumer", label: `${event.operation} ${event.algorithm}`, repositoryId: event.componentId, location: event.callSite, controlled: true });
    if (event.componentId && repositories.some(repository => repository.id === event.componentId)) edges.push({ from: `repository:${event.componentId}`, to: id, kind: producer ? event.operation === "sign" ? "signs" : "encrypts" : event.operation === "verify" ? "verifies" : "decrypts", evidence: ["observed-runtime", event.callSite] });
  }
  const body = { nodes, edges, staticFindings, runtimeEvents, unaccountedConsumers: [] };
  return { ...body, sha256: graphHash(body) };
}

function protectedPaths(repositories: SystemRepository[]) { return repositories.flatMap(repository => repository.protectedPaths.map(item => `repositories/${repository.id}/${item}`)); }

function writablePaths(repositories: SystemRepository[]) { return unique(repositories.flatMap(repository => repository.sourceDirectories.map(item => `repositories/${repository.id}/${item}`.replace(/\/\.$/, "")))); }

export function synthesizeSystemContract(name: string, repositories: SystemRepository[], graph: SystemCryptoGraph, frozenConsumers: string[] = []): SystemContract {
  const commands = Object.fromEntries(repositories.flatMap(repository => Object.entries(repository.commands).map(([key, value]) => [`${repository.id}:${key}`, value])));
  const entry = repositories.flatMap(repository => repository.entryPoints.map(value => `repositories/${repository.id}/${value}`));
  const workflows = Object.entries(commands).filter(([name]) => /(?:test:e2e|e2e|test)$/.test(name)).map(([, value]) => value);
  const hasEncryption = graph.staticFindings.some(hit => hit.operation === "transport" && /encrypt|decrypt|rsa/i.test(hit.snippet)), hasSignatures = graph.staticFindings.some(hit => hit.operation === "signing" || hit.operation === "verification");
  const withoutHash: Omit<SystemContract, "sha256"> = {
    version: 2, systemName: inferred(name, "bundle name"),
    repositories: observed(repositories.map(({ id, source, commit, treeSha256 }) => ({ id, source, commit, treeSha256 })), "repository trees"),
    commands: observed(commands, "package.json scripts", "lockfiles"), entryPoints: observed(entry, "package.json entry points", "conventional Node entry points"),
    healthChecks: observed(unique(repositories.flatMap(repository => repository.healthChecks)), "committed loopback listen port and health route"), workflows: inferred(workflows, "test and E2E package scripts"),
    protectedPaths: inferred(protectedPaths(repositories), "lockfiles and CI definitions"), writablePaths: inferred(unique(writablePaths(repositories)), "discovered application entry-point directories"),
    frozenConsumers: { value: frozenConsumers, provenance: frozenConsumers.length ? "supplied-user" : "inferred-deterministically", evidence: frozenConsumers.length ? ["bundle review"] : ["none declared"] },
    dependencyChanges: inferred("forbid", "safe default"), runtime: inferred("node>=24.18.0 <25", "Quantum Twin supported runtime"),
    boundaries: observed([...hasSignatures ? ["ml-dsa-65" as const] : [], ...hasEncryption ? ["ml-kem-768-kem-dem" as const] : []], "supported native node:crypto findings"),
    envelopeVersions: inferred(hasEncryption ? ["qt-kem-dem-v1"] : [], "detected encryption envelope boundary"), performanceLimitPercent: inferred(25, "conservative default requiring user review"),
    rollbackRequired: inferred(true, "mandatory safety policy"), cleanupRequired: inferred(true, "mandatory execution policy"),
    forbiddenOperations: inferred(["network in candidate worktrees", "write outside approved roots", "modify evaluator or contract", "commit private keys", "push or apply without typed approval"], "Quantum Twin safety policy"), approved: false
  };
  return { ...withoutHash, sha256: sha256(JSON.stringify(withoutHash)) };
}

export async function createSystemBundle(name: string, roots: Array<{ root: string; id?: string; name?: string; source?: string; commit?: string | null }>, options: { frozenConsumers?: string[]; runtimeEvents?: RuntimeCryptoEvent[]; now?: string } = {}): Promise<SystemBundle> {
  if (!name.trim()) throw new Error("System name is required");
  if (!roots.length) throw new Error("At least one repository is required");
  const repositories = await Promise.all(roots.map(item => inspectSystemRepository(item.root, item)));
  if (new Set(repositories.map(item => item.id)).size !== repositories.length) throw new Error("Repository identifiers must be unique");
  const components = (await Promise.all(repositories.map(discoverComponents))).flat();
  const graph = await buildSystemCryptoGraph(repositories, components, options.runtimeEvents, options.frozenConsumers);
  const contract = synthesizeSystemContract(name.trim(), repositories, graph, options.frozenConsumers);
  const createdAt = options.now ?? new Date().toISOString();
  return { version: 1, name: name.trim(), repositories, components, graph, contract, createdAt, manifestSha256: fileSha256(Buffer.from(JSON.stringify({ name: name.trim(), repositories: repositories.map(({ root: _root, ...rest }) => rest), components, graph, contract, createdAt }))) };
}

export function assertContractApproved(contract: SystemContract) {
  if (!contract.approved) throw new Error("Execution blocked: synthesized system contract requires explicit review and approval");
  const expected = sha256(JSON.stringify({ ...contract, sha256: undefined }));
  if (contract.sha256 !== expected) throw new Error("Execution blocked: approved system contract hash is invalid");
}

export function approveSystemContract(contract: SystemContract): SystemContract {
  const body = { ...contract, approved: true, sha256: "" };
  return { ...body, sha256: sha256(JSON.stringify({ ...body, sha256: undefined })) };
}
