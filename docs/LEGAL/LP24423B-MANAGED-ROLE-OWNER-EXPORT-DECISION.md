# LP244.23B local decision record

**Owner-review correction:** The owner accepted the managed-role repair for continued local work, pending the production diagnostic. The approved Level 1 remains unchanged; a separately invoked encrypted Level 2 owner archive is now implemented. [Exact updated allowlists, exclusions, diagnostic proof and test results](LP24423B-OWNER-EXPORT-LEVELS.md) supersede this record's earlier decision not to create Level 2. No production or Git publication boundary changed.

Prepared September 9, 2026. Production remains untouched. No staging, commit, push, PR, client build, release, Cron activation, or policy publication is authorized here. Mobile Portrait and application assets are unchanged.

## 1. Preconditions and scope

Branch `LP244.23B-astra-managed-role-export-closure` began clean (index and worktree) at `3c6c2f63baca6ff21ac421fbebf92c90f7bd1f20`. Read-only `git ls-remote origin refs/heads/main` confirmed that exact remote main commit. Repair `543f94f72096d51caab2aab4c2e98fbb7aa25a9c` is an ancestor; LP244.20–24 ancestry is preserved. No subagents used.

## 2. Managed-role failure: proven mechanism and evidence limit

The old error was raised by the OR of six elevated attributes **or any membership with the monitor as either role or member**. It did not test inheritance, connection limit, config, object ownership, or object grants at that point. Therefore the error alone does not identify which predicate was true in production.

On PostgreSQL 17.10, a real **non-superuser CREATEROLE** fixture reproduces the failure: `CREATE ROLE ... NOLOGIN` automatically gives the creator ADMIN on the new role, with INHERIT FALSE and SET FALSE, granted by the bootstrap superuser. The new monitor is not a member of the creator. The previous local superuser fixture has no automatic membership and passes the old assertion. This is PostgreSQL behavior, not evidence that Supabase silently enabled elevated attributes. Supabase's `postgres` is an administrative non-superuser; supautils handles privileged managed operations. Ordinary DDL event triggers are not a demonstrated cause of this CREATE ROLE membership.

| Tested value | Original non-superuser fixture | Repaired fixture |
| --- | --- | --- |
| rolcanlogin, rolsuper, rolcreatedb, rolcreaterole | all false | all false |
| rolinherit | true | false |
| rolreplication, rolbypassrls | both false | both false |
| rolconnlimit | -1 | 0 |
| rolconfig | null | null; per-database settings also rejected |
| Membership | new role → creator; ADMIN=true, INHERIT=false, SET=false | only monitor → postgres, same flags, superuser grantor |
| Explicit application grants | none before grants | schema USAGE + health SELECT, neither grantable |
| Ownership | no owned objects required | any owned object rejected |
| PostgREST mapping | no authenticator grant created | no API-role membership permitted |

The local fixture also verifies effective database CONNECT=true, CREATE=false, TEMP=true and public-schema USAGE=true, CREATE=false. These are local values, not a production measurement.

PUBLIC privileges still exist in PostgreSQL: database CONNECT/TEMP and catalog/public-schema usage depend on cluster/database defaults; NOINHERIT does not remove PUBLIC. The repair does not claim to revoke all built-in function/catalog access. Private schemas/tables retain revocations and RLS. It adds checks against grant options, column grants and ownership; existing checks reject unrelated explicit schema/relation/function/database grants. The monitor gets no private source-table access. The existing owner-context health view exposes four aggregate fields only; making it invoker would require granting the monitor the source tables, so its private aggregate boundary is retained. No export view/function is added.

**Production individual attribute, membership, config and inherited-privilege values were not observed.** The automatic creator grant is a locally proven explanation consistent with the failure, not a fabricated production catalog snapshot. Exact production attribution remains conditional. `supabase/retention/diagnose-managed-role.PROPOSAL.sql` is one prepared diagnostic for separate approval: uniquely named NOLOGIN role, explicit transaction, catalog-only attribute/membership/privilege inspection, rollback, then one compact JSON result proving absence. It never names or changes the monitor or authorization. `attributes` describes the new role; memberships describe direction/options/grantor; database/schema fields are effective privileges; grant/ownership fields are counts; authenticator_can_set checks the JWT role-switch prerequisite. Config presence is reported without potentially sensitive config values. If execution fails, stop after that attempt and verify rollback/absence separately before proceeding. It has **not** been run in production.

## 3. Repair

Every required attribute is explicit: NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 0. Reused cluster roles must satisfy the same checks. Only the PostgreSQL automatic administrative edge to `postgres`, with a superuser grantor and no SET/INHERIT, is accepted. Membership in another role, API access, login/elevated attributes, role settings, owned objects, grantable health access and column grants all fail closed. No privilege is silently normalized on an incompatible pre-existing role.

