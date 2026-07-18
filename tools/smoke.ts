import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3210"], { stdio: "ignore", windowsHide: true });
try {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 15 && !response; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1_000));
    try { response = await fetch("http://127.0.0.1:3210/"); } catch {}
  }
  if (!response?.ok || !(await response.text()).includes("Quantum")) throw new Error("production HTTP smoke failed");
  console.log("HTTP 200; Quantum Twin rendered");
} finally {
  child.kill();
}
