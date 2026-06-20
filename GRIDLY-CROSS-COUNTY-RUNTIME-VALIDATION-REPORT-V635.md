# GRIDLY Cross-County Runtime Validation Report V635

## 1. Executive Summary

**Final determination: CROSS-COUNTY RUNTIME VALIDATION PASS.**

This documentation-only milestone records the validated post-V634 runtime baseline for Liberty County and Montgomery County after V633, V633.1, V633.2, V633.3, V633.4, V633.5, V633.6, V633.7, V633.8, and V634.

The validation evidence supports the following final state:

- Liberty County crossing reports submit, promote into awareness as rail/crossing conditions, persist through refresh, remain separate from road hazards, suppress cleared duplicate flooding, and remain county-contained.
- Montgomery County crossing assets activate from Montgomery-owned runtime assets, crossing reports submit and remain visible after save/refresh, promote into Top Awareness, maintain bottom awareness count integrity, improve crossing naming quality, and remain county-contained.
- Dayton to Willis and Willis to Dayton switching does not leak reports, awareness, or crossing inventory between counties.
- No runtime, UI, asset, registry, county activation, historical-system, DriveTexas, Transportation Intelligence, or Supabase schema changes are included in V635.

## 2. Protected Systems Verification

V635 made no runtime changes and therefore did not alter protected systems. The validated protected baseline remains:

| Protected system | Validated state | Evidence |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Protected boundary tests require the disabled state. |
| `historyUiEnabled` | `false` | Protected boundary tests require the disabled state. |
| `DriveTexasPaused` | `true` | Protected boundary tests require DriveTexas to remain paused. |
| `TransportationIntelligenceEnabled` | `false` | Protected boundary tests require Transportation Intelligence to remain disabled. |
| `TransportationIntelligenceDisplay` | `false` | Protected boundary tests require Transportation Intelligence display to remain disabled. |
| `TransportationIntelligenceActivation` | `false` | Protected boundary tests require Transportation Intelligence activation to remain disabled. |

Representative audit/test assertions:

```text
historicalReadsEnabled: false
historyUiEnabled: false
DriveTexasPaused: true
TransportationIntelligenceEnabled: false
TransportationIntelligenceDisplay: false
TransportationIntelligenceActivation: false
```

## 3. Liberty County Validation

### 3.1 Crossing report submission

Liberty County crossing report submission remains accepted through the existing crossing report path. V633.2 evidence confirms accepted crossing reports are registered immediately after successful save and preserved for post-save visibility.

Representative audit/test outputs:

```text
accepted crossing reports have a local post-save preservation registry
crossing reports register immediately after a successful save
crossing submission flow preserves the saved crossing before refresh
```

### 3.2 Crossing awareness promotion

Crossing reports are promoted as first-class rail/crossing awareness conditions instead of being rejected because they are not road hazards.

Representative audit/test outputs:

```text
active crossing reports receive explicit rail/crossing classification
crossing report classifier feeds top-awareness category selection
rail crossing fallback headline promotes Train Blocking Crossing
Crossing reports are first-class awareness conditions and must not be rejected only because they are not road hazards.
```

### 3.3 Crossing refresh persistence

Refresh-time ingestion and locally accepted crossing preservation keep saved crossing reports visible after refresh.

Representative audit/test outputs:

```text
post-save refresh merges locally accepted crossing reports back into activeReports
local crossing merge restores activeReports after a refresh reset
refresh-time ingestion identifies saved crossing report candidates separately from road hazards
refresh audit confirms crossing candidates rehydrate into activeReports
```

### 3.4 Awareness classification

Liberty crossing awareness is classified as crossing/rail and is not counted as a road hazard when validated scenarios are clean.

Representative audit/test outputs:

```text
crossing reports remain excluded from road-hazard fallback
awareness candidates count only activeHazard rows as road hazards
classification road hazard count honors duplicate suppression
crossing safety is based on post-suppression overlap
```

### 3.5 Duplicate flooding cleanup

V634 validates that duplicate cleared Dayton flooding is suppressed across active hazards, active reports, and recently-cleared rows before road-hazard classification is finalized.

Representative audit/test outputs:

```text
active report clear rows participate in duplicate suppression
recently-cleared hazard rows participate in duplicate suppression
duplicate suppression uses combined lifecycle sources
matching cleared duplicates are rejected from active awareness
activeRoadHazardCountAfterDuplicateSuppression
overlappingCandidateKeysAfterSuppression
```

### 3.6 Cleared hazard suppression

Cleared duplicate hazards cannot rehydrate as active awareness candidates after lifecycle filtering.

Representative audit/test outputs:

```text
active awareness duplicate suppression helper is present
active hazard awareness lifecycle applies duplicate suppression after latest lifecycle filtering
duplicate suppression requires a newer matching clear
return !matchingClear;
```

