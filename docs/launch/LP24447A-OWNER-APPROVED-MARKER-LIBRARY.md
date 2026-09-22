# LP244.47A — Owner-approved marker library implementation

**READY FOR OWNER FINAL VISUAL REVIEW**. Technical verification is not final owner approval or authorization to publish.

Starting state: clean `LP244.47-marker-system-unification` at `a3d5d1ffa077fb98aab8610e328e3e2e67c6c9e8`.

## Approved direction and reference

The owner's written LP244.47A specification and supplied `ChatGPT Image Sep 21, 2026, 02_37_10 PM.png` govern this implementation. Navy is the dominant body, white pictograms carry meaning, and restrained color follows the pin edge. This replaces the previous colored-body/inset-ring design. The shared teardrop fits the complete SVG viewbox without clipping; no gradient, embedded font, raster content, external dependency or runtime SVG generation is used.

The written constraints take precedence where the reference illustration differs: black ice retains slick roadway/glint plus uncertainty; reported crossings have separate delay/condition cues without live-train imagery; roadway incident uses road/alert imagery rather than an explosion; utility work retains an infrastructure cue. Category grammar follows the written families: winter cold blue, water teal, vehicle/response purple, road/rail hazards amber, work orange, restriction red, information slate. Crossing Location is informational and uses a neutral track symbol.

Default production size remains 64 × 64 CSS px. Existing consistent selection remains 1.1× (70.4 px). Shadow, anchors, popup behavior and all existing renderer reconciliation remain unchanged. The approved common pictogram scale is applied offline to static SVG paths, not per condition at runtime.

## Active inventory and fallen-tree handling

The written list contains 30 entries: 29 hazard/condition markers plus informational Crossing Location. Display numbers are not runtime IDs.

`js/gridlyMarkerRegistry.js` remains the sole runtime asset/family/size authority. All 84 lookup keys remain available. The only alias target consolidation is `fallen_tree` → `debris`; the redundant standalone `fallen-tree.svg` is removed from the active library. LP244.46 already normalizes the condition to DEBRIS and retains `provenance.rawType`. The unchanged report adapter also retains `legacyReportType`. No stored record, provider payload, taxonomy definition, picker option or reporting protocol is changed.

The existing community picker has 16 primary choices and five Other Hazard subtypes; Fallen Tree is not a separate selectable option. The broad truthful “Debris in Road” wording remains valid for tree/branch inputs. No destructive migration is performed.

`reports/lp24447a-marker-mapping.json` records every retained condition, asset, family, symbol and legacy alias.

## Implemented concepts

- Winter: seven distinct crystal, slick road/uncertainty, bridge/ice, snow-covered road, mixed frozen precipitation, eye/fog and winter-caution pictograms.
- Flooding: roadway entering water, distinct from winter.
- Crash: two vehicles and impact cue; disabled: one vehicle with raised hood; traffic: multiple-vehicle queue.
- Debris: one bold obstruction occupying a road lane. Blocked: physical barricade. Impassable: broken/no-through roadway. Official closure: no-entry, red accent, still governed by existing authority rules.
- Construction: cone. Planned work: calendar/clock.
- Downed line: leaning/broken pole, downed wire and minimal electrical cue. Utility work: upright infrastructure and wrench.
- Response: beacon without police/fire/EMS-specific facts. Livestock: recognizable livestock outline. Signal: traffic signal with interruption cue.
- Rail: crossbuck/clock for reported delay; crossbuck/caution for reported condition; neutral track for informational location.
- Road damage: bold pavement crack. Bridge restriction: bridge span and vertical clearance cue, not closure. Roadway incident: road plus alert, not collision/explosion. Travel advisory: neutral information symbol.

## Validation

119 automated checks pass: nine LP244.47A, 14 LP244.47 mapping, seven LP244.46B winter, 22 LP244.46 normalization, and 67 related regressions. The latter include 29 LP244.45/45A/45B context cases, including Cleveland → Crosby → Return Home → Dayton, plus popup/KBYG/weather/trust/official marker and geometry checks.

The new suite proves the exact active list, explicit fallen-tree alias, retained lookup keys, distinct SVG geometry even with colors removed, family accents on a shared navy pin, dependency-free vectors and byte equality of protected runtime owners against the starting commit.

An isolated Edge canvas check verifies all 30 SVGs decode, have completely transparent viewbox boundaries (no clipping), and retain visible white pictograms with a dominant navy interior at actual 64 px. Its evidence is in `reports/lp24447a-vector-render-evidence.json`.

The actual application harness uses `normalizeReports`, `renderUnifiedIncidents` and the official icon builder with synthetic rows. It exercises all 30 assets at 320/360/390/440 px widths, the 16 primary and five subtype picker choices without submission, selection sizing, nine-marker urban/rural/water-heavy maps, and a dedicated five-marker infrastructure map. Source badges come from the actual official builder. Existing overlapping grouped/raw fallback layers in synthetic fixtures are unchanged.

The two previously documented LP045.1/LP045.2 source-string failures remain historical; `js/app.js` is byte-unchanged in this follow-up. They are not counted as passing tests. No new regression was found.

## Preview artifacts

Directory: `.artifacts/lp24447a-approved-marker-review/`.

- `complete-marker-library-final.png`
- `complete-marker-library-64px.png`
- `complete-marker-map-density-final.png`
- `community-road-state-comparison-final.png`
- `winter-marker-final.png`
- `infrastructure-marker-final.png`

Additional navy, urban/rural/water-heavy and mobile images are available. Screenshots are ignored local review artifacts; their hashes and browser results are recorded in the tracked test-evidence report.

Reproduce artwork with `node tools/lp24447a/build-assets.cjs`, pixels with `node tools/lp24447a/verify-vectors.cjs`, and the local map review with `node tools/lp24447a/preview.mjs`. The LP244.47A authoring tool supersedes the older LP244.47 generator for this approved library.

## Noninterference

`js/app.js`, `css/styles.css`, `index.html`, hazard normalization, DriveTexas/NWS providers and report/compliance protocol sources are unchanged. Condition, severity, advisory, authority, confidence, lifecycle and geometry remain governed by the previous implementation. Official geometry is not converted to points. Non-hazard user location, destination, route endpoints and placement preview retain their existing styling and semantics.

The browser runs with disposable storage, blocked service workers and blocked remote backend requests. Only read-only public map tiles are allowed; dependencies and weather are fulfilled locally. No production/backend writes, reporting activation, moderation, retention, notification/FCM/APNs, native, Around Me, Route Watch, public-site or Dispatch changes occurred.

One follow-up local commit is authorized: `Implement owner-approved Gridly marker library`. No push, merge or deploy. Final owner visual review is still required before publication.
