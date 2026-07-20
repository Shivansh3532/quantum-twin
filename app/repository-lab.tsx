"use client";
import { useEffect, useState } from "react";
import type { RunReport, ScannerHit } from "../src/domain.ts";
import type { IntakeAnalysis, IntakeMode } from "../src/intake.ts";

type LabState = "idle" | "validating-url" | "cloning" | "importing" | "analyzing" | "supported" | "unsupported" | "contract-missing" | "blocked" | "ready" | "authorizing" | "building" | "evaluating" | "selected" | "no-safe-winner" | "failed";
type SystemStatus = { checks: Array<{ name: string; passed: boolean; detail: string; fix?: string }>; authenticated: boolean; authenticationMethod: string; ready: boolean };
const DEMO = "https://github.com/Shivansh3532/quantum-twin-demo-target";

async function json(response: Response) {
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : `HTTP ${response.status}`);
  return value;
}

function FindingList({ title, findings }: { title: string; findings: ScannerHit[] }) {
  return <details open={findings.length > 0}><summary>{title} ({findings.length})</summary>{findings.length ? <ul className="lab-findings">{findings.map((hit, index) => <li key={`${hit.file}:${hit.line}:${index}`}><strong>{hit.technology} · {hit.operation}</strong><code>{hit.file}:{hit.line}</code><span>{hit.snippet}</span>{hit.reason && <small>{hit.reason}</small>}</li>)}</ul> : <p>None.</p>}</details>;
}

