# Phase 28 local package

**LOCAL DISPOSABLE REHEARSAL ONLY — NOT AUTHORIZED FOR PRODUCTION EXECUTION.**

Run `node tools/responder/phase28/build-package.mjs` to manufacture `package.local.sql`. It verifies the immutable Phase 26 base hash and appends the extension before the sole commit. This generated file is a local design/rehearsal artifact, not a migration-path file. It must never be run against a linked project.

Run `tools/responder/phase28/run-clone-rehearsal.ps1` from the repository on the existing Windows Docker/PostgreSQL toolchain. The runner creates an unlinked temporary Supabase project, a loopback-only Docker network, a CLI-generated bootstrap migration and synthetic baseline. It rehearses install, catalog checks, empty rollback/reapply, real JWT/TOTP/AAL2 tests, evidence-bearing rollback refusal and teardown in `finally`. Credentials stay in the process environment and are not written to evidence. The baseline's marker is intentionally inherited from Phase 26; it never identifies a real production clone.

Run `node --test tests/responder-phase28-dayton-pilot.test.mjs` for inert configuration, retention and visibility-lease tests. Run prior Phase 21–24 suites through their dedicated disposable runners; Phase 25/26 contract tests run with Node. Phase 20/27 have no standalone tests in the starting tree. Never equate a policy-model pass with database or deployed behavior.

For captured Windows PowerShell sessions, run `./tools/responder/phase28/run-prior-local.ps1 -Phase 21` (or 22/23). This runs the original test file against an isolated loopback PostgreSQL instance and gives the background server separate output handles. It avoids waiting indefinitely on inherited pipeline handles, preserves historical runners, and verifies the temporary cleanup path before removal.

`closure.sql` extends the package with bound recovery/transfer proofs, scoped actor conversion, explicit renewal, record transitions and organization/user offboarding. The runner executes both runtime suites. `closure-runtime.test.mjs` emits command, enum and security-catalog evidence. `certify-closure.mjs` is the final acceptance/report generator; `refresh-evidence.mjs` is retained as the earlier incomplete-phase evidence utility and must not replace final closure certification.

The general suite's legacy `runtime-vectors.json` field `recoveryEnabled: false` describes that suite's scope, not the assembled package. Recovery is enabled in the local pilot configuration and certified by the separate `closure-vectors.json` suite. The final report requires both suites to pass. Final totals count Node tests once; the 135 general and 542 closure check groups are additional assertions within two runtime tests.

Activation references remain engineering representations, not external evidence validation. A failed rehearsal produces no readiness claim. Legal/privacy retention validation, actual staffing and real departmental activation remain separate pre-production gates.
