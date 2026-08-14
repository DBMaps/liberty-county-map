# San Antonio SA Tomorrow two-polygon defect audit

**Status:** COMPLETE

This audit is evidence-only. No governed geometry was replaced, no consolidation occurred, and no consumer region or name was created.

## Design note

`GOVERNED_ATOMIC_GEOGRAPHY != CONSUMER_REGION_LABEL`

## Far Southwest

- GlobalID: `0a54b85a-6d66-4887-8a12-19dff06070c8`
- Source/projected validity: **INVALID / INVALID**
- Exact reason: Nested shells[1644697.73375798 7235631.57136394]
- Original / MakeValid miÂ²: 28.432135320718697 / 28.131124557838966
- MakeValid delta: -1.0586991074862466%
- Classification: `OWNER_REVIEW_REQUIRED`
- Future path: `REQUIRE_CITY_SOURCE_CLARIFICATION`

## West Northwest

- GlobalID: `4c5f3a02-22b0-4af8-8d74-b1bc35a8e03e`
- Source/projected validity: **INVALID / INVALID**
- Exact reason: Ring Self-intersection[1627540.43352733 7270466.3643979]
- Original / MakeValid miÂ²: 39.43385203383007 / 39.4338520338304
- MakeValid delta: 8.288555177648982e-13%
- Classification: `SOURCE_GEOMETRY_INVALID_REPAIRABLE_DETERMINISTICALLY`
- Future path: `CERTIFY_DETERMINISTIC_DERIVED_REPAIR`
