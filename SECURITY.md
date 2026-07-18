# Security Boundary and Limitations

- Candidate network disabled; approval policy `never`; worktree is only writable repository.
- Evaluator and frozen legacy verifier live outside candidate roots and manifest hash is checked.
- Baseline package scripts, lockfile, and original tests are hash-protected.
- Installation is offline and frozen. Dependency edits, non-native crypto, secrets/private keys in diff, tamper acceptance, wrong-key acceptance, and wrong-context acceptance fail hard gates.
- Test RSA and ML-DSA private keys are generated ephemerally and never retained.
- One candidate failure cannot cancel sibling candidate.

This MVP does not sandbox hostile arbitrary repositories, protect against every side channel, certify FIPS modules, formally verify cryptography, or approve production deployment. Only bundled supported fixture may be executed.
