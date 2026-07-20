# Supported Systems

The machine-readable source of truth is [`support-matrix.json`](support-matrix.json); `/support` renders it directly. A row can be `FULLY_SUPPORTED` only when detector, adapter, independent verifier, positive and negative crypto tests, a complete system fixture, Windows and Ubuntu execution, and documentation are all true. `src/support.ts` rejects contradictory claims.

## Fully supported intersection

- Node.js 24.18 single-repository JavaScript/TypeScript CLI and library fixtures using npm or pnpm.
- Application-owned native `node:crypto` RSA signing/verification migrating to ML-DSA-65 with context binding.
- Direct Cutover when every tested consumer is controlled and Compatibility Bridge for the tested named frozen RSA verifier.

These statements are an intersection of the FULLY_SUPPORTED matrix rows, not a claim that every experimental combination below is fully supported.

Real contract-free proof applications live under `proof-systems/`: Express CommonJS/npm, Fastify ESM/pnpm, NestJS TypeScript/pnpm, Next.js Node API/pnpm, Node CLI/npm, a mixed ESM/CommonJS worker, pnpm monorepo, Yarn workspace, multi-repository producer/consumer, RSA encryption envelope, and an impossible system. `pnpm proof-matrix` performs frozen installs and genuine workflows. A fixture passing one proof layer does not promote an incomplete row.

## Experimental

- Docker Compose: service/dependency/port graph discovery exists, but Docker-backed Windows and Ubuntu execution evidence is incomplete.
- ML-KEM-768 KEM-DEM, frameworks, mixed workers, workspaces, and multi-repository coordination: local fixtures exist, but one or more adapter, negative-test, or Ubuntu evidence flags remain incomplete.
- Any row missing one proof flag in `support-matrix.json`.

## Discovery or migration-plan only

TLS/HTTPS and X.509 infrastructure; JWT/JWS/JOSE; OAuth/OIDC/SAML; SSH/Git; package-registry signature standards; cloud KMS; HSM/PKCS#11; external certificate authorities; externally controlled protocols/clients; browser-only WebCrypto; non-Node languages; mobile, hardware, firmware, and third-party encrypted database formats.

Discovery-only findings do not suppress supported boundaries in the same system. They remain visible with exact location and required adapter/operator input. An unaccounted observed consumer prevents a fully coordinated claim.

## “Verified” does not mean

Formal verification, FIPS certification, side-channel proof, production approval, universal interoperability, risk acceptance, or proof that an entire system is quantum-safe.
