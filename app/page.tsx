import Dashboard from "./ui";
import compatibilityRun from "@/sample/release-cli-compatibility.json";
import directRun from "@/sample/release-cli-direct.json";
import publicCompatibilityRun from "@/sample/public-target-compatibility.json";
import publicDirectRun from "@/sample/public-target-direct.json";
import { isRecordedMode } from "../src/mode.ts";
import type { RunReport } from "../src/domain.ts";

export default function Page() {
  const recorded = isRecordedMode();
  const recordedReports = recorded ? { compatibility: compatibilityRun as RunReport, direct: directRun as RunReport, "public-compatibility": publicCompatibilityRun as RunReport, "public-direct": publicDirectRun as RunReport } : undefined;
  return <Dashboard recorded={recorded} initialReport={recorded ? recordedReports!.compatibility : null} recordedReports={recordedReports} />;
}
