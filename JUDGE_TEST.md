# Judge test paths

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
