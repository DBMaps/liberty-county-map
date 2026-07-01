# Gridly Live Projection Parity Harness Design V1

## 1. Executive Summary

This milestone is design and audit only. It does not modify production code, Supabase schema, migrations, report insertion, clearing behavior, alerts, markers, awareness, Route Watch, DriveTexas, or production data.

Gridly must prove that the current `reports`-backed live pipeline and any future live/history projection produce the same user-visible operational outputs before any cutover. The parity harness described here is a read-only comparison framework for capturing current pipeline outputs, projected future outputs, and a structured diff that can block unsafe migration work.

The harness target is behavioral parity, not raw storage equality. A future projection may use different table names, evidence shapes, or derived records, but it must preserve active incident counts, IDs or stable aliases, hazard types, coordinates, grouping, lifecycle state, clear suppression, confirmations, alert ownership, awareness counts, marker candidates, crossing ownership, and route-impact inputs.

## 2. Purpose

Parity must be proven before schema or runtime changes because the current live pipeline is the production behavioral contract. The `reports` table currently feeds map state, active road hazards, crossing incidents, alerts, awareness inventory, markers, confirmations, clears, and recently-cleared suppression. If Gridly changes schema first and validates later, regressions could appear as duplicate markers, missing alerts, resurrected cleared hazards, lost confirmations, incorrect crossing state, or drift in awareness counts.

The parity harness provides a safe pre-migration gate by answering one question for a frozen input set:

```text
current reports pipeline output == future projected incidents/history output
```

The comparison must happen before:

- adding or relying on new live/history schema;
- dual-writing live and historical records;
- switching read paths from `reports` to a projection;
- enabling historical incident views that could affect active behavior.

## 3. Current Pipeline Outputs To Compare

The current snapshot must capture logical outputs after the same normalization, filtering, lifecycle, and rendering-candidate decisions used by the app today.

### 3.1 `loadSharedReports()`

Capture the post-load read result and derived assignment behavior:

- load reason and timestamp;
- raw report count returned by the live read;
- normalized report count;
- county-filtered count;
- expiration-filtered count;
- development/test suppression count when current runtime rules suppress rows;
- rows assigned to road hazard collections;
- rows assigned to crossing/report collections;
- rows assigned to recently-cleared road hazard collections;
- rejected/suppressed row IDs with reason codes when available.

### 3.2 `activeHazards`

Capture active road hazard source rows that survive current live filters:

- report IDs;
- `report_type` / hazard type;
- latitude and longitude;
- created and expiration timestamps;
- detail/location text used by current UI;
- county or selected-area metadata;
- source trust fields used by lifecycle decisions;
- confirmation source relationships when derivable;
- clear/recent-clear suppression references.

### 3.3 `activeReports`

Capture active non-road-hazard/crossing report rows:

- report IDs;
- crossing IDs and reviewed crossing identity;
- crossing report type such as blocked, heavy delay, other, or cleared;
- crossing name, railroad, road labels, and coordinates;
- latest-report ordering fields;
- selected-area/county membership;
- lifecycle classification inputs;
- confirmation evidence membership.

### 3.4 `recentlyClearedRoadHazards`

Capture road clear evidence retained by current behavior:

- clear row IDs;
- target hazard type and location/group key;
- clear timestamp;
- recent-clear window status;
- suppressed active hazard IDs or grouping keys;
- UI visibility eligibility if current surfaces expose recent clears.

### 3.5 `getLiveHazardIncidents()`

Capture generated road incident output:

- generated incident ID or key;
- hazard type;
- representative coordinates;
- grouping key;
- source report IDs;
- confirmation count;
- lifecycle state;
- clear/recent-clear state;
- selected-area eligibility;
- marker eligibility;
- alert eligibility;
- route-impact input fields if currently populated.

### 3.6 `unifiedRoadIncidents`

Capture the road-only unified incident representation:

- unified ID;
- source generated road incident key;
- normalized type/status;
- coordinates;
- source report IDs;
- lifecycle state;
- marker/alert/awareness eligibility flags;
- clear suppression state.