Independent health observability remains required. The existing monitor checks staleness/failure/overdue/breach counts. Provisioning its external connection/notification channel is still a separately approved operational step; do not assume this NOLOGIN role can directly connect or that its ADMIN-only owner edge allows SET ROLE. Do not grant it to authenticator. Existing dedicated-login monitoring instructions require a separately reviewed provisioning grant after migration; this task does not provision that account.

## 4. Armed authorization sequence

The failed attempt's existing authorization remains armed and unconsumed in production. No full UUID is present in this record or generated SQL.

1. In a separately approved, count-only inspection, compare the **full** UUID privately with the owner's failed-attempt record, plus authorized_at, migration/project identity, status, null consumption/launch timestamps and the complete Gate 1 fingerprint (including 210 historical nonempty deviceId values). The redacted prefix/suffix alone is not proof. Match the recorded failure/rollback time; stop on any mismatch.
2. Review `revoke-failed-prelaunch-reset.PREPARED.sql`, deterministically generated from `renderRevocation`. Supply `gridly.failed_authorization_id` privately in that owner session, never via echoed arguments or a committed file. The script checks exact identity, owner, project/migration, absence of retention schema, report/history counts and armed state. It upgrades the old status constraints/guard under an exclusive lock and commits **revoked**, not consumed. No report/history row is changed.
3. A private, RLS-protected immutable revocation ledger stores the authorization digest, prior fingerprint without UUID, timestamp and fixed reason `failed deployment`. Ordinary/API/service roles cannot access it; update/delete/truncate are rejected. The singleton remains, so multiple armed records are impossible.
4. Verify revoked state and one new ledger entry without returning digest/UUID. The transition now rejects the revoked record. Reusing a revoked UUID, overwriting an armed record, changing the approved fingerprint, or changing a consumed/launched record is rejected.
5. Immediately before the separately approved future mutation, repeat full Gate 1, confirm protected counts 7/480/2, maintenance/drain, backup availability and exact source hashes. Create a fresh UUID. The bootstrap can re-arm only the revoked singleton with unchanged fingerprint and a new current authorization timestamp. No replacement is created in the disarm transaction. If the fingerprint changed, stop and obtain a separately reviewed authorization design; this tooling intentionally does not accommodate it automatically.
6. Run the exact assembled transition only under new owner approval. Success consumes the fresh record. Failure leaves that fresh authorization armed: revoke it through the same recorded process before any subsequent replacement. Never reuse an armed failed-attempt batch.

The prepared disarm script is a **control upgrade**, not a migration-history entry. It is separate from the six-version application transition and never part of blind db push. Failed disarm rolls back the control upgrade as well.

## 5. Recommended production payload

Keep the tested execution unit: separately approved revocation; immediately preceding fresh authorization transaction; then **one transaction** containing seven reconciliations and the six ordered execution candidates. The batch requires history exactly `202607280100`, records each successful effect once, and rolls back history, address DDL, report deletion, role creation and admission together. The two older retention files are no-op checkpoints, not two destructive transitions.

| Candidate | Why included / dependency |
| --- | --- |
| 202606110001 | Missing county/state columns on reports and feedback. Retention itself does not need them; owner export uses county_id. |
| 202607290100 | Missing private rural-address registry referenced by existing geocode code. No report-retention dependency. |
| 202607290200 | Missing Texas address/PostGIS foundation referenced by geocode code. No report-retention dependency. Precision repair unchanged. |
| 202609080001 | Superseded retention no-op checkpoint preserving repository sequence. |
| 202609080002 | Superseded protocol no-op checkpoint preserving repository sequence. |
| 20260908200554 | Guarded reset, retention, protocol-v2 admission in maintenance, private monitoring and old-writer closure. |

The address migrations **remain coupled deliberately**, not because PostgreSQL requires chronological execution. They can be separately reconciled only after their actual SQL succeeds; never mark absent effects applied. Splitting would leave partial address schema/history after a failed report transition and require a different certified baseline. For this empty/pre-launch reset, preserving the already tested atomic unit is smaller than redesigning history reconciliation. PostGIS 3.6.2 and the exact payload have been exercised locally. No address source rows are imported. No blind `supabase db push` is recommended. Existing earlier readiness push instructions are superseded by this exact-batch decision.

## 6. Owner export inventory and contract

`node tools/retention/owner-export.mjs --confirm-project nhwhkbkludzkuyxmkkcj --from 2026-09-01 --to 2026-10-01`

