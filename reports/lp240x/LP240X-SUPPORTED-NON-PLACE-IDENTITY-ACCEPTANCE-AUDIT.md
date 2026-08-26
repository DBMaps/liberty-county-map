# LP240.X Supported Non-PLACE Community Identity Acceptance Audit

**Disposition:** audit only; no production behavior, registry, identity, persistence, or UI code changed.

## 1. Exact Tarkington RCA and first losing stage

`gridlyLp0517ConfirmSelection` passes the selected candidate to `gridlyApplyConfirmedHomePersonalization`. That function normalizes it with `gridlyLp0517NormalizeSelectedOption`, builds the LP051.7 record, and calls `gridlyLp0517ValidateHomeRecord`. On an invalid result the caller itself throws `Error("invalid_selected_identity")` before `gridlyBeginConfirmedCameraTransaction`, storage, compatibility profile writes, awareness synchronization, and map focus.

For a manual community, `gridlyLp0517ValidateHomeRecord` accepts only: a five-digit ZIP path; an explicitly confirmed county-wide area with null `communityKey`; a governed PLACE returned by `gridlyLp0517ResolveGovernedSelectedIdentity`; a governed San Antonio region; or the separately modeled canonical multi-county PLACE path. The ordinary governed-PLACE resolver requires a registered county with FIPS `48ddd`, `communityKey` matching `48ddddd`, exact membership in `county.consumerAwarenessAreas`, `consumerEligible === true`, `canonicalIdentity === "PLACE_GEOID"`, and county-FIPS membership.

Tarkington normalization resolves the registered area, preserves `countyId = liberty-tx`, and derives `communityKey = tarkington`. Its first loss is `gridlyLp0517ResolveGovernedSelectedIdentity`: `"tarkington"` fails `/^48\d{5}$/`. It is not county-wide, ZIP-confirmed, San Antonio regional, or canonical multi-county. Validation returns false; no persistence or transition starts.

**RCA:** `NON_PLACE_SUPPORTED_AREA_VALIDATOR_DEFECT`. Tarkington's record is not corrupt. The generic manual selection contract recognizes PLACE, county-wide, and one special non-PLACE class, but has no governed identity resolver for ordinary supported non-PLACE communities (and no resolver for Houston regions).

## 2. Dayton versus Tarkington

| Consumed field/stage | Dayton | Tarkington | Effect |
|---|---|---|---|
| `key` / `awarenessAreaKey` | `dayton` | `tarkington` | Both resolve exact supported records. |
| label/storage | Dayton | Tarkington | Both are selectable and preserved by normalization. |
| county | `liberty-tx` | `liberty-tx` | Both pass registered-county and area/county agreement. |
| coordinates | 30.0466, -94.8852 | 30.3205, -94.996 | Both are finite presentation anchors; not the rejecting predicate. |
| radius | 8 | 8 | Not the rejecting predicate. |
| source | existing local app anchor | safe approximate community anchor | Descriptive provenance; not directly read by current validator. |
| debug `placeGeoid` | `4819432` through exact county + canonical display-name registry identity | null | Decisive identity difference. |
| normalized `communityKey` | `4819432` when selected from governed picker metadata | `tarkington` fallback key | Dayton matches the PLACE regex and exact governed membership; Tarkington does not. |
| canonical key | null | null | Neither requires a canonicalKey on this single-county path. |
| persistence fields | Existing schema stores county, community, awareness key, labels, identity fields | Schema can carry the same fields and `tarkington`, but current rehydration validator would reject it | Storage shape is not the first loss. |
| awareness activation | reached after validation | never reached | Consequence, not cause. |

## 3. Complete 2,342-record inventory and LP239 join

The deterministic audit reconstructs the same source manufacture sequence: static anchors, one county-wide selector per selectable production county, Houston regions, San Antonio regions, and exact registry community bridges. Canonical identity is resolved only by explicit PLACE identity or the production exact county + canonical display-name bridge; no fuzzy join is used.

