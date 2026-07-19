# Judging Map

## Technological Implementation

- Real orchestration: `src/engine.ts`; run `pnpm demo` or `pnpm qt run ... --allow-exec`.
- Two isolated `gpt-5.6-sol` Codex SDK builders: candidate thread IDs in dashboard and `run.json`.
- Recursive AST scanner: `src/scanner.ts`; run `pnpm qt capabilities --repo fixtures/release-cli`.
- Versioned contract and validation: `src/config.ts` plus fixture configs.
- AI-independent gates, copied harness integrity, two passes, no-safe-winner, deterministic tie-breaking, hashes: `src/engine.ts`, fixture harnesses, `test/core.test.ts`.

## Design

- Hosted evidence workspace: https://quantum-twin.vercel.app.
- Recorded/local badge, exact commands, scanner summary, candidate diffs, gate details, provenance, download, supported/unsupported scope: `app/ui.tsx`.
- Responsive/accessibility behavior: semantic headings/table/details, keyboard focus, live status, bounded gate scroll, mobile/desktop CSS in `app/globals.css`.

## Potential Impact

Audience: application security engineers, platform/security engineering teams, maintainers of Node services with deployed RSA verifiers, and teams planning staged post-quantum migration without breaking legacy clients. Quantum Twin improves the migration-strategy decision by testing competing implementations against declared compatibility instead of accepting one generated patch.

Generality evidence: update service, CommonJS npm release CLI, and Next-style audit receipt fixtures under `fixture/` and `fixtures/`.

## Quality of the Idea

Scanner discovery, candidate generation, and independent selection remain separate. Direct Cutover can fail declared compatibility while Bridge passes; disabling compatibility makes Direct eligible and deterministic selection prefers fewer RSA signatures. GPT explains evidence but cannot alter gates or select failed work. Zero eligible candidates remains **NO SAFE WINNER**.
