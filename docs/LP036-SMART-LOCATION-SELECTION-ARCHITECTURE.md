# LP036 — Smart Location Selection Architecture Investigation

Status: investigation only. No production behavior, onboarding, settings, awareness selection, runtime behavior, UI, or storage behavior was changed.

## Executive summary

Gridly already has most of the raw ingredients needed for Smart Location Selection, but ownership is split across three overlapping concepts:

1. **Active county runtime context**: `window.GRIDLY_ACTIVE_COUNTY_ID`, county registry records, county runtime sources, crossing inventories, roadway manifests, boundary overlays, and report containment.
2. **Selected awareness/community context**: a persisted single community/home-town string plus a derived `GRIDLY_AWARENESS_AREA_DEFINITIONS` object. This object currently carries county, community, countywide, Houston-region, coordinates, radius, and map startup details.
3. **User profile/settings context**: `gridlySettingsV1`, `gridlyUserProfileV1`, and the legacy `gridlyHomeTown` key independently persist the same effective area.

The safest future path is not to remove county first. It is to add a **passive, centralized location resolution object** that derives the existing county/community/region/awareness fields, writes through the existing preference owners only after certification, and initially feeds existing owners rather than replacing them.

## Current ownership model

### Primary owners

| Owner | Current responsibility | Important functions / constants | Notes |
|---|---|---|---|
| County registry | County catalog, default county, selectable/operational state, runtime source metadata, awareness candidates. | `GRIDLY_DEFAULT_COUNTY_ID`, `GRIDLY_COUNTY_REGISTRY`, `gridlyNormalizeCountyId`, `gridlyGetActiveCountyId`, `gridlyGetActiveCountyConfig`, `gridlyGetCountyRuntimeSources` | County remains the foundational runtime primitive. |
| Active county context | Global active county, stale awareness reset, crossing reload, roadway activation, visible surface resync, map fit. | `gridlySetActiveCountyContext`, `gridlyClearStaleAwarenessAreaForCountyContext`, `resyncGridlyActiveCountyVisibleSurfaces`, `gridlyFitMapToActiveCountyContext` | This is the critical mutation boundary for county changes. |
| Awareness area registry | Community/countywide/Houston-region definitions and aliases. | `GRIDLY_AWARENESS_AREA_DEFINITIONS`, `GRIDLY_AWARENESS_AREA_BY_KEY`, `resolveGridlyAwarenessArea`, `resolveGridlyAwarenessAreaForCounty` | A single awareness object is the best future bridge between consumer location and county internals. |
| Settings preferences | Persisted display, notification, personalization, and community fields. | `GRIDLY_SETTINGS_STORAGE_KEY`, `normalizeGridlySettings`, `getGridlySettingsPreferences`, `saveGridlySettingsPreferences` | Settings normalizes `community.homeTown` and `community.awarenessArea` through awareness-area resolution. |
| User profile | First-run/setup completion, ZIP, home town, awareness labels/coords/county. | `GRIDLY_PROFILE_STORAGE_KEY`, `getDefaultGridlyProfile`, `getGridlyUserProfile`, `saveGridlyUserProfile` | Setup completion and selected awareness metadata are profile-owned. |
| First-run walkthrough | Completion key, manual ZIP/city/current-location resolution, setup completion. | `GRIDLY_BETA_FIRST_RUN_WALKTHROUGH_STORAGE_KEY`, `isGridlyFirstRunWalkthroughComplete`, `completeGridlyV858FirstRunSetup`, `resetGridlyFirstRunWalkthroughState` | GPS exists as optional onboarding helper, not an always-on app location owner. |
| Roadway runtime | County-scoped road asset/manifest resolution and active road segment view. | `GRIDLY_ROADWAY_RUNTIME_MANIFEST_URL`, `gridlyResolveRoadwayRuntimeSource`, `gridlyActivateRoadwayDatasetForActiveCounty`, Harris partition constants | County is currently required to choose runtime packages. |
| DriveTexas connector | Fetch/normalize official records, derive awareness view from selected area. | `gridlyDriveTexasConnector.fetchNow`, `resolveSelectedAwareness`, `filterAwarenessRecords`, `refreshAwarenessView` | The connector already separates retained source records from area-filtered awareness records. |
| Report flow | Report state, selected coordinates, canonical road context, county-scoped metadata. | `updateReportingState`, `gridlyGetCountyScopedReportMetadata`, `gridlyReportMatchesActiveCounty`, report submit handlers | Report ownership depends on active/derived county plus road context. |

