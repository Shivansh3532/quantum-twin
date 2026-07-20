# Cryptographic Boundaries

## Signatures

Application-owned native Node RSA signing and verification migrate to native ML-DSA-65. The approved context is bound as bytes; sign/verify use algorithm `null`. Required frozen negatives cover tampered data/signature, wrong key/context, truncation, downgrade, and unapproved-algorithm acceptance. A Bridge may retain only RSA continuity named by the frozen-consumer contract and must state its retirement condition.

## Encryption envelopes

Application-owned RSA encryption envelopes may migrate to ML-KEM-768 KEM-DEM: ML-KEM establishes a shared secret, HKDF-SHA256 derives a context-bound key, and AES-256-GCM authenticates ciphertext/AAD. The envelope is explicitly versioned. Negatives cover wrong recipient, modified ciphertext/encapsulated key/nonce/tag/AAD, truncation, context substitution, plaintext evidence leakage, downgrade, and declared legacy behavior.

## Graph and evidence

Static nodes include repositories, packages, services, endpoints, producers, consumers, verification/encryption/envelope boundaries, sanitized key references, frozen clients, and deployment units. Edges include sign, verify, encrypt, decrypt, send, receive, depend-on, deploy-with, and frozen-compatibility evidence. Approved runtime tracing adds observed algorithm/key type/call site/payload length without content.

TLS/X.509, JOSE/JWT, external protocols, cloud/HSM keys, non-Node code, browser/mobile/hardware, and third-party formats stay discovery or migration-plan only unless their own tested adapter is added.
