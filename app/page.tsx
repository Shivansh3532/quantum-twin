import Dashboard from "./ui";
import recordedRun from "@/sample/run.json";
import { isRecordedMode } from "../src/mode.ts";
import type { RunReport } from "../src/domain.ts";

export default function Page() {
  const recorded = isRecordedMode();
  return <Dashboard recorded={recorded} initialReport={recorded ? recordedRun as RunReport : null} />;
}
