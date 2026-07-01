# V375 — Historical Schema Dry-Run Execution Readiness Gate

## 1. Files Reviewed

V375 reviewed the current historical-schema dry-run planning chain and SQL draft artifacts listed below:

- `supabase/migrations/202606160001_add_historical_incident_tables_draft.sql` — V371 migration draft.
- `supabase/migrations/202606160002_rollback_historical_incident_tables_draft.sql` — V371 rollback draft.
- `GRIDLY-HISTORICAL-SCHEMA-MIGRATION-REVIEW-AND-SQL-SAFETY-AUDIT-V372.md` — SQL safety audit.
- `GRIDLY-HISTORICAL-SCHEMA-DRY-RUN-PLAN-V373.md` — dry-run plan.
- `GRIDLY-HISTORICAL-SCHEMA-DRY-RUN-CHECKLIST-REVIEW-V374.md` — checklist review.

V375 is a readiness gate only. No dry run was performed, no migration was applied, no Supabase command was run, no SQL was modified, and no application code was modified.

## 2. Readiness Inventory

A future isolated historical-schema dry-run execution can be planned only after all prerequisites below are present and explicitly recorded in the execution milestone:

- **Reviewed artifacts remain stable:** the migration and rollback SQL must match the V371/V372/V373/V374-reviewed artifacts, or every delta must receive a new SQL safety audit before execution planning continues.
- **Migration scope remains additive-only:** the migration must create only `public.historical_incidents`, `public.incident_events`, `public.incident_recurrence_index`, and indexes/policies/comments scoped to those new tables.
- **Rollback scope remains isolated:** rollback must drop only V371 historical policies and tables, must not touch `public.reports`, and must not touch any production table or application behavior.
- **No bundled application dependency exists:** no application code, feature flag, UI entry point, lifecycle processor, historical reader, historical writer, service-role job, edge function, scheduled job, trigger, or backfill may be bundled with the dry-run execution milestone.
- **Protected systems remain untouched:** future planning and execution must not modify `loadSharedReports()`, `activeHazards`, `getLiveHazardIncidents()`, `unifiedRoadIncidents`, `activeUnifiedIncidents`, `alerts`, `awareness`, `markers`, Route Watch, or DriveTexas.
- **Target environment is selected before execution:** the future execution record must name a non-production, isolated, disposable or rollback-safe environment before any command is run.
- **Operator and reviewer ownership is assigned:** the future execution record must identify the operator, reviewer, approver, and stop-authority by name or accountable role.
- **Evidence collection is prepared:** checksum, commit SHA, baseline schema, post-migration schema, RLS/policy, rollback, transcript, redaction, and evidence-storage processes must be ready before execution.
- **Secret handling is defined:** dry-run transcripts and evidence must redact secrets, database URLs, project tokens, service keys, and any other credentials before sharing or committing.
- **Stop conditions are agreed:** any unexpected production reference, schema drift, policy drift, warning, missing evidence, or environment ambiguity must stop the future dry-run execution as a NO-GO.

## 3. Evidence Inventory

The following evidence must exist before a future dry-run execution begins:

- Exact git commit SHA containing the reviewed migration, rollback, dry-run plan, checklist review, and V375 readiness gate.
- SHA-256 checksum for `supabase/migrations/202606160001_add_historical_incident_tables_draft.sql` captured immediately before dry-run execution.
- SHA-256 checksum for `supabase/migrations/202606160002_rollback_historical_incident_tables_draft.sql` captured immediately before dry-run execution.
- Confirmation that the migration SQL remains additive-only and has not added destructive statements, production-table changes, triggers, functions, data-copy statements, deletes, updates, truncates, or backfills.
- Confirmation that the rollback SQL remains scoped only to V371 historical objects.
- Audit chain references for V371, V372, V373, V374, and V375.
- App-isolation search records proving no application code depends on the historical tables at dry-run time.
- Protected-system isolation records proving the listed protected systems were not modified.
- Baseline schema evidence from the target dry-run environment before migration execution.
- Baseline policy/RLS/index/table evidence from the target dry-run environment before migration execution.
- Written target-environment identity, including environment name, project reference or local identifier, and explicit non-production classification.
- Written operator, reviewer, approver, and stop-authority assignments.
- Evidence-storage location and redaction procedure for dry-run transcripts and schema outputs.

