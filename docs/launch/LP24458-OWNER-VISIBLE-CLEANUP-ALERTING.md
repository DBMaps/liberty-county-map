# LP244.58 owner-visible cleanup alerting closure

**Decision, September 25, 2026 (America/Chicago): alert detection is partial; owner-visible delivery is NO-GO.** The owner selected Resend as the email provider and confirmed there is no existing always-on runner. No provider account, secret, deployment, runner, database object, grant, Cron job, email, or production write was created in this phase. Reporting remains disabled. This document is the bounded architecture and authorization checkpoint; it is not a claim that an alert reached the owner.

## 1. Starting proof and inherited baseline

The local checkout was clean before work. `git branch --show-current` returned `LP244.58-owner-visible-cleanup-alerting`; `git rev-parse HEAD` and `git rev-parse origin/main` separately returned `00c444d6f405c1aa35b1f950e90f01899fbad310`; `git status --short` returned no entries. This task did not fetch, reset, merge, or push.

[LP244.55](LP24455-PRODUCTION-LAUNCH-ACTIVATION-READINESS.md) recorded the launch gates. [LP244.56](LP24456-PRODUCTION-READ-ONLY-CHECKPOINT.md) established a fresh read-only production baseline. [LP244.57](LP24457-CLEANUP-RETENTION-HEALTH-CLOSURE.md) records the separately authorized installation of `pg_cron` 1.6.4 and two once-per-minute cleanup schedules, subsequent healthy retention, and the absence of independent owner-visible alert delivery. The [retention specification](../LEGAL/LP24421-REPORT-RETENTION.md) requires an external monitor; the [recovery runbook](../LEGAL/LP24421-RECOVERY-RUNBOOK.md) does not authorize replay of the old reset. These records are historical; the observations below are new.

## 2. Fresh read-only production checkpoint before any alert work

The connected Supabase project list identified one active, healthy project, `Gridly Platform`, reference `nhwhkbkludzkuyxmkkcj`, region `us-east-1`. At **2026-09-26 00:31:25 UTC**, SELECT-only SQL returned:

| Contract | Fresh result |
| --- | --- |
| Migration ledger | 16 rows, 16 distinct versions. The migration listing contained the exact 16 LP244.56 versions, with none missing, duplicate, or newer. |
| Admission and guard | Protocol 2; `reporting_enabled=false`; guard `consumed`, `consumed_at` present, `launched_at` absent. |
| Cleanup jobs | Exactly two active jobs on `* * * * *`, run as `postgres` in `postgres`. The report and compliance names and command texts matched LP244.57. Both latest runs at 00:31 UTC were `succeeded`. |
| Retention health | `last_status=succeeded`, `last_success_at=00:31:00 UTC`, overdue count 0, breached deadline count 0: **HEALTHY** under the five-minute rule. |
| Bounded data counts | Reports 0; complaints 0; deletion requests 0. No row content, IDs, coordinates, device data, or tokens were read. |

At **00:32:30 UTC**, a separate SELECT-only access check found the existing `gridly_retention_monitor` role is `NOLOGIN`, has zero non-`postgres` login members, and can SELECT `report_retention.health`. It has no `USAGE` on the `cron` schema, so it cannot itself inspect compliance Cron history despite catalog-level table privileges. There is no deployed login/poller. `pg_net` and Vault are not installed. The production SQL and project-list tools were used only for metadata, counts, status, and catalog facts; no function that writes reports or runs cleanup was called. These separate observations are not an atomic snapshot.

A second SELECT-only checkpoint at **00:39:08 UTC** found the same 16 distinct migrations, protocol 2, disabled reporting, consumed/unlaunched guard, exactly two active every-minute jobs with latest `succeeded` runs at 00:39 UTC, and retention success at 00:39 UTC with zero overdue/breached counts. No production mutation occurred between checks.

## 3. Alert capability audit