Owner runs this locally after the transition; **not run against production here**. Connection uses libpq environment/secure password file: PGHOST must equal the project's direct database hostname, PGUSER/PGDATABASE postgres, PGSSLMODE verify-full, default/5432 port. Service-file target overrides and PGHOSTADDR are rejected. PSQL path may come from GRIDLY_RETENTION_PSQL. No URI/password argument is accepted, no child stderr is exposed, no upload exists. A host without direct-database connectivity needs a separately reviewed pooler target implementation, not a disabled TLS check.

| Dataset | Exact Level 1 allowlist |
| --- | --- |
| reports | submitted_at, expires_at, cleanup_after, linkage_deadline, county_id, condition_family, report_type, severity, status, confirmation_received, provenance |
| history | submission_month, condition_family, report_count |
| retention_runs | started_at, completed_at, status, deleted_reports, error_code |
| health | last_success_at, overdue_cleanup_count, breached_deadline_count, last_status |
| feedback | created_at, status, county_id, provenance |
| protocol | protocol_version, reporting_enabled, replay_evidence_count, live_receipt_count |
| reset_compliance | status, consumed_at, deleted_reports, deleted_historical_events, deleted_writer_events, deleted_retention_runs |

County values must match the repository's Texas county registry; the manifest supplies canonical county name/FIPS/state for observed valid IDs. Missing counties stay null: no inferred Liberty County or fabricated community. Free-form canonical place names/precise location are omitted. Report classes/severity and operational statuses are bounded. Reports include first-party source=user only, within date bounds and before cleanup/deadline. Cleared status and current confirmation marker are available; independent clear/confirm event timestamps/counts are **not stored by the current protocol**, so none are invented. Expiry is not a clear timestamp. Unknown report classes become other.

The old history_capture event/envelope tables are reset and closed, not a safe historical export. Export refuses nonempty legacy history. The durable de-linked history actually available is monthly family/count data; it cannot supply individual locations/events. Months overlap the requested [from,to) range and are never prorated; other dated datasets use inclusive UTC from, exclusive UTC to. Health/protocol are snapshot-wide. Retention run detail is available only for its existing 30-day database window. Feedback is metadata only: category, message, awareness area, platform, version and URL are untrusted text and omitted rather than asserting automatic PII removal.

Private device_links and observation_receipts are operational linkage. replay_evidence is security-only; only counts leave in Level 1. reset_revocations is private control evidence, not analytics. Saved home/work/places, pending submission payloads and device preferences are local-device storage, with no server dataset identified for export. Rolled-back historical_incidents/incident_events/recurrence tables are not current datasets. Geocode cache includes provider responses and potentially private queries; provider-state records are provider-specific operational state. Rural verified addresses can mix owner-confirmed private residences with licensed/authoritative sources. Address points, boundaries and provider caches/registries are excluded from the default export; no license entitlement or redistribution right is inferred. No other first-party server table was identified in the relevant migration inventory.

**Explicit exclusions:** device IDs/hashes, installation IDs, report/receipt/crossing identifiers, submission tokens, replay digests, authorization UUIDs/digests, credentials/secrets/access tokens, IPs, user agents, fingerprints, free text/JSON envelopes, exact coordinates/private addresses, licensed/provider records. These are absent from SQL projections; field and bounded-value validation provides another boundary. No Level 2 is created: count/SQLSTATE/staleness diagnostics satisfy the identified operational needs without exporting security linkage.

## 7. Security, storage and retention proof

One repeatable-read READ ONLY transaction, pg_catalog search path, UTC and bounded timeouts selects only base-table projections. libpq also forces default_transaction_read_only; tests show writes fail. Psql FETCH_COUNT=500 bounds fetch batches; rows stream into deterministic JSONL files. Each dataset has an expected count and SHA-256; incomplete rows, malformed/extra fields, unexpected values, SQL failure or missing completion marker leave INCOMPLETE and no valid manifest. The manifest includes schema version, UTC generation/range, migration versions, repository transition hash (not a claim of observed database function-body equality), dictionary, county context, counts/fields/hashes and redaction profile. Runtime migration presence and empty legacy history are checked; recovery certification remains separate.

No database objects or new API grants are introduced for exports. RLS/private grants remain; ordinary roles cannot select private sources. The owner session has existing administrator access, constrained by this read-only tool. No claim is made to prevent an administrator deliberately bypassing controls.

Export never updates clocks, receipts, links or history. It omits linkage before cleanup and still contains only aggregates after cleanup. There is no import/restore operation or key with which to restore a deleted association. Existing restoration certification continues to reject extended clocks, missing receipts, legacy copies and incomplete replay evidence. An analytics manifest is **not** a recovery witness and cannot replace the complete ledger fingerprint. Existing recovery documents and policies remain proposed/unpublished; this owner-local redacted mechanism does not introduce new collection/sharing requiring a new policy promise.

