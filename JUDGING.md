# Judging map

## Technological implementation

- Contract-free 1–12 repository System Bundles, service/workspace/Compose discovery, cryptographic graph, deterministic provenance and approval: `src/system-bundle.ts`, `src/intake.ts`.
- Managed baseline/system execution, loopback health, runtime crypto metadata, cleanup, two independent evaluator worktrees: `src/system-execution.ts`, `src/runtime-trace.ts`, `src/process-supervisor.ts`.
- Coordinated multi-repository Direct/Bridge tournament, ML-DSA/ML-KEM gates, refusal, rollout and per-repository patch export: `src/system-engine.ts`, `src/system-export.ts`.
- Real framework/topology proofs and current authenticated system evidence: `proof-systems/`, `test/system-bundle.test.ts`, `evidence/system-demo-run.json`.

- Two real isolated `gpt-5.6-sol` builders: `src/engine.ts`; genuine thread IDs and commits in both public reports.
- Recursive AST scanner and deterministic GPT contradiction check: `src/scanner.ts`, `src/ai.ts`.
- Versioned repository contract and containment: `src/config.ts`, `src/repository.ts`.
- Strict public GitHub/folder/ZIP analysis-before-execution intake: `src/intake.ts`; Permission and Trust Center: `app/repository-lab.tsx`.
- Copied external harness, two passes, immutable boundaries, deterministic selection, NO SAFE WINNER, hashes: `src/engine.ts`.
- Independent machine-readable verifier and negative cases: `src/report.ts`, `test/report.test.ts`, `pnpm verify-samples`.
- Cross-platform CI: frozen install, typecheck, 85 tests, five-report verification, build, secret scan on Windows and Ubuntu.

## Design

- Hosted four-scenario explorer plus one-command local Repository Lab: https://quantum-twin.vercel.app and `pnpm app`.
- Compatibility switch changes genuine report instantly without writes or arbitrary fetching.
- Ten-second SCAN / COMPETE / PROVE flow, direct actions, 60-second judge path, and clear hosted-versus-local boundary.
- Default hierarchy shows result, eligibility, gate counts, decisive failures, hash, and download; progressive disclosure preserves complete evidence.
- Skip link, semantic landmarks/headings, native selector, shareable strict-allowlist scenarios, aria-live announcement, details/summary, accessible tables, visible focus, bounded scrolling, and responsive CSS.

## Potential impact

Audience: application security engineers, platform/security teams, and maintainers of Node services with deployed RSA verifiers. NIST/NCCoE/CISA sources establish current migration and inventory need. Quantum Twin demonstrates how maintainers can compare implementations against explicit compatibility rather than accept one generated rewrite.

Generality evidence: real Express, Fastify, NestJS, Next.js, CLI, mixed-worker, pnpm monorepo, Yarn, multi-repository and envelope fixtures, plus the independent MIT Myket verifier case study. Its frozen standalone tests pass, but Quantum Twin refuses migration because the signature producer is external. Docker Compose remains experimental because execution proof is incomplete.

## Quality of idea

Traditional scanners identify cryptography. One coding-agent patch produces one plausible implementation. Quantum Twin separates discovery, isolated competing implementation, external evaluation, deterministic selection, provenance, and refusal. The independent public target selects Bridge when compatibility is required and Direct when disabled. GPT explains but cannot overrule evidence or promote a failed candidate. URL intake scans and requires contract review before any execution.

## Fast verification

```bash
pnpm verify-samples
pnpm qt verify --report sample/release-cli-compatibility.json
pnpm qt verify --report sample/release-cli-direct.json
pnpm qt verify --report sample/public-target-compatibility.json
pnpm qt verify --report sample/public-target-direct.json
```
