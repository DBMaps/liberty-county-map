# LP244.23B owner-review correction: two export levels

September 9, 2026. This supplements the [managed-role decision](LP24423B-MANAGED-ROLE-OWNER-EXPORT-DECISION.md). The owner accepted the local role repair conditionally on the proposed production diagnostic. No production access, extraction, mutation, authorization change, role change, policy publication, deployment, Cron activation or reporting release occurred in this correction. All changes remain unstaged/uncommitted.

## Invocation and storage boundary

Level 1 remains the default redacted analytics export, with unchanged fields/validation/output contract:

```powershell
node tools/retention/owner-export.mjs --confirm-project nhwhkbkludzkuyxmkkcj --from 2026-09-01 --to 2026-10-01
```

Level 2 is a separate, explicitly requested owner archive:

```powershell
node tools/retention/owner-archive.mjs --level-2 --confirm-project nhwhkbkludzkuyxmkkcj --from 2026-09-01 --to 2026-10-01 --confirm-owner-storage --confirm-first-party-content
```

Credentials are supplied through libpq environment/secure password tooling, never arguments or files in Git. Both interfaces require the exact project direct hostname, postgres database/owner, verify-full TLS and port 5432; they reject alternate service/host-address targets. Level 2 additionally requires a separately stored, cryptographically random 32-byte AES key supplied as 64 hexadecimal characters through the secure `GRIDLY_ARCHIVE_KEY` environment variable. The key is never written into the archive, manifest, command arguments, logs or child database environment. Losing the key loses access; keep it separately under owner control. No password or encryption key is generated/displayed by these commands.

Before invoking Level 2, provision `owner-local/archives` locally, owned by the current Windows user, with FullControl for that user and optional SYSTEM only. Remove broader allow entries, including inherited group entries. Use an owner-approved Windows security setup; the exporter does not silently modify permissions. The read-only PowerShell probe uses Windows ACL APIs to verify the parent before reading data, the new directory before writing encrypted content, and the directory again before completion. It rejects UNC/network locations, reparse points in any ancestor, different ownership, unknown/broad allow entries and missing owner FullControl. Errors or unavailable verification fail closed. The probe returns booleans only, not owner/SID/path details. Tests exercise both actual restrictive and broad Windows ACLs.

All Level 2 dataset files **and the manifest** are AES-256-GCM encrypted before bytes reach disk. The only unencrypted artifacts are generic dataset filenames, INCOMPLETE, or a COMPLETE marker with the encrypted manifest hash. There is no plaintext staging copy. Folder/volume encryption such as BitLocker is optional defense in depth, not an unverifiable checkbox replacing content encryption. POSIX mode flags are not treated as proof of Windows privacy.

## Scope and data meaning

Report and feedback records retain stable first-party UUIDs. Reports also have archive_ref; live receipt rows use report_ref with the same value. These references are HMAC-SHA256 over report identity using an independent random key for each archive, held only in memory and discarded. They preserve record relationships without raw device/installation identifiers, token digests or an actor/device-grouping table. Since report UUIDs are deliberately retained, this is a restricted identifiable archive, **not anonymous data**; pseudonymous reference keys do not hide stable UUIDs or promise unlinkability of the records themselves.

Reports contain their current stored submitted/edited content and current classification, confidence and status. Expiry is not a clearing timestamp. Gridly currently overwrites confirm/edit/clear state and does not store a complete transition log, prior versions or independent transition timestamps. None are invented. Legacy history_capture envelopes are reset/closed and must be empty; neither level exports them or reconstructs erased associations. The durable historical dataset is the de-linked month/family/count table.

Only source=user reports enter either level. Date bounds are UTC [from,to); reports must remain before day-149 cleanup and day-180 linkage deadlines. Feedback uses created_at. Receipts are limited to those same eligible reports. Month counts cover overlapping months without prorating. Health and protocol are snapshot-wide; retention-run history remains limited by existing database retention. Raw provider/cache/address-registry datasets and Supabase Auth/Storage internals are never queried for export. Gridly-generated operational data and security/control summaries are identified separately in the manifest classification map. Report/feedback provenance marks submitted fields; timestamps, current status/markers and cleanup clocks are operational fields, as explained by the data dictionary.

## Exact field allowlists

The generated tables below are the exact dataset keys, in serialization order. The encrypted Level 2 manifest embeds descriptions for every field. No additional table columns are serialized automatically.

### Level 1

| Dataset | Fields |
| --- | --- |
| reports | submitted_at, expires_at, cleanup_after, linkage_deadline, county_id, condition_family, report_type, severity, status, confirmation_received, provenance |
| history | submission_month, condition_family, report_count |
| retention_runs | started_at, completed_at, status, deleted_reports, error_code |
| health | last_success_at, overdue_cleanup_count, breached_deadline_count, last_status |
| feedback | created_at, status, county_id, provenance |
| protocol | protocol_version, reporting_enabled, replay_evidence_count, live_receipt_count |
| reset_compliance | status, consumed_at, deleted_reports, deleted_historical_events, deleted_writer_events, deleted_retention_runs |

