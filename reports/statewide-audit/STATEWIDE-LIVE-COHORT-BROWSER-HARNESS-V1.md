# Statewide live cohort browser harness v1

## Scope and counts

This is an **audit-only** browser observer. It loads the committed 14-row cohort JSON, validates 14 distinct state vectors, preserves the one row classified as existing owner evidence, and executes the other 13 rows. It does not change production files or production state directly. The production community-selection owner, `selectGridlySettingsAwarenessArea(...)`, is the only selection action.

| Measure | Value |
|---|---:|
| Cohort rows loaded | 14 |
| State vectors | 14 |
| Existing owner-evidence rows | 1 |
| Newly executable rows | 13 |
| Automatically observed rows | 13 |
| Rows requiring manual action | Dynamic, 0–13; only a live nonzero exact map target causes a pause |
| Estimated owner run time | 45–70 minutes, depending on live settlement and manual controls |

The harness reuses LP215's safe observation strategy: canonical production selection, bounded polling, active-county and roadway ownership, truthful DriveTexas terminal classification, Official Roadway/Alerts/rail publication snapshots, stale identity comparisons, session checkpointing, stop/status, and deterministic JSON serialization. It deliberately does **not** reuse LP215's 254-row count, FIPS wraparound, universal assertions, or universal interaction flow.

## One-copy-paste owner bootstrap

Open the deployed Gridly application, open DevTools Console, and paste this block once:

```js
(() => {
  const script = document.createElement('script');
  script.src = '/tools/statewide-audit/statewide-live-cohort-browser-harness.js';
  script.dataset.gridlyAuditOnly = 'statewide-live-cohort-v1';
  document.head.appendChild(script);
})();
```

The script loads `/reports/statewide-audit/gridly-live-certification-cohort-v1.json`, fails closed on a malformed contract, restores a valid completed prefix from `sessionStorage`, skips duplicate execution of the existing owner-evidence row, and begins at the first row needing new evidence. It never clicks the Settings picker and never writes production state or `localStorage`.

## Owner commands

```js
gridlyStatewideCohortStatus()
gridlyStatewideCohortContinue()
gridlyStatewideCohortStop()
gridlyStatewideCohortResume()
gridlyStatewideCohortExport()
gridlyStatewideCohortExport(false)
gridlyStatewideCohortClearCheckpoint()
```

- `Status` reports progress and whether a manual control is pending.
- `Continue` is accepted only while paused. Perform the exact printed action first; the harness then captures existing-marker reuse, viewport containment, popup state, unchanged context, duplication, and source-request sequence.
- `Stop` safely stops after the current polling boundary. `Resume` continues.
- `Export()` downloads one JSON artifact. `Export(false)` returns the same formatted JSON without downloading it.
- `ClearCheckpoint` deletes only `GRIDLY_STATEWIDE_COHORT_AUDIT_V1`.

## Manual-action protocol

When a current row has a nonzero Official Roadway map target, the harness prints:

```text
[MANUAL ACTION REQUIRED]

Community:
<current cohort community>

Action:
In Alerts, choose Show on map for the captured Official Roadway alert. Do not change community or county. Then run gridlyStatewideCohortContinue().
```

The harness cannot advance until the owner explicitly calls `gridlyStatewideCohortContinue()`. A governed no-target result completes without a manufactured click or false target.

## Settlement and result policy

Settlement is row-specific. `ACTIVE_EMPTY` rail terminates at exact zero without renderer activity. `ACTIVE_POSITIVE` requires current-county inventory and exact policy/Leaflet/DOM identity parity. `ROADWAY_EXPECTED_EMPTY` accepts a current-owned expected-empty package; `ROADWAY_WITH_DATA` requires the current source, terminal loaded state, and positive inventory. DriveTexas keeps `HEALTHY_WITH_DATA`, governed successful-fetch `HEALTHY_EMPTY`, `FAILED`, `RETAINED`, `UNAVAILABLE`, and `TIMEOUT` distinct.

Each of the six committed live classes is exported as `NOT_REQUIRED`, `PASS`, `FAIL`, or `INCOMPLETE`. Missing runtime observation and timeouts remain incomplete rather than being promoted to production failures. Transitions use only the row's committed `transitionAssertions`; predecessor community, county, roadway/rail source, DriveTexas IDs, alert rows, and marker IDs are captured for isolation checks.

Progress is persisted after every preserved, passed, failed, or incomplete row. Reloading the app and pasting the same bootstrap validates the saved `(sequence, stateVectorId, canonicalKey)` prefix against the freshly loaded cohort before resuming. A mismatch fails closed.

## Owner boundary

Do not use this tooling to run live certification in CI. The owner runs it in the deployed application, performs only actions explicitly requested by a pause, and exports one result. Any observed production defect is evidence for a later production task; this audit harness does not patch it.
