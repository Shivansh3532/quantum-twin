import Link from "next/link";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Dashboard from "../ui";
import { Nav, SiteFooter, REPO_URL } from "../nav";
import compatibilityRun from "@/sample/release-cli-compatibility.json";
import directRun from "@/sample/release-cli-direct.json";
import publicCompatibilityRun from "@/sample/public-target-compatibility.json";
import publicDirectRun from "@/sample/public-target-direct.json";
import systemRun from "@/evidence/system-demo-run.json";
import type { RunReport } from "../../src/domain.ts";
import type { SystemRunReport } from "../../src/system-engine.ts";

const DEMO_TARGET = "https://github.com/Shivansh3532/quantum-twin-demo-target";

// The full interactive evidence explorer. Kept for the README's /demo?scenario=… deep-links;
// the bare /demo tab shows the simple video + repository page below instead.
function EvidenceExplorer() {
  const reports = { compatibility: compatibilityRun as RunReport, direct: directRun as RunReport, "public-compatibility": publicCompatibilityRun as RunReport, "public-direct": publicDirectRun as RunReport };
  const coordinated = systemRun as unknown as SystemRunReport & { presentation: { statement: string; sourceReportFileSha256: string; sourceReportSha256: string }; presentationReportSha256: string };
  const banner = <section className="recorded-system" aria-labelledby="recorded-system-title"><p className="eyebrow">BONUS: COORDINATED MULTI-REPOSITORY RUN</p><h2 id="recorded-system-title">One migration across several repositories</h2><p><strong>Public evidence artifact — local file paths redacted.</strong> This committed artifact is not byte-identical to the ignored source report.</p><dl><dt>Decision</dt><dd>{coordinated.selectedCandidate?.toUpperCase() ?? "NO SAFE WINNER"}</dd><dt>Run ID</dt><dd>{coordinated.runId}</dd><dt>Source report SHA-256</dt><dd><code>{coordinated.presentation.sourceReportSha256}</code></dd><dt>Source report file SHA-256</dt><dd><code>{coordinated.presentation.sourceReportFileSha256}</code></dd><dt>Presentation artifact SHA-256</dt><dd><code>{coordinated.presentationReportSha256}</code></dd></dl><p>Builder A changed both the signing and verifying code but failed the frozen-client check. Builder B changed both repositories, passed two clean end-to-end runs and rollback, and was selected automatically.</p></section>;
  return <Dashboard recorded initialReport={reports.compatibility} recordedReports={reports} banner={banner}/>;
}

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  if ((await searchParams).scenario) return <EvidenceExplorer/>;

  const hasVideo = existsSync(join(process.cwd(), "public/demo/quantum-twin-demo.mp4"));
  const hasPoster = existsSync(join(process.cwd(), "public/demo/quantum-twin-demo-poster.webp"));

  return <><a className="skip-link" href="#main-content">Skip to main content</a><main id="main-content" tabIndex={-1}>
    <Nav current="/demo"/>
    <section className="intro compact-intro"><div>
      <p className="eyebrow">DEMO</p>
      <h1>See it run.</h1>
      <p className="lede">A short video shows Quantum Twin finding RSA, building two migrations with Codex, testing both, and returning the verified winner. The full source is public — read it, clone it, run it yourself.</p>
      <nav className="hero-actions" aria-label="Demo actions">
        <a className="primary-link" href={REPO_URL} rel="noreferrer">View the code on GitHub</a>
        <Link href="/#run-locally">Run it locally</Link>
        <Link href="/demo?scenario=compatibility">Explore recorded evidence</Link>
      </nav>
    </div></section>

    <section aria-labelledby="watch-title"><div className="section-title"><span>01</span><div><p className="eyebrow">WALKTHROUGH</p><h2 id="watch-title">Watch a complete migration.</h2></div></div>
      {hasVideo
        ? <video className="hm-video" controls preload="metadata" poster={hasPoster ? "/demo/quantum-twin-demo-poster.webp" : undefined}><source src="/demo/quantum-twin-demo.mp4" type="video/mp4"/><track kind="captions" label="Description" srcLang="en"/>Your browser cannot play this video. <a href={REPO_URL} rel="noreferrer">View the code on GitHub</a> instead.</video>
        : <div className="hm-preview-fallback"><p>The walkthrough video is coming soon. In the meantime, read the code or explore the recorded evidence.</p><a className="primary-link" href={REPO_URL} rel="noreferrer">View the code on GitHub</a></div>}
    </section>

    <section aria-labelledby="repo-title"><div className="section-title"><span>02</span><div><p className="eyebrow">SOURCE</p><h2 id="repo-title">Everything is public.</h2></div></div>
      <p className="lede">Quantum Twin and the independent repository used in the recorded run are both open on GitHub. No sign-up, no hidden steps.</p>
      <div className="local-grid">
        <a href={REPO_URL} rel="noreferrer"><strong>Quantum Twin →</strong><span>The full tool: detector, Codex builders, verifier, tests, and this UI.</span></a>
        <a href={DEMO_TARGET} rel="noreferrer"><strong>Demo target repository →</strong><span>The independent public Node.js repo migrated in the recorded run.</span></a>
      </div>
    </section>
    <SiteFooter/>
  </main></>;
}
