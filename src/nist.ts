import type { NistPrimitive, ScannerHit } from "./domain.ts";
import { sha256 } from "./util.ts";

// NIST post-quantum coverage model.
//
// Maps each detected cryptographic boundary to the NIST standard that governs it
// (FIPS 203 ML-KEM, FIPS 204 ML-DSA), classifies whether Quantum Twin can migrate
// it automatically, needs an owner action first, or is genuinely external — and
// awards the "APPLICATION CRYPTOGRAPHY: NIST PQC COMPLETE" badge only when every
// quantum-vulnerable boundary is covered. This is the positive side of the same
// deterministic authority as NO SAFE WINNER: the badge is earned, never painted on.

// NistPrimitive is defined in domain.ts (single source of truth, shared with ScannerHit):
// "RSA-SIG" | "RSA-KEM" | "ECDSA" | "ECDH" | "DH" | "EXTERNAL" | "SYMMETRIC" | "UNKNOWN".
export type { NistPrimitive } from "./domain.ts";

export type NistTarget = "ml-dsa-65" | "ml-kem-768-kem-dem" | null;
export type NistStandard = "FIPS 204 (ML-DSA)" | "FIPS 203 (ML-KEM)" | null;
export type CoverageState = "auto-migratable" | "owner-unlockable" | "external" | "not-vulnerable";
export type Badge = "NIST_PQC_COMPLETE" | "PARTIAL" | "NONE" | "NOT_APPLICABLE";

export type CbomEntry = {
  id: string;
  file: string;
  line: number;
  primitive: NistPrimitive;
  operation: ScannerHit["operation"];
  technology: string;
  algorithm: string;
  quantumVulnerable: boolean;
  nistStandard: NistStandard;
  target: NistTarget;
  coverageState: CoverageState;
  migrated: boolean;
  note: string;
};

export type NistPosture = {
  boundaries: CbomEntry[];
  counts: {
    total: number;
    vulnerable: number;
    migrated: number;
    autoMigratable: number;
    ownerUnlockable: number;
    external: number;
    notVulnerable: number;
  };
  completePercent: number;      // migrated / vulnerable
  achievable: boolean;          // true when no external boundary blocks 100%
  ownerConfirmed: boolean;      // owner asserted every boundary is application-owned
  badge: Badge;
  badgeLabel: string;
  ownerActions: string[];
  remainingPlan: string[];
  sha256: string;
};

type PrimitiveSpec = {
  quantumVulnerable: boolean;
  nistStandard: NistStandard;
  target: NistTarget;
  coverageState: CoverageState;
  note: string;
};

const SPEC: Record<NistPrimitive, PrimitiveSpec> = {
  "RSA-SIG": { quantumVulnerable: true, nistStandard: "FIPS 204 (ML-DSA)", target: "ml-dsa-65", coverageState: "auto-migratable", note: "RSA signature boundary — migrate to ML-DSA-65." },
  "RSA-KEM": { quantumVulnerable: true, nistStandard: "FIPS 203 (ML-KEM)", target: "ml-kem-768-kem-dem", coverageState: "auto-migratable", note: "RSA encryption envelope — migrate to ML-KEM-768 KEM-DEM." },
  "ECDSA": { quantumVulnerable: true, nistStandard: "FIPS 204 (ML-DSA)", target: "ml-dsa-65", coverageState: "auto-migratable", note: "ECDSA signature boundary — migrate to ML-DSA-65 (same target as RSA signatures)." },
  "ECDH": { quantumVulnerable: true, nistStandard: "FIPS 203 (ML-KEM)", target: "ml-kem-768-kem-dem", coverageState: "owner-unlockable", note: "ECDH key agreement — migratable to ML-KEM-768 when both parties are application-owned." },
  "DH": { quantumVulnerable: true, nistStandard: "FIPS 203 (ML-KEM)", target: "ml-kem-768-kem-dem", coverageState: "owner-unlockable", note: "Finite-field Diffie-Hellman — migratable to ML-KEM-768 when both parties are application-owned." },
  "EXTERNAL": { quantumVulnerable: true, nistStandard: null, target: null, coverageState: "external", note: "Not application-owned (TLS/X.509, external verifier, KMS/HSM, or non-Node). Reported with a migration plan; coordinated auto-migration unavailable." },
  "SYMMETRIC": { quantumVulnerable: false, nistStandard: null, target: null, coverageState: "not-vulnerable", note: "Symmetric primitive — NIST considers AES-256/SHA-384+ quantum-resistant; no migration required." },
  "UNKNOWN": { quantumVulnerable: true, nistStandard: null, target: null, coverageState: "owner-unlockable", note: "Algorithm could not be proven; owner must supply the algorithm/contract before migration." },
};

// Classify a scanner hit into a NIST primitive. Prefers the explicit hit.primitive
// annotation (set by the expanded detector) and otherwise infers from the technology
// string so existing RSA hits — which carry no primitive field — remain byte-identical.
export function classifyPrimitive(hit: ScannerHit): NistPrimitive {
  if (hit.primitive) return hit.primitive;
  const tech = hit.technology.toLowerCase();
  if (/rsa/.test(tech)) return hit.operation === "transport" ? "RSA-KEM" : "RSA-SIG";
  if (/ecdsa/.test(tech)) return "ECDSA";
  if (/ecdh/.test(tech)) return "ECDH";
  if (/\bdh\b|diffie/.test(tech)) return "DH";
  if (hit.status === "discovery-only") return "EXTERNAL";
  if (/aes|hmac|sha-?\d/.test(tech)) return "SYMMETRIC";
  return "UNKNOWN";
}

