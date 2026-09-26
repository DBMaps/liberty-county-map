# LP244.56 production read-only checkpoint

Observed September 25, 2026, 23:53–23:56 UTC. **Production reporting activation: NO-GO.** This is a fresh, bounded read-only database checkpoint. It finds no drift in the checked migration, admission, count, or access contracts, but cleanup scheduling is absent and retention health is stale. It does not authorize a production operation or release.

## Evidence labels and source proof

- **VERIFIED FROM CURRENT REPOSITORY:** The registered local checkout is `C:\GitHub\liberty-county-map`, remote `https://github.com/DBMaps/liberty-county-map.git`, branch `LP244.56-production-read-only-checkpoint`. Starting HEAD was `dcc0648ee05e023f07999db3908a7ad35ddf3345`; `git status --short` was empty before this task. The initial projectless Codex directory was not a Git repository. This run used the registered checkout, not a Codex Online `work` branch. A cloud checkout named `work` or without local `origin/main` would not, by itself, be source drift.
- **VERIFIED FROM CURRENT REPOSITORY:** The migration directory contains exactly the 16 versions below, with no newer tracked migration. Canonical-LF SHA-256 values match LP244.55: atomic transition `b2d0b75d0796033428160cae582db0c943459c3141e02a2566bf0978baff8dd8`; availability `846fdf9f019e680135b8fe45d444271ca46ded1e867d3e93895af103ef848063`; compliance `dcea12bbbe2c51df822a5b49970499c1d74d0f66e796b25c40dbdd15fcb756bf`. The compliance file's raw CRLF hash is `01d37b7ef8a7d4f1d2a2b53ef80ae76c0037e5327eca12596fd26dd723d4fdf4`, matching the LP244.36 deployed-byte record. LF comparison changes only CRLF to LF.
- **VERIFIED FROM HISTORICAL PRODUCTION EVIDENCE:** [LP244.23D](../LEGAL/LP24423D-PROTOCOL-V2-CLIENT-READINESS.md) records the consumed reset guard and first 14 migrations. [LP244.36](GRIDLY-LP24436-PRODUCTION-COMPLIANCE-CERTIFICATION.md) records the two later migrations, protocol 2, reporting disabled, bounded grants, and the September 9 retention success. [LP244.55](LP24455-PRODUCTION-LAUNCH-ACTIVATION-READINESS.md) reconciles these records. Those earlier observations were not used as today's production state.

## Access method and read-only boundary

The connected Supabase project's read-only listing and SQL query tools were used for project metadata, migration listing, and **SELECT-only** catalog, status, count, and health queries. The selected project is `Gridly Platform`, reference `nhwhkbkludzkuyxmkkcj`, region `us-east-1`, and its non-secret host/reference matches LP244.36 and the guard row's `project_ref`. No credentials, DB URL, private row contents, identifiers, tokens, coordinates, or report text were requested or recorded. The only application function called was `public.get_community_reporting_status()`, whose current `STABLE` definition hash matches LP244.36; no writer or cleanup RPC was called. No SQL mutation, Supabase migration command, Cron activation, deployment, dependency installation, native build, or merge occurred. Separate SQL SELECT calls are observations over a short interval, not one atomic database snapshot.

## Repository migration inventory and fresh production ledger

**VERIFIED FROM CURRENT REPOSITORY / VERIFIED FROM FRESH PRODUCTION EVIDENCE:** Supabase migration listing returned each version once. A direct ledger aggregate returned 16 rows, 16 distinct versions, zero unexpected versions, zero newer rows, and latest `20260916183911`. Thus all expected versions are present, with none absent or duplicate.

`202606070001`, `202606110001`, `202606160001`, `202606160002`, `202606170410`, `202606170411`, `202606170425`, `202606170426`, `202607280100`, `202607290100`, `202607290200`, `202609080001`, `202609080002`, `20260908200554`, `202609160001`, `20260916183911`.

The ledger establishes recorded application of migrations, not byte-for-byte equality of every live schema object. The launch-critical catalog and grants below were checked separately.

