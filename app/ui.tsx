"use client";
import { useEffect, useState } from "react";

type Report = any;
export default function Dashboard() {
  const [report, setReport] = useState<Report>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [compatibility, setCompatibility] = useState(true);
  const load = () => fetch("/api/runs/latest").then(r => r.ok ? r.json() : null).then(setReport).catch(() => setReport(null));
  useEffect(() => { load(); }, []);
  async function run() { setBusy(true); setError(""); try { const r = await fetch("/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ legacyCompatibilityRequired: compatibility }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setReport(data); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }
  const candidates = report?.candidates ?? [];
  return <main>
    <header><div><span className="eyebrow">POST-QUANTUM MIGRATION CONTROL</span><h1>Quantum <i>Twin</i></h1></div><div className="status"><b>{report ? "EVIDENCE READY" : "AWAITING RUN"}</b><small>{report?.runId ?? "No recorded run"}</small></div></header>
    <section className="hero"><div><p className="kicker">01 / MIGRATION BRIEF</p><h2>Legacy RSA detected.<br/>Prove the safest path forward.</h2><p className="lede">Two isolated Codex builders migrate one identical repository. External gates decide. GPT-5.6 explains—never overrides.</p><label className="toggle"><input type="checkbox" checked={compatibility} onChange={e=>setCompatibility(e.target.checked)} disabled={busy}/> Legacy client compatibility required</label></div><button onClick={run} disabled={busy}>{busy ? "RUNNING TOURNAMENT…" : "RUN TOURNAMENT"}</button></section>
    {error && <div className="alert"><b>RUN FAILED</b><span>{error}</span><small>Credentials, timeout, and candidate failures stay visible; no fake fallback is shown.</small></div>}
    <section><p className="kicker">02 / CANDIDATE EXECUTION</p><div className="grid">{["direct", "bridge"].map((name, i) => { const c = candidates.find((x: any) => x.strategy === name); return <article key={name}><div className="number">0{i+1}</div><h3>{name === "direct" ? "Direct Cutover" : "Compatibility Bridge"}</h3><p>{name === "direct" ? "ML-DSA-65 only. Minimal legacy exposure." : "ML-DSA-65 plus frozen-client RSA continuity."}</p><dl><dt>STATE</dt><dd className={c?.generationStatus === "eligible" ? "pass" : "fail"}>{c?.generationStatus ?? (busy ? "generating" : "not run")}</dd><dt>BRANCH</dt><dd>{c?.branch ?? `candidate/${name}`}</dd><dt>THREAD</dt><dd>{c?.threadId ?? "—"}</dd><dt>CHANGED LINES</dt><dd>{c?.changedLines ?? "—"}</dd></dl></article>; })}</div></section>
    <section><p className="kicker">03 / EVIDENCE DECISION</p><div className="decision"><div><span>SELECTED CANDIDATE</span><strong>{report?.selectedCandidate ? report.selectedCandidate.toUpperCase() : report ? "NO SAFE WINNER" : "—"}</strong><p>{report?.explanation?.summary ?? "Run tournament to produce immutable evidence."}</p></div><div className="hash"><span>REPORT SHA-256</span><code>{report?.reportSha256 ?? "—"}</code>{report && <a href="/api/runs/latest" download="run.json">DOWNLOAD RUN.JSON</a>}</div></div>
      {candidates.length > 0 && <div className="matrix"><div className="row head"><span>HARD GATE</span>{candidates.map((c:any)=><span key={c.strategy}>{c.strategy.toUpperCase()}</span>)}</div>{Array.from(new Set(candidates.flatMap((c:any)=>c.gates.map((g:any)=>g.name)))).map((gate:any)=><div className="row" key={gate}><span>{gate}</span>{candidates.map((c:any)=>{const g=c.gates.find((x:any)=>x.name===gate);return <span key={c.strategy} className={g?.passed?"pass":"fail"}>{g ? (g.passed?"PASS":"FAIL") : "—"}</span>})}</div>)}</div>}
    </section>
    <footer>Verified means recorded engineering-contract gates passed. Not formal verification, FIPS certification, or production approval.</footer>
  </main>;
}
