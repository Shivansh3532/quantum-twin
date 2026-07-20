import Link from "next/link";
import { supportMatrix } from "../../src/support.ts";

const mapping = [
  { primitive: "RSA signing / verification", standard: "FIPS 204", target: "ML-DSA-65", state: "Auto-migratable" },
  { primitive: "RSA encryption envelope", standard: "FIPS 203", target: "ML-KEM-768 KEM-DEM", state: "Auto-migratable" },
  { primitive: "ECDSA signatures", standard: "FIPS 204", target: "ML-DSA-65", state: "Auto-migratable" },
  { primitive: "ECDH key agreement", standard: "FIPS 203", target: "ML-KEM-768 KEM-DEM", state: "Owner-unlockable" },
  { primitive: "Finite-field Diffie-Hellman", standard: "FIPS 203", target: "ML-KEM-768 KEM-DEM", state: "Owner-unlockable" },
  { primitive: "TLS/X.509, external verifiers, KMS/HSM, non-Node", standard: "—", target: "Migration plan only", state: "External" },
  { primitive: "AES-256 / SHA-384+ (symmetric)", standard: "—", target: "No migration required", state: "Not vulnerable" },
];

const states = [
  { state: "Auto-migratable", meaning: "A proven native adapter exists. Migrated to the NIST target and proven with positive + negative tests." },
  { state: "Owner-unlockable", meaning: "Migratable once the owner confirms scope or grants a permission. The tool emits the exact action; re-run completes it." },
  { state: "External", meaning: "Not application-owned (public TLS/CA, third-party client, KMS/HSM, non-Node). Reported with a NIST migration plan — never silently changed." },
];

export default function CoveragePage() {
  return <><a className="skip-link" href="#main-content">Skip to main content</a><main id="main-content" tabIndex={-1}>
    <header className="topbar"><Link className="brand" href="/" aria-label="Quantum Twin home"><span>QT</span><strong>Quantum <i>Twin</i></strong></Link><nav aria-label="Product"><Link href="/lab">Live lab</Link><Link href="/support">Support</Link><Link href="/demo">Recorded demo</Link></nav></header>

    <section className="intro compact-intro"><div>
      <p className="eyebrow">NIST PQC COVERAGE</p>
      <h1>Earned, not painted on.</h1>
      <p className="lede">Quantum Twin inventories every quantum-vulnerable cryptographic boundary, maps each to the NIST standard that governs it, and migrates the application-owned ones to FIPS&nbsp;203 / FIPS&nbsp;204. The <strong>APPLICATION CRYPTOGRAPHY: NIST&nbsp;PQC&nbsp;COMPLETE</strong> badge is awarded only when every vulnerable boundary in a system is covered — the positive side of the same deterministic authority that returns NO&nbsp;SAFE&nbsp;WINNER.</p>
    </div></section>

    <section><h2>Boundary → NIST standard</h2><div className="table-wrap" tabIndex={0}><table><thead><tr><th>Cryptographic boundary</th><th>NIST standard</th><th>Post-quantum target</th><th>Coverage</th></tr></thead><tbody>
      {mapping.map(row => <tr key={row.primitive}><th>{row.primitive}</th><td>{row.standard}</td><td>{row.target}</td><td><span className={`badge ${row.state === "Auto-migratable" ? "live" : "plain"}`}>{row.state}</span></td></tr>)}
    </tbody></table></div></section>

    <section><h2>Coverage states</h2><div className="scope">
      {states.map(row => <div key={row.state}><p className="eyebrow">{row.state}</p><p>{row.meaning}</p></div>)}
    </div></section>

    <section className="scope"><div>
      <p className="eyebrow">THE BADGE RULE</p>
      <p>NIST&nbsp;PQC&nbsp;COMPLETE fires only when every quantum-vulnerable boundary is migrated and proven. If one external boundary exists, 100% is not achievable and the tool says so — it never certifies a half-migrated system as complete.</p>
    </div><div>
      <p className="eyebrow">RUN IT</p>
      <p>Generate a live crypto bill of materials and coverage posture for any local repository:</p>
      <p><code>pnpm nist --repo &lt;path&gt;</code></p>
    </div><div>
      <p className="eyebrow">WHAT NIST-ALIGNED MEANS</p>
      <p>Migration of the application-owned boundaries to the standardized algorithms, proven against the system&apos;s behavior. It is not CAVP/CMVP certification, formal verification, or proof of whole-system quantum safety.</p>
    </div></section>

    <section><h2>Proven boundaries</h2><div className="table-wrap" tabIndex={0}><table><thead><tr><th>Boundary</th><th>Level</th></tr></thead><tbody>
      {supportMatrix.rows.filter(row => /ML-DSA|ML-KEM|ECDSA|ECDH|Web Crypto/i.test(row.boundary)).map(row => <tr key={row.boundary}><th>{row.boundary}</th><td><span className={`badge ${row.level === "FULLY_SUPPORTED" ? "live" : "plain"}`}>{row.level.replaceAll("_", " ")}</span></td></tr>)}
    </tbody></table></div><p className="lede">Levels render from the same <code>support-matrix.json</code> as <Link href="/support">/support</Link>. Claims cannot drift from what the tests prove.</p></section>
  </main></>;
}
