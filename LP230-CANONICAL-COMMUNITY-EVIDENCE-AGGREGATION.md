# LP230 — Canonical Community Evidence Aggregation

## Recommendation

**LP230 NEEDS MORE INVESTIGATION. DO NOT MERGE UNTIL OWNER BROWSER ACCEPTANCE.**

The repository certifies 1,859 canonical PLACE identities, 2,058 memberships, 163 multi-county identities, and 254 counties. Its committed runtime artifacts retain Census PLACE identity and presentation points, but do not retain the governed 2025 TIGER/Line PLACE polygon bytes. Consequently, exact point-in-PLACE aggregation cannot be honestly activated. The shared projection fails closed with `COMMUNITY_GEOMETRY_AUTHORITY_UNAVAILABLE`; it never substitutes presentation radii or membership-county unions.

## Evidence families

* **Crossings:** canonical count/IDs are unavailable. The existing selected-membership presentation count is retained separately, rendering stays viewport/zoom-owned, and FRA identity is the declared future dedupe authority.
* **DriveTexas:** statewide/shared acquisition, existing coordinate/geographic relevance, provider identity, and lifecycle remain unchanged. Selected membership does not partition the connector. The separate marker-identity issue remains open.
* **Local hazards:** the projection reads the governed-active lifecycle set and retains stable governed identity and lineage. Multi-county completeness fails closed with `MEMBERSHIP_SOURCE_UNAVAILABLE`; no expired, cleared, stale, inactive, or invalid record is resurrected.
* **Blocked-crossing reports:** report geography is distinct from static crossing membership. Without runtime PLACE geometry the projection returns `COMMUNITY_GEOMETRY_AUTHORITY_UNAVAILABLE` and makes no static PLACE inference.
* **Weather:** current/forecast retains canonical presentation-coordinate/provider authority. Advisories retain provider point, polygon, zone, forecast-zone, and county-warning authority and fail closed with `PROVIDER_GEOGRAPHY_UNRESOLVED` rather than importing sibling-county weather.

## Architecture and performance

`gridlyGetCanonicalCommunityEvidenceProjection()` is the single deterministic read projection. `window.gridlyLP230CanonicalCommunityEvidenceAudit()` composes it without fetches, source reloads, persistence, state changes, DOM/map writes, writers, polling, or timers. It scans only already-loaded evidence for the selected canonical identity and does not parse geometry or scan 254 counties.

Consumer classifications are `PARITY`, `POLICY_EXCLUDED`, or `FAIL_CLOSED`; none is reported `DIVERGENT`. Alerts and KBYG retain their accepted LP226/LP227 owners and presentation contracts.

## Statewide and controls

All 1,859 communities fail closed for polygon-dependent aggregation; all 163 multi-county identities therefore fail closed rather than returning membership-sensitive canonical counts. Katy, Corpus Christi, Austin, Abilene, and Midland receive the same generic result. Sulphur Springs, Liberty, Fredericksburg, and Pecos retain existing behavior. No live incident count is fabricated. Exact totals are in `data/generated/lp230-statewide-canonical-community-evidence-certification.json`.

Katy before LP230 had a selected-membership/presentation-radius crossing subset (observed baseline: 4 under Harris). After LP230 the shared canonical crossing count is explicitly unavailable, not incorrectly reported as 4 or a county union. DriveTexas retains its existing statewide relevance path, including FM0529 while the provider record remains active/relevant. No owner-browser result is fabricated for Corpus Christi, Austin, Abilene, Midland, or the single-county controls.

## Owner browser acceptance block

Use this same block after selecting Katy, Corpus Christi, or Austin and explicitly selecting each governed membership:

```js
(() => {
  const audit = window.gridlyLP230CanonicalCommunityEvidenceAudit?.();
  console.table({
    canonicalCommunity: audit?.canonicalCommunity,
    canonicalKey: audit?.canonicalKey,
    selectedMembership: audit?.selectedMembership,
    allGovernedMemberships: audit?.allGovernedMemberships?.join(", "),
    activeCounty: audit?.activeCounty,
    canonicalCrossingCount: audit?.crossings?.count,
    crossingIds: audit?.crossings?.ids?.join(", "),
    crossingsBySourceCounty: audit?.crossings?.sourceCounties?.join(", "),
    crossingMembershipInvariant: audit?.crossings?.selectedMembershipInvariant,
    driveTexasCount: audit?.driveTexas?.count,
    driveTexasIds: audit?.driveTexas?.ids?.join(", "),
    driveTexasMembershipInvariant: audit?.driveTexas?.selectedMembershipInvariant,
    localHazardCount: audit?.localHazards?.count,
    localHazardIds: audit?.localHazards?.ids?.join(", "),
    localHazardMembershipInvariant: audit?.localHazards?.selectedMembershipInvariant,
    weatherAuthority: audit?.weather?.currentForecast?.authority,
    weatherMembershipInvariant: audit?.weather?.currentForecast?.selectedMembershipInvariant,
    providerAuthorityPreserved: audit?.weather?.advisories?.providerGeographyPreserved,
    alerts: audit?.consumers?.alerts, kbyg: audit?.consumers?.kbyg,
    communityPulse: audit?.consumers?.communityPulse, topAwareness: audit?.consumers?.topAwareness,
    locationContext: audit?.consumers?.locationContext, map: audit?.consumers?.map,
    governancePreserved: audit?.governancePreserved, overallPass: audit?.overallPass
  });
  return audit;
})()
```

## Explicit protections

**NO BLIND COUNTY UNION WAS INTRODUCED. NO WEATHER PROVIDER GEOGRAPHY WAS WEAKENED. NO LP226 ALERTS CONTRACT WAS CHANGED. NO LP227 KBYG PRESENTATION CONTRACT WAS CHANGED. NO MULTI-COUNTY GOVERNANCE WAS CHANGED. NO DRIVETEXAS MARKER ARCHITECTURE CHANGE WAS INCLUDED. NO UNRELATED PRODUCTION CHANGE WAS APPLIED.**
