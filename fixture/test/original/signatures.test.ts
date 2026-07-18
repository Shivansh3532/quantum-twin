import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { signManifest, verifyManifest } from "../../src/signatures.ts";

const context = "quantum-twin:update-manifest:v1";

function keys() {
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { rsaPrivateKey: rsa.privateKey, rsaPublicKey: rsa.publicKey };
}

test("sign then verify succeeds", () => {
  const keyset = keys();
  const payload = Buffer.from('{"version":1}');
  assert.equal(verifyManifest(payload, signManifest(payload, keyset, context), keyset, context), true);
});

test("tampered payload and wrong key fail", () => {
  const keyset = keys();
  const other = keys();
  const payload = Buffer.from('{"version":1}');
  const signature = signManifest(payload, keyset, context);
  assert.equal(verifyManifest(Buffer.from('{"version":2}'), signature, keyset, context), false);
  assert.equal(verifyManifest(payload, signature, other, context), false);
});
