# Gridly LP244.36 Production Compliance Certification

This record certifies the owner-authorized production deployment of only
`supabase/migrations/20260916183911_google_play_compliance_closure.sql`.
It contains no credentials, tokens, service keys, raw device identifiers, or report contents.

## 1. Deployment date/time

Deployment completed on 2026-09-17 at approximately 18:29 UTC. The bounded production sequence was:

- read-only preflight observed at `2026-09-17T18:27:35.567691Z`;
- Supabase CLI reported successful migration completion between preflight and postflight; and
- the complete read-only postflight snapshot was observed at `2026-09-17T18:32:57.828460Z`.

The Supabase migration ledger has no insertion-timestamp column, so the CLI completion is recorded as a bounded deployment window rather than false second-level precision.

## 2. Production project identity

| Field | Certified value |
|---|---|
| Project | Gridly Platform |
| Project reference | `nhwhkbkludzkuyxmkkcj` |
| Region | `us-east-1` |
| Status | `ACTIVE_HEALTHY` |
| Database host | `db.nhwhkbkludzkuyxmkkcj.supabase.co` |
| PostgreSQL | Engine 17, platform version `17.6.1.105`, server `17.6` |
| Data API | PostgREST `v14.5` |

Repository linkage (`supabase/.temp/project-ref` and `linked-project.json`), the project API, database host, and published application endpoint all resolved to the same project reference. No secret-bearing identity was displayed or recorded.

## 3. Migration filename

`supabase/migrations/20260916183911_google_play_compliance_closure.sql`

The file was deployed whole through `supabase db push`. It was not rewritten, split, or selectively pasted.

## 4. Migration SHA-256

```text
01D37B7EF8A7D4F1D2A2B53EF80AE76C0037E5327ECA12596FD26DD723D4FDF4
```

This matched the owner-authorized and LP244.35-certified hash. The migration file was not modified.

## 5. Preflight result

**PASS.** Main was clean and current at `0e708343`, whose lineage includes LP244.33 compliance closure, LP244.34 public legal site, LP244.34A 18+ alignment, and the certified migration inputs. The LP244.35 certification commit remained available at `ec19b1de` for an exact post-deployment readiness-test rerun.

The production preflight confirmed:

- PostgreSQL 17;
- all 15 local predecessor migrations matched the 15 remote ledger entries;
- the target was the only local migration absent remotely;
- `public.reports`, its required retention columns, RLS, `report_retention.device_links`, admission state, and retention health existed;
- `reporting_enabled=false` with protocol version 2;
- reports and device links both counted zero;
- both target schemas, `moderation_state`, and all target RPC/function names were absent;
- `anon`, `authenticated`, and `service_role` existed as non-login roles;
- `extensions.pgcrypto 1.3`, `postgis 3.3.7`, `uuid-ossp 1.1`, both `digest` overloads, and `gen_random_uuid()` were present; and
- private retention/history tables had no API-role grants.

`supabase db push --linked --dry-run --skip-vault` named exactly one file: `20260916183911_google_play_compliance_closure.sql`.

## 6. Exposed-schema verification

**PASS before and after deployment.** Read-only HTTPS requests to the actual production Data API used `Accept-Profile` for each schema:

| Requested schema | Before | After |
|---|---|---|
| `moderation` | HTTP 406, `PGRST106 Invalid schema` | HTTP 406, `PGRST106 Invalid schema` |
| `privacy_ops` | HTTP 406, `PGRST106 Invalid schema` | HTTP 406, `PGRST106 Invalid schema` |
| `public` control | Reached the exposed schema; nonexistent probe table returned `PGRST205` | Same |

Both private-schema responses stated: `Only the following schemas are exposed: public, graphql_public`. This matches the tracked `[api].schemas` configuration and proves the live production setting rather than inferring exposure from SQL grants.

## 7. Production deployment result

**SUCCESS.** Supabase CLI `2.117.0` connected through the repository's linked-project workflow and applied exactly:

```text
Applying migration 20260916183911_google_play_compliance_closure.sql...
Finished supabase db push.
```

