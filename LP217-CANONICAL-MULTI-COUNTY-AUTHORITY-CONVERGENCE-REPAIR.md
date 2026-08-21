# LP217 — Canonical multi-county authority convergence repair

## Root cause and production repair

LP216 proved two related contract failures. Canonical PLACE callers rendered one undifferentiated action and called `gridlySaveCanonicalMultiCountyPlaceHome` without its required operational county, so activation correctly failed closed (Family C). The county-grouped path began with `resolveGridlyAwarenessAreaForCounty`, then passed only the community label through `resolveGridlySettingsAwarenessSaveValue` and globally called `resolveGridlyAwarenessArea`; registry-order `find` rebuilt the wrong membership before every downstream consumer (Family J).

LP217 changes `filterGridlyManualAwarenessAreas`, `resolveGridlyManualAwarenessAreaSearch`, `renderGridlyManualAwarenessAreaPicker`, `renderGridlySettingsAwarenessSearchResult`, and `gridlyLp0516ApplyManualAwarenessArea` so each governed membership is an explicit choice. Every canonical call now passes the chosen county ID. `gridlySaveCanonicalMultiCountyPlaceHome` remains fail-closed: it normalizes the supplied ID and verifies that county's FIPS is in the canonical PLACE membership set. It never selects membership zero, registry order, a coordinate, or previous runtime state.

`selectGridlySettingsAwarenessArea` now retains the object returned by `resolveGridlyAwarenessAreaForCounty`. For canonical multi-county areas it constructs the existing canonical result shape and immediately enters the canonical save contract with `selectedCountyId`. The old `saveValue` → global label resolution → `reconstructedArea` path is not executed for that selection. Single-county behavior continues through the existing save path.

## Persistence and rehydration

The home-personalization record now stores the pair: canonical `PLACE_GEOID` (`communityKey`) plus governed `countyId` (and county name), while preserving all governed FIPS memberships. `gridlyLp0517ValidateHomeRecord` validates that stored county against those memberships and returns the county-projected canonical area. `getGridlySelectedAwarenessArea` recognizes the county-qualified canonical record, and `gridlyResolvePersistedCanonicalPlaceOperationalCounty` gives the validated home record precedence over matching profile and settings projections. A record with no explicit authority no longer inherits the previous active county; it remains unresolved.

After validation, the existing `gridlySynchronizeActiveCountyForOperationalContext` transaction remains the single fan-out. It synchronizes active county and persists the same canonical key/county into settings and profile; crossings, roadways, awareness, and presentation continue to consume that established authority. LP202.2/LP213 transition-generation checks are unchanged. The delayed presentation callback still compares its captured generation, so an earlier transition cannot redispatch after a newer county-qualified transition.

## Deterministic cases

Before LP217, Midland PLACE `4848072` either failed canonical activation or lost `midland-tx` and reconstructed Martin. It now offers each governed county explicitly; choosing Midland supplies and persists `midland-tx`. Abilene PLACE `4801000` likewise preserves an explicit Taylor choice as `taylor-tx`, rather than rebuilding Jones. Stanton retains its sole Martin membership (`martin-tx`) and follows the unchanged single-county path.

Focused coverage includes Midland, Abilene, New Braunfels, Austin, Corpus Christi, San Diego, San Marcos, Monahans, Odessa, and Denver City without name-based production branches. The statewide LP213 authority artifact remains the deterministic source for all 163 canonical multi-county identities. The post-manual statewide certification remains responsible for 2,058/2,058 membership conservation, 1,859/1,859 presentation coordinates, and 254/254 crossing inventory availability. No static membership, presentation, crossing, roadway, or geometry data changed.

## Instrumentation, foundations, and tests

`window.gridlyTransitionTrace` and its LP216 schema remain behavior-neutral. The repaired path records county-scoped selection, explicit membership validation, authoritative resolution, active-county decision, presentation, crossing source/render, roadway source, awareness projection, and settings/profile persistence. The obsolete `label_only_reconstruction` event disappeared with the production reconstruction itself. Stale-stage and transition-generation fields remain available.

Automated verification consists of `node --check js/app.js`, LP217 focused contract/cohort tests, LP216 instrumentation regression, post-manual statewide certification, LP214, LP213, LP202.1, LP202.2, and `git diff --check`. These deterministic checks are not full browser certification.

Protected foundations are LP202.2 active-county cleanup, LP213 stale convergence, canonical membership datasets, presentation coordinates, county crossing packages, and roadway packages. LP217 does not address Alerts markup (A), Location Context reconciliation (G), watched crossing count (I), official roadway subtype/KBYG (K), Community Pulse wording (L), generated incidents (M), Val Verde countywide awareness, community-report propagation, performance, or low-water-crossing product work.

## Owner browser acceptance (still required)

Run Midland → Midland County, Abilene → Taylor County, Stanton → Martin County, New Braunfels, Austin, and Corpus Christi through their explicit county choices. After each settled transition, run this concise console projection:

```js
(() => {
  const t = window.gridlyTransitionTrace;
  const last = (stage) => [...(t?.stages || [])].reverse().find((row) => row.stage === stage);
  const county = (stage) => last(stage)?.subsystemCounty ?? last(stage)?.authoritativeCounty ?? null;
  return {
    canonicalCommunity: t?.canonicalCommunity,
    selectedMembership: t?.selectedMembership,
    authoritativeMembership: last("authoritative_county_resolution")?.authoritativeMembership,
    activeCounty: last("active_county_decision")?.activeCounty,
    crossingCounty: county("crossing_render_county") || county("crossing_source_resolution"),
    roadwayCounty: county("roadway_source_resolution"),
    awarenessCounty: county("awareness_county_projected"),
    settingsCounty: county("settings_county_persisted"),
    profileCounty: county("profile_county_persisted"),
    transitionGeneration: t?.stages?.at(-1)?.transitionGeneration,
    staleStages: (t?.stages || []).filter((row) => row.staleState)
  };
})()
```

Expected: every county field equals the membership explicitly chosen for that case, and `staleStages` contains no completion that replaced the current authority. Record actual owner evidence; do not infer a browser PASS from the automated suite.
