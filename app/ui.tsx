"use client";
import { useEffect, useMemo, useState } from "react";
import type { CandidateResult, RunReport, ScannerHit } from "../src/domain.ts";

const GITHUB = "https://github.com/Shivansh3532/quantum-twin";
type Scenario = "compatibility" | "direct";
type RecordedReports = Record<Scenario, RunReport>;

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
  const measurement = candidate?.measurements;
  return <article className="candidate">
    <div className="candidate-head"><div><span className="strategy">{strategy}</span><h3>{title}</h3></div><Badge tone={state === "eligible" ? "live" : "plain"}>{state}</Badge></div>
    <p>{strategy === "direct" ? "ML-DSA-65 only. Lowest legacy exposure when compatibility permits." : "ML-DSA-65 plus declared RSA continuity for frozen consumers."}</p>
    <dl><dt>Branch</dt><dd>{candidate?.branch ?? `candidate/${strategy}`}</dd><dt>Codex thread</dt><dd>{candidate?.threadId ?? "—"}</dd><dt>Commit</dt><dd>{candidate?.worktreeCommit ?? "—"}</dd><dt>Generation</dt><dd>{candidate ? `${candidate.generationDurationMs} ms` : "—"}</dd><dt>Changed lines</dt><dd>{candidate?.changedLines ?? "—"}</dd><dt>Repair</dt><dd>{candidate ? (candidate.repairAttempted ? "attempted" : "not needed") : "—"}</dd><dt>Diff SHA-256</dt><dd>{candidate?.diffSha256 ?? "—"}</dd></dl>
    {candidate?.error && <p className="inline-error">{candidate.error}</p>}
    {candidate?.commands.length ? <details><summary>Commands and exit evidence</summary><div className="table-wrap compact" tabIndex={0}><table><thead><tr><th>Command</th><th>Exit</th><th>Duration</th></tr></thead><tbody>{candidate.commands.map((command, index) => <tr key={`${command.command}:${index}`}><td><code>{command.command}</code></td><td>{command.exitCode}</td><td>{command.durationMs} ms</td></tr>)}</tbody></table></div></details> : null}
    {measurement && <details><summary>Measured result</summary><dl><dt>RSA signatures</dt><dd>{measurement.rsaSignatures}</dd><dt>Envelope bytes</dt><dd>{measurement.envelopeBytes}</dd><dt>Signing median</dt><dd>{measurement.signMedianMs.toFixed(3)} ms</dd><dt>Signing p95</dt><dd>{measurement.signP95Ms.toFixed(3)} ms</dd><dt>Verify median</dt><dd>{measurement.verifyMedianMs.toFixed(3)} ms</dd><dt>Verify p95</dt><dd>{measurement.verifyP95Ms.toFixed(3)} ms</dd></dl></details>}
    {candidate?.diff && <details><summary>Inspect full candidate diff</summary><pre>{candidate.diff}</pre></details>}
  </article>;
}

function Findings({ findings }: { findings: ScannerHit[] }) {
  return <div className="findings">{findings.map((finding, index) => <article key={`${finding.file}:${finding.line}:${index}`}>
    <div><Badge tone={finding.status === "supported" ? "live" : "plain"}>{finding.status}</Badge><strong>{finding.technology}</strong></div>
    <code>{finding.file}:{finding.line}</code><p>{finding.operation} · {finding.importForm} · confidence {finding.confidence.toFixed(2)}</p>
    <small>{finding.algorithmEvidence}{finding.reason ? ` · ${finding.reason}. ${finding.requiredAdapter}` : ""}</small>
  </article>)}</div>;
}

function FindingGroup({ label, findings }: { label: string; findings: ScannerHit[] }) {
  if (!findings.length) return null;
  return <details><summary>{label} ({findings.length})</summary><Findings findings={findings}/></details>;
}

function explanation(report: RunReport | null) {
  const value = report?.explanation;
  if (value && typeof value === "object" && "summary" in value && typeof value.summary === "string") return value.summary;
  if (value && typeof value === "object" && "unavailable" in value && typeof value.unavailable === "string") return `GPT explanation unavailable: ${value.unavailable}`;
  return "No immutable evidence explanation available.";
}

function ExplanationDetails({ report }: { report: RunReport }) {
  const value = report.explanation;
  if (!value || typeof value !== "object" || !("summary" in value) || !("whySelected" in value) || !("limitations" in value) || typeof value.summary !== "string" || typeof value.whySelected !== "string" || !Array.isArray(value.limitations)) return null;
  return <details><summary>GPT explanation and limitations</summary><div className="detail-body"><p><strong>GPT explanation only.</strong> Deterministic TypeScript selected result before this text was produced.</p><p>{value.summary}</p><h3>Why selected</h3><p>{value.whySelected}</p><h3>Limitations</h3><ul>{value.limitations.map((item, index) => <li key={index}>{String(item)}</li>)}</ul></div></details>;
}

