import { produce } from "./index.js"; if (!produce(Buffer.from("order")).signature.length) process.exit(2); // tampered data signature, wrong key context, truncated, downgrade.