| Metric | Count |
|---|---:|
| supported awareness areas | 2,342 |
| with PLACE GEOID | 2,058 |
| without PLACE GEOID | 284 |
| with canonicalKey | 0 |
| without canonicalKey | 2,342 |
| county-wide | 254 |
| fallback | 1 |
| safe approximate community anchor | 8 |
| unique LP239 canonical PLACEs | 1,859 |
| extra multi-county membership projections | 199 |
| governed non-PLACE | 29 |
| unresolved | 0 |

Structural reconciliation is `2,058 canonical PLACE membership projections + 29 governed non-PLACE + 254 county-wide + 1 fallback = 2,342`. The difference between 2,342 and 1,859 is therefore not 483 homogeneous non-PLACE records: it is 199 additional exact multi-county PLACE membership projections, 29 governed non-PLACE records, 254 county-wide records, and one fallback.

Source counts are certified in `supported-area-identity-audit.json`. The largest classes are 2,019 V904R6 runtime registry bridges, 249 V819 county selector bridges, 15 LP035.1 Houston regions, 11 governed statewide focus bridges, nine Montgomery onboarding anchors, nine LP194 San Antonio regions, and eight safe approximate anchors; all smaller observed sources are retained verbatim in the JSON.

## 4. Tarkington source and governance

Tarkington is a literal member of `GRIDLY_AWARENESS_AREA_DEFINITIONS`, with stable key `tarkington`, governed county association `liberty-tx`, finite fixed anchor, radius 8, startup zoom 13, and explicit source `safe approximate community anchor`. The selector groups every non-county-wide definition except the sentinel `other`; therefore Tarkington is deliberately offered by the home-area picker. The V905 inclusion standard expressly includes regionally significant unincorporated communities and communities already referenced by Gridly data. No independent test specifically names Tarkington before this audit; this audit now protects its inventory presence and current behavior without changing it.

The stable identity already present is the exact registered tuple `(countyId, key)` backed by exact membership in the immutable supported-area inventory and exact source record. It is not a Census PLACE identity and must not be converted into one.

## 5. Eligibility and defect cohort

| Metric | Count |
|---|---:|
| home-area eligible (selector excludes only `other`) | 2,341 |
| canonical PLACE home eligible | 2,058 |
| non-PLACE home eligible (excluding county-wide/fallback) | 29 |
| currently accepted eligible | 2,321 |
| currently rejected eligible | 20 |
| Tarkington repair cohort | 20 |

The 29 governed non-PLACE entries comprise 15 Houston regions, nine San Antonio regions, and five ordinary communities (Moss Hill, Raywood, Tarkington, New Caney, Porter). The nine San Antonio regions have a dedicated current resolver and accept. The other 20 reproduce the same manual acceptance gap. County-wide areas are separately accepted. The sole `other` fallback is not offered as a home community.

## 6. Representative controls

| Label | Key | County | PLACE | canonicalKey | Source | Class | Eligible | Current result / reason |
|---|---|---|---|---|---|---|---|---|
| Dayton | dayton | liberty-tx | 4819432 | null | existing local app anchor | canonical PLACE | yes | accept: exact governed PLACE |
| Tarkington | tarkington | liberty-tx | null | null | safe approximate community anchor | ordinary governed non-PLACE | yes | reject: non-PLACE key cannot satisfy PLACE resolver |
| New Caney | new-caney | montgomery-tx | null | null | Montgomery runtime onboarding anchor | ordinary governed non-PLACE | yes | reject: same predicate |
| Downtown / Midtown | houston-downtown-midtown | harris-tx | null | null | LP035.1 Houston regional awareness model | governed Houston region | yes | reject: no manual Houston-region resolver |
| Central San Antonio | central-san-antonio | bexar-tx | null | null | LP194 certified LP193 geometry activation | governed San Antonio region | yes | accept: dedicated region resolver |
| Katy membership projections | county-scoped keys | multiple | 4838476 | null | registry bridge | canonical multi-county PLACE | yes | accept under governed PLACE/membership contracts |
| Liberty County | liberty-county | liberty-tx | null | null | county awareness bounds | county-wide | yes | accept only as explicit manual county-wide with null community key |
| Other | other | montgomery-tx | null | null | Montgomery runtime onboarding fallback | fallback | no | excluded from grouped community picker |

