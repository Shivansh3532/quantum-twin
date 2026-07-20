# NIST PQC Coverage

Quantum Twin inventories every quantum-vulnerable cryptographic boundary in a
supported Node.js system, maps each to the NIST standard that governs it, migrates
the application-owned ones to the standardized algorithms, and awards a completeness
badge **only** when every vulnerable boundary is covered.

This is the positive counterpart of `NO SAFE WINNER`: the same deterministic
authority that refuses an unsafe migration also refuses to certify a system as
complete unless it genuinely is.

## The three coverage states

| State | Meaning | Effect on the badge |
| --- | --- | --- |
| **Auto-migratable** | A proven native adapter exists. The boundary is migrated to its NIST target and proven with positive + negative crypto tests. | Counts as complete once migrated. |
| **Owner-unlockable** | Migratable, but blocked by something only the owner controls — confirming both sides are application-owned, granting a permission, or upgrading a consumer they own. The tool emits the exact action; re-running completes it. | Blocks the badge until acted. |
| **External** | Not application-owned: public TLS/X.509, external verifiers, cloud KMS, HSM/PKCS#11, or non-Node code. Reported with a NIST migration plan; never silently changed. | Makes 100% unachievable — reported honestly. |

## Boundary → NIST standard

| Boundary | NIST standard | Post-quantum target | Default state |
| --- | --- | --- | --- |
| RSA signing / verification | FIPS 204 (ML-DSA) | ML-DSA-65 | Auto-migratable |
| RSA encryption envelope | FIPS 203 (ML-KEM) | ML-KEM-768 KEM-DEM | Auto-migratable |
| ECDSA signatures | FIPS 204 (ML-DSA) | ML-DSA-65 | Auto-migratable |
| ECDH key agreement | FIPS 203 (ML-KEM) | ML-KEM-768 KEM-DEM | Owner-unlockable |
| Finite-field Diffie-Hellman | FIPS 203 (ML-KEM) | ML-KEM-768 KEM-DEM | Owner-unlockable |
| TLS/X.509, external verifiers, KMS/HSM, non-Node | — | Migration plan only | External |
| AES-256 / SHA-384+ (symmetric) | — | No migration required | Not vulnerable |

NIST treats AES-256 and SHA-384/512 as quantum-resistant, so symmetric primitives
are inventoried but never "migrated".

## The badge

`APPLICATION CRYPTOGRAPHY: NIST PQC COMPLETE` is awarded only when **every**
quantum-vulnerable boundary is migrated and proven. Otherwise the posture reports
`N of M boundaries complete`, the owner actions that would unlock the remaining
`owner-unlockable` boundaries, and a migration plan for any `external` boundary.

If a single external boundary exists, 100% is **not achievable** and the tool says
so. It never certifies a half-migrated system as complete.

## Detection

The detector (`src/scanner.ts`) covers, in addition to native RSA sign/verify:

- native `node:crypto` **ECDSA** signing/verification;
- native `node:crypto` **ECDH** and **Diffie-Hellman** key agreement;
- **Web Crypto** `subtle` RSA-OAEP, RSA-PSS/PKCS1, ECDSA, ECDH;
- library boundaries: **node-rsa**, **JSEncrypt**, and JWT **RS256/RS384/RS512/PS***
  (RSA) and **ES256/ES384/ES512** (ECDSA).

Native RSA and ECDSA boundaries are `supported` (auto-migratable). Web Crypto and
library boundaries are downgraded to `owner-unlockable` — the target is known, but
completing the migration requires the owner to confirm the boundary is
application-owned rather than a browser-only or externally-verified boundary.

## Migration proofs

`test/nist.test.ts` proves, with real cryptography and full negative tests:

- **ECDSA → ML-DSA-65 (FIPS 204):** valid accept; tampered data, tampered signature,
  wrong public key, wrong domain-separation context, and truncated signature all
  rejected.
- **ECDH envelope → ML-KEM-768 KEM-DEM (FIPS 203):** correct recipient decrypts;
  wrong recipient, modified ciphertext, modified encapsulated key, modified nonce,
  modified tag, and context substitution all fail; plaintext never appears in the
  envelope evidence.

## Run it

```
pnpm nist --repo <path-to-repository>
```

Prints a crypto bill of materials (every boundary with its `file:line`, primitive,
NIST standard, target, and coverage state), the completeness posture and badge, the
owner actions, the external migration plan, and a deterministic posture hash. Exit
code `2` indicates at least one external boundary blocks 100% coverage.

## What "NIST-aligned" means here

Migration of the **application-owned** boundaries to the NIST-standardized
algorithms, proven against the system's own behavior. It is **not** CAVP/CMVP
validation, formal verification, production approval, or proof of whole-system
quantum safety. Boundaries outside application ownership are reported and planned,
never hidden.