function EvidenceDetails({ report }: { report: RunReport }) {
  const capabilities = report.capabilities, contract = report.repositoryContract;
  return <div className="evidence-grid">
    {(capabilities || contract) && <details><summary>Repository and immutable contract</summary><div className="detail-body"><dl><dt>Repository</dt><dd>{report.repository?.name}</dd><dt>Source identity</dt><dd>{report.repository?.source}</dd><dt>Resolved source commit</dt><dd>{report.repository?.resolvedCommit ?? "—"}</dd>{capabilities && <><dt>Module format</dt><dd>{capabilities.moduleType}</dd><dt>Package manager</dt><dd>{capabilities.packageManager}</dd></>}{report.configSha256 && <><dt>Config SHA-256</dt><dd>{report.configSha256}</dd></>}<dt>Baseline manifest SHA-256</dt><dd>{report.fixtureManifestSha256}</dd><dt>Compatibility</dt><dd>{report.constraintProfile.legacyCompatibilityRequired ? "required" : "disabled"}</dd>{contract && <><dt>Contract version</dt><dd>{contract.version}</dd><dt>Target</dt><dd>{contract.target.primitive}</dd><dt>Declared context</dt><dd>{contract.target.context}</dd><dt>Writable paths</dt><dd>{contract.writablePaths.join(", ")}</dd><dt>Protected paths</dt><dd>{contract.protectedPaths.join(", ")}</dd><dt>Dependency policy</dt><dd>{contract.dependencyPolicy}</dd></>}</dl></div></details>}
    <details><summary>External evidence and provenance</summary><div className="detail-body"><dl><dt>Model</dt><dd>{report.model}</dd><dt>Codex SDK</dt><dd>{report.codexSdkVersion}</dd><dt>Node</dt><dd>{report.nodeVersion}</dd><dt>Platform</dt><dd>{report.platform}</dd><dt>Evaluator SHA-256</dt><dd>{report.verifierManifestSha256}</dd><dt>Report SHA-256</dt><dd>{report.reportSha256 ?? "—"}</dd><dt>Started</dt><dd>{report.startedAt}</dd><dt>Completed</dt><dd>{report.completedAt}</dd></dl><p>Gate names identify evaluator pass 1 and pass 2. Candidate cards expose commands, durations, diff hashes, measurements, and full diffs.</p></div></details>
    <ExplanationDetails report={report}/>
  </div>;
}

