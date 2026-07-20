import { generateKeyPairSync, sign, verify } from "node:crypto";

// Application-owned ECDSA signing boundary (elliptic curve P-256).
// Quantum-vulnerable; NIST FIPS 204 replacement is ML-DSA-65.
export function run() {
  const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const payload = Buffer.from("ecdsa-release-manifest");
  const signature = sign(null, payload, keys.privateKey);
  return verify(null, payload, keys.publicKey, signature);
}

if (process.argv[1] === new URL(import.meta.url).pathname.replace(/^\/(.:\/)/, "$1")) console.log(JSON.stringify({ accepted: run() }));
