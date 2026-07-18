# Quantum Twin

Quantum Twin is a Codex-powered cryptographic migration tournament. It detects a supported Node/TypeScript RSA signing path, asks GPT-5.6 for schema-validated classification, gives one immutable contract to two isolated Codex builders, and lets an external deterministic evaluator select a safe migration.

## Supported scope

Node.js 24.18.0, TypeScript, `node:crypto` RSA sign/verify, JSON-compatible payloads, public-key verification, and the bundled fixture only. No arbitrary internet repositories, HSM/KMS, certificate/TLS migration, third-party crypto, or production-security approval.

## Install and run

Supported platforms: Windows, macOS, and Linux with Git, Node 24.18.0, and pnpm 11.9.0. Docker is optional.

```bash
pnpm install --frozen-lockfile
pnpm preflight
pnpm typecheck
pnpm test
pnpm build
pnpm demo
pnpm dev
```

Open `http://localhost:3000`. Judges can use bundled fixture and `pnpm demo`; no sample repository, infrastructure rebuild, account, or secret is needed beyond an authenticated Codex installation. `OPENAI_API_KEY` enables direct Responses API use; when absent, schema-validated GPT work uses authenticated Codex SDK. Candidate builders always use `gpt-5.6-sol`, high reasoning, workspace-write sandbox, no network, disabled web search, and approval policy `never`.

Runtime artifacts are written under ignored `runs/<run-id>/`; `runs/latest.json` powers dashboard. Each report contains baseline and candidate commits, Codex thread IDs, diffs and hashes, commands, exit codes, durations, gates, measurements, runtime/model versions, verifier hash, deterministic selection, GPT explanation, and final report hash.

## How Codex and GPT-5.6 were used

Codex built core product in dated local commits, then two SDK threads independently implement Direct Cutover and Compatibility Bridge from identical fixture commit. GPT-5.6 converts AST scanner hits into validated `CryptoFinding` JSON and explains immutable verifier evidence. GPT cannot change gates, measurements, or selection. Run `/feedback` in primary build session to obtain required submission Session ID.

## What “verified” means

Recorded repository tests, negative tests, compatibility checks, dependency policy, static rules, and benchmarks passed declared engineering contract in isolated environment. It does not mean formal verification, FIPS module certification, proof against every side channel, production security approval, or replacement for expert review.

See [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), and [sample/run.json](sample/run.json).
