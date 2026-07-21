import { Nav, SiteFooter } from "../nav";

const FIXES = [
  { from: "RSA signing / verification", to: "ML-DSA-65", std: "FIPS 204", note: "Lattice-based digital signatures (from CRYSTALS-Dilithium). Native node:crypto, algorithm null with an explicit context." },
  { from: "ECDSA signing / verification", to: "ML-DSA-65", std: "FIPS 204", note: "Same signature replacement for elliptic-curve signatures." },
  { from: "RSA encryption / ECDH key agreement", to: "ML-KEM-768 KEM-DEM", std: "FIPS 203", note: "Lattice key encapsulation (from CRYSTALS-Kyber) wrapped with HKDF-SHA256 and AES-256-GCM." },
];

export default function BackgroundPage() {
  return <><a className="skip-link" href="#main-content">Skip to main content</a><main id="main-content" tabIndex={-1}>
    <Nav current="/background"/>
    <section className="intro compact-intro"><div>
      <p className="eyebrow">BACKGROUND</p>
      <h1>Why post-quantum, and where the fixes come from.</h1>
      <p className="lede">A skim-length explainer: the quantum threat to today&apos;s cryptography, the algorithm behind it, the NIST standards that replace it, and the exact swaps Quantum Twin performs.</p>
    </div></section>

    <section aria-labelledby="threat-title"><div className="section-title"><span>01</span><div><p className="eyebrow">THE THREAT</p><h2 id="threat-title">Shor&apos;s algorithm breaks public-key crypto.</h2></div></div>
      <p className="lede">Today&apos;s signatures and key exchange (RSA, ECDSA, ECDH) rest on two hard math problems: factoring large integers and computing discrete logarithms. A large fault-tolerant quantum computer running <strong>Shor&apos;s algorithm</strong> solves both efficiently — so it can forge signatures and recover keys that classical computers cannot.</p>
      <ul className="hm-graph" aria-label="What quantum computing affects">
        <li><strong>Public-key: broken</strong><small>RSA, ECDSA, ECDH, DH fall to Shor&apos;s algorithm. This is the urgent problem.</small></li>
        <li><strong>Hashes &amp; symmetric: weakened</strong><small>Grover&apos;s algorithm only gives a quadratic speedup — mitigated by larger keys/digests (AES-256, SHA-384). Not broken.</small></li>
        <li><strong>Harvest now, decrypt later</strong><small>Signed or encrypted data captured today can be forged or read once Q-Day arrives, so migration must start before it.</small></li>
      </ul>
    </section>

    <section aria-labelledby="std-title"><div className="section-title"><span>02</span><div><p className="eyebrow">THE STANDARDS</p><h2 id="std-title">NIST standardized the replacements in 2024.</h2></div></div>
      <p className="lede">After a multi-year public competition, NIST finalized the first post-quantum standards in August 2024. Quantum Twin migrates to these — not to home-grown schemes.</p>
      <ul className="hm-graph" aria-label="NIST post-quantum standards">
        <li><strong>FIPS 203 — ML-KEM</strong><small>Key encapsulation (from CRYSTALS-Kyber). Replaces RSA encryption and ECDH key agreement.</small></li>
        <li><strong>FIPS 204 — ML-DSA</strong><small>Digital signatures (from CRYSTALS-Dilithium). Replaces RSA and ECDSA signatures.</small></li>
        <li><strong>FIPS 205 — SLH-DSA</strong><small>Hash-based signatures (from SPHINCS+), a conservative stateless backup.</small></li>
      </ul>
    </section>

    <section aria-labelledby="fix-title"><div className="section-title"><span>03</span><div><p className="eyebrow">THE FIXES</p><h2 id="fix-title">Exactly what Quantum Twin swaps.</h2></div></div>
      <div className="comparison">{FIXES.map(fix => <article key={fix.from}><h3>{fix.to}</h3><p><strong>{fix.from}</strong> → {fix.to} <em>({fix.std})</em></p><p>{fix.note}</p></article>)}</div>
      <p className="lede">Every swap uses native <code>node:crypto</code>. Deterministic gates verify signing, verification, tamper rejection, wrong-key rejection, and domain separation before any candidate can win — so a migration is only accepted when it actually holds.</p>
    </section>

    <section className="scope"><div><p className="eyebrow">NIST SOURCES</p><p><a href="https://csrc.nist.gov/projects/post-quantum-cryptography">NIST Post-Quantum Cryptography project</a> — the standardization effort and timeline.</p></div><div><p className="eyebrow">THE STANDARDS</p><p><a href="https://csrc.nist.gov/pubs/fips/203/final">FIPS 203 (ML-KEM)</a>, <a href="https://csrc.nist.gov/pubs/fips/204/final">FIPS 204 (ML-DSA)</a>, and <a href="https://csrc.nist.gov/pubs/fips/205/final">FIPS 205 (SLH-DSA)</a>.</p></div><div><p className="eyebrow">MIGRATION GUIDANCE</p><p><a href="https://www.nccoe.nist.gov/crypto-agility-considerations-migrating-post-quantum-cryptographic-algorithms">NCCoE migration to PQC</a> treats discovery and interoperability testing as separate workstreams — the gap Quantum Twin fills.</p></div></section>
    <SiteFooter/>
  </main></>;
}
