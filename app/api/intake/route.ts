import { NextResponse } from "next/server";
import { isRecordedMode } from "../../../src/mode.ts";
import { createFolderIntake, createGitHubIntake, createLocalIntake, createZipIntake, DEMO_REPOSITORY_URL, IntakeError, ZIP_COMPRESSED_LIMIT, type IntakeFile } from "../../../src/intake.ts";
export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof IntakeError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  return NextResponse.json({ error: error instanceof Error ? error.message : String(error), code: "intake_failed" }, { status: 500 });
}

export async function POST(request: Request) {
  if (isRecordedMode()) return NextResponse.json({ error: "Hosted repository intake is disabled" }, { status: 403 });
  try {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 55_000_000) throw new IntakeError("request_too_large", 413, "Import request exceeds local intake limit");
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData(), mode = String(form.get("mode") ?? "");
      if (mode === "zip") {
        const archive = form.get("archive");
        if (!(archive instanceof File)) throw new IntakeError("archive_missing", 400, "Choose one .zip archive");
        if (archive.size > ZIP_COMPRESSED_LIMIT) throw new IntakeError("archive_too_large", 413, "ZIP exceeds compressed intake limit");
        return NextResponse.json(await createZipIntake(Buffer.from(await archive.arrayBuffer()), archive.name), { status: 201 });
      }
      if (mode === "folder") {
        const files = form.getAll("files"), paths = JSON.parse(String(form.get("paths") ?? "[]")) as unknown;
        if (!Array.isArray(paths) || paths.some(item => typeof item !== "string") || paths.length !== files.length || files.some(file => !(file instanceof File))) throw new IntakeError("folder_manifest", 400, "Folder file manifest is invalid");
        const entries: IntakeFile[] = await Promise.all(files.map(async (file, index) => ({ relativePath: paths[index] as string, data: Buffer.from(await (file as File).arrayBuffer()) })));
        return NextResponse.json(await createFolderIntake(entries, String(form.get("name") || "browser-folder")), { status: 201 });
      }
      throw new IntakeError("invalid_mode", 400, "Unsupported import mode");
    }
    const body = await request.json().catch(() => ({})) as { mode?: string; url?: string; path?: string };
    if (body.mode === "demo") return NextResponse.json(await createGitHubIntake(DEMO_REPOSITORY_URL, "demo"), { status: 201 });
    if (body.mode === "github" && typeof body.url === "string") return NextResponse.json(await createGitHubIntake(body.url), { status: 201 });
    if (body.mode === "local" && typeof body.path === "string") return NextResponse.json(await createLocalIntake(body.path), { status: 201 });
    throw new IntakeError("invalid_mode", 400, "Choose a supported repository source");
  } catch (error) { return failure(error); }
}
