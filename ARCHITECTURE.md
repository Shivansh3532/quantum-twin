# Architecture

```mermaid
flowchart LR
  F[Bundled RSA fixture] --> S[TypeScript AST scanner]
  S --> C[GPT-5.6 structured classification]
  C --> B[Immutable migration contract]
  B --> A[Codex Direct worktree]
  B --> D[Codex Bridge worktree]
  A --> E[External deterministic evaluator]
  D --> E
  L[Frozen legacy verifier] --> E
  E --> P[Deterministic selection]
  P --> X[GPT-5.6 evidence explanation]
  X --> R[run.json plus dashboard]
```

Main repository owns web app, orchestrator, contract, evaluator, and frozen legacy verifier. Every run copies fixture into temporary Git baseline, records its manifest/commit, then creates two worktrees. Codex may write only candidate worktree. Parent invokes evaluator only after turns end. Candidate generation happens once; complete evaluator runs twice against same branch.
