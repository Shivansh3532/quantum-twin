import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (process.env.VERCEL === "1" || !process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Recorded Verified Run is read-only" }, { status: 403 });
  try { const body = await request.json().catch(() => ({})); const { runDemo } = await import("@/src/engine"); return NextResponse.json(await runDemo(body.legacyCompatibilityRequired !== false)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
