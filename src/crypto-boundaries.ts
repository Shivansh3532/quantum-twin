import { createCipheriv, createDecipheriv, decapsulate, encapsulate, generateKeyPairSync, hkdfSync, randomBytes, sign, verify, type KeyObject } from "node:crypto";
import { CONTEXT } from "./domain.ts";

export const KEM_CONTEXT = "quantum-twin:kem-dem-envelope:v1";
export const ENVELOPE_VERSION = "qt-kem-dem-v1";

export type KemDemEnvelope = {
  version: typeof ENVELOPE_VERSION;
  kem: "ml-kem-768";
  kdf: "hkdf-sha256";
  cipher: "aes-256-gcm";
  context: typeof KEM_CONTEXT;
  encapsulatedKey: string;
  nonce: string;
  ciphertext: string;
  tag: string;
};

const encoded = (value: Buffer) => value.toString("base64url");
const decoded = (value: string) => Buffer.from(value, "base64url");
const aad = () => Buffer.from(`${ENVELOPE_VERSION}\0${KEM_CONTEXT}`, "utf8");
const key = (shared: Buffer) => Buffer.from(hkdfSync("sha256", shared, Buffer.alloc(0), Buffer.from(KEM_CONTEXT), 32));

export function generateMlKemRecipient() { return generateKeyPairSync("ml-kem-768"); }

export function encryptKemDem(plaintext: Buffer, recipient: KeyObject): KemDemEnvelope {
  const result = encapsulate(recipient), nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(result.sharedKey), nonce);
  cipher.setAAD(aad());
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { version: ENVELOPE_VERSION, kem: "ml-kem-768", kdf: "hkdf-sha256", cipher: "aes-256-gcm", context: KEM_CONTEXT, encapsulatedKey: encoded(result.ciphertext), nonce: encoded(nonce), ciphertext: encoded(ciphertext), tag: encoded(cipher.getAuthTag()) };
}

export function decryptKemDem(envelope: KemDemEnvelope, recipient: KeyObject) {
  if (envelope.version !== ENVELOPE_VERSION || envelope.kem !== "ml-kem-768" || envelope.kdf !== "hkdf-sha256" || envelope.cipher !== "aes-256-gcm" || envelope.context !== KEM_CONTEXT) throw new Error("Unapproved or substituted envelope parameters");
  const shared = decapsulate(recipient, decoded(envelope.encapsulatedKey)), decipher = createDecipheriv("aes-256-gcm", key(shared), decoded(envelope.nonce));
  decipher.setAAD(aad()); decipher.setAuthTag(decoded(envelope.tag));
  return Buffer.concat([decipher.update(decoded(envelope.ciphertext)), decipher.final()]);
}

export function generateMlDsaSigner() { return generateKeyPairSync("ml-dsa-65"); }
export function signMlDsa(payload: Buffer, privateKey: KeyObject) { return sign(null, payload, { key: privateKey, context: Buffer.from(CONTEXT) }); }
export function verifyMlDsa(payload: Buffer, signature: Buffer, publicKey: KeyObject, context = CONTEXT) {
  if (context !== CONTEXT) return false;
  return verify(null, payload, { key: publicKey, context: Buffer.from(context) }, signature);
}
