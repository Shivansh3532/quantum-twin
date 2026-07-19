# Quantum Twin — Developer Tools

**Pitch:** Codex builds competing post-quantum migrations; external deterministic gates prove which candidate satisfies developer’s compatibility contract.

## Problem and product

Crypto scanners locate legacy algorithms. One generated patch does not prove compatibility or negative security behavior. Quantum Twin accepts a constrained local Node repository contract, recursively records RSA evidence, creates identical Git baselines, and gives two isolated `gpt-5.6-sol` Codex builders different strategies: Direct Cutover and Compatibility Bridge. External code disqualifies failures, applies deterministic selection, and hashes complete evidence. No eligible candidate produces **NO SAFE WINNER**.

Hosted demo: https://quantum-twin.vercel.app  
Public repository: https://github.com/Shivansh3532/quantum-twin

## Codex and GPT-5.6 use

Majority core was created in Build Week session `019f774d-0364-76a3-bd72-cb806fe0109a`. Recorded runs used `@openai/codex-sdk@0.144.6` with exact `gpt-5.6-sol`. Two SDK threads independently create migration candidates. GPT-5.6 converts deterministic scanner evidence into schema-validated classification and explains immutable results. Deterministic TypeScript owns gates, eligibility, measurements, and selection. Direct Responses API was not used because `OPENAI_API_KEY` was unavailable.

## Implementation evidence

Node 24.18.0, TypeScript/JavaScript, ESM/CommonJS, npm/pnpm, native `node:crypto`, Git worktrees, Zod, Vitest, Next.js. Three fixtures use different paths, functions, module formats, and package managers. A real CommonJS/npm non-original fixture tournament selected Bridge after Direct failed declared compatibility twice.

## Audience and impact

Application security engineers, platform/security engineering teams, maintainers of Node services with deployed RSA verifiers, and teams planning staged post-quantum migration without breaking legacy clients can compare migration strategies against explicit evidence rather than accept one opaque rewrite.

## Limits

Local-path Node repository contracts only. Discovery-only findings never generate patches. No public URL ingestion, private credentials, HSM/KMS/TLS migration, hostile-code sandbox, formal verification, FIPS module certification, side-channel proof, guaranteed security, production approval, or claim that an entire system becomes quantum-safe.
