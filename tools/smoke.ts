import { spawn } from "node:child_process";

const mode = process.argv[2] === "dev" ? "dev" : "start";
const port = mode === "dev" ? "3211" : "3210";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", mode, "-p", port], { stdio: "ignore", windowsHide: true });
try {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 15 && !response; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1_000));
    try { response = await fetch(`http://127.0.0.1:${port}/`); } catch {}
  }
  if (!response?.ok || !(await response.text()).includes("Quantum")) throw new Error("production HTTP smoke failed");
  if (process.env.QT_RECORDED_MODE === "1" || process.env.VERCEL === "1") {
    const compatibility = await fetch(`http://127.0.0.1:${port}/api/runs/latest`);
    const direct = await fetch(`http://127.0.0.1:${port}/api/runs/latest?scenario=direct`);
    const invalid = await fetch(`http://127.0.0.1:${port}/api/runs/latest?scenario=bad`);
    const post = await fetch(`http://127.0.0.1:${port}/api/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const compatibilityReport = await compatibility.json(), directReport = await direct.json();
    if (!compatibility.ok || compatibilityReport.selectedCandidate !== "bridge" || compatibilityReport.reportSha256 !== "077f8dfc267bb6f64fcec12b1919eefd6e0fb338e1f0cb6218e405301e93f9e9") throw new Error("compatibility sample HTTP mismatch");
    if (!direct.ok || directReport.selectedCandidate !== "direct" || directReport.reportSha256 !== "02546c9b3ef20586dd1e502f38643256b806ff64f08a6b6b1e4ef4fc24ac1311") throw new Error("direct sample HTTP mismatch");
    if (invalid.status !== 400) throw new Error(`invalid recorded scenario returned ${invalid.status}`);
    if (post.status !== 403) throw new Error(`recorded POST returned ${post.status}`);
    console.log("recorded GET scenarios verified; invalid scenario 400; POST 403");
  }
  console.log(`${mode} HTTP 200; Quantum Twin rendered`);
} finally {
  child.kill();
}
