import { generateKeyPairSync, verify } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";

const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))]!;

export async function evaluate(worktree: string, compatibilityRequired: boolean, context: string) {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  const signer = await dynamicImport(`${pathToFileURL(path.join(worktree, "server/audit-receipt.ts")).href}?t=${Date.now()}`) as { issueReceipt: Function; checkReceipt: Function };
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }), ml = generateKeyPairSync("ml-dsa-65"), other = generateKeyPairSync("ml-dsa-65");
  const keys = { rsaPrivateKey: rsa.privateKey, rsaPublicKey: rsa.publicKey, mlDsaPrivateKey: ml.privateKey, mlDsaPublicKey: ml.publicKey };
  const event = Buffer.from('{"event":"login"}'), receipt = signer.issueReceipt(event, keys, context), wrong = { ...keys, mlDsaPublicKey: other.publicKey };
  const legacy = typeof receipt.rsa === "string" && verify("sha512", event, rsa.publicKey, Buffer.from(receipt.rsa, "base64"));
  const gates = [
    { name: "ml-dsa verification", passed: Boolean(receipt.mlDsa) && signer.checkReceipt(event, receipt, keys, context), detail: "receipt verifies" },
    { name: "tamper rejection", passed: !signer.checkReceipt(Buffer.from('{"event":"admin"}'), receipt, keys, context), detail: "changed event rejected" },
    { name: "wrong-key rejection", passed: !signer.checkReceipt(event, receipt, wrong, context), detail: "unrelated key rejected" },
    { name: "legacy compatibility", passed: !compatibilityRequired || legacy, detail: compatibilityRequired ? "frozen RSA consumer" : "not required" },
    { name: "domain separation", passed: !signer.checkReceipt(event, receipt, keys, `${context}:wrong`), detail: "wrong context rejected" }
  ];
  const signTimes: number[] = [], verifyTimes: number[] = [];
  for (let index = 0; index < 25; index++) {
    let started = performance.now(); const sample = signer.issueReceipt(event, keys, context); signTimes.push(performance.now() - started);
    started = performance.now(); signer.checkReceipt(event, sample, keys, context); verifyTimes.push(performance.now() - started);
  }
  return { gates, measurements: { rsaSignatures: receipt.rsa ? 1 : 0, envelopeBytes: Buffer.byteLength(JSON.stringify(receipt)), signMedianMs: percentile(signTimes, .5), signP95Ms: percentile(signTimes, .95), verifyMedianMs: percentile(verifyTimes, .5), verifyP95Ms: percentile(verifyTimes, .95) } };
}
