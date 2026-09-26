# LP244.58 proposed health-only production access — OWNER APPROVAL REQUIRED

**Do not execute this proposal yet.** The owner authorized local Worker/Resend implementation and an exact database-access design, but explicitly withheld authorization for production SQL, account setup, secrets, DNS, and deployment. This document is the reviewable boundary for a later owner decision. No password or database URL belongs in Codex or this repository.

## Why a production change is needed

The proposed Cloudflare Worker can connect through Hyperdrive only with a dedicated database login. Production has no such login or health-only Cron projection. The existing `gridly_retention_monitor` is deliberately `NOLOGIN` and its original migration rejects added non-owner membership. It can read `report_retention.health` but has no `USAGE` on `cron`; it cannot supply compliance status to an external monitor. Giving a Worker the `postgres` or Supabase service-role credential would expose broad production authority and is rejected.

At `2026-09-26 01:06 UTC`, the exact **SELECT-only** projection below was executed through the connected owner SQL tool without creating the view. It returned exactly two rows, both `active`/`succeeded`, with current UTC run/success timestamps and zero overdue/breached counts. The projection uses the existing `cron.job_run_details(runid)` primary key and examines at most the recent 129 run IDs for either job; if a success falls outside that window, it reports no recent success and the Worker fails stale. The production role and view proposed here did not exist. The monitor source and this projection contain no report rows, IDs, coordinates, device/user identifiers, tokens, or free text.

## Exact returned fields

| Field | Type / values | Exposure limit |
| --- | --- | --- |
| `subsystem` | `report_retention` or `compliance_cleanup` | Fixed two names |
| `job_state` | `active`, `missing`, `inactive`, `misconfigured` | Internally compares only two named Cron jobs; command text is not returned |
| `latest_run_state` | `succeeded`, `running`, `failed`, `none` | Raw Cron error/return message is not returned |
| `latest_run_at` | UTC `timestamptz` or null | Latest named-job start time |
| `last_success_at` | UTC `timestamptz` or null | Retention health success or latest successful compliance Cron end time |
| `retention_state` | `succeeded`, `failed`, `none` | `none` for compliance; no SQL error text |
| `overdue_count`, `breached_count` | integers capped at 1,000,000 | Report retention aggregate only; zero means **not applicable** for compliance, not a compliance backlog assessment |

The Worker adds the constant `Gridly production` environment label and classifies healthy, stale, failed, overdue, or monitor-error. Only an allowlisted subset enters email. If the SQL result differs from exactly these two named rows or has malformed values, the Worker sends a `monitor_error` category instead of copying database output.

The retention success threshold is **five minutes**, matching the existing report-admission health gate. The compliance success threshold is **three minutes** for a once-per-minute job. Either job's latest run becoming three minutes old also triggers `stale`; a missing, inactive, misconfigured, or explicitly failed job triggers `failed`. Any positive report overdue or linkage-breach count triggers `overdue` unless a failure state takes precedence. These thresholds are local monitor logic, not changes to retention deadlines or Cron schedules.

## Exact proposed SQL — NOT AUTHORIZED FOR EXECUTION

Run only after separate owner approval, from a trusted owner/operator `psql` session against the verified Gridly production target. The transaction fails closed if the ledger, admission, guard, job inventory, or retention health differs. It neither invokes cleanup nor enables reporting. It adds one private view, one login with no password initially, one schema `USAGE`, and one view `SELECT`. No existing grant, RLS policy, cleanup schedule, deadline, or migration ledger entry is modified.

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

DO $check$
BEGIN
  IF current_user <> 'postgres'
     OR (SELECT array_agg(version::text ORDER BY version)
           FROM supabase_migrations.schema_migrations)
        IS DISTINCT FROM ARRAY[
          '202606070001','202606110001','202606160001','202606160002',
          '202606170410','202606170411','202606170425','202606170426',
          '202607280100','202607290100','202607290200','202609080001',
          '202609080002','20260908200554','202609160001','20260916183911'
        ]::text[]
     OR (SELECT count(*) FROM report_retention.admission_state
         WHERE singleton AND protocol_version = 2 AND NOT reporting_enabled) <> 1
     OR (SELECT count(*) FROM gridly_control.prelaunch_reset_authorization
         WHERE singleton AND project_ref = 'nhwhkbkludzkuyxmkkcj'
           AND migration_id = '20260908200554' AND status = 'consumed'
           AND consumed_at IS NOT NULL AND launched_at IS NULL) <> 1
     OR (SELECT count(*) FROM cron.job) <> 2
     OR (SELECT count(*) FROM cron.job
         WHERE active AND username = 'postgres' AND database = current_database()
           AND schedule = '* * * * *'
           AND ((jobname = 'gridly-community-report-retention'
                 AND command = 'select report_retention.run_cleanup()')
             OR (jobname = 'gridly-community-compliance-cleanup'
                 AND command = 'select moderation.run_compliance_cleanup()'))) <> 2
     OR NOT EXISTS (SELECT 1 FROM report_retention.health
         WHERE last_status = 'succeeded'
           AND last_success_at > statement_timestamp() - interval '5 minutes'
           AND overdue_cleanup_count = 0 AND breached_deadline_count = 0)
     OR to_regclass('report_retention.cleanup_alert_health') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gridly_cleanup_alert_login')
  THEN RAISE EXCEPTION 'LP244.58 health-read preflight changed; no access created';
  END IF;
