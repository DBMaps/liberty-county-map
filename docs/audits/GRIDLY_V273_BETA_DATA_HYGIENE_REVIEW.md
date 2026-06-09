# GRIDLY V273 — Beta Data Hygiene Review

Audit date: 2026-06-09 UTC  
Branch: `feature/v273-beta-data-hygiene-review`  
Scope: audit-only review of visible report/test data surfaces before inviting first beta testers.  
Mutation policy: **no Supabase writes, no report deletes, no report updates, no purge executed.**

## SECTION 1 — Data Inventory

### Live data access result

The application’s live report source is Supabase table `reports`. The client reads active/non-expired rows and recent road-clear rows from that table, then normalizes them into crossing reports, active roadway hazards, and recently cleared roadway hazards.

Live Supabase inventory could **not** be completed from this execution environment because outbound access to `https://nhwhkbkludzkuyxmkkcj.supabase.co` failed before any read query reached PostgREST:

- `curl` through the configured proxy returned `CONNECT tunnel failed, response 403`.
- Direct DNS resolution failed because the container DNS resolver was unavailable / refused queries.
- No local fixture, dump, seed file, or checked-in report dataset exists in the repository.

Therefore, the exact numeric answers for currently persisted production rows are **not safely knowable from this branch alone**. This document records the visible-data rules, exact read-only queries needed to finish the inventory, and the recommended beta baseline strategy without mutating data.

### Tables / stores identified

| Store | Purpose | Public client visibility | Beta hygiene classification |
| --- | --- | --- | --- |
| `public.reports` | Community crossing and roadway hazard reports. | Public client reads active rows where `expires_at > now`; also reads recent `hazard_cleared` rows from the last 90 minutes. | **ARCHIVE then PURGE/RESET dev-test rows before beta** if rows are confirmed as development artifacts. |
| `public.gridly_feedback` | Beta feedback intake. | Anonymous insert-only; no public select/update/delete policy in migration. | **KEEP**; do not purge for visible-map hygiene because users cannot read it from the client. |
| Browser `localStorage` route/place keys | Per-device saved places, route-watch state, settings, alert preferences. | Device-local only; a brand-new tester has none. | **KEEP / RESET per tester device only if needed**; not a shared backend purge target. |
| Static crossing/road datasets under `data/` | Basemap crossing and road-segment inventory. | Visible as map/infrastructure data, not user reports. | **KEEP**. |

### Exact read-only inventory queries to run when Supabase is reachable

Use the publishable key already embedded in the client. These are read-only `GET` requests and must not be followed by delete/update statements during this audit phase.

```bash
SUPABASE_URL='https://nhwhkbkludzkuyxmkkcj.supabase.co'
SUPABASE_KEY='sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO'
NOW_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RECENT_CLEAR_CUTOFF_ISO="$(date -u -d '90 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"

curl -sS "$SUPABASE_URL/rest/v1/reports?select=*&order=created_at.desc" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY"

curl -sS "$SUPABASE_URL/rest/v1/reports?select=*&expires_at=gt.$NOW_ISO&order=created_at.desc" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY"

curl -sS "$SUPABASE_URL/rest/v1/reports?select=*&report_type=eq.hazard_cleared&created_at=gte.$RECENT_CLEAR_CUTOFF_ISO&order=created_at.desc" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY"
```

## SECTION 2 — Active Reports

### Current count

**Unable to determine in this environment.** The exact count requires a successful read of `reports` rows where `expires_at > now` plus lifecycle normalization.

### Client visibility rule

The app loads live rows from `reports` where `expires_at` is greater than the current timestamp, orders by `created_at` descending, and limits the response to 300 rows. Rows then pass through `normalizeReports()` and are split into:

- `activeReports` for non-hazard crossing reports.
- `activeHazards` for active roadway hazard reports after latest-lifecycle and recent-clear suppression.

### Classification

| Active report subset | Classification | Rationale |
| --- | --- | --- |
| Development test reports | **ARCHIVE + PURGE from beta-visible table** | They would appear as live community activity and mislead beta testers. |
| Internal validation reports | **ARCHIVE + PURGE from beta-visible table** | Useful for QA history, not appropriate as live beta data. |
| Marker testing reports | **ARCHIVE + PURGE from beta-visible table** | Specifically contaminates marker and feed truth. |
| Lifecycle testing reports | **ARCHIVE + PURGE from beta-visible table** | Can produce false active/recently-cleared/expired states. |
| Crossing naming validation reports | **ARCHIVE + PURGE from beta-visible table** | Preserve in archive if useful; do not launch beta with them visible. |
| Community-generated active reports | **KEEP** | Real beta/community data is the desired launch baseline. |