## Complete ownership maps

### 1. Setup ownership

First-run has two layers: legacy setup aliases and the current V858/V859 walkthrough.

- **Completion storage**: canonical completion is `gridlyBetaFirstRunWalkthroughCompleteV894C`; legacy keys are cleared by `gridlyClearFirstRunLegacyCompletionKeys`.
- **Completion readers/writers**: `isGridlyFirstRunWalkthroughComplete` reads the canonical key; `markGridlyWelcomeSeen` writes `yes`; `closeGridlyWelcomeOnboarding` calls it when `persist` is true.
- **Setup profile state**: `completeGridlyV858FirstRunSetup` writes `setupComplete: true`, `setupSkipped: false`, ZIP, homeTown, awareness area, awareness key/label/county, and then activates the resolved county.
- **Initial county ownership**: defaults to `GRIDLY_DEFAULT_COUNTY_ID` (`liberty-tx`) until selected/entered area resolves to another awareness area and county.
- **Initial community ownership**: first-run manual ZIP/city uses `resolveGridlyV858FirstRunLocation`; GPS uses `resolveGridlyV858NearestAwarenessArea`; county/community dropdown uses `gridlyWelcomeSelectedCountyId` plus `renderGridlyWelcomeHomeTownSelection`.
- **Initial awareness ownership**: `saveGridlyHomeTownPreference` writes settings/profile/localStorage and `completeGridlyV858FirstRunSetup` cements the same awareness context.
- **Default selection behavior**: default county is Liberty; awareness fallback includes countywide areas and Dayton-oriented V858 fallback for unresolved nearest-area behavior.
- **Reset behavior/testing helpers**: `resetGridlyFirstRunWalkthroughState` removes canonical and legacy completion keys, optionally resets profile setup fields, removes the old modal, records reset time, and returns an audit object.

### 2. Settings ownership

Location-related settings are owned by `gridlySettingsV1.community` and rendered through hierarchical county/community selectors.

| Setting | Storage field | Writer | Reader / consumer |
|---|---|---|---|
| County selector | `community.countyId` derived from selected awareness area | `normalizeGridlySettings`, `saveGridlySettingsPreferences`, selector change handlers | `buildGridlySettingsAwarenessOptionsHtml`, `gridlyResolveHierarchicalAwarenessSelection` |
| Community selector | `community.homeTown` / `community.awarenessArea` | `saveGridlyHomeTownPreference`, settings selector handlers, stale-county reset | `getGridlySelectedAwarenessArea`, `getGridlyHomeTownPreference`, awareness surfaces |
| Awareness selector | same as community plus `awarenessAreaKey` | `saveGridlyHomeTownPreference`, first-run completion, settings save | map focus, alerts, DriveTexas, pulse, travel brief |
| Houston region selector | represented as awareness-area definitions with `houstonRegion`, `parentCommunity`, `awarenessRegionId`, `awarenessRegionLabel` | LP035.1 awareness definition registration and normal preference writers | existing awareness selectors and filters; no independent production region state outside awareness object |
| Saved preferences | `gridlySettingsV1`, `gridlyUserProfileV1`, `gridlyHomeTown` | settings, first-run, stale-county reset | profile UI, map focus, summaries, startup |

### 3. Location ownership