Vault updates, roles, seeds, unrelated migrations, reporting enablement, and application deployment were excluded.

## 8. Migration ledger result

**PASS.** `supabase_migrations.schema_migrations` contains exactly one row:

```text
version: 20260916183911
name:    google_play_compliance_closure
count:   1
```

The stored statement set represents the complete certified migration. A fresh migration listing places this entry immediately after `202609160001_lp24429a_reporting_availability_contract`.

## 9. Schema result

**PASS.** `moderation` and `privacy_ops` now exist. `public.reports.moderation_state` exists as non-null text with default `'visible'` and the certified value constraint. The expected complaints, action log, source suppression, and deletion-request tables, indexes, triggers, and functions exist.

There were no production reports before deployment, so no row required backfill; postflight nevertheless proved the default and found zero non-visible rows.

## 10. RLS result

**PASS.** RLS remains enabled on `public.reports` and is enabled on:

- `moderation.complaints`;
- `moderation.action_log`;
- `moderation.source_suppressions`; and
- `privacy_ops.deletion_requests`.

Both `report_retention_read_boundary` and `moderation_public_visibility_boundary` exist as restrictive `SELECT` policies for `anon` and `authenticated`. Their predicates compose as retention-current **and** moderation-visible. Existing permissive policies were not changed.

## 11. Grants result

**PASS.** Catalog ACL inspection found no table or sequence privilege for `PUBLIC`, `anon`, `authenticated`, or `service_role` on objects in `moderation` or `privacy_ops`. No API role has a private report-column grant for `device_id`, `original_submitted_at`, `linkage_deadline`, `cleanup_after`, or `moderation_state`.

`moderation.apply_action`, `privacy_ops.complete_deletion_request`, and `moderation.run_compliance_cleanup` are not executable by any API role. `service_role` does not receive either public wrapper grant.

The post-deployment security advisor's RLS-without-policy notices on the new private tables are expected fail-closed defense-in-depth: the schemas are not Data API exposed, their tables have no API grants, and RLS has no allowing policy.

## 12. Public RPC result

**PASS.** Ordinary Data API clients have the two intended public entry points:

- `public.submit_community_moderation_report(text,uuid,text,text)` — execute for `anon` and `authenticated`;
- `public.request_community_report_deletion(text,uuid,text)` — execute for `anon` and `authenticated`.

The public wrappers are security invokers. Their bounded private implementations are reachable only because `anon` and `authenticated` receive the necessary function/schema privileges, while the implementation schemas remain unexposed.

Safe production probes ran inside a read-only transaction and created no evidence:

| Probe | Result |
|---|---|
| Invalid moderation request | `{"status":"invalid_request"}` |
| Missing moderation target | `{"status":"gone"}` |
| Invalid deletion request | `{"status":"invalid_request"}` |
| Missing deletion target | `{"status":"forbidden"}` |

No response returned a device identifier, internal complaint/deletion row, digest, note, or target contents.

## 13. Reporting enabled before

`false` — protocol version 2, `changed_at=2026-09-09T16:13:48.113011Z`.

## 14. Reporting enabled after

`false` — protocol version 2, with the same `changed_at` value. The migration did not change admission state, publish a report, alter app availability, or enable community reporting.

## 15. Report counts before/after

| Count | Before | After |
|---|---:|---:|
| Total reports | 0 | 0 |
| Retention-current reports | 0 | 0 |
| Not-expired reports | 0 | 0 |
| Visible reports | Not applicable before column | 0 |
| Non-visible reports | Not applicable before column | 0 |
| Device links | 0 | 0 |

The migration created no report and changed no report row.

## 16. Retention health before/after

| Field | Before | After |
|---|---|---|
| Last status | `succeeded` | `succeeded` |
| Last success | `2026-09-09T16:13:47.953099Z` | unchanged |
| Overdue cleanup count | 0 | 0 |
| Breached deadline count | 0 | 0 |

The production guard still contains the accepted 3,576-hour (149-day) cleanup and 4,320-hour (180-day) linkage constants. The retention trigger and cleanup function remain present, device-link deletion still cascades, and the public projection now also excludes hidden and cleanup-expired reports.