### 3.7 `activeUnifiedIncidents`

Capture the final active unified incident set used by shared consumers:

- active unified IDs;
- incident kind: road hazard, crossing, or other supported provider;
- source ownership path;
- coordinates;
- lifecycle state;
- selected-area membership;
- route-impact membership;
- alert/awareness/marker eligibility.

### 3.8 Alerts Snapshot

Capture alert-facing outputs, not DOM markup:

- alert row/card count;
- alert IDs and grouping keys;
- incident ownership ID;
- alert category and severity/trust state;
- displayed status such as active, cleared, blocked, or heavy delay;
- selected-area inclusion;
- ordering/ranking key when deterministic;
- confirmation count displayed or implied;
- crossing ownership where applicable.

### 3.9 Awareness Inventory

Capture awareness-facing counts and memberships:

- total awareness count;
- road hazard count;
- crossing count;
- recently-cleared count if counted;
- selected-area counts;
- source incident/report IDs contributing to each bucket;
- route-awareness candidate IDs without changing Route Watch behavior.

### 3.10 Marker Inventory

Capture marker render candidates, not visual implementation details:

- marker candidate count;
- marker ID/key;
- marker owner type: road incident, crossing incident, neutral crossing infrastructure, or fallback;
- source incident/report IDs;
- latitude and longitude;
- icon/category type;
- clustering or duplicate-suppression key;
- visibility flags such as hidden crossing ID or selected-area filtering;
- popup ownership target.

## 4. Future Projection Outputs

A future live/history architecture must expose equivalent read-only projection outputs for the same frozen input set.

### 4.1 Active Incidents

Projected active incidents are the future equivalent of active road/crossing unified state. They must include stable incident IDs or compatibility aliases, type, coordinates, lifecycle state, active/cleared status, selected-area membership, and marker/alert/awareness eligibility.

### 4.2 Incident Evidence

Projected incident evidence must preserve source report membership and confirmation evidence. Evidence should be comparable by original report IDs, evidence IDs, normalized evidence type, timestamp, coordinates, crossing ID, hazard type, and source trust fields.

### 4.3 Historical Incidents

Projected historical incidents must represent closed, expired, cleared, or archived incident records without becoming a second live source. The snapshot should include historical incident IDs, linked evidence IDs, lifecycle summary, first/last seen timestamps, clear timestamp, and recurrence keys.

### 4.4 Lifecycle Events

Projected lifecycle events must capture state transitions that current behavior infers from rows:

- created/reported;
- confirmed;
- expired;
- cleared;
- recently cleared;
- suppressed from active rehydration;
- latest crossing state changed;
- selected-area membership changed only if current behavior would produce that distinction.

### 4.5 Current Active View

The future projection must provide a compatibility current active view that can be diffed directly against `activeUnifiedIncidents`, road incident output, crossing incident output, and downstream surface inventories.

### 4.6 Awareness Projection

The future awareness projection must expose the same count buckets, source ownership IDs, selected-area membership, and route-awareness candidate references as the current awareness inventory.

### 4.7 Alert Projection

The future alert projection must expose alert rows/cards, grouping keys, owner incident IDs, displayed status, severity/trust data, confirmation counts, selected-area membership, and crossing ownership.

### 4.8 Marker Projection

The future marker projection must expose marker render candidates, owner type, source IDs, coordinates, icon/category, duplicate-suppression keys, popup target, hidden/filtered state, and clustering keys.

## 5. Parity Dimensions

The parity diff must compare these dimensions explicitly:

| Dimension | Required comparison |
| --- | --- |
| Counts | Counts for active hazards, active reports, recent clears, road incidents, unified incidents, alerts, awareness buckets, and marker candidates. |
| IDs | Current IDs, future IDs, and approved compatibility aliases. |
| Hazard types | Normalized hazard/report type values for road and crossing incidents. |
| Coordinates | Latitude/longitude and representative incident coordinate selection. |
| Grouping keys | Road hazard cluster keys, crossing IDs, alert grouping keys, marker duplicate keys, and recurrence keys. |
| Lifecycle state | Active, cleared, recently cleared, expired, suppressed, latest crossing state, and historical state. |
| Clear suppression | Whether old active evidence is suppressed after a clear and whether recent clears remain represented. |
| Confirmation counts | Count and membership of confirming report/evidence rows. |
| Alert rows | Alert card count, ownership, grouping, status, severity/trust, and selected-area inclusion. |
| Awareness counts | Bucket counts, selected-area counts, ownership IDs, and route-awareness candidate IDs. |
| Marker render candidates | Candidate count, owner type, coordinates, icon/category, duplicate/clustering key, and popup target. |
| Crossing ownership | Reviewed crossing identity, crossing ID, latest report semantics, crossing marker ownership, and neutral crossing separation. |

## 6. Tolerance Rules

### 6.1 Exact Match Required

Exact parity is required for:

- active incident counts;
- marker candidate counts;
- alert row counts and owner IDs;
- awareness bucket counts;
- crossing IDs and crossing ownership;
- hazard types;
- lifecycle state;
- clear suppression state;
- confirmation counts and source membership;
- source report/evidence membership;
- route-impact candidate membership;
- selected-area inclusion/exclusion;
- duplicate-suppression keys when they determine visible markers or alert rows.

### 6.2 Normalized Equivalence Allowed

Normalized equivalence is allowed only where product behavior is unchanged:

- future incident IDs may differ if a stable `compatId` maps one-to-one to the current ID/key;
- coordinate precision may be rounded for comparison if the rounded value resolves to the same marker position and selected-area membership;
- timestamps may compare as equivalent when ISO strings and epoch milliseconds represent the same instant;
- field names may differ if normalized values match;
- ordering may differ only for sets with no user-visible rank or deterministic order requirement;
- historical IDs may differ if all linked evidence and lifecycle summaries match.

### 6.3 No Tolerance Without Approval

No tolerance is allowed for differences that change visible behavior, suppress or duplicate a live item, move ownership between road/crossing/neutral marker paths, change alert ownership, change awareness counts, or change route-impact candidate membership.

## 7. Snapshot Format

### 7.1 Current Pipeline Snapshot

```json
{
  "schemaVersion": "gridly-live-projection-parity-current-v1",
  "generatedAt": "2026-06-16T00:00:00.000Z",
  "source": "currentReportsPipeline",
  "loadSharedReports": {
    "reason": "parity_audit_fixture",
    "rawCount": 0,
    "normalizedCount": 0,
    "filteredCount": 0,
    "suppressed": [{ "id": "report-id", "reason": "expired" }]
  },
  "activeHazards": [],
  "activeReports": [],
  "recentlyClearedRoadHazards": [],
  "liveHazardIncidents": [],
  "unifiedRoadIncidents": [],
  "activeUnifiedIncidents": [],
  "alerts": {
    "count": 0,
    "rows": []
  },
  "awareness": {
    "total": 0,
    "buckets": {},
    "memberships": []
  },
  "markers": {
    "count": 0,
    "candidates": []
  }
}
```

### 7.2 Future Projection Snapshot

```json
{
  "schemaVersion": "gridly-live-projection-parity-projected-v1",
  "generatedAt": "2026-06-16T00:00:00.000Z",
  "source": "futureLiveHistoryProjection",
  "activeIncidents": [],
  "incidentEvidence": [],
  "historicalIncidents": [],
  "lifecycleEvents": [],
  "currentActiveView": [],
  "awarenessProjection": {
    "total": 0,
    "buckets": {},
    "memberships": []
  },
  "alertProjection": {
    "count": 0,
    "rows": []
  },
  "markerProjection": {
    "count": 0,
    "candidates": []
  },
  "compatibilityAliases": []
}
```

### 7.3 Parity Diff Result

