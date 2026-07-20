import { isRecordedMode } from "../../../../src/mode.ts";
import { approveAnalyzedSystem, IntakeError } from "../../../../src/intake.ts";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isRecordedMode()) return Response.json({ error: "Hosted system approval is disabled" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({})) as { name?: string; intakeIds?: string[]; contractSha256?: string; frozenConsumers?: string[]; typedApproval?: string };
    if (body.typedApproval !== "APPROVE SYSTEM CONTRACT") return Response.json({ error: "Type APPROVE SYSTEM CONTRACT exactly" }, { status: 400 });
    return Response.json(await approveAnalyzedSystem(body.name ?? "", body.intakeIds ?? [], body.contractSha256 ?? "", body.frozenConsumers ?? []));
  } catch (error) {
    if (error instanceof IntakeError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : String(error), code: "bundle_approval_failed" }, { status: 500 });
  }
}
