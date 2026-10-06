# Gridly Dispatch visual application

Local visual build, October 6, 2026. Vanilla HTML, CSS and browser ES modules;
no framework migration, build dependency, consumer code import or Worker change.
The Gridly asset is an unchanged copy of
`assets/store/branding/Logos/gridly-logo-horizontal.png`.

## View locally

From the repository root:

```powershell
node tools/dispatch-ui/serve.mjs --demo
```

- Login: http://127.0.0.1:4178/
- Board: http://127.0.0.1:4178/?demo=1
- Empty: http://127.0.0.1:4178/?demo=1&state=empty
- Verification messaging: http://127.0.0.1:4178/?auth=verification

Use Preview state for populated, empty, loading, network error and authorization
error. Use the acting-unit selector for independently scoped Police and Public
Works demo memberships. Open a report title or review item for the detail drawer.
Escape or Close restores focus to the invoking control. Reports, Review Queue,
Activity and Organization provide separate local views.

Run without `--demo` to inspect the fail-closed login-only surface. The server
binds only to 127.0.0.1, rejects other Host names, exposes an exact asset allowlist,
rejects writes and denies fixture files unless explicitly enabled. The browser
also requires a loopback origin and the server capability response; a `demo=1`
query on a remote host cannot activate the shell. Port override:
`$env:DISPATCH_UI_PORT='4179'`.

## Data and authorization boundary

The shell represents an authenticated product layout in a **local visual session**;
it is not a real authenticated session. `auth.mjs` refuses sign-in because the
existing delivery Worker has no browser login/session endpoint. The form neither
reads nor transmits credentials; the password field is cleared after submission.
Recovery sends no email. Verification messaging cannot grant AAL2. There are no
signup, approval, publication, invitation or operational write controls.

Fixtures live only in `demo/fixtures.mjs`, use DEMO IDs and a fixed October 6
08:30 CDT snapshot, and are never persisted. Counts and relative ages refer to
that snapshot. Only explicitly listed synthetic memberships enable a unit in the
selector. Fire and EMS are organizational context, not accessible memberships.
Reviewed fixture state grants no live reviewer eligibility. Minimum two trained
reviewers per unit, author separation, exact subtype/risk/scope/unit authority,
live authorization and stale-revision rejection are explained in the detail view.

`app.mjs` owns view state and interaction; `components.mjs` owns reusable icons,
branding, badges, records, queue items and state panels; `styles.css` owns design
tokens and responsive layouts. The native dialog supplies modal focus containment.
Board retains its approved reserved location panel. The separate Split and Map
modes load the local geographic adapter described below.

## Certification

Use the repository's pinned Playwright dependency (`npm ci` when not installed).
This machine has Edge available; its cached Playwright Chromium is incomplete:

```powershell
$env:DISPATCH_BROWSER_CHANNEL='msedge'
node --test tests/dispatch-visual-shell.test.mjs
```

Without the override, the test uses Playwright Chromium. Screenshots and logs go
to `reports/responder/dispatch-visual/` and are ignored. Tests capture login,
populated board, empty board, detail header and scrolled authority/publication at
1440×900, 1920×1080, 1280×720 and 1024×768. Desktop/tablet document and table
horizontal overflow are checked. Short workstations and tablets allow vertical
scroll; desktop/tablet navigation and acting-unit context remain sticky.

## Production handoff — not deployed

The approved Worker currently routes only `/health` and `/api/resend/webhook`.
There is no approved static UI delivery configuration in this baseline. Before
deployment, review a separate static asset origin/route for the root and UI assets
at `dispatch.gridlygo.com`, preserving both existing exact Worker routes. Do not
replace that Worker with this local server. Exclude `demo/`, preview capability,
local server and certification artifacts from any future production package.

The browser also needs an approved dedicated Dispatch authentication integration:
real session validation, MFA/AAL2 verification and recovery, live authorized unit
memberships, session expiry/sign-out and authorized read projections. Do not reuse
consumer auth or the historical disposable auth harness. Production empty data
must come from a successful authorized read, never an auth failure interpreted as
zero records. This visual phase intentionally does not introduce those contracts.

Publication stays off; onboarding remains blocked. No production identities,
invitations, DB schemas, credentials, transport configuration or DNS were changed.

## Theme system

