import { verifyReportFile } from "../src/report.ts";

const files = ["sample/release-cli-compatibility.json", "sample/release-cli-direct.json", "sample/run.json"];
const results = await Promise.all(files.map(verifyReportFile));
console.log(JSON.stringify({ valid: results.every(result => result.valid), reports: results }, null, 2));
if (results.some(result => !result.valid)) process.exitCode = 1;
