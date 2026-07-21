import Dashboard from "../ui";
import compatibilityRun from "@/sample/release-cli-compatibility.json";
import directRun from "@/sample/release-cli-direct.json";
import publicCompatibilityRun from "@/sample/public-target-compatibility.json";
import publicDirectRun from "@/sample/public-target-direct.json";
import systemRun from "@/evidence/system-demo-run.json";
import type { RunReport } from "../../src/domain.ts";
import type { SystemRunReport } from "../../src/system-engine.ts";

export default function DemoPage() {
  const reports = { compatibility: compatibilityRun as RunReport, direct: directRun as RunReport, "public-compatibility": publicCompatibilityRun as RunReport, "public-direct": publicDirectRun as RunReport };
  const coordinated = systemRun as unknown as SystemRunReport & { presentation: { statement: string; sourceReportFileSha256: string; sourceReportSha256: string }; presentationReportSha256: string };
  const banner = <section className="recorded-system" aria-labelledby="recorded-system-title"><p className="eyebrow">BONUS: COORDINATED MULTI-REPOSITORY RUN</p><h2 id="recorded-system-title">One migration across several repositories</h2><p><strong>Public evidence artifact — local file paths redacted.</strong> This committed artifact is not byte-identical to the ignored source report.</p><dl><dt>Decision</dt><dd>{coordinated.selectedCandidate?.toUpperCase() ?? "NO SAFE WINNER"}</dd><dt>Run ID</dt><dd>{coordinated.runId}</dd><dt>Source report SHA-256</dt><dd><code>{coordinated.presentation.sourceReportSha256}</code></dd><dt>Source report file SHA-256</dt><dd><code>{coordinated.presentation.sourceReportFileSha256}</code></dd><dt>Presentation artifact SHA-256</dt><dd><code>{coordinated.presentationReportSha256}</code></dd></dl><p>Builder A changed both the signing and verifying code but failed the frozen-client check. Builder B changed both repositories, passed two clean end-to-end runs and rollback, and was selected automatically.</p></section>;
  return <Dashboard recorded initialReport={reports.compatibility} recordedReports={reports} banner={banner}/>;
}
