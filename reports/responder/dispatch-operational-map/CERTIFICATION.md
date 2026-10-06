# Dispatch operational basemap and Gridly marker parity

October 6, 2026. Local visual refinement only.
Branch: `codex/dispatch-visual-shell`.
Starting HEAD: `4952fcc09586bf2c4a193e40b0dbdc4a57ff94f1`.

## Consumer inspection before edits (read-only)

| Area | Evidence and decision |
|---|---|
| Library | Leaflet 1.9.4, already reused by Dispatch. |
| Basemap | `js/app.js` initMap uses OSM Standard raster and Esri World Imagery, plus optional ArcGIS static labels requiring a configured key. Do not import these providers/configuration. |
| Marker authority | `GRIDLY_PRODUCTION_MARKER_CATEGORY_ASSETS`, display size and tip ratios in `js/app.js` around line 12276. Production PNGs take precedence over reference-only SVG mapping/inventory documents. |
| Categories/assets | Exact first-party PNG copies: water-over-road, train-front, traffic-signal-issue, debris-in-road. No new icon semantics. |
| Crossings | Consumer distinguishes fixed crossing infrastructure (`rail-crossing.png`) from rail blockage/delay (`train-front.png`). Dispatch preserves that distinction: the incident gets the train icon, OSM crossing points remain cartographic context. |
| Selection | Consumer selected-state class/data attribute makes an incident dominant and can invoke a pulse. Dispatch adapts static ring prominence only, without pulse or animation/state imports. |
| Popup | Consumer builds unified incident/crossing popups with public source/location context. Dispatch keeps its own compact authorized-context presentation; no consumer text/state is copied. |
| Theme | Current consumer registry has Standard/Satellite only; former Dark migrated to Standard (documented by `lp243i21d2-remove-dark-basemap.test.mjs`). Dispatch independently styles local layers with existing Light/Dark/System tokens. |
| Attribution | Consumer Standard uses OSM contributors; satellite has Esri and source disclosure. Only OSM data/Leaflet are used here, so no Esri imagery/style/attribution dependency is introduced. |
| Safe reuse | Leaflet, four unchanged PNGs, static category/anchor constants, dark circular glyph/pointer language, road hierarchy and selection prominence. |
| Excluded | Consumer home/search/Route Watch, auth, mutable registries, coordinate resolution/classification engines, official-publication gates, layer authority, popup builders and provider credentials. |

The existing `data/liberty-county-rail-crossings.geojson` contains “Sample Railroad”
records and was rejected as a geographic authority. No sample rail geometry or
invented crossing/boundary is drawn.

## Basemap and geographic provenance

Existing 331 OSM road segments remain unchanged (2026-05-09 source timestamp).
Road hierarchy now has separate casing/fill widths and restrained major-road
colors. Named streets rotate along their actual source geometry. Major roads have
clear reference shields; names/labels are collision-filtered and recomputed on
pan/zoom/resize. Main and Winfree names, FM 1960, US 90/TX 146, other arterial
references, Dayton and rail context are visible at practical initial fit scales.

A small public OSM primary API map extract was obtained once for the bounds
[-94.915, 30.03, -94.865, 30.065]. Overpass requests failed/timed out; the primary
read API succeeded. This is build-time acquisition, not a runtime service.
`dayton-context.geojson` contains 11 active rail ways, 12 level crossing points,
5 waterways, 4 closed water polygons and the sourced Dayton town point. Rail uses
contrasting track/sleeper strokes; water uses distinct fills/lines. Full source
coordinates are retained. No relation reconstruction, boundary invention or
operational inference is performed. The 33-feature derivative excludes contributor
identity fields and unrelated OSM features.

The provenance JSON records acquisition date, source URL, raw SHA-256, bounds,
counts and transform. Raw acquisition is ignored, not served or committed; the
public derivative is committed and downloadable. `prepare-context.mjs` reproduces
the transform offline from the saved response. The finite road/context extracts
have different vintages and coverage; this is not statewide/live navigation data.

## Marker and popup result

| Fixture | Category | Exact consumer asset |
|---|---|---|
| DEMO-001 Flooded Roadway | flooding | water-over-road.png |
| DEMO-002 Rail Crossing Blocked | rail_blockage_delay | train-front.png |
| DEMO-003 Signal Outage | signal_outage | traffic-signal-issue.png |
| DEMO-004 Roadway Debris | debris | debris-in-road.png |

