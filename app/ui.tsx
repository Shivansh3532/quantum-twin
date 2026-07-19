"use client";
import { useEffect, useMemo, useState } from "react";
import type { CandidateResult, RunReport, ScannerHit } from "../src/domain.ts";

const GITHUB = "https://github.com/Shivansh3532/quantum-twin";

function Copy({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400); }
  return <button className="copy" type="button" onClick={copy} aria-label={`${label}: ${value}`}>{copied ? "Copied" : label}</button>;
}

function Badge({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "live" | "recorded" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Candidate({ candidate, strategy, busy }: { candidate?: CandidateResult; strategy: "direct" | "bridge"; busy: boolean }) {
  const title = strategy === "direct" ? "Direct Cutover" : "Compatibility Bridge";
  const state = candidate?.generationStatus ?? (busy ? "building" : "not run");
  return <article className="candidate">
    <div className="candidate-head"><div><span className="strategy">{strategy}</span><h3>{title}</h3></div><Badge tone={state === "eligible" ? "live" : "plain"}>{state}</Badge></div>
    <p>{strategy === "direct" ? "ML-DSA-65 only. Lowest legacy exposure when compatibility permits." : "ML-DSA-65 plus declared RSA continuity for frozen consumers."}</p>
    <dl><dt>Branch</dt><dd>{candidate?.branch ?? `candidate/${strategy}`}</dd><dt>Codex thread</dt><dd>{candidate?.threadId ?? "—"}</dd><dt>Commit</dt><dd>{candidate?.worktreeCommit ?? "—"}</dd><dt>Generation</dt><dd>{candidate ? `${candidate.generationDurationMs} ms` : "—"}</dd><dt>Changed lines</dt><dd>{candidate?.changedLines ?? "—"}</dd><dt>Repair</dt><dd>{candidate ? (candidate.repairAttempted ? "attempted" : "not needed") : "—"}</dd></dl>
    {candidate?.error && <p className="inline-error">{candidate.error}</p>}
    {candidate?.diff && <details><summary>Inspect actual candidate diff</summary><pre>{candidate.diff}</pre></details>}
  </article>;
}

function Findings({ findings }: { findings: ScannerHit[] }) {
  if (!findings.length) return <p className="empty">Recorded core run predates generalized scanner fields. Its original RSA finding remains below.</p>;
  return <div className="findings">{findings.map((finding, index) => <article key={`${finding.file}:${finding.line}:${index}`}>
    <div><Badge tone={finding.status === "supported" ? "live" : "plain"}>{finding.status}</Badge><strong>{finding.technology}</strong></div>
    <code>{finding.file}:{finding.line}</code><p>{finding.operation} · {finding.importForm} · confidence {finding.confidence.toFixed(2)}</p>
    {finding.reason && <small>{finding.reason}. {finding.requiredAdapter}</small>}
  </article>)}</div>;
}

function explanation(report: RunReport | null) {
  const value = report?.explanation;
  if (value && typeof value === "object" && "summary" in value && typeof value.summary === "string") return value.summary;
  if (value && typeof value === "object" && "unavailable" in value && typeof value.unavailable === "string") return `GPT explanation unavailable: ${value.unavailable}`;
  return "No immutable evidence explanation available.";
}

export default function Dashboard({ recorded = false, initialReport = null }: { recorded?: boolean; initialReport?: RunReport | null }) {
  const [report, setReport] = useState<RunReport | null>(initialReport), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [repositoryPath, setRepositoryPath] = useState("fixture"), [configPath, setConfigPath] = useState("fixture/quantum-twin.config.json"), [compatibility, setCompatibility] = useState(true), [allowExec, setAllowExec] = useState(false);
  const load = () => fetch("/api/runs/latest").then(response => response.ok ? response.json() as Promise<RunReport> : null).then(setReport).catch(() => setReport(null));
  useEffect(() => { if (!recorded) void load(); }, [recorded]);
  async function run() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repositoryPath, configPath, allowExec, legacyCompatibilityRequired: compatibility }) });
      const data = await response.json() as RunReport | { error: string };
      if (!response.ok) throw new Error("error" in data ? data.error : `HTTP ${response.status}`);
      setReport(data as RunReport);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  const candidates = report?.candidates ?? [];
  const gates = useMemo(() => [...new Set(candidates.flatMap(candidate => candidate.gates.map(gate => gate.name)))], [candidates]);
  const findings = report?.capabilities?.findings ?? [];
  const localCommands = "npx --yes pnpm@11.9.0 install --frozen-lockfile\nnpx --yes pnpm@11.9.0 preflight\nnpx --yes pnpm@11.9.0 demo\nnpx --yes pnpm@11.9.0 dev";
  return <main>
    <header className="topbar"><a className="brand" href="#top" aria-label="Quantum Twin home"><span>QT</span><strong>Quantum <i>Twin</i></strong></a><nav aria-label="Project links"><a href={GITHUB}>GitHub</a><a href={`${GITHUB}#readme`}>Documentation</a></nav></header>
    <section id="top" className="intro"><div><p className="eyebrow">EVIDENCE-BACKED POST-QUANTUM MIGRATION</p><h1>Two migrations enter.<br/><i>External proof decides.</i></h1><p className="lede">Quantum Twin gives identical repository contracts to two isolated Codex builders, then deterministic gates select only a candidate that satisfies declared compatibility.</p><div className="badges"><Badge tone={recorded ? "recorded" : "live"}>{recorded ? "Recorded Verified Run" : "Live Local"}</Badge>{recorded && report?.redaction?.applied && <Badge>Public presentation artifact — local path redacted</Badge>}<Badge>Node.js 24 · native RSA</Badge></div></div><aside><span className="index">01</span><p>Scanner identifies cryptography. Coding agents create competing patches. Quantum Twin independently proves eligibility.</p></aside></section>

    <section className="start"><div className="section-title"><span>02</span><div><p className="eyebrow">START / INSPECT</p><h2>{recorded ? "Inspect genuine committed evidence" : "Run against an isolated repository copy"}</h2></div></div>
      {recorded ? <div className="recorded-panel"><label>Verified sample<select aria-label="Verified sample"><option>Update manifest service · compatibility required</option></select></label><div><p>Hosted mode never invokes Codex, Git, worktrees, repository scripts, or runtime writes.</p><pre>{localCommands}</pre><Copy value={localCommands} label="Copy local commands"/></div></div>
      : <form className="run-form" onSubmit={event => { event.preventDefault(); void run(); }}><label>Repository path<input value={repositoryPath} onChange={event => setRepositoryPath(event.target.value)} required/></label><label>Configuration path<input value={configPath} onChange={event => setConfigPath(event.target.value)} required/></label><label className="check"><input type="checkbox" checked={compatibility} onChange={event => setCompatibility(event.target.checked)}/> Legacy compatibility required</label><label className="check acknowledgement"><input type="checkbox" checked={allowExec} onChange={event => setAllowExec(event.target.checked)}/> I acknowledge declared repository commands will execute inside an isolated copy.</label><button className="primary" disabled={busy || !allowExec}>{busy ? "Building and evaluating…" : "Start migration tournament"}</button></form>}
      <div aria-live="polite">{busy && <p className="notice">Real Codex builders and external evaluation running. No synthetic progress shown.</p>}{error && <p className="error"><strong>Run failed.</strong> {error} Check authentication, repository configuration, paths, and execution acknowledgment.</p>}</div>
    </section>

    <section><div className="section-title"><span>03</span><div><p className="eyebrow">SCAN / CAPABILITIES</p><h2>Supported evidence stays separate from blockers</h2></div></div>
      <div className="repo-summary"><div><small>Repository</small><strong>{report?.repository?.name ?? "update-manifest-service"}</strong></div><div><small>Resolved commit</small><code>{report?.repository?.resolvedCommit ?? report?.baselineCommit ?? "—"}</code></div><div><small>Runtime shape</small><strong>{report?.capabilities ? `${report.capabilities.language.join(" + ")} · ${report.capabilities.moduleType} · ${report.capabilities.packageManager}` : "TypeScript · ESM · pnpm"}</strong></div></div>
      <Findings findings={findings}/>
      {!findings.length && report?.finding && <div className="legacy-finding"><strong>{report.finding.primitive} · {report.finding.operation}</strong><p>{report.finding.evidence.join(" ")}</p></div>}
    </section>

    <section><div className="section-title"><span>04</span><div><p className="eyebrow">CANDIDATE EXECUTION</p><h2>Same commit. Same contract. Different strategy.</h2></div></div><div className="candidate-grid">{(["direct", "bridge"] as const).map(strategy => <Candidate key={strategy} strategy={strategy} busy={busy} candidate={candidates.find(candidate => candidate.strategy === strategy)}/>)}</div></section>

    <section><div className="section-title"><span>05</span><div><p className="eyebrow">EVIDENCE DECISION</p><h2>AI cannot override failed gates</h2></div></div>
      <div className="decision"><div><span>DETERMINISTIC RESULT</span><strong>{report ? report.selectedCandidate?.toUpperCase() ?? "NO SAFE WINNER" : "NO RUN"}</strong><p>{report ? explanation(report) : "Run locally or inspect committed sample evidence."}</p></div><div className="report-hash">{report?.sourceReportSha256 ? <><span>ORIGINAL SOURCE REPORT SHA-256</span><code>{report.sourceReportSha256}</code><Copy value={report.sourceReportSha256}/><span>PRESENTATION ARTIFACT SHA-256</span><code>{report.presentationReportSha256 ?? "—"}</code>{report.presentationReportSha256 && <Copy value={report.presentationReportSha256}/>}</> : <><span>REPORT SHA-256</span><code>{report?.reportSha256 ?? "—"}</code>{report?.reportSha256 && <Copy value={report.reportSha256}/>}</>} {report && <a className="download" href="/api/runs/latest" download="run.json">Download run.json</a>}</div></div>
      {gates.length ? <div className="table-wrap" tabIndex={0} aria-label="Candidate hard gate matrix"><table><thead><tr><th>Hard gate</th>{candidates.map(candidate => <th key={candidate.strategy}>{candidate.strategy}</th>)}</tr></thead><tbody>{gates.map(name => <tr key={name}><th>{name}</th>{candidates.map(candidate => { const gate = candidate.gates.find(item => item.name === name); return <td key={candidate.strategy} className={gate?.passed ? "pass" : "fail"}>{gate ? <><strong>{gate.passed ? "PASS" : "FAIL"}</strong><small>{gate.detail}</small></> : "—"}</td>; })}</tr>)}</tbody></table></div> : <p className="empty">No gate evidence loaded.</p>}
      {report && <div className="provenance"><div><small>Model</small><code>{report.model}</code></div><div><small>Codex SDK</small><code>{report.codexSdkVersion}</code></div><div><small>Node</small><code>{report.nodeVersion}</code></div><div><small>Baseline</small><code>{report.baselineCommit}</code></div><div><small>Evaluator</small><code>{report.verifierManifestSha256}</code></div><div><small>Completed</small><code>{report.completedAt}</code></div></div>}
    </section>

    <section className="scope"><div><p className="eyebrow">IMPLEMENTED</p><h2>Constrained by repository contract</h2><p>Node.js 24 TypeScript/JavaScript repositories using native <code>node:crypto</code> RSA sign/verify paths, with npm or pnpm and a declared compatibility harness.</p></div><div><p className="eyebrow">DISCOVERY ONLY</p><p>TLS/X.509, JWT, Cloud KMS, HSM/PKCS#11, third-party cryptography, Java, Python, .NET, Go, and Rust produce evidence and adapter requirements—never patches.</p></div><div><p className="eyebrow">VERIFIED MEANS</p><p>Recorded engineering-contract gates passed in isolated evaluation. Not formal verification, FIPS module certification, side-channel proof, cryptographic guarantee, production approval, or proof that an entire system is quantum-safe.</p></div></section>
    <footer><strong>Quantum Twin</strong><span>Competing migrations. Independent evidence. Honest limits.</span></footer>
  </main>;
}
