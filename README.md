# Quantum Twin

> Quantum Twin turns post-quantum migration from one generated patch into a constraint-driven tournament whose winner is selected by external deterministic evidence.

## For judges — 30 seconds

1. Open the no-credential hosted evidence explorer: **https://quantum-twin.vercel.app**.
2. Confirm **Recorded Verified Run** and **Genuine Recorded Codex Run**.
3. Switch between:
   - **Legacy compatibility required — Bridge selected**
   - **Legacy compatibility disabled — Direct selected**
4. Expand scanner evidence, candidate diffs, commands, measurements, hashes, and both evaluator passes.

Same CommonJS/npm repository. Same two strategies. One declared compatibility constraint changes which candidate is eligible. Hosted mode is read-only and never runs Codex, Git, worktrees, repository commands, or file writes.

## Genuine hosted evidence

| Scenario | Run ID | Deterministic result | Report SHA-256 |
|---|---|---|---|
| Compatibility required | `2026-07-19T18-04-56-297Z` | Bridge | `077f8dfc267bb6f64fcec12b1919eefd6e0fb338e1f0cb6218e405301e93f9e9` |
| Compatibility disabled | `2026-07-19T18-08-18-178Z` | Direct | `02546c9b3ef20586dd1e502f38643256b806ff64f08a6b6b1e4ef4fc24ac1311` |

Both reports came from real `@openai/codex-sdk@0.144.6` runs using exact `gpt-5.6-sol`. They use the generalized repository engine, plural signing/verification classification, relative source identity, versioned contract, genuine Codex thread IDs and candidate commits, complete gates, and current report hashing. [`sample/run.json`](sample/run.json) is a byte-identical alias of the compatibility-required report.

Verify either artifact without trusting the UI:

```bash
pnpm qt verify --report sample/release-cli-compatibility.json
pnpm verify -- --report sample/release-cli-direct.json
pnpm verify-samples
```

Invalid JSON, altered hashes or diffs, invalid selection, missing evaluator passes, contradictory repeatability, absolute personal paths, and obvious secret material return a nonzero exit code.

## Local live tournament

Requirements: Node.js 24.18.0, Git, pnpm 11.9.0, and authenticated Codex. `OPENAI_API_KEY` is not required for the Codex SDK path.

```bash
npx --yes pnpm@11.9.0 install --frozen-lockfile
npx --yes pnpm@11.9.0 preflight
npx --yes pnpm@11.9.0 demo
npx --yes pnpm@11.9.0 dev
```

`preflight` verifies exact model/SDK/runtime, Codex authentication, ML-DSA-65 support, context separation, and cancellation. Direct Responses API was not used because `OPENAI_API_KEY` was unavailable.

Inspect another trusted local repository:

```bash
pnpm qt scan --repo ./path/to/repository
pnpm qt capabilities --repo ./path/to/repository
pnpm qt run --repo ./path/to/repository --config ./path/to/repository/quantum-twin.config.json --allow-exec
```

Quantum Twin never edits the source repository. `run` copies it into ignored `runs/<run-id>/`, rejects symlinks and path escapes, enforces size limits, and executes declared commands only after explicit acknowledgment. Do not run untrusted repositories.

## How it works

1. Recursive deterministic scanner finds supported RSA signing and verification evidence.
2. Versioned `quantum-twin.config.json` freezes source scope, writable/protected paths, commands, ML-DSA-65 target, exact domain context, compatibility harness, dependency policy, and limits.
3. Two isolated Codex SDK builders receive the same contract:
   - **Direct Cutover:** ML-DSA-65 only.
   - **Compatibility Bridge:** ML-DSA-65 plus declared RSA continuity.
4. Copied external harness runs twice. TypeScript gates compilation, original tests, protected files, writable boundaries, dependencies, native API use, signature validity, tamper rejection, wrong-key rejection, domain separation, compatibility, repeatability, and hashes.
5. Failed candidates are ineligible. Deterministic policy selects among eligible candidates; no eligible candidate returns **NO SAFE WINNER**.
6. GPT-5.6 explains immutable evidence after selection. It cannot change gates, measurements, eligibility, or result.

