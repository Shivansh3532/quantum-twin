import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() { try { return new NextResponse(await readFile(path.join(process.cwd(), "runs/latest.json")), { headers: { "content-type": "application/json", "content-disposition": "attachment; filename=run.json" } }); } catch { return NextResponse.json({ error: "No run exists" }, { status: 404 }); } }
