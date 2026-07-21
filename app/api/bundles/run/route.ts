import { isRecordedMode } from "../../../../src/mode.ts";
import { readySystemBundle, IntakeError } from "../../../../src/intake.ts";
import { systemStatus } from "../../../../src/system.ts";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isRecordedMode()) return Response.json({ error: "Hosted system execution is forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { name?: string; intakeIds?: string[]; frozenConsumers?: string[]; approvedContractSha256?: string; trustRepositories?: boolean; allowCommands?: boolean; allowCodex?: boolean; typedApproval?: string };
  if (body.trustRepositories !== true || body.allowCommands !== true || body.allowCodex !== true || body.typedApproval !== "RUN COORDINATED TOURNAMENT") return Response.json({ error: "Repository trust, command permission, Codex permission, and exact typed execution approval are required" }, { status: 400 });
  try {
    if (!(await systemStatus()).ready) return Response.json({ error: "Node, Git, pnpm, and Codex authentication checks must pass" }, { status: 409 });
    const { runSystemTournament } = await import("../../../../src/system-engine.ts");
    const bundle = await readySystemBundle(body.name ?? "", body.intakeIds ?? [], body.approvedContractSha256 ?? "", body.frozenConsumers ?? []), encoder = new TextEncoder();
    const stream = new ReadableStream({ start(controller) {
      const send = (value: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      void runSystemTournament(bundle, { allowExec: true, onEvent: (stage, detail) => send({ stage, detail }), onAgentEvent: (strategy, event) => send({ stage: "agent", strategy, event }) })
        .then(report => { send({ stage: report.selectedCandidate ? "selected" : "no-safe-winner", report }); controller.close(); })
        .catch(error => { send({ stage: "failed", error: error instanceof Error ? error.message : String(error) }); controller.close(); });
    }});
    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof IntakeError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
  }
}
