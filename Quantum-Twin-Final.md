# Quantum Twin — Corrected Build Blueprint

This plan supersedes the earlier schedule, runtime, and orchestration sections. It uses a compressed three-day execution plan and does not depend on an all-nighter.

## 1. Locked project definition

**Quantum Twin is a Codex-powered cryptographic migration tournament.**

A developer gives it a Node/TypeScript repository containing legacy RSA signing. Quantum Twin:

1. Maps the repository’s cryptographic usage.
2. Uses GPT-5.6 to turn those findings into a structured migration specification.
3. Gives the same specification to two isolated Codex builders.
4. Each builder implements a different post-quantum migration strategy.
5. A deterministic verifier tests both implementations.
6. Unsafe or incompatible candidates are disqualified by code—not by AI opinion.
7. GPT-5.6 explains the evidence and trade-offs.
8. The user receives the winning branch, diff, test evidence, and migration report.

The key product distinction is:

> Existing scanners tell teams where cryptography is. Quantum Twin makes competing migrations and proves which migration satisfies the team’s stated constraints.

That is the version we build. Not a generic crypto scanner, not “AI rewrites RSA,” and not a six-agent science project.

## 2. Corrected technical stack

| Component | Locked choice | Reason |
|---|---|---|
| Runtime | Node.js 24.18.0 LTS | Stable LTS with the required ML-KEM/ML-DSA support |
| Package manager | pnpm with committed lockfile | Fast and reproducible |
| Codex | `@openai/codex-sdk@0.144.6` | Current registry release; pin exactly |
| Model | `gpt-5.6-sol` | Verified exact model identifier |
| Model API | Responses API | Verified current OpenAI API |
| Structured data | Zod + Structured Outputs | Prevents free-form orchestration |
| Migration APIs | Native `node:crypto` ML-DSA | No experimental third-party crypto |
| Signature parameter set | ML-DSA-65 (`ml-dsa-65`) | Locks one exact, reproducible middle parameter set |
| Frontend | Next.js + Tailwind | Fastest route to a polished local dashboard |
| Isolation | Git worktrees | Provides real, inspectable candidate branches |
| Testing | Vitest | Low setup cost and readable reports |
| Demo repository | Bundled TypeScript RSA fixture | Makes judging repeatable |

