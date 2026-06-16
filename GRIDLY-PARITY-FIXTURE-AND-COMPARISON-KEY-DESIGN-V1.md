# GRIDLY Parity Fixture and Comparison Key Design V1

## 1. Executive Summary

This milestone is **design/audit only**. It does not modify production code, Supabase schema, migrations, report insertion, clearing behavior, alerts, markers, awareness, Route Watch, DriveTexas, or production data.

The purpose of this document is to define the exact fixture library and comparison-key contract a future parity harness must use to prove:

```text
Current Pipeline Output = Future Projection Output
```

before any live/history migration, projection cutover, dual-write change, or schema split.

The fixture library intentionally covers small, deterministic cases that exercise the current `reports`-backed runtime contract: road hazards, crossing reports, duplicate suppression, selected-area filtering, county/town modes, confirmations, expiration, clear/recent-clear lifecycle, marker ownership, alerts, awareness, Route Watch inputs, and history eligibility. The comparison keys distinguish fields that must match exactly from fields that may be normalized only when user-facing behavior and ownership remain unchanged.

## 2. Purpose

Parity fixtures are required before migration because the current `reports` pipeline is the production behavioral contract. Gridly cannot safely introduce a future projection if it only proves that rows moved successfully; it must prove that runtime outputs remain equivalent.

A future harness must compare frozen fixture inputs against both:

1. the current report-backed pipeline; and
2. the future live/history projection output.

The comparison must prove equivalence for the objects users and downstream systems experience:

- active hazard/report membership;
- road-hazard clustering;
- unified incident identity;
- alert grouping and counts;
- awareness counts and selected-area membership;
- marker ownership, duplicate suppression, and coordinates;
- crossing lifecycle and crossing ownership;
- confirmation aggregation;
- expiration and recently-cleared suppression;
- route-impact inputs without changing Route Watch behavior;
- history eligibility without rehydrating stale active state.

Without this fixture contract, migration work could accidentally introduce duplicate markers, missing alerts, stale active hazards, resurrected cleared incidents, lost confirmations, mismatched awareness counts, or incorrect crossing ownership while still appearing valid at the database row level.

## 3. Fixture Design Principles

Every parity fixture must be:

- **Deterministic:** Fixed IDs, coordinates, timestamps, selected areas, county/town values, and clock references. The harness must not depend on live Supabase data or wall-clock drift except through an explicit `now` input.
- **Reproducible:** A fixture must produce the same current-pipeline snapshot and future-projection snapshot across local, CI, staging, and replay environments.
- **Small:** Each fixture should contain the minimum reports and crossing metadata necessary to prove one behavior. Large scenario fixtures can exist only as composed suites of small base fixtures.
- **Isolated:** Fixture inputs must not share IDs, cluster keys, crossing IDs, or selected-area names unless the fixture explicitly tests interaction.
- **Representative:** The library must cover all production-sensitive paths: hazards, crossings, clears, confirmations, selected areas, county/town mode, lifecycle expiration, marker ownership, awareness, alerts, Route Watch inputs, and history eligibility.
- **Migration-safe:** Fixtures must not require schema changes, data deletion, production writes, Supabase mutations, or runtime behavior changes. They should be expressed as JSON-like inputs to a future read-only harness.
- **Source-owned:** Each expected output must preserve source report IDs and source ownership paths so equality can be traced from raw reports to incidents, alerts, awareness, and markers.
- **Mode-explicit:** County mode, town mode, selected-area filtering, route context, and active clock must be explicit fixture parameters, not hidden environment state.
- **Lifecycle-explicit:** Expiration, clear timestamps, recent-clear windows, confirmation windows, and rehydration suppression windows must be defined in fixture metadata.
- **Difference-classified:** Every comparison must classify mismatches as blocking failures, warnings, acceptable differences, or informational drift.

## 4. Required Fixture Library

Each fixture definition should include:

- `fixture_id`;
- title and purpose;
- frozen `now` timestamp;
- runtime mode inputs: county, town, selected area, route context, and clock window values;
- report input rows with stable IDs;
- optional crossing inventory rows with stable crossing IDs;
- expected current-pipeline logical outputs;
- expected future-projection logical outputs or required equivalence assertions;
- comparison categories that apply.

### 4.1 Single Hazard

**Purpose:** Prove that one active road hazard becomes one active hazard source row, one road incident, one unified incident, one alert candidate, one awareness item, and one road marker.

**Minimum input:** One non-expired hazard report with fixed `id`, `report_type`, `incident_type`, `lat`, `lng`, `created_at`, `expires_at`, county/town, and detail text.

