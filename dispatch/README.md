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

## Street selection and recurring notice draft preview

The **Draft Notice Preview** button opens a dedicated local synthetic composer.
It appears only in the loopback fixture session. Existing incident views, markers,
filters, assets, services and sign-in behavior remain unchanged.

Search existing road names/references, or click the composer map to see every
candidate within a 10-pixel picking tolerance. Explicitly add/remove up to 50
source lines. A separate highlight layer uses their original coordinates without
rounding, snapping, connectors, intersection inference or corridor expansion.
The 331 OSM ways remain source lines, not certified operational segments.
**Source geometry preview — jurisdiction unverified** remains visible.
The derivative SHA-256 and recorded source hash are checked before loading; stale
or unknown datasets/identities refuse. No governed source data is modified.

Write bounded subject/body/reference text and notice effective/expiry wall times.
References are text only: no URL fetching, uploads or attachments. The project
has its own inclusive calendar-date range and IANA timezone. Crew work and roadway
restriction schedules are independently editable. Each supports one-time (on the
project start date), selected weekdays (Sunday=0 through Saturday=6), and continuous
24-hour windows. Continuous windows are represented as individual daily occurrence
intervals beneath the same parent notice, including DST days of 23 or 25 hours;
these are not separate reports. Restriction windows inherit crew occurrences only
when the user explicitly selects work-hour matching; otherwise they are independent.

Skip/cancel a date or modify its individual hours using the date-exception controls.
Parent edits retain exceptions; exceptions excluded by a new parent schedule must
be explicitly removed or corrected. Review lists human-readable schedules, date
exceptions, exact UTC occurrence boundaries and affected dates. A review is
invalidated by further edits. Clock labels describe crew scheduling only and are
computed when the review is opened; they never declare a road open or closed.

Limits: 2000–2100 calendar dates, at most 366 project dates, 50 source lines,
30 notices per synthetic unit, 100 revisions per notice and 2,000,000 serialized
characters per unit workspace. End times must be later on the same date.
Overnight custom windows and ambiguous/nonexistent DST wall times are explicitly
blocked. Timezone conversion uses the installed JavaScript Intl timezone data;
there is no external timezone service or new dependency. Notice validity must
contain all generated crew and restriction occurrences.

Save/reopen/revise/close keeps one DEMO-NOTICE identity and append-only version
snapshots. Overlapping synthetic notices remain separate and receive an advisory.
Stale saves refuse while edits remain in the current editor. Replacing unsaved
edits requires explicit confirmation. Closed notices are inspection-only.
Versioned sessionStorage is limited to
`gridlyDispatchNoticePreview.v1.DEMO-DAYTON.police` and
`gridlyDispatchNoticePreview.v1.DEMO-DAYTON.works`.
Working drafts, saved occurrence lists, exceptions and revision history recover
on refresh within the same browser tab. Invalid storage, inconsistent history,
dataset changes and unavailable storage refuse, with explicit unit-only reset.
This is not durable storage for real agency data or cross-device collaboration.

Focused certification:

```powershell
$env:DISPATCH_BROWSER_CHANNEL='msedge'
node --test --test-concurrency=1 tests/dispatch-road-selection.test.mjs tests/dispatch-notice-schedule.test.mjs tests/dispatch-notice-preview.test.mjs tests/dispatch-notice-preview-browser.test.mjs
```

Rerun the seven existing Dispatch UI suites listed above. Historical comparisons
hide only the additive entry control using DOM visibility (screenshot style
injection is blocked by the existing CSP). All original pixel, marker and geometry
assertions remain. The source-isolation guard permits sessionStorage only in the
new composer; browser tests restrict it to the exact synthetic unit keys.

The new browser suite covers both themes at 1440×900, 1920×1080, 1280×720,
1024×768 and 390×844. The composer has no horizontal overflow. The existing
mobile dashboard's underlying width is measured and preserved without redesign.
Ignored evidence lives in reports/responder/dispatch-visual/notice-preview-*.png
and notice-preview-certification.log. Captures include entry, one/multiple selected
roads, editor and schedule review. Actual agency scopes, road authority/topology,
real authentication, backend writes, publication and consumer integration remain
unimplemented or disabled. No schema, consumer, native or production changes.

### Local certification result — October 8, 2026

