import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateClassification } from "../src/ai.ts";
import type { CryptoFinding, ScannerHit } from "../src/domain.ts";
import { verifyReportData } from "../src/report.ts";

const load = async (name: string) => JSON.parse(await readFile(path.join(process.cwd(), "sample", name), "utf8"));
const failed = (result: ReturnType<typeof verifyReportData>, name: string) => result.checks.find(check => check.name === name)?.passed;

describe("public evidence verifier", () => {
  test("all public samples verify and encode generalized scenario results", async () => {
    const compatibility = await load("release-cli-compatibility.json"), direct = await load("release-cli-direct.json"), alias = await load("run.json");
    for (const [name, report] of [["compatibility", compatibility], ["direct", direct], ["run alias", alias]] as const) {
      expect(verifyReportData(report, name).valid).toBe(true);
      expect(report.repository.source).toBe("local:release-artifact-cli");
      expect(report.repositoryContract.target.context).toBe("quantum-twin:release-artifact:v1");
      expect(report.finding.operations).toEqual(["signing", "verification"]);
      const selected = report.candidates.find((candidate: { strategy: string }) => candidate.strategy === report.selectedCandidate);
      expect(selected.gates.every((gate: { passed: boolean }) => gate.passed)).toBe(true);
    }
    expect(alias).toEqual(compatibility);
    expect(compatibility.constraintProfile.legacyCompatibilityRequired).toBe(true);
    expect(compatibility.selectedCandidate).toBe("bridge");
    expect(direct.constraintProfile.legacyCompatibilityRequired).toBe(false);
    expect(direct.selectedCandidate).toBe("direct");
  });

  test("rejects modified report and altered candidate diff", async () => {
    const modified = await load("release-cli-compatibility.json"); modified.completedAt = "changed";
    expect(failed(verifyReportData(modified), "report hash")).toBe(false);
    const altered = await load("release-cli-compatibility.json"); altered.candidates[0].diff += "\nmodified";
    expect(failed(verifyReportData(altered), "diff hash: direct")).toBe(false);
  });

  test("rejects failed selection and invalid no-safe-winner", async () => {
    const selectedFailure = await load("release-cli-compatibility.json");
    selectedFailure.candidates.find((candidate: { strategy: string }) => candidate.strategy === "bridge").gates[0].passed = false;
    expect(failed(verifyReportData(selectedFailure), "selected eligibility")).toBe(false);
    const noWinner = await load("release-cli-direct.json"); noWinner.selectedCandidate = null;
    expect(failed(verifyReportData(noWinner), "no-safe-winner policy")).toBe(false);
    const wrongWinner = await load("release-cli-direct.json"); wrongWinner.selectedCandidate = "bridge";
    expect(failed(verifyReportData(wrongWinner), "deterministic selection")).toBe(false);
  });

  test("rejects missing evaluator pass, personal path, and malformed report", async () => {
    const missingPass = await load("release-cli-compatibility.json");
    missingPass.candidates[0].gates = missingPass.candidates[0].gates.filter((gate: { name: string }) => !gate.name.includes("(pass 2)"));
    expect(failed(verifyReportData(missingPass), "two evaluator passes: direct")).toBe(false);
    const personal = await load("release-cli-compatibility.json"); personal.repository.source = ["D:", "Users", "entrant", "repo"].join("\\");
    expect(failed(verifyReportData(personal), "personal paths")).toBe(false);
    expect(failed(verifyReportData({ broken: true }), "schema")).toBe(false);
  });
});

describe("classification authority boundary", () => {
  const evidence: ScannerHit[] = [
    { file: "lib/signer.cjs", line: 2, operation: "signing", technology: "native node:crypto RSA", importForm: "commonjs", algorithmEvidence: "sha384", confidence: .98, status: "supported", snippet: "sign" },
    { file: "lib/signer.cjs", line: 6, operation: "verification", technology: "native node:crypto RSA", importForm: "commonjs", algorithmEvidence: "sha384", confidence: .98, status: "supported", snippet: "verify" },
  ];
  const finding: CryptoFinding = { primitive: "RSA", operations: ["signing", "verification"], keyLocation: "keys", publicBoundary: "envelope", affectedFiles: ["lib/signer.cjs"], confidence: 1, evidence: ["scanner"] };
  test("accepts exact scanner files and operations", () => expect(validateClassification(finding, evidence)).toEqual(finding));
  test("rejects invented files and contradictory operations", () => {
    expect(() => validateClassification({ ...finding, affectedFiles: ["invented.ts"] }, evidence)).toThrow(/affectedFiles/);
    expect(() => validateClassification({ ...finding, operations: ["signing"] }, evidence)).toThrow(/operations/);
  });
});
