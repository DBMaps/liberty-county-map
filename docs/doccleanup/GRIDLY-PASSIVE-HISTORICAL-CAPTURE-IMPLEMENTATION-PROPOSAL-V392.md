# V392 — Passive Historical Capture Implementation Proposal

## 1. Executive Summary

V392 proposes the first concrete implementation shape for Phase 1 passive historical evidence capture. The proposal remains documentation-only and preserves the governing rule:

> Capture Everything. Show Nothing. Depend On Nothing.

The future implementation would add a disabled-by-default, fail-open, append-only capture sidecar that observes completed production events after authoritative actions succeed. It would create immutable evidence envelopes for `report_created`, `report_updated`, `report_cleared`, `incident_transitioned`, and `incident_closed`, then attempt append-only writes to a dedicated historical capture schema in the existing Supabase project only when all gates are explicitly enabled.

The archive would be non-authoritative. Production code would never read it during Phase 1. Capture failure, duplicate detection failure, storage failure, monitoring failure, timeout, malformed payload handling, or emergency disablement would not change report submission, live report refresh, active hazard state, incident lifecycle decisions, alerts, awareness, markers, Route Watch, or DriveTexas behavior.

Current state remains unchanged:

- Migration applied: **NO**.
- Migration executed: **NO**.
- Supabase changed: **NO**.
- Historical reads: **NO**.
- Historical writes: **NO**.
- History UI: **NO**.
- Production integration: **NO**.
- Production behavior changes: **NO**.

## 2. Proposed Storage Target

### Options evaluated

| Option | Benefits | Risks / Costs | Recommendation |
| --- | --- | --- | --- |
| Existing Supabase project, separate schema | Reuses existing operational boundary, auth model, deployment ownership, backups, environment management, and proximity to source report data while still separating historical tables from live tables. | Requires a future separately approved migration and strict role grants so live application reads do not gain historical-read authority. | **Choose.** Best balance of isolation and operational simplicity for Phase 1. |
| Existing Supabase project, existing `public` schema | Operationally simple and easy to query for maintainers. | Weak isolation from live tables; easier to accidentally mix archive objects with production report objects; harder to prove “depend on nothing.” | Reject for Phase 1. |
| Separate Supabase project / separate database | Strongest storage isolation and easiest proof that live schema is untouched. | More credentials, networking, backups, monitoring, deployment, incident response, and cross-environment governance; higher operational complexity for a first passive capture milestone. | Defer unless security review requires stronger isolation. |
| Object storage / flat files | Append-friendly and cheap for high volume. | Harder idempotency, querying, row-level governance, and validation; less consistent with Supabase operational model. | Reject for Phase 1 primary store. |
| Client-side/local storage | No backend migration. | Not durable, not authoritative evidence, device-local, privacy-sensitive, and not suitable for archive validation. | Reject. |
| Analytics/logging platform only | Fast operational visibility. | Monitoring records are not governed archival evidence and may have retention/export limits. | Use only as monitoring, not storage. |

### Selected target

Use the **existing Supabase project with a dedicated historical capture schema**, tentatively named `history_capture`, for future implementation review.

The proposed storage target is:

- a separate schema from live production tables;
- append-only evidence tables owned by a narrowly scoped writer role;
- no Phase 1 historical-read path from the production web application;
- no live report-table triggers;
- no production-table mutation caused by capture;
- future migration required before activation, but **not approved by V392**.

### Why this target

This target provides enough separation to prove that the archive is not live authority while avoiding the operational overhead of a new database. A separate schema allows future grants, RLS policies, naming, migration review, retention review, and monitoring to be scoped to passive capture. The existing Supabase project remains the appropriate operational envelope because Phase 1 captures evidence about records already created there, but the separate schema prevents historical evidence from being confused with active production state.

## 3. Proposed Capture Hook Locations

These are **future attachment points only**. V392 does not implement them.

### Hook boundary rules

Every future hook must be:

