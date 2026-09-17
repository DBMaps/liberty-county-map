# Gridly Data Deletion Runbook

## Intake paths

1. **In-app verified request:** “Delete mine” calls `public.request_community_report_deletion`. The private implementation verifies that the current device still owns the report link, then stores only digests and a private queue record.
2. **Privacy correspondence:** Settings → Support → Privacy & deletion directs users to the policy and feedback/contact path. Log the request in the owner-controlled case system without placing correspondence in public tables.

Public time/place knowledge alone is not proof of ownership. Do not expose whether another device owns a report.

## Queue review

```sql
begin read only;
set local search_path = pg_catalog;
select id, target_report_id, created_at, status
from privacy_ops.deletion_requests
where status='verified'
order by created_at
limit 100;
commit;
```

Confirm the request is still `verified`. For correspondence requests, apply the minimum verification necessary and attach only a bounded owner case reference in reviewer notes.

## Complete a request

```sql
begin;
set local search_path = pg_catalog;
select privacy_ops.complete_deletion_request(
  '<request-uuid>', '<delete|quarantine|deny>', '<bounded notes>'
);
commit;
```

- `delete` removes the public report. Cascades remove its private device link and live receipt. One-way replay evidence remains without a report/device reference so an old operation cannot be replayed.
- `quarantine` removes public visibility while an exceptional review proceeds; normal day-149 retention still applies.
- `deny` is only for a documented lawful reason or failed authority/verification outside the verified in-app path.

Completion clears the request’s target FK and requester digest. The completion record is shortened to at most 90 days. Never recreate a deleted link from logs or backups.

## Other data

For feedback, email, logs, provider data, or saved local data, follow the applicable system procedure. Clearing app data removes local acceptance, settings, hidden-report IDs, and saved places but cannot recall server/provider records. Provider and backup deletion must be verified before promising a completion date.

## Cleanup, restore, and evidence

Run `report_retention.run_cleanup()` and then `moderation.run_compliance_cleanup()` on the approved schedule. Validate that report rows delete by day 149, private links cascade, request/device fields clear by `retain_until`, and restores do not reintroduce expired rows or links. Keep only the minimum case completion evidence required by law and operations.

## Response

Tell the requester what categories were deleted, quarantined, denied, or could not be located; identify provider/backup limitations accurately; give any applicable appeal route; and never disclose another source’s identity or report linkage.
