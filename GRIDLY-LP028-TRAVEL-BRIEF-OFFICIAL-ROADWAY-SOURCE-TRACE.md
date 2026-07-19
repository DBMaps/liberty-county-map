# GRIDLY LP028.7 — Travel Brief Official Roadway Source Trace

Branch: `LP028-REGIONAL-ROADWAY-RUNTIME-INTEGRATION`  
Recommendation: **DO NOT MERGE**

## Executive finding

The visible Travel Brief official-roadway phrase `lane closure and road closure on I-10` is composed by the LP002 Travel Brief presentation helpers, not by the current unified incident pipeline. The exact composition point is `gridlyTravelBriefConsolidateRoadwayLines(entries)`, which groups multiple DriveTexas connector records by route and emits `${conditionLabels.join(", ")} and ${last} on ${group.route}` when two or three condition labels share the same route.

The official row is rendered by `gridlyRenderTravelBrief(storyInput)`. Its model is built by `gridlyBuildTravelBriefModel(storyInput)`, whose `Official Roadways` section reads `gridlyTravelBriefDriveTexasLines(driveTexasRecords)`. `driveTexasRecords` comes from `gridlyStoryTransportationConnectorRecords()`, which reads `window.gridlyDriveTexasConnector.getNormalizedRecords()` directly.

Therefore, the Travel Brief official roadway row bypasses `getUnifiedIncidents()`, `futureTxdotIncidents()`, `futureTxdotConstruction()`, `activeHazards`, the Alerts snapshot, Story Engine state, and DOM-derived state.

## 1. Exact visible-string composition function

Searches performed:

- `rg -n "lane closure and road closure|road closure on I-10|OFFICIAL ROADWAYS|Official Roadways|I-10|official road|Travel Brief|travel brief" js tests *.md`
- `rg -n "Lane Closure|Road Closure|lane closure|road closure" . -g '!node_modules' -g '!android/.gradle' -g '!android/build' -g '!data/road-segments/**'`

No static literal for `lane closure and road closure on I-10` exists in the codebase. The equivalent phrase is dynamic.

Composition chain:

1. `gridlyTravelBriefDriveTexasLines(records)` maps each impacted official roadway record to a consumer line.
2. `gridlyTravelBriefRoadwayConditionLabel(line)` reduces each line to labels such as `lane closure` or `road closure`.
3. `gridlyTravelBriefRoadwayLineRoute(record, line)` selects the route from `record.routeName`, `record.route`, `record.road`, or `record.highway`, falling back to parsing `on I-10`-style text.
4. `gridlyTravelBriefConsolidateRoadwayLines(entries)` groups records by route and emits `lane closure and road closure on I-10` when two impacted entries on `I-10` reduce to those two labels.

## 2. Exact Travel Brief official-row renderer

`gridlyRenderTravelBrief(storyInput)` renders the row. It clears the Travel Brief list with `list.replaceChildren()`, creates one section per model section, writes section title text, then appends paragraph nodes for each section line.

The official section is selected by model key `drivetexas` and title `Official Roadways`.

## 3. Exact source owner

Source owner for this row:

`window.gridlyDriveTexasConnector.getNormalizedRecords()` → `gridlyStoryTransportationConnectorRecords()` → `gridlyBuildTravelBriefModel()` → `gridlyTravelBriefDriveTexasLines()` → `gridlyTravelBriefConsolidateRoadwayLines()` → `gridlyRenderTravelBrief()` → DOM.

Fallback source owner if connector records are unavailable in helper diagnostics only: `window.gridlyDriveTexasProvider.getNormalizedRecords()`. The production Travel Brief function itself reads the connector, not the provider fallback.

## 4. Exact source-to-DOM call chain

Full traced path:

1. DriveTexas live connector fetches the public endpoint in `fetchNowInternal()`.
2. Payload is normalized through `gridlyDriveTexasProvider.normalizeRecords(payload)`.
3. The live connector applies `filterAwarenessRecords(normalizePayload(payload))` before storing `normalizedRecords`.
4. `normalizedRecords` remains closure-scoped inside `js/gridlyDriveTexasLiveConnector.js` and is exposed only through `getNormalizedRecords()`.
5. On changed evidence, `notifyOfficialProviderEvidence()` calls `gridlyRenderTravelBrief()` when the higher-level `gridlyOfficialProviderConsumerRefresh` hook is absent.
6. `gridlyRenderTravelBrief()` calls `gridlyBuildTravelBriefModel()`.
7. `gridlyBuildTravelBriefModel()` calls `gridlyStoryTransportationConnectorRecords()`.
8. `gridlyStoryTransportationConnectorRecords()` reads `window.gridlyDriveTexasConnector.getNormalizedRecords()`.
9. `gridlyTravelBriefDriveTexasLines()` classifies the rows for consumer text.
10. `gridlyTravelBriefConsolidateRoadwayLines()` groups labels by route.
11. `gridlyRenderTravelBrief()` writes the resulting lines into `[data-gridly-travel-brief-list]`.