## Why this matters now

[NIST standardized the first post-quantum cryptography algorithms in 2024](https://csrc.nist.gov/projects/post-quantum-cryptography) and says organizations should begin migration. [NCCoE’s migration project](https://www.nccoe.nist.gov/applied-cryptography/migration-to-pqc) treats discovery and interoperability testing as separate workstreams. [CISA, NSA, and NIST guidance](https://www.cisa.gov/resources-tools/resources/quantum-readiness-migration-post-quantum-cryptography) urges early roadmaps, inventory, risk assessment, and vendor engagement.

Discovery identifies where cryptography exists. It does not prove that a concrete migration preserves compatibility. Quantum Twin demonstrates the next developer-level decision: compare competing implementations against an immutable compatibility contract.

## What is novel

| Approach | Produces |
|---|---|
| Traditional scanner | Finds cryptography; does not implement or compare migrations. |
| One coding-agent prompt | Produces one candidate; does not independently prove frozen compatibility. |
| Quantum Twin | Creates isolated competing implementations, externally disqualifies failures, changes result with declared constraints, preserves provenance, and supports NO SAFE WINNER. |

## Supported scope

Automatic migration is intentionally limited to Node.js 24 TypeScript/JavaScript repositories using native `node:crypto` RSA sign/verify paths, ESM or CommonJS, npm or pnpm, a validated version-1 contract, and an external compatibility harness.

Discovery only: TLS/X.509, JWT, Cloud KMS, HSM/PKCS#11, third-party cryptography, Java, Python, .NET, Go, and Rust. These produce evidence and adapter requirements, never patches.

Unsupported: public/private repository URL ingestion, credentials, SSH, automatic PRs, browser/Vercel repository execution, non-Node automatic migration, hostile-code sandboxing, HSM/KMS/certificate/TLS migration, formal verification, certification, side-channel proof, or deployment approval. See [SUPPORTED_SYSTEMS.md](SUPPORTED_SYSTEMS.md).

## Fixtures and tests

- `fixture/`: TypeScript ESM update-manifest service.
- `fixtures/release-cli/`: JavaScript CommonJS npm release signer used by hosted reports.
- `fixtures/next-audit/`: TypeScript namespace-import server utility.

Each fixture, its tests, configuration, and external harness are original project-owned material released under MIT. Run:

```bash
pnpm typecheck
pnpm test
pnpm verify-samples
pnpm build
pnpm secret-scan
```

GitHub Actions runs frozen install, typecheck, tests, sample verification, build, and secret scan on Windows and Ubuntu with Node 24.18.0.

## Codex and GPT-5.6 collaboration

Codex accelerated repository intake, recursive scanner work, safe command execution, generalized fixtures, UI implementation, tests, and documentation. Two real SDK threads create migration candidates independently in isolated worktrees. Key human-controlled product decisions remain explicit: two strategies, external harness authority, protected boundaries, deterministic eligibility, no-safe-winner behavior, read-only hosting, and narrow supported scope.

GPT-5.6 performs schema-validated classification and post-selection explanation. Deterministic post-validation requires GPT files and operations to match scanner evidence exactly; contradiction fails classification. TypeScript alone controls all gates and selection.

Majority-core `/feedback` Session ID: `019f774d-0364-76a3-bd72-cb806fe0109a`.

## Hosted mode and licensing

Vercel sets `VERCEL=1`, forcing committed-sample mode. `POST /api/runs` returns 403. Recorded scenario downloads accept only `compatibility` or `direct`; no path or arbitrary JSON parameter exists. Vercel needs no environment variables and must never receive `OPENAI_API_KEY`.

Repository is MIT licensed. UI uses project-owned text/CSS and system fonts; no external images, icons, logos, screenshots, music, or stock media. Dependency notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

More detail: [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [JUDGING.md](JUDGING.md), [JUDGE_TEST.md](JUDGE_TEST.md), [DEVPOST_FINAL.md](DEVPOST_FINAL.md), and [VIDEO_FINAL.md](VIDEO_FINAL.md).
