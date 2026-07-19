# Security Boundary and Limitations

- Source repository remains untouched; local input is copied into ignored run directory before Git initialization or commands.
- URLs are rejected in current P0. No private credentials, SSH, arbitrary protocols, uploads, or pull requests.
- Symlinks are rejected. Resolved paths must remain contained. File count, per-file size, total bytes, and scan time are bounded.
- Commands are validated program-plus-argument arrays and executed without interpolated shell strings.
- Unknown scripts run only after explicit local `--allow-exec`; this is acknowledgment, not hostile-code sandboxing.
- Candidate Codex threads use isolated worktrees, workspace-write sandbox, disabled network/web search, and approval `never`.
- Writable boundary is enforced from Git diff. Protected paths, tests, configuration, compatibility harness, manifests, lockfiles, and dependency policy are deterministic gates.
- Compatibility harness is copied outside candidate roots and hash-checked before and after both evaluator passes.
- Candidate diff secret scan, native `node:crypto`/ML-DSA/context checks, tamper rejection, wrong-key rejection, wrong-context rejection, compatibility, and repeatability fail closed.
- GPT-5.6 may classify or explain. It cannot change gates, measurements, eligibility, selection, or suppress failures.
- Vercel and `QT_RECORDED_MODE=1` are read-only. Hosted POST is HTTP 403; no Codex, Git, worktrees, repository commands, or runtime writes.
- Test keys are ephemeral and never retained.

This tool does not sandbox hostile repositories, prove every side channel, certify FIPS modules, formally verify cryptography, approve production deployment, or make an entire system quantum-safe. Review candidate code and evidence with qualified security engineers before deployment.
