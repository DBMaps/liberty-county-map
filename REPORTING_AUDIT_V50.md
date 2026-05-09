# Gridly Regression Audit V50

Date: 2026-05-09 (UTC)
Scope: Static code and stylesheet audit for map rendering, route watch behavior, responsive behavior, marker/pane ordering, and interaction integrity.
Limitations: No browser automation harness or device farm is present in-repo, so this audit validates implementation paths and likely runtime behavior from source.

## Exact Test Results

1. **Mobile map rendering — PASS (static)**
   - Mobile viewport meta is present and configured.
   - Mobile-specific controls/cards/nav are defined and styled under mobile breakpoints.
   - Leaflet panes and tile rendering styles are explicitly managed.

2. **Route Watch overlays — PASS (static)**
   - Route preview and corridor overlays are built as dedicated Leaflet layers and assigned to `routePane`.
   - Route-watch state flags gate rendering and switching behavior.

3. **Route relevance styling — PASS (static)**
   - Route pressure bands, recommendation text, and severity mappings are implemented.
   - Cleared vs active route-impact states are explicitly separated in route intel messaging.

4. **Cleared hazard behavior — PASS (static)**
   - Cleared lifecycle state logic is implemented (`recently_cleared`, `cleared`).
   - UI copy, sorting, marker classing, and alert rendering include cleared-specific handling.

5. **Popup clickability — PASS (static)**
   - Popup button classes and interactive states exist (`:hover`, `:active`, submitting/success states).
   - No global `pointer-events: none` override found for popup classes.

6. **Layer switching — PASS (static)**
   - Alternate route switch controls include enabled/disabled state, labels, and aria attributes.
   - “Show all crossings layer” toggle exists in UI and internal layer flags are tracked.

7. **Route visibility — PASS (static)**
   - Route preview success is validated against actual map layer presence and point count.
   - Route fallback and error states are surfaced with explanatory messages.

8. **Desktop responsiveness — PASS (static)**
   - Desktop command panel has dedicated layout and typography blocks.
   - Multiple breakpoint sections tune panel structure and scroll behavior.

9. **Marker z-index behavior — PASS (static)**
   - Map panes and high-priority overlays use explicit z-index values.
   - Custom marker classes for alert/cleared/nearby exist and pane architecture appears intentional.

10. **Performance under higher marker density — WARNING (risk present)**
   - Current approach stores markers in a `Map` and toggles geo filters efficiently.
   - No clustering or virtualized rendering path detected for very high marker counts.
   - FRA query currently requests up to 5000 features; sustained higher densities could degrade interaction on lower-end devices.

## Required Verification Checklist

- No mobile viewport regressions: **PASS (static confidence: high)**
- No responsive leakage: **PASS with caution (static confidence: medium-high)**
- No duplicate markers: **PASS with caution (static confidence: medium)**
- No pane stacking issues: **PASS with caution (static confidence: medium-high)**
- No popup interaction failures: **PASS with caution (static confidence: medium)**
- No broken route previews: **PASS with caution (static confidence: medium-high)**

## Identified Risks

1. **Dynamic duplicate marker risk during rapid refresh cycles**
   - `LIVE_REFRESH_MS` polling plus realtime updates can create race-condition windows unless marker key reuse/removal is consistently enforced across all update paths.

2. **High-density marker performance ceiling**
   - Without clustering/canvas strategy, large marker sets may stress layout/paint and event handlers on mobile hardware.

3. **Pane order drift from future CSS edits**
   - Numerous high z-index declarations and responsive layers increase accidental stacking regression probability.

4. **Popup usability at extreme small viewports**
   - Interactions are present, but touch-target crowding could still occur when map overlays and floating controls overlap.

## Remaining Technical Debt

1. Missing automated UI regression suite (mobile + desktop breakpoint snapshots).
2. Missing synthetic load benchmark for marker density and route overlays.
3. No explicit end-to-end assertion suite for route preview lifecycle and alternate-route switching.
4. No dedicated pane contract test to prevent future z-index/pane regression.
5. No explicit duplicate-marker invariant test around combined poll + realtime ingestion.

## Recommendations for V50

1. Add Playwright smoke suite for:
   - mobile viewport map load
   - popup open/click actions
   - route preview render + alternate switch
   - layer toggle visibility assertions

2. Add marker-density performance gate:
   - seed test with 2k/5k synthetic markers
   - capture frame budget and interaction latency

3. Add marker dedup guardrails:
   - enforce stable marker IDs + pre-insert existence checks
   - add debug metric: unique IDs vs rendered count

4. Formalize pane/z-index contract:
   - centralize pane constants and CSS layer tokens
   - add CI lint/check for forbidden ad-hoc z-index spikes

5. Add responsive leakage checks:
   - snapshot tests across key widths (360, 390, 768, 1024, 1280)
   - assert hidden/visible state for mobile-only and desktop-only modules
