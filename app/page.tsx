import Link from "next/link";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Nav, SiteFooter } from "./nav";

const FLOW = [
  { k: "01", t: "Repository", d: "Your Node.js code" },
  { k: "02", t: "Discover", d: "Find RSA signatures" },
  { k: "03", t: "Plan", d: "GPT-5.6 migration plan" },
  { k: "04", t: "Build twice", d: "Two Codex builders" },
  { k: "05", t: "Verify", d: "The same checks on both" },
  { k: "06", t: "Review", d: "You approve the winner" },
];

const STAGES = [
  { k: "DISCOVER", d: "Find cryptographic code and everything connected to it." },
  { k: "EXPLAIN", d: "GPT-5.6 creates a migration plan developers can understand." },
  { k: "BUILD TWICE", d: "Two isolated Codex builders create independent solutions." },
  { k: "PROVE", d: "The same repeatable checks test both and keep the verified result." },
];

const CHECKS = [
  { t: "Build the app", d: "The migrated code still compiles and installs." },
  { t: "Create a signature", d: "New ML-DSA signing works on real data." },
  { t: "Verify a signature", d: "The new signature is accepted by the verifier." },
  { t: "Run existing tests", d: "The repository's own test suite still passes." },
  { t: "Check compatibility", d: "Frozen RSA consumers still verify when required." },
  { t: "Repeat cleanly", d: "The checks give the same result when run again." },
];

