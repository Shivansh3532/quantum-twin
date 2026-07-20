import matrix from "../support-matrix.json";

export type SupportLevel = "FULLY_SUPPORTED" | "EXPERIMENTAL" | "DISCOVERY_ONLY";
export type SupportRow = typeof matrix.rows[number] & { level: SupportLevel };
export const supportMatrix = matrix as Omit<typeof matrix, "rows"> & { rows: SupportRow[] };

export function validateSupportMatrix() {
  for (const row of supportMatrix.rows) {
    const complete = row.detector && row.adapter && row.verifier && row.positiveNegative && row.systemFixture && row.windows && row.ubuntu && row.docs;
    if (row.level === "FULLY_SUPPORTED" && !complete) throw new Error(`Unsupported FULLY_SUPPORTED claim: ${row.boundary}`);
  }
  return true;
}