The 64px asset canvas and consumer pointer ratios are preserved. Category glyphs
replace H/M/L identity. A static selected ring, modest severity dot and resolved
check supplement the original artwork. Theme changes do not create separate icon
systems. Accessible names include incident, location, severity, status, unit and
age. Enter and Space select/open; list actions provide the equivalent path.

Popups show type, affected roadway/location, severity, status, unit, source, age,
ID, fixture review state, internal/publication-off state, synthetic-location and
unverified-authority caveat, plus View details. No invented production fields or
claim of validation is added. Long content can scroll within the compact popup.
The existing detail drawer and focus restoration remain intact.

## Preservation and tests

73 UI tests PASS (14 new operational + 21 map + 25 theme + 13 original shell).
120 existing Dispatch regressions PASS (durable contract, invitation delivery,
Worker hosting, readiness and Resend configuration). These are local tests,
not a real delivery attempt. Edge through pinned Playwright 1.54.2 was used.

The existing exact Board gate still checks eight theme/viewport combinations
before and after loading the map against the earlier theme-approved commit.
The new gate compares all Board pixels, including the View selector, to starting
HEAD: eight exact matches. Split/Map layout, list-row dimensions, filter bounds
and map dimensions match starting HEAD in all 16 theme/viewport/mode cases.
No Board, shell navigation/top bar, selector, metrics, list-density, filter or
drawer structure was redesigned.

Tests cover source/category asset identity, source-derived rail/water/locality,
practical street/highway/rail label presence, source/review/publication popup
fields, keyboard selection/drawer, list sync, active unit scoping, filter/theme
preservation, runtime System changes without selection/camera loss, same-origin
GET-only runtime requests, asset gates, attribution, map-context failure/retry,
and Board recovery. Consumer source remains untouched. No production writes.

Commands:

```powershell
$env:DISPATCH_BROWSER_CHANNEL='msedge'
node --test tests/dispatch-operational-map.test.mjs tests/dispatch-map.test.mjs tests/dispatch-theme.test.mjs tests/dispatch-visual-shell.test.mjs
node --test tests/responder-phase29-durable-contract.test.mjs tests/responder-phase29-invitation-delivery.test.mjs tests/responder-phase29-worker-hosting.test.mjs tests/responder-phase29-readiness.test.mjs tests/responder-phase29-resend-production.test.mjs
```

## Visual evidence

77 new source PNGs are local/ignored in this directory: both themes at 1920×1080,
1440×900, 1280×720 and 1024×768, with Board, Split, Map, selected flooding in Split,
selected rail blockage in Map, both enriched popup close-ups and both map-opened
drawers (72); context failure (1); light/dark overview and Public Works icons (4).
Existing suites also refresh their own theme/map/shell evidence.

Normal-size review and close-ups confirm readable named surrounding roads,
recognizable intersections, highway references, rail track/sleeper and crossing
context, incident category identity, low-glare dark surfaces and obvious static
selection. Priority label collision fixes keep Winfree/Main and rail labels at
initial fit. Light roads have defined casing rather than disappearing into the
background. Water/context are sourced and appear where present in the extract;
they are not invented near a fixture. Small viewport vertical scrolling and
bounded popup overflow are intentional. Visual certification is not certification
of live incident accuracy, routing or official validation.

## Licensing and production boundary

Leaflet's BSD-2-Clause license is retained. Road/context data remain
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) with visible
[OpenStreetMap contributor attribution](https://www.openstreetmap.org/copyright)
and downloads for both derivatives. First-party Gridly PNGs are unchanged and
reused at the owner's request; no additional third-party asset license/provider.

No production map dependency, key, paid service, tile requests or CSP/network
exception was introduced. The public OSM acquisition endpoint is provenance only;
the app never calls it. Production needs reviewed geographic coverage/freshness,
coordinate provenance, existing Dispatch auth/read/hosting integration and owner
approval. A new tile provider is not required for this bounded local build.

No consumer source behavior, Supabase, schema/auth governance, Resend, Hyperdrive,
credentials, publication/onboarding state, inbound email or DNS changes.
`supabase/.temp/cli-latest` is untouched. No deployment, push, onboarding or
controlled invitation delivery. Result: COMPLETE / OPERATIONAL MAP VISUAL
CERTIFIED. Next step is owner review of the four local Split/Map theme links.