### 3.7 Bottom awareness counts

Bottom awareness separates active road hazards from crossing reports. Crossing reports contribute to active issue awareness while road-hazard counts continue to follow the awareness-classification road-hazard count.

Representative audit/test outputs:

```text
bottom panel derives crossing report count independently
bottom panel renders active crossing report wording
bottom hazard count source is the awareness classification road-hazard count
active issue count includes crossings separately from road hazards
bottomCountMatchesClassification: true
```

### 3.8 County containment

Liberty remains the default county, Liberty reports remain visible in Liberty context, and Montgomery reports are blocked from Liberty context.

Representative audit/test outputs:

```text
Liberty incidents remain visible in Liberty context
Legacy untagged Liberty rows remain Liberty-compatible
Montgomery reports are blocked from Liberty context
containment allows Liberty in Liberty
```

## 4. Montgomery County Validation

### 4.1 Crossing asset activation

Montgomery County resolves to Montgomery-owned crossing assets and does not fall back to Liberty crossing data.

Representative audit/test outputs:

```text
Montgomery runtime source registry resolves crossing asset
Montgomery crossing source is available
No Liberty fallback introduced for Montgomery crossings
Expected Montgomery crossing inventory loaded
Expected real Montgomery valid-coordinate count
Expected Montgomery null-coordinate rejected count
```

Validated crossing inventory counts:

```text
loadedCount: 239
normalizedCount: 204
rejectedFeatureCount: 35
```

### 4.2 Crossing report submission

Montgomery crossing reports are generated as Montgomery-tagged records and pass county ownership checks.

Representative audit/test outputs:

```text
Montgomery incidents are generated from Montgomery-tagged records
Legacy/global Liberty rows do not contaminate Montgomery incident generation
Untagged legacy rows are excluded from Montgomery active incident generation
lastSubmittedCrossingReportCounty
lastSubmittedCrossingReportTown
lastSubmittedCrossingReportCrossingId
lastSubmittedCrossingReportCoordinates
```

### 4.3 Crossing refresh persistence

Saved Montgomery crossing reports rehydrate after refresh and remain active, county-contained, and area-visible.

Representative audit/test outputs:

```text
refresh audit confirms crossing candidates rehydrate into activeReports
refresh audit confirms county pass after reload
refresh audit confirms lifecycle pass after reload
refresh audit confirms awareness-area pass after reload
refreshedCrossingReportCandidateCount
refreshedCrossingReportVisible
refreshedCrossingReportCountyPass
refreshedCrossingReportLifecyclePass
refreshedCrossingReportAreaPass
```

### 4.4 After-save visibility

After-save audit fields confirm that crossing reports remain visible and promoted after save.

Representative audit/test outputs:

```text
crossingReportVisibleAfterSave
crossingReportPromotedAfterSave
crossingReportAreaFilterPass
crossingReportRenderCandidateCount
post-save restored crossing summary carries classification road hazard count before bottom fallback
```

### 4.5 Top Awareness promotion

Montgomery crossing reports use the same first-class rail/crossing Top Awareness promotion path validated for Liberty.

Representative audit/test outputs:

```text
active crossing reports receive explicit rail/crossing classification
crossing report classifier feeds top-awareness category selection
rail crossing fallback headline promotes Train Blocking Crossing
V633 Train Blocking Crossing wording remains unchanged
```

### 4.6 Bottom awareness counts

Montgomery bottom awareness count handling remains classification-driven and keeps crossing reports separate from road hazards.

Representative audit/test outputs:

```text
bottom panel keeps crossing report count separate
classification road hazard count preserves finite zero as valid
bottom count match remains true when classification count drives bottom hazards
bottomCountMatchesClassification: true
```

### 4.7 Naming-quality improvements

V633 through V633.8 suppress low-quality crossing location labels and prefer reviewed, parsed, or useful location tokens.

Representative audit/test outputs:

```text
zero-coded placeholder labels are low quality
Private, Unknown, unnamed road, and Local crossing impact labels are low quality crossing tokens
Montgomery Private source labels are suppressed before unified crossing title rendering
reviewed crossing context remains ahead of fallback source fields
parsed crossing label can win over placeholder source values
promotion audit flags Private and Local crossing impact when visible
```

### 4.8 County containment

Montgomery active context uses Montgomery-owned assets, bounds, and report filters. Liberty reports and untagged legacy rows do not contaminate Montgomery incident generation.

Representative audit/test outputs:

```text
Montgomery active county uses Montgomery source registry
Montgomery boundary source is Montgomery-owned
Montgomery crossing source resolves to Montgomery-owned rail crossing asset
Montgomery crossing review overrides resolve to Montgomery-owned asset
Montgomery crossing count cannot use Liberty crossing source
Legacy/global Liberty rows do not contaminate Montgomery incident generation
Untagged legacy rows are excluded from Montgomery active incident generation
Montgomery/Conroe context is safe
```

