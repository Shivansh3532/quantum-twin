# Quantum Twin

> Quantum Twin turns post-quantum migration from one generated patch into a constraint-driven tournament whose winner is selected by external deterministic evidence.

## For judges

- **Hosted evidence explorer:** https://quantum-twin.vercel.app — no credentials, no execution, immutable reports.
- **One-command Local Repository Lab:** clone, install, then run `npx --yes pnpm@11.9.0 app`.
- **Real public-URL workflow:** paste https://github.com/Shivansh3532/quantum-twin-demo-target, scan before execution, review the immutable contract and permissions, then explicitly authorize the isolated tournament.
- **Exact automatic scope:** Node.js 24 TypeScript/JavaScript using native `node:crypto` RSA signing and verification, npm/pnpm, and a reviewed version-1 contract with external compatibility harness.
- **Codex/GPT use:** two authenticated `@openai/codex-sdk@0.144.6` builders use exact `gpt-5.6-sol`; GPT classifies and explains evidence, while deterministic TypeScript alone controls gates, eligibility, and selection.
- **Test without rebuilding:** `npx --yes pnpm@11.9.0 verify-samples`.
- **Majority-core `/feedback` Session ID:** `019f774d-0364-76a3-bd72-cb806fe0109a`.

Hosted mode is read-only and never runs Codex, Git, worktrees, repository commands, intake, or file writes. Local Repository Lab supports the project-owned demo target, strict public GitHub HTTPS URLs, trusted local paths, Chromium folder import, and local ZIP import. Import and analysis never execute repository code.

Shareable evidence states:

