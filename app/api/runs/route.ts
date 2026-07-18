import { NextResponse } from "next/server";
import { runDemo } from "@/src/engine";
export const runtime = "nodejs";
export async function POST(request: Request) { try { const body = await request.json().catch(() => ({})); return NextResponse.json(await runDemo(body.legacyCompatibilityRequired !== false)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }); } }