## Fresh protocol, admission, guard, and inventory

**VERIFIED FROM FRESH PRODUCTION EVIDENCE** at `2026-09-25 23:53:48 UTC`: one admission row, `protocol_version=2`, `reporting_enabled=false`, `changed_at=2026-09-09 16:13:48.113011 UTC`; one prelaunch guard row, `status=consumed`, `consumed_at=2026-09-09 16:13:47.849122 UTC`, `launched_at=NULL`, migration ID `20260908200554`, expected project reference. A separate call to the current read-only status RPC returned the same three admission fields. Its live definition MD5 was `e8dfa42f1b9f69627d20fee71203cb59`, the LP244.36 hash. The source client exports protocol 2, uses only the three community writer RPCs for report writes, and gates availability through the status RPC; source and a local contract test cannot prove deployed client versions.

**VERIFIED FROM FRESH PRODUCTION EVIDENCE** at `23:54:10 UTC`, counts only:

| Inventory | Count |
| --- | ---: |
| Reports / currently visible reports | 0 / 0 |
| Legacy historical events / writer monitoring events / legacy retention runs | 0 / 0 / 0 |
| Monthly aggregate rows / private device links / observation receipts / replay evidence | 0 / 0 / 0 / 0 |
| Moderation complaints / open-or-reviewing queue / action log / source suppressions | 0 / 0 / 0 / 0 |
| Deletion requests / verified queue | 0 / 0 |
| Earlier reset revocation ledger entries | 1 |

The zero counts are current data observations, not proof that future cleanup will operate.

## Fresh RLS, grants, and compliance objects

**VERIFIED FROM FRESH PRODUCTION EVIDENCE:** `public.reports` has RLS enabled. `anon` and `authenticated` have neither table-level nor any column-level direct INSERT. `anon` has bounded column SELECT (`id` allowed; private `device_id` and `moderation_state` denied), not table-wide SELECT. Two restrictive SELECT policies for `anon` and `authenticated` require both retention-current clocks and `moderation_state='visible'`. All 12 checked private report, history, guard, moderation, and deletion tables have RLS enabled and no effective SELECT/INSERT/UPDATE/DELETE table privilege for either client role. The three protocol writer RPCs remain executable to those roles; their current definition MD5s match LP244.36. The status RPC remains executable to those roles. The public moderation/deletion wrappers exist and are callable; owner action, deletion completion, and compliance cleanup functions have no `anon`/`authenticated` execute privilege. This is a launch-critical contract check, not a broad security audit. A fresh unauthenticated HTTP Data API schema-exposure probe was not made; LP244.36 contains the earlier production exposure check.

**VERIFIED FROM FRESH PRODUCTION EVIDENCE:** The four moderation/deletion evidence tables exist with RLS. Required action-log immutability and source-suppression triggers (three checked names) exist. `public.reports.moderation_state` is non-null with default `visible`. The moderation and deletion wrappers and owner cleanup functions exist. Admission remains disabled, so compliance installation did not unintentionally activate reporting. At `23:56:11 UTC`, bounded expired suppression, complaint linkage/action/complaint, deletion linkage/request, and older-than-24-hour open case counts were all zero. Case-response staffing and external request channels are **NOT CURRENTLY VERIFIED**.

## Cron, cleanup, and retention health

**VERIFIED FROM FRESH PRODUCTION EVIDENCE:** `pg_cron` is absent; `cron.job` and `cron.job_run_details` catalogs are absent. Therefore no in-database Gridly Cron schedule or bounded Cron run history exists to inspect. No external scheduler or independent alert route has been certified. The repository's [activation SQL](../../supabase/retention/activate-community-report-retention.sql) is an owner procedure and was not run. The deletion [runbook](GRIDLY-DATA-DELETION-RUNBOOK.md) also requires scheduled compliance cleanup; no such schedule was evidenced here.

