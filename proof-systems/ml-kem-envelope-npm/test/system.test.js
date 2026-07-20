import { decrypt, encrypt, generateRecipient } from "../src/envelope.js";
const recipient = generateRecipient(), wrongRecipient = generateRecipient(), plaintext = Buffer.from("envelope-workflow"), envelope = encrypt(plaintext, recipient.publicKey); if (!decrypt(envelope, recipient.privateKey).equals(plaintext)) throw new Error("valid envelope failed");
const changed = value => { const bytes = Buffer.from(value); bytes[0] ^= 1; return bytes; }, fails = mutation => { try { decrypt(mutation, recipient.privateKey); return false; } catch { return true; } };
try { decrypt(envelope, wrongRecipient.privateKey); throw new Error("wrong recipient accepted"); } catch (error) { if (error.message === "wrong recipient accepted") throw error; }
if (!fails({ ...envelope, ciphertext: changed(envelope.ciphertext) })) throw new Error("modified ciphertext accepted");
if (!fails({ ...envelope, ciphertext: envelope.ciphertext.subarray(0, -1) })) throw new Error("truncation accepted");
if (!fails({ ...envelope, version: "unapproved", context: "context substitution" })) throw new Error("downgrade or context substitution accepted");
if (envelope.version === "qt-kem-dem-v1") for (const field of ["encapsulatedKey", "nonce", "tag"]) if (!fails({ ...envelope, [field]: changed(envelope[field]) })) throw new Error(`modified ${field} accepted`);
if (JSON.stringify(envelope).includes(plaintext.toString())) throw new Error("plaintext appears in evidence"); // AAD is bound through context.
