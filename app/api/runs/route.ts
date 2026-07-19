import { NextResponse } from "next/server";
import path from "node:path";
import { isRecordedMode } from "../../../src/mode.ts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (isRecordedMode()) return NextResponse.json({ error: "Recorded Verified Run is read-only" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({})) as { repositoryPath?: string; configPath?: string; allowExec?: boolean; legacyCompatibilityRequired?: boolean };
    if (body.repositoryPath || body.configPath) {
      if (!body.repositoryPath || !body.configPath) return NextResponse.json({ error: "repositoryPath and configPath are required together" }, { status: 400 });
      if (body.allowExec !== true) return NextResponse.json({ error: "Explicit repository execution acknowledgment is required" }, { status: 400 });
      const engine = await import("../../../src/engine.ts");
      return NextResponse.json(await engine.runRepository(path.resolve(body.repositoryPath), path.resolve(body.configPath), body.allowExec === true, body.legacyCompatibilityRequired));
    }
    const engine = await import("../../../src/engine.ts");
    return NextResponse.json(await engine.runDemo(body.legacyCompatibilityRequired !== false));
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
