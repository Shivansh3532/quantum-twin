import { verify } from "node:crypto"; export function consume({ data, signature, publicKey }) { return verify("RSA-SHA256", data, publicKey, signature); }
