import { createWriteStream } from "node:fs";
import { execFile } from "node:child_process";
import { access, chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { inspectRepository } from "./capabilities.ts";
import type { CapabilityReport } from "./domain.ts";
import type { QuantumTwinConfig } from "./config.ts";
import { assertSafeTree, contained, copyRepository, safeRelativePath } from "./repository.ts";
import { fileSha256 } from "./util.ts";

export type RepositoryLimits = { maxFiles: number; maxFileBytes: number; maxTotalBytes: number };
export const INTAKE_LIMITS: RepositoryLimits = { maxFiles: 5_000, maxFileBytes: 2_000_000, maxTotalBytes: 50_000_000 };
export const ZIP_COMPRESSED_LIMIT = 25_000_000;
export const CLONE_TIMEOUT_MS = 60_000;
export const DEMO_REPOSITORY_URL = "https://github.com/Shivansh3532/quantum-twin-demo-target";
const INTAKE_ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), "runs", "intakes");
const INTAKE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NESTED_ARCHIVE = /\.(?:zip|7z|rar|tar|tgz|gz|bz2|xz)$/i;

export type IntakeMode = "demo" | "github" | "local" | "folder" | "zip";
type IntakeRecord = { id: string; mode: IntakeMode; name: string; source: string; resolvedCommit: string | null; createdAt: string };
export type IntakeFile = { relativePath: string; data: Buffer };
export type GitResult = { exitCode: number; stdout: string; stderr: string; timedOut?: boolean; missing?: boolean };
export type GitRunner = (program: string, args: string[], cwd: string, timeoutMs: number, environment: NodeJS.ProcessEnv) => Promise<GitResult>;

export class IntakeError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}

export function parseGitHubRepositoryUrl(value: string) {
  if (!/^https:\/\/github\.com\//i.test(value)) throw new IntakeError("invalid_url", 400, "Only credential-free https://github.com/{owner}/{repository} URLs are accepted");
  let url: URL;
  try { url = new URL(value); } catch { throw new IntakeError("invalid_url", 400, "Enter a canonical public GitHub HTTPS repository URL"); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.username || url.password || url.port || url.search || url.hash) throw new IntakeError("invalid_url", 400, "Only credential-free https://github.com/{owner}/{repository} URLs are accepted");
  const match = /^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([^/]+)$/.exec(url.pathname);
  if (!match) throw new IntakeError("invalid_url", 400, "GitHub URL must contain exactly one owner and repository");
  const owner = match[1]!, repository = match[2]!.endsWith(".git") ? match[2]!.slice(0, -4) : match[2]!;
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(repository)) throw new IntakeError("invalid_url", 400, "GitHub repository name is malformed");
  return { owner, repository, canonicalUrl: `https://github.com/${owner}/${repository}` };
}

const defaultGitRunner: GitRunner = (program, args, cwd, timeoutMs, environment) => new Promise(resolve => {
  execFile(program, args, { cwd, timeout: timeoutMs, maxBuffer: 1_000_000, windowsHide: true, shell: false, env: environment, encoding: "utf8" }, (error, stdout, stderr) => {
    const detail = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string };
    resolve({ exitCode: error ? 1 : 0, stdout: stdout ?? "", stderr: stderr || error?.message || "", timedOut: Boolean(detail?.killed || detail?.signal), missing: detail?.code === "ENOENT" });
  });
});

function safeGitEnvironment() {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) if (/^(?:GIT_|SSH_ASKPASS)/i.test(key)) delete environment[key];
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.GCM_INTERACTIVE = "Never";
  environment.GIT_CONFIG_NOSYSTEM = "1";
  environment.GIT_CONFIG_GLOBAL = process.platform === "win32" ? "NUL" : "/dev/null";
  return environment;
}