Only three counties contain non-PLACE records (Liberty, Montgomery, Harris, plus the separately modeled Bexar class); consequently three additional ordinary non-PLACE controls from three different counties do not exist. The table uses all available distinct non-PLACE architectures instead of inventing examples.

## 7. Persistence and rehydration

`gridlyBuildHomePersonalizationRecord` is structurally capable of recording a non-PLACE stable key in `communityKey`/`awarenessAreaKey` and already has `identityType`/`canonicalRegionId` used for San Antonio regions. Persistence itself does not impose a database column or serialization requirement for a PLACE GEOID. However both pre-write acceptance and `gridlyReadHomePersonalizationRecord` call the same validator. Thus merely writing Tarkington into the current schema would fail rehydration, and bypassing validation is unsafe. This is one missing governed identity acceptance model used at both validation points, not a storage schema defect.

## 8. Trust boundary and smallest safe future repair

A future repair must not accept arbitrary `key + countyId`. It should add a dedicated governed non-PLACE resolver that requires all of the following: exact `awarenessAreaKey` lookup in the current immutable supported registry; exact county registration and area/county equality; an explicitly eligible non-county-wide/non-fallback identity class; exact stable key and consumer label agreement after normalization; governed class/source membership; finite governed coordinates and applicable radius/zoom invariants; and no conflicting PLACE identity. Rehydration must rerun the same resolver, which rejects removed/stale records, invented keys, unknown counties, malformed values, arbitrary coordinates, and unresolved search output.

The smallest safe repair is class-based, not Tarkington-specific: retain exact PLACE GEOID persistence for canonical PLACEs; retain dedicated region/county-wide contracts; introduce a versioned governed non-PLACE identity discriminator whose stable identifier is resolved from the existing registered record; persist it through existing identity/key fields if compatibility analysis confirms unambiguous representation; and reject everything else. No repair should be merged from this audit pass.

## 9. Owner browser read-only acceptance block

```js
(() => {
  const rows = window.gridlyAwarenessAreaOptionsDebug?.().supportedAwarenessAreas || [];
  const area = rows.find((row) => row.key === "tarkington");
  const countyKnown = Boolean(area?.countyId);
  const ordinaryGovernedNonPlace = Boolean(area && !area.placeGeoid && !area.countyWide && !area.fallback && area.source === "safe approximate community anchor");
  return Object.freeze({
    supported: Boolean(area),
    governed: ordinaryGovernedNonPlace,
    identityClass: ordinaryGovernedNonPlace ? "GOVERNED_NON_PLACE" : "UNRESOLVED",
    stableIdentity: area ? `${area.countyId}:${area.key}` : null,
    countyAuthority: countyKnown ? area.countyId : null,
    homeAreaEligible: Boolean(area && area.key !== "other" && !area.fallback),
    currentValidatorResult: ordinaryGovernedNonPlace ? "invalid_selected_identity" : "not_audited",
    firstLosingStage: ordinaryGovernedNonPlace ? "gridlyLp0517ResolveGovernedSelectedIdentity: communityKey fails PLACE_GEOID predicate" : null,
    repairCohortMembership: ordinaryGovernedNonPlace,
    mutatesState: false
  });
})()
```

## 10. Merge recommendation

Do **not** merge a production repair from LP240.X. The audit-only certification and tests may be retained as evidence/regression fixtures; authorize a separate repair only after the governed non-PLACE discriminator and shared acceptance/rehydration trust contract are reviewed.