1. after the authoritative production action completes successfully;
2. sidecar-only;
3. timeout-bounded;
4. wrapped so all capture errors are contained inside the capture boundary;
5. unable to alter production return values, UI state, alert state, awareness state, marker state, Route Watch state, DriveTexas state, or incident lifecycle decisions.

### `report_created`

Proposed future hook location:

- immediately after successful insertion of a new report row in report creation flows;
- for road hazards, after `gridlyInsertWithCountyMetadataFallback(supabaseClient, "reports", row)` returns without error in `createSharedHazardReport(...)`;
- for crossing reports, after the equivalent successful insert in `createSharedReport(...)`;
- before or parallel to any post-submit refresh, but never as a prerequisite for post-submit refresh or success UI.

Ownership boundary:

- production ownership remains the report submit flow and Supabase `reports` insert;
- capture receives a copied, normalized, redacted evidence input;
- capture does not change duplicate submit guards, confirmation copy, or refresh behavior.

### `report_updated`

Proposed future hook location:

- after any future approved report update path receives durable success from Supabase or the authoritative update owner;
- only for true updates to an existing source report, not for render refreshes, local normalization, marker updates, alert updates, or monitoring-only changes.

Ownership boundary:

- production ownership remains the future update action;
- capture records the post-success update evidence and selected lifecycle metadata;
- capture cannot decide whether the update is accepted.

Current note:

- V392 identifies the hook contract but does not assert that a production `report_updated` write path is currently active. If no approved update path exists at implementation time, the source-level gate for `report_updated` remains disabled and validation must report zero expected events for that source.

### `report_cleared`

Proposed future hook location:

- immediately after a successful clear report insert, including report types such as `cleared` or `hazard_cleared` where those are the production-approved clear signals;
- after the same durable insert success boundary used by report creation, because current clear semantics are report-backed rather than archive-backed;
- never inside historical projection, marker rendering, alert logic, awareness output, Route Watch output, or DriveTexas output.

Ownership boundary:

- production ownership remains the clear report action and current live lifecycle handling;
- capture records clear evidence as passive provenance;
- capture cannot close a live incident or suppress a marker.

### `incident_transitioned`

Proposed future hook location:

- after production has already computed a lifecycle transition from source report state, such as active to needs-confirmation, active to stale, active to recently-cleared, stale to historical, or equivalent future lifecycle states;
- at a dedicated lifecycle transition dispatcher or adapter created outside protected production collections;
- if the existing live path remains monolithic, the future implementation must first add an explicitly reviewed post-decision sidecar adapter rather than editing protected behavior inline.

Ownership boundary:

- production ownership remains current live lifecycle code, including `loadSharedReports()`, `activeHazards`, `getLiveHazardIncidents()`, `unifiedRoadIncidents`, and `activeUnifiedIncidents`;
- capture receives the already-decided transition facts;
- capture cannot affect active incident membership, merge logic, expiry, suppression, or display.

### `incident_closed`

Proposed future hook location:

- after production has already decided that an incident is terminal, cleared, expired, stale beyond active handling, or otherwise closed under an approved lifecycle rule;
- should be emitted as a specialized terminal transition when `lifecycle_state_after` is a closed state;
- should use the same post-decision sidecar adapter as `incident_transitioned` and not a database trigger on live tables.

Ownership boundary:

- production ownership remains incident lifecycle authority;
- capture stores terminal evidence only;
- capture cannot make closure decisions and cannot reopen or hide incidents.

## 4. Proposed Event Envelope

The future event envelope should be a versioned JSON-compatible object with stable field names. Exact proposed structure:

