import { NextResponse } from "next/server";
import { isRecordedMode } from "../../../../src/mode.ts";
import { analyzeIntake, IntakeError } from "../../../../src/intake.ts";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isRecordedMode()) return NextResponse.json({ error: "Hosted repository analysis is disabled" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({})) as { intakeId?: string };
    if (!body.intakeId) return NextResponse.json({ error: "intakeId is required" }, { status: 400 });
    return NextResponse.json(await analyzeIntake(body.intakeId));
  } catch (error) {
    if (error instanceof IntakeError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error), code: "analysis_failed" }, { status: 500 });
  }
}