- [Compatibility required — Bridge](https://quantum-twin.vercel.app/?scenario=compatibility)
- [Compatibility disabled — Direct](https://quantum-twin.vercel.app/?scenario=direct)
- [Independent public repository — Bridge](https://quantum-twin.vercel.app/?scenario=public-compatibility)
- [Independent public repository — Direct](https://quantum-twin.vercel.app/?scenario=public-direct)

## Genuine hosted evidence

| Scenario | Run ID | Deterministic result | Report SHA-256 |
|---|---|---|---|
| Compatibility required | `2026-07-19T18-04-56-297Z` | Bridge | `077f8dfc267bb6f64fcec12b1919eefd6e0fb338e1f0cb6218e405301e93f9e9` |
| Compatibility disabled | `2026-07-19T18-08-18-178Z` | Direct | `02546c9b3ef20586dd1e502f38643256b806ff64f08a6b6b1e4ef4fc24ac1311` |
| Public target, compatibility required | `2026-07-19T23-27-44-115Z` | Bridge | `bff182b99449a1dc10577a2c1be382fb5986963c0de6c1dc4174ff7cac07c0c9` |
| Public target, compatibility disabled | `2026-07-19T23-47-42-292Z` | Direct | `192bdf82cf91aba77c9a82d04154799efd4df1f505b939d22cfd8adba0cff252` |

Both reports came from real `@openai/codex-sdk@0.144.6` runs using exact `gpt-5.6-sol`. They use the generalized repository engine, plural signing/verification classification, relative source identity, versioned contract, genuine Codex thread IDs and candidate commits, complete gates, and current report hashing. [`sample/run.json`](sample/run.json) is a byte-identical alias of the compatibility-required report.

Verify either artifact without trusting the UI:

```bash
pnpm qt verify --report sample/release-cli-compatibility.json
pnpm verify -- --report sample/release-cli-direct.json
pnpm verify-samples
```

Invalid JSON, altered hashes or diffs, invalid selection, missing evaluator passes, contradictory repeatability, absolute personal paths, and obvious secret material return a nonzero exit code.

## Local Repository Lab

Requirements: Node.js 24.18.0, Git, pnpm 11.9.0, and authenticated Codex. `OPENAI_API_KEY` is not required for the Codex SDK path.

```bash
git clone https://github.com/Shivansh3532/quantum-twin.git
cd quantum-twin
npx --yes pnpm@11.9.0 install --frozen-lockfile
npx --yes pnpm@11.9.0 app
```

`app` runs preflight, builds when needed, starts production Next.js on an available `127.0.0.1` port, prints and opens the URL, and closes with Ctrl+C. Authenticate first with `codex login` (ChatGPT) or `codex login --with-api-key` (API billing). Quantum Twin has no API-key field and never receives or stores credentials. `OPENAI_API_KEY` is not required for the authenticated Codex SDK path.

The UI always imports into private ignored local storage, analyzes without execution, and shows findings, skipped artifacts, exact source commit, commands, boundaries, harness hash, limits, and eight permissions. Public GitHub intake keeps the 60-second clone timeout, 5,000-file worktree cap, path/symlink checks, and a 125 MB clone-disk ceiling. Analysis keeps the existing 2 MB source-file and 50 MB analyzed-byte limits: oversized JavaScript/TypeScript, package/config/harness, declared boundary, or command-input files fail closed, while oversized irrelevant non-source artifacts are skipped and reported by normalized path, size, and reason. Tournament execution remains disabled until the reviewed contract is valid, no oversized artifacts were skipped, blockers are absent, and all three trust/command/Codex acknowledgements are accepted. The backend rechecks the tree with strict per-file validation before execution.

The original CLI demo remains available as `pnpm demo`.

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
| Traditional scanner | Finds crypto locations; does not implement and independently compare migrations. |
| One coding-agent patch | Creates one plausible implementation; does not prove it against an immutable external compatibility contract. |
| Quantum Twin | Creates isolated competing implementations, evaluates outside worktrees, disqualifies failures deterministically, preserves provenance, changes results with constraints, and refuses when nothing qualifies. |

## Who this is for

Application-security engineers, platform-security teams, and maintainers of Node services whose RSA-signed data is consumed by deployed or frozen verifiers. Quantum Twin covers the step after discovery: compare concrete ML-DSA-65 migrations against frozen compatibility evidence without claiming whole-system quantum safety.

## NO SAFE WINNER

If every candidate fails a hard gate, deterministic TypeScript refuses to select a migration. GPT-5.6 cannot promote a failed candidate. This behavior is tested; it is not a hosted fabricated scenario.

## Supported scope

Automatic migration is intentionally limited to Node.js 24 TypeScript/JavaScript repositories using native `node:crypto` RSA sign/verify paths, ESM or CommonJS, npm or pnpm, a validated version-1 contract, and an external compatibility harness.

Discovery only: TLS/X.509, JWT, Cloud KMS, HSM/PKCS#11, third-party cryptography, Java, Python, .NET, Go, and Rust. These produce evidence and adapter requirements, never patches.

Unsupported: private repositories, credentials, SSH, non-GitHub hosts, redirects, automatic PRs, hosted repository intake/execution, non-Node automatic migration, hostile-code sandboxing, HSM/KMS/certificate/TLS migration, formal verification, certification, side-channel proof, or deployment approval. See [SUPPORTED_SYSTEMS.md](SUPPORTED_SYSTEMS.md).

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

Vercel sets `VERCEL=1`, forcing committed-sample mode. Recorded scenario downloads accept only `compatibility`, `direct`, `public-compatibility`, or `public-direct`; no path or arbitrary JSON parameter exists. Vercel needs no environment variables and must never receive `OPENAI_API_KEY`. Hosted intake, system, streaming, and execution POST routes return 403.

For recording localhost, use `pnpm app` production mode in an extension-free browser. Grammarly and similar extensions can inject attributes into development HTML; that is external to the application and should not be hidden with hydration-warning suppression.

Repository is MIT licensed. UI uses project-owned text/CSS and system fonts; no external images, icons, logos, screenshots, music, or stock media. Dependency notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

More detail: [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [JUDGING.md](JUDGING.md), [JUDGE_TEST.md](JUDGE_TEST.md), [DEVPOST_FINAL.md](DEVPOST_FINAL.md), and [VIDEO_FINAL.md](VIDEO_FINAL.md).
