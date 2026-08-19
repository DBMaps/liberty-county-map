# Gridly Recovery Audit 005 — Railroad Crossing Classification Inventory

## 1. Quick summary

This read-only audit found **16,099 governed records in 254 county production packages**. The upstream access field says **11,195 Public, 4,902 Private, and 2 blank**. In contrast, `gridlyClassification` says **16,020 PUBLIC_ROADWAY, 67 PRIVATE_ROAD, 10 INDUSTRIAL, 1 RAIL_YARD, and 1 TEMPORARY_ACCESS**. The two systems therefore disagree materially: 4,835 source-private records are normalized as `PUBLIC_ROADWAY`.

Private crossings are in governed inventories. They also reach consumer counts and markers whenever package manufacture labelled them `PUBLIC_ROADWAY`; this is especially significant in Harris, Dallas, and Travis, where every governed row is labelled `PUBLIC_ROADWAY`. No behavior was changed.

## 2–3. Source classification fields and statewide raw counts

All 16,099 governed rows contain every field below (there are no JSON nulls). `TYPEXING` has two blanks; the remaining fields have no blanks.

| Field | Distinct values and raw counts | Apparent meaning | Runtime normalization |
|---|---|---|---|
| `TYPEXING` | Public 11,195; Private 4,902; blank 2 | Direct FRA public/private access designation; highest-confidence access field | Preserved only inside `props`; not promoted to `isPublic`/`isPrivate` |
| `POSXING` | At Grade 13,975; RR Under 1,186; RR Over 938 | Physical grade relationship | Preserved in `props`; uppercase source name is not read by reportability logic |
| `XPURPOSE` | `1` 15,936; `2` 126; `3` 37 | Coded crossing purpose. Record labels strongly support 2=pedestrian/pathway and 3=station, while 1 is the ordinary highway/road domain; codebook is not bundled, so code meanings remain an inference | Preserved in `props`; numeric code is not decoded or promoted |
| `PRVCAT` | `14` 14,377; `15` 201; `19` 46; `20` 917; `21` 165; `22` 182; `23` 4; `24` 207 | FRA categorical code associated with crossing inventory; no bundled codebook or runtime interpretation was found | Preserved in `props`; not normalized |
| `HIGHWAY` | Free text / blank | Highway identifier; useful as a road-name fallback, not an access classification | Adapter maps it to `road_name` only when `STREET` is blank |
| `STREET` | Free text / blank, including explicit PRIVATE, PEDESTRIAN, RRYARD, plant and haul-road labels | Road/path display name; sometimes contains classification evidence but is not authoritative alone | Promoted to `road_name`/name, original retained |
| `gridlyClassification` | PUBLIC_ROADWAY 16,020; PRIVATE_ROAD 67; INDUSTRIAL 10; RAIL_YARD 1; TEMPORARY_ACCESS 1 | Gridly package-manufacture classification, not a faithful projection of `TYPEXING` | Retained in `props`; consumer and marker filters read it |

`WDCODE` and track counts (`YARDTRK`, `INDUSTRYTR`, etc.) provide contextual evidence, but current code does not use them to classify access. `TYPEXING`, `POSXING`, `XPURPOSE`, and `PRVCAT` are complete strings rather than nullable values.

## 4. Normalized runtime classification model

`normalizeCrossing` copies the entire source property object and adds identity, display, railroad, county, source, and adapter fields. `normalizeGridlyCrossingFeatures` then builds the consumer record and preserves the adapted properties as `props`.

