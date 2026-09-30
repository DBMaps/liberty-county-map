# LP244.66 Window 2A — production entitlement cache migration result

**Observation:** September 28, 2026, approximately 00:35–01:03 UTC. **Verdict: WINDOW 2A CACHE MIGRATION PASS WITH FOLLOW-UP.** The owner-authorized cache migration `20260926205345` was the sole migration applied to Gridly production. The acknowledgment migration `20260927204849` remains unapplied. The follow-up is limited to two expected, information-level Supabase advisor notices described below. This result authorizes no later migration, deployment, scheduler, store purchase, paid admission or reporting activation.

## Source, target, approved scope and recovery

Branch `LP244.66-production-subscription-verification-admission`; starting HEAD `959471f03b24df61be336c1261c5213286debeab`. The initial Git status contained only the owner-created untracked CLI artifact previously identified in Window 1B. It was not read, staged, deleted or intentionally modified. No tracked file was changed before the operation. The cached Supabase CLI package used for the operation reports **2.118.0**; its existing Node entrypoint was used because the offline `npx --no-install` resolution had failed in Window 1B. No package was downloaded or added.

Binary Git blob SHA-256 before staging matched the owner's approved identities:

| Migration | Approved committed-byte SHA-256 | Scope |
| --- | --- | --- |
| `20260926205345_lp24462_store_entitlement_cache.sql` | `4ed076fe114e6d69b8104ea1e6de10c71031f7310d6a2bbbb2cd784158f24e6a` | **Applied only in Window 2A** |
| `20260927204849_lp24466_google_acknowledgment_queue.sql` | `53f9e93fbbf9f9acf831a8e301d8594a4b016f0fc1b25a227aead561c4125270` | **Not applied** |

The cache checkout has the previously documented CRLF representation: raw SHA-256 `dec74ae2a664358a0de2cbfa74a23db24ca04e3bdb53abfd9a84c11e350a1fba`; CRLF→LF only yields the approved committed hash. The acknowledgment checkout raw bytes already match its approved hash. Both identities were checked before staging and after restoration.

The authenticated CLI project lookup exited 0 and showed **Gridly Platform**, ref `nhwhkbkludzkuyxmkkcj`; the checkout's linked project ref matched. The read-only project metadata independently reported this project `ACTIVE_HEALTHY` in `us-east-1`. No credential storage, access token, password or connection string was inspected or printed.

The owner had verified scheduled physical backups, visible daily restore points for at least September 20–27, 2026, a Restore action, and PITR disabled. The owner accepted backup-based recovery for these additive database objects. Storage API objects are outside this database backup scope; this migration creates database objects only. No backup setting or restore action changed here.

## Fresh preflight and exact-one application

Fresh read-only production preflight before staging found **17 ledger rows / 17 unique expected versions**, with zero missing, unexpected or duplicate versions; both proposed versions were absent. Admission remained `protocol_version=2`, `reporting_enabled=false`. The matching-project launch guard was `consumed`, consumed timestamp present, `launched_at=NULL`. Only the two expected report-retention and compliance-cleanup Cron jobs appeared: both active, every minute, postgres-owned, current-database-targeted, with exact expected commands. The `subscription_ops` schema, cache table and two cache functions were absent.

An initial local PowerShell staging command stopped at an invalid `New-Item -LiteralPath` parameter **before** creating a holding directory, moving a migration file or invoking any database push. Git still showed only the owner's CLI artifact; the acknowledgment file remained at its original path. The corrected command then proceeded.

The corrected operation created a temporary holding directory outside the repository and moved **only** `20260927204849_lp24466_google_acknowledgment_queue.sql` out of `supabase/migrations`. It verified the cache file remained, the acknowledgment file was held with unchanged hash, and Git showed only the expected temporary acknowledgment deletion under `supabase/migrations`. The final linked `db push --dry-run --skip-vault` exited **0** and proposed **exactly one** file: `20260926205345_lp24462_store_entitlement_cache.sql`. No acknowledgment or unexpected migration was proposed. The command requested no seed or role inclusion, explicitly skipped Vault and used no history repair.

