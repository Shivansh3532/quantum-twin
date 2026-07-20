import { generateKeyPairSync, sign, verify } from "node:crypto";
export const context = "quantum-twin:update-manifest:v1";
export function createKeys() { return generateKeyPairSync("rsa", { modulusLength: 2048 }); }
export function signEnvelope(payload, privateKey) { return { version: "rsa-v1", algorithm: "RSA-SHA256", context, payload: Buffer.from(payload), signature: sign("RSA-SHA256", payload, privateKey) }; }
export function verifyEnvelope(envelope, publicKey) { return envelope.version === "rsa-v1" && envelope.algorithm === "RSA-SHA256" && envelope.context === context && verify("RSA-SHA256", envelope.payload, publicKey, envelope.signature); }
export function run() { const keys = createKeys(), envelope = signEnvelope(Buffer.from("multi-order"), keys.privateKey); return verifyEnvelope(envelope, keys.publicKey); }
