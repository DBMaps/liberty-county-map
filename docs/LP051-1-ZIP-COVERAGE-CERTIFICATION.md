# LP051.1 — ZIP Coverage Authority & Dataset Certification

## Executive conclusion

LP051.1 expands the passive ZIP awareness foundation from 4 seed records to a 34-record governed launch index. The index now covers all 28 selectable operational counties with at least one representative ZIP-to-existing-awareness assignment and includes explicit Harris/Houston regional assignments plus one intentionally ambiguous Katy/west-Harris sample.

Certification status is **partial**, not full. The dataset is internally valid and mergeable as a passive data authority milestone, but it is **not ready for visible ZIP onboarding or Settings integration** because full community and awareness-area coverage still requires an authoritative USPS/ZCTA crosswalk import and additional governance of split ZIPs.

## Source authority

The runtime source is `GRIDLY_LP051_ZIP_AWARENESS_INDEX` in `js/app.js`.

Sources used:

- Existing Gridly operational county registry.
- Existing Gridly awareness-area definitions and generated registry community bridge.
- LP035 Harris/Houston regional awareness model.
- LP051 seed records.
- A manually governed LP051.1 launch ZIP index.

Source limitations:

- Records are USPS ZIP inputs mapped to Gridly consumer awareness assignments.
- Records are **not** a Census ZCTA geometry assertion.
- ZIPs and ZCTAs are not treated as identical.
- PO Box-only and unique ZIP classification is not complete in this milestone.
- Split-county and split-community ZIP percentages are deferred to LP051.2.

## Dataset schema

Each record preserves:

- `zip`
- `state`
- `countyId`
- `countyName`
- `awarenessAreaKey`
- `communityId`
- `communityName`
- `consumerLabel`
- `resolutionStatus`
- `zipType`
- `provenance`
- `authorityLimitations`

Resolution outcomes are deterministic:

- `resolved`
- `resolved_by_governance`
- `ambiguous`
- `unsupported`
- `invalid`

## Coverage totals

Current LP051.1 runtime audit targets these totals:

- Dataset records: 34
- Supported operational counties: 28
- Covered counties: 28
- Duplicate ZIPs: 0
- Invalid records: 0
- Unknown county IDs: 0
- Unknown awareness areas: 0
- Ambiguous ZIPs: 1
- Coverage certification status: `partial`
- Merge ready for UI integration: `false`

## County coverage

All 28 selectable operational counties have at least one governed representative ZIP record. This is launch-county coverage, not full ZIP coverage for every configured community.

## Community coverage

Community coverage is intentionally partial. LP051.1 certifies representative community assignments and compares them against configured communities in the browser audit. Missing communities are reported in `missingCommunities` and must not be hidden or treated as complete.

## Awareness-area coverage

Awareness-area coverage is intentionally partial. The audit compares records against all configured awareness-area keys and reports `missingAwarenessAreas`.

## Ambiguity policy

A valid ZIP with multiple plausible Gridly outcomes must not silently select a wrong community. The passive resolver returns `ambiguous` when the record is intentionally unresolved or when duplicate ZIP records represent multiple candidates.

## Harris/Houston policy

Harris County is handled with Gridly's existing consumer-friendly Houston region model. LP051.1 includes governed records for Downtown / Midtown, North Houston / Greenspoint, Southeast Houston / Hobby, and Baytown. The dataset does not collapse all Houston ZIPs into a generic Houston identity and does not create dozens of new neighborhood identities.

The Katy-area ZIP `77084` is intentionally classified as `ambiguous` because west-Houston postal usage can cross county and consumer-area expectations.

## Unsupported ZIP behavior

A valid five-digit ZIP absent from the certified index returns `unsupported`. The resolver remains passive and does not change setup, storage, active awareness, map focus, providers, or Route Intelligence.

## Invalid ZIP behavior

Input that cannot normalize to five digits returns `invalid`. Invalid input does not mutate user state.

## Maintenance strategy

Until LP051.2, records should be manually governed and changed only with documented provenance. LP051.2 should add a generated ZIP/ZCTA authority package or crosswalk pipeline that records source version, ZIP type, county split handling, PO Box-only classification, and governed consumer overrides.

## Known limitations

- Full launch community coverage is incomplete.
- Full awareness-area coverage is incomplete.
- ZIP/ZCTA geometric equivalence is not asserted.
- Split ZIP percentages are not included.
- PO Box-only and unique ZIP types are not exhaustively certified.

## UI integration readiness

Not ready for visible UI integration. The runtime audit must report `mergeReadyForUiIntegration: false` until full coverage and ambiguity governance are complete.

## Recommendation for LP051.2

Create branch `lp051.2-zip-authority-crosswalk-import` to generate or import an authoritative ZIP/ZCTA crosswalk, classify PO Box and unique ZIPs, govern split ZIPs, and close missing community/awareness-area coverage before connecting ZIP personalization to onboarding or Settings.
