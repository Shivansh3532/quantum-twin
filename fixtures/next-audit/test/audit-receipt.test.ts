import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { issueReceipt, checkReceipt } from "../server/audit-receipt.ts";

const context = "quantum-twin:audit-receipt:v1";
const keys = () => { const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }); const ml = generateKeyPairSync("ml-dsa-65"); return { rsaPrivateKey: rsa.privateKey, rsaPublicKey: rsa.publicKey, mlDsaPrivateKey: ml.privateKey, mlDsaPublicKey: ml.publicKey }; };

test("audit receipt verifies", () => {
  const keyset = keys(), event = Buffer.from('{"event":"login"}');
  assert.equal(checkReceipt(event, issueReceipt(event, keyset, context), keyset, context), true);
});
