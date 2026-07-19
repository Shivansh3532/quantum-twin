# Generality Fixtures

`release-cli` is a CommonJS/npm package using namespace-style `crypto.sign`/`crypto.verify` with `stampArtifact` and `checkArtifact` exports.

`next-audit` is a TypeScript ESM server utility using a namespace import with `issueReceipt` and `checkReceipt` exports.

Each fixture owns original tests, a versioned configuration, and an external compatibility harness copied outside candidate worktrees before generation. They are deterministic, dependency-free, and MIT-licensed with repository.
