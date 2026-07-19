const crypto = require("node:crypto");

function stampArtifact(bytes, keys, _context) {
  return { rsa: crypto.sign("sha384", bytes, keys.rsaPrivateKey).toString("base64") };
}

function checkArtifact(bytes, envelope, keys, _context) {
  return crypto.verify("sha384", bytes, keys.rsaPublicKey, Buffer.from(envelope.rsa, "base64"));
}

module.exports = { stampArtifact, checkArtifact };
