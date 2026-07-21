import Link from "next/link";
import { Nav, SiteFooter } from "../nav";
import SupportMatrix from "./matrix";

export default function SupportPage() {
  return <><a className="skip-link" href="#main-content">Skip to main content</a><main id="main-content" tabIndex={-1}>
    <Nav current="/support"/>
    <section className="intro compact-intro"><div><p className="eyebrow">SUPPORTED CAPABILITIES</p><h1>Claims follow proof.</h1><p className="lede">A row is <strong>fully supported</strong> only when it has a detector, an automatic adapter, an independent verifier, positive and negative crypto tests, a sample test environment, Windows and Ubuntu proof, and documentation. Anything missing keeps a row experimental or discovery-only — never dressed up as more.</p></div></section>

    <section aria-labelledby="strong-title"><div className="section-title"><span>01</span><div><p className="eyebrow">STRONGEST PATH</p><h2 id="strong-title">The path we prove end to end.</h2></div></div>
      <div className="hm-support-card"><div className="hm-support-head"><strong>RSA signing and verification</strong><span className="badge live">FULLY SUPPORTED</span></div>
        <dl><dt>Runtime</dt><dd>Node.js crypto</dd><dt>Migration</dt><dd>ML-DSA-65</dd></dl>
        <ul className="hm-support-grid">{["Detector", "Adapter", "Verifier", "Windows", "Ubuntu"].map(item => <li key={item}><span aria-hidden="true">✓</span>{item}<small>Supported</small></li>)}</ul>
      </div>
    </section>

    <section aria-labelledby="matrix-title"><div className="section-title"><span>02</span><div><p className="eyebrow">FULL MATRIX</p><h2 id="matrix-title">Every boundary, honestly graded.</h2></div></div>
      <p className="lede">Filter by level. A check means that capability is proven for the boundary; a dash means it is not claimed yet.</p>
      <SupportMatrix/>
    </section>

    <section className="scope"><div><p className="eyebrow">WHAT THE COLUMNS MEAN</p><p><strong>Detector</strong> finds the cryptography. <strong>Adapter</strong> rewrites it automatically. <strong>Verifier</strong> proves the result. <strong>Test environment</strong> is a committed sample system that exercises it end to end.</p></div><div><p className="eyebrow">VERIFIED MEANS</p><p>Specified engineering-contract checks passed on the named sample and platforms. It is not certification, formal verification, production approval, or proof of whole-system quantum safety.</p></div><div><p className="eyebrow">SOURCE OF TRUTH</p><p>This page renders directly from <code>support-matrix.json</code>, so claims cannot drift from what the tests prove.</p></div></section>
    <SiteFooter/>
  </main></>;
}
