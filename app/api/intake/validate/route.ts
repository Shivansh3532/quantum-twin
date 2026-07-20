import { NextResponse } from "next/server";
import { isRecordedMode } from "../../../../src/mode.ts";
import { IntakeError, parseGitHubRepositoryUrl } from "../../../../src/intake.ts";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isRecordedMode()) return NextResponse.json({ error: "Hosted repository intake is disabled" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({})) as { url?: string };
    if (typeof body.url !== "string") return NextResponse.json({ error: "url is required" }, { status: 400 });
    return NextResponse.json(parseGitHubRepositoryUrl(body.url));
  } catch (error) {
    if (error instanceof IntakeError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "URL validation failed" }, { status: 400 });
  }
}
