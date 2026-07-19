import { generateKeyPairSync } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";

const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))]!;

export async function evaluate(worktree: string, compatibilityRequired: boolean, context: string) {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  const signer = await dynamicImport(`${pathToFileURL(path.join(worktree, "src/signatures.ts")).href}?t=${Date.now()}`) as { signManifest: Function; verifyManifest: Function };
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const mlDsa = generateKeyPairSync("ml-dsa-65"), other = generateKeyPairSync("ml-dsa-65");
  const keys = { rsaPrivateKey: rsa.privateKey, rsaPublicKey: rsa.publicKey, mlDsaPrivateKey: mlDsa.privateKey, mlDsaPublicKey: mlDsa.publicKey };
  const wrong = { ...keys, mlDsaPublicKey: other.publicKey };
  const payload = Buffer.from('{"channel":"stable","version":2}');
  const envelope = signer.signManifest(payload, keys, context);
  const legacy = typeof envelope.rsa === "string" && (await import("node:crypto")).verify("sha256", payload, rsa.publicKey, Buffer.from(envelope.rsa, "base64"));
  const gate = (name: string, passed: boolean, detail: string) => ({ name, passed, detail });
  const gates = [
    gate("ml-dsa verification", Boolean(envelope.mlDsa) && signer.verifyManifest(payload, envelope, keys, context), "ML-DSA-65 signature verifies"),
    gate("tamper rejection", !signer.verifyManifest(Buffer.concat([payload, Buffer.from("!")]), envelope, keys, context), "changed payload rejected"),
    gate("wrong-key rejection", !signer.verifyManifest(payload, envelope, wrong, context), "unrelated ML-DSA key rejected"),
    gate("legacy compatibility", !compatibilityRequired || legacy, compatibilityRequired ? "frozen RSA verifier result" : "not required"),
    gate("domain separation", !signer.verifyManifest(payload, envelope, keys, `${context}:wrong`), "wrong context rejected")
  ];
  const signTimes: number[] = [], verifyTimes: number[] = [];
  for (let index = 0; index < 25; index++) {
    let started = performance.now(); const sample = signer.signManifest(payload, keys, context); signTimes.push(performance.now() - started);
    started = performance.now(); signer.verifyManifest(payload, sample, keys, context); verifyTimes.push(performance.now() - started);
  }
  return { gates, measurements: { rsaSignatures: envelope.rsa ? 1 : 0, envelopeBytes: Buffer.byteLength(JSON.stringify(envelope)), signMedianMs: percentile(signTimes, .5), signP95Ms: percentile(signTimes, .95), verifyMedianMs: percentile(verifyTimes, .5), verifyP95Ms: percentile(verifyTimes, .95) } };
}
