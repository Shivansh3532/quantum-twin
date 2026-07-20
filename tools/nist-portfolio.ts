import { readdir } from "node:fs/promises";
import path from "node:path";
import { scanRepository } from "../src/scanner.ts";
import { assessNistPosture } from "../src/nist.ts";

// Batch NIST coverage scan across every local proof-system. Demonstrates the
// "scan many repositories, see the whole quantum-vulnerable surface" workflow:
// static detection needs no execution, so it scales to large repository sets.
const roots = process.argv.slice(2).filter(arg => !arg.startsWith("--"));
const bases = roots.length ? roots : [path.join(process.cwd(), "proof-systems"), path.join(process.cwd(), "fixture")];

const systems: Array<{ system: string; boundaries: number; autoMigratable: number; ownerUnlockable: number; external: number; achievable: boolean; badge: string }> = [];
const aggregate = { vulnerable: 0, autoMigratable: 0, ownerUnlockable: 0, external: 0 };

for (const base of bases) {
  let entries: string[] = [];
  try { entries = (await readdir(base, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name); }
  catch { continue; }
  for (const name of entries) {
    const posture = assessNistPosture(await scanRepository(path.join(base, name)));
    if (!posture.counts.vulnerable) continue;
    systems.push({ system: `${path.basename(base)}/${name}`, boundaries: posture.counts.vulnerable, autoMigratable: posture.counts.autoMigratable, ownerUnlockable: posture.counts.ownerUnlockable, external: posture.counts.external, achievable: posture.achievable, badge: posture.badge });
    aggregate.vulnerable += posture.counts.vulnerable;
    aggregate.autoMigratable += posture.counts.autoMigratable;
    aggregate.ownerUnlockable += posture.counts.ownerUnlockable;
    aggregate.external += posture.counts.external;
  }
}

systems.sort((a, b) => b.boundaries - a.boundaries || a.system.localeCompare(b.system));
console.log(JSON.stringify({ scannedSystems: systems.length, aggregate, coveragePercentAchievable: aggregate.vulnerable ? Math.round(((aggregate.vulnerable - aggregate.external) / aggregate.vulnerable) * 100) : 100, systems }, null, 2));
