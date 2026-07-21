import Link from "next/link";
import os from "node:os";
import { basename } from "node:path";
import { SiteFooter } from "../nav";
import SystemWorkbench from "../system-workbench";
import RunnerStatus from "./runner-status";

export const dynamic = "force-dynamic";

const SITE_URL = "https://quantum-twin.vercel.app";

export default function LabPage() {
  const platform = `${process.platform} ${os.release()}`.trim();
  const workspace = basename(process.cwd());
  return <><a className="skip-link" href="#main-content">Skip to main content</a><main id="main-content" tabIndex={-1} className="workspace">
    <header className="console-bar">
      <Link className="brand" href="/" aria-label="Quantum Twin home"><span aria-hidden="true">QT</span><strong>Quantum <i>Twin</i></strong></Link>
      <span className="workspace-tag">LOCAL MIGRATION WORKSPACE</span>
      <dl className="console-ctx">
        <div><dt>OS</dt><dd>{platform}</dd></div>
        <div><dt>Node</dt><dd>{process.version}</dd></div>
        <div><dt>Workspace</dt><dd>{workspace}</dd></div>
        <RunnerStatus/>
      </dl>
      <a className="console-site-link" href={SITE_URL} rel="noreferrer">View Product Site ↗</a>
    </header>
    <section className="workspace-intro"><p className="eyebrow">DISCOVER → EXPLAIN → BUILD TWICE → PROVE</p><h1>Migration console</h1><p className="lede">The full developer workspace. Nothing is pre-loaded — add your repositories, inspect what the detector found and the plan it wrote, then explicitly approve before any command or Codex builder runs.</p>
      <details className="auth-note"><summary>How authentication works (no API key in the app)</summary><p>Quantum Twin never asks for your API key and has no field for one. Authenticate the Codex CLI in your terminal, then restart the app — it uses that session:</p><p><code>codex login</code> — ChatGPT sign-in (OAuth), or <code>codex login --with-api-key</code> — paste a key in your terminal. No secret is ever entered into or stored by Quantum Twin.</p></details>
    </section>
    <SystemWorkbench/>
    <SiteFooter/>
  </main></>;
}