**Expected parity:** Same active count, incident key, unified road incident, marker owner, alert owner, awareness owner, lifecycle state, and history evidence eligibility.

### 4.2 Duplicate Hazard Reports

**Purpose:** Prove that duplicate reports for the same hazard do not create duplicate user-facing incidents, alerts, awareness items, or markers.

**Minimum input:** Two same-type reports with same or equivalent rounded coordinates inside the current duplicate/cluster tolerance.

**Expected parity:** Two source evidence rows; one grouped road incident; confirmation/source count reflects both rows only if current behavior does; one alert grouping key; one marker key.

### 4.3 Same-Type Same-Location Reports

**Purpose:** Prove grouping for same hazard type at exactly the same coordinates.

**Minimum input:** Two or more reports with identical `report_type`, `incident_type`, `lat`, and `lng` but distinct IDs/timestamps.

**Expected parity:** One cluster key; source membership includes all rows; representative row/latest row matches current ordering; confirmation count and alert text semantics match current output.

### 4.4 Same-Type Nearby Reports

**Purpose:** Prove the boundary between grouped and separate same-type hazards near each other.

**Minimum input:** At least two same-type hazards with coordinates chosen around the current rounded-coordinate or cluster-key boundary.

**Expected parity:** Current and future agree whether the rows form one incident or multiple incidents. If coordinates round to distinct cluster keys, active incident, marker, alert, and awareness counts must remain distinct.

### 4.5 Different-Type Same-Location Reports

**Purpose:** Prove that different hazard types at the same coordinates do not collapse incorrectly.

**Minimum input:** Two active reports with identical coordinates and different `report_type` / `incident_type` values.

**Expected parity:** Separate type-owned incidents, alert keys, awareness items, marker categories, and history evidence groups unless current behavior explicitly groups them.

### 4.6 Flooding

**Purpose:** Prove flood-specific type mapping, alert category, marker icon/category, awareness category, lifecycle state, and route-impact input.

**Minimum input:** One active flooding report.

**Expected parity:** `report_type`, normalized `incident_type`, display category, marker category, alert category, and history type match current behavior.

### 4.7 Debris

**Purpose:** Prove debris-specific mapping and downstream ownership.

**Minimum input:** One active debris report.

**Expected parity:** Same as flooding, but with debris type/category keys.

### 4.8 Traffic Backup

**Purpose:** Prove traffic-backup mapping, active membership, and route-impact input without modifying Route Watch.

**Minimum input:** One active traffic backup report.

**Expected parity:** Traffic backup remains active, counted, alertable, awareness-eligible, marker-eligible, and route-impact eligible according to current rules.

### 4.9 Other Hazard

**Purpose:** Prove fallback/other road-hazard mapping does not get dropped by stricter future type handling.

**Minimum input:** One active report with the current other-hazard type value and valid coordinates.

**Expected parity:** Type normalization may produce a canonical label, but source membership, active status, marker eligibility, alert ownership, awareness ownership, and history eligibility must match.

### 4.10 Downed Power Line

**Purpose:** Prove high-severity hazard category mapping and alert/marker preservation.

**Minimum input:** One active downed power line report.

**Expected parity:** Same severity/trust category if currently derived; same marker category, alert grouping, awareness item, and lifecycle state.

### 4.11 Blocked Crossing

**Purpose:** Prove crossing-owned active blocked-crossing behavior.

**Minimum input:** One active blocked crossing report with `crossing_id`, `crossing_name`, crossing coordinates, county/town, and reviewed crossing metadata.

**Expected parity:** One crossing-owned incident; one crossing marker owned by the crossing layer; no duplicate unified blocked-crossing marker when current duplicate suppression applies; alert and awareness membership match.

### 4.12 Crossing Clear

**Purpose:** Prove crossing clear behavior and latest-crossing-state ownership.

**Minimum input:** A prior blocked crossing report plus a later crossing clear report for the same `crossing_id`.

**Expected parity:** Current and future agree on whether the crossing is active, cleared, recently cleared, visible, alertable, awareness-counted, marker-owned, and history-eligible.

### 4.13 Hazard Clear

**Purpose:** Prove road hazard clear evidence suppresses or closes the matching active hazard according to current lifecycle rules.

**Minimum input:** One active road hazard report and one later `hazard_cleared` row matching the type/location lifecycle target.

**Expected parity:** Active hazard suppression, cleared/recent-clear output, alert removal or cleared-state visibility, awareness behavior, marker removal/cleared marker behavior, and history closure all match current output.