## 5. Exact records that generated the I-10 text

The exact runtime records are not present in repository fixtures and cannot be proven from static code alone because the relevant live connector array is closure-scoped in the browser runtime. The added passive console helper exposes the exact selected records in a reproduced browser session without fetching, refreshing, switching counties, rendering, or mutating source caches:

```js
window.gridlyLp028TravelBriefOfficialSourceTrace?.()
```

In the reproduced state, the records that generated the phrase will be the impacted connector records whose `selectedRecords` entries show:

- `routeName` / route field: `I-10`
- `impactKind`: one `lane_closure` and one `road_closure`
- `composedLine`: lines that consolidate to `lane closure and road closure on I-10`

The helper reports each selected record's ID, county/city fields, latitude/longitude, route field, category/type/condition, title, description, impact kind, and composed line.

## 6. Active-area filtering behavior

There are two distinct filtering/ownership stages:

### Connector-stage active-awareness filtering

`gridlyDriveTexasLiveConnector.js` filters live normalized records before publishing them to its closure-scoped `normalizedRecords` array. The filter is `filterAwarenessRecords(records)`, which calls `matchesAwarenessArea(record, awareness)`.

`matchesAwarenessArea()` behavior:

- If both the record and awareness area have finite coordinates and `getDistanceMiles` exists, it accepts records within `awareness.radiusMiles + 2`; for `countyWide` awareness, it accepts records within `35` miles.
- If coordinate matching cannot run, it falls back to text matching against awareness `label`, `storageValue`, `key`, and `countyId`, normalized by removing `-tx` and ` county`.
- It searches record text built from `title`, `description`, `routeName`, `locality`, `city`, `county`, and `affectedAreas`.

### Travel Brief-stage filtering

No additional active-county, community, bounds, or unified-incident filtering is applied in the Travel Brief official row after `gridlyStoryTransportationConnectorRecords()` returns connector records. It trusts the connector's retained array.

## 7. Whether Harris/off-area records can qualify

Yes, off-area records can qualify at the connector stage if they pass the connector's awareness filter. Two notable cases:

1. Coordinate case: in county-wide mode, any record within 35 miles of the awareness anchor can qualify even when its county field is Harris, Chambers, Jefferson, Orange, or another county.
2. Text fallback case: if coordinates are missing/unusable, a record can qualify when its text contains terms derived from the selected awareness area.

The Travel Brief itself does not re-check county fields, so any off-area connector record that survives connector filtering can become official Travel Brief copy.

## 8. Whether map bounds affect qualification

No. The official Travel Brief source path does not inspect Leaflet map bounds. The connector uses selected awareness area coordinates and text terms, not current map viewport bounds. A current map viewport that includes Harris County does not by itself qualify an I-10 record for the Travel Brief official row.

## 9. Whether stale state exists

There is potential stale presentation state, but the observed mismatch does not require stale DOM.

`gridlyRenderTravelBrief()` clears and replaces the list on each render. If the DriveTexas connector later becomes empty and `gridlyRenderTravelBrief()` runs, the official row becomes `No official roadway advisories.` If the source becomes empty but no Travel Brief render is triggered, the old DOM can remain visible until the next render.

The passive helper reports `renderedTextMatchesCurrentModel`, `staleRenderedText`, and `firstMismatchStage` to distinguish a true stale DOM from a current-model/unified-pipeline mismatch.

## 10. Clear/reset ownership

Clear/reset owner: `gridlyRenderTravelBrief()` via `list.replaceChildren()`.

Known calls/refresh triggers from the traced code:

| Trigger | Clear/reset status |
| --- | --- |
| DriveTexas fetch success/failure | Called indirectly by connector notification if evidence changed and no higher-level official consumer refresh hook owns it. |
| Travel Brief refresh | Called by `gridlyRenderTravelBrief()`. |
| Runtime refresh through official provider consumer hook | Depends on `gridlyOfficialProviderConsumerRefresh` implementation; connector delegates when present. |
| County/community/awareness change | Connector filtering occurs on fetch, but static trace did not prove an immediate Travel Brief rerender on every county/community switch independent of connector refresh. |
| Nearby/Area/County filter change | Same as county/community; not proven as a direct Travel Brief clear. |
| Alerts refresh | No direct ownership found; Alerts uses the unified/snapshot path, not this Travel Brief connector path. |
| Map movement | No direct Travel Brief official-row filtering or clear/reset ownership found. |
| Route-watch mode change | No direct Travel Brief official-row filtering or clear/reset ownership found. |

## 11. First incorrect ownership or filtering stage

The first ownership boundary where active-area correctness can be lost is the transition from connector-retained records into Travel Brief presentation:

`gridlyStoryTransportationConnectorRecords()` returns the connector's already-filtered records, and `gridlyTravelBriefDriveTexasLines()` renders them without verifying active county, selected community, current map bounds, or unified incident ownership.

If a record survives connector filtering due to county-wide radius or broad corridor relevance, the Travel Brief treats it as eligible official local context. This is a source-preservation versus presentation-filtering mismatch.

