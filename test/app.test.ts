import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertLauncherRuntime, browserCommand, findAvailablePort } from "../tools/app.ts";
import { systemStatus } from "../src/system.ts";
import { GET as systemGet } from "../app/api/system/route.ts";
import { POST as streamPost } from "../app/api/runs/stream/route.ts";

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
    } finally { if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous; }
  });

  test("streaming execution independently requires all acknowledgements", async () => {
    const response = await streamPost(new Request("http://localhost/api/runs/stream", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intakeId: "not-authorized" }) }));
    expect(response.status).toBe(400);
    const source = await readFile(path.join(process.cwd(), "app/api/runs/stream/route.ts"), "utf8");
    expect(source).toMatch(/await systemStatus\(\)\)\.ready/);
  });
});
