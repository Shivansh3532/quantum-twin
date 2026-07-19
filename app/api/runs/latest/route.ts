import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import compatibilityRun from "../../../../sample/release-cli-compatibility.json";
import directRun from "../../../../sample/release-cli-direct.json";
import { isRecordedMode } from "../../../../src/mode.ts";
export const runtime = "nodejs";
const recordedRuns = { compatibility: compatibilityRun, direct: directRun } as const;
export async function GET(request: Request) {
  if (isRecordedMode()) {
    const scenario = new URL(request.url).searchParams.get("scenario") ?? "compatibility";
    if (scenario !== "compatibility" && scenario !== "direct") return NextResponse.json({ error: "Unknown recorded scenario" }, { status: 400 });
    return NextResponse.json(recordedRuns[scenario], { headers: { "content-disposition": `attachment; filename=release-cli-${scenario}.json` } });
  }
  try { return new NextResponse(await readFile(path.join(process.cwd(), "runs/latest.json")), { headers: { "content-type": "application/json", "content-disposition": "attachment; filename=run.json" } }); }
  catch { return NextResponse.json({ error: "No run exists" }, { status: 404 }); }
}