## SECTION 3 — Recently Cleared Reports

### Current count

**Unable to determine in this environment.** The exact visible count requires querying `reports` for `report_type = 'hazard_cleared'` rows created within the last 90 minutes and then applying Gridly’s road-clear lifecycle matching.

### Client visibility rule

Recently cleared roadway hazards are separately fetched from `reports` when `report_type = 'hazard_cleared'` and `created_at` is within the last 90 minutes. They are added to the raw row set even if their `expires_at` is no longer in the active read window.

### Classification

| Recently cleared subset | Classification | Rationale |
| --- | --- | --- |
| Development/test cleared rows | **ARCHIVE + PURGE from beta-visible table** | They create false “cleared by drivers” trust signals. |
| Legitimate recently cleared community reports | **KEEP** | They are part of real community lifecycle history. |
| Old cleared rows outside visible window | **ARCHIVE** | Not visible to ordinary users under current client rules, but still backend history. |

## SECTION 4 — Expired Reports

### Current count

**Unable to determine in this environment.** Count all rows in `reports` where `expires_at <= now`, excluding the special recent road-clear visibility case if computing “user-visible expired.”

### Client visibility rule

Expired ordinary reports are **not fetched** by the primary live query because the client uses `expires_at > now`. The normalized model marks rows expired if `expires_at <= Date.now()`, but expired ordinary rows are generally absent from the client payload unless they came through a separate code path.

### Classification

| Expired report subset | Classification | Rationale |
| --- | --- | --- |
| Expired development/test reports | **ARCHIVE + PURGE from production `reports` after archive** | Not currently visible in normal active map state, but they pollute backend history and future audits. |
| Expired legitimate community reports | **ARCHIVE / KEEP depending on retention policy** | Useful for historical intelligence only if privacy and retention policy approve. |
| Expired rows with unknown origin | **ARCHIVE first, then review** | Do not purge unknown-origin history without export/review. |

## SECTION 5 — Crossing Reports

### Current count

**Unable to determine in this environment.** In Gridly’s normalization, any report whose `report_type` is not a recognized roadway hazard type and is not `hazard_cleared` becomes `reportKind: 'crossing'`.

### Visible crossing categories

Crossing reports include active blocked/heavy/delay/other rail-crossing states and cleared crossing states. The app treats active/recently-cleared crossing reports as relevant crossing markers and unified rail incidents.

### Classification

| Crossing report subset | Classification | Rationale |
| --- | --- | --- |
| Crossing naming validation reports | **ARCHIVE + PURGE from beta-visible table** | These are explicitly development artifacts and can make crossing labels look community-generated. |
| Internal crossing flow/lifecycle tests | **ARCHIVE + PURGE from beta-visible table** | They affect active crossing markers and user trust. |
| Legitimate community crossing reports | **KEEP** | They are core beta signal. |
| Static crossing inventory (`data/liberty-county-rail-crossings.geojson`) | **KEEP** | Not user-generated report data. |

## SECTION 6 — Hazard Reports

### Current count

**Unable to determine in this environment.** Recognized roadway hazard report types are `flooding`, `ice`, `debris`, `crash`, `construction`, `road_closed`, `disabled_vehicle`, `traffic_backup`, `other_hazard`, legacy `wreck`, and lifecycle row `hazard_cleared`.

### Visible hazard categories

The client recognizes these production hazard categories:

- Flooding
- Ice
- Debris in Road
- Crash / Wreck
- Construction
- Road Closed
- Disabled Vehicle
- Traffic Backup / Heavy Delay
- Train Blocking Crossing / rail blockage delay
- Rail Issue
- Other Hazard

### Classification

| Hazard report subset | Classification | Rationale |
| --- | --- | --- |
| Roadway hazard development rows | **ARCHIVE + PURGE from beta-visible table** | They display as active hazards or trust/lifecycle state. |
| Marker testing hazards | **ARCHIVE + PURGE from beta-visible table** | They directly contaminate production marker presentation. |
| Lifecycle testing hazards and `hazard_cleared` rows | **ARCHIVE + PURGE from beta-visible table** | They can suppress active hazards or create false recently-cleared markers. |
| Legitimate community hazard rows | **KEEP** | Desired beta data. |

