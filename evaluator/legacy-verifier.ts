import { verify, type KeyLike } from "node:crypto";

export function frozenLegacyVerify(payload: Buffer, rsaSignature: string | undefined, publicKey: KeyLike): boolean {
  if (!rsaSignature) return false;
  return verify("sha256", payload, publicKey, Buffer.from(rsaSignature, "base64"));
}
