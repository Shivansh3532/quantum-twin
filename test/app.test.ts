import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertLauncherRuntime, browserCommand, findAvailablePort } from "../tools/app.ts";
import { systemStatus } from "../src/system.ts";
import { GET as systemGet } from "../app/api/system/route.ts";
import { POST as streamPost } from "../app/api/runs/stream/route.ts";
import { POST as bundleAnalyzePost } from "../app/api/bundles/analyze/route.ts";
import { POST as bundleApprovePost } from "../app/api/bundles/approve/route.ts";
import { POST as bundleRunPost } from "../app/api/bundles/run/route.ts";
import { GET as bundleExportGet } from "../app/api/bundles/export/route.ts";

describe("local application launcher", () => {
  test("finds a loopback port and uses direct platform browser commands", async () => {
    expect(await findAvailablePort(39_000)).toBeGreaterThanOrEqual(39_000);
    expect(browserCommand("http://127.0.0.1:3000", "win32")).toEqual({ program: "explorer.exe", args: ["http://127.0.0.1:3000"] });
    expect(browserCommand("http://127.0.0.1:3000", "darwin").program).toBe("open");
    expect(browserCommand("http://127.0.0.1:3000", "linux").program).toBe("xdg-open");
  });

  test("launcher never uses shell strings and exposes one app command", async () => {
    const source = await readFile(path.join(process.cwd(), "tools/app.ts"), "utf8"), manifest = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));
    expect(source).toContain('shell: false');
    expect(source).not.toMatch(/exec\(|execSync|shell:\s*true/);
    expect(manifest.scripts.app).toBe("tsx tools/app.ts");
  });

  test("launcher fails closed outside Node 24.18+ and pnpm", () => {
    expect(() => assertLauncherRuntime("v24.18.0", "pnpm.mjs")).not.toThrow();
    expect(() => assertLauncherRuntime("v24.17.9", "pnpm.mjs")).toThrow(/24\.18/);
    expect(() => assertLauncherRuntime("v25.0.0", "pnpm.mjs")).toThrow(/24\.18/);
    expect(() => assertLauncherRuntime("v24.18.0", "")).toThrow(/pnpm/);
  });

  test("system check reports loopback, ML-DSA, workspace, and safe authentication status", async () => {
    const previous = process.env.QT_PREFLIGHT_OK; process.env.QT_PREFLIGHT_OK = "1";
    try {
      const result = await systemStatus();
      expect(result.authenticated).toBe(true);
      expect(result.checks.find(check => check.name === "Loopback binding")?.passed).toBe(true);
      expect(result.checks.find(check => check.name === "ML-DSA-65 runtime")?.passed).toBe(true);
      const secretPattern = new RegExp(`${["s", "k"].join("")}-[A-Za-z0-9_-]{20,}|${["OPENAI", "API", "KEY"].join("_") }=`);
      expect(JSON.stringify(result)).not.toMatch(secretPattern);
    } finally { if (previous === undefined) delete process.env.QT_PREFLIGHT_OK; else process.env.QT_PREFLIGHT_OK = previous; }
  });

  test("hosted system and streaming execution endpoints return 403", async () => {
    const previous = process.env.VERCEL; process.env.VERCEL = "1";
    try {
      expect((await systemGet()).status).toBe(403);
      expect((await streamPost(new Request("http://localhost/api/runs/stream", { method: "POST", body: "{}" }))).status).toBe(403);
      expect((await bundleAnalyzePost(new Request("http://localhost/api/bundles/analyze", { method: "POST", body: "{}" }))).status).toBe(403);
      expect((await bundleApprovePost(new Request("http://localhost/api/bundles/approve", { method: "POST", body: "{}" }))).status).toBe(403);
      expect((await bundleRunPost(new Request("http://localhost/api/bundles/run", { method: "POST", body: "{}" }))).status).toBe(403);
      expect((await bundleExportGet(new Request("http://localhost/api/bundles/export?runId=2026-01-01T00-00-00-000Z"))).status).toBe(403);
    } finally { if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous; }
  });

  test("live lab contains no recorded report import or background evidence request", async () => {
    const sources = await Promise.all(["app/lab/page.tsx", "app/system-workbench.tsx"].map(file => readFile(path.join(process.cwd(), file), "utf8")));
    const live = sources.join("\n");
    expect(live).not.toMatch(/sample\/|api\/runs\/latest|release-cli-(?:direct|compatibility)/);
    expect(live).toContain("No winner, candidate, run ID, hash, or gate result");
    expect(await readFile(path.join(process.cwd(), "app/demo/page.tsx"), "utf8")).toContain("sample/release-cli-compatibility.json");
    expect(await readFile(path.join(process.cwd(), "app/demo/page.tsx"), "utf8")).toContain("evidence/system-demo-run.json");
    const workbench = await readFile(path.join(process.cwd(), "app/system-workbench.tsx"), "utf8");
    expect(workbench).toContain('mode: "github", value: ""');
    expect(workbench).not.toContain('useState<SourceRow[]>([{ id: 1, mode: "demo"');
  });

  test("streaming execution independently requires all acknowledgements", async () => {
    const response = await streamPost(new Request("http://localhost/api/runs/stream", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intakeId: "not-authorized" }) }));
    expect(response.status).toBe(400);
    const source = await readFile(path.join(process.cwd(), "app/api/runs/stream/route.ts"), "utf8");
    expect(source).toMatch(/await systemStatus\(\)\)\.ready/);
  });
});
