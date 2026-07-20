import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanRepository } from "../src/scanner.ts";
import { assessNistPosture, buildCbom, classifyPrimitive } from "../src/nist.ts";
import { generateMlDsaSigner, signMlDsa, verifyMlDsa, generateMlKemRecipient, encryptKemDem, decryptKemDem, type KemDemEnvelope } from "../src/crypto-boundaries.ts";
import { CONTEXT, type ScannerHit } from "../src/domain.ts";

const hit = (over: Partial<ScannerHit>): ScannerHit => ({ file: "a.ts", line: 1, operation: "signing", technology: "native node:crypto RSA", importForm: "named", algorithmEvidence: "sha384", confidence: 0.98, status: "supported", snippet: "", ...over });

async function scanSnippet(name: string, code: string) {
  const dir = await mkdtemp(path.join(tmpdir(), "qt-nist-"));
  try { await writeFile(path.join(dir, name), code, "utf8"); return await scanRepository(dir); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

describe("NIST coverage engine", () => {
  it("classifies native RSA sign/verify and encryption as the right primitives", () => {
    expect(classifyPrimitive(hit({ operation: "signing" }))).toBe("RSA-SIG");
    expect(classifyPrimitive(hit({ operation: "transport", technology: "native node:crypto RSA publicEncrypt" }))).toBe("RSA-KEM");
    expect(classifyPrimitive(hit({ technology: "native node:crypto ECDSA", primitive: "ECDSA" }))).toBe("ECDSA");
    expect(classifyPrimitive(hit({ technology: "TLS/X.509", status: "discovery-only" }))).toBe("EXTERNAL");
  });

  it("marks native supported boundaries auto-migratable and libraries owner-unlockable", () => {
    const cbom = buildCbom([
      hit({ primitive: "RSA-SIG", status: "supported" }),
      hit({ primitive: "ECDSA", technology: "native node:crypto ECDSA", status: "supported" }),
      hit({ primitive: "RSA-SIG", technology: "JWT RSA signature algorithm", status: "discovery-only", operation: "token" }),
    ]);
    expect(cbom[0].coverageState).toBe("auto-migratable");
    expect(cbom[1].coverageState).toBe("auto-migratable");
    expect(cbom[2].coverageState).toBe("owner-unlockable");
    expect(cbom.every(entry => entry.nistStandard === "FIPS 204 (ML-DSA)")).toBe(true);
  });

  it("awards NIST_PQC_COMPLETE only when every vulnerable boundary is migrated", () => {
    const hits = [hit({ primitive: "RSA-SIG" }), hit({ primitive: "ECDSA", line: 2 })];
    expect(assessNistPosture(hits).badge).toBe("NONE");
    const cbom = buildCbom(hits);
    const partial = assessNistPosture(hits, new Set([cbom[0].id]));
    expect(partial.badge).toBe("PARTIAL");
    expect(partial.completePercent).toBe(50);
    const complete = assessNistPosture(hits, new Set(cbom.map(entry => entry.id)));
    expect(complete.badge).toBe("NIST_PQC_COMPLETE");
    expect(complete.completePercent).toBe(100);
    expect(complete.badgeLabel).toBe("APPLICATION CRYPTOGRAPHY: NIST PQC COMPLETE");
  });

  it("blocks 100% and emits a plan when an external boundary exists", () => {
    const posture = assessNistPosture([hit({ primitive: "RSA-SIG" }), hit({ primitive: "EXTERNAL", technology: "TLS/X.509", status: "discovery-only", line: 2 })]);
    expect(posture.achievable).toBe(false);
    expect(posture.counts.external).toBe(1);
    expect(posture.remainingPlan.length).toBe(1);
  });

  it("emits owner actions for ECDH/DH and returns NOT_APPLICABLE with no vulnerable crypto", () => {
    const ecdh = assessNistPosture([hit({ primitive: "ECDH", operation: "key-management", status: "unknown", technology: "native node:crypto ECDH key agreement" })]);
    expect(ecdh.counts.ownerUnlockable).toBe(1);
    expect(ecdh.ownerActions[0]).toMatch(/ML-KEM-768/);
    expect(assessNistPosture([hit({ primitive: "SYMMETRIC", technology: "aes-256-gcm", status: "unknown" })]).badge).toBe("NOT_APPLICABLE");
  });

  it("owner confirmation makes owner-unlockable boundaries migratable", () => {
    const hits = [hit({ primitive: "ECDH", operation: "key-management", status: "unknown", technology: "native node:crypto ECDH key agreement" })];
    expect(assessNistPosture(hits).counts.ownerUnlockable).toBe(1);
    const confirmed = assessNistPosture(hits, new Set(), { ownerConfirmed: true });
    expect(confirmed.counts.ownerUnlockable).toBe(0);
    expect(confirmed.counts.autoMigratable).toBe(1);
    expect(confirmed.ownerConfirmed).toBe(true);
    expect(confirmed.ownerActions.length).toBe(0);
  });

  it("is deterministic (stable posture hash for identical input)", () => {
    const hits = [hit({ primitive: "RSA-SIG" }), hit({ primitive: "ECDSA", line: 2 })];
    expect(assessNistPosture(hits).sha256).toBe(assessNistPosture(hits).sha256);
  });
});

describe("NIST detection", () => {
  it("detects native ECDSA signing/verification", async () => {
    const hits = await scanSnippet("index.js", `const crypto = require("node:crypto");\nconst keys = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });\nfunction sign(b){ return crypto.sign(null, b, keys.privateKey); }\nfunction check(b, s){ return crypto.verify(null, b, keys.publicKey, s); }\n`);
    const ecdsa = hits.filter(h => h.primitive === "ECDSA");
    expect(ecdsa.length).toBeGreaterThanOrEqual(1);
    expect(ecdsa.every(h => /ECDSA/.test(h.technology))).toBe(true);
  });

  it("detects ECDH key agreement", async () => {
    const hits = await scanSnippet("kex.js", `const crypto = require("node:crypto");\nconst a = crypto.createECDH("prime256v1");\nconst secret = a.computeSecret(peer);\n`);
    expect(hits.some(h => h.primitive === "ECDH")).toBe(true);
  });

  it("detects Web Crypto RSA-OAEP as an RSA KEM boundary", async () => {
    const hits = await scanSnippet("wc.js", `async function wrap(k, d){ return crypto.subtle.encrypt({ name: "RSA-OAEP" }, k, d); }\n`);
    expect(hits.some(h => h.primitive === "RSA-KEM" && /Web Crypto/.test(h.technology))).toBe(true);
  });

  it("detects JWT RS256 as an RSA signature boundary", async () => {
    const hits = await scanSnippet("jwt.js", `const jwt = require("jsonwebtoken");\nfunction issue(p, key){ return jwt.sign(p, key, { algorithm: "RS256" }); }\n`);
    expect(hits.some(h => h.primitive === "RSA-SIG" && h.operation === "token")).toBe(true);
  });

  it("detects TLS and SSH as external boundaries with a migration plan", async () => {
    const tls = await scanSnippet("tls.js", `import { createSecureContext } from "node:tls";\nexport const ctx = createSecureContext({});\n`);
    const ssh = await scanSnippet("ssh.js", `const { Client } = require("ssh2");\nexport const c = new Client();\n`);
    const posture = assessNistPosture([...tls, ...ssh]);
    expect(posture.counts.external).toBeGreaterThanOrEqual(2);
    expect(posture.achievable).toBe(false);
    expect(posture.remainingPlan.some(item => /certificate authority|SSH/i.test(item))).toBe(true);
  });

  it("does not misclassify native RSA sign as ECDSA", async () => {
    const hits = await scanSnippet("rsa.js", `const crypto = require("node:crypto");\nfunction sign(b, rsaPrivateKey){ return crypto.sign("sha384", b, rsaPrivateKey); }\n`);
    expect(hits.some(h => h.primitive === "ECDSA")).toBe(false);
  });
});

describe("ECDSA boundary migrates to ML-DSA-65 (FIPS 204) with negative proofs", () => {
  const { publicKey, privateKey } = generateMlDsaSigner();
  const payload = Buffer.from("ecdsa-signed receipt payload");
  const signature = signMlDsa(payload, privateKey);

  it("accepts a valid ML-DSA signature", () => expect(verifyMlDsa(payload, signature, publicKey)).toBe(true));
  it("rejects tampered data", () => expect(verifyMlDsa(Buffer.from("ecdsa-signed receipt payloaX"), signature, publicKey)).toBe(false));
  it("rejects a tampered signature", () => { const bad = Buffer.from(signature); bad[0] ^= 0xff; expect(verifyMlDsa(payload, bad, publicKey)).toBe(false); });
  it("rejects the wrong public key", () => expect(verifyMlDsa(payload, signature, generateMlDsaSigner().publicKey)).toBe(false));
  it("rejects the wrong domain-separation context", () => expect(verifyMlDsa(payload, signature, publicKey, "quantum-twin:other-context:v1")).toBe(false));
  it("rejects a truncated signature", () => expect(verifyMlDsa(payload, signature.subarray(0, signature.length - 4), publicKey)).toBe(false));
  it("binds to the update-manifest context", () => expect(CONTEXT).toMatch(/quantum-twin/));
});

describe("ECDH envelope migrates to ML-KEM-768 KEM-DEM (FIPS 203) with negative proofs", () => {
  const recipient = generateMlKemRecipient();
  const plaintext = Buffer.from("ecdh-wrapped session key material");
  const envelope = encryptKemDem(plaintext, recipient.publicKey);
  const mutate = (value: string) => (value[0] === "A" ? "B" : "A") + value.slice(1);
  const tampered = (over: Partial<KemDemEnvelope>): KemDemEnvelope => ({ ...envelope, ...over });

  it("lets the correct recipient decrypt", () => expect(decryptKemDem(envelope, recipient.privateKey).equals(plaintext)).toBe(true));
  it("fails for the wrong recipient", () => expect(() => decryptKemDem(envelope, generateMlKemRecipient().privateKey)).toThrow());
  it("fails on modified ciphertext", () => expect(() => decryptKemDem(tampered({ ciphertext: mutate(envelope.ciphertext) }), recipient.privateKey)).toThrow());
  it("fails on a modified encapsulated key", () => expect(() => decryptKemDem(tampered({ encapsulatedKey: mutate(envelope.encapsulatedKey) }), recipient.privateKey)).toThrow());
  it("fails on a modified nonce", () => expect(() => decryptKemDem(tampered({ nonce: mutate(envelope.nonce) }), recipient.privateKey)).toThrow());
  it("fails on a modified tag", () => expect(() => decryptKemDem(tampered({ tag: mutate(envelope.tag) }), recipient.privateKey)).toThrow());
  it("fails on context substitution", () => expect(() => decryptKemDem(tampered({ context: "quantum-twin:other:v1" as KemDemEnvelope["context"] }), recipient.privateKey)).toThrow());
  it("never places plaintext in the envelope evidence", () => expect(JSON.stringify(envelope)).not.toContain(plaintext.toString("base64")));
});