```json
{
  "contract_version": "history_capture_event.v1",
  "schema_version": "history_capture_schema.v1",
  "capture_version": "phase1.v1",
  "event_type": "report_created",
  "event_id": "evt_derived_or_uuid",
  "source": {
    "system": "gridly_web_app",
    "owner": "report_submit|report_update|report_clear|incident_lifecycle",
    "source_kind": "community_report|system_lifecycle",
    "source_function": "future_reviewed_hook_name"
  },
  "identifiers": {
    "source_record_id": "reports.id_or_crossing_id_fallback",
    "source_table": "reports",
    "incident_id": "stable_incident_id_or_null",
    "incident_key": "non_authoritative_cluster_or_lifecycle_key_or_null",
    "correlation_id": "maintainer_correlation_id_or_null",
    "county_id": "county_scope_or_null"
  },
  "timestamps": {
    "occurred_at": "source_event_time_iso",
    "source_created_at": "source_created_time_iso_or_null",
    "source_updated_at": "source_updated_time_iso_or_null",
    "captured_at": "capture_attempt_time_iso"
  },
  "lifecycle": {
    "lifecycle_state_before": "unknown|active|needs_confirmation|stale|recently_cleared|closed|null",
    "lifecycle_state_after": "active|needs_confirmation|stale|recently_cleared|closed|null",
    "transition_reason": "submitted|updated|clear_report|expired|stale_threshold|manual_clear|system_rule|unknown",
    "close_reason": "clear_report|expiration|superseded|merged|unknown|null",
    "is_terminal": false
  },
  "idempotency": {
    "idempotency_key": "deterministic_key",
    "payload_digest": "sha256_canonical_payload",
    "duplicate_hash": "sha256_duplicate_identity",
    "duplicate_of": null,
    "collision_strategy": "reject_and_monitor"
  },
  "metadata": {
    "environment": "local|preview|staging|production",
    "app_build": "build_identifier_or_null",
    "capture_gate_state": "enabled_at_attempt|disabled_skipped",
    "write_gate_state": "enabled_at_attempt|disabled_skipped",
    "source_gate_state": "enabled_at_attempt|disabled_skipped",
    "location_summary": {
      "road_name": "normalized_road_or_null",
      "location_label": "normalized_public_label_or_null",
      "jurisdiction": "normalized_jurisdiction_or_null"
    },
    "privacy": {
      "redaction_profile": "phase1_minimal",
      "precise_device_id_included": false,
      "raw_request_body_included": false
    },
    "validation_warnings": [],
    "diagnostics_redacted": {}
  }
}
```

Envelope requirements:

- `event_type` must be one of `report_created`, `report_updated`, `report_cleared`, `incident_transitioned`, or `incident_closed`.
- `event_id` must be stable for deterministic replay when possible; otherwise it may be generated but must not become production authority.
- `occurred_at` is the source event time; `captured_at` is capture processing time.
- lifecycle fields may be `null` for report events where lifecycle state is not known.
- `payload_digest` is computed from canonicalized approved payload fields.
- metadata must be minimal, redacted, and maintainer-only.
- raw request bodies, credentials, secrets, precise device identifiers, unapproved free text, and unapproved precise-location detail are excluded.

## 5. Proposed Idempotency Model

### Idempotency key strategy

Use deterministic keys with the following pattern:

```text
history:v1:{environment}:{event_type}:{source_table}:{source_record_id}:{occurred_at}:{lifecycle_state_before}:{lifecycle_state_after}:{payload_digest_prefix}
```

For events without a source table, use:

```text
history:v1:{environment}:{event_type}:incident:{incident_id_or_incident_key}:{occurred_at}:{lifecycle_state_before}:{lifecycle_state_after}:{payload_digest_prefix}
```

Rules:

- canonicalize strings to trimmed lowercase where appropriate;
- canonicalize timestamps to ISO-8601 UTC;
- canonicalize payload JSON by sorting keys before digesting;
- include event type and environment to prevent cross-source collisions;
- include lifecycle before/after for transition events;
- never use idempotency state to mutate production state.

### Duplicate detection strategy

Future storage should enforce a unique constraint on `idempotency_key` in the historical capture schema, subject to a separately approved migration. The writer should classify outcomes as:

- `inserted`: no prior event with the key exists;
- `duplicate_same_digest`: same `idempotency_key` and same `payload_digest`; suppress as safe duplicate;
- `duplicate_digest_mismatch`: same `idempotency_key` but different `payload_digest`; reject capture and emit collision monitoring;
- `write_unknown`: write outcome unknown due to timeout or network failure; do not retry synchronously on user-visible paths.

