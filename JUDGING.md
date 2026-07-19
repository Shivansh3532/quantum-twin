# Judging map

## Technological implementation

- Two real isolated `gpt-5.6-sol` builders: `src/engine.ts`; genuine thread IDs and commits in both public reports.
- Recursive AST scanner and deterministic GPT contradiction check: `src/scanner.ts`, `src/ai.ts`.
- Versioned repository contract and containment: `src/config.ts`, `src/repository.ts`.
- Copied external harness, two passes, immutable boundaries, deterministic selection, NO SAFE WINNER, hashes: `src/engine.ts`.
- Independent machine-readable verifier and negative cases: `src/report.ts`, `test/report.test.ts`, `pnpm verify-samples`.
- Cross-platform CI: frozen install, typecheck, 20 tests, sample verification, build, secret scan on Windows and Ubuntu.

## Design

- Hosted two-scenario explorer: https://quantum-twin.vercel.app.
- Compatibility switch changes genuine report instantly without writes or arbitrary fetching.
- Default hierarchy shows decision; expandable sections expose scanner findings, contracts, threads, commits, commands, diffs, measurements, hashes, passes, and limitations.
- Semantic headings, native selector, aria-live announcement, details/summary, accessible tables, visible focus, bounded scrolling, and responsive CSS.

## Potential impact

Audience: application security engineers, platform/security teams, and maintainers of Node services with deployed RSA verifiers. NIST/NCCoE/CISA sources establish current migration and inventory need. Quantum Twin demonstrates how maintainers can compare implementations against explicit compatibility rather than accept one generated rewrite.

Generality evidence: TypeScript ESM update service, CommonJS npm release CLI, and Next-style TypeScript server utility. Automatic scope remains deliberately narrow.

## Quality of idea

Traditional scanners identify cryptography. One coding-agent prompt produces one candidate. Quantum Twin separates discovery, competing implementation, external evaluation, and deterministic selection. Same release fixture selects Bridge when compatibility is required and Direct when disabled. GPT explains but cannot overrule evidence.

## Fast verification

```bash
pnpm verify-samples
pnpm qt verify --report sample/release-cli-compatibility.json
pnpm qt verify --report sample/release-cli-direct.json
```
