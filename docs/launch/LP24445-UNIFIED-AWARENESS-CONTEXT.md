# LP244.45 — Unified awareness context foundation

Baseline: `44f2778caf9cc9e10edde4fdb629d60d4dc0fd91`. Branch: `LP244.45-unified-awareness-context-foundation`. This is JavaScript context work only; native, reporting activation, notification delivery, taxonomy, website and Dispatch are outside scope.

## Before-patch RCA

Recorded before runtime edits. `js/app.js:getGridlySelectedAwarenessArea` (baseline48555) always reads confirmed Home, Settings and profile. Search selection (46335) sets `GridlySearchState.activeResult/selectedDestination`, destination marker and map focus, but never changes that reader. Consequently the destination/map may say Crosby while shared awareness still reads Cleveland. Clearing a destination (41405) clears search/route preview only.

| Owner / consumer | Baseline functions/state | Problem or legitimate separate owner |
|---|---|---|
| Persistent Home | `gridlyReadHomePersonalizationRecord`, `gridlyApplyConfirmedHomePersonalization`, `saveGridlyHomeTownPreference`, `gridlyUserProfile`, Settings community fields | Explicit persistence workflow must remain separate |
| Selected awareness | `getGridlySelectedAwarenessArea`, `gridlySelectedAwarenessAreaResolutionCache` | Persisted Home always wins; no temporary selection owner |
| Search/destination | `normalizeGridlySearchResult`, `selectGridlySearchResult`, `clearGridlyPendingDestination`, `GridlySearchState` | Destination identity exists; preserve POI title/coordinates separately from community |
| Operational county | `GRIDLY_ACTIVE_COUNTY_ID`, `gridlySetActiveCountyContext`, `gridlyActiveCountyTransitionGeneration` | Reuse generation/hydration; temporary transitions must pass preservePersistedAwareness |
| Map / Location Context | `gridlyActiveGeographicPresentation`, `getGridlyCanonicalAwarenessPresentationContext`, `getGridlyHomeTownAwarenessAnchor`, `syncGridlyAwarenessAreaSurfacesImmediately` | Legacy Home-named anchor actually delegates shared awareness; presentation may independently prefer map coordinate |
| Weather / NWS | `gridlyResolveGovernedWeatherPoint`, `js/gridlyWeatherLiveConnector.js` | Reader inherits Home; existing NWS identity cache/publication generation is reusable |
| DriveTexas | `gridlyLp0391GetSelectedAwarenessArea`, `js/gridlyDriveTexasLiveConnector.js:refreshAwarenessView` | Existing derived area views follow shared getter; preserve source geometry/radius/provider activation |
| Community / KBYG | `buildGridlyCommunityAwarenessIntelligenceSummary`, `gridlyGetGovernedActiveAwarenessRows`, portrait snapshot caches | Shared selected-area and active-county ownership must transition together, invalidating cached summaries |
| Crossings | `gridlySelectConsumerVisibleCrossings`, `getGridlyHomeTownCrossings`, `ensureGridlyActiveCountyCrossingInventory` | Getter plus county-owned inventory; existing generation rejects stale county hydration |
| Nearby Places | `gridlyGetCurrentGovernedLocationContext`, `js/gridlyPoiBrowserProvider.js:requestForCurrentContext/refreshSurfaceContext` | Must use selected identity; old visible results must not survive a new context |
| Foreground location | `setGridlyUserLocation`, `requestGridlyUserLocationFromControl`, `requestGridlyForegroundPosition` | Existing location does not itself write Home; native timestamp parity deferred to .47 |
| Route Watch | `startInlineRouteWatch`, `clearInlineRouteWatch`, `stopInlineRouteWatch`, route publication generation/proximity | Separate existing trip state; no automatic context takeover or rewrite in .45 |

Existing LP216/219 county-transition generation and source identity gates will be reused. No new persistent temporary-context key, no new UI panel or routing framework. Context ownership follows the last explicit valid selection; stale coordinates and inactive future route placeholders do not participate.

Implementation and verification results follow.


## Implemented contract and ownership