| Location concept | Current owner | Modifiers | Consumers |
|---|---|---|---|
| GPS/current location | `userLocation` and geolocation helper flow | `requestGridlyWelcomeLocation`, `setGridlyUserLocation`, location buttons | nearest context, nearby filter, first-run optional setup |
| ZIP | profile `zipCode`; V858 static ZIP-to-area mapping; `ZIP_FALLBACK_LOOKUP` | first-run manual input / completion | first-run area resolution only; not a generalized runtime resolver |
| County | active county global + awareness area countyId + settings/profile county | `gridlySetActiveCountyContext`, `completeGridlyV858FirstRunSetup`, stale reset | road runtime, crossings, boundaries, report filtering, DriveTexas, alerts, summaries |
| Community | awareness-area `storageValue`/`label` | `saveGridlyHomeTownPreference`, first-run, settings selector | community pulse, map focus, report/popup copy, Travel Brief |
| Houston region | awareness area object with Houston metadata | LP035.1 definitions; human label resolver | alert/awareness filters and presentation where records carry region metadata |
| Awareness area | `GRIDLY_AWARENESS_AREA_DEFINITIONS` resolved through settings/profile/localStorage | `saveGridlyHomeTownPreference`, `gridlyClearStaleAwarenessAreaForCountyContext`, first-run | nearly all consumer awareness surfaces |

### 4. Local storage ownership inventory

| Key | Owner | Writer | Reader | Purpose |
|---|---|---|---|---|
| `gridlySettingsV1` | Settings | `saveGridlySettingsPreferences`, `loadGridlySettingsPreferences` seed | `getGridlySettingsPreferences`, `getGridlySelectedAwarenessArea` | Settings/community/display/preferences canonical object. |
| `gridlyUserProfileV1` | Profile/setup | `saveGridlyUserProfile`, first-run, stale reset | `getGridlyUserProfile`, `getGridlySelectedAwarenessArea` | User profile, setup state, home/awareness metadata. |
| `gridlyHomeTown` | Legacy/simple awareness preference | `saveGridlyHomeTownPreference`, stale reset | `getGridlySelectedAwarenessArea`, `getGridlyHomeTownPreference` | Backward-compatible home-town/awareness string. |
| `gridlyBetaFirstRunWalkthroughCompleteV894C` | First-run walkthrough | `markGridlyWelcomeSeen`, close/finish/skip | `isGridlyFirstRunWalkthroughComplete` | Canonical first-run completion flag. |
| Legacy completion keys | Legacy onboarding | removed by `gridlyClearFirstRunLegacyCompletionKeys` | reset/audit compatibility | Prevents old completion sources from competing. |
| `gridlySavedPlacesV1` | Saved places/Route Watch | saved-place functions | route/settings surfaces | Home/work/favorite places, not awareness ownership. |
| `gridlySelectedPlaceIdV1` | Saved places | place selection functions | route/settings surfaces | Selected saved place. |
| `gridlyMovementIntelligenceV1` | Movement intelligence | `saveMovementIntelligence` | `getMovementIntelligence` | Corridors and route observations. |
| `gridlySmartAlertsV1` | Notification/settings | smart alert preference functions | alerts/settings | Notification preferences. |
| `gridlyMapStyleV1` | Display settings | `applyGridlySettingsDisplayPreferences` | map/style startup | Map base layer style. |
| `gridlyDeviceId` | Device identity | startup device-id initialization | report submissions/identity | Anonymous device/report identity. |
| `gridlyEventHistoryV1` | event history | event history writer | event history/audits | Runtime event/audit history. |
| `gridlyAppLocationReadinessStartupPromptAttemptedV257_9` | location prompt guard | startup prompt flow | startup prompt flow | Prevents repeated startup prompt attempts. |

No direct production keys named `selectedCounty`, `selectedCommunity`, `awarenessArea`, `activeArea`, `preferredCounty`, or `preferredCommunity` were found as standalone storage keys in active code; those concepts are fields within settings/profile or are variable names.

### 5. Awareness ownership

Location affects consumer surfaces through `getGridlySelectedAwarenessArea`, `getGridlyCanonicalAwarenessPresentationContext`, and awareness-summary builders.