Final distinct checks: **167 passed, 0 unresolved failures**: 56 new focused
checks and 111 existing Dispatch UI checks. The seven-suite/full run recorded
156/164 while eight marker comparisons still used inconsistent hiding across
stable frames. After correcting that test helper, the final focused run passed
80/80 (all 56 new checks, all 11 marker-normalization checks and all 13 visual-shell
checks). Original Board pixels, map geometry, asset-byte checks and existing
Canvas tolerances were preserved. No runtime edit followed the final checks.

Evidence: notice-preview-certification.log, notice-preview-final.log,
notice-preview-summary.json and 60 notice-preview-*.png files in the ignored
reports/responder/dispatch-visual directory. Screenshots include saved completed
previews as well as entry, one-road/multi-road selection, editor and review states.
The summary contains the exact 20-file source/test inventory and protection checks.
HEAD remains 920108bf8715263daed5d936a8119780ece67080. No commit, push, merge or deploy.


## Three-step notice composer

The same **Draft Notice Preview** entry now opens three steps: **Where is the
issue?**, **What should people know?**, and **Review your notice**. Location requires
one or more valid source lines before Next. Search and explicit candidate choices
provide the keyboard alternative to map picking. Selected lines stay above search
candidates. Only the current step is rendered, with a larger map, one main scroll
area and stable footer controls. Back preserves unsaved values; Escape returns
focus to the entry. Saved synthetic notices can be reopened from the Location step.

New drafts require an explicit traffic restriction choice: work hours, continuous
project coverage, or custom hours. Work-hour matching generates the exact work
occurrences, including skipped dates and modified windows. Custom schedule values
and exceptions survive switching choices; independent restriction edits are shown
for continuous/custom choices. Legacy v1 saved schedules load unchanged, without
rewriting their snapshots. Choosing another restriction option is a normal reviewed
revision. Weekday buttons display Monday through Sunday, retaining Sunday=0 storage.
Timezone labels show plain names alongside the exact editable IANA identifier.

**Change or skip specific dates** is collapsed initially. Review distinguishes
**Work scheduled** from **Traffic restrictions scheduled**, with local times for
each scheduled date and expandable exact UTC occurrences and version history.
Back to edit discards the review snapshot. Any subsequent change requires fresh
validation and review before save. Closing a saved notice requires separate closure
review and confirmation; closed records remain available for inspection.

This remains a loopback-only, local synthetic sessionStorage preview. Start from
the Dispatch worktree with **node tools/dispatch-ui/serve.mjs --demo**, then open
**http://127.0.0.1:4178/?demo=1**. DISPATCH_UI_PORT overrides the port. The bare root
is the sign-in shell; the demo flag and demo query are both required. No running
owner server or authentication controls are changed by this refinement.

Refinement evidence uses the separate ignored **notice-ux-** prefix in
reports/responder/dispatch-visual; historical screenshot fixtures are unchanged.
The focused browser suite includes all five sizes in both themes, explicit choice,
matching exceptions, independent custom schedules, navigation, refresh/revision
recovery, closure, stale-save refusal, keyboard focus, map failure/retry, DST and
Sunday mapping. Existing source geometry and seven dashboard suites remain required.

### Refinement certification — October 8, 2026

**172 passed, 0 failed:** 61 focused notice checks (18 browser, 12 draft/revision,
26 schedule, 5 roadway) and 111 existing Dispatch checks. An initial keyboard
boundary failure was reproduced and fixed in the isolated composer; the final
focused run passes. Logs: notice-ux-final.log and notice-ux-dashboard.log. There
are 70 notice-ux-*.png screenshots across both themes and all five sizes, including
schedule and daily-review scroll positions. Actual screenshots were visually
inspected. No historical baseline adjustments, source geometry changes or new
dependencies. The same 20-file working-tree inventory remains; this refinement
changes six of those files. All other 14 retain their pre-refinement byte hashes.
Protected detached checkout remains clean. Commit/push/merge/deploy: NONE.