### Collision handling

If the same idempotency key appears with a different digest:

1. do not overwrite the existing archive record;
2. do not update production state;
3. record a maintainer-only collision signal containing redacted identifiers and digests;
4. classify the attempt as capture failure only;
5. require manual review before any future repair or replay.

## 6. Proposed Retention Model

### Retention assumptions

Phase 1 retention should assume archived events are operational evidence, not user-facing history. Recommended default:

- retain raw Phase 1 event envelopes for **18 months** in approved non-production and production environments unless governance requires shorter retention;
- retain aggregate monitoring counters longer only if they contain no sensitive identifiers;
- keep deletion and archive compaction jobs out of Phase 1 implementation unless separately approved.

### Archive growth expectations

Expected growth is one archive row per approved event after all gates are enabled. Approximate planning model:

```text
daily_rows = report_created + report_updated + report_cleared + incident_transitioned + incident_closed
monthly_rows ≈ daily_rows * 30
storage ≈ monthly_rows * average_envelope_size
```

Initial growth should be modest because capture is disabled by default, source-level gates are disabled by default, and production activation is not approved by V392. Actual sizing must be measured in a non-production validation environment before production write approval.

### Deletion assumptions

- No deletion job is approved by V392.
- Future deletion, retention, legal hold, export, and compaction processes require separate review.
- Rollback does not require deleting already captured evidence because Phase 1 never reads it.
- If a privacy deletion obligation applies, it must be handled by a future governed operational process, not by production incident logic.

## 7. Proposed Validation Plan

Future implementation validation must produce evidence for each item below before any write activation review:

1. **Documentation/file-boundary validation**
   - prove only approved sidecar and documentation files changed;
   - prove `js/app.js`, `index.html`, `css/styles.css`, SQL files, alerts, awareness, markers, Route Watch, and DriveTexas remain unchanged unless a later milestone explicitly approves named edits.
2. **Disabled-default validation**
   - with all gates absent or false, create/update/clear/lifecycle fixtures produce zero write attempts.
3. **Gate hierarchy validation**
   - emergency disable overrides every other flag;
   - environment allowlist denial blocks writes;
   - global capture disabled blocks capture;
   - write gate disabled blocks archive writes;
   - source gate disabled blocks only that source.
4. **Envelope validation**
   - fixtures for all five event types match the approved envelope contract;
   - unapproved fields are rejected or redacted;
   - malformed source data fails capture only.
5. **Idempotency validation**
   - equivalent events produce identical idempotency keys and digests;
   - distinct lifecycle transitions produce distinct keys;
   - duplicate same-digest attempts are suppressed;
   - digest mismatches are rejected and monitored.
6. **Fail-open validation**
   - simulated storage outage, permission denial, credential absence, network timeout, duplicate collision, validation failure, and monitoring failure do not alter production success paths.
7. **Production parity validation**
   - compare before/after outputs for active report counts, `activeHazards`, `getLiveHazardIncidents()`, unified incident counts, alerts, awareness output, marker counts, Route Watch outputs, and DriveTexas outputs.
8. **Latency validation**
   - prove capture is non-blocking or bounded below the approved budget;
   - prove timeout handling is capture-only.
9. **Rollback validation**
   - enable capture in a non-production environment, observe test writes, activate emergency disablement, prove no new write attempts occur, and prove production-visible outputs remain unchanged.
10. **Operational validation**
   - prove monitoring signals exist, are redacted, and are maintainer-only.

## 8. Proposed Monitoring Plan

Monitoring must be maintainer-only and must not become user-facing history, alerts, awareness, markers, Route Watch output, DriveTexas output, or production authority.

Required monitoring outputs:

- current effective gate state:
  - emergency disable;
  - environment allowlist decision;
  - global capture gate;
  - write gate;
  - each source-level gate;