| Surface | Location input | Derived state / behavior |
|---|---|---|
| Community Pulse | selected awareness area and active reports/hazards/crossings | localized summary, quiet/activity copy, area name. |
| Travel Brief | selected awareness plus DriveTexas connector records and reports | official roadway lines and community condition lines filtered to awareness. |
| Know Before You Go | same summary/brief ecosystem | consumer-ready localized guidance. |
| Alerts | active county + selected awareness area + report/official fields | county containment, area filtering, consumer labels. |
| Map | awareness area coordinates/bounds and active county bounds | startup center/zoom, fit bounds, identity boundary. |
| Report filtering | active county and report county/coordinate metadata | active visible reports/hazards retained only when matching active county. |
| Crossing filtering | active county crossing inventory plus town/county/nearby filter | crossing list/render containment. |
| Narratives / summaries | awareness area label plus canonical road context | consumer copy avoids raw county/provider metadata where possible. |

### 6. Roadway runtime ownership

County currently drives the roadway runtime. `gridlyResolveRoadwayRuntimeSource(countyId)` picks registry road sources, roadway manifest entries, or Harris partition runtime status. `gridlySetActiveCountyContext` calls `gridlyActivateRoadwayDatasetForActiveCounty` after active county changes. Harris adds a partition manifest/package layer but still begins from `harris-tx`.

A resolved location object could replace direct county parameters only if it exposes at least:

- `countyId`
- `awarenessAreaKey` or community key
- optional focus point / bounds for Harris package selection
- versioned roadway runtime source/manifest eligibility

Until that object exists and is audited, county remains required for safe roadway activation.

### 7. DriveTexas ownership

DriveTexas ownership is split cleanly:

- Provider normalizes official records.
- Connector retains the full normalized dataset separately from area-filtered awareness records.
- `resolveSelectedAwareness` reads `getGridlySelectedAwarenessArea` and derives label/key/county/radius/text fallback terms.
- `filterAwarenessRecords` performs coordinate/radius filtering first, then text fallback.
- Travel Brief and audits consume `gridlyDriveTexasConnector.getNormalizedRecords()` as the awareness presentation view.

Future region/county resolution can feed DriveTexas by producing the same awareness object shape; ingestion should not be rewritten first.

### 8. Report ownership

Report submission depends on:

- selected/report coordinates,
- active county or coordinate-resolved county metadata,
- canonical road context / nearest road resolver,
- selected awareness area labels and county IDs,
- Houston region metadata when present in normalized records.

The report write path should remain source-owned until LP036 has a passive resolver that can produce a certified report ownership envelope. Future Houston-region report records should preserve parent community and region metadata without letting region labels outrank road/intersection context.

### 9. Houston regionalization ownership review

LP035.1 introduced/validated a practical three-level model by representing Houston regions as awareness areas instead of a wholly separate selector state. Boundaries:

- **Parent Houston ownership**: `Houston` remains a valid Harris awareness community and backward-compatible saved preference.
- **Child region ownership**: regions use IDs such as `houston-downtown-midtown`, labels, parentCommunity `Houston`, and region metadata fields.
- **Compatibility**: saved `Houston` resolves to Houston-wide mode; human labels can resolve to region objects; Kingwood/Clear Lake and other independent communities are not absorbed.
- **Scalability risk**: single-string persistence can encode region labels, but it does not model `county → parent community → region` as first-class state. A resolver object should include all three explicitly.

### 10. County dependency inventory and classification

A repository search found thousands of county-related references. They classify as follows:

| Class | Examples | Classification |
|---|---|---|
| Runtime required | `GRIDLY_COUNTY_REGISTRY`, `gridlyGetCountyRuntimeSources`, roadway/crossing source paths, Harris partition constants | Required now. |
| Derived from awareness | `gridlyResolveCountyIdForAwarenessArea`, `getGridlySelectedAwarenessArea().countyId`, settings `community.countyId` | Could be resolver-derived later. |
| Persistence compatibility | profile `awarenessAreaCountyId`, settings `community.countyId`, legacy `gridlyHomeTown` | Must migrate carefully. |
| Presentation only | county names in selector labels, settings summaries, audit copy | Removable from consumer-facing default flows after resolver exists. |
| Filtering/containment | `gridlyReportMatchesActiveCounty`, county bounds checks, active report filtering | Required until all records carry resolved ownership. |
| Legacy/test/audit | sentinel comments, migration audits, doccleanup, tests | Keep for regression coverage; not product blockers. |
| Potentially removable | direct county selector requirement in first-run/settings, direct county copy in onboarding | Only after resolver and migration pass. |