## Expanded map workspace (Milestone A, local preview)
In the synthetic demo, select Map and choose Expand Map. Return to Map restores
normal layout and focus without changing the saved view preference. The same
Leaflet map stays mounted; camera, filters and selected incident are retained.
Incidents and Filters open collapsible panels. Escape closes a detail dialog,
then an open popup, then the active panel, then returns to normal Map.
The map fills the browser viewport; agency header, sidebar, banner, dashboard
title and permanent list are hidden. Return to Map, Incidents, Filters, zoom,
Fit incidents and attribution float above the map. Open panels do not resize it.
The existing theme and agency/unit context are preserved; change them after returning.
Full screen explicitly requests the browser Fullscreen API where available.
Denial leaves the viewport workspace usable. Browser fullscreen exit (including
native Escape) returns to normal Map and restores focus. Outside native fullscreen,
Escape closes the dialog, popup or panel before returning. This does not replace
the existing authentication flow. No satellite, direct road picking or operational
writes are added. Use the explicit Milestone A certification integrity switch only for
this uncommitted candidate; the ordinary owner launcher deliberately refuses it.

### Continuous Standard basemap foundation (local synthetic only)
The default retains the historical bounded Dayton extract. Open the demo Map with `?demo=1&view=map&basemap=mock`, or Expand Map → Filters → Basemap source → Continuous local mock. All tiles are deterministic local canvases; no tile service, API key, billing or external request is enabled. The synthetic grid contains no real roads or statewide cartography and cannot support roadway selection or authority.
Mock exploration supports zoom 5–18 and free Web Mercator panning. Display camera/provider state is retained in memory for the current demo unit across views; it is not a permission grant. Selecting Limited Dayton extract preserves the explored camera and explicitly reports missing local coverage outside the extract. A tile failure activates that labeled fallback without moving the camera. Attribution and health remain visible while mock exploration is enabled. Tiles use Leaflet viewport pruning and one-tile buffering; there is no persistent tile cache.
Future licensed Standard/Satellite activation requires a separately reviewed provider, rights/attribution, coverage and currency, quotas/billing, key restrictions, privacy and failure policy. This milestone has no real provider activation, jurisdiction conclusions or operational roadway geometry.

### ArcGIS offline contract foundation
Expand Map → Filters → Basemap source offers explicitly synthetic Standard/Satellite contract fixtures. They render local canvases only, never real roads or imagery. Real ArcGIS activation is disabled in code; no API key loader, account lookup, remote metadata request, image URL or external connection exists. The default Dayton map and continuous mock are retained.
Standard uses the documented Static Basemap Tiles streets contract; Satellite uses the documented Basemap Styles imagery contract and its World Imagery map tiles. Labels are a separate Static Basemap Tiles overlay and cannot replace imagery. Static privileges and basemap privileges are distinct; fixture responses model authorization and outage states without credentials. Missing imagery fails closed; unavailable labels leave clearly degraded imagery rather than imply a complete basemap. Fixture source credits describe future requirements, not a certified live attribution list. Live imagery requires reviewed current metadata/acknowledgments.
Official contracts: https://developers.arcgis.com/rest/static-basemap-tiles/arcgis-streets-tile-get/ ; https://developers.arcgis.com/rest/basemap-styles/arcgis-imagery-standard-webmap-get/ ; https://developers.arcgis.com/rest/basemap-styles/service-data/ ; https://developers.arcgis.com/rest/static-basemap-tiles/arcgis-imagery-labels-tile-get/ . Static tiles use Web Mercator, 512 pixels, Leaflet zoomOffset -1; imagery uses 256 pixels and offset 0. Display exploration remains bounded to zoom 5–18; published static service levels are 0–22, actual live coverage must be verified separately.
Future configuration must be Dispatch-only, owner-local, untracked and explicitly disabled until separately approved. Never load consumer configuration. A public application key is visible to browser users and needs narrow privileges, Dispatch referrer restrictions, expiry and rotation; it is not an agency authorization credential. Do not put private-app secrets, item grants, user tokens or admin capabilities in that configuration. Future live loading/rotation requires separate approval; no credential fields are accepted now.
FUTURE_NETWORK_POLICY is documentation data only: exact image origins static-map-tiles-api.arcgis.com and ibasemaps-api.arcgis.com; metadata origins static-map-tiles-api.arcgis.com, basemapstyles-api.arcgis.com and ibasemaps-api.arcgis.com; strict-origin-when-cross-origin referrers. Current CSP remains self-only with no-referrer. Review document-only policy and API/header separation before activation; never broaden authentication guards. Tile-coordinate requests disclose viewed map areas to providers. No offline download, persistent tile cache, quota or commercial entitlement is granted by this foundation.