| Source | Function | Destination/example | Original retained? | Loss |
|---|---|---|---|---|
| `CROSSING` | `normalizeCrossing` | `crossing_id: FRA-742761W`; later `id` | Yes, in `props` | No |
| `STREET` then `HIGHWAY` | `normalizeCrossing` | `road_name`, `name` | Yes | Fallback choice obscures which source won unless `props` is inspected |
| `RAILROAD` / `OPERATINGR` / `INIT` | `normalizeCrossing` | `railroad` | Yes | No material loss |
| `COUNTYNAME`, `STCYFIPS` / `CountyCode` | `normalizeCrossing` | `countyName`, `countyFips`; consumer `countyId` comes from requested package | Yes | Requested package ownership can supersede source county metadata |
| `TYPEXING`, `POSXING`, `XPURPOSE`, `PRVCAT` | object copy only | `record.props.TYPEXING`, etc. | Yes | Not promoted; lowercase-only consumer checks do not read these uppercase names |
| `gridlyClassification` | object copy only | `record.props.gridlyClassification` | Yes | No derivation is performed at runtime; package-manufacture errors survive |

There is **no explicit runtime `isPublic`, `isPrivate`, `crossingPurpose`, `crossingType`, or `roadAccessClass`**. Consumer code infers eligibility from `gridlyClassification`, defaulting missing classification to public. The raw FRA fields remain available only through `props`.

## 5. Current crossing filter rules

| Class | File / function | Condition and field | Affected layers |
|---|---|---|---|
| Ownership | `js/gridlyCrossingPackageAdapter.js` / `buildAdaptedCrossingGeojson` | Drops rows without geometry coordinate arrays after adapter fallback | Runtime inventory and every downstream count/marker; package file count itself unchanged |
| Ownership | `js/app.js` / `normalizeGridlyCrossingFeatures` | Drops invalid coordinate extraction | Runtime inventory and all downstream surfaces |
| Ownership | `gridlyCrossingSampleMatchesCounty` and consumer selector | Must match active package/county | Awareness, Location Context and markers; governed package count unchanged |
| Ownership | `gridlySelectConsumerVisibleCrossings` | Case-insensitive FRA identity de-duplication | Awareness/Location Context only; inventory and marker inventory unchanged |
| Access/type | `gridlyCrossingSatisfiesConsumerVisibilityPolicy` | classification blank or exactly `PUBLIC_ROADWAY` | Awareness and Location Context |
| Access/type | `isGridlyPublicRoadwayCrossing` / marker policy | same condition, missing defaults to public | Markers |
| Access/type | `gridlyGetCrossingReportEligibility` | known underpass; decoded non-at-grade/closed/non-highway fields | Consumer counts and markers, but governed uppercase `POSXING`/`XPURPOSE` are not decoded into the names tested, so most governed grade-separated/purpose-coded rows pass |
| Visibility | `shouldShowCrossingInLaunchMode` | review `hide`; governed provider sources otherwise pass | Awareness/Location Context |
| Visibility | `getGridlyRegionalCrossingVisibilityPolicy` | no markers at county zoom; representative, viewport-limited, or viewport-all by zoom | Marker count only |
| Visibility | `getGridlyPolicyVisibleCrossings` / `renderCrossings` | bounds, representative set and nearest hard cap | Marker count only |

No filter explicitly reads `TYPEXING`, `XPURPOSE`, `PRVCAT`, `YARDTRK`, or `INDUSTRYTR`.

## 6–11. Private status and counts

| Layer | Source-private included? | Explanation |
|---|---|---|
| Governed county inventory | **Yes** | 4,902 rows |
| Awareness-area count | **Yes, partially** | Included wherever manufacture says PUBLIC_ROADWAY; excluded where it says PRIVATE_ROAD/INDUSTRIAL/RAIL_YARD/TEMPORARY_ACCESS |
| Consumer crossing count | **Yes, partially** | Same selector as awareness count |
| Visible markers | **Yes, partially** | Same classification gate plus zoom/viewport/cap rules |
| Location Context “crossings watched” | **Yes, partially** | Displays the consumer awareness selection count |

**Private counts from reliable `TYPEXING`: statewide 4,902; Harris 274; Dallas 100; Travis 32; Liberty 36.** Two Dallas rows are access-ambiguous because `TYPEXING` is blank.

## 12. Harris governed 1,159 composition