## 17. Writer hashes before/after

| Function | Before MD5 | After MD5 |
|---|---|---|
| `public.cancel_community_operation(text)` | `0fcaa36d41beebee7b39935098fd4ddf` | same |
| `public.get_community_reporting_status()` | `e8dfa42f1b9f69627d20fee71203cb59` | same |
| `public.mutate_community_observation(text,uuid,text,jsonb,text)` | `75ccf495e03ffc3d2e5efce1fc48ddb4` | same |
| `public.submit_community_observation(text,jsonb,text)` | `87cb55d3cf2dab858baef30d615645ff` | same |

Protocol-v2 writer definitions are byte-definition equivalent before and after deployment. Pending local-report behavior was also covered by the local reporting-availability/protocol regression suites.

## 18. Moderation row counts

Immediately after deployment and after all safe probes:

```text
moderation.complaints          0
moderation.action_log          0
moderation.source_suppressions 0
```

## 19. Deletion row counts

Immediately after deployment and after all safe probes:

```text
privacy_ops.deletion_requests 0
```

No production evidence row was inserted or deleted during certification.

## 20. Test results

- LP244.33 database, retention, protocol, and reporting-availability suite: **45/45 pass**.
- LP244.35 exact readiness suite from certified commit `ec19b1de`: **4/4 pass**.
- Android fast suite: **56/56 pass**.
- LP244.33 app/browser, native packaging, startup manifest, weather/KBYG, crossing popup, search/POI, and LP244.36 certification suite: **84/84 pass**.

All recorded suites completed with zero failures before this document was committed.

## 21. Anomalies

- The first local app aggregate exposed the already-known stale LP244.29A cache-name assertion on current main. Runtime authority was already LP244.33. The test-only expectation was corrected to `gridly-pwa-shell-lp24433-v1`; no runtime file or behavior changed.
- One read-only postflight catalog query required a corrected PostgreSQL internal `"char"` cast. The failed query made no change; the corrected query completed successfully.
- Security Advisor added four expected informational RLS-without-policy findings for deliberately inaccessible private tables.
- Performance Advisor reported two informational unindexed foreign keys on `moderation.action_log.complaint_id` and `moderation.source_suppressions.complaint_id`, plus expected unused new indexes. Cleanup deletes dependent evidence before complaints, all new tables are empty, and this is not a deployment correctness or privacy blocker. Index follow-up, if operational volume warrants it, requires a separate migration.
- Existing duplicate permissive-policy and public protocol-function advisor warnings were present before deployment and remain outside LP244.36 scope.

References: [Supabase database linter](https://supabase.com/docs/guides/database/database-linter) and [2026 Data API explicit-grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## 22. Rollback posture

No rollback is indicated. All deployment and certification gates passed.

Before the first complaint/deletion evidence, rollback could be implemented only as a later forward migration with an exclusive evidence-table lock and an abort guard requiring all four evidence tables to be empty. The migration ledger row must not be manually removed.

After evidence exists, schema drop is unsafe. Intake grants should first be revoked, hidden reports should remain hidden, and evidence must be preserved or aged out under the accepted retention policy. Reports already deleted through a verified request cannot be reconstructed. No rollback action was taken in this mission.

## 23. Final production state

Production now has the certified moderation/privacy schema, visibility boundary, bounded public complaint/deletion wrappers, owner-only action functions, source suppression, and compliance cleanup. Private schemas remain outside the Data API. All new evidence tables are empty. Reports and device links remain empty. Retention health is clean. Existing writer hashes are unchanged. Community reporting remains disabled.

## 24. Launch implications

This deployment prepares the backend compliance boundary only. It does not launch Gridly or change consumer availability.

- Google Play was not submitted or released.
- Apple App Store was not submitted or released.
- The final Android AAB was not rebuilt.
- Community reporting remains OFF.
- The approved 18+ launch posture remains authoritative.
- Consumer public launch did not occur.
- No web/runtime deployment, pricing change, Dispatch work, store upload, or branch merge occurred.

**Certification verdict: A. PRODUCTION COMPLIANCE DEPLOYED AND CERTIFIED.**