### 4.14 Recently Cleared Hazard

**Purpose:** Prove recent-clear visibility window and recently-cleared road incident generation.

**Minimum input:** One `hazard_cleared` row inside the current recently-cleared window, with optional older matching active hazard evidence.

**Expected parity:** Same `recentlyClearedRoadHazards` membership, same recently-cleared unified incident if current behavior emits it, same suppression targets, and no active rehydration.

### 4.15 Mixed Hazard + Crossing

**Purpose:** Prove independent road and crossing ownership when both occur near the same coordinates or in the same selected area.

**Minimum input:** One active road hazard and one active crossing report, optionally near each other.

**Expected parity:** Road marker remains unified-road owned; crossing marker remains crossing-inventory owned; alerts, awareness, and active counts include both according to current mode/filter rules without duplicate suppression crossing ownership boundaries incorrectly.

### 4.16 Selected Area Filtering

**Purpose:** Prove selected-area inclusion/exclusion for alerts, awareness, and markers where current behavior applies area filtering.

**Minimum input:** At least one incident inside the selected area and one outside, with explicit selected-area geometry or named fixture area.

**Expected parity:** Same selected-area alert count, awareness count, active inventory membership, and marker visibility/filter state. Source data outside the selected area may remain present in raw snapshots but must not appear in selected-area outputs if current behavior excludes it.

### 4.17 County Mode

**Purpose:** Prove county-wide filtering and active inventory behavior.

**Minimum input:** Reports inside and outside the active county, with county mode enabled.

**Expected parity:** Same county-filtered active hazards/reports, alert count, awareness count, marker candidates, and lifecycle outcomes.

### 4.18 Town Mode

**Purpose:** Prove town/municipality mode filtering without changing county ownership.

**Minimum input:** Reports inside and outside the active town boundary or town label, with town mode enabled.

**Expected parity:** Same town-filtered selected outputs and same retained raw/source ownership for diagnostics when current behavior keeps county-level context.

### 4.19 Duplicate Submit Malfunction

**Purpose:** Prove duplicate-submit guard and projection grouping remain safe when the same client/report is accidentally submitted multiple times.

**Minimum input:** Multiple rows with identical or near-identical client/device/user-submission metadata, same type, same coordinates, and very close timestamps.

**Expected parity:** No duplicate user-facing incident, alert, awareness item, or marker beyond current behavior. Source evidence retention and confirmation growth must match current duplicate semantics.

### 4.20 Confirmation Growth

**Purpose:** Prove that confirmations increase incident confidence/counts without creating new incidents.

**Minimum input:** One initial hazard/crossing report plus later confirmation-like reports or confirmation metadata matching current semantics.

**Expected parity:** Same `confirmation_count`, same source evidence membership, same active incident key, same alert/awareness/marker ownership, and same history evidence aggregation.

### 4.21 Lifecycle Expiration

**Purpose:** Prove expiration removes or demotes stale active reports according to current rules.

**Minimum input:** One expired report, one non-expired report, and a fixed `now` timestamp.

**Expected parity:** Expired rows are excluded from active output wherever current behavior excludes them; historical eligibility remains equivalent; active alert, awareness, and marker counts do not include expired-only incidents.

### 4.22 Rehydration Suppression

**Purpose:** Prove a cleared hazard does not reappear as active when older or stale active rows are reloaded.

**Minimum input:** A clear row inside the recent-clear window and one or more matching older hazard rows that would otherwise appear active.

**Expected parity:** Same suppression reason, no active incident rehydration, same recently-cleared lifecycle outcome, same alert/awareness/marker behavior, and same historical closure evidence.

## 5. Comparison Keys

The future harness must compare logical keys, not raw object identity. The keys below define canonical parity fields.

### 5.1 Must Match Exactly

These fields are migration blockers when they differ, unless a later approved compatibility contract explicitly changes the rule:

| Key | Required exact behavior |
| --- | --- |
| `source_report_ids` | Same set of source report IDs per active source collection, incident, alert, awareness item, marker, and history event. |
| `report_type` | Same current report type classification used by lifecycle and grouping. |
| `incident_type` | Same normalized incident type/category used by unified incidents and surfaces. |
| `cluster_key` | Same road-hazard grouping key or an approved one-to-one compatibility alias. |
| `unified_incident_id` | Same current ID, or future ID with exact compatibility alias to the current ID. |
| `lifecycle_state` | Same active, cleared, recently-cleared, expired, suppressed, or historical-only outcome. |
| `alert_key` | Same alert grouping/ownership key or exact compatibility alias. |
| `awareness_key` | Same awareness ownership key or exact compatibility alias. |
| `marker_key` | Same marker render/deduplication key or exact compatibility alias. |
| `marker_owner_type` | Same owner path, such as road unified incident, crossing inventory, neutral crossing infrastructure, or fallback. |
| `crossing_id` | Same reviewed crossing identifier for crossing-owned reports/incidents. |
| `crossing_name` | Same reviewed crossing display name when currently available. |
| `confirmation_count` | Same count under current confirmation semantics. |
| `active_count` | Same active hazard/report/unified incident counts per fixture and mode. |
| `alert_count` | Same alert rows/cards after selected-area filtering and grouping. |
| `awareness_count` | Same awareness inventory and visible active community counts. |
| `marker_count` | Same marker candidate/render-key count after duplicate suppression and filtering. |
| `selected_area_membership` | Same included/excluded result for selected-area outputs. |
| `county_membership` | Same county-filtered inclusion/exclusion result. |
| `town_membership` | Same town-filtered inclusion/exclusion result when town mode is active. |
| `route_impact_membership` | Same route-impact candidate inclusion/exclusion without changing Route Watch behavior. |
| `history_event_key` | Same historical event grouping or exact compatibility alias. |
| `suppression_reason` | Same duplicate, clear, recent-clear, expired, outside-area, or crossing-owner suppression reason when current behavior exposes one. |

### 5.2 May Normalize

These fields may normalize only if the normalized value preserves current user-facing behavior, ownership, and all exact keys above:

| Key | Allowed normalization |
| --- | --- |
| `lat` / `lng` | Raw coordinates may retain source precision; exact source coordinates must remain available. |
| `rounded_lat` / `rounded_lng` | May normalize to the current cluster precision, currently expected to represent tight coordinate bucketing, if cluster and marker outcomes match. |
| display text | Wording may normalize only when counts, ownership, state, type, and grouping are unchanged. |
| timestamp format | ISO/string/epoch representation may normalize if ordering, expiration, recent-clear windows, and lifecycle outcomes match exactly. |
| severity label | May normalize display label only if alert priority, category, and blocking/warning behavior are unchanged. |
| county/town labels | Case/spacing may normalize if membership result and displayed jurisdiction remain equivalent. |
| crossing display metadata | May normalize punctuation/case if `crossing_id`, reviewed identity, and marker/alert ownership match. |
| history summary text | May normalize prose if event grouping, source evidence, lifecycle timestamps, and recurrence keys match. |

### 5.3 Canonical Comparison Record Shape

A future harness should emit comparison records shaped like:

```json
{
  "fixture_id": "single-hazard-flooding-001",
  "surface": "markers",
  "current_key": "road-flooding-30.1234--97.1234",
  "future_key": "road-flooding-30.1234--97.1234",
  "compatibility_alias": null,
  "source_report_ids": ["rpt_flood_001"],
  "comparison_category": "blocking_failure|warning|acceptable_difference|informational",
  "result": "match|mismatch|normalized_match",
  "details": "human-readable explanation"
}
```

## 6. Parity Assertions

A fixture passes only when all required assertions for its category pass.

### 6.1 Count Assertions

- Same active hazard source count.
- Same active report/crossing source count.
- Same recently-cleared source count.
- Same road incident count.
- Same active unified incident count.
- Same alert count after grouping and selected-area filtering.
- Same awareness count and bucket counts.
- Same marker count after duplicate suppression and marker eligibility filtering.
- Same history event count for closed/expired/cleared scenarios.

### 6.2 Membership Assertions

- Same source report membership per incident.
- Same source report membership per alert row/group.
- Same source report membership per awareness item/bucket where exposed.
- Same source report membership per marker owner.
- Same crossing ownership for crossing reports.
- Same selected-area membership.
- Same county/town membership.
- Same route-impact candidate membership.

### 6.3 Lifecycle Assertions

- Same active/cleared/recently-cleared/expired/suppressed outcome.
- Same duplicate suppression outcome.
- Same clear suppression outcome.
- Same rehydration suppression outcome.
- Same expiration outcome at fixture `now`.
- Same latest crossing state outcome.
- Same history eligibility and closure evidence.

### 6.4 Identity Assertions

- Same report, incident, cluster, alert, awareness, marker, crossing, and history keys, or approved one-to-one compatibility aliases.
- Same representative/latest report selection when current behavior chooses a lead report.
- Same marker popup ownership target.
- Same alert owner incident.
- Same awareness top item source when fixture is designed to test top-awareness selection.