The following evidence must be captured during or after the future dry-run execution for that later milestone to be considered successful:

- Command transcript showing execution against only the approved isolated environment.
- Post-migration schema evidence proving only V371 historical objects were added.
- RLS and policy evidence proving `anon` and `authenticated` roles have no historical read/write access.
- Existing production-object preservation evidence, including confirmation that `public.reports` and protected production paths were unchanged.
- Rollback rehearsal transcript and after-rollback evidence proving V371 historical objects were removed.
- Reviewer sign-off that all evidence is complete, redacted, and internally consistent.

## 4. Environment Requirements

A future dry-run environment must satisfy all requirements below:

- **Isolation:** the target must be non-production and isolated from production users, production workloads, production secrets, and production data dependencies.
- **Explicit identity:** the execution record must name the exact environment, project ref or local database identifier, database URL classification, and reason it is considered non-production.
- **Schema visibility:** the operator and reviewer must be able to inspect tables, indexes, policies, RLS status, and migration-state evidence before migration, after migration, and after rollback.
- **Rollback capability:** the environment must allow the V371 rollback draft to be rehearsed safely and must be disposable or restorable if rollback does not behave as expected.
- **No valuable data dependency:** the environment must not contain valuable user data unless a separate data-safety review approves that condition before execution.
- **No production secrets:** service keys, production URLs, production tokens, and production credentials must not be used.
- **Transcript control:** command output must be capturable for evidence while still allowing credential and secret redaction before sharing.
- **Operator access:** the operator must have sufficient privileges in the isolated environment to apply the draft migration, inspect schema/RLS/policies/indexes, rehearse rollback, and capture evidence.
- **Reviewer access:** the reviewer must have sufficient access to independently inspect or verify the evidence package without requiring production credentials.
- **Abort path:** if the target identity is ambiguous or any command appears pointed at production, execution must stop before running the migration.

## 5. Reviewer / Operator Requirements

### Reviewer Responsibilities

- Verify artifact identity, commit SHA, and SQL checksums before execution.
- Re-check that migration SQL is additive-only and rollback SQL is V371-object-only.
- Confirm the target environment is isolated and non-production.
- Confirm protected systems and application read/write paths remain unchanged.
- Review baseline, post-migration, RLS/policy, rollback, and final evidence.
- Confirm transcripts are redacted and complete enough for audit.
- Issue NO-GO if evidence is missing, inconsistent, ambiguous, or shows unexpected changes.

### Operator Responsibilities

- Execute only the approved future dry-run steps in the approved isolated environment.
- Verify environment identity immediately before any future migration command is run.
- Avoid production credentials, production project refs, and production database URLs.
- Capture pre-run, post-migration, and post-rollback evidence exactly as specified by the approved future execution milestone.
- Stop immediately if a command target, schema result, RLS result, rollback result, warning, or transcript differs from expectations.
- Do not improvise fixes during execution; unexpected findings must return to review as NO-GO.

### Approval Expectations

- Approval to plan a future isolated dry-run execution is not approval to execute it.
- Approval to execute a future isolated dry-run is not approval for production migration application.
- Any future execution milestone must explicitly approve its own non-production target and command sequence before running commands.
- Production application requires a later, separate production milestone with successful dry-run evidence, rollback evidence, security/RLS review, backup/observability planning, and explicit production approval.

## 6. Success Criteria

A future isolated dry-run execution would be successful only if all criteria below are met:

