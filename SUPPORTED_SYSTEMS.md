# Supported Systems

## Implemented automatic-migration contract

- Node.js 24.18.0.
- TypeScript and JavaScript source.
- ESM and CommonJS import recognition.
- npm and pnpm lockfile/package-manager detection.
- Native `node:crypto` RSA `sign`/`verify` and `createSign`/`createVerify` evidence.
- Named imports, namespace imports, aliases, and CommonJS `require`.
- Node backends, CLI tools, libraries, workers/serverless functions, and Next.js server utilities when they satisfy same versioned repository contract.
- Direct Cutover and Compatibility Bridge targeting native `ml-dsa-65` with exact declared context.

Automatic execution also requires validated `quantum-twin.config.json`, explicit writable/protected paths, immutable commands, and copied external compatibility harness. Unknown or ambiguous crypto evidence blocks generation.

## Discovery only

These produce technology, evidence location, unsupported reason, and required adapter/human input. They never produce candidate patches or safety claims:

- TLS, certificates, and X.509 APIs.
- JWT libraries.
- Cloud KMS.
- HSM and PKCS#11.
- Third-party cryptographic libraries.
- Java, Python, .NET, Go, and Rust cryptographic code.

## Explicitly unsupported

- Public GitHub URL ingestion in current P0; local paths only.
- Private repositories, credentials, SSH URLs, arbitrary URL protocols, and automatic pull requests.
- Browser-uploaded or Vercel-executed repositories.
- HSM/KMS/certificate/TLS migration.
- Non-Node automatic migration.
- Hostile repository sandboxing or production deployment approval.
- Formal verification, FIPS module certification, side-channel proof, or guaranteed security.
