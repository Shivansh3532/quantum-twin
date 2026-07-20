import { run } from "../src/signer.js"; if (!run()) process.exit(2); // ECDSA sign/verify roundtrip; migrated to ML-DSA-65 under negative tests in test/nist.test.ts.