// Auto-migration is only claimed for boundaries we actually have a proven native
// node:crypto adapter for (hit.status === "supported"). The same primitive detected
// through Web Crypto or a third-party library is downgraded to owner-unlockable —
// honest: we know the target, but completing it needs the owner to confirm scope.
function resolveCoverageState(spec: PrimitiveSpec, hit: ScannerHit): CoverageState {
  if (spec.coverageState === "external") return "external";
  if (spec.coverageState === "not-vulnerable") return "not-vulnerable";
  if (spec.coverageState === "auto-migratable" && hit.status === "supported") return "auto-migratable";
  return "owner-unlockable";
}

export function buildCbom(hits: ScannerHit[], migratedIds: Set<string> = new Set()): CbomEntry[] {
  return hits.map((hit, index) => {
    const primitive = classifyPrimitive(hit);
    const spec = SPEC[primitive];
    const id = `${hit.file}:${hit.line}:${index}`;
    return {
      id,
      file: hit.file,
      line: hit.line,
      primitive,
      operation: hit.operation,
      technology: hit.technology,
      algorithm: hit.algorithmEvidence,
      quantumVulnerable: spec.quantumVulnerable,
      nistStandard: spec.nistStandard,
      target: spec.target,
      coverageState: resolveCoverageState(spec, hit),
      migrated: migratedIds.has(id),
      note: spec.note,
    } satisfies CbomEntry;
  });
}

const OWNER_ACTION: Partial<Record<NistPrimitive, (entry: CbomEntry) => string>> = {
  ECDH: entry => `Confirm both ECDH parties are application-owned, then grant migration permission for ${entry.file}:${entry.line} to migrate to ML-KEM-768 KEM-DEM.`,
  DH: entry => `Confirm both Diffie-Hellman parties are application-owned, then grant migration permission for ${entry.file}:${entry.line} to migrate to ML-KEM-768 KEM-DEM.`,
  UNKNOWN: entry => `Supply the concrete algorithm and repository contract for ${entry.file}:${entry.line} so the boundary can be classified and migrated.`,
};

const EXTERNAL_PLAN = (entry: CbomEntry) => `${entry.technology} at ${entry.file}:${entry.line}: outside application-owned scope — follow the NIST migration plan (inventory, prioritize, transition, crypto-agility) with the responsible key/certificate authority.`;

export type PostureOptions = { ownerConfirmed?: boolean };

export function computePosture(cbom: CbomEntry[], options: PostureOptions = {}): NistPosture {
  const ownerConfirmed = options.ownerConfirmed ?? false;
  // When the owner asserts every boundary is application-owned, owner-unlockable
  // boundaries become directly migratable (their NIST target is already known).
  // External boundaries never move — ownership cannot be asserted for them.
  const effective = (entry: CbomEntry): CoverageState =>
    ownerConfirmed && entry.coverageState === "owner-unlockable" ? "auto-migratable" : entry.coverageState;
  const vulnerable = cbom.filter(entry => entry.quantumVulnerable);
  const migrated = vulnerable.filter(entry => entry.migrated);
  const autoMigratable = vulnerable.filter(entry => !entry.migrated && effective(entry) === "auto-migratable");
  const ownerUnlockable = vulnerable.filter(entry => !entry.migrated && effective(entry) === "owner-unlockable");
  const external = vulnerable.filter(entry => effective(entry) === "external");
  const notVulnerable = cbom.filter(entry => !entry.quantumVulnerable);

  const completePercent = vulnerable.length === 0 ? 100 : Math.round((migrated.length / vulnerable.length) * 100);
  const achievable = external.length === 0;

  let badge: Badge;
  if (vulnerable.length === 0) badge = "NOT_APPLICABLE";
  else if (migrated.length === vulnerable.length) badge = "NIST_PQC_COMPLETE";
  else if (migrated.length > 0) badge = "PARTIAL";
  else badge = "NONE";

  const badgeLabel =
    badge === "NIST_PQC_COMPLETE" ? "APPLICATION CRYPTOGRAPHY: NIST PQC COMPLETE"
    : badge === "NOT_APPLICABLE" ? "NO QUANTUM-VULNERABLE APPLICATION CRYPTOGRAPHY DETECTED"
    : `NIST PQC: ${migrated.length} of ${vulnerable.length} BOUNDARIES COMPLETE`;

  const ownerActions = [
    ...ownerUnlockable.map(entry => (OWNER_ACTION[entry.primitive] ?? OWNER_ACTION.UNKNOWN!)(entry)),
  ];
  const remainingPlan = external.map(EXTERNAL_PLAN);

  const body = {
    boundaries: cbom,
    counts: {
      total: cbom.length,
      vulnerable: vulnerable.length,
      migrated: migrated.length,
      autoMigratable: autoMigratable.length,
      ownerUnlockable: ownerUnlockable.length,
      external: external.length,
      notVulnerable: notVulnerable.length,
    },
    completePercent,
    achievable,
    ownerConfirmed,
    badge,
    badgeLabel,
    ownerActions,
    remainingPlan,
  };
  return { ...body, sha256: sha256(JSON.stringify(body)) };
}

// Convenience: scanner hits -> full posture in one call.
export function assessNistPosture(hits: ScannerHit[], migratedIds: Set<string> = new Set(), options: PostureOptions = {}): NistPosture {
  return computePosture(buildCbom(hits, migratedIds), options);
}