## Future location resolution architecture

Feasible target model:

`GPS or ZIP/manual place → Location Resolution Engine → county → community → parent community/region → awareness area → roadway runtime request → DriveTexas awareness view → Community Pulse/Travel Brief/Alerts → Report ownership envelope`

Recommended resolved object shape:

```js
{
  source: "gps" | "zip" | "manual_area" | "saved_preference" | "legacy",
  confidence: "high" | "medium" | "low",
  countyId,
  countyName,
  communityKey,
  communityLabel,
  parentCommunity,
  awarenessAreaKey,
  awarenessAreaLabel,
  awarenessRegionId,
  awarenessRegionLabel,
  lat,
  lng,
  radiusMiles,
  countyWide,
  roadwayRuntime: { countyId, packageHint, focusPoint },
  driveTexas: { awarenessTerms, radiusMiles },
  storageCompatibility: { homeTown, awarenessArea, awarenessAreaKey, countyId }
}
```

The engine should initially be read-only/passive and compare its output against current owners before any write-through.

## Backward compatibility risks

1. Existing users may have `gridlyHomeTown` only, `gridlySettingsV1` only, `gridlyUserProfileV1` only, or conflicting values.
2. Saved `Houston` must remain Houston-wide and must not silently become a region.
3. Region labels in a single string can be ambiguous without parent community/county metadata.
4. Countywide saved values such as `Entire Liberty County` and `Montgomery County` must continue to map to countywide awareness objects.
5. Active county changes currently clear stale awareness and reload crossing/roadway state; resolver write-through must avoid loops and duplicate reloads.
6. Report records and Supabase rows must not be rewritten during preference migration.
7. GPS permission denial must not block manual ZIP/home-area setup.

## Recommended migration strategy

1. Add passive resolver and audit only.
2. Read existing storage in precedence order: settings community, profile awareness/homeTown, legacy `gridlyHomeTown`, first-run ZIP when available, default countywide fallback.
3. Produce a resolved object and compatibility projection; do not write.
4. Add tests comparing resolver output to current `getGridlySelectedAwarenessArea` and `gridlyGetActiveCountyId` for Liberty, Montgomery, San Jacinto, Harris/Houston, Houston regions, countywide values, and legacy aliases.
5. After certification, write only through `saveGridlyHomeTownPreference` / `saveGridlySettingsPreferences` / `saveGridlyUserProfile`; do not create competing storage keys.
6. Preserve legacy keys until telemetry/audits show safe redundancy.

## Recommended implementation order

### LP036.1 — Passive Location Resolution Engine

- Add a resolver module that accepts GPS, ZIP, manual area, and saved preferences.
- Return the resolved object shape above.
- No UI and no writes.
- Add audit comparing resolver output with current owners.

### LP036.2 — Storage Compatibility and Migration Audit

- Inventory live storage states and conflict precedence.
- Add dry-run migration report for settings/profile/legacy homeTown.
- Certify Houston-wide and Houston-region compatibility.

### LP036.3 — Runtime Consumer Adapter

- Feed the resolver output into non-mutating adapters for roadway runtime hints, DriveTexas awareness context, reports, alerts, and summaries.
- Keep existing owners authoritative.

### LP036.4 — Controlled Write-through Behind Gate

- Allow resolver-confirmed selections to write via existing preference functions only.
- Add rollback/reset helpers and regression tests.

### LP036.5 — Consumer-first Selection UX Activation

- Only after LP036.1–LP036.4 pass, replace required county choice with “Use My Location” / “Enter ZIP Code” / fallback manual area selection.
- County remains internal and visible only in advanced/settings contexts as needed.

## Merge recommendation

**NO — investigation branch.** This branch should be reviewed as architectural discovery and not treated as production implementation authorization.
