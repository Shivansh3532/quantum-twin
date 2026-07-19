# Quantum Twin P0 Guardrails

Verified core rationale: `Quantum-Twin-Final.md`. Current productized scope and truth boundaries: `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, and `SUPPORTED_SYSTEMS.md`.

## Commands

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm dev
pnpm demo
```

## Locked choices

- Node 24.18.0; pnpm; `@openai/codex-sdk@0.144.6`; `gpt-5.6-sol`.
- Native `node:crypto`; ML-DSA-65 / `ml-dsa-65`; context `quantum-twin:update-manifest:v1`.
- Two Codex builders from one commit in isolated worktrees: Direct Cutover and Compatibility Bridge.
- External evaluator and frozen legacy verifier stay outside candidate write roots.
- Hard gates and deterministic selection own eligibility. GPT only classifies scanner evidence and explains immutable results.
- Real `AbortSignal`; generation timeout differs from gate failure; evaluate each generated branch twice.

## Safety

- Never commit credentials, API keys, generated private keys, or nested fixture Git metadata.
- No network in candidate worktrees. No candidate dependency changes.
- No private repository credentials, automatic publishing/pull requests, billing, hidden reasoning, fake live output, or hand-edited candidate patches. Execute supported local repository copies only after explicit `--allow-exec`.
- Do not weaken protected tests, scripts, lockfile, evaluator, or legacy verifier.

## Definition of Done

Every checkbox in `BUILD_STATUS.md` verified; install, typecheck, test, build, demo, clean-copy test, repeat evaluator, secret scan, hash checks pass. With live auth, three complete live demos pass. Docs and under-three-minute demo script exist. User must run `/feedback` in this primary build session and save its ID.