Node 24.18.0 is an official LTS release, code-named Krypton. Its native cryptographic runtime includes the functionality needed here. See the [Node 24.18.0 release](https://nodejs.org/en/blog/release/v24.18.0) and [Node 24 crypto documentation](https://nodejs.org/docs/latest-v24.x/api/crypto.html).

ML-DSA is standardized by NIST in [FIPS 204](https://csrc.nist.gov/pubs/fips/204/final). The demo must use the exact Node key type `ml-dsa-65`, not the vague label “ML-DSA.” Node requires `null` or `undefined` as the `algorithm` argument for ML-DSA signing and verification. Lock a domain-separation context such as `quantum-twin:update-manifest:v1` in the migration contract and test that verification with the wrong context fails.

The exact OpenAI model identifier is `gpt-5.6-sol`; OpenAI documents `gpt-5.6` as an alias that points to Sol. We should pin the exact identifier for demo reproducibility. See the [GPT-5.6 Sol model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-sol).

The project should contain:

```text
.nvmrc                 24.18.0
package.json           engines: >=24.18.0 <25
pnpm-lock.yaml         committed
Dockerfile             node:24.18.0-bookworm-slim
```

Pin:

```text
@openai/codex-sdk: 0.144.6
```

Do not pin Node 26. Do not use the floating `gpt-5.6` alias during the hackathon.

## 3. Corrected orchestration

The previous plan had too many independent AI surfaces. The corrected MVP has three logical AI operations.

### Operation 1: Classification

The deterministic scanner finds relevant files and snippets. GPT-5.6 converts those findings into a validated schema:

```text
CryptoFinding
- primitive: RSA
- operation: signing | verification
- keyLocation
- publicBoundary
- affectedFiles
- confidence
- evidence
```

GPT-5.6 does not decide whether the repository is secure. It performs structured classification on evidence already collected by the scanner.

### Operation 2: Two Codex builders

Two Codex SDK threads receive:

- The same clean baseline commit.
- The same supported file list.
- The same migration contract.
- Different strategy instructions.
- Separate Git worktrees.

They run concurrently through one shared runner abstraction—not through a complex multi-agent framework.

Each builder thread uses the same locked execution policy:

```ts
const thread = codex.startThread({
  model: "gpt-5.6-sol",
  modelReasoningEffort: "high",
  workingDirectory: candidateWorktree,
  sandboxMode: "workspace-write",
  networkAccessEnabled: false,
  webSearchMode: "disabled",
  approvalPolicy: "never"
});
```

The candidate worktree is the only repository the builder may modify. The verifier, frozen acceptance harness, migration contract, and expected-result fixtures live outside that writable directory and are executed later by the parent orchestrator.

Use `Promise.allSettled()` so one failed candidate does not destroy the entire run.

### Timeout and failure isolation

Every `thread.run()` call gets a real cancellation signal through its documented `TurnOptions.signal`. Start with a 10-minute limit and tune it only after the Saturday spike shows actual durations. Use `AbortController`; a plain `Promise.race()` is insufficient because it can return while the underlying Codex process keeps running.

```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 10 * 60_000);

try {
  await thread.run(builderPrompt, { signal: controller.signal });
} finally {
  clearTimeout(timer);
}
```

Classify a rejected turn as a timeout only when `controller.signal.aborted` is true; otherwise record it as a generation failure and preserve the error message.

Generate each candidate once. The repeatability gate reruns the deterministic verifier twice against the already-generated branch; it does **not** call Codex twice. Give every child verification command its own shorter timeout, initially 120 seconds. Record generation and verification separately using statuses such as `generation_timed_out`, `generation_failed`, `gate_failed`, and `eligible`. If one candidate times out, record it as ineligible and continue evaluating the other candidate.

### Run boundary and evidence chain

Treat a run as a reproducible artifact, not just dashboard state:

1. Copy the bundled fixture into a new run directory and create a baseline Git commit.
2. Record the baseline commit SHA and a SHA-256 manifest of the fixture.
3. Create the two candidate worktrees from that exact commit.
4. Run Codex with network access disabled and each worktree as its only writable repository.
5. End the Codex turns before invoking the evaluator.
6. Run the external acceptance harness against each candidate twice.
7. Save the candidate diff, resulting commit SHA, commands, exit codes, durations, Node version, SDK version, model ID, and gate results.
8. Hash the final evidence report and retain it with the run.

The minimum `run.json` should contain:

```text
runId
startedAt
baselineCommit
fixtureManifestSha256
nodeVersion
codexSdkVersion
model
constraintProfile
candidates[]
  strategy
  threadId
  generationStatus
  worktreeCommit
  diffSha256
  gates[]
  measurements
selectedCandidate
verifierManifestSha256
reportSha256
```

This evidence chain makes the demo defensible: judges can see exactly what Codex changed, exactly what was tested, and which deterministic evidence produced the result.

### Operation 3: Explanation

After deterministic verification and ranking, GPT-5.6 receives immutable result JSON and writes the user-facing explanation.

It cannot:

- Change eligibility or the deterministic selection order.
- Mark a failed candidate as passing.
- Suppress a failed gate.
- Select an ineligible candidate.
- Alter benchmark results.

### Explicitly removed from MVP

- Recon agent.
- Independent reviewer agent.
- Three simultaneous builders.
- Responses API multi-agent beta.
- Agent-generated scoring.
- Autonomous pull-request creation.
- Arbitrary repository execution.
- Live agent “thought” display.

The scanner replaces the recon agent. Tests replace the reviewer agent. Two builders are enough to demonstrate genuine competition.

## 4. The two candidates

### Candidate A: Direct Cutover

Replace RSA signatures with ML-DSA signatures.

Advantages:

- Smaller implementation.
- Removes legacy cryptography immediately.
- Simpler long-term design.

Disadvantage:

- Old clients expecting RSA can no longer verify new artifacts.

### Candidate B: Compatibility Bridge

Produce both:

- A legacy RSA signature.
- A new ML-DSA signature.

New clients verify ML-DSA. Legacy clients can continue verifying RSA during the migration window.

Advantages:

- Maintains backward compatibility.
- Supports gradual rollout.
- Gives teams a practical migration path.

Disadvantages:

- Larger signed envelopes.
- More code.
- RSA remains temporarily present.
- Requires an explicit retirement plan.

### Why two candidates produce a meaningful result

The winner changes with the constraint:

- If `legacyCompatibilityRequired = true`, Direct Cutover fails and Compatibility Bridge wins.
- If `legacyCompatibilityRequired = false`, Direct Cutover can win because it is simpler and removes RSA sooner.

That proves the result is driven by real requirements—not a predetermined demo.

### Stretch candidate only

Candidate C, an algorithm-agile envelope, is allowed only after the two-candidate system completes successfully three times in a row.

It must never be added merely to make the dashboard appear busier.

## 5. Supported MVP scope

The supported repository shape must be narrow and honest:

- Node.js 24.
- TypeScript.
- RSA signing and verification using `node:crypto`.
- JSON-compatible signed payloads.
- Public-key verification.
- Bundled demonstration repository.
- No HSM.
- No cloud KMS.
- No certificate authority migration.
- No TLS replacement.
- No arbitrary third-party cryptographic libraries.

The scanner only claims support for patterns it actually recognizes. Unsupported cryptography produces:

```text
Unsupported migration pattern
```

It must not generate a confident migration from uncertain evidence.

This is better than pretending to handle an entire enterprise cryptographic estate in three days.

## 6. Deterministic verification contract

Each candidate receives an automatically generated `migration-contract.json`:

```json
{
  "sourcePrimitive": "RSA",
  "targetPrimitive": "ML-DSA",
  "targetParameterSet": "ML-DSA-65",
  "nodeKeyType": "ml-dsa-65",
  "signatureContext": "quantum-twin:update-manifest:v1",
  "legacyCompatibilityRequired": true,
  "approvedCryptoProvider": "node:crypto",
  "networkAllowed": false,
  "candidateBuildTimeoutMs": 600000,
  "verificationCommandTimeoutMs": 120000,
  "protectedBaselinePaths": [
    "package.json",
    "pnpm-lock.yaml",
    "test/original/**"
  ],
  "externalEvaluatorId": "quantum-twin-acceptance-v1",
  "requiredCommands": [
    "pnpm install --offline --frozen-lockfile",
    "pnpm typecheck",
    "pnpm test"
  ]
}
```

The verifier checks baseline and evaluator hashes before executing any candidate-controlled package script. Test keys are generated ephemerally for each run; no private key belongs in the repository or retained evidence bundle.

### Hard gates

A candidate is eligible only if every required gate passes:

1. **Clean installation**  
   `pnpm install --offline --frozen-lockfile` succeeds from the dependency store populated during baseline setup. The candidate may not add packages or require network access.

2. **Compilation**  
   TypeScript type-checking succeeds.

3. **Original tests**  
   The existing application test files and package scripts match their baseline hashes, and the original suite remains green. A candidate may add tests but may not weaken or replace the original ones.

   This gate only works if the original test suite is written against signing behavior in general — "sign, then verify, succeeds," "tampered payload fails," "wrong key fails" — using whichever signer the current code path calls, not hardcoded assertions about RSA specifically (signature format, byte length, algorithm name). Direct Cutover is supposed to remove RSA entirely; if the original suite asserts anything RSA-specific, Direct Cutover fails gate 3 by construction, and the demo's intended failure point (gate 7, old-client compatibility) never gets reached. Write the fixture's original tests generically before Sunday's build starts, and keep RSA-specific assertions confined to the legacy-verifier compatibility check in gate 7, where that specificity belongs.

4. **New-key verification**  
   ML-DSA signatures produced by the candidate verify successfully.

5. **Tamper rejection**  
   Changing one byte of the payload causes verification to fail.

6. **Wrong-key rejection**  
   A signature cannot be verified using another key pair.

7. **Compatibility contract**  
   If compatibility is required, the frozen legacy verifier must accept the legacy portion of newly signed artifacts. There must be exactly one legacy-verifier implementation, owned by the external acceptance harness—not a replacement created inside either candidate worktree.

8. **Evaluator and baseline integrity**  
   Candidate branches cannot modify Quantum Twin’s evaluator or frozen acceptance fixtures because those files are outside the candidate write root. The original test files, package scripts, and lockfile must still match their baseline hashes. Also compare the external evaluator’s SHA-256 manifest before and after the run. Read-only permissions alone are not treated as a security boundary.

9. **No dependency changes**  
   The candidate cannot alter `package.json` dependencies or the lockfile. Both migrations must use the approved native Node cryptographic provider.

10. **Secret hygiene**  
    The diff cannot contain committed private keys, secrets, or generated credentials.

11. **Approved API use**  
    The implementation must use the approved native cryptographic provider.

12. **Domain separation**  
    An ML-DSA signature created with the contract’s context verifies with that context and fails verification with a different context.

13. **Repeatability**  
    The complete verification run must pass twice from a clean candidate worktree.

A failed hard gate makes the candidate ineligible. No weighted score can rescue it.

### Metrics and deterministic selection

Do not use arbitrary weighted scoring. Compatibility is already a hard gate, so awarding it another 30% would double-count it. Performance measurements can fluctuate enough to change a close result and therefore should be displayed as evidence, not used to choose the winner during the hackathon.

Use this deterministic policy:

1. Remove every ineligible candidate.
2. If no candidates remain, report **no safe winner**. Never select the least-bad failure.
3. If one candidate remains, select it.
4. If several remain, prefer the candidate that emits fewer legacy RSA signatures.
5. Break a remaining tie with fewer changed lines, then smaller signature-envelope size.
6. If the result is still tied, report both as eligible and require a human choice instead of manufacturing certainty.

Display these measurements without letting them override the policy:

| Measurement | Selection role |
|---|---|
| Legacy compatibility | Hard gate when required |
| RSA signatures emitted after migration | Primary eligible-candidate comparator |
| Changed lines | Deterministic tie-breaker |
| Signature-envelope bytes | Deterministic second tie-breaker |
| Median and p95 signing latency | Display only |
| Median and p95 verification latency | Display only |

Benchmark after a warm-up, use the same fixed payload and iteration count for both candidates, and record Node version and machine details. All measurements come from code. GPT-5.6 can explain why they matter, but it cannot invent or modify them.

## 7. What “verified” means

> Verified means the recorded repository tests, negative tests, compatibility tests, dependency policy, static rules, and benchmarks passed in the isolated environment.
>
> It does not mean:
>
> - Formal verification of ML-DSA.
> - FIPS module certification of the user's runtime.
> - Proof against every side channel.
> - Security approval for production.
> - Replacement for a cryptographer or security review.

This protects the project from the most dangerous judge question: “Are you claiming the AI proved this cryptography secure?”

The answer is no. Quantum Twin verifies the migration against an explicit, reproducible engineering contract.

## 8. Programmatic Tool Calling decision

Programmatic Tool Calling is real and current. The official configuration uses:

- A `programmatic_tool_calling` tool.
- Functions with `allowed_callers: ["programmatic"]`.

However, PTC executes in an isolated V8 environment. It is not a general Node.js shell and should not be responsible for running Codex, Git, or tests. See the [OpenAI Programmatic Tool Calling documentation](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling).

Therefore:

- PTC is not required for the core MVP.
- The core system uses the Responses API with Structured Outputs.
- PTC is added only if the complete project is stable by Monday at 1:00 PM EDT.
- If added, it may retrieve multiple immutable candidate reports and synthesize comparisons.
- It may not execute the migrations or determine eligibility.

This still demonstrates GPT-5.6 strongly without risking the entire build on one optional feature.

## 9. Compressed schedule

### Saturday, July 18 — Recovery Sprint

**Maximum target: approximately four focused hours from whatever time you actually start. No UI work.**

Before starting, check the real clock, not the calendar day. If it is already late evening, protect Sunday morning by cutting documentation polish and scanner sophistication—not the runtime, authentication, cryptography, or Codex SDK smoke tests. Those smoke tests retire the highest-risk unknowns and are not redundant.

#### Goal

Prove the foundation before sleeping.

#### Work

1. Pin Node 24.18.0.
2. Install and pin the Codex SDK.
3. Run one tiny authenticated Responses API call using `gpt-5.6-sol`.
4. Create a throwaway Git repository and worktree.
5. Run one minimal Codex SDK task in that worktree using the locked sandbox options and an `AbortSignal` timeout.
6. Create a standalone ML-DSA-65 spike using native `node:crypto`.
7. Confirm signing, verification, tamper rejection, wrong-key rejection, and wrong-context rejection.
8. Create the smallest usable RSA fixture and original RSA tests.
9. Reset or discard the experimental worktree.
10. Record exact commands and errors in a scratch log.

#### Exit test

Before ending the night, all must be true:

- Node reports `v24.18.0`.
- Original RSA fixture tests pass.
- The standalone ML-DSA-65 tests pass, including wrong-context rejection.
- The Responses API credential and exact model string work.
- The Codex SDK successfully operates inside one worktree and responds to cancellation.
- The main branch remains unchanged.
- A second person could reproduce the commands from the notes.

If the Codex SDK integration is not working tonight, Sunday begins with SDK recovery. Do not start the dashboard.

### Sunday, July 19 — Build the complete engine

#### Morning: first candidate

Build this path end to end:

```text
Fixture → scan → specification → one worktree → Codex builder
→ run tests → store evidence → display JSON report
```

Do not parallelize yet.

#### 12:30 PM EDT go/no-go checkpoint

A candidate is considered clean only if:

- It begins from the same baseline commit.
- Codex produces a real diff.
- The candidate compiles.
- Verification runs without manual repair.
- The candidate is generated once and the external verifier succeeds twice without Codex intervention.
- The output report is machine-readable.

##### Green

If all six are true, add Candidate B and parallel execution.

##### Yellow

If it works once but not twice:

- Keep two candidates.
- Execute them sequentially.
- Do not add streaming.
- Do not add PTC.
- Do not add the reviewer.

##### Red

If the first candidate cannot complete:

- Stop building orchestration.
- Fix the single-candidate path.
- Use the Codex CLI as a fallback only if SDK integration is the isolated failure.
- If parallel execution is the failure, run the two Codex candidates sequentially through the same adapter.
- Give a failed builder one repair turn using its gate report; do not silently hand-edit its branch.
- Time-box SDK/auth/environment recovery to two hours. If no Codex path works after that, stop UI work and solve the Codex blocker first: hand-authored candidates cannot support the project's central technological claim.
- A replay mode may use only artifacts previously generated by a successful Codex run. Label it **Recorded Codex run**, retain the original thread IDs and hashes, and keep the normal live path in the repository. Never present hand-authored or prewritten patches as live agent output.
- Keep the same evidence and worktree architecture.

#### Afternoon

1. Implement Direct Cutover strategy.
2. Implement Compatibility Bridge strategy.
3. Protect acceptance tests from modification.
4. Build deterministic gates.
5. Store results under a consistent run identifier.
6. Implement the deterministic selection policy.
7. Add the GPT-5.6 explanation call.

#### Evening

Build only enough interface to show:

- Finding.
- Constraint.
- Two candidates.
- Gate results.
- Selected candidate.
- Diff.

#### Sunday exit test

One command must produce a complete run with two candidates:

```text
pnpm demo
```

Expected result with compatibility required:

- Direct Cutover: ineligible because legacy verification fails.
- Compatibility Bridge: eligible.
- Compatibility Bridge: selected.
- Evidence report: saved.
- Diff: viewable.
- GPT explanation: grounded in the saved results.

### Monday, July 20 — Product experience and reliability

#### Morning

Build the actual dashboard around real run data.

##### Screen 1: Migration brief

Show:

- RSA finding.
- Relevant files.
- Evidence snippets.
- Target algorithm.
- Compatibility toggle.
- “Run migration tournament” button.

##### Screen 2: Candidate run

Show two candidate cards:

- Branch name.
- Strategy.
- Current phase.
- Files changed.
- Tests passed.
- Eligibility.

Use polling if necessary. Real-time streaming is not important enough to risk the project.

##### Screen 3: Evidence decision

Show:

- Winning candidate.
- Hard-gate matrix.
- Before/after diff.
- Payload-size comparison.
- Benchmark comparison.
- GPT explanation.
- Downloadable JSON report.
- Exact verification command.

#### 1:00 PM EDT checkpoint

PTC or a reviewer agent may be added only if:

- Two candidates complete successfully three consecutive times.
- The UI displays real data.
- README setup instructions exist.
- No manual repair is needed between runs.

Otherwise, both features are permanently cut.

#### Afternoon and evening

1. Run five clean demonstrations.
2. Fix nondeterministic behavior.
3. Test with a clean clone.
4. Confirm missing API-key error handling.
5. Confirm one candidate may fail without crashing the other.
6. Confirm model failures produce visible error states.
7. Capture screenshots and one backup demo recording.
8. Finish README and architecture documentation.
9. Prepare sample output so judges understand the result before running it.

#### Monday exit test

- Three consecutive successful complete runs.
- Clean-clone setup works.
- Dashboard uses genuine run data.
- No protected evaluator files can be changed.
- Backup recording exists.
- No P0 feature remains unfinished.

### Tuesday, July 21 — Freeze and submit

#### 8:00 AM EDT

Perform the Definition of Done literally.

#### 10:00 AM EDT

**Hard feature freeze.**

After this time, only fix:

- Crashes.
- Incorrect instructions.
- Broken tests.
- Misleading claims.
- Submission problems.

Do not add the third candidate, reviewer, PTC, animations, or GitHub integration.

#### 10:00 AM–1:00 PM

Record the final video.

#### 1:00–3:00 PM

- Upload the video.
- Finish the Devpost description.
- Verify the public/private repository permissions.
- Test every README command on a clean clone.
- Obtain the `/feedback` session ID.
- Check license and sample data.

#### Target submission

Submit by **5:30 PM EDT**, not 8:00 PM. This preserves approximately 2½ hours for Devpost, YouTube, or network failures.

The actual deadline is Tuesday, July 21 at 8:00 PM EDT.

## 10. Revised Definition of Done

The project is ready only when every P0 item is true:

- [ ] Node 24.18.0 is pinned.
- [ ] Lockfile is committed.
- [ ] `@openai/codex-sdk@0.144.6` is pinned.
- [ ] `gpt-5.6-sol` is configured explicitly.
- [ ] Responses API and Codex SDK authentication both pass a preflight check.
- [ ] The signature target is explicitly `ML-DSA-65` / `ml-dsa-65`.
- [ ] Bundled RSA fixture runs.
- [ ] Scanner identifies the supported RSA path.
- [ ] GPT classification returns validated structured output.
- [ ] Two Codex candidates start from identical commits.
- [ ] Candidates use separate worktrees.
- [ ] Each builder uses the locked sandbox, network, approval, and model options.
- [ ] Builder turns use real `AbortSignal` cancellation and report timeout separately from gate failure.
- [ ] Direct Cutover produces a genuine code diff.
- [ ] Compatibility Bridge produces a genuine code diff.
- [ ] The acceptance evaluator remains outside candidate write roots and its hash is unchanged.
- [ ] Original tests and the single frozen legacy verifier remain immutable.
- [ ] Hard gates are deterministic.
- [ ] Domain-separation context tests pass.
- [ ] Compatibility behavior changes with the declared constraint.
- [ ] Ineligible candidates cannot win.
- [ ] Selection uses the documented deterministic policy, with no arbitrary weighted score.
- [ ] GPT explanations cannot modify results.
- [ ] Complete runs succeed three times consecutively.
- [ ] Every run retains commit, diff, model, runtime, command, gate, and report provenance.
- [ ] The dashboard uses real evidence.
- [ ] Clean-clone setup succeeds.
- [ ] README states the supported scope.
- [ ] README includes the “verified means” limitation.
- [ ] Demo video is under three minutes.
- [ ] Video mentions both GPT-5.6 and Codex.
- [ ] Repository access is correct.
- [ ] `/feedback` session ID is saved.
- [ ] Submission is completed before the safety deadline.

The reviewer agent, third candidate, PTC, GitHub PR creation, and Dockerized arbitrary-repository execution are not part of this checklist.

## 11. Three-minute demo

### 0:00–0:25 — The problem

“This service signs software-update manifests with RSA. We need to migrate to post-quantum cryptography, but replacing the algorithm could immediately break every older verifier.”

Show the working RSA application and legacy verifier.

### 0:25–0:50 — Detection

Run Quantum Twin.

Show:

- RSA signing path.
- Affected files.
- Compatibility requirement.
- ML-DSA target.

### 0:50–1:35 — Codex tournament

Start both candidates.

Show:

- Direct Cutover worktree.
- Compatibility Bridge worktree.
- Real code changes.
- Tests running.

Say:

“Both Codex builders receive the same repository and requirements, but they implement different migration strategies.”

### 1:35–2:20 — Deterministic proof

Show the evidence matrix.

Direct Cutover:

- ML-DSA verification passes.
- Tamper rejection passes.
- Legacy compatibility fails.
- Candidate disqualified.

Compatibility Bridge:

- ML-DSA verification passes.
- Legacy verification passes.
- Tamper rejection passes.
- Candidate eligible.

Say:

“GPT-5.6 cannot override these gates. It only explains the evidence produced by the verifier.”

### 2:20–2:50 — The result

Show:

- Winning branch.
- Diff.
- Measurements.
- Migration report.
- Command to reproduce verification.

Toggle compatibility off briefly and show that the Direct Cutover becomes a valid choice. This demonstrates genuine constraint-driven selection.

### 2:50–3:00 — Close

“Quantum Twin doesn’t merely find legacy cryptography or generate one plausible patch. It uses Codex to create competing migrations and gives engineers reproducible evidence for choosing one.”

## 12. The rule that protects the project

From this moment on, every feature must answer:

> Does this make the migration more real, the evidence more trustworthy, or the demonstration clearer?

If the answer is no, it waits.

The winning version of Quantum Twin is not the version with the most agents. It is the version where two genuine Codex migrations run, one fails for an understandable reason, one passes for an understandable reason, and every result can be reproduced in front of the judges.

## 13. Judge-defense answers

### “Why not just ask Codex to migrate the code?”

You can ask Codex for one patch. That does not tell a security team which rollout strategy is compatible with existing clients, whether the patch passed frozen adversarial tests, or whether a different migration would reduce legacy exposure. Quantum Twin turns an open-ended coding request into a constrained comparison with external evidence.

### “Can the builders cheat by editing the tests?”

The acceptance evaluator and legacy verifier are outside both candidate write roots, their hashes are recorded, and the parent orchestrator runs them only after the Codex turns finish. A candidate cannot become eligible by weakening its own tests.

### “Is this formal verification?”

No. It is deterministic verification against a declared engineering contract. The dashboard and README explicitly state the boundary.

### “Why only two candidates?”

They represent the two decisions a real migration owner must make first: remove RSA immediately or preserve legacy verification during a transition. A third strategy adds less value than making those two reproducible and defensible.

### “What happens if both candidates fail?”

Quantum Twin reports **no safe winner**, preserves both failure reports, and recommends the next constraint or implementation issue to address. It never selects a failed candidate merely to complete the demo.

### “How do we know the result was not prerecorded?”

The live path produces a run ID, baseline commit, Codex thread IDs, candidate commits, diff hashes, verifier hash, exact commands, and a final report hash. A separately labeled replay mode exists only as presentation resilience and uses the same captured evidence.

### “Are you claiming production readiness?”

No. The hackathon MVP supports one narrow Node/TypeScript RSA-signing pattern and demonstrates a trustworthy migration workflow. HSMs, KMS integrations, certificates, TLS, broader languages, and security approval remain explicit future work.