- capture attempts by `event_type`, source owner, environment, and schema version;
- capture successes by `event_type`, source owner, environment, and schema version;
- skipped events by reason:
  - disabled global gate;
  - disabled write gate;
  - disabled source gate;
  - environment not allowlisted;
  - emergency disabled;
  - missing credentials;
  - validation rejected;
- failures by class:
  - envelope validation;
  - digest generation;
  - idempotency generation;
  - archive write;
  - duplicate collision;
  - timeout;
  - permission;
  - credential;
  - schema mismatch;
  - monitoring failure;
- duplicate detections:
  - same key/same digest;
  - same key/digest mismatch;
  - write outcome unknown;
- write latency distribution and timeout count;
- archive growth by environment, event type, and schema version;
- capture version and schema version distribution;
- redacted sample of latest failure for maintainer debugging;
- emergency-disable confirmation timestamp.

Monitoring must not include raw request bodies, secrets, full device identifiers, unapproved free text, or precise device-derived location beyond approved public report coordinates/labels.

## 9. Proposed Rollback Plan

Rollback must be configuration-first and behavior-neutral.

### Disablement order

1. Set `GRIDLY_HISTORY_CAPTURE_EMERGENCY_DISABLE=true`.
2. Confirm monitoring shows emergency disabled and zero new capture attempts.
3. Set `GRIDLY_ENABLE_HISTORY_CAPTURE_WRITES=false`.
4. Set all source gates false:
   - `GRIDLY_ENABLE_HISTORY_CAPTURE_REPORT_CREATED=false`;
   - `GRIDLY_ENABLE_HISTORY_CAPTURE_REPORT_UPDATED=false`;
   - `GRIDLY_ENABLE_HISTORY_CAPTURE_REPORT_CLEARED=false`;
   - `GRIDLY_ENABLE_HISTORY_CAPTURE_LIFECYCLE_TRANSITION=false`.
5. Set `GRIDLY_ENABLE_PASSIVE_HISTORY_CAPTURE=false`.
6. Remove production from `GRIDLY_HISTORY_CAPTURE_ENV_ALLOWLIST`.
7. Revoke or rotate historical capture writer credentials if a security or privacy incident is suspected.

### Rollback verification

After disablement, verify:

- no new write attempts are recorded;
- production report creation still succeeds or fails exactly as before based on production inputs;
- report clears still follow production behavior;
- live refresh remains independent of archive availability;
- alerts, awareness, markers, Route Watch, DriveTexas, and active incident lifecycle outputs match baseline;
- existing archive rows remain inert and unread.

### What rollback must not require

Rollback must not require:

- migration rollback;
- data restore;
- archive deletion;
- cleanup scripts;
- edits to `loadSharedReports()`;
- edits to `activeHazards` handling;
- edits to `getLiveHazardIncidents()`;
- edits to `unifiedRoadIncidents` or `activeUnifiedIncidents`;
- alert, awareness, marker, Route Watch, or DriveTexas edits;
- UI changes.

## 10. Production Isolation Analysis

### Alerts

Alerts remain derived from current approved live inputs only. Capture monitoring and archived historical evidence must not be read by alert code, must not change alert eligibility, and must not change alert text, suppression, timing, priority, routing, or delivery.

### Awareness

Awareness remains derived from current approved live awareness inputs only. Historical evidence and capture monitoring must not feed awareness state, copy, priority, persistence, or display.

### Markers

Markers remain derived from current live incident/report collections and approved marker pipelines only. Capture must not change marker count, icon, label, popup content, layer ownership, clustering, refresh timing, or click behavior.

### Route Watch

Route Watch remains derived from current route and live incident/report inputs only. Capture must not change route matching, route relevance, route geometry, route cards, route alerts, route incident counts, or destination ownership.

### DriveTexas

DriveTexas remains an independent live/official-data integration. Capture must not change DriveTexas fetching, parsing, authority, fallback, presentation, merge logic, or monitoring.

### Incident lifecycle