* Access: Public 885; Private 274.
* Position: At Grade 933; RR Under 151; RR Over 75.
* Purpose: 1=1,135; 2=23; 3=1.
* Gridly class: PUBLIC_ROADWAY 1,159. Thus all 274 source-private Harris records are consumer-eligible on classification alone.

## 13. Baytown certified 70 composition

The static packages do not persist the runtime membership set behind the certified 70. A deterministic nearest-anchor composition diagnostic (explicitly **not** a claimed runtime membership reconstruction) gives: Public 58; Private 12; At Grade 63; RR Under 5; RR Over 2; purpose 1=67 and 2=3; all 70 are Gridly PUBLIC_ROADWAY. The audit therefore establishes contribution risk, but an exact certified-70 raw-class composition requires capturing the browser's selected membership IDs.

## 14. Dallas 789 / certified 417 composition

Governed 789: Public 687; Private 100; blank 2; At Grade 556; RR Under 96; RR Over 137; purpose 1=762, 2=14, 3=13; Gridly PUBLIC_ROADWAY 789.

Nearest-anchor 417 diagnostic: Public 357; Private 58; blank 2; At Grade 280; RR Under 61; RR Over 76; purpose 1=399, 2=9, 3=9; Gridly PUBLIC_ROADWAY 417. The same membership-capture qualification as Baytown applies.

## 15. Travis 176 / Austin certified 135 composition

Governed 176: Public 144; Private 32; At Grade 130; RR Under 31; RR Over 15; purpose 1=167, 2=6, 3=3; Gridly PUBLIC_ROADWAY 176.

Nearest-anchor 135 diagnostic: Public 119; Private 16; At Grade 93; RR Under 29; RR Over 13; purpose 1=128, 2=5, 3=2; Gridly PUBLIC_ROADWAY 135. The same qualification applies.

## 16. Liberty 115 / Liberty certified 30 composition

Governed 115: Public 79; Private 36; At Grade 108; RR Under 6; RR Over 1; purpose 1=115. Gridly classes are PUBLIC_ROADWAY 80, PRIVATE_ROAD 28, INDUSTRIAL 5, RAIL_YARD 1, TEMPORARY_ACCESS 1.

Nearest-anchor 30 diagnostic: Public 24; Private 6; At Grade 29; RR Over 1; purpose 1=30; Gridly PUBLIC_ROADWAY 25, PRIVATE_ROAD 4, INDUSTRIAL 1. Runtime classification gates would remove the latter five before Location Context/markers, another reason not to equate the diagnostic nearest 30 with the certified runtime 30.

## 17. Representative records

| FRA id / county | Street; railroad | Source fields | Gridly class | Public/private inference; current reach |
|---|---|---|---|---|
| 426686T / Rusk | `*PRIVATE`; BLR | Private, At Grade, purpose 1, PRVCAT 14 | PUBLIC_ROADWAY | Reliably private, but consumer eligible |
| 966354N / Rusk | FM1716; TEXU | Public, RR Over, purpose 1, PRVCAT 15 | PUBLIC_ROADWAY | Public; consumer classification passes (uppercase position is not decoded) |
| 441162U / Brazoria | Pedestrian PRIVATE; UP | Private, At Grade, purpose 2, PRVCAT 14 | PUBLIC_ROADWAY | Private pedestrian; consumer eligible |
| 748561H / Brazoria | PEDESTRIAN; UP | Public, At Grade, purpose 2, PRVCAT 14 | PUBLIC_ROADWAY | Public pedestrian; consumer eligible |
| 976251R / Tarrant | CENTREPORT EAST; TRE | Public, At Grade, purpose 3, PRVCAT 14 | PUBLIC_ROADWAY | Station-purpose inference; consumer eligible |
| 021745W / Dallas | PEDESTRIAN PATHWY; DART | blank, At Grade, purpose 2, PRVCAT 14 | PUBLIC_ROADWAY | Access unknown; consumer eligible |
| 024323N / Montgomery | PRIVATE; BNSF | Private, At Grade, purpose 1, PRVCAT 14 | PRIVATE_ROAD | Reliably private; excluded from consumer count/markers |
| 024324V / Montgomery | OLD DOBBIN-PLANT; BNSF | Public, At Grade, purpose 1, PRVCAT 14 | INDUSTRIAL | Access says public but industrial intent; excluded |
| 930212V / Liberty | RRYARD; BNSF | Private, At Grade, purpose 1, PRVCAT 14 | RAIL_YARD | Private yard; excluded |
| 975462J / Liberty | Temp Haul Road TX 99; UP | Private, At Grade, purpose 1, PRVCAT 14 | TEMPORARY_ACCESS | Private temporary access; excluded |

