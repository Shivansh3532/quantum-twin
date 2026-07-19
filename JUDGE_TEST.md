# Judge test paths

## 60-second hosted path

1. Open https://quantum-twin.vercel.app/?scenario=compatibility. No login or credential required.
2. Read **SCAN / COMPETE / PROVE** and confirm **Recorded Verified Run** plus **Genuine Recorded Codex Run**.
3. Observe Bridge, failed Direct compatibility gates, gate counts, report hash, and download.
4. Open https://quantum-twin.vercel.app/?scenario=direct or use the selector.
5. Observe Direct, expand its diff, then open **Inspect all hard gates**.
6. Review **Run on your repository**, **NO SAFE WINNER**, audience, and honest scope.

Expected: same `fixtures/release-cli` source identity and commit; only compatibility constraint changes. Hosted POST remains 403.

## 60-second repository path

```bash
npx --yes pnpm@11.9.0 install --frozen-lockfile
npx --yes pnpm@11.9.0 verify-samples
npx --yes pnpm@11.9.0 qt capabilities --repo fixtures/release-cli
```

Expected: all public reports valid; CommonJS/npm capability report shows supported native RSA signing and verification with no blockers.

## Local live path

Requirements: Windows, macOS, or Linux; Node.js 24.18.0; Git; pnpm 11.9.0; authenticated Codex.

```bash
npx --yes pnpm@11.9.0 preflight
npx --yes pnpm@11.9.0 demo
npx --yes pnpm@11.9.0 dev
```

Authenticated Codex SDK needs no `OPENAI_API_KEY`. `demo` executes declared commands in isolated local copies; use only trusted repositories.

## Verify one report

```bash
pnpm qt verify --report sample/release-cli-compatibility.json
```

Expected JSON: `valid: true`, Bridge selected, all schema/hash/provenance/diff/selection/pass/repeatability/privacy checks pass.

Limits: automatic migration supports declared local Node native-RSA contracts only. Discovery-only systems never generate patches. This is engineering evidence, not formal verification, certification, a security guarantee, or deployment approval.
