# Quantum Twin

## For Judges — 60 Second Path

1. Open the no-credential recorded demo: **https://quantum-twin.vercel.app**.
2. Confirm **Recorded Verified Run** and **Public presentation artifact — local path redacted**, compare Direct Cutover with Compatibility Bridge, inspect both report hashes and the two-pass gate matrix, then download `run.json`.
3. Review the public MIT-licensed repository: **https://github.com/Shivansh3532/quantum-twin**.

Local live path on Windows, macOS, or Linux:

```bash
npx --yes pnpm@11.9.0 install --frozen-lockfile
npx --yes pnpm@11.9.0 preflight
npx --yes pnpm@11.9.0 demo
npx --yes pnpm@11.9.0 dev
```

Requires Node.js 24.18.0, Git, and authenticated Codex for live tournaments. No `OPENAI_API_KEY` is required for the Codex SDK path. Hosted demo needs no credentials. Automatic migration is limited to declared Node.js repository contracts using native `node:crypto` RSA signing and verification; see [SUPPORTED_SYSTEMS.md](SUPPORTED_SYSTEMS.md).

## What it changes

Crypto scanners identify algorithms. A coding agent can produce one plausible patch. Quantum Twin instead gives the same immutable repository contract to two isolated Codex SDK builders—Direct Cutover and Compatibility Bridge—then lets external deterministic gates decide which candidate satisfies declared compatibility. Failed candidates cannot be selected. Zero eligible candidates produces **NO SAFE WINNER**.

Audience: application security engineers, platform/security engineering teams, maintainers of Node services with deployed RSA verifiers, and teams planning staged post-quantum migration without breaking legacy clients.

## Inspect another local repository

Quantum Twin never edits source repository. Scan and capabilities are read-only. `run` copies source into ignored `runs/<run-id>/`, rejects symlinks, enforces containment and size limits, then executes only after explicit acknowledgment.

```bash
pnpm qt scan --repo ./path/to/repository
pnpm qt capabilities --repo ./path/to/repository
pnpm qt run --repo ./path/to/repository --config ./path/to/repository/quantum-twin.config.json --allow-exec
```

Normal setup commands:

```bash
pnpm install --frozen-lockfile
pnpm preflight
pnpm typecheck
pnpm test
pnpm build
pnpm demo
pnpm demo-no-compat
pnpm dev
```

`--allow-exec` means declared install, typecheck, test, optional build, and compatibility commands may run inside isolated copy. Do not use it on untrusted repositories. Public GitHub URL ingestion, private credentials, SSH URLs, arbitrary protocols, and automatic pull requests are not implemented.

## Versioned repository contract

`quantum-twin.config.json` version 1 declares repository name, included/excluded globs, writable/protected paths, npm/pnpm command arrays, external compatibility harness, legacy compatibility requirement, `ml-dsa-65`, exact context string, dependency policy, timeouts, and scan limits. Commands are program-plus-argument arrays; shell command strings are rejected.

Three fixtures prove non-hardcoding:

- `fixture/`: TypeScript ESM update-manifest service, `src/signatures.ts`.
- `fixtures/release-cli/`: JavaScript CommonJS npm release signer, `lib/release-signer.cjs`, different exports.
- `fixtures/next-audit/`: TypeScript namespace-import server utility, `server/audit-receipt.ts`, different exports.

## Codex and GPT-5.6

Recorded core run used `@openai/codex-sdk@0.144.6` with exact `gpt-5.6-sol`. Two real SDK threads independently implemented Direct Cutover and Compatibility Bridge. GPT-5.6 produces schema-validated classification and explains immutable results. Deterministic TypeScript owns eligibility, measurements, and selection. Direct Responses API was not used because `OPENAI_API_KEY` was unavailable.

Majority-core `/feedback` Session ID: `019f774d-0364-76a3-bd72-cb806fe0109a`.

## Hosted recorded demo

Vercel automatically sets `VERCEL=1`, forcing recorded read-only mode. `QT_RECORDED_MODE=1` provides same boundary elsewhere. Hosted mode imports committed `sample/run.json`, never invokes Codex, Git, worktrees, repository commands, or runtime artifact writes, and returns HTTP 403 from `POST /api/runs`. The public sample replaces one local filesystem path with `fixture/src/signatures.ts`; it preserves the original source report hash as `sourceReportSha256`, records the limited redaction, states that it is not byte-identical to the source report, and has its own `presentationReportSha256`.

Vercel settings: Next.js, repository root, Node 24.x, install `pnpm install --frozen-lockfile`, build `pnpm build`, default output directory, no environment variables. Never add `OPENAI_API_KEY`.

## Evidence and limits

Runs record source identity, isolated baseline commit and manifest, scanner findings, contract/config hashes, Codex thread IDs, candidate commits and diffs, commands, exit codes, timings, two evaluator passes, measurements, model/runtime versions, evaluator hash, deterministic result, GPT explanation, and final report hash.

“Verified” means recorded engineering-contract tests and negative checks passed in isolated evaluation. It does not mean formal verification, FIPS module certification, side-channel safety, guaranteed cryptographic security, production approval, or that an entire organization, application, website, or system is quantum-safe.

See [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [SUPPORTED_SYSTEMS.md](SUPPORTED_SYSTEMS.md), [JUDGING.md](JUDGING.md), and [sample/run.json](sample/run.json).