Use the labeled **Theme** selector on login or in the top bar: **System**, **Light**,
**Dark**. System is the default. Explicit selections persist as one validated
string in `localStorage.gridlyDispatchTheme`; this key is Dispatch-specific and
contains no identity or operational data. Missing/corrupt values resolve to
System. If storage is unavailable, the selection still works for the current
page. Tabs on this origin synchronize preferences through the storage event.

`theme.js` is a small external blocking script before CSS and the body. It applies
`data-theme="light|dark"` and `data-theme-preference="system|light|dark"` to the root
before rendering, without weakening the CSP. It listens to `prefers-color-scheme`
changes only for System. Explicit Light/Dark choices override the OS. A theme
change does not reload or rerender views, modify fixtures, or initiate requests.

`themes.css` owns all light/dark palette values as semantic variables. Components
reference these variables through `styles.css`; geometry is shared by both
themes. Native inputs use the resolved `color-scheme`. Focus, placeholder, status,
hover, selected-row, disabled and drawer surfaces are theme-aware. Reduced-motion
preferences disable transitions/animation, though the UI introduces no motion.

Map integration reads `document.documentElement.dataset.theme` on
initialization and listen for `gridlydispatch:themechange` on `window`, whose
`detail` contains `{preference, resolved}`. Use `resolved` to select the reviewed
light/dark basemap style, keeping the camera, layers, filters and records intact.
Controls/popups should consume `--bg-panel-raised`, `--bg-input`, `--text-primary`,
`--text-secondary`, `--border-strong` and `--focus-ring`. The adapter uses local
vector road data; no external map provider or tile requests are made.

Dual-theme certification:

```powershell
$env:DISPATCH_BROWSER_CHANNEL='msedge'
node --test tests/dispatch-theme.test.mjs tests/dispatch-visual-shell.test.mjs
```

New evidence lives in `reports/responder/dispatch-theme/`. The same login and board
URLs support every mode: choose Dark for both dark previews, Light for the light
preview, or System to follow the OS. A browser refresh is needed once to load this
new application version; subsequent theme switches are immediate.

## Board, Split and Map

The compact **View** selector defaults to Board. Explicit selections persist as
`localStorage.gridlyDispatchView` (`board`, `split`, `map`); missing/invalid values
fall back to Board and unavailable storage does not prevent switching. Only a
display preference is stored. A local demo URL may override the initial view:
`?demo=1&view=split&theme=dark`. Valid `theme` values are light/dark/system and
apply the existing theme preference. Remove `view` from the URL to test saved
view persistence on reload; the explicit URL wins when present.

Split uses approximately 40% list / 60% map on desktop. Map devotes approximately
80% to geography while retaining a compact equivalent incident list. At tablet
width the map and list stack. Short viewports use vertical scrolling. Select a
list title or a category marker to select the same incident and reveal its popup.
If needed, the map scrolls into view to show that popup. **View details** in the
list or popup opens the unchanged detail drawer; Escape/Close restores focus.
Search, filters, acting unit and theme remain intact when switching modes.
Changing the acting unit retains the original filter-reset behavior.

`map-view.mjs` is lazy-loaded only for geographic demo views. Leaflet **1.9.4**
is reused as an unchanged vendored library, with its BSD-2-Clause license in
`vendor/leaflet/LICENSE`. No consumer map/auth/runtime module is imported.
There are no tiles or third-party runtime requests. Local Canvas layers draw 331 public
OpenStreetMap road segments around Dayton. The source extract has timestamp
2026-05-09T22:50:58Z and is context only, not live routing or jurisdiction data.
Only the four existing synthetic fixtures receive approximate demo coordinates.

