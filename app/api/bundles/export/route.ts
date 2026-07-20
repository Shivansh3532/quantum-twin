import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRecordedMode } from "../../../../src/mode.ts";
import { createSystemEvidenceBundle } from "../../../../src/system-export.ts";
import type { SystemRunReport } from "../../../../src/system-engine.ts";
export const runtime = "nodejs";
const RUN_ID = /^\d{4}-\d{2}-\d{2}T[0-9-]+Z$/;

export async function GET(request: Request) {
  if (isRecordedMode()) return Response.json({ error: "Hosted local evidence export is forbidden" }, { status: 403 });
  const runId = new URL(request.url).searchParams.get("runId") ?? "";
  if (!RUN_ID.test(runId)) return Response.json({ error: "Invalid runId" }, { status: 400 });
  try {
    const report = JSON.parse(await readFile(path.join(process.cwd(), "runs", `system-${runId}.json`), "utf8")) as SystemRunReport, bundle = createSystemEvidenceBundle(report);
    return new Response(`${JSON.stringify(bundle, null, 2)}\n`, { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="quantum-twin-${runId}-evidence.json"`, "cache-control": "no-store" } });
  } catch { return Response.json({ error: "Local system run not found" }, { status: 404 }); }
}
