import * as crypto from "node:crypto";

export type AuditKeys = { rsaPrivateKey: crypto.KeyLike; rsaPublicKey: crypto.KeyLike };
export type AuditReceipt = { rsa: string };

export function issueReceipt(event: Buffer, keys: AuditKeys, _context: string): AuditReceipt {
  return { rsa: crypto.sign("sha512", event, keys.rsaPrivateKey).toString("base64") };
}

export function checkReceipt(event: Buffer, receipt: AuditReceipt, keys: AuditKeys, _context: string) {
  return crypto.verify("sha512", event, keys.rsaPublicKey, Buffer.from(receipt.rsa, "base64"));
}