export default function RepositoryLab({ onReport }: { onReport: (report: RunReport) => void }) {
  const [system, setSystem] = useState<SystemStatus | null>(null), [mode, setMode] = useState<IntakeMode>("demo"), [state, setState] = useState<LabState>("idle");
  const [url, setUrl] = useState(DEMO), [localPath, setLocalPath] = useState(""), [folderFiles, setFolderFiles] = useState<File[]>([]), [archive, setArchive] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<IntakeAnalysis | null>(null), [error, setError] = useState(""), [announcement, setAnnouncement] = useState("Choose a repository source.");
  const [trust, setTrust] = useState(false), [commands, setCommands] = useState(false), [codex, setCodex] = useState(false), [compatibility, setCompatibility] = useState(true);
  useEffect(() => { void fetch("/api/system").then(response => response.ok ? response.json() as Promise<SystemStatus> : null).then(setSystem).catch(() => setSystem(null)); }, []);
  const choose = (value: IntakeMode) => { setMode(value); setAnalysis(null); setError(""); setState("idle"); setTrust(false); setCommands(false); setCodex(false); if (value === "demo") setUrl(DEMO); };

  async function importAndAnalyze(event: React.FormEvent) {
    event.preventDefault(); setError(""); setAnalysis(null); setTrust(false); setCommands(false); setCodex(false);
    try {
      if (mode === "github") {
        setState("validating-url"); setAnnouncement("Validating canonical public GitHub URL.");
        await json(await fetch("/api/intake/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) }));
      }
      setState(mode === "github" || mode === "demo" ? "cloning" : "importing"); setAnnouncement(mode === "github" || mode === "demo" ? "Cloning into controlled temporary storage. No repository commands are running." : "Copying files into controlled local storage. No repository commands are running.");
      let response: Response;
      if (mode === "folder" || mode === "zip") {
        const form = new FormData(); form.set("mode", mode);
        if (mode === "folder") { form.set("name", folderFiles[0]?.webkitRelativePath.split("/")[0] || "browser-folder"); form.set("paths", JSON.stringify(folderFiles.map(file => file.webkitRelativePath || file.name))); for (const file of folderFiles) form.append("files", file, file.name); }
        else if (archive) form.set("archive", archive);
        response = await fetch("/api/intake", { method: "POST", body: form });
      } else response = await fetch("/api/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mode === "github" ? { mode, url } : mode === "local" ? { mode, path: localPath } : { mode: "demo" }) });
      const intake = await json(response);
      setState("analyzing"); setAnnouncement("Running deterministic scanner and contract validation only. No repository code is executing.");
      const inspected = await json(await fetch("/api/intake/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intakeId: intake.id }) })) as unknown as IntakeAnalysis;
      setAnalysis(inspected);
      const next = inspected.status === "ready" ? "ready" : inspected.status === "contract-missing" ? "contract-missing" : inspected.report.supported.length ? "blocked" : "unsupported";
      setState(next); setAnnouncement(inspected.message);
    } catch (cause) { setState("failed"); const message = cause instanceof Error ? cause.message : String(cause); setError(message); setAnnouncement(`Repository intake failed: ${message}`); }
  }

  async function startTournament() {
    if (!analysis) return;
    setState("authorizing"); setError(""); setAnnouncement("Backend is revalidating intake, contract, harness, and permissions.");
    try {
      const response = await fetch("/api/runs/stream", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intakeId: analysis.intakeId, trustRepository: trust, allowCommands: commands, allowCodex: codex, legacyCompatibilityRequired: compatibility }) });
      if (!response.ok || !response.body) throw new Error(String((await response.json() as { error?: string }).error ?? `HTTP ${response.status}`));
      const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = "";
      while (true) {
        const chunk = await reader.read(); pending += decoder.decode(chunk.value, { stream: !chunk.done });
        const lines = pending.split("\n"); pending = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as { state: LabState; report?: RunReport; error?: string };
          setState(event.state); setAnnouncement(event.state === "building" ? "Two authenticated Codex builders are editing isolated worktrees." : event.state === "evaluating" ? "External deterministic evaluator is running twice." : event.state === "selected" ? `Tournament complete. ${event.report?.selectedCandidate} selected.` : event.state === "no-safe-winner" ? "Tournament complete. NO SAFE WINNER." : event.error ?? event.state);
          if (event.report) onReport(event.report);
          if (event.error) setError(event.error);
        }
        if (chunk.done) break;
      }
    } catch (cause) { setState("failed"); const message = cause instanceof Error ? cause.message : String(cause); setError(message); setAnnouncement(`Tournament failed: ${message}. Last completed evidence remains visible.`); }
  }

  const ready = state === "ready" && analysis?.status === "ready" && system?.ready === true;
  return <div className="repository-lab">
    <div className="lab-steps" aria-label="Repository Lab journey">WELCOME · SYSTEM CHECK · AUTHENTICATION · CHOOSE SOURCE · IMPORT · ANALYZE · REVIEW · PERMISSIONS · TOURNAMENT · EVIDENCE</div>
    <section className="lab-system" aria-labelledby="system-title"><h3 id="system-title">System Check</h3>{system ? <><ul>{system.checks.map(check => <li key={check.name} className={check.passed ? "check-pass" : "check-fail"}><strong>{check.passed ? "PASS" : "FIX"} · {check.name}</strong><span>{check.detail}</span>{!check.passed && check.fix && <small>{check.fix}</small>}</li>)}</ul><p><strong>Codex authentication:</strong> {system.authenticationMethod}</p>{!system.authenticated && <div className="auth-help"><p><strong>Sign in with ChatGPT:</strong> run <code>codex login</code> in terminal. Official Codex browser flow handles credentials.</p><p><strong>Use API billing:</strong> authenticate in terminal with <code>codex login --with-api-key</code>. Quantum Twin never asks for, stores, or logs API keys.</p></div>}</> : <p>Checking local prerequisites…</p>}</section>
    <form className="lab-intake" onSubmit={importAndAnalyze}><fieldset><legend>Choose Repository Source</legend><div className="mode-grid">{([['demo','Independent public demonstration'],['github','Public GitHub HTTPS URL'],['local','Trusted local folder path'],['folder','Import folder in browser'],['zip','Import local ZIP']] as Array<[IntakeMode,string]>).map(([value,label]) => <label key={value}><input type="radio" name="mode" checked={mode === value} onChange={() => choose(value)}/>{label}</label>)}</div></fieldset>
      {(mode === "github" || mode === "demo") && <label>Public repository URL<input type="url" value={url} readOnly={mode === "demo"} onChange={event => setUrl(event.target.value)} required/></label>}
      {mode === "local" && <label>Trusted local path<input value={localPath} onChange={event => setLocalPath(event.target.value)} placeholder="Absolute path on this computer" required/><small>Reliable cross-browser fallback. Original folder remains untouched.</small></label>}
      {mode === "folder" && <label>Repository folder<input type="file" multiple {...{ webkitdirectory: "", directory: "" }} onChange={event => setFolderFiles(Array.from(event.target.files ?? []))} required/><small>{folderFiles.length ? `${folderFiles.length} selected files` : "Chromium folder import reconstructs relative paths locally; POSIX permissions and symlinks are not preserved."}</small></label>}
      {mode === "zip" && <label>ZIP archive<input type="file" accept=".zip,application/zip" onChange={event => setArchive(event.target.files?.[0] ?? null)} required/><small>ZIP Slip, encryption, symlinks, special files, nested archives, collisions, and oversized expansion are rejected.</small></label>}
      <button className="primary" disabled={["validating-url","cloning","importing","analyzing"].includes(state)}>{mode === "github" || mode === "demo" ? "Analyze Repository" : "Import and Analyze"}</button>
    </form>
    <div className="lab-status" aria-live="polite"><strong>{state.replaceAll("-", " ").toUpperCase()}</strong><span>{announcement}</span>{error && <p className="error">{error}</p>}</div>
    {analysis && <div className="lab-analysis"><h3>Analysis-only result</h3><dl><dt>Repository</dt><dd>{analysis.report.repository.name}</dd><dt>Source</dt><dd>{analysis.report.repository.source}</dd><dt>Resolved commit</dt><dd>{analysis.report.repository.resolvedCommit ?? "Not available for local import"}</dd><dt>Runtime shape</dt><dd>{analysis.report.language.join(" + ") || "Unknown"} · {analysis.report.moduleType} · {analysis.report.packageManager}</dd><dt>Contract</dt><dd>{analysis.contract.valid ? `valid · ${analysis.contract.sha256}` : analysis.contract.error ?? "missing"}</dd><dt>Harness</dt><dd>{analysis.contract.harnessPath ? `${analysis.contract.harnessPath} · ${analysis.contract.harnessSha256}` : "not validated"}</dd></dl>
      <FindingList title="Supported findings" findings={analysis.report.supported}/><FindingList title="Discovery-only findings" findings={analysis.report.discoveryOnly}/><FindingList title="Ambiguous findings" findings={analysis.report.blockers}/>
      {analysis.blockers.length > 0 && <div className="lab-blockers"><strong>Automatic-migration blockers</strong><ul>{analysis.blockers.map(item => <li key={item}>{item}</li>)}</ul></div>}
      {analysis.contract.review && <details open className="contract-review"><summary>Review immutable migration contract</summary><div className="contract-grid"><div><strong>Commands</strong>{Object.entries(analysis.contract.review.commands).map(([name, parts]) => parts && <code key={name}>{name}: {(parts as string[]).join(" ")}</code>)}</div><div><strong>Writable paths</strong>{analysis.contract.review.writablePaths.map(item => <code key={item}>{item}</code>)}</div><div><strong>Protected paths</strong>{analysis.contract.review.protectedPaths.map(item => <code key={item}>{item}</code>)}</div><div><strong>Source boundaries</strong><code>include: {analysis.contract.review.includedSourceGlobs.join(", ")}</code><code>exclude: {analysis.contract.review.excludedGlobs.join(", ") || "none"}</code></div><div><strong>Policy</strong><code>dependencies: {analysis.contract.review.dependencyPolicy}</code><code>compatibility required: {String(analysis.contract.review.legacyCompatibilityRequired)}</code><code>target: {analysis.contract.review.target.primitive}</code><code>context: {analysis.contract.review.target.context}</code></div><div><strong>Limits</strong><code>{analysis.contract.review.limits.maxFiles} files</code><code>{analysis.contract.review.limits.maxFileBytes} bytes/file</code><code>{analysis.contract.review.limits.maxTotalBytes} total bytes</code><code>{analysis.contract.review.timeouts.commandMs} ms/command</code></div></div></details>}
      <section className="trust-center"><h3>Permission and Trust Center</h3><ol>{analysis.permissions.map(item => <li key={item}>{item}</li>)}</ol><label><input type="checkbox" checked={trust} onChange={event => setTrust(event.target.checked)}/> I trust this repository and have reviewed the declared commands.</label><label><input type="checkbox" checked={commands} onChange={event => setCommands(event.target.checked)}/> I understand these commands execute only inside an isolated Quantum Twin copy.</label><label><input type="checkbox" checked={codex} onChange={event => setCodex(event.target.checked)}/> I authorize two authenticated Codex builders to change only declared writable paths in isolated worktrees.</label><label>Compatibility requirement<select value={compatibility ? "required" : "disabled"} onChange={event => setCompatibility(event.target.value === "required")}><option value="required">Legacy compatibility required</option><option value="disabled">Legacy compatibility disabled</option></select></label><button className="primary" onClick={startTournament} disabled={!ready || !trust || !commands || !codex}>Start Migration Tournament</button></section>
    </div>}
  </div>;
}