### 6.5 Coordinate Assertions

- Same raw coordinates where current output exposes raw source coordinates.
- Same rounded coordinate bucket for cluster and marker keys.
- Same representative coordinate reason where current road-hazard incident output exposes one.
- Same crossing coordinates for crossing-owned markers/incidents.

## 7. Comparison Categories

### 7.1 Blocking Failure

A mismatch that must block migration planning or implementation cutover. Examples:

- active, alert, awareness, or marker counts differ;
- lifecycle state differs;
- a cleared hazard rehydrates as active;
- source report membership changes;
- crossing ownership changes;
- marker duplicate suppression changes;
- selected-area membership changes;
- confirmation count changes;
- history event grouping changes in a way that affects active projection or recurrence evidence.

### 7.2 Warning

A mismatch that may not immediately change visible behavior but requires review before migration proceeds. Examples:

- display text changed while keys/counts match;
- ordering changed for equal-priority items;
- optional diagnostic fields differ;
- future projection emits a compatibility alias that needs documentation;
- route-impact diagnostic metadata differs while candidate membership remains identical.

### 7.3 Acceptable Difference

A documented normalized difference that is safe because user-facing behavior and exact keys remain equivalent. Examples:

- timestamp formatting differs but ordering/window outcomes match;
- coordinate serialization differs but raw and rounded comparisons pass;
- casing or whitespace differs in county/town/crossing labels;
- future IDs differ only through an approved one-to-one compatibility alias.

### 7.4 Informational

A non-gating observation useful for audit history. Examples:

- fixture runtime duration;
- number of raw rows loaded before filtering;
- diagnostic-only confidence fields not used by current behavior;
- additional future history metadata that does not feed active surfaces.

## 8. Fixture Coverage Matrix

| Fixture | Alerts | Awareness | Markers | Lifecycle | Crossings | Route Impact | History |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Single Hazard | Yes | Yes | Yes | Active | No | Candidate | Evidence |
| Duplicate Hazard Reports | Yes | Yes | Yes | Active duplicate grouping | No | Candidate | Evidence aggregation |
| Same-Type Same-Location Reports | Yes | Yes | Yes | Active grouping | No | Candidate | Evidence aggregation |
| Same-Type Nearby Reports | Yes | Yes | Yes | Active grouping boundary | No | Candidate | Separate/combined events |
| Different-Type Same-Location Reports | Yes | Yes | Yes | Active type separation | No | Candidate | Separate events |
| Flooding | Yes | Yes | Yes | Active | No | Candidate | Evidence |
| Debris | Yes | Yes | Yes | Active | No | Candidate | Evidence |
| Traffic Backup | Yes | Yes | Yes | Active | No | Candidate | Evidence |
| Other Hazard | Yes | Yes | Yes | Active/fallback | No | Candidate | Evidence |
| Downed Power Line | Yes | Yes | Yes | Active/high severity | No | Candidate | Evidence |
| Blocked Crossing | Yes | Yes | Crossing-owned | Active blocked | Yes | Candidate | Evidence |
| Crossing Clear | Yes/cleared behavior | Yes/cleared behavior | Crossing-owned/cleared behavior | Latest clear | Yes | Candidate removal or cleared state | Closure event |
| Hazard Clear | Removal or cleared behavior | Removal or cleared behavior | Removal or cleared behavior | Clear suppression | No | Candidate removal | Closure event |
| Recently Cleared Hazard | Cleared/recent behavior | Recent-clear behavior | Hidden or cleared behavior | Recently cleared | No | Candidate removal | Closure event |
| Mixed Hazard + Crossing | Yes | Yes | Road + crossing owners | Active mixed | Yes | Candidates | Evidence |
| Selected Area Filtering | Filtered | Filtered | Filtered/eligible | Active after area filter | Optional | Area-scoped candidate | Evidence retained |
| County Mode | County-scoped | County-scoped | County-scoped | County filtered | Optional | County candidate | Evidence retained |
| Town Mode | Town-scoped | Town-scoped | Town-scoped | Town filtered | Optional | Town candidate | Evidence retained |
| Duplicate Submit Malfunction | Deduped | Deduped | Deduped | Duplicate suppressed/grouped | Optional | Candidate once | Evidence/diagnostic |
| Confirmation Growth | Same owner | Same owner | Same owner | Confirmation count grows | Optional | Candidate unchanged | Evidence aggregation |
| Lifecycle Expiration | Excluded | Excluded | Excluded | Expired | Optional | Candidate removed | Historical/expired event |
| Rehydration Suppression | No active rehydration | No active rehydration | No active rehydration | Suppressed by recent clear | No | Candidate removed | Closure + suppression evidence |

