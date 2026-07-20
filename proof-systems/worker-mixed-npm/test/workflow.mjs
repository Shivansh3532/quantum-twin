import { generateKeyPairSync } from "node:crypto";
import { processScheduledJob } from "../src/worker.mjs";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
if (!processScheduledJob(Buffer.from("scheduled-job"), keys)) process.exit(1);
