# Dispatch marker normalization certification

Date: October 6, 2026. Branch: codex/dispatch-visual-shell.
Approved starting head: 6bdccd803e9a30d294db7a3bbc015e86ce485210.

## Normalization

Only runtime change: dispatch/marker-language.mjs. Original Gridly PNG bytes
remain unchanged, as do consumer code and assets. Per-category optical metadata
records the colored circular badge bounds in the 256×256 source, rather than
using each PNG's transparent canvas as its apparent size.

Every badge fits a common 35px target centered at (40,30) inside the existing
48px backing. The entire source image is uniformly scaled and translated, so
aspect ratio, category artwork and pin shape are preserved without cropping.

| Category | Source badge center | Source badge extent | Scale relative to previous 80px image |
|---|---|---|---|
| Flooding | 127.5, 97.5 | 112px | 1.000× |
| Rail blockage | 127.5, 90 | 117px | 0.957× |
| Signal outage | 128.5, 112 | 83px | 1.349× |
| Debris | 128, 113 | 87px | 1.287× |

Flooding is recentered slightly; Rail is recentered and reduced slightly;
Signal and Debris are enlarged and recentered to compensate for source padding.
Bounds were measured from the source colored rims, then checked visually in the
same-condition gallery and real maps. This targets the category badge, not equal
sizes for differently shaped internal pictograms.

The normalization uses DOM style properties compatible with the existing strict
self-only CSP. No inline-style permission, external library, request or provider
was added. An initial inline-style attempt was rejected by the CSP and replaced;
rendered transform/width assertions now verify fitting actually applies.

## Preserved contracts

- 80×80 marker canvas: unchanged.
- 48×48 backing and 2px border: unchanged.
- Selected 3px ring and 2px offset: unchanged.
- Consumer-derived geographic and popup anchors: unchanged.
- Selected row and compact legend: unchanged.
- Resolved artwork/check, 70% unselected opacity, full selected opacity: unchanged.
- No changes to CSS, map controller, basemap/data, labels, landmarks, filters,
  theme system, Board/Split/Map geometry or drawer behavior.

## Verification

Focused tests compare original PNG bytes, computed optical fits, actual browser
transforms, unchanged shell/ring/offset, all four categories in selected and
unselected states, resolved coexistence, selected row and same-origin GET-only
requests. Exact Board screenshots cover both themes at 1440×900, 1920×1080,
1280×720 and 1024×768. Selected Police/Works Split/Map screenshots compare
against the approved Git blobs with only marker rectangles masked; every other
pixel, including rows, popup, key and basemap, must match except at most two
Canvas edge pixels may differ by one RGB channel level (observed browser
rasterization noise). Larger differences fail. Board stays byte-exact. Geometry is asserted
separately. Stable screenshot capture requires consecutive identical frames.

Older tests now check the 80px marker shell rather than the intentionally scaled
image rectangle, and mask category artwork in the previous selection-only
comparison. No runtime gate or interaction assertion is removed.

Commands (installed Edge, pinned Playwright):

```powershell
$env:DISPATCH_BROWSER_CHANNEL='msedge'
node --test --test-concurrency=1 tests/dispatch-marker-normalization.test.mjs tests/dispatch-selection.test.mjs tests/dispatch-map-polish.test.mjs tests/dispatch-operational-map.test.mjs tests/dispatch-map.test.mjs tests/dispatch-theme.test.mjs tests/dispatch-visual-shell.test.mjs
node --test tests/responder-phase29-durable-contract.test.mjs tests/responder-phase29-invitation-delivery.test.mjs tests/responder-phase29-worker-hosting.test.mjs tests/responder-phase29-readiness.test.mjs tests/responder-phase29-resend-production.test.mjs
```

Final certification: 111 distinct UI checks pass across the full run and the
corrected visual rerun; 120/120 existing regressions pass. The full sequential
run recorded 110/111 before the older selection comparator adopted the same
isolated-pixel tolerance. Both affected suites then passed 23/23 in
final-visual-tests.log; the other 88 UI checks passed in ui-tests.log.
Regression evidence is in regression-tests.log. No runtime edit followed those
checks. Result: COMPLETE / MARKER NORMALIZATION CERTIFIED.

## Visual artifacts

36 certification PNGs are retained locally and ignored from Git:
four side-by-side dark/light selected/unselected galleries, 24 real map scenes
(Police/Works, Split/Map, both themes, unselected/flood/rail/signal/debris), and
eight selected marker close-ups. Diagnostic diff-* PNGs are excluded from this
count. The gallery is created only by the browser test;
there is no production-facing gallery, route or preview-server allowlist change.

The side-by-side scene applies identical severity and active status to all four
icons so category fitting can be compared under the same conditions. Real Works
scenes separately certify resolved Debris and selected/resolved coexistence.
Normal-scale review checks recognizable category artwork, balanced badge size,
centering, uncrowded ring spacing and retained resolved meaning in both themes.

## Governance

No consumer Gridly, Supabase, schema/auth, Resend, Hyperdrive, credentials,
publication, onboarding, inbound mail, DNS or supabase/.temp/cli-latest changes.
No production writes, push, deployment, onboarding or invitation delivery.
Next step is owner review of the local maps and side-by-side artifacts.
