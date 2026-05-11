# V74 Mobile Shell Device Consistency Audit (Phase 1)

## 1) Executive summary
- V73’s mobile shell is structurally stable and already includes a short-height survival layer; the current risk profile is mostly visual density, spacing collisions, and competing bottom-fixed surfaces rather than lifecycle instability.
- The current CSS has multiple mobile overrides and repeated map/overlay refinements across breakpoints; this likely improves specific devices but increases drift risk between 430×932, 390×844, 375×667, and sub-520px-height views.
- A safe V74 Phase 2 should be CSS-surgical: normalize panel/strip/rail spacing tokens, enforce compact-height rules under a single compressed mode, and add max-height+internal scroll guardrails for all mobile surfaces.

## 2) Current mobile shell health
- Mobile shell primitives are present and separated: live brand header, map card, local context strip, daily panel, bottom nav, and native surface layer.
- Daily Panel behavior is intentionally lightweight: handle toggles open/closed state, action buttons route to existing Route/Alert/Report surfaces, and close logic restores a safe mode.
- Short-height support exists today (max-height 520 and landscape), but it is still a narrow rule-set and not yet a full consistency system.

## 3) What is stable from V73
- Live mode protections and mode-safe surface closing are codified in the Daily Panel shell flow.
- Report-mode visibility is explicitly scoped in mobile mode (live hides report section; report mode reveals it).
- Short-height survival already trims Daily Panel text, hides context strip, and constrains major surfaces with max-height and internal scroll.

## 4) Current portrait layout risks
- **Override layering risk**: numerous mobile overrides (same selectors adjusted repeatedly) may produce device-specific drift and make exact behavior harder to reason about.
- **Bottom stack density**: Daily Panel + local context strip + bottom nav + floating dock can crowd map area on 375×667 class devices.
- **Spacing entropy**: current values are clamp-based and generally good, but without a unified “portrait compact” profile, control vertical rhythm may vary noticeably across phones.

## 5) Current short-height / landscape risks
- **Panel height hard cap**: Daily Panel max-height of 112px keeps view survivable but can still feel cramped depending on font scaling/accessibility settings.
- **Action density**: even with reduced button height, three panel shortcuts plus dock and nav can still fight for touch priority in ~520px height contexts.
- **Overlay clipping edge cases**: max-height: min(62vh, 320px) is helpful, but certain content-heavy states (alerts/report variants) may still feel compressed unless internal section spacing tightens further.

## 6) Daily Panel findings
- Positioned as fixed bottom surface with safe-area-aware offset token.
- Handle, grip, and helper note are present in default mode; short-height mode hides helper affordances for space recovery.
- Action button row is useful but can become vertically dominant on smaller portrait devices if dock + nav are simultaneously prominent.
- Collapsed/open behavior is stable and non-invasive (no broad lifecycle changes).

## 7) Local context strip findings
- Restored and visible in regular mobile mode; visually lightweight and non-interactive (pointer-events: none), helping avoid accidental taps.
- Position is directly tied above Daily Panel via context-gap token.
- In short-height/landscape, it is already hidden, which is directionally correct for map-first survival.
- Remaining risk: on mid-height portrait devices, strip can still contribute to lower-map compression when all bottom surfaces are active.

## 8) Right-side control rail findings
- Primary mobile rail behavior is effectively map-tools overlay + Leaflet controls rather than desktop rail.
- Control sizing has multiple compact refinements; this is positive but fragmented.
- Collision risk persists when overlays/panels are open and map controls remain visible in the same vertical corridor.
- Needs a single compressed tactical profile to guarantee minimum tap targets while reducing vertical footprint.

## 9) Top header/status findings
- Mobile live brand and live commute command are compact and readable in current form.
- There are dedicated size reductions in smaller-height contexts, but stacking top status + map tools can still reduce initial map viewport on short devices.
- Risk is not instability; risk is cumulative vertical footprint from multiple “small but stacked” components.

## 10) Overlay/surface findings
- Native mobile surface layer is a fixed bottom sheet with capped height and scroll handling patterns already present.
- Report, route quick panel, and route setup modal are included in short-height max-height/overflow protection.
- Surface transitions appear mode-safe and avoid broad desktop/mobile recoupling.
- Opportunity: normalize all mobile surfaces to a shared compact token set (padding, header height, action row spacing) under compressed tactical mode.

## 11) Recommended compressed tactical mode rules
Trigger proposal (CSS-only, no lifecycle rewrite):
- `@media (max-width: 760px) and (max-height: 620px)` baseline compact mode.
- stronger tier at `max-height: 520px` (existing survival tier).

Rules:
1. Daily Panel
   - reduce vertical paddings and handle min-height.
   - hide helper note and optional secondary text.
   - keep 3 action buttons but trim padding/font-size and enforce consistent min-height.
2. Local Context Strip
   - at <=620px: mini style (single-line, smaller text).
   - at <=520px: hide completely (current behavior).
3. Right-side / map controls
   - shrink non-critical labels, preserve touch targets >=32px.
   - prioritize one-row grouping before wrapping.
4. Top header/status
   - keep brand visible but reduce gap/padding slightly.
   - limit auxiliary text lines to one line with ellipsis.
5. Overlays/surfaces
   - enforce shared `max-height` token and `overflow-y:auto`.
   - reduce card padding/action gaps in compact mode.
6. Map-first guarantee
   - maintain minimum visible map band in viewport center.
   - avoid introducing new horizontal action bars.

## 12) Safe implementation plan for Phase 2
1. **Token pass (CSS-only):** introduce compact-height variables for panel offset, context gap, button min-height, and surface padding.
2. **Daily Panel surgical pass:** apply compact tokens without changing JS behavior or panel action wiring.
3. **Context strip policy:** mini at <=620px, hidden at <=520px; keep pointer-events none.
4. **Overlay normalization:** align report/route/native-surface max-height and internal spacing in compact mode.
5. **Map control compaction:** reduce label density and spacing, preserve control usability.
6. **QA pass by viewport matrix:** 430×932, 390×844, 375×667, and <=520 height portrait/landscape.

## 13) Regression risks
- Over-aggressive compaction may reduce readability/tap confidence.
- Selector specificity conflicts due to existing layered mobile overrides.
- Unintended interaction between map tools overlay z-index and bottom surfaces.
- Accessibility/font-scaling edge cases in short-height mode.

## 14) Manual QA checklist
- [ ] 430×932: Daily Panel collapsed/open, map still dominant, no overlap with bottom nav.
- [ ] 390×844: local context strip remains readable and non-obstructive.
- [ ] 375×667: verify bottom stack does not crowd key map touch area.
- [ ] <=520px portrait: helper text hidden, buttons compact, map usable.
- [ ] <=520px landscape: context strip hidden, surfaces scroll internally.
- [ ] Operational Feed native surface: opens/closes correctly, no clipped controls.
- [ ] Report surface: opens in report mode only, closes back to safe mode.
- [ ] Route Watch quick surface: remains reachable from Daily Panel.
- [ ] Map controls: no collision with overlays in compact states.

## 15) Files changed
- `V74_MOBILE_SHELL_DEVICE_CONSISTENCY_AUDIT.md` (new)

## 16) Architecture untouched confirmation
Confirmed unchanged in this Phase 1 audit:
- mobile lifecycle architecture
- Supabase/report pipeline
- route intelligence logic
- incident pipeline
- desktop/mobile container boundaries
- broad visibility contracts

This pass is audit-and-plan only, with no production behavior rewrite.
