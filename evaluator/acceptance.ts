import { generateKeyPairSync } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { frozenLegacyVerify } from "./legacy-verifier.ts";
import { CONTEXT, type Gate } from "../src/domain.ts";

const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))]!;

export async function evaluateCrypto(worktree: string, compatibilityRequired: boolean) {
  const moduleUrl = `${pathToFileURL(path.join(worktree, "src/signatures.ts")).href}?t=${Date.now()}`;
  // Runtime candidate path must stay external to Next's static module graph.
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  const signer = await dynamicImport(moduleUrl) as { signManifest: Function; verifyManifest: Function };
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const mldsa = generateKeyPairSync("ml-dsa-65");
  const other = generateKeyPairSync("ml-dsa-65");
  const keys = { rsaPrivateKey: rsa.privateKey, rsaPublicKey: rsa.publicKey, mlDsaPrivateKey: mldsa.privateKey, mlDsaPublicKey: mldsa.publicKey };
  const wrong = { ...keys, mlDsaPublicKey: other.publicKey };
  const payload = Buffer.from('{"channel":"stable","version":2}');
  const envelope = signer.signManifest(payload, keys, CONTEXT);
  const gate = (name: string, passed: boolean, detail: string): Gate => ({ name, passed, detail });
  const gates = [
    gate("ml-dsa verification", Boolean(envelope.mlDsa) && signer.verifyManifest(payload, envelope, keys, CONTEXT), "ML-DSA-65 signature verifies"),
    gate("tamper rejection", !signer.verifyManifest(Buffer.concat([payload, Buffer.from("!")]), envelope, keys, CONTEXT), "changed payload rejected"),
    gate("wrong-key rejection", !signer.verifyManifest(payload, envelope, wrong, CONTEXT), "unrelated ML-DSA key rejected"),
    gate("legacy compatibility", !compatibilityRequired || frozenLegacyVerify(payload, envelope.rsa, rsa.publicKey), compatibilityRequired ? "frozen RSA verifier result" : "not required"),
    gate("domain separation", !signer.verifyManifest(payload, envelope, keys, `${CONTEXT}:wrong`), "wrong context rejected")
  ];
  const signTimes: number[] = [], verifyTimes: number[] = [];
  for (let i = 0; i < 25; i++) {
    let t = performance.now(); const sample = signer.signManifest(payload, keys, CONTEXT); signTimes.push(performance.now() - t);
    t = performance.now(); signer.verifyManifest(payload, sample, keys, CONTEXT); verifyTimes.push(performance.now() - t);
  }
  return { gates, measurements: { rsaSignatures: envelope.rsa ? 1 : 0, envelopeBytes: Buffer.byteLength(JSON.stringify(envelope)), signMedianMs: percentile(signTimes, .5), signP95Ms: percentile(signTimes, .95), verifyMedianMs: percentile(verifyTimes, .5), verifyP95Ms: percentile(verifyTimes, .95) } };
}