The runtime-only store centralizes HOME, SEARCH, AROUND_ME, ROUTE_WATCH and NONE. The authoritative snapshot is returned by gridlyGetCurrentAwarenessContext. Existing consumers retain getGridlySelectedAwarenessArea as their compatibility adapter to that same owner; its legacy body remains the persisted Home resolver. The snapshot includes type/contextType, placeId/placeName, countyId/countyName, memberships, presentation lat/lng, source, selectedAt, generation, expiresAt, health, routeWatchId, destinationId and the governed area projection. Snapshot and memberships are frozen.

Only an explicit selected Search result activates temporary awareness in this phase. Active Search takes precedence over Home, including an unavailable temporary selection: it cannot silently expose Home under a temporary identity. No temporary state means existing Home rehydration, or NONE if the existing Home resolver has no area. Old GPS fixes and inactive Route Watch placeholders never participate. Future Around Me and Route Watch activation remains deferred rather than introducing competing implicit priority owners.

Search normalization preserves requested operational county and county metadata. Canonical destinations resolve through existing PLACE registry/coordinate governance. Austin/Hays and Austin/Travis remain separate operational projections of one PLACE, as do Abilene/Jones and Abilene/Taylor. An invalid explicit membership is unavailable; it does not select the first membership. Existing Home multi-county persistence and projection logic is unchanged.

POI identity remains the destination title and exact destination point. Source city/town/village metadata can qualify a surrounding canonical community using the existing locality resolver and radius. This is not a new polygon containment or nearest-community policy. Without qualified locality, a valid county-qualified coordinate uses Selected location and DIRECT_COORDINATE; a POI name is never promoted to PLACE identity. Without qualification, the temporary context is unavailable.

Settings is a legitimate Home-only reader. Both getGridlySettingsAwarenessAreaDisplay and the legacy fallback in getGridlyLp0517SettingsHomeDisplay request homeOnly from the existing getter. Opening Settings while Search is Crosby therefore shows Cleveland and Liberty County. Explicit existing Home save workflows retire the temporary context; they remain the only writers of Home preferences. ZIP confirmation already delegates to that existing Home save workflow.

## Transition, generation and storage

Selection updates the context before the existing destination/map render. One transition operation invalidates shared snapshots, updates operational county only when needed with preservePersistedAwareness, refreshes source projections, clears previous visible Nearby results, and re-filters crossings. LP216/219 remains the county hydration generation owner; same-county switches reuse datasets. The context generation additionally protects POI result publication/request audit. NWS retains its identity/generation request gate; invalid authority now also clears previously normalized records. Tests release an old response after a newer context and verify it cannot overwrite that context.

The existing destination clear/change action calls gridlyClearTemporaryAwarenessContext. Home awareness and semantic camera restore without reload. Closing Search without clearing preserves the selected context and Home bytes, as before for destination selection. Browser/native back routing is unchanged; no new navigation framework or listener was introduced. Native hardware back is not device-tested here.

No new persistent storage, migration, location history, analytics, background timer or native permission is introduced. Search and Around Me snapshots are runtime-only. Reload rehydrates saved Home and discards Search. Route Watch retains its separately governed storage/activation/stop behavior. The bounded development trace keeps at most 20 selection metadata records, without precise coordinates.

Around Me has a foreground snapshot factory and freshness predicate: a finite timestamp at most 120 seconds old is fresh; future/missing/older timestamps are rejected. Invalid or stale coordinates are removed from the snapshot. The factory does not activate a context, invoke a provider, write Home, or start tracking. Existing foreground geolocation is unchanged. LP244.47 owns activation/provider parity; LP244.51 owns Route Watch integration. The ROUTE_WATCH type and routeWatchId field provide compatibility only.

## Consumers and degraded behavior

The machine-readable inventory is reports/lp24445-context-consumer-map.json. It lists Map, Location Context, Weather, NWS Alerts, DriveTexas, Community Awareness, Crossings, Nearby Places and KBYG, their exact adapters and generation protection, plus legitimate independent Home/destination/route/county readers.

Cleveland Home with Crosby Search resolves Crosby for governed weather/alerts, DriveTexas area derivation, community and crossing geometry, Nearby request context, Location Context, and Travel Brief. Existing source activation, geometry, radius, crossing governance and train-presence semantics are unchanged.

An unavailable temporary area returns no governed weather or Nearby context; NWS clears old records, canonical presentation supplies no fallback county, and community/crossing membership rejects records. Travel Brief explicitly returns an UNAVAILABLE model. The existing summary reconciliation may display Status being confirmed instead of the unavailable phrase; it does not report quiet or all clear. No temporary failure silently substitutes Home. Source outages within a valid selected context continue using existing source-health handling.