## 5. Cross-County Switching Validation

### 5.1 Dayton → Willis

Validated behavior when switching from Dayton/Liberty context to Willis/Montgomery context:

- Active county changes to Montgomery.
- Montgomery awareness areas and bounds are used.
- Montgomery crossing inventory is loaded from Montgomery-owned assets.
- Liberty reports and untagged legacy Liberty-compatible rows do not appear in Montgomery context.
- Awareness updates against Montgomery active records only.

Representative audit/test outputs:

```text
Selected Montgomery awareness area overrides stale Liberty active county
County bounds cannot use Liberty awareness bounds for selected Montgomery area
Fit bounds cannot target Liberty for Conroe/Montgomery context
Montgomery crossing count cannot use Liberty crossing source
Legacy/global Liberty rows do not contaminate Montgomery incident generation
```

### 5.2 Willis → Dayton

Validated behavior when switching from Willis/Montgomery context back to Dayton/Liberty context:

- Active county returns to Liberty.
- Liberty crossing source remains `data/liberty-county-rail-crossings.geojson`.
- Liberty reports remain visible in Liberty context.
- Montgomery reports are blocked from Liberty context.
- Awareness updates against Liberty active records only.

Representative audit/test outputs:

```text
Liberty crossing runtime remains unchanged
Liberty crossing source remains Liberty-owned
Liberty reports remain visible in Liberty context
Montgomery reports are blocked from Liberty context
containment allows Liberty in Liberty
```

### 5.3 Cross-county leakage result

No cross-county leakage was validated in either switching direction. Reports remain county-contained, crossing inventory ownership is active-county scoped, and awareness updates correctly after county selection changes.

## 6. Crossing Experience Validation

### 6.1 Before V633

Before V633 through V633.8, crossing experience could expose low-quality or overly generic labels such as:

```text
ROGERS ROAD train blocking crossing
Train blocking crossing on Private
Local crossing impact
```

### 6.2 After V633-V633.8

After V633 through V633.8, validated crossing copy is normalized toward cleaner user-facing wording:

```text
Train Blocking Crossing
Train Blocking Crossing near Rogers Road
Train Blocking Crossing near FM 1097 at East Stewart Street / FM 1097
```

The validated formatter behavior uses `Train Blocking Crossing`, adds `near {road}` when a useful road token exists, and adds `at {crossing}` when a useful crossing token also exists. Low-quality visible labels such as `Private`, `Unknown`, `unnamed road`, `Local crossing impact`, and zero-coded street labels are suppressed.

Representative audit/test outputs:

```text
clean crossing formatter remains the location-field fallback
crossing awareness location labels have a shared low-quality suppression gate
reused alert text cannot promote Local Crossing Impact as a crossing fallback
crossing naming samples suppress low-quality visible location labels
```

## 7. Awareness Classification Validation

Final passing state for validated crossing scenarios:

```text
crossingCountedAsRoadHazard: false
safeForAwarenessClassification: true
bottomCountMatchesClassification: true
```

This state is supported by the following evidence:

- Crossing reports are classified as rail/crossing records and excluded from road-hazard fallback.
- Road-hazard classification counts only active hazard rows after lifecycle and duplicate-clear suppression.
- Bottom awareness count reads the classification road-hazard count and separately tracks crossing reports.
- Post-save and post-refresh crossing records are visible and promoted without becoming road hazards.

Representative audit/test outputs:

```text
crossing reports remain excluded from road-hazard fallback
crossing safety is based on post-suppression overlap
activeRoadHazardCount: roadHazardCandidatesAfterDuplicateSuppression.length
bottom panel derives crossing report count independently
bottomCountMatchesClassification: true
safeForCrossingAwarenessPromotion
```

## 8. Known Observations

Only actual remaining observations from the validation evidence are recorded:

- Legitimate private crossings may exist in source data; the user-facing issue was low-quality visible copy, not the existence of private crossing records.
- Crossing source data quality varies by county and row; Montgomery evidence includes rejected null-coordinate features and valid normalized features.
- Audit naming samples may still display raw source labels for diagnostic purposes, while visible crossing copy suppresses low-quality labels.

No additional runtime defects are introduced or documented by V635.

## 9. Final Determination

- **Liberty County runtime validation passes.**
- **Montgomery County runtime validation passes.**
- **Cross-county runtime validation passes.**

Overall determination: **CROSS-COUNTY RUNTIME VALIDATION PASS.**

## 10. Merge Recommendation

**Recommend merge.**

V635 is documentation-only and establishes the validated post-V634 cross-county runtime baseline before future county onboarding, DriveTexas reconsideration, broader beta-readiness work, or additional runtime changes.
