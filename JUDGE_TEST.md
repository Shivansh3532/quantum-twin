# Judge test paths

## 30-second hosted path

1. Open https://quantum-twin.vercel.app. No login or credential required.
2. Confirm **Recorded Verified Run** and **Genuine Recorded Codex Run**.
3. Observe compatibility-required result: Bridge.
4. Select **Legacy compatibility disabled — Direct selected**.
5. Observe result change to Direct and expand one candidate/evidence section.

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
