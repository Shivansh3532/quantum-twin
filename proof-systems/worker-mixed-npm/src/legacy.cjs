const { verify } = require("node:crypto");

exports.consume = (payload, signature, publicKey) => verify("RSA-SHA256", payload, publicKey, signature);