The road data is [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/),
attributed to [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
Visible map credits link to attribution and the downloadable derived GeoJSON.
`demo/dayton-roads-provenance.json` records the source hash, bounds and transform.
Rebuild offline with `node tools/dispatch-ui/prepare-map.mjs`. Source coordinates
are preserved; no boundaries or roads are invented. The finite extract is not a
worldwide basemap. Map controls, popup, markers and roads follow the resolved
theme, including runtime System changes, without replacing records or camera.

Data/library failure presents **Map unavailable** and **Retry map**; the list and
Board remain usable. Zero matching incidents retains geographic context and
explicitly states the empty result. Map access adds no API key, external provider,
paid dependency, routing change or CSP exception. Production still requires the
separate hosting/auth/read work above; production coordinates, geographic scope,
data refresh/licensing and any future tile service need their own review. Demo
coordinates and this gated fixture extract must not become production records.

Run all UI certification with:

```powershell
$env:DISPATCH_BROWSER_CHANNEL='msedge'
node --test tests/dispatch-map-polish.test.mjs tests/dispatch-operational-map.test.mjs tests/dispatch-map.test.mjs tests/dispatch-theme.test.mjs tests/dispatch-visual-shell.test.mjs
```

`reports/responder/dispatch-map/CERTIFICATION.md` records the evidence. The map
suite renders approved commit `65b59e55d772b2de4d668f3f2e15d9140b7fc329` from Git
blobs and requires exact Board PNG equality with only the new View control hidden,
both before and after loading the map library. Screenshots/logs remain local.

## Operational basemap refinement

`basemap.mjs` adds cased major/arterial/local roads, collision-aware rotated street
labels, highway shields, rail lines with sleeper marks, sourced crossing points,
streams/water polygons and the Dayton locality label. Labels derive from source
geometry, reflow after pan/zoom/resize, and prioritize Main/Winfree, rail and major
roads. Geometry is never simplified for rendering; only label placement uses a
screen-space simplification to avoid suppressing names on densely sampled roads.
The approved Board/Split/Map structure, sizes, list density and filters are intact.

An additional bounded public OSM extract was acquired once on October 6, 2026
through the primary read API after Overpass proved unavailable. The bundle contains
33 context features: 11 active rail ways, 12 mapped level crossings, 5 waterways,
4 water polygons and 1 town label. Provenance/source URL, request bounds, raw hash
and transform are in `demo/dayton-context-provenance.json`. The derivative excludes
contributor identities. Its ODbL attribution/download is visible beside the roads.
`node tools/dispatch-ui/prepare-context.mjs` rebuilds it offline from the ignored
`demo/source/dayton-context-osm.json` raw response. This source file is not served.
Roads and context have different documented vintages/coverage; outside their finite
extracts, absent features must not be interpreted as absent real-world features.

`marker-language.mjs` isolates four current consumer Gridly PNG mappings: flooding
→ water-over-road, rail blockage → train-front, signal outage → traffic-signal-issue,
debris → debris-in-road. Asset bytes and pointer anchors are unchanged. See
`assets/markers/README.md`. Icons communicate incident category; Dispatch adds a
static selection ring, restrained severity accent and resolved check. Popups add
source, review and publication state and an explicit synthetic-location/authority
caveat; unit, location, severity, status, age, ID and View details remain available.
Enter/Space selects the marker; the full list path and existing drawer still work.

No production map service, key, payment, CSP exception or external runtime fetch
is required by this build. Production rollout still needs approved geography,
freshness/coverage, coordinate accuracy, auth/read integration and hosting work.
Visual certification does not certify real incident positions or navigation.
The new suite additionally compares the entire Board (including View selector)
against `4952fcc09586bf2c4a193e40b0dbdc4a57ff94f1` and checks Split/Map geometry.
Evidence: `reports/responder/dispatch-operational-map/CERTIFICATION.md`.

## Final map polish

The unchanged Gridly PNGs now use an 80px canvas and 48px contrast backing.
Selected markers have a static 3px ring; resolved markers retain their category
and check at 70% opacity. Full incident rectangles reserve space before any
context label is placed. Road label order is US/I, TX/SH, FM/RM, important city
streets, local streets, then county roads. County names appear only at zoom 16+
(maximum three at 16, five at 17), without highway shields.

Nine named OSM landmarks are derived offline from the existing context snapshot:
one police station, two fire stations, five schools and one park. Emergency/civic
labels are eligible from zoom 13; schools/parks from 15. Collision and count caps
keep these muted orientation labels secondary to incidents. No hospital, EMS or
municipal feature was present in the finite extract. Commercial POIs, addresses,
unnamed features and ambiguous duplicate Colbert school names are excluded.
Facilities are not independently verified; footprint centers are not entrances.
See demo/dayton-landmarks-provenance.json for source, hash and limitations.
Rebuild with node tools/dispatch-ui/prepare-landmarks.mjs using the existing
ignored raw context response; the app makes no external data request.

Demo URLs support unit=police or unit=works, validated against demo memberships.
All map assets remain demo-gated. Canvas teardown guards are Dispatch-local.
Final preservation and visual evidence: reports/responder/dispatch-map-polish/CERTIFICATION.md.