Outputs go only under already Git-ignored `owner-local/exports`. Files must be kept in owner-only encrypted storage with appropriate Windows ACLs; POSIX mode flags alone do not enforce Windows access controls. The manifest sets deleteByUtc to 30 days and states deletion/storage rules. No automatic deletion of owner files is performed or claimed. Owner must delete those files and any copies/backups within that window; retain only separately reviewed anonymous aggregates if needed. This is a documented short-lived export, not an indefinite shadow database.

## 8. Verification, changes and decision

New focused tests cover real non-superuser creation, the exact automatic membership shape, stronger attributes, wrong/inbound/outbound memberships, grant options, column grants, ownership, health/private denial, old-constraint authorization upgrade, identity mismatch, disarm, replacement, single-use, export redaction, date bounds, stable counts/hashes, bounded psql streaming, read-only refusal, truncation, post-cleanup history and Git ignore. The existing exact-production-batch success test now includes the managed-owner membership. Full transition, forced rollback and single-use tests remain.

Broad focused run: **67 tests, 66 passed, 1 failed, 0 skipped**. The failure is `generated submission manifest binds current client, PWA authority and schema deterministically`: `App/PWA version authority drift`, expressly excluded by the owner. No application/PWA drift repair attempted. After final grant/ownership and old-constraint test additions, the exact-batch plus new suite passed **14/14**. After manifest county context/hash and local diagnostic coverage, the final new suite passed **11/11**, zero failures/skips. An initial new-test failure caused by CRLF-sensitive SQL extraction was fixed by normalizing line endings and asserting the extracted block exists. PostgreSQL reports 17.10; installed PostGIS reports 3.6.2. No production data was exported. Synthetic fixture artifacts remain in an isolated temporary directory.

Changes: atomic migration (monitor checks); authorization bootstrap (revocation/replace rules); batch helper (deterministic prepared revocation); generated prepared revocation SQL; diagnostic proposal SQL; owner-export Node tool; focused tests; exact-batch managed membership fixture; this decision record; readiness/recovery cross-references. Existing Git ignore already covers all owner output; no redundant ignore entry needed.

Final static checks passed: syntax for all four changed/new Node files, JSON manifest parsing/count/hash assertions, unchanged canonical address hash, current transition/documentation hash, generated disarm/source equality, Git-ignore coverage, and `git diff --check`. Credential-pattern scan of all 11 changed/new files returned zero matches. Final Git status: six modified tracked files, five untracked additions, zero staged entries; branch unchanged. These checks do not claim a comprehensive secret scanner or production schema inspection.

Canonical LF transition SHA-256: `b2d0b75d0796033428160cae582db0c943459c3141e02a2566bf0978baff8dd8`. The address precision migration hash remains `24a1655cdcf24fe21ee38ff0b22d9f4bf85f75cecaa612b53c2246ded818d163`.

**Decision:** ready for owner review of the local repair/export and its limitations. Focused local certification is distinct from global launch certification. Exact production role attribution is still unobserved; the narrowly proposed diagnostic requires separate approval before claiming another production attempt is supportable. Then revoke the armed authorization, revalidate the complete baseline/backups and approve fresh authorization plus the exact batch. Client drift, independent monitoring provisioning and all release gates remain outside this mission. No production attempt starts here. Changes remain unstaged and uncommitted on the required branch.

## Official evidence reviewed

- [PostgreSQL 17 role attributes](https://www.postgresql.org/docs/17/role-attributes.html): automatic non-superuser creator ADMIN grant, direction and flags; PUBLIC/inheritance distinction.
- [Supabase roles](https://supabase.com/docs/guides/database/postgres/roles): administrative/database roles, authenticator and service_role.
- [Supabase supautils primary repository](https://github.com/supabase/supautils): non-superuser privileged role and PostgreSQL 16+ CREATEROLE behavior.
- [Custom API roles](https://supabase.com/docs/guides/storage/schema/custom-roles): JWT role mapping requires authenticator role membership.
- [Functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas): execution, grants, invoker/definer and exposed schema controls are separate.
- [Cron](https://supabase.com/docs/guides/cron), [migration workflows](https://supabase.com/docs/guides/deployment/database-migrations): monitoring and migration execution guidance.
- [Breaking-change changelog](https://supabase.com/changelog?types=breaking-change): checked current changes; no evidence that a documented new custom-role elevation explains this error. The lightweight changelog.md fetch returned unsupported content type, so the official HTML changelog was used.
