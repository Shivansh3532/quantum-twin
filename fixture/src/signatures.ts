import { sign, verify, type KeyLike } from "node:crypto";

export type SigningKeys = { rsaPrivateKey: KeyLike; rsaPublicKey: KeyLike };
export type SignatureEnvelope = { rsa: string };

export function signManifest(payload: Buffer, keys: SigningKeys, _context: string): SignatureEnvelope {
  return { rsa: sign("sha256", payload, keys.rsaPrivateKey).toString("base64") };
}

export function verifyManifest(payload: Buffer, envelope: SignatureEnvelope, keys: SigningKeys, _context: string): boolean {
  return verify("sha256", payload, keys.rsaPublicKey, Buffer.from(envelope.rsa, "base64"));
}
