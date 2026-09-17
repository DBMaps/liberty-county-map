# Gridly UGC Moderation Runbook

## Purpose and authority

This runbook is for an authorized database owner handling community complaints. Client/API roles cannot read moderation tables or execute owner actions. Never grant table access to `anon`, `authenticated`, or `service_role`, and never expose the `moderation` schema through PostgREST.

## Intake behavior

The app submits a UUIDv4 operation ID, target report UUID, bounded reason, and local device ID to `public.submit_community_moderation_report`. The private implementation stores only SHA-256 digests for the operation and reporting device. It returns bounded statuses: `accepted`, `already_processed`, `gone`, `rate_limited`, `invalid_request`, or `retryable_failure`.

## Review queue

Use an owner transaction and inspect only the minimum fields:

```sql
begin read only;
set local search_path = pg_catalog;
select id, target_report_id, reason, created_at, status
from moderation.complaints
where status in ('open','reviewing','escalated')
order by created_at
limit 100;
commit;
```

Review the current public report, age, context, duplication, complaint reason, and safety/privacy impact. Do not extract raw device associations. A complaint is an allegation, not proof.

## Outcomes

Run exactly one bounded owner action inside a transaction:

```sql
begin;
set local search_path = pg_catalog;
select moderation.apply_action('<complaint-uuid>', '<action>', '<bounded notes>');
commit;
```

Allowed actions:

- `no_action`: record that the reviewed content stays visible.
- `quarantine`: immediately removes the target from public RLS reads while preserving it for review until normal retention deletes it.
- `remove`: marks the target removed from public reads until normal retention deletes it.
- `source_suppression`: when private linkage still exists, removes current reports from that source and blocks new reports until the bounded suppression expires. Use only for substantiated repeated abuse.

Never update `public.reports.moderation_state` manually unless repairing a documented incident. The action function writes immutable, non-device-linked evidence.

## Urgent escalation

For credible threats, imminent harm, child-safety issues, or exposed highly sensitive personal data: quarantine first, preserve only legally necessary evidence, notify the designated owner/security contact, and obtain legal advice before disclosure. Use emergency channels when required; do not investigate by contacting an alleged target through report data.

## Cleanup and monitoring

Run after the existing report retention cleanup:

```sql
select report_retention.run_cleanup();
select moderation.run_compliance_cleanup();
```

Alert if cleanup fails, source suppressions are past `expires_at`, complaint/device linkages remain past `retain_until`, an API role gains table access, or the public projection gains `moderation_state` or any source identifier. Moderation never restarts `cleanup_after` or `linkage_deadline`.

## Appeals and audit

Record concise factual notes, not copied personal data. If a user challenges an outcome, create an owner case reference outside the public schema, have a second reviewer reassess when practical, and record the final bounded action. Never edit or delete `moderation.action_log`; repair through a new documented action.