export default function Dashboard({ recorded = false, initialReport = null, recordedReports }: { recorded?: boolean; initialReport?: RunReport | null; recordedReports?: RecordedReports }) {
  const [scenario, setScenario] = useState<Scenario>("compatibility"), [report, setReport] = useState<RunReport | null>(initialReport), [busy, setBusy] = useState(false), [error, setError] = useState(""), [announcement, setAnnouncement] = useState("");
  const [repositoryPath, setRepositoryPath] = useState("fixture"), [configPath, setConfigPath] = useState("fixture/quantum-twin.config.json"), [compatibility, setCompatibility] = useState(true), [allowExec, setAllowExec] = useState(false);
  const load = () => fetch("/api/runs/latest").then(response => response.ok ? response.json() as Promise<RunReport> : null).then(setReport).catch(() => setReport(null));
  useEffect(() => { if (!recorded) void load(); }, [recorded]);
  function chooseScenario(value: Scenario) { setScenario(value); if (recordedReports) setReport(recordedReports[value]); setAnnouncement(value === "compatibility" ? "Legacy compatibility required. Bridge selected." : "Legacy compatibility disabled. Direct selected."); }
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
  const localCommands = "npx --yes pnpm@11.9.0 install --frozen-lockfile\nnpx --yes pnpm@11.9.0 preflight\nnpx --yes pnpm@11.9.0 demo\nnpx --yes pnpm@11.9.0 dev";
  const download = recorded ? `/api/runs/latest?scenario=${scenario}` : "/api/runs/latest";
  return <main>
    <header className="topbar"><a className="brand" href="#top" aria-label="Quantum Twin home"><span>QT</span><strong>Quantum <i>Twin</i></strong></a><nav aria-label="Project links"><a href={GITHUB}>GitHub</a><a href={`${GITHUB}#readme`}>Documentation</a></nav></header>
    <section id="top" className="intro"><div><p className="eyebrow">EVIDENCE-BACKED POST-QUANTUM MIGRATION</p><h1>Two migrations enter.<br/><i>External proof decides.</i></h1><p className="lede">Quantum Twin turns post-quantum migration from one generated patch into a constraint-driven tournament whose winner is selected by external deterministic evidence.</p><div className="badges"><Badge tone={recorded ? "recorded" : "live"}>{recorded ? "Recorded Verified Run" : "Live Local"}</Badge>{recorded && <Badge>Genuine Recorded Codex Run</Badge>}<Badge>Node.js 24 · native RSA</Badge></div></div><aside><span className="index">01</span><p>Same repository. Same strategies. Change one declared constraint; deterministic evidence changes eligible winner.</p></aside></section>

    <section className="start"><div className="section-title"><span>02</span><div><p className="eyebrow">START / INSPECT</p><h2>{recorded ? "Compare two genuine recorded scenarios" : "Run against an isolated repository copy"}</h2></div></div>
      {recorded ? <div className="recorded-panel"><label>Recorded scenario<select aria-label="Recorded scenario" value={scenario} onChange={event => chooseScenario(event.target.value as Scenario)}><option value="compatibility">Legacy compatibility required — Bridge selected</option><option value="direct">Legacy compatibility disabled — Direct selected</option></select></label><div><p><strong>Same repository. Same two strategies.</strong> {scenario === "compatibility" ? "Direct fails frozen compatibility, so Bridge is the only eligible candidate." : "Compatibility is disabled; both pass, and deterministic policy selects Direct because it retains fewer RSA signatures."}</p><p>Run {report?.runId} · source fixture <code>fixtures/release-cli</code></p><p>Hosted mode never invokes Codex, Git, worktrees, repository scripts, or runtime writes.</p><pre>{localCommands}</pre><Copy value={localCommands} label="Copy local commands"/></div></div>
      : <form className="run-form" onSubmit={event => { event.preventDefault(); void run(); }}><label>Repository path<input value={repositoryPath} onChange={event => setRepositoryPath(event.target.value)} required/></label><label>Configuration path<input value={configPath} onChange={event => setConfigPath(event.target.value)} required/></label><label className="check"><input type="checkbox" checked={compatibility} onChange={event => setCompatibility(event.target.checked)}/> Legacy compatibility required</label><label className="check acknowledgement"><input type="checkbox" checked={allowExec} onChange={event => setAllowExec(event.target.checked)}/> I acknowledge declared repository commands will execute inside an isolated copy.</label><button className="primary" disabled={busy || !allowExec}>{busy ? "Building and evaluating…" : "Start migration tournament"}</button></form>}
      <div aria-live="polite">{announcement && <p className="notice">{announcement}</p>}{busy && <p className="notice">Real Codex builders and external evaluation running. No synthetic progress shown.</p>}{error && <p className="error"><strong>Run failed.</strong> {error} Check authentication, repository configuration, paths, and execution acknowledgment.</p>}</div>
    </section>

    <section><div className="section-title"><span>03</span><div><p className="eyebrow">SCAN / CAPABILITIES</p><h2>Supported evidence stays separate from blockers</h2></div></div>
      <div className="repo-summary"><div><small>Repository</small><strong>{report?.repository?.name ?? "—"}</strong><code>{report?.repository?.source}</code></div><div><small>Resolved source commit</small><code>{report?.repository?.resolvedCommit ?? report?.baselineCommit ?? "—"}</code></div><div><small>Runtime shape</small><strong>{report?.capabilities ? `${report.capabilities.language.join(" + ")} · ${report.capabilities.moduleType} · ${report.capabilities.packageManager}` : "—"}</strong></div></div>
      {report?.capabilities && <><FindingGroup label="Supported scanner findings" findings={report.capabilities.supported}/><FindingGroup label="Discovery-only findings" findings={report.capabilities.discoveryOnly}/><FindingGroup label="Blocking findings" findings={report.capabilities.blockers}/></>}
      {report?.finding && <div className="legacy-finding"><strong>{report.finding.primitive} · {"operations" in report.finding ? report.finding.operations.join(" + ") : report.finding.operation}</strong><p>{report.finding.evidence.join(" ")}</p><code>{report.finding.affectedFiles.join(", ")}</code></div>}
    </section>

    <section><div className="section-title"><span>04</span><div><p className="eyebrow">CODEX IMPLEMENTATION</p><h2>Same commit. Same contract. Different strategy.</h2></div></div><div className="candidate-grid">{(["direct", "bridge"] as const).map(strategy => <Candidate key={strategy} strategy={strategy} busy={busy} candidate={candidates.find(candidate => candidate.strategy === strategy)}/>)}</div></section>

    <section><div className="section-title"><span>05</span><div><p className="eyebrow">EXTERNAL EVIDENCE</p><h2>GPT cannot override failed gates</h2></div></div>
      <div className="decision"><div><span>DETERMINISTIC RESULT</span><strong>{report ? report.selectedCandidate?.toUpperCase() ?? "NO SAFE WINNER" : "NO RUN"}</strong><p>{report ? explanation(report) : "Run locally or inspect committed sample evidence."}</p></div><div className="report-hash"><span>REPORT SHA-256</span><code>{report?.reportSha256 ?? "—"}</code>{report?.reportSha256 && <Copy value={report.reportSha256}/>} {report && <a className="download" href={download} download={`release-cli-${scenario}.json`}>Download selected report</a>}</div></div>
      {gates.length ? <div className="table-wrap" tabIndex={0} aria-label="Candidate hard gate matrix"><table><thead><tr><th>Hard gate</th>{candidates.map(candidate => <th key={candidate.strategy}>{candidate.strategy}</th>)}</tr></thead><tbody>{gates.map(name => <tr key={name}><th>{name}</th>{candidates.map(candidate => { const gate = candidate.gates.find(item => item.name === name); return <td key={candidate.strategy} className={gate?.passed ? "pass" : "fail"}>{gate ? <><strong>{gate.passed ? "PASS" : "FAIL"}</strong><small>{gate.detail}{gate.durationMs === undefined ? "" : ` · ${gate.durationMs} ms`}</small></> : "—"}</td>; })}</tr>)}</tbody></table></div> : <p className="empty">No gate evidence loaded.</p>}
      {report && <><div className="provenance"><div><small>Model</small><code>{report.model}</code></div><div><small>Codex SDK</small><code>{report.codexSdkVersion}</code></div><div><small>Node / platform</small><code>{report.nodeVersion} · {report.platform}</code></div><div><small>Baseline</small><code>{report.baselineCommit}</code></div><div><small>Compatibility harness</small><code>{report.verifierManifestSha256}</code></div><div><small>Completed</small><code>{report.completedAt}</code></div></div><EvidenceDetails report={report}/></>}
    </section>

    <section><div className="section-title"><span>06</span><div><p className="eyebrow">WHY THIS IS DIFFERENT</p><h2>One patch is not a migration decision</h2></div></div><p className="differentiator">Quantum Twin turns post-quantum migration from one generated patch into a constraint-driven tournament whose winner is selected by external deterministic evidence.</p><div className="comparison"><article><h3>Traditional scanner</h3><p>Identifies cryptography. Does not implement or compare migrations.</p></article><article><h3>One coding-agent prompt</h3><p>Produces one candidate. Does not independently prove frozen compatibility.</p></article><article><h3>Quantum Twin</h3><p>Creates isolated competing implementations, disqualifies failed candidates, changes result when constraints change, preserves evidence, and returns NO SAFE WINNER when none qualify.</p></article></div></section>

    <section><div className="section-title"><span>07</span><div><p className="eyebrow">WHY THIS MATTERS NOW</p><h2>Migration needs implementation evidence</h2></div></div><div className="impact"><p><a href="https://csrc.nist.gov/projects/post-quantum-cryptography">NIST standardized the first post-quantum cryptography algorithms in 2024</a> and says organizations should begin migration. <a href="https://www.nccoe.nist.gov/applied-cryptography/migration-to-pqc">NCCoE separates cryptographic discovery from interoperability testing</a>. <a href="https://www.cisa.gov/resources-tools/resources/quantum-readiness-migration-post-quantum-cryptography">CISA, NSA, and NIST urge early migration planning and inventory</a>.</p><p>Inventory locates cryptography; it does not prove a concrete code change preserves declared compatibility. Quantum Twin demonstrates that developer-level decision against an immutable contract.</p></div></section>

    <section className="scope"><div><p className="eyebrow">IMPLEMENTED</p><h2>Constrained by repository contract</h2><p>Node.js 24 TypeScript/JavaScript repositories using native <code>node:crypto</code> RSA sign/verify paths, with npm or pnpm and a declared compatibility harness.</p></div><div><p className="eyebrow">DISCOVERY ONLY</p><p>TLS/X.509, JWT, Cloud KMS, HSM/PKCS#11, third-party cryptography, Java, Python, .NET, Go, and Rust produce evidence and adapter requirements—never patches.</p></div><div><p className="eyebrow">VERIFIED MEANS</p><p>Recorded engineering-contract gates passed in isolated evaluation. Not formal verification, FIPS module certification, side-channel proof, cryptographic guarantee, production approval, or proof for an entire system.</p></div></section>
    <footer><strong>Quantum Twin</strong><span>Competing migrations. Independent evidence. Honest limits.</span></footer>
  </main>;
}
