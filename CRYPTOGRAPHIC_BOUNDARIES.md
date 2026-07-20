# Cryptographic Boundaries

## Signatures

Application-owned native Node RSA signing and verification migrate to native ML-DSA-65. The approved context is bound as bytes; sign/verify use algorithm `null`. Required frozen negatives cover tampered data/signature, wrong key/context, truncation, downgrade, and unapproved-algorithm acceptance. A Bridge may retain only RSA continuity named by the frozen-consumer contract and must state its retirement condition.

## Encryption envelopes

Application-owned RSA encryption envelopes may migrate to ML-KEM-768 KEM-DEM: ML-KEM establishes a shared secret, HKDF-SHA256 derives a context-bound key, and AES-256-GCM authenticates ciphertext/AAD. The envelope is explicitly versioned. Negatives cover wrong recipient, modified ciphertext/encapsulated key/nonce/tag/AAD, truncation, context substitution, plaintext evidence leakage, downgrade, and declared legacy behavior.

## Elliptic-curve and expanded coverage

Native `node:crypto` **ECDSA** signing/verification migrates to native **ML-DSA-65**
(FIPS 204) — the same target and negative-test suite as RSA signatures — and is
proven end-to-end (`proof-systems/ecdsa-sign-npm`, `test/nist.test.ts`).

Native **ECDH** and finite-field **Diffie-Hellman** key agreement map to
**ML-KEM-768 KEM-DEM** (FIPS 203) and are `owner-unlockable`: migratable once the
owner confirms both parties are application-owned. The ECDH→ML-KEM path is proven
with full negatives in `test/nist.test.ts` and remains `EXPERIMENTAL` in the support
matrix pending a complete system fixture.

**Web Crypto** (`subtle` RSA-OAEP / RSA-PSS / PKCS1 / ECDSA / ECDH) and library
boundaries (**node-rsa**, **JSEncrypt**, JWT **RS256/ES256** family) are detected and
inventoried as `owner-unlockable` — the NIST target is known, but completing them
requires confirming the boundary is application-owned rather than browser-only or
externally-verified. The full model is in [NIST_PQC_COVERAGE.md](NIST_PQC_COVERAGE.md).

## Graph and evidence

Static nodes include repositories, packages, services, endpoints, producers, consumers, verification/encryption/envelope boundaries, sanitized key references, frozen clients, and deployment units. Edges include sign, verify, encrypt, decrypt, send, receive, depend-on, deploy-with, and frozen-compatibility evidence. Approved runtime tracing adds observed algorithm/key type/call site/payload length without content.

TLS/X.509, JOSE/JWT, external protocols, cloud/HSM keys, non-Node code, browser/mobile/hardware, and third-party formats stay discovery or migration-plan only unless their own tested adapter is added.