END $check$;

CREATE ROLE gridly_cleanup_alert_login
  LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2 PASSWORD NULL;
ALTER ROLE gridly_cleanup_alert_login SET default_transaction_read_only = on;

CREATE VIEW report_retention.cleanup_alert_health
  WITH (security_barrier = true) AS
WITH expected(subsystem, jobname, expected_command) AS (
  VALUES
    ('report_retention'::text, 'gridly-community-report-retention'::text,
      'select report_retention.run_cleanup()'::text),
    ('compliance_cleanup'::text, 'gridly-community-compliance-cleanup'::text,
      'select moderation.run_compliance_cleanup()'::text)
), run_floor AS (
  SELECT greatest(coalesce(max(runid), 0) - 128, 0) AS minimum_runid
  FROM cron.job_run_details
)
SELECT e.subsystem,
  CASE WHEN j.jobid IS NULL THEN 'missing'
       WHEN NOT j.active THEN 'inactive'
       WHEN j.schedule <> '* * * * *' OR j.username <> 'postgres'
         OR j.database <> current_database() OR j.command <> e.expected_command
         THEN 'misconfigured'
       ELSE 'active' END::text AS job_state,
  CASE WHEN d.status IS NULL THEN 'none'
       WHEN d.status IN ('succeeded','running') THEN d.status
       ELSE 'failed' END::text AS latest_run_state,
  d.start_time AS latest_run_at,
  CASE WHEN e.subsystem = 'report_retention' THEN h.last_success_at
       ELSE (SELECT x.end_time FROM cron.job_run_details x
             WHERE x.jobid = j.jobid AND x.status = 'succeeded'
               AND x.runid >= f.minimum_runid
             ORDER BY x.runid DESC LIMIT 1)
       END AS last_success_at,
  CASE WHEN e.subsystem = 'report_retention'
       THEN CASE WHEN h.last_status IN ('succeeded','failed')
                 THEN h.last_status ELSE 'none' END
       ELSE 'none' END::text AS retention_state,
  CASE WHEN e.subsystem = 'report_retention'
       THEN least(h.overdue_cleanup_count, 1000000)::bigint
       ELSE 0::bigint END AS overdue_count,
  CASE WHEN e.subsystem = 'report_retention'
       THEN least(h.breached_deadline_count, 1000000)::bigint
       ELSE 0::bigint END AS breached_count
FROM expected e
CROSS JOIN run_floor f
LEFT JOIN cron.job j ON j.jobname = e.jobname
LEFT JOIN LATERAL (
  SELECT status, start_time FROM cron.job_run_details
  WHERE jobid = j.jobid AND runid >= f.minimum_runid
  ORDER BY runid DESC LIMIT 1
) d ON true
CROSS JOIN report_retention.health h;

REVOKE ALL ON report_retention.cleanup_alert_health
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA report_retention TO gridly_cleanup_alert_login;
GRANT SELECT ON report_retention.cleanup_alert_health TO gridly_cleanup_alert_login;

DO $check$
BEGIN
  IF (SELECT count(*) FROM report_retention.cleanup_alert_health) <> 2
     OR NOT has_database_privilege('gridly_cleanup_alert_login',current_database(),'CONNECT')
     OR NOT has_schema_privilege('gridly_cleanup_alert_login','report_retention','USAGE')
     OR NOT has_table_privilege('gridly_cleanup_alert_login',
                               'report_retention.cleanup_alert_health','SELECT')
     OR has_schema_privilege('gridly_cleanup_alert_login','cron','USAGE')
     OR has_schema_privilege('gridly_cleanup_alert_login','public','CREATE')
     OR has_table_privilege('gridly_cleanup_alert_login','public.reports',
                            'SELECT,INSERT,UPDATE,DELETE')
     OR has_function_privilege('gridly_cleanup_alert_login',
                               'report_retention.run_cleanup()','EXECUTE')
     OR has_function_privilege('gridly_cleanup_alert_login',
                               'moderation.run_compliance_cleanup()','EXECUTE')
     OR has_function_privilege('gridly_cleanup_alert_login',
                               'public.submit_community_observation(text,jsonb,text)','EXECUTE')
     OR has_function_privilege('gridly_cleanup_alert_login',
                               'public.mutate_community_observation(text,uuid,text,jsonb,text)','EXECUTE')
     OR has_function_privilege('gridly_cleanup_alert_login',
                               'public.cancel_community_operation(text)','EXECUTE')
     OR has_table_privilege('anon','report_retention.cleanup_alert_health','SELECT')
     OR has_table_privilege('authenticated','report_retention.cleanup_alert_health','SELECT')
  THEN RAISE EXCEPTION 'LP244.58 health-read privilege/shape postcheck failed';
  END IF;