## 18. Ambiguous / unknown cases

The two blank Dallas `TYPEXING` rows cannot be assigned public/private. Purpose codes 2 and 3 should remain separate pedestrian/pathway and station-like categories until the authoritative FRA codebook is attached. PRVCAT meanings are also unresolved. A public industrial row demonstrates that industrial purpose and public access are independent dimensions. Grade-separated rows are not necessarily invalid records, but are non-reportable road-crossing candidates under the intended policy.

## 19–21. Surface reach and exclusions

| Category | Statewide | Inventory | Location Context | Markers | Confidence |
|---|---:|---|---|---|---|
| Gridly PUBLIC_ROADWAY | 16,020 | Yes | Yes when area-owned/reportable | Yes when zoom/viewport policy allows | High (runtime behavior), low as source-access truth |
| Gridly PRIVATE_ROAD | 67 | Yes | No | No | High |
| Gridly INDUSTRIAL | 10 | Yes | No | No | High |
| Gridly RAIL_YARD | 1 | Yes | No | No | High |
| Gridly TEMPORARY_ACCESS | 1 | Yes | No | No | High |
| Source Private but Gridly PUBLIC_ROADWAY | 4,835 | Yes | Yes/partial | Yes/partial | High |
| Purpose 2 | 126 | Yes | Usually yes if Gridly public | Usually yes if Gridly public | Medium semantic confidence |
| Purpose 3 | 37 | Yes | Usually yes if Gridly public | Usually yes if Gridly public | Medium semantic confidence |
| Blank TYPEXING | 2 | Yes | Yes | Yes subject to visibility | High that access is unknown |

The only current access/type exclusions are the 79 non-PUBLIC Gridly classifications (plus any decoded review/reportability exclusion). Geometry, county ownership, duplicate identity, awareness geometry, zoom, viewport and marker caps exclude records for other reasons.

## 22–24. Files and audit results

Added this report and `scripts/audit-crossing-classifications.py`. The script reads production GeoJSON only and writes JSON to stdout; it does not modify packages, manifests, caches, or runtime behavior. It confirmed 254 packages / 16,099 rows and all distributions above. Commit identity is reported in the delivery response.

## 25. Product-decision table (no recommendation)

| Owner decision needed | Evidence to consider | Current behavior |
|---|---|---|
| Should source-private roads be user-facing? | 4,902 reliable source-private rows; 4,835 mislabeled PUBLIC_ROADWAY | Mostly included |
| Should pedestrian/pathway purpose be watched/marked? | 126 purpose-2 rows, including public, private, and unknown access | Mostly included |
| Should station-purpose crossings be watched/marked? | 37 purpose-3 rows | Mostly included |
| Should grade-separated locations count as crossings watched? | 2,124 RR Under/Over rows; uppercase field is not decoded | Mostly included |
| How should industrial, yard, and temporary access interact with public/private? | These are orthogonal purpose/access concepts | 12 explicitly classified rows excluded |
| What is the default for missing/unknown access? | Two blank Dallas rows; missing runtime class defaults public | Included |
| Should package manufacture be regenerated from authoritative fields? | Major TYPEXING/Gridly mismatch across Harris, Dallas, Travis | Awaiting owner policy; no change made |