### Level 2

| Dataset | Fields |
| --- | --- |
| reports | id, archive_ref, created_at, original_submitted_at, expires_at, cleanup_after, linkage_deadline, crossing_id, crossing_name, railroad, lat, lng, county_id, state, report_type, severity, detail, source, confidence, status, provenance |
| history | submission_month, condition_family, report_count |
| retention_runs | started_at, completed_at, status, deleted_reports, error_code |
| health | last_success_at, overdue_cleanup_count, breached_deadline_count, last_status |
| feedback | id, created_at, category, message, awareness_area, platform, gridly_version, county_id, state, status, provenance |
| protocol | protocol_version, reporting_enabled, replay_evidence_count, live_receipt_count |
| reset_compliance | status, consumed_at, deleted_reports, deleted_historical_events, deleted_writer_events, deleted_retention_runs |
| receipts | report_ref, original_submitted_at, first_accepted_at, provenance |

## Exact exclusions and content validation

Both levels exclude raw device IDs, installation IDs, device hashes/groupings, credentials, access/refresh tokens, plaintext submission/operation tokens, passwords/password hashes, authorization UUIDs/digests, encryption/HMAC keys, other cryptographic secrets, replay token digests, raw legacy JSON envelopes and arbitrary operational error messages. Neither selects Auth/Storage internals, geocode provider responses/caches, provider state, Texas address points/boundaries, rural-address registries or other licensed provider datasets. Feedback page_url and user_agent are excluded (including URLs containing query tokens and fingerprint metadata). No device IP/fingerprint field is introduced.

Level 1 additionally excludes stable record IDs, crossing identifiers/names, railroad, precise coordinates, free-text report/feedback content, raw county strings outside its registry and live receipt records. Its existing strict redaction remains intact.

Level 2 includes first-party free text intentionally. Before content rows are exported, SQL checks selected content for known live device values and the current authorization UUID entirely inside the database; contamination refuses the archive without exporting those identifiers. Local validation refuses unexpected keys, invalid coordinates/timestamps/provenance, known environment-secret values, labeled passwords/tokens/keys, bearer tokens, JWTs, private-key material, common key formats, credential-bearing URLs, UUIDs embedded in free text, long hex secrets and labeled device/installation IDs. It fails the entire archive; it does not silently rewrite user content or publish a partial manifest. Stable UUID columns are separately validated and allowed.

**Boundary of the proof:** an arbitrary unlabeled secret or copied licensed prose cannot be recognized perfectly from text alone. Source filtering and automated checks prove the tested field/source/pattern boundaries, not universal semantic classification. `--confirm-first-party-content` explicitly attests that the selected user content is authorized first-party material and contains no unrecognized secrets or restricted third-party content. Do not use this flag without that review. This is necessary to preserve useful free text honestly; the tool does not claim an omniscient secret/license detector. Failed validation leaves no valid manifest and requires owner review, not relaxed checks.

## Read-only, integrity, completion and access

Both tools use the same repository-owned snapshot transport: one repeatable-read READ ONLY transaction, pg_catalog search path, UTC, timeouts and psql FETCH_COUNT=500 streaming. The child connection also sets default_transaction_read_only. There are no export functions/views/RPCs or grants to public/anon/authenticated/service_role. Tests show an injected DELETE is refused and clocks/data remain unchanged. This prevents writes through the generated tool; it does not purport to stop an administrator intentionally using other software to override database protections.

Every dataset has an expected row count, an ordered field list, ciphertext SHA-256 and plaintext-content SHA-256 inside the encrypted manifest. It also records the export schema, UTC generation/range, source migration versions, classification, data dictionary, encryption format, storage-check booleans and deletion deadline. JSON key order and row ordering are deterministic. Random per-archive references and encryption nonces intentionally make separately created ciphertext archives differ; deterministic means stable serialization/counts and verifiable hashes of the actual archive, not nonce/key reuse to force byte-identical encrypted outputs.

Files use `GRIDLYA1` (8 bytes), 12-byte GCM nonce, ciphertext, then 16-byte authentication tag. `decryptArchiveBytes` supports owner-controlled in-memory analysis without writing plaintext. `readArchiveManifest` first requires COMPLETE, absence of INCOMPLETE, the correct encrypted manifest hash, a valid GCM tag, compatible schema and an unexpired deadline. Then verify each selected dataset's encrypted and content hashes against that manifest before analysis. The in-memory byte helper requires enough memory for the selected file; export itself streams. Never print decrypted content into shared logs or persist it outside equally protected storage.

