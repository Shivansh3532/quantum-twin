import { context, createKeys, run, signEnvelope, verifyEnvelope } from "../src/index.js";
const keys = createKeys(), wrong = createKeys(), payload = Buffer.from("multi-order"), envelope = signEnvelope(payload, keys.privateKey), changed = value => { const copy = Buffer.from(value); copy[0] ^= 1; return copy; };
if (!run() || !verifyEnvelope(envelope, keys.publicKey)) throw new Error("valid signature rejected");
if (verifyEnvelope({ ...envelope, payload: changed(envelope.payload) }, keys.publicKey)) throw new Error("tampered data accepted");
if (verifyEnvelope({ ...envelope, signature: changed(envelope.signature) }, keys.publicKey)) throw new Error("tampered signature accepted");
if (verifyEnvelope(envelope, wrong.publicKey)) throw new Error("wrong public key accepted");
if (verifyEnvelope({ ...envelope, context: `${context}:wrong` }, keys.publicKey)) throw new Error("wrong context accepted");
if (verifyEnvelope({ ...envelope, signature: envelope.signature.subarray(0, -1) }, keys.publicKey)) throw new Error("truncated signature accepted");
if (verifyEnvelope({ ...envelope, version: "rsa-v0", algorithm: "unapproved" }, keys.publicKey)) throw new Error("downgrade attempt accepted");
