import Link from "next/link";
import SystemWorkbench from "../system-workbench";

export const dynamic = "force-dynamic";

export default function LabPage() {
  return <><a className="skip-link" href="#main-content">Skip to main content</a><main id="main-content" tabIndex={-1}>
    <header className="topbar"><Link className="brand" href="/" aria-label="Quantum Twin home"><span>QT</span><strong>Quantum <i>Twin</i></strong></Link><nav aria-label="Product"><Link href="/demo">Recorded demo</Link><Link href="/support">Support</Link></nav></header>
    <section className="intro compact-intro"><div><p className="eyebrow">LOCAL EXECUTION WORKBENCH</p><h1>Live System Lab</h1><p className="lede">No recorded result is loaded here. Create a bundle, review deterministic discovery and the generated contract, then explicitly approve any execution.</p><span className="badge live">LIVE LOCAL MODE</span></div></section>
    <SystemWorkbench/>
    <footer><strong>Quantum Twin</strong><span>Nothing executes before reviewed commands and explicit permission.</span></footer>
  </main></>;
}