Incident lifecycle authority remains in production live-state code. Future capture hooks must observe only after production decisions are complete. The archive cannot decide active/inactive state, cannot close incidents, cannot reopen incidents, cannot suppress incidents, cannot merge incidents, and cannot affect `activeHazards`, `getLiveHazardIncidents()`, `unifiedRoadIncidents`, or `activeUnifiedIncidents`.

### Why isolation holds

Isolation holds only if future implementation obeys all of these constraints:

- no historical reads in Phase 1;
- all gates disabled by default;
- write attempts are sidecar-only;
- capture errors are swallowed inside the capture boundary;
- archive writes are timeout-bounded and non-blocking;
- monitoring is maintainer-only;
- no protected production system branches on capture state or archive state.

## 11. Implementation Complexity Assessment

### Engineering complexity: Medium

The core sidecar implementation is moderate: feature gates, envelope construction, canonical digest generation, idempotency, append-only writer, monitoring, tests, and rollback verification are straightforward. Complexity increases because production attachment points must be placed with extreme care after existing success boundaries and must not perturb protected systems.

### Operational complexity: Medium

Using the existing Supabase project with a separate schema keeps operations manageable. The main operational burden is credential scoping, environment allowlisting, emergency disablement, monitoring review, retention governance, and proof that no historical reads are introduced.

### Maintenance complexity: Low to Medium

Once implemented, the capture sidecar should change only when event types, envelope versions, retention policies, or source ownership boundaries change. Maintenance risk comes from future production flow changes that may move report or lifecycle success boundaries.

## 12. Implementation Recommendation

This proposal is suitable for future implementation review **only as a planning artifact**.

Recommended future review outcome:

- approve the proposed storage direction for separate migration review;
- approve the envelope and idempotency model for sidecar implementation design;
- require a separate file-boundary milestone before editing production hook locations;
- require a separate migration/deployment milestone before any Supabase schema exists;
- require non-production validation before any write gate is enabled;
- keep production historical writes disabled until a later go-live milestone explicitly approves activation.

## 13. Open Risks

Remaining unresolved risks:

- exact Supabase schema, table names, constraints, policies, and grants are not approved;
- writer identity, credential storage, and rotation process are not approved;
- production hook insertion points require future code-level review;
- current report update ownership may be absent or not centralized enough for `report_updated` capture;
- lifecycle transition ownership may need a new explicit post-decision dispatcher;
- retention duration requires privacy/legal governance review;
- storage growth must be measured with real non-production volumes;
- canonicalization rules must be tested against real report variations;
- collision handling requires maintainer runbook approval;
- monitoring destination and alert thresholds are not selected;
- no privacy deletion workflow is defined;
- no production activation is approved.

## 14. Next Milestone Recommendation

Recommended next milestone:

**V393 — Passive Historical Capture File-Boundary and Hook-Readiness Review**

V393 should remain documentation/review-first and should:

- inventory exact future files allowed for sidecar implementation;
- inventory exact production call sites that would need later hook approval;
- classify each hook as safe, unsafe, or requiring refactor;
- define the separate migration review package needed for the `history_capture` schema;
- decide whether implementation can proceed in non-production with all gates disabled by default.

V393 should still not execute migrations, run Supabase commands, add historical reads, add UI, enable writes, or change production behavior unless a later instruction explicitly changes scope.

## 15. Explicit Non-Approval Statement

V392 does **NOT** approve:

- migration execution;
- migration application;
- Supabase deployment;
- Supabase commands;
- SQL changes;
- historical reads;
- historical writes;
- history UI;
- production integration;
- production behavior changes;
- modifications to `js/app.js`;
- modifications to `index.html`;
- modifications to `css/styles.css`;
- changes to `loadSharedReports()`;
- changes to `activeHazards`;
- changes to `getLiveHazardIncidents()`;
- changes to `unifiedRoadIncidents`;
- changes to `activeUnifiedIncidents`;
- alert changes;
- awareness changes;
- marker changes;
- Route Watch changes;
- DriveTexas changes.

V392 is documentation-only. It creates no archive, applies no migration, changes no Supabase state, adds no reads, adds no writes, adds no UI, and changes no production behavior.
