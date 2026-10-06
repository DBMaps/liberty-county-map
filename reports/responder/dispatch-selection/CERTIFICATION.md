# Dispatch selection-state visual certification

Date: October 6, 2026.
Branch: codex/dispatch-visual-shell.
Starting approved head: 85e982d78aaf1c01f419a6ada07f8a8d361b496f.

## Scoped result

Only two runtime files change: dispatch/map.css and dispatch/map-view.mjs.
The latter changes only the caption key markup. Selection behavior, source data,
labels, popup content, drawer, filters, geometry and normal markers are unchanged.

- Selected ring: static 3px outline, tightened from 4px offset to 2px.
- Selected marker size: unchanged 80×80px canvas, 48×48px backing, 2px border.
- Ring uses the same theme text-accent as the row, independent of incident status.
- Selected row retains its muted background and 3px left accent, adding a 1px
  inset outline. No typography, padding, height or information density change.
- Compact key uses a 10px ring sample labeled Selected and a small check sample
  labeled Resolved. Decorative samples are aria-hidden; text remains readable.
  No category inventory, additional panel, glow, pulse or animation.
- Resolved markers retain the artwork and check at 70% opacity. Existing selected
  resolved behavior restores full opacity with the selection ring; unchanged.

Selection means the current incident only. Existing aria-pressed values on row
buttons and markers expose selection. Keyboard focus remains a separate outer
rectangle around the interactive element; selection is an inner circular marker
ring or row inset. Focusing another marker does not select it. Text/status badges,
category art and checks retain their independent meanings.

## Certification

Installed Edge with pinned Playwright. All 88 pre-existing UI checks pass;
the combined run with the first 11 selection tests passes 99/99 (ui-tests.log).
The final selection suite also includes an approved-camera comparison and runs
separately: 12/12 pass in selection-tests.log (100 distinct UI checks total). Captures wait for two identical consecutive
frames before exact geographic-view comparison, avoiding partial Canvas paints. Existing Dispatch regressions pass 120/120
in regression-tests.log, including durable contract, invitation delivery,
Worker hosting, readiness and Resend production-contract tests.

```powershell
$env:DISPATCH_BROWSER_CHANNEL='msedge'
node --test tests/dispatch-selection.test.mjs tests/dispatch-map-polish.test.mjs tests/dispatch-operational-map.test.mjs tests/dispatch-map.test.mjs tests/dispatch-theme.test.mjs tests/dispatch-visual-shell.test.mjs
node --test tests/responder-phase29-durable-contract.test.mjs tests/responder-phase29-invitation-delivery.test.mjs tests/responder-phase29-worker-hosting.test.mjs tests/responder-phase29-readiness.test.mjs tests/responder-phase29-resend-production.test.mjs
```

The approved head is rendered directly from immutable Git blobs. Exact full Board
PNG comparison covers dark/light at 1440×900, 1920×1080, 1280×720 and 1024×768.
Split/Map full screenshots match with only the entire caption masked, because the
new compact key occupies a smaller horizontal area. Caption first-span text is
asserted separately; caption/credit bounds and all panel/list/filter/topbar/sidebar
bounds match exactly. This mask does not hide any map, incident or navigation.

Focused checks cover 3px/2px marker styling, matched row accent, unchanged marker
size, click and keyboard synchronization in both directions, semantic state,
selected/resolved coexistence, distinct keyboard focus, key labels/samples,
Light/Dark/System changes, drawer round-trip, filters, camera, unit and theme.
Additional comparison tests selection camera/scroll/geometry and popup text
against the approved head with a non-empty Street filter. All runtime requests
remain same-origin GETs. Existing fixture isolation and consumer separation
checks remain included.

## Screenshots and review

28 local PNGs, ignored rather than committed:

- Dark and light Police Split without selection.
- Dark and light Police Split and Map with flooding and rail selected.
- Dark and light Works Split with signal selected.
- Dark and light Works Map with resolved debris selected.
- Dark and light key, selected-row and selected-marker close-ups.
- Eight Board viewport/theme screenshots.

Normal-scale visual review confirms a restrained tighter ring, matching row
outline, recognizable category-first artwork and visible resolved check. Light
selection contrasts with pale surfaces; dark selection has no glow or animation.
The compact key has low visual weight and stays separate from attribution.

## Boundaries

No consumer Gridly, Supabase, schema/auth governance, Resend, Hyperdrive,
credentials, publication, onboarding, inbound mail, DNS or protected CLI file
changes. No external dependency, provider or production writes. No push,
deployment, participant onboarding or invitation delivery.

Changes: two runtime files, approved-blob test server support, focused selection
tests, this report and its screenshot/log ignore rules. Next step: owner local
visual review of Police/Works Split/Map, dark and light.