INCOMPLETE is created as soon as a new output directory exists. Validation/truncation/SQL/encryption/ACL failures cannot publish COMPLETE; no manifest is valid while INCOMPLETE remains. A parent-storage/key/argument preflight refusal reads no database content and creates no archive; an unsafe path is not used merely to leave a marker. There are no uploads, emails, public endpoints, periodic exports, automatic backup copies or automatic retention jobs.

The deletion deadline is the earlier of 30 days from generation and the earliest exported report cleanup/deadline. No export alters a database clock, keeps a live device association, adds linkage to historical aggregates or reconstructs a deleted receipt. Owner must delete the archive and any copies by that deadline; automatic file destruction is not claimed. The manifest reader refuses expired archives. This archive is **not a database backup, restoration witness, complete replay ledger or authorization to reconnect a restore**. Existing recovery certification and its independent continuity witness remain mandatory.

## Diagnostic transaction and cleanup proof

The diagnostic proposal remains separate from every transition/export command. Use only a separately approved dedicated, noninteractive `psql -X -w -q -A -t -f` process. It generates a unique `gridly_diag_` + UUID-derived name, begins an explicit transaction, creates that NOLOGIN role with the original creation syntax, captures observed attributes and directed membership role/member/grantor with ADMIN/INHERIT/SET flags, then rolls back. Captures use psql variables rather than emitting intermediate result sets. The final statement returns one compact JSON result including the diagnostic role name and `rollback_verified`, which checks that the exact role no longer exists. The role is transaction-scoped; PostgreSQL has no TEMP ROLE keyword.

The real monitor and existing authorization are not referenced. There are no data writes, COMMIT statements, retries or production executions in this correction. ON_ERROR_STOP exits the dedicated process on the first error, closing the connection and rolling back any open transaction. Tests execute the proposal as a real non-superuser CREATEROLE fixture and verify the automatic membership direction/options/grantor, exact-name absence after normal rollback, and no remaining diagnostic role after an injected error before ROLLBACK. A failed attempt is not a successful observation and does not authorize retry; stop after one failure. Only a successful compact result with rollback_verified=true supports the next owner review.

## Tests and changed files

Final focused result: **19 tests passed, 0 failed, 0 skipped**, running `node --test --test-concurrency=1 tests/lp24423b-managed-export.test.cjs tests/lp24423a-production-batch.test.cjs`. The Windows ACL fixture required an approved run outside the sandbox because permission mutation on its synthetic temporary directory was blocked inside it. Initial fixture-only issues (Windows PowerShell module/SID construction and stripped test environment paths) were corrected; the production probe fails closed on any such problem. The tests use PostgreSQL 17.10/PostGIS 3.6.2 and synthetic local fixtures only. They retain Level 1 redaction checks and cover intended Level 2 fields/relationships, encrypted bytes/tag/key refusal, hashes/manifests/counts, provider exclusion, secret contamination, truncation/validation failure, post-cleanup de-linking, read-only refusal, explicit invocation, actual Windows ACLs, and diagnostic success/failure cleanup. No App/PWA or unrelated suite was rerun for this correction.

Correction changes: `tools/retention/owner-export.mjs` (shared snapshot assembly, unchanged Level 1 contract); `tools/retention/owner-archive.mjs` (new Level 2); `tools/retention/verify-owner-archive-storage.ps1` (new read-only Windows ACL probe); `tests/lp24423b-managed-export.test.cjs` (both levels/ACL/diagnostic tests); `supabase/retention/diagnose-managed-role.PROPOSAL.sql` (dedicated-session instructions and explicit diagnostic identity/deterministic membership order); this document and the earlier decision record cross-reference. Existing role, RLS, authorization, migration and rollback safeguards are unchanged by this correction. Existing `/owner-local/` Git ignore covers both levels.

**Ready to commit: yes, for owner-reviewed local implementation.** Node syntax and `git diff --check` pass. Ready-to-commit assessment is local only; the production diagnostic and any subsequent transition still require separate owner approval. No staging or commit is performed. Combined worktree inventory is six modified tracked files plus eight new files; the seven correction files above sit alongside the previously reviewed LP244.23B migration/control/recovery work. The required branch is unchanged and the index remains empty.

## Primary references

- [Supabase roles](https://supabase.com/docs/guides/database/postgres/roles) and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): database roles and row access remain distinct from exported data.
- [Microsoft Directory.GetAccessControl](https://learn.microsoft.com/en-us/dotnet/api/system.io.directory.getaccesscontrol?view=netframework-4.8.1): Windows directory ACL inspection used by the PowerShell probe.
- [Node crypto](https://nodejs.org/api/crypto.html): AES-GCM authenticated encryption and tag verification.
