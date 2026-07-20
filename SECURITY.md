# Security Boundary and Limitations

- Intake accepts credential-free public GitHub HTTPS or explicitly trusted local sources. Clone disk, timeout, redirects, file count, paths, symlinks, total bytes, archives, and per-source-file limits fail closed. Oversized irrelevant non-source artifacts may be skipped for analysis only and are reported; execution revalidates every file strictly.
- Analysis never runs repository code. Contract synthesis records provenance for every field. Approval is tied to the exact contract hash and is re-derived from current source before execution.
- Execution needs repository trust, command permission, Codex permission, and exact typed confirmation. Commands are program/argument arrays with `shell:false` and a small environment allowlist; credentials are not inherited. Health checks are loopback HTTP only.
- Candidate worktrees have network and web search disabled, approval `never`, and writes limited by deterministic path gates. Contract, evaluator, tests, manifests, lockfiles, CI, and declared protected paths stay frozen. No private keys or production credentials are generated or committed.
- Runtime tracing records operation, algorithm, key type, repository-relative call site, payload length, context label, and component only. It does not record payload/plaintext, signatures, key bytes, tokens, cookies, environment secrets, or credentials.
- Service processes are tracked by exact spawned PIDs/process groups, terminated in reverse order, and cleanup is a hard gate. Candidates run twice from independent worktrees.
- Original repositories are never edited by analysis or tournament execution. Evidence export does not apply patches. Pushing, releases, deployments, PRs, and risk acceptance are never automatic.
- Vercel/recorded mode performs no intake, Git, Codex, worktree, command, trace, or file write. All live POST routes and local evidence export return 403.

Quantum Twin is containment for reviewed repositories, not a hostile-code sandbox. Passing gates is not formal verification, FIPS certification, side-channel proof, cryptographic assurance, production approval, or proof of whole-system quantum safety.
