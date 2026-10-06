# Gridly Dispatch — additive map certification

Date: October 6, 2026. Local visual build only.
Branch: `codex/dispatch-visual-shell`.
Approved starting HEAD: `65b59e55d772b2de4d668f3f2e15d9140b7fc329`.

## Result

COMPLETE / MAP VIEWS VISUAL CERTIFIED. Board remains the default and its approved
appearance is intact. Split and Map are additive geographic alternatives using
the same authorized demo unit records, filters and existing detail drawer.

## Protected Board evidence

`tools/dispatch-ui/approved-board.mjs` serves exact approved Git blobs through an
isolated loopback server. The map suite captures baseline and candidate in the
same browser at four sizes in both themes. Hiding only the new View label/select
produces byte-identical PNGs: eight initial comparisons and eight comparisons
after loading Leaflet and returning from Map to Board. No tolerance or image
masking is used. The full screenshot is compared. Board styles, density, metrics,
table, review queue, sidebar, location placeholder and drawer remain intact.

## Implementation and data

- Native labeled View select: Board / Split / Map. Only explicit choices save
  `gridlyDispatchView`; invalid/missing preference defaults to Board. Storage
  failure remains usable. Local `view` query overrides the initial saved value.
- Split is approximately 40/60 list/map on desktop. Map is approximately 20/80
  with an equivalent compact list. Tablet stacks map and list; short screens
  scroll vertically. No horizontal document overflow at certified sizes.
- List and marker selection share incident IDs, selected styling and popup.
  Popups pan immediately inside the map; selection brings an offscreen map into
  view. The same drawer opens from list/popup and restores the invoking focus.
- Switching modes preserves search, severity/status/source/review filters,
  acting unit and theme. Unit changes keep the prior reset behavior and exclude
  previous-unit markers. Coordinates exist only on four synthetic fixtures.
- Leaflet 1.9.4 is copied unchanged from the existing pinned dependency. No
  package/lockfile changes or consumer runtime imports. Canvas draws the roads;
  div markers and popup controls consume Dispatch theme tokens. Canvas layers
  are removed before the map renderer to prevent a late redraw during teardown.
- No tile provider, tiles, external runtime requests, key or paid dependency.
  331 public OpenStreetMap highway LineString segments from the existing public
  source dataset form a finite Dayton context map. Source timestamp:
  `2026-05-09T22:50:58Z`. It is not live traffic, navigation or jurisdiction data.
- Extraction keeps contiguous in-bounds vertex runs, unchanged coordinates and
  only four road properties. Source hash/bounds/transform are recorded in
  `dispatch/demo/dayton-roads-provenance.json`. Reproduce offline with
  `node tools/dispatch-ui/prepare-map.mjs`.

## Licensing

Leaflet is BSD-2-Clause; the original license is included in
`dispatch/vendor/leaflet/LICENSE`. Map data is © OpenStreetMap contributors,
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Visible map credits
link to [OpenStreetMap attribution](https://www.openstreetmap.org/copyright),
the downloadable derived GeoJSON (with license metadata), and Leaflet. Credits
are outside popup overlays and remain reachable when small screens scroll.

## Certification

59 UI tests PASS: 21 map + 25 theme + 13 visual-shell tests. 120 existing Dispatch
regression tests PASS: durable contract, invitation delivery, Worker hosting,
readiness and Resend production configuration. These are local automated tests,
not real invitation delivery. Runtime: pinned Playwright 1.54.2 with installed
Microsoft Edge (`DISPATCH_BROWSER_CHANNEL=msedge`).

Coverage includes all mode transitions, persistence/default/corrupt/unavailable
storage, filter/unit eligibility, list/marker sync, keyboard operation, non-map
equivalence, drawer return focus, theme switching/System resolution with camera
preservation, empty filtering, map data and library failure, retry/Board recovery,
demo asset gates, same-origin read-only requests and exact Board regression.
The original theme suite also checks semantic text/focus contrast. This is
targeted accessibility verification, not a complete WCAG audit.

Commands:

```powershell
$env:DISPATCH_BROWSER_CHANNEL='msedge'
node --test tests/dispatch-map.test.mjs tests/dispatch-theme.test.mjs tests/dispatch-visual-shell.test.mjs
node --test tests/responder-phase29-durable-contract.test.mjs tests/responder-phase29-invitation-delivery.test.mjs tests/responder-phase29-worker-hosting.test.mjs tests/responder-phase29-readiness.test.mjs tests/responder-phase29-resend-production.test.mjs
```

66 current screenshots are saved here, ignored by Git: both themes at 1920×1080,
1440×900, 1280×720 and 1024×768, each with Board, Split, Split selected, Split
drawer, Map, Map selected, Map drawer and Map empty (64), plus light/dark map
failure at 1440×900 (2). Local contact sheets support visual inspection; approved
baseline PNGs and development comparison artifacts are separate evidence.
Review confirmed theme-consistent roads, markers, controls, popup and drawer,
readable status labels, defined selected states and responsive stacking. Tablet
popup clipping found during review was corrected by revealing the selected map.
Vertical scrolling on short/tablet screens is intentional. Logs and PNGs are
local artifacts; this report and ignore file are committed.

## Production and governance

No production impact, deployment or push. No consumer source/map/auth changes,
Supabase schema/credentials/governance, Resend, Hyperdrive, inbound mail or DNS
changes. No publication, onboarding, invitation test or production writes.
`supabase/.temp/cli-latest` is untouched. Login remains fail-closed; local demo
capability, loopback checks, read-only server and exact asset allowlist remain.
Map assets/data are served only when the local demo server is enabled. CSP is
unchanged and no external map origin is allowed.

This local map adds no production key/CSP/provider/routing/paid requirement.
Existing production hosting, real Dispatch auth/MFA/session and authorized read
integration remain outstanding. A production map additionally needs reviewed
coordinate provenance, geographic scope, data refresh and attribution; any
future tile service is a separate decision. Demo files must remain excluded.

## Owner review

Run `node tools/dispatch-ui/serve.mjs --demo`, then open
`http://127.0.0.1:4178/?demo=1&view=split&theme=dark`.
Choose Board/Split/Map and Light/Dark/System. Query values `view=board|split|map`
and `theme=light|dark|system` provide direct local review links. Click an incident
title in the list or its H/M/L/✓ marker; choose View details; Escape/Close returns
focus. Only the selected unit's synthetic incidents are shown.

Next step: owner visual review. No production deployment, participant onboarding
or controlled invitation delivery is authorized by this certification.
