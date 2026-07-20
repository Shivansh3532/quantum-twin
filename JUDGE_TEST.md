# Judge test paths

## NIST PQC coverage (no execution)

Inventory the quantum-vulnerable cryptography of any local repository and see the
coverage posture, FIPS mapping, and earned completeness badge — no Codex, no repo
execution:

```bash
npx --yes pnpm@11.9.0 nist --repo proof-systems/ecdsa-sign-npm
```

Expected: two `ECDSA` boundaries, each `auto-migratable` to `ml-dsa-65` (FIPS 204),
`badge: NONE` until migrated, and a deterministic posture hash. The migration proofs
(ECDSA → ML-DSA-65 and ECDH → ML-KEM-768 with full negative crypto tests) run in
`npx --yes pnpm@11.9.0 exec vitest run test/nist.test.ts`. The model is documented in
[NIST_PQC_COVERAGE.md](NIST_PQC_COVERAGE.md) and rendered at
[/coverage](https://quantum-twin.vercel.app/coverage).

## No-rebuild hosted path

1. Open https://quantum-twin.vercel.app/?scenario=public-compatibility.
2. Confirm **Recorded Verified Run**, independent source URL, commit `9cc00b69982ea5d0782ff5bf68267ba92d33311e`, Bridge result, report hash, candidate diffs, two evaluator passes, and download.
3. Open https://quantum-twin.vercel.app/?scenario=public-direct and confirm Direct.
4. Existing bundled scenarios remain at `?scenario=compatibility` and `?scenario=direct` with hashes `077f8dfc…` and `02546c9b…`.

Expected: hosted mode explains Local Repository Lab but exposes no executable URL/folder/ZIP form. All live POST routes return 403.

## Local Repository Lab

Requirements: Windows, macOS, or Linux; Node.js 24.18+ within major 24; Git; authenticated Codex. Sign in with ChatGPT using `codex login`, or use API billing through `codex login --with-api-key` in a terminal. Never enter an API key into Quantum Twin.

```bash
git clone https://github.com/Shivansh3532/quantum-twin.git
cd quantum-twin
npx --yes pnpm@11.9.0 install --frozen-lockfile
npx --yes pnpm@11.9.0 app
```

In the browser:

1. Confirm every System Check passes.
2. Keep **Independent public demonstration** selected, or paste `https://github.com/Shivansh3532/quantum-twin-demo-target` in Public GitHub mode.
3. Click **Analyze Repository**. This safely clones/imports and scans without executing repository code.
4. Confirm two supported native RSA findings, exact commit, valid contract, commands, boundaries, harness hash, dependency policy, context, and limits.
5. Review all eight permissions and accept the three separate acknowledgements.
6. Start the tournament. For a quick test without waiting, use the hosted genuine report or `pnpm verify-samples` instead.

Expected genuine outcomes: compatibility required selects Bridge (`bff182b…`); compatibility disabled selects Direct (`192bdf8…`). If no candidate passes every hard gate twice, the result is **NO SAFE WINNER**.

## Independent verification

```bash
npx --yes pnpm@11.9.0 verify-samples
npx --yes pnpm@11.9.0 qt verify --report sample/public-target-compatibility.json
npx --yes pnpm@11.9.0 qt verify --report sample/public-target-direct.json
```

Modified JSON, report/diff hashes, selection, evaluator passes, repeatability, absolute personal paths, or secret-like material fail nonzero. The original CLI demo remains `pnpm demo`.

## Coordinated system path

1. Open `/lab` locally and confirm the empty state contains no recorded result.
2. Name a bundle, add the multi-repository proof producer and consumer, analyze, and inspect commits/tree hashes, components, graph, contract, commands, provenance, and frozen consumer.
3. Approve the exact contract hash, then separately authorize repositories, commands, Codex, and the typed tournament phrase.
4. Observe baseline, two real Codex worktrees, two clean evaluation passes, Direct’s frozen-client failure, Bridge selection, changed repositories, fresh run ID/hash, and evidence download.

Fast credential-free verification:

```bash
pnpm test
pnpm proof-matrix
```

Public fresh-run evidence: [`evidence/system-demo-run.json`](evidence/system-demo-run.json), source report SHA-256 `4b488bcc8eb69d8d149390e0a9cc82b3673edf2ba54146dacd6525efb0a9af16`, source report file SHA-256 `0dc74cc47cf87f871ebd135497ed0251b9b4550d6581e66302bab8ab33d0f9f4`, presentation SHA-256 `aa2860bf82ddc95aa59220a368f8d44738cef8521504975ee57eb87251fd1c73`.
