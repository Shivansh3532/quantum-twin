const test = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const { stampArtifact, checkArtifact } = require("../lib/release-signer.cjs");

const context = "quantum-twin:release-artifact:v1";
const keys = () => { const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }); const ml = generateKeyPairSync("ml-dsa-65"); return { rsaPrivateKey: rsa.privateKey, rsaPublicKey: rsa.publicKey, mlDsaPrivateKey: ml.privateKey, mlDsaPublicKey: ml.publicKey }; };

test("release signature round trip and tamper rejection", () => {
  const keyset = keys(), bytes = Buffer.from("release-v4");
  const envelope = stampArtifact(bytes, keyset, context);
  assert.equal(checkArtifact(bytes, envelope, keyset, context), true);
  assert.equal(checkArtifact(Buffer.from("release-v5"), envelope, keyset, context), false);
});
