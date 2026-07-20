import { isRecordedMode } from "../../../../src/mode.ts";
import { readyIntake } from "../../../../src/intake.ts";
import { runRepository } from "../../../../src/engine.ts";
import { systemStatus } from "../../../../src/system.ts";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isRecordedMode()) return Response.json({ error: "Recorded Verified Run is read-only" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { intakeId?: string; trustRepository?: boolean; allowCommands?: boolean; allowCodex?: boolean; legacyCompatibilityRequired?: boolean };
  if (!body.intakeId) return Response.json({ error: "intakeId is required" }, { status: 400 });
  if (body.trustRepository !== true || body.allowCommands !== true || body.allowCodex !== true) return Response.json({ error: "All three permission acknowledgements are required" }, { status: 400 });
  try {
    if (!(await systemStatus()).ready) return Response.json({ error: "System check and Codex authentication must pass before execution" }, { status: 409 });
    const intake = await readyIntake(body.intakeId), encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (value: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
        void runRepository(intake.repository, intake.configPath, true, body.legacyCompatibilityRequired, intake.analysis.report.repository, state => send({ state }))
          .then(report => { send({ state: report.selectedCandidate ? "selected" : "no-safe-winner", report }); controller.close(); })
          .catch(error => { send({ state: "failed", error: error instanceof Error ? error.message : String(error) }); controller.close(); });
      }
    });
    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 }); }
}
