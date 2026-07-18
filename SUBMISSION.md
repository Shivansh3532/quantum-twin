# Quantum Twin — Developer Tools

**Pitch:** Codex builds competing post-quantum migrations; external deterministic gates prove which one satisfies the developer's compatibility contract.

## Problem

Crypto scanners locate legacy algorithms, but one plausible AI patch does not tell a team whether migration breaks deployed clients or satisfies negative security tests.

## Solution and operation

Quantum Twin scans a bundled RSA update-manifest service, asks GPT-5.6 for structured classification, creates identical Git worktrees, and gives two Codex builders distinct ML-DSA-65 strategies. External evaluator rejects unsafe candidates, applies deterministic selection, and records reproducible evidence. Dashboard shows finding, execution, gate matrix, winning diff, measurements, explanation, commits, thread IDs, and hashes.

## Exact Codex and GPT-5.6 use

Codex created majority of core implementation in primary Build Week session. Runtime uses `@openai/codex-sdk@0.144.6` with exact `gpt-5.6-sol` model to independently implement Direct Cutover and Compatibility Bridge. GPT-5.6 also produces schema-validated `CryptoFinding` classification and immutable-evidence explanation. It never controls hard gates or selection.

## Technical implementation

Node 24.18.0, TypeScript, Next.js/Tailwind dashboard, native `node:crypto` RSA and ML-DSA-65, Git worktrees, Codex SDK, Zod, Vitest. Signature context is `quantum-twin:update-manifest:v1`. Candidate network and web search are disabled. Evaluator and frozen RSA verifier remain outside write roots.

## Potential impact and novelty

Security teams can compare rollout strategies with explicit compatibility evidence instead of accepting one opaque rewrite. Novelty is tournament plus external, deterministic disqualification and provenance—not another scanner or AI score.

## Limitations

Narrow bundled Node/TypeScript fixture only. No arbitrary repositories, HSM/KMS, TLS/certificates, formal verification, FIPS certification, side-channel proof, production approval, guaranteed migration safety, or competition outcome.

## Setup and test

See README. Run `pnpm install --frozen-lockfile`, `pnpm preflight`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm demo`, then `pnpm dev`. Bundled fixture requires no invented data or infrastructure.