## 12. Why Travel Brief can show I-10 while unified counts are zero

Because the Travel Brief official row does not read any of these values:

- `txdotUnifiedIncidents`
- `generatedRoadIncidents`
- `officialRecordCount` from the inspected Alerts/unified surface
- `i10RecordCount` from that inspected source
- `activeHazards`

The row reads `gridlyDriveTexasConnector.getNormalizedRecords()` directly. If that connector array contains impacted I-10 rows while the unified TxDOT emitters return zero, the Travel Brief can show `lane closure and road closure on I-10` while unified and Alerts diagnostics are zero.

## 13. Closure-scoped source visibility

Yes. The existing browser inspection can miss the actual Travel Brief source because `normalizedRecords` is closure-scoped inside `js/gridlyDriveTexasLiveConnector.js`. It is not `window.gridlyExternalRoadConditions`; it is exposed through `window.gridlyDriveTexasConnector.getNormalizedRecords()`.

## 14. Source-preservation versus presentation-filtering mismatch

Yes. DriveTexas data may be preserved in a connector-owned filtered array even when unified incident construction is empty. Travel Brief presentation consumes the connector array directly and does not share the Alerts/unified ownership or area-filtering model.

## 15. LP028 causality

Static evidence does not prove LP028 caused the behavior. The Travel Brief direct connector path is LP002-era presentation architecture, and the connector's filtering was already independent of the unified incident path. LP028 county switching/runtime activation could expose or worsen the issue by making awareness-area changes more visible while connector-retained records and Travel Brief presentation do not share a single active-area/unified ownership boundary.

Classification: **LP028 likely exposed an existing ownership mismatch; not proven as the original cause.**

## 16. Roadway asset availability

Roadway asset availability does not affect this Travel Brief official-row qualification. The source path uses DriveTexas connector records and text/coordinate awareness filtering. It does not call local roadway geometry, road segment assets, LP027 road context restoration, or `data/road-segments/` assets to decide whether to show the official row.

## 17. Is the I-10 phrase source rows or category/roadway cache?

It is based on current connector source rows, but the visible phrase is a summarized category/route consolidation. The phrase itself is not raw source text. It is generated from at least two impacted records sharing route `I-10`, reduced to condition labels and route.

## 18. Browser reproduction steps

1. Open Gridly on the current branch.
2. Ensure the active area is Dayton / Liberty County and DriveTexas has completed loading.
3. Confirm the Travel Brief shows `OFFICIAL ROADWAYS` with `lane closure and road closure on I-10`.
4. Open DevTools Console.
5. Run the validation command below.
6. Compare `renderedOfficialText`, `currentModelOfficialLines`, `selectedRecords`, and `renderedTextMatchesCurrentModel`.
7. If `renderedTextMatchesCurrentModel` is `true`, the visible text is current connector-model output rather than stale DOM.
8. If `renderedTextMatchesCurrentModel` is `false`, inspect `firstMismatchStage` for stale DOM ownership.

## 19. Exact console validation command

```js
window.gridlyLp028TravelBriefOfficialSourceTrace?.()
```

Expected proof fields:

- `officialTravelBriefSourceOwner`
- `sourceArrayName`
- `sourceRecordCount`
- `impactedRecordCount`
- `selectedRecords[].id`
- `selectedRecords[].county`
- `selectedRecords[].latitude`
- `selectedRecords[].longitude`
- `selectedRecords[].routeName`
- `selectedRecords[].category`
- `selectedRecords[].title`
- `selectedRecords[].description`
- `selectedRecords[].impactKind`
- `selectedRecords[].composedLine`
- `currentModelOfficialLines`
- `renderedOfficialText`
- `renderedTextMatchesCurrentModel`
- `staleRenderedText`

## 20. Root-cause classification

Root cause: **official roadway presentation ownership bypasses the unified incident/Alerts ownership model and lacks a presentation-stage active-area guard.**

Sub-classification:

- Source owner mismatch: Travel Brief uses connector records directly; Alerts uses unified/snapshot paths.
- Filtering mismatch: connector-stage area relevance is not revalidated in Travel Brief.
- Possible stale DOM: possible only when source changes without rerender; not required to explain the reported mismatch.
- Not a roadway-asset issue.
- Not proven to be a DriveTexas data defect.

## 21. Recommended focused repair milestone

Create a small follow-up milestone that does not restore DriveTexas broadly and does not modify unrelated UI:

**LP028.8 — Travel Brief official roadway ownership alignment**

Scope:

1. Decide whether Travel Brief official rows should read the unified incident/snapshot official roadway owner or a separate official summary owner.
2. Add a single active-area relevance contract shared by Alerts and Travel Brief.
3. Add tests for connector rows that are off-county, route-relevant, bounds-only, and stale-after-empty.
4. Ensure county/community/awareness switches trigger model invalidation or Travel Brief rerender when official source changes.
5. Keep presentation copy unchanged except where eligibility changes.

## Merge recommendation

**DO NOT MERGE.**
