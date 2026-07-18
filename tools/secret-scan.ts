import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"]).toString().split("\0").filter(Boolean);
const patterns = [
  new RegExp(`-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE ${"KEY"}-----`),
  new RegExp(`OPENAI_API_${"KEY"}\\s*=\\s*[^\\s#]+`),
  new RegExp(`sk-${"[A-Za-z0-9_-]{20,}"}`)
];
const hits = files.filter(file => { try { const text = readFileSync(file, "utf8"); return patterns.some(pattern => pattern.test(text)); } catch { return false; } });
if (hits.length) { console.error(`Potential secrets: ${hits.join(", ")}`); process.exit(1); }
console.log(`Tracked secret scan passed (${files.length} files)`);
