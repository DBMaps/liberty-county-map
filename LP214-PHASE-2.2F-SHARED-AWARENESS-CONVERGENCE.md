# LP214 Phase 2.2F — Shared Awareness Convergence

## Root-cause classification

* **Pulse: `MISSING_DRIVETEXAS_SHARED_AWARENESS_PROPAGATION`.** The official publisher appended DriveTexas rows to `activeHazardsInArea` only after `buildGridlyCommunityPulseModel` had already built `activeAwareness`. Quiet eligibility and copy continued to use `selectedCommunityCount` and the earlier `activeAwareness.activeAwarenessCount`, so eight official rows could coexist with the broad quiet sentence.
* **Location Context: `SECONDARY_RENDER_OVERWRITE`.** Although summary normalization reconciled the larger count, `refreshGridlyPortraitLocationAwarenessPanel` selected the finite Alerts grouped count first. Four Alerts therefore replaced the shared eight-row minimum. Alerts and shared awareness have different ownership and must not be equated.
* **Certification:** the old comparison treated an unavailable shared count as permission to skip comparison. Phase 2.2F requires a numeric shared count; missing shared or presentation evidence is `CERTIFICATION_INDETERMINATE`, never PASS.

## Authoritative active-issue contract

`communityAwarenessSummary.sharedActiveIssueContract` is the shared, area-scoped presentation contract. It is derived from the existing governed summary and DriveTexas consumer envelope, not a new incident registry. It exposes the distinct lifecycle-active official-roadway, community-report, crossing-report, and other-hazard counts and their sum. DriveTexas source status also governs whether a zero is quiet-eligible.

Identity is deduplicated within each owned source category. Official roadway evidence is not converted into a community report. Cleared, expired, inactive, historical, removed, resolved, cancelled, and ineligible records are excluded before the contract. A DriveTexas refresh increments the shared-model input revision; a community transition changes the area identity/signature and rebuilds area-scoped evidence.

## Source ownership matrix

| Consumer | DriveTexas official roadway | Community reports | Crossing-derived reports | Weather/NWS | Other hazards | Alerts | Cleared/expired |
|---|---:|---:|---:|---:|---:|---:|---:|
| Awareness Brief / broad shared status | Secondary evidence, included | Included | Included | Not added in 2.2F | Included when governed summary owns it | Evidence may contribute, not count authority | Excluded |
| Community Pulse broad state | Included for overall active/quiet decision; wording does not call it a community report | Included and remains community-owned | Included and remains crossing-owned | Not added in 2.2F | Included | Not an ownership transfer | Excluded |
| Location Context “active issues nearby” | Included | Included | Included | Not added in 2.2F | Included | Grouped Alerts are narrower supporting evidence and cannot overwrite shared total | Excluded |
| Alerts sheet | **Not included by this repair** | Primary | Existing crossing/report behavior only | Existing behavior unchanged | Existing behavior unchanged | Primary grouped-alert registry | Excluded by existing lifecycle |
| Know Before You Go | Primary official-roadway consumer | Existing supporting behavior | Existing behavior | Existing behavior unchanged | Existing behavior | Not count authority | Excluded by governed envelope |

## Statewide guarantee

The contract consumes the selected canonical awareness area and the governed DriveTexas eligible envelope. It contains no county, Dallas, metro, or community allowlist. The existing inventory certifies 254 counties, 1,859 canonical communities, 2,058 memberships, and 163 multi-county identities. Multi-county canonical identity remains input ownership; Phase 2.2F adds no identity mapping or membership mutation.

## Dallas before / after contract

| Signal | Before | After |
|---|---|---|
| DriveTexas eligible | 8 | 8 |
| Broad awareness | “No active local issues reported” | Active local conditions; shared official-roadway count 8 |
| Location Context with four grouped Alerts | 4 | At least the authoritative shared total (8; additive distinct community/crossing/other sources may make it higher) |
| Alerts | 4 grouped Alerts | Unchanged; DriveTexas is not inserted |

## Protected surfaces and owner retest

No Weather/NWS, LP215, route runtime, crossing-popup, report creation, Alerts ownership, or merge work is included. Owner browser retest should select canonical Dallas `place-4819000` / `dallas-tx`, refresh DriveTexas, and read `gridlyCommunityPulseAuditState.communityAwarenessSummary.sharedActiveIssueContract`. Confirm `activeOfficialRoadwayCount === 8`, compare the numeric `activeIssueCount` to Location Context, verify broad copy is not quiet, verify Community-specific evidence remains labeled as community evidence, and run `gridlyAwarenessAlertsCountSyncAudit()`. The last audit must return PASS only when both shared and displayed counts exist and match; null evidence must return `CERTIFICATION_INDETERMINATE`.
