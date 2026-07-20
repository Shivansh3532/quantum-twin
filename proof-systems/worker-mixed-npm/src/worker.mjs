import { sign } from "node:crypto";
import legacy from "./legacy.cjs";

export function processScheduledJob(payload, keys) {
  const signature = sign("RSA-SHA256", payload, keys.privateKey);
  return legacy.consume(payload, signature, keys.publicKey);
}
