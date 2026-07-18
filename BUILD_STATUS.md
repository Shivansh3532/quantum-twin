# Quantum Twin Build Status

Status values: `[ ]` pending, `[x]` verified, `[!]` external blocker.

## Foundation

- [ ] Node 24.18.0 active and pinned
- [ ] pnpm lockfile committed; frozen offline install passes
- [ ] `@openai/codex-sdk@0.144.6` pinned
- [ ] `gpt-5.6-sol` explicitly configured
- [!] Responses API authentication: `OPENAI_API_KEY` missing on 2026-07-18
- [ ] Codex SDK auth, worktree turn, and AbortSignal cancellation verified
- [ ] ML-DSA-65 sign/verify, tamper, wrong-key, wrong-context preflight passes

## Engine

- [ ] Bundled generic-tested RSA fixture
- [ ] Targeted TypeScript AST RSA scanner
- [ ] Schema-validated GPT-5.6 classification
- [ ] Identical baseline commit plus fixture SHA-256 manifest
- [ ] Separate Direct Cutover and Compatibility Bridge worktrees
- [ ] Locked Codex builder policy; isolated failures; one repair turn
- [ ] External evaluator and single frozen legacy verifier
- [ ] All 13 deterministic gates, including two verifier passes
- [ ] Deterministic selection; no weighted score
- [ ] Schema-validated GPT-5.6 immutable-evidence explanation
- [ ] Complete `run.json`, final report hash, real Codex sample bundle

## Product and delivery

- [ ] Three-phase real-data dashboard plus required states/downloads
- [ ] `pnpm install --frozen-lockfile`, typecheck, test, build, dev, demo
- [ ] Clean-copy setup passes
- [ ] Three consecutive live demos pass when authentication is available
- [ ] Secret scan and protected-file/evaluator hashes pass
- [ ] README, LICENSE, ARCHITECTURE, SECURITY, DEMO_SCRIPT, SUBMISSION, checklist
- [ ] Final simplification and misleading-claim review

## Official submission blockers

- [x] Devpost registration confirmed live
- [ ] Public YouTube demo under 3 minutes with audio covering project, Codex, GPT-5.6
- [ ] Repository URL supplied; public with license or private shared with both judging emails
- [ ] Developer-tool install, platform, and no-rebuild test path supplied
- [ ] `/feedback` Session ID from this majority-core-functionality session saved
- [ ] Devpost project created and final submission not left as draft