## SECTION 7 — Development/Test Artifacts

### Current count

**Unable to determine in this environment** because no live `reports` read succeeded.

### Artifact indicators to use during the final live inventory

Flag a report as development/testing artifact if any of the following are true:

1. `detail`, `crossing_name`, or metadata contains strings such as `test`, `marker`, `validation`, `lifecycle`, `demo`, `sample`, `dev`, `QA`, `debug`, `Gridly V`, or version labels.
2. `device_id` matches known internal developer/test devices.
3. Many rows share identical coordinates, near-identical timestamps, or repeated report sequences that match validation scripts/manual tests.
4. Rows were created before public beta invitation and cannot be attributed to known legitimate pre-beta community observers.
5. Rows were created in bursts around marker, lifecycle, crossing naming, purge-helper, or route-watch audit work.

### Classification by requested category

| Category | Classification | Notes |
| --- | --- | --- |
| Development test reports | **ARCHIVE + PURGE** | Export first, then remove from beta-visible `reports`. |
| Internal validation reports | **ARCHIVE + PURGE** | Keep archive for QA traceability. |
| Marker testing reports | **ARCHIVE + PURGE** | Do not show as community map markers. |
| Lifecycle testing reports | **ARCHIVE + PURGE** | Can affect active/cleared suppression logic. |
| Crossing naming validation reports | **ARCHIVE + PURGE** | Preserve in archive if needed for naming regressions. |
| Community-generated reports | **KEEP** | Do not purge. |
| Feedback records | **KEEP** | Insert-only and not user-visible; preserve beta feedback. |
| Route Watch records | **KEEP / LOCAL RESET ONLY** | Route Watch state is browser-local in reviewed code; a new tester starts clean. |

## SECTION 8 — User-Visible Data

### What report history is currently visible to users?

Under current client code, ordinary users can see:

1. Non-expired `reports` rows where `expires_at > now`, capped at the 300 newest rows.
2. Recent road-clear rows where `report_type = 'hazard_cleared'` and `created_at` is within the last 90 minutes, capped at 100 newest rows.
3. Static crossing/road map datasets regardless of report history.
4. Device-local Route Watch and saved-place state only on the same browser/device where it was created.

Ordinary users should **not** be able to read feedback submissions through the client because the feedback migration creates an anonymous insert policy only and explicitly defines no public select/update/delete policy.

### What report history would be visible to a brand-new beta tester?

A brand-new beta tester would have empty local browser state, but would still see shared backend report data from `public.reports` that passes the current live/recent-clear read windows:

- Active crossing reports.
- Active roadway hazard reports.
- Recently cleared roadway hazard reports for 90 minutes.
- No previous Route Watch local history from other users.
- No public feedback history.

## SECTION 9 — Recommended Beta Baseline

### If beta started tomorrow, what would users see?

If beta started tomorrow with the current backend unchanged, new testers would see whatever rows currently exist in `public.reports` that match the app’s live visibility windows. Based on the stated project understanding that most or all visible reports were created during development/testing, that means beta testers would likely see development artifacts presented as live community reports, active hazard markers, crossing incidents, and/or recently-cleared trust signals.

Because the live count could not be read from this environment, the safe launch decision is:

> **Do not invite first beta testers until a live read-only `reports` inventory confirms either zero visible development artifacts or that all development artifacts have been archived and removed from the beta-visible `reports` table.**

### Recommended baseline state

| Data class | Baseline recommendation |
| --- | --- |
| Static crossings and road segments | Keep. |
| `gridly_feedback` | Keep. |
| Browser-local Route Watch/settings | No shared purge needed; brand-new testers start clean. |
| Legitimate community reports | Keep. |
| Development/test report rows | Archive, then remove from production `reports` before beta. |
| Unknown-origin pre-beta report rows | Archive first, then manually classify before removal. |

## SECTION 10 — Purge Recommendation

**Recommendation: Partial Purge Recommended — conditional on completing the live read-only inventory.**

Why not “No Purge Needed”:

- The goal of beta is real community activity, not months of development artifacts.
- The app presents active/recent rows as shared live reports and trust/lifecycle signals.
- Development rows in `reports` would be indistinguishable from real community activity to new testers.

