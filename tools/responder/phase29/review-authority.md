# DAYTON-REVIEW-01 — local reviewer authority alignment

This additive implementation enforces the owner-approved reviewer policy without changing the frozen PHASE29-v1 taxonomy or reporting contract. Installation remains limited to an empty, marked disposable baseline; this is not a production forward migration.

## Explicit grants and unit context

`reviewer_authorizations` binds one opaque reviewer token, organization, acting unit, target unit, exact subtype, permitted hazard/closure gates, governed scope/version and source version, validity, revocation, issuing actor, bounded evidence, reviewer policy version and an optional governance approval reference. A different acting/target pair requires the governance reference. Each row authorizes one exact pair and subtype; there are no wildcard units, categories or gates. Tokens are opaque lineage without a foreign key to the erasable identity mapping.

Only a live platform actor with `platform.capability.manage` can call `grant_review_authorization` or `revoke_review_authorization`. The grant command validates the recipient's coarse review permission, explicit live memberships in both units, department eligibility and current governed scope. Parent administration, memberships, general `projection.review`, or bilateral sharing alone confer no reviewer grant. Grant validity is bounded to at most 90 days from issuance, consistent with the existing local capability envelope; changing the granted scope requires a new immutable grant. Revocation is server-timestamped and irreversible.

## Approval boundary

`review_report_publication` requires `object_id`, `record_id`, `expected_revision` (current details revision), `expected_candidate_revision`, `reviewer_authorization_id`, `acting_unit_id`, and `decision`, plus the existing organization and idempotency fields. Acting unit is an explicit validated and audited context; a browser-selected unit is not implicit authority.

Live reviewer/account/membership/unit/role/authorization, verification, attestation, grant/risk-gate, scope/version, source and candidate conditions are checked before receipt replay and again before an approval transaction can commit. Expired/revoked/missing/mismatched authority refuses atomically. Publication eligibility repeats the live authorization and exact-state checks. Author/reviewer separation remains mandatory even for a fully authorized author.

## Exact state and audit

`review_state_snapshots` stores an immutable SHA-256 digest of the candidate, authoritative source/detail revisions and workflow state, complete structured impacts, linked source state, contract hash/version, policy, scope/version and governed source version. It also retains an allowlisted vector of exact impact IDs, source record IDs and revisions. Any relevant change requires a new candidate/review cycle; caller-supplied current revision numbers cannot revive a stale candidate. No prohibited plaintext is stored in the snapshot.

Review audit evidence records author/reviewer tokens, decision, report/source/detail/candidate revisions, base and reviewer policy versions, authorization and acting-unit IDs, state digest, impact revision vector and server timestamp. Withdrawal still removes eligibility without review. Corrections require fresh review.

## Security and local certification

Both new tables use forced RLS and exact command-owner privileges, with no direct browser/service-role grants. Snapshots are append-only; grants cannot be rewritten or deleted and may only be revoked. All helpers are owned by the existing NOLOGIN/BYPASSRLS command owner; no additional postgres Auth bridge or owner schema-creation privilege remains. Existing identity/session helpers, fresh-TOTP and offboarding controls are preserved.

Run the existing `run-certification.ps1 -ReviewOnly` for the focused review run with shared prerequisites, then `run-certification.ps1` for all relevant Phase 29 tests. CLI commands remain guarded to an unlinked TEMP project, and SQL runs through the existing disposable Docker/psql harness. New evidence goes to `review-authority-focused` and `review-authority-final` beneath the Phase 29 evidence directory; earlier frozen reports are retained.

All participants and grants in certification are synthetic. Actual reviewer appointments, minimum two trained reviewers per unit, authority/governance evidence and real activation remain owner decisions. Publishing stays disabled. No production, consumer, store, deployment, merge or push action is included.