## Portrait and performance evidence

At 390 x 844, baseline/current Home layout bounds are identical. Captures cover Home/header/map, open destination Search, expanded Travel Brief and expanded Home Settings. The only UI content change is the existing visible Travel Brief heading including the temporary place name: TRAVEL BRIEF · Crosby. No CSS, HTML, duplicate panel or new control was added. Settings continues to show Cleveland during Crosby Search. Existing light-theme low contrast is visible in both baselines and current captures; this phase does not restyle it. Remote map tiles are blocked in the harness, so screenshots certify local layout, not live tile rendering.

The deterministic request audit records three baseline NWS requests (Cleveland points, forecast, alerts); baseline incorrectly never requests Crosby. Current records six requests: exactly one three-request set for Cleveland and one for Crosby, with no duplicated Crosby set. Existing NWS request coalescing/cache and DriveTexas derived-view refresh remain in use. The focused transition test records one explicit weather/road/POI/summary refresh per selection or clear. Existing Home getter callbacks can still request cached refreshes; no new provider polling, rAF loop or repeated dataset hydration was introduced. This is a bounded request audit, not a device frame-time benchmark.

## Validation and limitations

- Focused LP244.45: 16/16 pass, including persistence isolation, context precedence/clear/restart, Austin and Abilene county choices, POI identity, unavailable qualification, 120-second staleness, inactive route compatibility, bounded trace, Home-only Settings reader, and actual delayed NWS/POI publication.
- Existing consumer regression batch: 27 suite files, 205 tests, 199 pass and six failures. All six reproduce at starting HEAD in lp219-governed-awareness-evidence-contract.test.cjs: five report-classification expectations and map-to-Alerts/KBYG eligibility. They are existing expectation failures, not new LP244.45 regressions.
- Additional direct POI provider suite: 19/19 pass. This brings existing runnable test totals to 224, with 218 pass and the same six failures.
- The initial baseline also included lp24429a-reporting-availability.test.cjs: 12 environment failures because local PostgreSQL at 127.0.0.1:55441 is unavailable. It was excluded from the final runnable batch; no database migration or production connection was attempted.
- Browser: 12 scenario groups pass with no page errors, using actual app code and governed local datasets. Includes Cleveland, Crosby, Dayton, Austin/Hays, Austin/Travis, Abilene/Jones, Abilene/Taylor, Dallas, POI punctuation/locality, unavailable KBYG, clear, restart and Home Settings. Four existing Home storage values are byte-identical across Search transitions and clear.
- The browser profile seeds existing saved Home/Work destinations. A fresh empty profile exposed an unchanged baseline null saved-place error in js/gridly-saved-address-integrity.js:needsLegacyRevalidation (default object argument does not cover null); it prevents startup event binding. This is documented rather than repaired outside context scope. Fresh-install certification remains deferred.
- Browser NWS responses are deterministic stubs. Other remote requests, backend writes and production requests are blocked. These checks do not certify live provider availability, native hardware or backend reporting. JavaScript syntax and git diff whitespace checks pass.

Reproduce focused tests with node --test tests/lp24445-unified-awareness-context.test.cjs; browser checks with node tools/lp24445/verify-browser.mjs and the --baseline variant. reports/lp24445-test-evidence.json records exact suite paths, counts, observations and portrait artifacts. No unrelated historical certification artifacts were regenerated.

## Noninterference and disposition

Runtime edits are limited to js/app.js, js/gridlyPoiBrowserProvider.js and js/gridlyWeatherLiveConnector.js. Reporting activation, moderation, retention and privacy are unchanged. Notifications/push/FCM/APNs, taxonomy/winter markers, Android/iOS native configuration and permissions, Capacitor config, public-site/gridlygo.com, Dispatch/Responder/Phase 28 and production are untouched. No build, push, merge or deployment was performed.

Acceptance is ready for owner review within the tested context-foundation scope. Deferred items are the existing six LP219 expectations, unavailable local database suite, existing empty-profile saved-address startup issue, live/native acceptance, Around Me activation in .47 and Route Watch context activation in .51. The authorized output is one local commit named Implement unified awareness context foundation.