```json
{
  "schemaVersion": "gridly-live-projection-parity-diff-v1",
  "generatedAt": "2026-06-16T00:00:00.000Z",
  "pass": false,
  "summary": {
    "blockingMismatchCount": 0,
    "warningMismatchCount": 0,
    "acceptableDifferenceCount": 0,
    "auditOnlyNoteCount": 0
  },
  "diffs": [
    {
      "category": "blocking_mismatch",
      "dimension": "marker_render_candidates",
      "currentPath": "markers.candidates[road-flooding-abc]",
      "projectedPath": "markerProjection.candidates[incident-123]",
      "currentValue": 1,
      "projectedValue": 2,
      "message": "Projected marker count differs for the same logical road incident.",
      "stopCondition": "marker_count_mismatch"
    }
  ],
  "stopConditionsTriggered": []
}
```

## 8. Diff Categories

### 8.1 Blocking Mismatch

A blocking mismatch is any difference that can change user-visible live behavior or corrupt migration confidence. Examples include active count mismatch, missing source evidence, duplicate marker candidates, changed alert owner, changed awareness count, crossing latest-state drift, clear suppression failure, confirmation mismatch, or route-impact candidate mismatch.

### 8.2 Warning Mismatch

A warning mismatch is a difference that is not immediately user-visible but indicates migration risk. Examples include non-visible metadata drift, non-ranking order changes in diagnostic arrays, missing optional debug fields, or historical summary wording differences.

### 8.3 Acceptable Difference

An acceptable difference is a pre-approved normalized equivalence. Examples include a future incident ID that maps through `compatId`, timestamp format normalization, coordinate rounding within an approved precision, or renamed fields with identical normalized values.

### 8.4 Audit-Only Note

An audit-only note records observations that require no migration action. Examples include empty optional collections, unavailable future projection fields in an early prototype, or fixture metadata used only to explain the scenario.

## 9. Stop Conditions

Migration must stop if any of these occur in browser, fixture, staging, or production-shadow validation:

- active count mismatch;
- marker count mismatch;
- alert ownership mismatch;
- awareness count mismatch;
- crossing mismatch, including crossing ID, latest report state, coordinates, or marker ownership;
- lifecycle mismatch, including active/cleared/recently-cleared/expired/suppressed state;
- confirmation mismatch, including count or confirming source membership;
- route impact mismatch, including changed candidate membership for route-aware consumers;
- clear suppression mismatch that resurrects a cleared hazard;
- duplicate-suppression mismatch that creates duplicate alerts, markers, or awareness entries;
- selected-area mismatch that changes visible membership;
- source evidence mismatch that loses the ability to explain a live incident.

Any stop condition requires the migration plan to remain paused until the mismatch is understood, documented, fixed, and revalidated with the same fixture or snapshot.

## 10. Browser Harness Design

A future browser helper may be exposed only as a read-only audit function. Recommended shape:

```js
window.gridlyLiveProjectionParityAudit?.({
  includeDebugRows: false,
  selectedArea: "current",
  fixtureName: null
});
```

The helper must not write to Supabase, mutate runtime arrays, clear data, insert reports, change alerts, change markers, change awareness, enable DriveTexas, or alter Route Watch. It should only read current in-memory outputs and a separately provided future projection adapter.

Recommended return shape:

```json
{
  "available": true,
  "generatedAt": "2026-06-16T00:00:00.000Z",
  "currentSnapshot": {},
  "projectedSnapshot": {},
  "diffs": [],
  "pass": true,
  "stopConditionsTriggered": []
}
```

Availability rules:

- `available: false` when the current app has not loaded enough state to snapshot safely;
- `available: false` when the future projection adapter is absent;
- `pass: false` when any blocking mismatch or stop condition is present;
- warnings may allow `pass: true` only if no blocking mismatch exists and the warning category is explicitly non-user-visible.

## 11. CLI Harness Design

A future Node script can validate fixture snapshots outside the browser. Suggested command shape:

```bash
node scripts/audit/liveProjectionParityHarness.mjs --fixture fixtures/live-projection/single-hazard.json
```