With the identical one-file staged migration set still in place, the owner-authorized linked `db push --skip-vault` exited **0** and named only `20260926205345_lp24462_store_entitlement_cache.sql`. The acknowledgment file was not restored until that push completed. A PowerShell `finally` block then restored it to its exact original path and removed the empty temporary holding directory. Both local files were present with unchanged approved identities; `git status --short -- supabase/migrations` was empty. No acknowledgment push, migration repair or rollback was run.

## Production postflight: ledger, objects and security

The fresh production ledger returned **18 rows / 18 distinct expected versions**, zero missing, unexpected or duplicate versions. Cache `20260926205345` appeared **exactly once**; acknowledgment `20260927204849` remained **absent**.

The cache migration's object inventory matched source:

| Object | Read-only postflight |
| --- | --- |
| `subscription_ops` | Present, postgres-owned; no nonowner schema ACL entry; anon, authenticated and service_role have no direct USAGE. |
| `subscription_ops.store_entitlements` | The sole private table, postgres-owned; **0 rows**; RLS enabled, no policies; no nonowner table ACL entry or direct client/service_role table SELECT/INSERT. |
| Table definition | All **13** expected columns; **13** expected primary-key/check constraints. Checks include platform/product/base-plan vocabulary, 64-hex fingerprint, entitlement-state consistency, verified period-end rules and `cache_expires_at = LEAST(last_verified_at + 10 minutes, current_period_end when present)`. |
| Indexes | Primary-key index `(platform, environment, chain_fingerprint)` and expiry index `(cache_expires_at)`; no extra private table, view, sequence or private-schema function appeared. |
| Public RPCs | Exactly `gridly_reconcile_store_entitlement(jsonb)` and `gridly_prune_store_entitlement_cache(integer)` were present, postgres-owned, `SECURITY DEFINER`, `search_path=""`. Explicit EXECUTE grantees have no unexpected role or PUBLIC and no grantable service_role grant. Anon/authenticated cannot execute; service_role can execute. Neither RPC was invoked during certification. |

The new table started empty, and the migration source creates the schema/table/index/functions without DML against preexisting application tables. No entitlement authority was minted by this migration. The ten-minute/verified-period ceiling is enforced by the table constraint; no synthetic production row was inserted. Public roles have no direct table write or RPC EXECUTE authority. No web/PWA/native runtime file, release asset or protected-admission behavior was changed in Window 2A.

Postflight admission remained `reporting_enabled=false`, protocol `2`; the matching-project guard remained `consumed` and unlaunched. The two existing cleanup jobs remained active every minute with expected owner, target and commands. No job name matching subscription, entitlement or Google was found, and the acknowledgment tables/functions remained absent.

## Advisors, rollback classification and next decision

Supported Supabase advisor checks found two **information-level** notices relevant to the new cache objects:

1. [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) on `subscription_ops.store_entitlements`. This is intentional for an owner-only private table with no direct nonowner grants; no client access was opened.
2. [Unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) for `store_entitlements_cache_expiry`. The table has zero rows and the future prune job is not activated. Reassess only after approved runtime/housekeeping use; no index change is authorized here.

Neither notice is a material security or performance defect at this empty, dormant stage. **Rollback classification: no rollback.** Source, ledger, object, RLS, grant and launch-state postflight passed. The reviewed rollback plan says to leave an inert cache schema in place if a later material certification defect appears, stop new admission/operations and seek separate approval for an exact rollback after dependency and data checks. This window authorizes no automatic drop or ledger repair.

**WINDOW 2A CACHE MIGRATION PASS WITH FOLLOW-UP.** The exact next owner decision is whether to authorize a separate **Window 2B acknowledgment migration** only after reviewing its approved hash/SQL, obtaining a fresh 18-version preflight and an acknowledgment-only linked dry run, and confirming this cache postflight remains stable. Do not infer acknowledgment approval from Window 2A. Do not deploy verifiers or operations, configure secrets, activate Cron/Cloudflare monitoring, run purchases, enable paid admission, or enable community reporting.