| Option found | Capability and decision |
| --- | --- |
| `tools/retention/check-report-retention.mjs` | Existing read-only `psql` monitor uses `PGSSLMODE=verify-full`, a five-minute health predicate, safe JSON output, and exit 1 for unhealthy, missing config, query failure, or invalid result. It has no delivery adapter or installed scheduler. |
| Compliance cleanup | No dedicated health ledger or external checker. `cron.job_run_details` has status/time evidence, but the existing monitor role cannot access the `cron` schema. Independent compliance failure/staleness detection is **not implemented**. |
| Repository notification tooling | No operational email/webhook/Slack/Teams/SMS sender, owner destination, operational GitHub Actions workflow, or provider secret/config convention was found. `.github/workflows/capacitor-validation.yml` is native validation, not monitoring. Product weather/roadway alerts are unrelated. |
| Supabase Cron/Dashboard | [Cron records job runs and provides Dashboard history](https://supabase.com/docs/guides/cron). This exposes health to an operator; it does not prove direct email delivery or independent notification. Adding an alert as another database Cron job would depend on the scheduler being monitored. |
| Supabase Metrics/Grafana | [Metrics API](https://supabase.com/docs/guides/observability/metrics) is a metrics source; [Grafana Cloud integration](https://supabase.com/docs/guides/observability/metrics/grafana-cloud) requires another account/key and alert configuration and does not by itself expose these two application cleanup contracts. Not selected. |
| GitHub Actions schedule | Native workflow notifications depend on a scheduled workflow, which has a [minimum five-minute interval and may be delayed or dropped](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows). It cannot be the sole one-minute operational monitor for the five-minute retention gate. |
| Owner-selected Resend | Email transport, not a database monitor or runner. An owner account, verified sending domain, API key, and recipient must be configured outside Codex. No Resend account or credential is currently configured for this task. |

The unchanged local monitor was exercised with injected `psql` results: healthy, failed, stale, overdue, and query-error cases all returned the expected safe status/exit behavior. It suppresses `psql` stderr. Its SQL predicate also checks breached-deadline count. This proves only local retention detection logic, not production alert delivery or compliance detection.

## 4. Selected route and architecture for separate approval

**Selected destination:** owner-controlled Resend email. With no existing always-on host, the smallest plausible independent runner is a scheduled Cloudflare Worker at one-minute cadence, using Hyperdrive to connect to Supabase through a **new dedicated, read-only database login**. Cloudflare documents [one-minute Cron triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Supabase/Hyperdrive connectivity](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/), and [Free/Paid limits](https://developers.cloudflare.com/workers/platform/pricing/). The Free plan appears to include Worker Cron and Hyperdrive, but its 10 ms CPU limit must be measured; any upgrade or charge requires a further owner decision. This is a proposal, not a deployed or cost-certified service.

```text
Supabase read-only aggregate health + two bounded Cron statuses
  -> dedicated monitor login / verified TLS / Hyperdrive
  -> independent one-minute Cloudflare Worker classifier
  -> Resend API -> owner email
```

The Worker must not hold a Supabase service-role key, `postgres` login, report-row access, or writer permission. Before deployment, an owner-reviewed database projection must expose only the aggregate retention fields and the **two named** job statuses/times to a dedicated monitor role. The proposed projection does not measure separate compliance overdue counts; the compliance count fields are fixed to zero and mean **not applicable**, not proof that no moderation or deletion item is overdue. The current monitor role has no login or Cron schema usage; production cannot support this runner as-is. Any new role, projection, narrow grant, Hyperdrive binding, Worker, or secret is a **separate owner-authorized change**. No `anon` or `authenticated` grant or RLS change is proposed. Keep the 16-version ledger and existing cleanup schedules unchanged unless a later approved change explicitly revises that gate.

The Worker should alert on report cleanup failure, last-success age >=5 minutes, overdue/breached counts >0, missing/inactive/misconfigured cleanup job, non-success or stale latest Cron run for either job, and any query/parse/connection failure (`monitor_error`). It must inspect compliance cleanup directly, not infer success from report retention. A failed report function can leave Cron's job status `succeeded`; the retention health row remains authoritative for its result. On each healthy run, it should maintain a **Resend scheduled fallback email** for a bounded future time; if the Worker stops running, that pre-armed email is sent. [Resend supports schedule, update, and cancel](https://resend.com/blog/introducing-the-schedule-email-api). This missing-run mechanism needs a small durable ID store, a cold-start/re-arm procedure, and a staging proof before launch; it is not implemented. If schedule updates cannot be proven reliable, use an independently configured dead-man monitor under separate owner approval. Do not claim alert delivery GO from a Worker deployment alone.

## 5. Payload, security, and delivery proof contract

Only `environment=Gridly production`, `alert_type`, UTC observation time, cleanup system (`report retention` or `compliance cleanup`), state (`stale`, `failed`, `overdue`, `monitor_error`), last successful run time, bounded overdue/breached counts, and a safe SQLSTATE/category if available may leave the monitor. A synthetic test is explicitly labeled `TEST`. The email subject identifies Gridly production, system, and state. No report body or ID, coordinates, user/device ID, token, customer email, private database identifier, raw SQL, DB URL, API key, error text, or stack trace may be in the payload or logs. Destination address and API key live only in the approved provider/runner secret store and are never pasted into Codex.

Delivery must be deduplicated by state and use bounded reminders so a continuing outage cannot exhaust provider quota. The monitor must treat Resend non-2xx/invalid acceptance as delivery failure, preserve the pending fallback, and surface that failure through the independent watchdog. A Resend API acceptance or dashboard `sent` event is not proof of owner receipt. The owner must confirm a dated synthetic email in the intended inbox, with provider event evidence (accepted/delivered where available); no production cleanup state should be changed to generate it.

The safe test sequence after **separate approval and setup** is: fresh read-only baseline; inject `stale`, `failed`, `overdue`, and `monitor_error` fixtures into the monitor classifier only; send one labeled synthetic alert through Resend; verify owner inbox and provider event/time; prove the fallback by withholding a synthetic monitor tick in a nonproduction configuration; then repeat the production read-only admission, guard, two-job, ledger, retention, and compliance checks. Never disable or fail a production cleanup job for a test.

## 6. Authorization and changes made

The owner selected Resend and confirmed no existing always-on runner. The owner explicitly instructed this task to **stop before** creating any paid service, secret, deployment, Edge Function, scheduled external runner, or other production infrastructure without separate authorization. No credential value was requested or entered. The proposed next operation requires owner approval for: a Resend account/domain/sender and verified owner recipient; a Cloudflare Worker/Cron/Hyperdrive account and capacity tier; a dedicated database login and safe aggregate projection with narrowly reviewed monitor-only access; provider/runner secret entry **by the owner outside Codex**; and a real synthetic delivery test. Cloudflare would receive bounded operational status through the read-only connection; Resend would receive only the allowlisted email payload. Neither receives customer/report rows.

No production mutation or external send was performed. No service account, charge, SQL DDL, grant, function, Cron job, Edge Function, external schedule, or email exists as a result of LP244.58. The absence of a safe deployed monitor and credential path makes an actual owner-visible delivery test impossible in this phase. Do not treat this document as permission to create that infrastructure.

## 7. Before/after state, gates, and next evidence

| Gate | Before | After this task | Decision |
| --- | --- | --- | --- |
| Retention health | LP244.57 HEALTHY; 00:31 UTC HEALTHY | 00:39 UTC HEALTHY; no production write | Cleanup retention **GO** at observation time; keep monitoring |
| Compliance cleanup | LP244.57 scheduled/succeeding; 00:31 UTC succeeded | 00:39 UTC latest run `succeeded`; no independent alert checker | Cleanup operation **GO** at observation time; detection **NO-GO** |
| Reporting | Disabled at 00:31 UTC | `reporting_enabled=false` at 00:39 UTC; untouched | Activation **NO-GO** |
| Launch guard | Consumed/unlaunched at 00:31 UTC | Consumed/unlaunched at 00:39 UTC; untouched | No reset/release |
| Cron | Two active one-minute jobs at 00:31 UTC | Exactly two, both successful at 00:39 UTC; untouched | Scheduling **GO** |
| Migration ledger | 16 exact versions at 00:31 UTC | 16 unique, exact list at 00:39 UTC; untouched | No migration drift observed |
| Alert detection | Local retention monitor | Five local fixtures pass; compliance and missed-run path remain design-only | **NO-GO** for complete coverage |
| Owner-visible delivery | Absent | No account/runner/secret/send or receipt | **NO-GO** |
| Next launch phase | Operational/legal gates open | Resend/runner authorization and real delivery proof still required; LP244.55 backup/PITR, controlled-copy, staffing, legal/publication and distribution evidence remain | **NO-GO** |

The next owner checkpoint is a separately reviewed Resend and runner setup, least-privilege production access design, bounded implementation, and one dated synthetic owner-inbox proof. Recheck project identity, the 16-version ledger, disabled admission, consumed/unlaunched guard, exactly two active cleanup jobs, retention health, and compliance results immediately before and after any approved change. If any invariant changes, stop; do not repair in this phase.

LP244.54 physical iPhone acceptance remains **CLOSED/PASS** and was not reopened. The historical LP244.22 reset/repair/push sequence **was not replayed**. No reporting release was run or authorized.

## 8. Owner-authorized local implementation follow-up

The owner subsequently authorized **local** Cloudflare Worker and Resend code and a health-only access design, while explicitly requiring a stop before production SQL, provider account/secret/DNS setup, paid-plan selection, or deployment. The implementation is in `tools/retention/cleanup-alert-worker/`; its exact **unexecuted** production view, role, grants, returned fields, and operator setup boundary are in [the health-read operator review](LP24458-HEALTH-READ-OPERATOR-REVIEW.md). The Worker uses Hyperdrive and a private fixed-field view, classifies both cleanup jobs and retention counts, converts query/malformed results to safe `monitor_error`, and sends only allowlisted text through Resend. A KV binding deduplicates repeat alerts. A separate owner-run synthetic sender can generate a labeled email without reading production. No key, password, email address, database URL, or binding ID is committed.

At **2026-09-26 00:50:51 UTC**, another SELECT-only production checkpoint still found 16 distinct migrations, protocol 2, `reporting_enabled=false`, consumed/unlaunched guard, two active successful cleanup jobs, and healthy retention with zero overdue/breached counts. At **01:06 UTC**, a SELECT-only execution of the bounded proposed view query returned exactly two safe healthy rows. The role and view were not created. Ten focused local tests and a Wrangler `--dry-run` bundle validated code structure without authenticating to Cloudflare or Resend. No actual email was sent, and missed-monitor-run notification is not yet proven. **Complete alert detection, alert delivery, and LP244.58 closure remain NO-GO** pending the separate owner approvals and live evidence named in the operator review. The later local implementation changed no production state or LP244.54/LP244.22 decision.

At **01:15:01 UTC**, a final SELECT-only postcheck found 16 migration rows and 16 distinct versions, protocol 2, `reporting_enabled=false`, guard consumed/unlaunched, exactly two active one-minute cleanup jobs, and retention `succeeded` at 01:15 UTC with zero overdue/breached counts. A separate bounded Cron status query found both latest runs `succeeded` at 01:15 UTC. These are observations at that time, not a claim of future health or an atomic snapshot.

## 9. Health-read access security review supersedes the direct-login proposal

A subsequent owner-requested read-only privilege audit found the proposed login would inherit production database `TEMPORARY` authority and executable PostgreSQL operational functions through `PUBLIC`. The direct-login/Hyperdrive route in section 4 and its original SQL are **withdrawn and NO-GO**; the local Worker code that uses Hyperdrive remains dormant. The [revised operator review](LP24458-HEALTH-READ-OPERATOR-REVIEW.md) records the complete current non-system routine inventory, the security decision, a six-category private compliance backlog aggregate, and a new unexecuted fixed-RPC/Edge-Function proposal. No role, view, function, grant, Edge Function, secret, or deployment was created. Separate owner approval and a Worker redesign remain required before any production action or alert-delivery claim.