**Retention health: STALE.** At `23:55:56 UTC`, the view showed `last_status=succeeded`, `last_success_at=2026-09-09 16:13:47.953099 UTC`, 1,410,129 seconds since success, one total run, zero failed runs, zero overdue reports, and zero breached linkage deadlines. The insert guard in `20260908200554` requires a successful cleanup in the preceding five minutes. A historical success is therefore insufficient for reporting admission even with no current overdue rows. Compliance cleanup has no separate run ledger in the checked schema; its current execution and alert delivery are **NOT CURRENTLY VERIFIED**. The zero due-row counts reflect empty tables, not operational readiness.

## Drift classification and launch decision

| Area | Classification | Fresh finding and launch impact |
| --- | --- | --- |
| Migration ledger | **NO DRIFT** | Exact 16 expected versions, each once; no unexpected/newer version. |
| Protocol/admission/guard | **NO DRIFT** | Protocol 2, reporting false, consumed/unlaunched guard; public read-only status agrees. |
| Report and evidence counts | **NO DRIFT observed** | All checked counts remain zero; ordinary future data changes would be **EXPECTED DATA CHANGE**, not automatically drift. |
| Launch-critical RLS/grants | **NO DRIFT observed** | Direct report INSERT denied and checked private tables inaccessible to client roles. |
| Cron and retention | **OPERATIONAL GAP** | `pg_cron` absent and last retention success far outside five minutes; reporting cleanup readiness fails. |
| Compliance scheduling and alerting | **UNKNOWN — NEEDS OWNER EVIDENCE** | Objects exist, but no scheduled cleanup, case operators, or independent alert delivery was proved. |
| Other provider/deployment state | **UNKNOWN — NEEDS OWNER EVIDENCE** | Backup/PITR, controlled-copy/log expiry, legal approval/publication, distributed client mix, and public HTTP Data API exposure were not freshly checked here. |

No **MIGRATION DRIFT**, **SECURITY DRIFT**, or **REPORTING-STATE DRIFT** was found within the bounded checks. There is no authority to repair the operational gap in this phase. Any later Cron/monitor activation requires a separately reviewed owner operation, followed by fresh read-only certification.

**Production schema integrity:** verified for the ledger and checked launch-critical objects; a complete schema diff was outside scope. **Reporting activation readiness:** **NO-GO**; admission is intentionally off and cleanup freshness is failing. **Operational cleanup readiness:** **NO-GO** until scheduling and independent alerting are established and observed. **Security contract:** checked grant/RLS boundary matches the recorded launch contract; public HTTP exposure and broader security posture need their own evidence. **Next launch gate:** owner/operator closes backup and controlled-copy evidence, cleanup schedules with independent alert delivery, moderation/privacy staffing, and legal publication/client distribution gates; then a fresh read-only health and state check precedes a separately authorized owner release.

## Owner/dashboard evidence still required

**OWNER READ-ONLY ACTION REQUIRED:** Preserve dated Supabase Backups/PITR configuration and a controlled inventory of WAL, logs, replicas, exports, and restore restrictions; verify provider and Gridly copy horizons without exposing data. Show the actual report and compliance scheduler configuration plus independent alert delivery and recent successful runs after a separately authorized activation. Identify moderation/privacy operators and case-response coverage. Provide approval record and live reachable legal/policy URLs, distributed client version/cache evidence, and, if needed, a bounded external HTTP check of the public status RPC and Data API schema exposure. Do not paste credentials or customer data into this record. These operational and publication facts cannot be certified by the SQL checkpoint alone.

LP244.54 physical iPhone acceptance remains **CLOSED/PASS** and was not reopened. The old LP244.22 reset, repair, push, and guard-authorization sequence is historical and **was not replayed**; its consumed guard must not be reused. No production state was changed in this checkpoint.

## Verification

`node --test --test-concurrency=1 tests/lp24421-launch-contracts.test.mjs`: **2/2 passed**. Database fixture suites and native staging tests were not run because they do not materially strengthen this live read-only checkpoint. `git diff --check` and final Git status/commit identity are recorded by the completing task after this document is placed in the checkout.
