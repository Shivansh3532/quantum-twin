import { spawn, type ChildProcess } from "node:child_process";
import { command, resolvedCommand, safeCommandEnvironment } from "./util.ts";

export type ManagedProcess = { id: string; pid: number; command: string; child: ChildProcess; stdout: string[]; stderr: string[] };

export function startManaged(id: string, parts: string[], cwd: string, environment: NodeJS.ProcessEnv = safeCommandEnvironment()): Promise<ManagedProcess> {
  if (!parts.length) throw new Error("Start command is empty");
  return new Promise((resolve, reject) => {
    const resolved = resolvedCommand(parts[0]!, parts.slice(1));
    const child = spawn(resolved.executable, resolved.args, { cwd, env: environment, shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    const stdout: string[] = [], stderr: string[] = [];
    child.stdout?.on("data", value => { if (stdout.join("").length < 100_000) stdout.push(String(value)); });
    child.stderr?.on("data", value => { if (stderr.join("").length < 100_000) stderr.push(String(value)); });
    child.once("error", reject);
    child.once("spawn", () => resolve({ id, pid: child.pid!, command: parts.join(" "), child, stdout, stderr }));
  });
}

export async function stopManaged(processes: ManagedProcess[]) {
  const outcomes: Array<{ id: string; stopped: boolean; detail: string }> = [];
  for (const managed of [...processes].reverse()) {
    if (managed.child.exitCode !== null) { outcomes.push({ id: managed.id, stopped: true, detail: `already exited ${managed.child.exitCode}` }); continue; }
    if (!Number.isSafeInteger(managed.pid) || managed.pid <= 0 || managed.pid === process.pid) throw new Error("Refusing to terminate an invalid managed PID");
    if (process.platform === "win32") {
      const result = await command("taskkill", ["/PID", String(managed.pid), "/T", "/F"], process.cwd(), 15_000, safeCommandEnvironment());
      const stopped = result.exitCode === 0 || managed.child.exitCode !== null;
      outcomes.push({ id: managed.id, stopped, detail: stopped && result.exitCode !== 0 ? "process exited during isolated tree cleanup" : result.stderr || result.stdout || `exit ${result.exitCode}` });
    } else {
      try { process.kill(-managed.pid, "SIGTERM"); } catch { /* It may have exited between checks. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
      if (managed.child.exitCode === null) try { process.kill(-managed.pid, "SIGKILL"); } catch { /* already stopped */ }
      outcomes.push({ id: managed.id, stopped: true, detail: "isolated process group terminated" });
    }
  }
  return outcomes;
}

export async function waitForHealth(url: string, timeoutMs: number) {
  if (!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/.test(url)) throw new Error(`Health check must target loopback HTTP: ${url}`);
  const started = performance.now(); let last = "not attempted";
  while (performance.now() - started < timeoutMs) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(2_000) }); if (response.ok) return { passed: true, detail: `${url} returned ${response.status}`, durationMs: Math.round(performance.now() - started) }; last = `HTTP ${response.status}`; }
    catch (error) { last = error instanceof Error ? error.message : String(error); }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return { passed: false, detail: `${url}: ${last}`, durationMs: Math.round(performance.now() - started) };
}
