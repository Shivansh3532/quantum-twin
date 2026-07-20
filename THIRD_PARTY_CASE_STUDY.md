# Independent Third-Party Case Study

Primary target: [`erfanium/myket-signature-verifier`](https://github.com/erfanium/myket-signature-verifier), MIT licensed, created before Build Week, and pinned at `80c12ade8ad2029a644ca7adf76b694b3adf9b7e`. The repository is unrelated to Quantum Twin.

The normal credential-free public GitHub intake completed within all existing limits. Deterministic analysis found a genuine native `node:crypto` RSA verification boundary at `index.js:13`. The repository contains the verifier, while Myket is the externally controlled signature producer. Quantum Twin therefore left the generated contract unapproved and created no candidate: migrating only the verifier would break the external protocol, and the producer is outside the approved system boundary.

Pinned evidence:

- source tree SHA-256: `34cbbb1aab21cc8e59abe9d202aea839f258f71ea006c643d27c727db8d90c77`
- System Bundle manifest SHA-256: `ad1a3b5b16ffb2d19fcf39f4b91f03116665f5e0e0191bad3b2d3bc533a9b00f`
- static graph SHA-256: `16b3cdecaea7b7482e7107a0d22c7ca1face64b9f64dc8c391c0cb1c71cd08c8`
- generated, unapproved contract SHA-256: `75ffc8186ab12af2cfb02c9cd3cb41516f8e89a134df1bc4cb110b2915e1366d`

Reproducibility was checked in a standalone temporary directory on Node.js 24.18.0. `npm ci --ignore-scripts` completed from the committed `package-lock.json`; the repository's exact `npm test` command passed its linter, two RSA-verification assertions, 100% statement/branch/function/line coverage for `index.js`, and type-definition check. npm also reported 50 dependency vulnerabilities in this old pinned dependency tree; Quantum Twin did not modify or minimize that fact.

Result: **contract required; migration refused before execution**. No Codex thread, migration branch, patch, or endorsement claim was created. This case demonstrates the intended safety boundary: a locally passing verifier is not authority to rewrite an externally produced signature protocol.
