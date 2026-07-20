import path from "node:path";
import { createSystemBundle } from "../src/system-bundle.ts";
import { command, safeCommandEnvironment } from "../src/util.ts";

const root = path.join(process.cwd(), "proof-systems");
const proofs = [
  { name: "Express CommonJS npm", directory: "express-cjs-npm", commands: [["npm", "ci", "--ignore-scripts"], ["npm", "test"]] },
  { name: "Fastify ESM pnpm", directory: "fastify-esm-pnpm", commands: [["pnpm", "install", "--frozen-lockfile", "--ignore-scripts", "--ignore-workspace"], ["pnpm", "test"]] },
  { name: "NestJS TypeScript pnpm", directory: "nest-typescript-pnpm", commands: [["pnpm", "install", "--frozen-lockfile", "--ignore-scripts", "--ignore-workspace"], ["pnpm", "typecheck"], ["pnpm", "test"]] },
  { name: "Next.js API pnpm", directory: "next-api-pnpm", commands: [["pnpm", "install", "--frozen-lockfile", "--ignore-scripts", "--ignore-workspace"], ["pnpm", "build"], ["pnpm", "test"]] },
  { name: "Node CLI npm", directory: "node-cli-npm", commands: [["npm", "ci", "--ignore-scripts"], ["npm", "test"]] },
  { name: "Mixed ESM/CommonJS worker npm", directory: "worker-mixed-npm", commands: [["npm", "ci", "--ignore-scripts"], ["npm", "run", "build"], ["npm", "test"]] },
  { name: "pnpm monorepo", directory: "pnpm-monorepo", commands: [["pnpm", "install", "--frozen-lockfile", "--ignore-scripts"], ["pnpm", "test"]] },
  { name: "Yarn workspace", directory: "yarn-workspace", commands: [["corepack", "yarn", "install", "--immutable"], ["corepack", "yarn", "test"]] },
  { name: "RSA encryption envelope", directory: "ml-kem-envelope-npm", commands: [["npm", "ci", "--ignore-scripts"], ["npm", "test"]] }
];

const report: Array<{ name: string; manager: string; components: number; findings: number; commands: Array<{ command: string; durationMs: number }> }> = [];
for (const proof of proofs) {
  const cwd = path.join(root, proof.directory), executed: Array<{ command: string; durationMs: number }> = [];
  for (const parts of proof.commands) {
    const result = await command(parts[0]!, parts.slice(1), cwd, 240_000, safeCommandEnvironment({ CI: "1", NO_COLOR: "1" }));
    if (result.exitCode) throw new Error(`${proof.name}: ${result.command} failed\n${result.stderr}\n${result.stdout}`);
    executed.push({ command: result.command, durationMs: result.durationMs });
  }
  const bundle = await createSystemBundle(proof.name, [{ root: cwd, id: proof.directory }]);
  const findings = bundle.graph.staticFindings.filter(item => item.status === "supported").length;
  if (!findings) throw new Error(`${proof.name}: no supported crypto boundary found`);
  report.push({ name: proof.name, manager: bundle.repositories[0]!.packageManager, components: bundle.components.length, findings, commands: executed });
}
const compose = await createSystemBundle("Compose static proof", [{ root: path.join(root, "docker-compose"), id: "compose" }]);
if (!compose.components.some(component => component.name === "producer") || !compose.graph.edges.some(edge => edge.kind === "depends-on")) throw new Error("Docker Compose service dependency graph was not discovered");
console.log(JSON.stringify({ passed: true, platform: process.platform, node: process.version, proofs: report, compose: { level: "EXPERIMENTAL", components: compose.components.map(item => item.name), graphSha256: compose.graph.sha256, reason: "Static graph proof only; Docker execution evidence is required for FULLY_SUPPORTED" } }, null, 2));
