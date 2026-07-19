import { createRequire } from "node:module";
import { generateKeyPairSync, verify } from "node:crypto";
import path from "node:path";
import { performance } from "node:perf_hooks";

const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))]!;

export async function evaluate(worktree: string, compatibilityRequired: boolean, context: string) {
  const require = createRequire(import.meta.url), modulePath = path.join(worktree, "lib/release-signer.cjs");
  delete require.cache[require.resolve(modulePath)];
  const signer = require(modulePath) as { stampArtifact: Function; checkArtifact: Function };
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }), ml = generateKeyPairSync("ml-dsa-65"), other = generateKeyPairSync("ml-dsa-65");
  const keys = { rsaPrivateKey: rsa.privateKey, rsaPublicKey: rsa.publicKey, mlDsaPrivateKey: ml.privateKey, mlDsaPublicKey: ml.publicKey };
  const bytes = Buffer.from("release-v4"), envelope = signer.stampArtifact(bytes, keys, context);
  const wrong = { ...keys, mlDsaPublicKey: other.publicKey };
  const legacy = typeof envelope.rsa === "string" && verify("sha384", bytes, rsa.publicKey, Buffer.from(envelope.rsa, "base64"));
  const gates = [
    { name: "ml-dsa verification", passed: Boolean(envelope.mlDsa) && signer.checkArtifact(bytes, envelope, keys, context), detail: "release signature verifies" },
    { name: "tamper rejection", passed: !signer.checkArtifact(Buffer.from("release-v5"), envelope, keys, context), detail: "changed artifact rejected" },
    { name: "wrong-key rejection", passed: !signer.checkArtifact(bytes, envelope, wrong, context), detail: "unrelated key rejected" },
    { name: "legacy compatibility", passed: !compatibilityRequired || legacy, detail: compatibilityRequired ? "frozen RSA consumer" : "not required" },
    { name: "domain separation", passed: !signer.checkArtifact(bytes, envelope, keys, `${context}:wrong`), detail: "wrong context rejected" }
  ];
  const signTimes: number[] = [], verifyTimes: number[] = [];
  for (let index = 0; index < 25; index++) {
    let started = performance.now(); const sample = signer.stampArtifact(bytes, keys, context); signTimes.push(performance.now() - started);
    started = performance.now(); signer.checkArtifact(bytes, sample, keys, context); verifyTimes.push(performance.now() - started);
  }
  return { gates, measurements: { rsaSignatures: envelope.rsa ? 1 : 0, envelopeBytes: Buffer.byteLength(JSON.stringify(envelope)), signMedianMs: percentile(signTimes, .5), signP95Ms: percentile(signTimes, .95), verifyMedianMs: percentile(verifyTimes, .5), verifyP95Ms: percentile(verifyTimes, .95) } };
}