The CLI should:

1. Load a frozen fixture containing report-like input rows and expected runtime context.
2. Run a pure or adapter-backed current pipeline projection without network writes.
3. Run the future live/history projection against the same fixture.
4. Normalize both outputs into the snapshot structures above.
5. Produce a parity diff JSON file.
6. Exit non-zero for blocking mismatches or stop conditions.
7. Exit zero with warnings only when all warning classes are approved as non-blocking.

The CLI must be fixture-based, deterministic, and read-only. It must not create migrations, call Supabase write APIs, mutate real report rows, clear hazards, or activate production feature flags.

## 12. Fixture Strategy

Fixtures should be small, named, deterministic, and targeted to one behavior each before combining scenarios.

| Fixture | Required proof |
| --- | --- |
| Single hazard | One active road hazard becomes one active incident, one marker candidate, expected alert/awareness membership. |
| Duplicate hazard reports | Multiple same-type nearby reports group into one logical incident with correct confirmation/source membership. |
| Same-type nearby hazards | Nearby same-type hazards group or remain separate exactly as current grouping rules require. |
| Different-type same-location hazards | Different hazard types at the same coordinates remain distinct if current behavior treats them as distinct. |
| Hazard clear | A `hazard_cleared` row suppresses the matching active hazard according to current rules. |
| Recently cleared | Recent clear evidence remains represented or suppresses rehydration for the current recent-clear window. |
| Blocked crossing | A blocked crossing report creates the expected crossing incident, alert, awareness entry, and crossing marker ownership. |
| Crossing clear | A latest `cleared` crossing row changes active/cleared state exactly as current crossing lifecycle rules require. |
| Mixed road + crossing | Road hazard and crossing incident near the same location remain separately owned and do not duplicate markers or alerts. |
| Test/malfunction duplicate rows | Development/test/malfunction artifacts are suppressed or included exactly as current runtime rules require. |
| Selected area filtering | Incidents inside/outside selected area produce identical current vs projected visibility, alerts, awareness, and marker eligibility. |

Each fixture should include:

- input report/evidence rows;
- runtime clock;
- selected area/county context;
- expected current snapshot;
- expected future projection snapshot when available;
- expected diff classification;
- explicit stop conditions expected to trigger or not trigger.

## 13. Migration Use

### 13.1 Before Adding Schema

Run fixture-only parity to prove the proposed projection model can represent all current behavior. Do not create schema until the model can describe current active, cleared, confirmation, crossing, alert, awareness, marker, and route-impact semantics.

### 13.2 Before Dual-Write

Run the browser helper in read-only mode and the CLI fixtures. Dual-write should not begin until all blocking mismatches are resolved and compatibility aliases are documented.

### 13.3 Before Switching Reads

Run current and projected snapshots side by side against representative live-like data. Read switching must stop if active counts, marker counts, alert rows, awareness counts, crossing ownership, lifecycle state, confirmations, or route-impact candidates differ.

### 13.4 Before Enabling History

Validate that historical incidents and lifecycle events do not become a second live source. History may explain active incidents, but it must not duplicate active markers, alerts, awareness entries, or route-impact candidates.

## 14. Non-Goals

This design explicitly does not include:

- implementation;
- production code changes;
- Supabase schema changes;
- migrations;
- data migration;
- report insertion changes;
- clearing behavior changes;
- data cleanup or deletion;
- DriveTexas activation;
- Route Watch changes;
- alert redesign;
- marker redesign;
- awareness redesign;
- runtime cutover;
- dual-write behavior.

## 15. Recommended Next Step

The safest next action is to perform a read-only implementation plan for the parity harness interfaces and fixture inventory, still without production behavior changes. That next plan should identify where current snapshots can be collected, where a future projection adapter would plug in, and how fixtures would be stored and executed, but it should not add schema, change writes, switch reads, change alerts, change markers, change awareness, change Route Watch, activate DriveTexas, or delete data.