END $check$;
COMMIT;
```

**Password boundary:** `PASSWORD NULL` prevents login until the owner sets a strong password in a trusted terminal outside Codex using `psql`'s interactive `\password gridly_cleanup_alert_login`. Do not put a password literal in SQL Editor history, command arguments, this document, or chat. The owner enters the resulting direct-connection URL only in Cloudflare Hyperdrive's secret configuration UI, using TLS certificate verification. This password step itself is a production role mutation and also needs the separate owner approval before use.

Before and after any approved execution, repeat the LP244.58 read-only checks for project identity, exact 16-version ledger, protocol 2 with `reporting_enabled=false`, consumed/unlaunched guard, exactly two active cleanup jobs, fresh retention success with zero overdue/breached counts, and latest compliance success. Verify `SELECT` on the new view returns exactly the two safe rows as the new login and cannot read `public.reports`, `cron.job`, private tables, or invoke writer/cleanup functions. Stop on any difference; do not auto-repair.

## External owner setup boundary — NOT AUTHORIZED YET

1. **Resend:** Owner creates or selects an account and reviews current Free/Paid terms. In the Resend Dashboard, open **Domains**, add a Gridly-controlled sending domain, add only the displayed verification records in the owner's DNS console, and wait for verification. DNS changes need separate approval. Open **API Keys → Create API Key**, choose **Sending access**, restrict it to that domain, and retain the key in an owner secret manager. [Resend documents the domain-scoped sending permission](https://resend.com/changelog/new-api-key-permissions). Choose a verified `ALERT_FROM` and an owner `ALERT_TO` inbox. No paid plan is selected here.
2. **Cloudflare:** Owner creates or selects an account, reviews Worker Free CPU and Hyperdrive/KV limits and any paid-plan need. In the Cloudflare Dashboard, create a **Hyperdrive** configuration with Supabase's **direct** connection endpoint and the dedicated login above; configure certificate-verified TLS. Under **Workers KV → Create instance**, create one namespace for alert deduplication. Cloudflare's [Supabase/Hyperdrive guide](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/) specifies the direct database connection and `pg`; the [KV guide](https://developers.cloudflare.com/kv/get-started/) gives the binding steps. Insert only the Hyperdrive and KV binding IDs into `tools/retention/cleanup-alert-worker/wrangler.jsonc`; these resource IDs are not passwords. The file already specifies the [one-minute Cron trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/). Deployment still needs separate authorization.
3. **Cloudflare secrets:** After the Worker exists under approved deployment, use **Workers & Pages → Worker → Settings → Variables and Secrets → Add → Secret** for `RESEND_API_KEY`, `ALERT_FROM`, and `ALERT_TO`; values must be entered by the owner, never sent through Codex. [Cloudflare's secret guide](https://developers.cloudflare.com/workers/configuration/secrets/) confirms secret values are hidden after entry. Do not put them in `wrangler.jsonc`, `.dev.vars`, the repository, or a shell command line.
4. **Proof after approval:** In an owner-controlled terminal with Resend secrets injected from a secret manager, run `node tools/retention/cleanup-alert-worker/send-synthetic.mjs`. This sends one labeled synthetic email without reading production. Record the UTC timestamp, Resend accepted/delivered event, and owner inbox receipt; an API acceptance alone is insufficient. Deploy and observe the Worker only after separate review, then rerun the read-only production checkpoint.

The Worker has no public HTTP handler. It queries only the proposed view, maps malformed/query failures to `monitor_error`, uses KV to suppress repeat emails for one hour while allowing a new alert after recovery, and reconstructs email text from an allowlist. Its current missed-Worker-invocation strategy remains **unproven and a launch blocker**: Cloudflare Cron history is inspectable, but no independent dead-man notification is deployed. Do not mark LP244.58 alert delivery GO until the owner receives the synthetic email and a missed-monitor mechanism is proven.