## 9. Migration Confidence Levels

### 9.1 Low

- Only single happy-path fixtures pass.
- Duplicate, clear, crossing, selected-area, and expiration fixtures are missing or failing.
- Migration implementation planning should not begin beyond read-only prototyping.

### 9.2 Medium

- Core hazard and crossing fixtures pass.
- Some warnings remain for display text, ordering, or diagnostic metadata.
- Clear/recent-clear and selected-area fixtures may still require manual review.
- Safe for additional harness development, not safe for schema cutover or production read-path changes.

### 9.3 High

- All required fixtures pass exact or approved normalized comparisons.
- Blocking failures are zero.
- Warnings are documented and assigned owners.
- Current and future outputs match for counts, keys, lifecycle, ownership, duplicate suppression, selected-area behavior, and history eligibility.
- Safe to discuss implementation planning, still not a production migration approval by itself.

### 9.4 Production Ready

- High confidence criteria are met in local, CI, staging, and at least one production-read-only snapshot replay.
- Fixture results are versioned and reproducible.
- Compatibility aliases are documented and stable.
- Rollback/read-path safeguards are designed.
- No blocking failures remain for active surfaces, lifecycle, crossing ownership, or marker duplicate suppression.
- Only after this level should Gridly consider implementation planning for migration phases.

## 10. Future Harness Inputs

### 10.1 Browser Helper Inputs

A browser helper should accept read-only inputs only:

- `fixture_id` or fixture JSON blob;
- frozen `now` timestamp;
- selected county and town mode values;
- selected awareness area name or polygon/key;
- route context fixture, if route-impact membership is being tested;
- current pipeline snapshot helper name/version;
- future projection snapshot helper name/version;
- comparison profile: strict, normalized, or diagnostic.

The helper should return logical snapshots, not mutate app state beyond loading fixture context in a test harness.

### 10.2 CLI Fixture Inputs

A CLI harness should accept:

- path to fixture library directory;
- path to current-pipeline adapter output;
- path to future-projection adapter output;
- frozen clock value;
- selected mode config file;
- output path for JSON diff;
- fail-level threshold, normally `blocking_failure`.

Example future shape:

```text
node scripts/parity-harness.js \
  --fixtures fixtures/parity/v1 \
  --current snapshots/current.json \
  --future snapshots/future.json \
  --now 2026-06-16T12:00:00.000Z \
  --mode county \
  --selected-area fixture_area_main \
  --fail-on blocking_failure
```

### 10.3 JSON Snapshot Inputs

JSON snapshots should include these top-level sections:

```json
{
  "metadata": {
    "fixture_id": "single-hazard-flooding-001",
    "snapshot_version": "parity-v1",
    "pipeline": "current|future",
    "now": "2026-06-16T12:00:00.000Z",
    "mode": "county|town|selected_area",
    "selected_area": "fixture_area_main"
  },
  "inputs": {
    "reports": [],
    "crossings": [],
    "route_context": null
  },
  "outputs": {
    "active_hazards": [],
    "active_reports": [],
    "recently_cleared_road_hazards": [],
    "road_incidents": [],
    "unified_incidents": [],
    "active_unified_incidents": [],
    "alerts": [],
    "awareness": [],
    "markers": [],
    "route_impact_candidates": [],
    "history_events": [],
    "suppressions": []
  }
}
```

Each output row should carry enough comparison keys to trace source evidence, owner identity, lifecycle, selected-area membership, and display/render eligibility.

## 11. Recommended Next Step

After V362, Gridly has enough documentation to **begin implementation planning discussion** for a read-only parity harness, but not enough to implement a migration or schema split.

Recommended sequence:

1. Stop broad auditing unless a specific unknown is discovered.
2. Plan a read-only harness implementation that consumes fixture JSON and emits current/future snapshots.
3. Build fixture files from this design without production writes.
4. Run the harness against the current pipeline only first, creating a golden current-output library.
5. Only after stable golden current outputs exist should future projection implementation planning begin.

The merge recommendation for this milestone is to merge the documentation-only design if review confirms that no production code, Supabase schema, migrations, alerts, markers, awareness, Route Watch, DriveTexas, clearing behavior, or report insertion behavior changed.
