# Judging map

## Technological implementation

- Two real isolated `gpt-5.6-sol` builders: `src/engine.ts`; genuine thread IDs and commits in both public reports.
- Recursive AST scanner and deterministic GPT contradiction check: `src/scanner.ts`, `src/ai.ts`.
- Versioned repository contract and containment: `src/config.ts`, `src/repository.ts`.
- Copied external harness, two passes, immutable boundaries, deterministic selection, NO SAFE WINNER, hashes: `src/engine.ts`.
- Independent machine-readable verifier and negative cases: `src/report.ts`, `test/report.test.ts`, `pnpm verify-samples`.
- Cross-platform CI: frozen install, typecheck, 21 tests, sample verification, build, secret scan on Windows and Ubuntu.

## Design

- Hosted two-scenario explorer: https://quantum-twin.vercel.app.
- Compatibility switch changes genuine report instantly without writes or arbitrary fetching.
- Ten-second SCAN / COMPETE / PROVE flow, direct actions, 60-second judge path, and clear hosted-versus-local boundary.
- Default hierarchy shows result, eligibility, gate counts, decisive failures, hash, and download; progressive disclosure preserves complete evidence.
- Skip link, semantic landmarks/headings, native selector, shareable strict-allowlist scenarios, aria-live announcement, details/summary, accessible tables, visible focus, bounded scrolling, and responsive CSS.

## Potential impact

Audience: application security engineers, platform/security teams, and maintainers of Node services with deployed RSA verifiers. NIST/NCCoE/CISA sources establish current migration and inventory need. Quantum Twin demonstrates how maintainers can compare implementations against explicit compatibility rather than accept one generated rewrite.

Generality evidence: TypeScript ESM update service, CommonJS npm release CLI, and Next-style TypeScript server utility. Automatic scope remains deliberately narrow.

## Quality of idea

Traditional scanners identify cryptography. One coding-agent patch produces one plausible implementation. Quantum Twin separates discovery, isolated competing implementation, external evaluation, deterministic selection, provenance, and refusal. Same release fixture selects Bridge when compatibility is required and Direct when disabled. GPT explains but cannot overrule evidence or promote a failed candidate.

## Fast verification

```bash
pnpm verify-samples
pnpm qt verify --report sample/release-cli-compatibility.json
pnpm qt verify --report sample/release-cli-direct.json
```
