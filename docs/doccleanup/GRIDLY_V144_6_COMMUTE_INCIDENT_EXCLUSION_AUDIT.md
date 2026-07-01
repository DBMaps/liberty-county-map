# GRIDLY V144.6 — Commute Incident Exclusion Reason Audit

## Scope
This audit traces the selection path from `getUnifiedIncidents()` to `commute_model_build` and records per-incident exclusion metadata when an incident is not processed.

## Filter/selection step traced
1. Unified source: `getUnifiedIncidents()`.
2. Commute input selection: `getActiveUnifiedIncidents()`.
3. Commute build input: `activeIncidents = getActiveUnifiedIncidents().filter(status === "active")`.
4. Commute model mapping: `commute_model_build` uses `activeIncidents.map(...)`.

## Per-incident exclusion recording
`commuteAuditExclusionReasons` now stores structured records (one entry per excluded incident), including:
- `incidentId`
- `type`
- `source`
- `status`
- `lifecycle`
- `excludedByFunction`
- `exclusionReason`

Two exclusion classes are recorded:
- `status_filter_non_active` excluded by `getActiveUnifiedIncidents`
- `not_mapped_into_commute_model_build` excluded by `commute_model_build(activeIncidents.map)`

If the summary excluded count is still larger than enumerated exclusions, a final unresolved placeholder entry is added with:
- `excludedByFunction: "commute_audit_sanitizer"`
- `exclusionReason: "excluded_count_mismatch_unresolved:<n>"`

## Why incidents can be intentionally not mapped
Incidents with lifecycle/status not active are intentionally excluded before commute model mapping. They are now explicitly reported rather than silently counted.

## Mismatch-only note
If an incident is active but absent from `commute_model_build` output, the audit now flags it as `not_mapped_into_commute_model_build` for diagnosis. This change does not alter mapping behavior; it only captures mismatch details.