export async function clonePublicRepository(value: string, destination: string, options: { runner?: GitRunner; gitProgram?: string; timeoutMs?: number; limits?: RepositoryLimits } = {}) {
  const parsed = parseGitHubRepositoryUrl(value), runner = options.runner ?? defaultGitRunner, environment = safeGitEnvironment();
  const hooks = await mkdtemp(path.join(os.tmpdir(), "quantum-twin-empty-hooks-"));
  const args = ["-c", "credential.helper=", "-c", `core.hooksPath=${hooks}`, "-c", "filter.lfs.smudge=", "-c", "filter.lfs.required=false", "-c", "protocol.file.allow=never", "-c", "http.followRedirects=false", "clone", "--depth=1", "--single-branch", "--no-tags", "--no-recurse-submodules", "--config", "remote.origin.tagOpt=--no-tags", `${parsed.canonicalUrl}.git`, destination];
  try {
    const cloned = await runner(options.gitProgram ?? "git", args, path.dirname(destination), options.timeoutMs ?? CLONE_TIMEOUT_MS, environment);
    if (cloned.missing) throw new IntakeError("git_missing", 503, "Git is required for public repository intake");
    if (cloned.timedOut) throw new IntakeError("clone_timeout", 504, "GitHub clone exceeded the strict intake timeout");
    if (cloned.exitCode) throw new IntakeError("clone_failed", 422, "Repository could not be cloned without credentials; confirm it exists and is public");
    await assertSafeTree(destination, options.limits ?? INTAKE_LIMITS);
    const commit = await runner(options.gitProgram ?? "git", ["rev-parse", "HEAD"], destination, 10_000, environment);
    if (commit.exitCode || !/^[a-f0-9]{40}$/i.test(commit.stdout.trim())) throw new IntakeError("invalid_clone", 422, "Cloned repository has no resolvable commit");
    return { ...parsed, resolvedCommit: commit.stdout.trim() };
  } finally { await rm(hooks, { recursive: true, force: true }); }
}

async function privateDirectory(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") await chmod(directory, 0o700);
}

async function createRecord(mode: IntakeMode, operation: (repository: string) => Promise<Omit<IntakeRecord, "id" | "mode" | "createdAt">>) {
  await privateDirectory(INTAKE_ROOT);
  const id = randomUUID(), directory = path.join(INTAKE_ROOT, id), repository = path.join(directory, "repository");
  await privateDirectory(directory);
  try {
    const details = await operation(repository);
    const record: IntakeRecord = { id, mode, createdAt: new Date().toISOString(), ...details };
    await writeFile(path.join(directory, "metadata.json"), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    return record;
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}

export function createGitHubIntake(url: string, mode: "github" | "demo" = "github") {
  return createRecord(mode, async repository => {
    const clone = await clonePublicRepository(url, repository);
    return { name: clone.repository, source: clone.canonicalUrl, resolvedCommit: clone.resolvedCommit };
  });
}

export function createLocalIntake(source: string) {
  return createRecord("local", async repository => {
    const identity = await copyRepository(source, repository, INTAKE_LIMITS);
    return { name: identity.name, source: `local:${identity.name}`, resolvedCommit: identity.resolvedCommit };
  });
}

async function writeImportedFiles(repository: string, files: IntakeFile[]) {
  if (!files.length) throw new IntakeError("empty_import", 400, "Selected source contains no files");
  const seen = new Set<string>(); let total = 0;
  for (const file of files) {
    const relative = safeRelativePath(file.relativePath), key = relative.toLowerCase();
    if (seen.has(key)) throw new IntakeError("path_collision", 400, `Duplicate normalized path: ${relative}`);
    seen.add(key);
    if (file.data.byteLength > INTAKE_LIMITS.maxFileBytes) throw new IntakeError("file_too_large", 413, `Imported file exceeds ${INTAKE_LIMITS.maxFileBytes} bytes`);
    total += file.data.byteLength;
    if (seen.size > INTAKE_LIMITS.maxFiles || total > INTAKE_LIMITS.maxTotalBytes) throw new IntakeError("import_too_large", 413, "Imported repository exceeds intake limits");
    const target = path.join(repository, ...relative.split("/"));
    if (!contained(repository, target)) throw new IntakeError("path_escape", 400, "Imported path escapes controlled storage");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.data, { flag: "wx" });
  }
  await assertSafeTree(repository, INTAKE_LIMITS);
}

export function createFolderIntake(files: IntakeFile[], name = "browser-folder") {
  return createRecord("folder", async repository => {
    await privateDirectory(repository); await writeImportedFiles(repository, files);
    return { name, source: `local:${name}`, resolvedCommit: null };
  });
}

function openZip(buffer: Buffer) {
  return new Promise<ZipFile>((resolve, reject) => yauzl.fromBuffer(buffer, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, zip) => error || !zip ? reject(error ?? new Error("Invalid ZIP")) : resolve(zip)));
}

