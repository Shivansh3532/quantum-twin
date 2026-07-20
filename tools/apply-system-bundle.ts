import { readFile } from "node:fs/promises";
import { createCoordinatedLocalBranches } from "../src/system-export.ts";

const [evidenceFile, mappingFile, flag, confirmation] = process.argv.slice(2);
if (!evidenceFile || !mappingFile || flag !== "--confirm") throw new Error('Usage: pnpm apply-system -- EVIDENCE.json REPOSITORIES.json --confirm "CREATE COORDINATED LOCAL BRANCHES"');
const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
const repositories = JSON.parse(await readFile(mappingFile, "utf8"));
console.log(JSON.stringify(await createCoordinatedLocalBranches(evidence, repositories, confirmation ?? ""), null, 2));
