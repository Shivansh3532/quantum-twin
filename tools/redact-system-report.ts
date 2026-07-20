import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileSha256, sha256 } from "../src/util.ts";

const input = process.argv[2], output = process.argv[3];
if (!input || !output) throw new Error("Usage: tsx tools/redact-system-report.ts INPUT OUTPUT");
const raw = await readFile(path.resolve(input)), source = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item)]));
  if (typeof value !== "string") return value;
  return value.replace(/file:\/\/\/.*?\/repositories\/([^/]+)\//gi, "<repository>/$1/").replace(/(?:[A-Za-z]:[\\/]|\/)(?:[^():\r\n]+[\\/])+repositories[\\/]([^\\/():\r\n]+)[\\/]/gi, "<repository>/$1/");
}
const redacted = redact(source) as Record<string, unknown>, metadata = { publicPresentation: true, statement: "Public presentation artifact — local filesystem paths redacted; not byte-identical to the source run report.", redactions: ["Local temporary filesystem prefix before repository-relative call sites"], sourceReportFileSha256: fileSha256(raw), sourceReportSha256: source.reportSha256 };
const withoutHash = { ...redacted, presentation: metadata }, presentationReportSha256 = sha256(JSON.stringify(withoutHash));
await writeFile(path.resolve(output), `${JSON.stringify({ ...withoutHash, presentationReportSha256 }, null, 2)}\n`);
console.log(JSON.stringify({ sourceReportFileSha256: metadata.sourceReportFileSha256, sourceReportSha256: metadata.sourceReportSha256, presentationReportSha256 }, null, 2));