function entryStream(zip: ZipFile, entry: Entry) {
  return new Promise<NodeJS.ReadableStream>((resolve, reject) => zip.openReadStream(entry, (error, stream) => error || !stream ? reject(error ?? new Error("Unreadable ZIP entry")) : resolve(stream)));
}

export function createZipIntake(buffer: Buffer, name = "archive.zip") {
  if (!name.toLowerCase().endsWith(".zip")) throw new IntakeError("archive_type", 400, "Only .zip archives are accepted");
  if (buffer.byteLength > ZIP_COMPRESSED_LIMIT) throw new IntakeError("archive_too_large", 413, `ZIP exceeds ${ZIP_COMPRESSED_LIMIT} compressed bytes`);
  return createRecord("zip", async repository => {
    await privateDirectory(repository);
    const centralSignature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
    for (let offset = buffer.indexOf(centralSignature); offset >= 0; offset = buffer.indexOf(centralSignature, offset + 4)) if (offset + 10 <= buffer.length && (buffer.readUInt16LE(offset + 8) & 1)) throw new IntakeError("encrypted_archive", 400, "Encrypted ZIP archives are not accepted");
    let zip: ZipFile;
    try { zip = await openZip(buffer); } catch { throw new IntakeError("invalid_archive", 400, "ZIP archive is malformed"); }
    const seen = new Set<string>(); let files = 0, total = 0;
    await new Promise<void>((resolve, reject) => {
      const fail = (error: unknown) => { zip.close(); reject(error); };
      zip.on("error", fail);
      zip.on("end", resolve);
      zip.on("entry", async entry => {
        try {
          if (entry.generalPurposeBitFlag & 1) throw new IntakeError("encrypted_archive", 400, "Encrypted ZIP archives are not accepted");
          const directory = entry.fileName.endsWith("/"), relative = safeRelativePath(directory ? entry.fileName.slice(0, -1) : entry.fileName), key = relative.toLowerCase();
          if (seen.has(key)) throw new IntakeError("path_collision", 400, `Duplicate normalized ZIP path: ${relative}`);
          seen.add(key);
          const mode = (entry.externalFileAttributes >>> 16) & 0xffff, type = mode & 0o170000;
          if (type && type !== 0o100000 && type !== 0o040000) throw new IntakeError("special_file", 400, "ZIP symlinks and special files are not accepted");
          if (!directory && NESTED_ARCHIVE.test(relative)) throw new IntakeError("nested_archive", 400, "Nested archives are not accepted");
          if (!directory && entry.uncompressedSize / Math.max(1, entry.compressedSize) > 100) throw new IntakeError("archive_ratio", 413, "ZIP compression ratio exceeds safety limit");
          if (!directory && entry.uncompressedSize > INTAKE_LIMITS.maxFileBytes) throw new IntakeError("file_too_large", 413, "ZIP entry exceeds per-file limit");
          if (!directory && (++files > INTAKE_LIMITS.maxFiles || (total += entry.uncompressedSize) > INTAKE_LIMITS.maxTotalBytes)) throw new IntakeError("archive_too_large", 413, "ZIP exceeds expanded intake limits");
          const target = path.join(repository, ...relative.split("/"));
          if (!contained(repository, target)) throw new IntakeError("path_escape", 400, "ZIP entry escapes controlled storage");
          if (directory) await mkdir(target, { recursive: true });
          else { await mkdir(path.dirname(target), { recursive: true }); await pipeline(await entryStream(zip, entry), createWriteStream(target, { flags: "wx" })); }
          zip.readEntry();
        } catch (error) { fail(error); }
      });
      zip.readEntry();
    });
    await assertSafeTree(repository, INTAKE_LIMITS);
    return { name: path.basename(name, ".zip"), source: `local:${path.basename(name, ".zip")}`, resolvedCommit: null };
  });
}