- The dry run targets only the approved isolated non-production environment.
- The executed migration SQL exactly matches the reviewed artifact, or any differences were separately audited and approved before execution.
- Only `public.historical_incidents`, `public.incident_events`, `public.incident_recurrence_index`, and their scoped indexes/policies/comments are added.
- No existing production table, including `public.reports`, is altered, dropped, indexed, backfilled, copied, truncated, updated, or deleted.
- No triggers, functions, jobs, edge functions, storage changes, auth changes, application code, historical reads, historical writes, history UI, or service-role writer behavior are introduced.
- RLS is enabled on all new historical tables.
- `anon` and `authenticated` roles have no historical read/write access.
- The rollback rehearsal removes only V371 historical objects.
- After rollback, the environment shows no remaining V371 historical tables or policies.
- Existing production-like objects in the isolated environment remain intact before, during, and after rollback.
- All evidence is captured, redacted, reviewed, and approved.

## 7. Failure Criteria

A future isolated dry-run execution must be considered failed or NO-GO if any condition below occurs:

- The target environment is production or cannot be conclusively proven non-production.
- Any command uses production credentials, production project refs, production database URLs, or production secrets.
- Migration SQL has changed from the reviewed artifact without a fresh safety review.
- Rollback SQL has changed from the reviewed artifact without a fresh safety review.
- Migration execution modifies `public.reports` or any existing production table.
- Migration execution creates triggers, functions, jobs, edge functions, auth changes, storage changes, data-copy logic, backfill behavior, or app dependencies.
- `anon` or `authenticated` roles receive historical read/write access.
- Rollback drops or modifies objects outside the V371 historical scope.
- Rollback leaves unexpected V371 historical objects behind.
- Protected systems are modified or evidence cannot prove they remained isolated.
- Evidence is missing, ambiguous, not redacted, internally inconsistent, or not reviewed.
- The operator must improvise schema fixes, manual cleanup, or unplanned commands to complete the run.

## 8. Remaining Risks

The remaining risks are planning, governance, and future-execution risks rather than immediate production risks because V375 does not perform a dry run and the V371 migration remains unapplied.

- **Premature execution risk:** a future operator could treat readiness documentation as permission to apply the migration. V375 explicitly rejects that interpretation.
- **Environment targeting risk:** future execution could accidentally target production if environment identity is not checked immediately before commands run.
- **Artifact drift risk:** migration or rollback SQL could change after V375. Any delta requires a new SQL safety review before dry-run execution planning proceeds.
- **Evidence quality risk:** missing checksums, transcripts, schema diffs, RLS evidence, rollback evidence, or reviewer sign-off would make a future dry run non-auditable.
- **Service-role risk:** client-deny RLS does not constrain a future service-role writer. Any service-role writer, job, edge function, or backfill remains separately unapproved.
- **Rollback timing risk:** rollback remains simple only while there are no historical reads, historical writes, UI dependencies, production integrations, or valuable historical data dependencies.
- **Data quality risk:** existing fake/test-generated reports must not be backfilled into history without separate cleanup, provenance, and data-quality approval.
- **Policy-name/idempotency risk:** future execution should verify no unexpected same-named policies exist on target historical tables before migration execution.

## 9. GO / NO-GO Recommendation

Recommendation: **GO to plan a future isolated historical-schema dry-run execution milestone only.**

Gridly possesses the documentation chain, reviewed draft SQL, rollback draft, safety audit, dry-run plan, checklist review, and readiness inventory necessary to safely plan a future isolated dry-run execution milestone.

This is **not** a GO to perform the dry run during V375. The future execution milestone must still define the exact isolated target, exact command sequence, operator, reviewer, stop-authority, evidence package, checksums, commit SHA, transcript-redaction process, and NO-GO handling before any command is run.

Production migration application remains **NO-GO** until after a later milestone provides successful isolated dry-run evidence, successful rollback rehearsal evidence, security/RLS verification, production backup and observability planning, operator approval, and explicit production-application approval.

## 10. Explicit Non-Approval Statement

V375 does **NOT** approve:

- migration application
- production deployment
- historical reads
- historical writes
- history UI
- production integration
- Supabase command execution during V375
- schema changes during V375
- SQL changes during V375
- application code changes during V375
- service-role writers
- scheduled jobs
- edge functions
- backfills
- protected-system changes

V375 approves only this documentation-only readiness gate as evidence that Gridly is ready to plan a future isolated historical-schema dry-run execution milestone under separate approval.