export default function Page() {
  const hasVideo = existsSync(join(process.cwd(), "public/demo/quantum-twin-demo.mp4"));
  const hasPoster = existsSync(join(process.cwd(), "public/demo/quantum-twin-demo-poster.webp"));
  const previewShot = ["public/demo/screens/home-desktop.png", "public/demo/screens/demo-decision.png"]
    .find(path => existsSync(join(process.cwd(), path)));

  return <><a className="skip-link" href="#main-content">Skip to main content</a><main id="main-content" tabIndex={-1}>
    <Nav current="/"/>

    <section className="hm-hero" aria-labelledby="hero-title">
      <div className="hm-hero-copy">
        <p className="eyebrow">POST-QUANTUM MIGRATION FOR NODE.JS</p>
        <h1 id="hero-title">Upgrade old cryptography <i>safely.</i></h1>
        <p className="lede">Quantum Twin finds RSA signatures in your code, plans a move to NIST-standardized ML-DSA, creates two independent migrations with Codex, tests both, and gives you the verified result to review.</p>
        <nav className="hero-actions" aria-label="Get started"><Link className="primary-link" href="/demo">Try the Demo</Link><Link href="/#how-it-works">See How It Works</Link></nav>
        <p className="hm-trust">Built with Codex and GPT-5.6, guided and reviewed by humans.</p>
      </div>
      <div className="hm-hero-art">
        <div className="hm-logo" aria-hidden="true">QT</div>
        <ol className="hm-flow" aria-label="How a migration moves through Quantum Twin">
          {FLOW.map(step => <li key={step.k} style={{ ["--i" as string]: FLOW.indexOf(step) }}><span>{step.k}</span><strong>{step.t}</strong><small>{step.d}</small></li>)}
        </ol>
      </div>
    </section>

    <section aria-labelledby="problem-title"><div className="section-title"><span>01</span><div><p className="eyebrow">THE PROBLEM</p><h2 id="problem-title">Replacing cryptography is not one code change.</h2></div></div>
      <p className="lede">Security code can be spread across files, libraries, keys, tests, and services. Missing one dependency can break signing, verification, or compatibility.</p>
      <ul className="hm-graph" aria-label="Places one signature can reach">
        <li><strong>Signing code</strong><small>Where the signature is created</small></li>
        <li><strong>Verification code</strong><small>Where the signature is used or verified</small></li>
        <li><strong>Keys</strong><small>Key generation and storage</small></li>
        <li><strong>Tests</strong><small>Suites that assume the old format</small></li>
        <li><strong>Other services</strong><small>Consumers that already trust today&apos;s signature</small></li>
      </ul>
    </section>

    <section aria-labelledby="why-title"><div className="section-title"><span>02</span><div><p className="eyebrow">WHY NOW</p><h2 id="why-title">Migration must begin before Q-Day.</h2></div></div>
      <p className="lede">Q-Day is the point when a sufficiently capable quantum computer could break widely used public-key cryptography. The exact date is unknown, and large migrations can take years. <a href="https://csrc.nist.gov/projects/post-quantum-cryptography">NIST standardized the first post-quantum algorithms in 2024</a> and advises organizations to start planning now.</p>
    </section>

    <section id="how-it-works" aria-labelledby="how-title"><div className="section-title"><span>03</span><div><p className="eyebrow">HOW IT WORKS</p><h2 id="how-title">Discover → Explain → Build twice → Prove</h2></div></div>
      <div className="hm-stages">{STAGES.map((stage, index) => <article key={stage.k}><span className="hm-stage-index">{String(index + 1).padStart(2, "0")}</span><h3>{stage.k}</h3><p>{stage.d}</p></article>)}</div>
    </section>

    <section aria-labelledby="preview-title"><div className="section-title"><span>04</span><div><p className="eyebrow">REAL PRODUCT PREVIEW</p><h2 id="preview-title">See a complete migration.</h2></div></div>
      <p className="lede">Watch Quantum Twin find RSA signatures, create two upgrades, test both, and return the verified result.</p>
      {hasVideo
        ? <video className="hm-video" controls preload="metadata" poster={hasPoster ? "/demo/quantum-twin-demo-poster.webp" : undefined}><source src="/demo/quantum-twin-demo.mp4" type="video/mp4"/><track kind="captions" label="Description" srcLang="en"/>Your browser cannot play this video. <Link href="/demo">Open the recorded demo</Link> instead.</video>
        : previewShot
          ? <Link className="hm-preview-shot" href="/demo"><img src={`/${previewShot.replace("public/", "")}`} alt="Quantum Twin demo screen: two migrations compared with verification evidence" loading="lazy"/><span>Open the recorded demo →</span></Link>
          : <div className="hm-preview-fallback"><p>The recorded walkthrough video is coming soon.</p><Link className="primary-link" href="/demo">Open the recorded demo</Link></div>}
    </section>

    <section aria-labelledby="two-title"><div className="section-title"><span>05</span><div><p className="eyebrow">WHY TWO BUILDERS</p><h2 id="two-title">Do not trust the first generated patch.</h2></div></div>
      <p className="lede">Quantum Twin gives the same migration plan to two independent Codex builders. Their work is tested separately, so one weak implementation does not become the only option.</p>
      <div className="hm-builders"><article><span className="strategy">Codex Builder A</span><h3>Direct Cutover</h3><p>Moves fully to ML-DSA-65. Lowest legacy exposure when nothing else still needs the old signature.</p></article><article><span className="strategy">Codex Builder B</span><h3>Compatibility Bridge</h3><p>Adds ML-DSA-65 while keeping RSA for consumers that are frozen and cannot change yet.</p></article></div>
      <p className="hm-note">Both builders receive the same approved plan but work independently. You see each one&apos;s real status, files, and test results in the <Link href="/demo">demo</Link>.</p>
    </section>

    <section aria-labelledby="verify-title"><div className="section-title"><span>06</span><div><p className="eyebrow">VERIFICATION</p><h2 id="verify-title">The AI proposes. Repeatable tests decide.</h2></div></div>
      <p className="lede">Every candidate faces the same checks, run outside the code it is testing. A candidate is only chosen if it passes; if none pass, Quantum Twin refuses to pick one.</p>
      <div className="hm-checks">{CHECKS.map(check => <article key={check.t}><h3>{check.t}</h3><p>{check.d}</p></article>)}</div>
    </section>

    <section aria-labelledby="built-title"><div className="section-title"><span>07</span><div><p className="eyebrow">BUILT WITH CODEX AND GPT-5.6</p><h2 id="built-title">Human judgment. Machine execution.</h2></div></div>
      <div className="hm-collab"><div><p className="eyebrow">HUMAN</p><ul><li>The idea and goals</li><li>Product decisions</li><li>Guidance and direction</li><li>Reviewing every result</li><li>Feedback and correction</li></ul></div><div><p className="eyebrow">CODEX AND GPT-5.6</p><ul><li>The working implementation</li><li>Frontend and backend</li><li>Cryptography detector</li><li>Two migration builders</li><li>The verifier and tests</li><li>Documentation</li></ul></div></div>
    </section>

    <section aria-labelledby="supported-title"><div className="section-title"><span>08</span><div><p className="eyebrow">SUPPORTED CAPABILITIES</p><h2 id="supported-title">The strongest path, fully proven.</h2></div></div>
      <div className="hm-support-card"><div className="hm-support-head"><strong>RSA signing and verification</strong><span className="badge live">FULLY SUPPORTED</span></div>
        <dl><dt>Runtime</dt><dd>Node.js crypto</dd><dt>Migration</dt><dd>ML-DSA-65</dd></dl>
        <ul className="hm-support-grid">{["Detector", "Adapter", "Verifier", "Windows", "Ubuntu"].map(item => <li key={item}><span aria-hidden="true">✓</span>{item}<small>Supported</small></li>)}</ul>
      </div>
      <p className="hm-note">Experimental and discovery-only boundaries are listed honestly on the <Link href="/support">full support matrix</Link> — never dressed up as more than they are.</p>
    </section>

    <section className="hm-cta" aria-labelledby="cta-title"><h2 id="cta-title">Practice your migration before you trust it.</h2><Link className="primary-link" href="/demo">Try the Demo</Link></section>

    <SiteFooter/>
  </main></>;
}
