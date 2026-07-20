const { generateKeyPairSync, sign, verify } = require("node:crypto");
exports.workflow = () => { const keys = generateKeyPairSync("rsa", { modulusLength: 2048 }); const payload = Buffer.from("express-order"); const signature = sign("RSA-SHA256", payload, keys.privateKey); return { accepted: verify("RSA-SHA256", payload, keys.publicKey, signature), bytes: signature.length }; };
