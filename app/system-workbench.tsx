"use client";
import { useState } from "react";
import type { BundleAnalysis } from "../src/intake.ts";
import type { SystemRunReport } from "../src/system-engine.ts";

type SourceRow = { id: number; mode: "github" | "local" | "demo"; value: string };
const DEMO = "https://github.com/Shivansh3532/quantum-twin-demo-target";

async function responseJson<T>(response: Response) {
  const value = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`);
  return value;
}

export default function SystemWorkbench() {
  const [name, setName] = useState(""), [rows, setRows] = useState<SourceRow[]>([{ id: 1, mode: "github", value: "" }]), [nextId, setNextId] = useState(2);
  const [frozen, setFrozen] = useState(""), [analysis, setAnalysis] = useState<BundleAnalysis | null>(null), [approved, setApproved] = useState<BundleAnalysis | null>(null);
  const [typed, setTyped] = useState(""), [executionText, setExecutionText] = useState(""), [trust, setTrust] = useState(false), [commands, setCommands] = useState(false), [codex, setCodex] = useState(false), [report, setReport] = useState<SystemRunReport | null>(null), [state, setState] = useState<"idle" | "importing" | "analyzing" | "review" | "approved" | "baseline" | "building" | "evaluating" | "selected" | "no-safe-winner" | "failed">("idle"), [message, setMessage] = useState("No system exists in this live session."), [error, setError] = useState("");
  const consumers = frozen.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  function change(id: number, patch: Partial<SourceRow>) { setRows(current => current.map(row => row.id === id ? { ...row, ...patch, value: patch.mode === "demo" ? DEMO : patch.mode && patch.mode !== row.mode ? "" : patch.value ?? row.value } : row)); setAnalysis(null); setApproved(null); }
  function add() { setRows(current => [...current, { id: nextId, mode: "github", value: "" }]); setNextId(value => value + 1); }
  async function analyze(event: React.FormEvent) {
    event.preventDefault(); setError(""); setAnalysis(null); setApproved(null);
    try {
      setState("importing"); setMessage("Copying every repository into controlled local storage. No repository command is running.");
      const intakeIds: string[] = [];
      for (const row of rows) {
        const body = row.mode === "demo" ? { mode: "demo" } : row.mode === "github" ? { mode: "github", url: row.value } : { mode: "local", path: row.value };
        const intake = await responseJson<{ id: string }>(await fetch("/api/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
        intakeIds.push(intake.id);
      }
      setState("analyzing"); setMessage("Building the service, workspace, and cryptographic graph. No repository code is running.");
      const value = await responseJson<BundleAnalysis>(await fetch("/api/bundles/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, intakeIds, frozenConsumers: consumers }) }));
      setAnalysis(value); setState("review"); setMessage(value.message);
    } catch (cause) { const detail = cause instanceof Error ? cause.message : String(cause); setError(detail); setState("failed"); setMessage(`System analysis failed: ${detail}`); }
  }
  async function approve() {
    if (!analysis) return;
    setError("");
    try {
      const value = await responseJson<BundleAnalysis>(await fetch("/api/bundles/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, intakeIds: analysis.intakeIds, contractSha256: analysis.contract.sha256, frozenConsumers: consumers, typedApproval: typed }) }));
      setApproved(value); setState("approved"); setMessage("Contract approved and re-hashed. Repository execution still requires separate command and Codex authorization.");
    } catch (cause) { const detail = cause instanceof Error ? cause.message : String(cause); setError(detail); setMessage(`Contract approval failed: ${detail}`); }
  }
  async function startTournament() {
    if (!approved) return;
    setError(""); setReport(null);
    try {
      const response = await fetch("/api/bundles/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, intakeIds: approved.intakeIds, frozenConsumers: consumers, approvedContractSha256: approved.contract.sha256, trustRepositories: trust, allowCommands: commands, allowCodex: codex, typedApproval: executionText }) });
      if (!response.ok || !response.body) throw new Error(String((await response.json() as { error?: string }).error ?? `HTTP ${response.status}`));
      const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = "";
      while (true) {
        const chunk = await reader.read(); pending += decoder.decode(chunk.value, { stream: !chunk.done });
        const lines = pending.split("\n"); pending = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as { stage: typeof state; detail?: string; error?: string; report?: SystemRunReport };
          setState(event.stage); setMessage(event.detail ?? event.error ?? event.stage.replaceAll("-", " "));
          if (event.error) setError(event.error); if (event.report) setReport(event.report);
        }
        if (chunk.done) break;
      }
    } catch (cause) { const detail = cause instanceof Error ? cause.message : String(cause); setError(detail); setState("failed"); setMessage(`Tournament failed: ${detail}`); }
  }
  return <section aria-labelledby="lab-title"><div className="section-title"><span>01</span><div><p className="eyebrow">CREATE SYSTEM BUNDLE</p><h2 id="lab-title">Start with source, not a result</h2></div></div>
    <div className="lab-steps" aria-label="System Lab journey">CREATE BUNDLE · ADD SOURCES · ANALYZE · CRYPTO GRAPH · CONTRACT · PERMISSIONS · BASELINE · TOURNAMENT · SYSTEM TESTS · DECISION · EXPORT</div>
    <form className="lab-intake" onSubmit={analyze}><label>System name<input value={name} onChange={event => setName(event.target.value)} required placeholder="Payments system"/></label><fieldset><legend>Repositories and services</legend>{rows.map((row, index) => <div className="bundle-source" key={row.id}><label>Source {index + 1}<select value={row.mode} onChange={event => change(row.id, { mode: event.target.value as SourceRow["mode"] })}><option value="demo">Independent public demo</option><option value="github">Public GitHub HTTPS URL</option><option value="local">Trusted local folder</option></select></label><label>Location<input type={row.mode === "github" || row.mode === "demo" ? "url" : "text"} value={row.value} readOnly={row.mode === "demo"} required onChange={event => change(row.id, { value: event.target.value })}/></label>{rows.length > 1 && <button type="button" className="copy" onClick={() => setRows(current => current.filter(item => item.id !== row.id))}>Remove</button>}</div>)}<button type="button" className="secondary" onClick={add}>Add repository or service</button></fieldset><label>Frozen external consumers, one per line<textarea value={frozen} onChange={event => setFrozen(event.target.value)} placeholder="mobile-client-v1"/></label><button className="primary" disabled={state === "importing" || state === "analyzing"}>Analyze System</button></form>
    <div className="lab-status" aria-live="polite"><strong>{state.replaceAll("-", " ").toUpperCase()}</strong><span>{message}</span>{error && <p className="error">{error}</p>}</div>
    {analysis && <div className="lab-analysis"><h3>System Bundle</h3><dl><dt>Name</dt><dd>{analysis.bundle.name}</dd><dt>Manifest SHA-256</dt><dd>{analysis.bundle.manifestSha256}</dd><dt>Repositories</dt><dd>{analysis.bundle.repositories.length}</dd><dt>Components</dt><dd>{analysis.bundle.components.length}</dd><dt>Graph SHA-256</dt><dd>{analysis.bundle.graph.sha256}</dd><dt>Contract SHA-256</dt><dd>{analysis.contract.sha256}</dd></dl>
      <details open><summary>Repositories and pinned source</summary><ul className="lab-findings">{analysis.bundle.repositories.map(repository => <li key={repository.id}><strong>{repository.name} · {repository.packageManager} · {repository.moduleType}</strong><code>{repository.source} · {repository.commit ?? "local tree"}</code><span>tree {repository.treeSha256}</span></li>)}</ul></details>
      <details open><summary>System Crypto Graph ({analysis.bundle.graph.nodes.length} nodes · {analysis.bundle.graph.edges.length} edges)</summary><ul className="lab-findings">{analysis.bundle.graph.nodes.map(node => <li key={node.id}><strong>{node.kind} · {node.controlled ? "controlled" : "frozen"}</strong><code>{node.location ?? node.id}</code><span>{node.label}</span></li>)}</ul></details>
      <details open className="contract-review"><summary>Generated contract and provenance</summary><div className="contract-grid"><div><strong>Commands</strong>{Object.entries(analysis.contract.commands.value).map(([key, parts]) => <code key={key}>{key}: {parts.join(" ")}</code>)}</div><div><strong>Entry points</strong>{analysis.contract.entryPoints.value.map(item => <code key={item}>{item}</code>)}</div><div><strong>Writable paths</strong>{analysis.contract.writablePaths.value.map(item => <code key={item}>{item}</code>)}</div><div><strong>Protected paths</strong>{analysis.contract.protectedPaths.value.map(item => <code key={item}>{item}</code>)}</div><div><strong>Crypto boundaries</strong>{analysis.contract.boundaries.value.map(item => <code key={item}>{item}</code>)}</div><div><strong>Provenance</strong><code>repositories: {analysis.contract.repositories.provenance}</code><code>commands: {analysis.contract.commands.provenance}</code><code>workflows: {analysis.contract.workflows.provenance}</code></div></div></details>
      {analysis.blockers.length > 0 && <div className="lab-blockers"><strong>Boundaries and blockers</strong><ul>{analysis.blockers.map(item => <li key={item}>{item}</li>)}</ul></div>}
      {analysis.status === "review-required" && <section className="trust-center"><h3>Approve generated contract</h3><p>Approval freezes the exact contract hash. It does not authorize commands, Codex, application to original repositories, commits, or pushes.</p><label>Type APPROVE SYSTEM CONTRACT<input value={typed} onChange={event => setTyped(event.target.value)}/></label><button className="primary" type="button" disabled={typed !== "APPROVE SYSTEM CONTRACT"} onClick={approve}>Approve exact contract</button></section>}
      {approved && <><div className="decision"><div><span>CONTRACT STATE</span><strong>APPROVED</strong><p>Approved contract SHA-256: {approved.contract.sha256}</p></div><div><span>NEXT SAFETY BOUNDARY</span><p>Command execution and two Codex builders require separate explicit authorization.</p></div></div><section className="trust-center"><h3>Establish baseline and run tournament</h3><label><input type="checkbox" checked={trust} onChange={event => setTrust(event.target.checked)}/> I trust every listed repository and reviewed its inferred commands.</label><label><input type="checkbox" checked={commands} onChange={event => setCommands(event.target.checked)}/> I authorize the exact frozen install/build/start/test/cleanup commands in isolated copies.</label><label><input type="checkbox" checked={codex} onChange={event => setCodex(event.target.checked)}/> I authorize two Codex builders in isolated, network-disabled worktrees.</label><label>Type RUN COORDINATED TOURNAMENT<input value={executionText} onChange={event => setExecutionText(event.target.value)}/></label><button type="button" className="primary" disabled={!trust || !commands || !codex || executionText !== "RUN COORDINATED TOURNAMENT" || ["baseline", "building", "evaluating"].includes(state)} onClick={startTournament}>Establish Baseline and Run</button></section></>}
      {report && <section><div className="section-title"><span>10</span><div><p className="eyebrow">DETERMINISTIC DECISION</p><h2>{report.selectedCandidate?.toUpperCase() ?? "NO SAFE WINNER"}</h2></div></div><div className="decision"><div><span>FRESH RUN</span><strong>{report.selectedCandidate?.toUpperCase() ?? "REFUSED"}</strong><p>{report.decision}</p></div><div><span>REPORT SHA-256</span><code>{report.reportSha256}</code><p>{report.runId}</p><a className="download" href={`/api/bundles/export?runId=${encodeURIComponent(report.runId)}`} download>Download coordinated evidence bundle and repository patches</a></div></div><div className="candidate-grid">{report.candidates.map(candidate => <article className="candidate" key={candidate.strategy}><h3>{candidate.strategy}</h3><p>{candidate.eligible ? "ELIGIBLE" : "INELIGIBLE"} · {candidate.changedRepositories.length} repositories · {candidate.passes.length} clean passes</p><dl><dt>Codex thread</dt><dd>{candidate.threadId ?? "generation failed"}</dd><dt>Candidate commit</dt><dd>{candidate.commit ?? "not committed"}</dd><dt>Changed repositories</dt><dd>{candidate.changedRepositories.join(", ") || "none"}</dd><dt>Diff SHA-256</dt><dd>{candidate.diffSha256}</dd></dl><details><summary>Complete gates, commands, and clean passes</summary><ul>{candidate.gates.map(gate => <li key={gate.name}><strong>{gate.passed ? "PASS" : "FAIL"}</strong> {gate.name}: {gate.detail}</li>)}</ul>{candidate.passes.map(pass => <div key={pass.pass}><h4>Clean evaluator pass {pass.pass}</h4>{pass.commands.map(item => <code key={`${item.repositoryId}:${item.stage}`}>{item.command} · exit {item.exitCode} · {item.durationMs} ms</code>)}</div>)}</details></article>)}</div><details open><summary>Observed runtime crypto graph and rollout</summary><dl><dt>Observed graph SHA-256</dt><dd>{report.observedGraph.sha256}</dd><dt>Runtime crypto events</dt><dd>{report.observedGraph.runtimeEvents.length}</dd><dt>Upgrade order</dt><dd>{report.rollout.upgradeOrder.join(" → ")}</dd><dt>Compatibility window</dt><dd>{report.rollout.compatibilityWindow}</dd><dt>RSA retirement</dt><dd>{report.rollout.rsaRetirementCondition}</dd><dt>Rollback</dt><dd>{report.rollout.rollback.join("; ")}</dd></dl></details><details><summary>Create coordinated local branches after review</summary><p>Download the evidence bundle, create a JSON map from repository IDs to clean local Git roots, then run:</p><code>pnpm apply-system -- EVIDENCE.json REPOSITORIES.json --confirm &quot;CREATE COORDINATED LOCAL BRANCHES&quot;</code><p>This creates new `quantum-twin/*` branches in temporary worktrees. It never switches or writes main and never pushes.</p></details><p className="notice">Passing these engineering gates is not certification or production approval. Applying patches or creating local branches is a separate, explicitly approved operation. Quantum Twin never writes original repositories, commits, or pushes from this run.</p></section>}
    </div>}
    {!analysis && <div className="lab-status"><strong>NO RUN</strong><span>No winner, candidate, run ID, hash, or gate result exists in this live session.</span></div>}
  </section>;
}