async function loadRecord(id: string) {
  if (!INTAKE_ID.test(id)) throw new IntakeError("invalid_intake", 400, "Invalid intake identifier");
  const directory = path.join(INTAKE_ROOT, id), repository = path.join(directory, "repository");
  if (!contained(INTAKE_ROOT, directory)) throw new IntakeError("invalid_intake", 400, "Invalid intake identifier");
  try {
    const record = JSON.parse(await readFile(path.join(directory, "metadata.json"), "utf8")) as IntakeRecord;
    await access(repository);
    return { record, directory, repository };
  } catch { throw new IntakeError("intake_missing", 404, "Repository intake expired or does not exist"); }
}

export type IntakeAnalysis = {
  intakeId: string; mode: IntakeMode; status: "ready" | "contract-missing" | "blocked"; report: CapabilityReport;
  message: string; contract: { detected: boolean; valid: boolean; error?: string; path?: string; sha256?: string; harnessPath?: string; harnessSha256?: string; review?: QuantumTwinConfig };
  blockers: string[]; permissions: string[];
};

export async function analyzeIntake(id: string): Promise<IntakeAnalysis> {
  const { record, repository } = await loadRecord(id);
  const inspected = await inspectRepository(repository, undefined, { name: record.name, source: record.source, resolvedCommit: record.resolvedCommit }, true);
  const configPath = path.join(repository, "quantum-twin.config.json"), contract: IntakeAnalysis["contract"] = { detected: inspected.report.configuration === "found", valid: Boolean(inspected.config) };
  if (inspected.config) {
    contract.path = "quantum-twin.config.json"; contract.sha256 = fileSha256(await readFile(configPath)); contract.review = inspected.config;
    if (inspected.config.compatibilityHarness) {
      const harness = path.join(repository, safeRelativePath(inspected.config.compatibilityHarness));
      try {
        const info = await lstat(harness);
        if (!contained(repository, harness) || info.isSymbolicLink() || !info.isFile()) throw new Error("Harness must be a contained regular file");
        contract.harnessPath = inspected.config.compatibilityHarness; contract.harnessSha256 = fileSha256(await readFile(harness));
      } catch (error) { contract.valid = false; contract.error = error instanceof Error ? error.message : String(error); }
    } else { contract.valid = false; contract.error = "A reviewed external compatibility harness file is required"; }
  } else if (inspected.configError) contract.error = inspected.configError;
  const blockers = [
    ...inspected.report.discoveryOnly.map(hit => `${hit.technology} requires ${hit.requiredAdapter ?? "an adapter"}`),
    ...inspected.report.blockers.map(hit => `${hit.technology}: ${hit.reason ?? "ambiguous evidence"}`),
    ...(!contract.detected ? ["Reviewed quantum-twin.config.json is missing"] : !contract.valid ? [contract.error ?? "Migration contract is invalid"] : []),
  ];
  const ready = inspected.report.automaticMigrationSupported && contract.valid && Boolean(contract.harnessSha256);
  return {
    intakeId: id, mode: record.mode, status: ready ? "ready" : contract.detected ? "blocked" : "contract-missing", report: inspected.report, contract, blockers,
    message: ready ? "Repository analysis completed. Reviewed contract and external harness are ready for explicit authorization." : "Repository analysis completed. Automatic migration is unavailable until a reviewed Quantum Twin contract and external compatibility harness are provided.",
    permissions: ["Read and copy repository files into isolated Quantum Twin storage", "Use network access only to clone the selected public GitHub repository", "Create Git worktrees inside the isolated copy", "Run the exact declared install, typecheck, test, build, and compatibility commands", "Allow two authenticated Codex builders to edit only declared writable paths in isolated worktrees", "Run the external evaluator twice", "Save hashed reports locally", "Never modify or push to the original repository"]
  };
}

export async function readyIntake(id: string) {
  const loaded = await loadRecord(id), analysis = await analyzeIntake(id);
  if (analysis.status !== "ready" || !analysis.contract.path) throw new IntakeError("intake_not_ready", 409, analysis.message);
  return { ...loaded, analysis, configPath: path.join(loaded.repository, analysis.contract.path) };
}

export async function discardIntake(id: string) {
  if (!INTAKE_ID.test(id)) throw new IntakeError("invalid_intake", 400, "Invalid intake identifier");
  const directory = path.join(INTAKE_ROOT, id);
  if (!contained(INTAKE_ROOT, directory)) throw new IntakeError("invalid_intake", 400, "Invalid intake identifier");
  await rm(directory, { recursive: true, force: true });
}