Why not “Full Reset Recommended”:

- Static map datasets should be retained.
- Feedback records are not public-readable and should be retained for product learning.
- Route Watch state is device-local and does not create shared beta contamination for brand-new testers.
- Legitimate community report rows, if any exist, should be preserved.

## SECTION 11 — Exact Purge Plan

**Do not execute during this audit. Plan only.**

### Phase A — Read-only export/archive

1. Export all current `reports` rows to a timestamped archive file outside the public app bundle, for example:
   - `gridly_reports_archive_2026-06-09T<time>Z.json`
2. Include every column returned by `select=*`.
3. Store the archive in an access-controlled location, not in the public repository if it contains device IDs or sensitive user text.
4. Compute and record:
   - total rows
   - min/max `created_at`
   - min/max `expires_at`
   - counts by `report_type`
   - counts by `source`
   - counts by `device_id`
   - active rows where `expires_at > now`
   - recent `hazard_cleared` rows where `created_at >= now - 90 minutes`

### Phase B — Classification

Classify every `reports` row into exactly one bucket:

| Bucket | Action |
| --- | --- |
| `community_legitimate` | Keep in `reports`. |
| `development_test` | Purge from `reports` after archive. |
| `internal_validation` | Purge from `reports` after archive. |
| `marker_testing` | Purge from `reports` after archive. |
| `lifecycle_testing` | Purge from `reports` after archive. |
| `crossing_naming_validation` | Purge from `reports` after archive. |
| `unknown_pre_beta` | Archive and hold for manual review; purge only after owner approval. |

### Phase C — Purge target

Only target:

- Table: `public.reports`
- Records: rows classified as development/test/internal validation/marker testing/lifecycle testing/crossing naming validation.

Do **not** target:

- `public.gridly_feedback`
- static files in `data/`
- route-watch localStorage keys on tester devices
- legitimate community rows
- unknown-origin rows before manual approval

### Phase D — Preferred SQL strategy for an approved future purge

Use explicit IDs from the classification file; do not rely only on broad date filters.

```sql
-- Example only. Do not execute during this audit.
begin;

-- Optional: create an internal archive table first if project policy allows.
-- create table if not exists public.reports_archive_beta_prelaunch as
-- select *, now() as archived_at, 'v273_beta_data_hygiene' as archive_reason
-- from public.reports
-- where false;

-- insert into public.reports_archive_beta_prelaunch
-- select *, now() as archived_at, 'v273_beta_data_hygiene' as archive_reason
-- from public.reports
-- where id = any(:approved_dev_test_report_ids);

-- delete from public.reports
-- where id = any(:approved_dev_test_report_ids);

-- rollback during dry run; commit only after reviewed counts match expectations.
rollback;
```

### Phase E — Post-purge verification

After an approved purge in a later branch/task:

1. Re-run the read-only inventory queries.
2. Confirm zero beta-visible development/test rows.
3. Confirm legitimate community rows remain.
4. Launch a fresh browser profile and verify the map shows only retained active/recent reports plus static infrastructure.

## SECTION 12 — Files / Systems Reviewed

- `js/app.js`
  - Supabase client URL/key.
  - `loadSharedReports()` live report reads.
  - `normalizeReports()` crossing/hazard split.
  - roadway hazard type lists and lifecycle filters.
  - `getIncidentLifecycleState()` active/recently-cleared/cleared/inactive behavior.
  - route-watch/localStorage usage.
- `supabase/migrations/202606070001_create_gridly_feedback.sql`
  - feedback table schema.
  - anonymous insert-only policy.
  - no public select/update/delete policy.
- `data/liberty-county-rail-crossings.geojson`
  - static crossing inventory exists and is not report history.
- `data/liberty-county-road-segments.geojson`
  - static road segment inventory exists and is not report history.
- `index.html`
  - user-visible report, cleared, crossing, hazard, feedback, and Route Watch surfaces.
- Supabase REST endpoint `https://nhwhkbkludzkuyxmkkcj.supabase.co/rest/v1/reports`
  - attempted read-only access; blocked by environment network/proxy/DNS before data retrieval.

## SECTION 13 — git status --short

Status before creating this audit document was clean. After adding this document, expected status is:

```text
?? docs/audits/GRIDLY_V273_BETA_DATA_HYGIENE_REVIEW.md
```
