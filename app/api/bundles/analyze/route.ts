import { isRecordedMode } from "../../../../src/mode.ts";
import { analyzeSystemIntakes, IntakeError } from "../../../../src/intake.ts";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isRecordedMode()) return Response.json({ error: "Hosted system analysis is disabled" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({})) as { name?: string; intakeIds?: string[]; frozenConsumers?: string[] };
    return Response.json(await analyzeSystemIntakes(body.name ?? "", body.intakeIds ?? [], (body.frozenConsumers ?? []).filter(value => typeof value === "string" && value.trim()).map(value => value.trim())));
  } catch (error) {
    if (error instanceof IntakeError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : String(error), code: "bundle_analysis_failed" }, { status: 500 });
  }
}
