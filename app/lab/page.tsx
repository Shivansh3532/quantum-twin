import { Nav, SiteFooter } from "../nav";
import SystemWorkbench from "../system-workbench";

export const dynamic = "force-dynamic";

export default function LabPage() {
  return <><a className="skip-link" href="#main-content">Skip to main content</a><main id="main-content" tabIndex={-1}>
    <Nav/>
    <section className="intro compact-intro"><div><p className="eyebrow">LOCAL WORKBENCH</p><h1>Run it on your own code.</h1><p className="lede">Nothing is pre-loaded here. Add your repositories, review what the scanner found and the plan it wrote, then explicitly approve before anything runs.</p><span className="badge live">LIVE LOCAL MODE</span><details className="auth-note"><summary>How authentication works (no API key in the app)</summary><p>Quantum Twin never asks for your API key and has no field for one. Authenticate the Codex CLI in your terminal, then restart the app — it uses that session:</p><p><code>codex login</code> — ChatGPT sign-in (OAuth), or <code>codex login --with-api-key</code> — paste a key in your terminal. No secret is ever entered into or stored by Quantum Twin.</p></details></div></section>
    <SystemWorkbench/>
    <SiteFooter/>
  </main></>;
}
