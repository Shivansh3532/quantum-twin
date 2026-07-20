import { NextResponse } from "next/server";
import { isRecordedMode } from "../../../src/mode.ts";
import { systemStatus } from "../../../src/system.ts";
export const runtime = "nodejs";

export async function GET() {
  if (isRecordedMode()) return NextResponse.json({ error: "Hosted system inspection is disabled" }, { status: 403 });
  return NextResponse.json(await systemStatus());
}
