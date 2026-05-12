# GRIDLY V63 — Desktop / Mobile Separation Audit

## Executive Summary

This audit confirms that Gridly currently uses a **hybrid shared-surface architecture**: desktop and mobile reuse core map, alerts, route, and reporting systems while switching behavior via `body[data-layout-mode]` and `body[data-mobile-mode]`. This is partially intentional and efficient, but several couplings are hidden enough to create regression risk—especially where mobile flows target desktop containers (notably `#alertsSection` / `.desktop-command-panel`).

No architecture rewrite was performed. No Supabase, routing architecture, or report-flow architecture was replaced. This branch adds an audit document only.

---

## Full Coupling Audit

### 1) Alerts Center Shared Container Coupling
1. **Coupling Name**: Mobile Alerts Mode -> Desktop Alerts Container
2. **Desktop component involved**: `.desktop-command-panel`, `#alertsSection`
3. **Mobile component involved**: mobile daily panel + `open-alerts-center` action + `data-mobile-mode="alert"`
4. **Shared selector/function/state**: `#alertsSection`, `.desktop-command-panel`, `setMobileUiMode("alert")`, `scrollToSection("alertsSection")`
5. **Why coupling exists**: Mobile alert entrypoint intentionally reuses desktop Rail Pulse/Impact drawer surface instead of maintaining a separate mobile alerts screen.
6. **Classification**: intentional + temporary + risky (hidden coupling), acceptable short-term
7. **Regression risk level**: **high**
8. **Recommended future direction**: create dedicated mobile alerts surface later (or isolate adapter layer)
9. **Immediate action required now**: Yes, document and guard visibility assumptions in future commits.

**Separation requirement analysis**
- Desktop behavior depends on mobile state: **No** direct dependency.
- Mobile behavior depends on desktop containers: **Yes**.
- Shared selectors intentionally dual-purpose: **Partly** (explicit reuse), but hidden in behavior.
- Coupling hidden or explicit: **Semi-hidden** (logic exists in JS, not obvious in markup).
- Future separation recommended: **Yes**.

---

### 2) Shared Nav Routing Controller Coupling
1. **Coupling Name**: Unified `routeNavSection()` for desktop and mobile
2. **Desktop component involved**: top nav / left rail nav buttons
3. **Mobile component involved**: mobile bottom nav + mobile quick actions
4. **Shared selector/function/state**: `routeNavSection()`, `navTargets`, `mobileUiMode`
5. **Why coupling exists**: Single navigation controller reduces duplicate logic and keeps section mapping consistent.
6. **Classification**: intentional + acceptable, with medium risk from mode toggles inside shared function
7. **Regression risk level**: **medium**
8. **Recommended future direction**: isolate later (desktop/mobile adapters calling shared target resolver)
9. **Immediate action required now**: No immediate change needed.

**Separation requirement analysis**
- Desktop depends on mobile state: **Only indirectly** (mobile branch guarded by viewport check).
- Mobile depends on desktop containers: **Yes** for alerts target mapping.
- Shared selectors intentionally dual-purpose: **Yes**.
- Hidden or explicit: **Explicit** in code, but mixed responsibilities.
- Future separation recommended: **Yes, moderate**.

---

### 3) `scrollToSection()` Mode + Scroll Hybrid Coupling
1. **Coupling Name**: `scrollToSection()` doubles as mode-switcher on mobile
2. **Desktop component involved**: section scrolling (`#mapSection`, `#alertsSection`, etc.)
3. **Mobile component involved**: mode updates without actual scrolling
4. **Shared selector/function/state**: `scrollToSection()`, `setMobileUiMode()`, section IDs
5. **Why coupling exists**: Reuses one entrypoint for both desktop scroll navigation and mobile mode transitions.
6. **Classification**: legacy-ish convenience pattern; risky if callers assume guaranteed scrolling
7. **Regression risk level**: **medium-high**
8. **Recommended future direction**: refactor later into `navigateToSectionDesktop()` + `setMobileSectionMode()` wrappers
9. **Immediate action required now**: No (audit visibility sufficient for this branch).

**Separation requirement analysis**
- Desktop depends on mobile state: **No**.
- Mobile depends on desktop containers: **Yes**, when target is desktop section IDs.
- Shared selectors intentionally dual-purpose: **Yes**.
- Hidden or explicit: **Hidden intent** (function name implies scroll-only behavior).
- Future separation recommended: **Yes**.

---

### 4) Body Attribute State Coupling (`data-layout-mode` + `data-mobile-mode`)
1. **Coupling Name**: CSS and JS both drive view switching from body attributes
2. **Desktop component involved**: desktop rails, panels, overlays gated by `data-layout-mode`
3. **Mobile component involved**: mobile surfaces, nav, modal sizing gated by both attributes
4. **Shared selector/function/state**: `applyLayoutMode()`, `setMobileUiMode()`, CSS selectors on `body[...]`
5. **Why coupling exists**: Centralized mode state simplifies responsive overrides.
6. **Classification**: intentional + acceptable, but broad blast radius
7. **Regression risk level**: **medium**
8. **Recommended future direction**: keep as-is with stricter state contract docs and selector inventory
9. **Immediate action required now**: No.

**Separation requirement analysis**
- Desktop depends on mobile state: **Mostly no**, except shared CSS rules that key off `data-mobile-mode`.
- Mobile depends on desktop containers: **Not directly**.
- Shared selectors intentionally dual-purpose: **Yes**.
- Hidden or explicit: **Explicit**.
- Future separation recommended: **Partial hardening only**.

---

### 5) Map Overlay and Filter Shell Coupling
1. **Coupling Name**: Shared map tooling UI (`.map-tools-overlay`, `.geo-filter-shell`) across layouts
2. **Desktop component involved**: desktop map toolbar / legend row
3. **Mobile component involved**: same overlay container resized/reflowed by mobile CSS
4. **Shared selector/function/state**: `.map-frame`, `.map-tools-overlay`, `.geo-filter-shell`, `.geo-filter-pill`, `applyGeoFilterFromPill()`
5. **Why coupling exists**: Single source for map filtering behavior and status labels.
6. **Classification**: intentional + efficient + acceptable
7. **Regression risk level**: **low-medium**
8. **Recommended future direction**: keep as-is, isolate later only if UX divergence grows
9. **Immediate action required now**: No.

**Separation requirement analysis**
- Desktop depends on mobile state: **No**.
- Mobile depends on desktop containers: **No** (shared map container, not desktop-only panel).
- Shared selectors intentionally dual-purpose: **Yes**.
- Hidden or explicit: **Explicit**.
- Future separation recommended: **Not urgent**.

---

### 6) Daily Panel Surface Action Coupling
1. **Coupling Name**: Mobile daily panel actions invoke shared report/route/alerts controls
2. **Desktop component involved**: existing route/report/alerts controls and IDs used by shared logic
3. **Mobile component involved**: `#mobileDailyPanel`, `#mobileNativeSurfaceLayer`, action dispatcher
4. **Shared selector/function/state**: `bindDailyPanel()`, `executeMobilePanelAction()`, `closeSurface()`, DOM IDs (e.g., `manualReportType`)
5. **Why coupling exists**: Mobile shell is an orchestration layer over existing desktop-era functional controls.
6. **Classification**: intentional + temporary + somewhat risky
7. **Regression risk level**: **high** for selector drift
8. **Recommended future direction**: isolate later with stable interface helpers (not direct selector clicks)
9. **Immediate action required now**: Yes—future changes touching IDs should include mobile panel regression checks.

**Separation requirement analysis**
- Desktop depends on mobile state: **No**.
- Mobile depends on desktop containers/state: **Yes**, via shared IDs/actions.
- Shared selectors intentionally dual-purpose: **Partly intentional, partly legacy**.
- Hidden or explicit: **Mostly hidden** (indirect click-based orchestration).
- Future separation recommended: **Yes**.

---

### 7) Desktop Command Actions Triggering Mobile-Adjacent Behavior
1. **Coupling Name**: Desktop command actions routed through shared section logic
2. **Desktop component involved**: desktop left rail/top nav actions
3. **Mobile component involved**: mobile mode side effects inside shared route function
4. **Shared selector/function/state**: `handleDesktopCommandAction() -> routeNavSection()`
5. **Why coupling exists**: single command pipeline intended to keep parity.
6. **Classification**: intentional, acceptable, but mixed concerns
7. **Regression risk level**: **medium**
8. **Recommended future direction**: refactor later to separate "what section" from "how platform navigates"
9. **Immediate action required now**: No.

**Separation requirement analysis**
- Desktop depends on mobile state: **Potentially, via shared function branches**.
- Mobile depends on desktop containers: **Sometimes**, for alerts section target.
- Shared selectors intentionally dual-purpose: **Yes**.
- Hidden or explicit: **Explicit**.
- Future separation recommended: **Yes, later**.

---

### 8) Shared Overlay / Layer Z-Index Contract Coupling
1. **Coupling Name**: Mobile native surface layer and map overlays share global stacking context rules
2. **Desktop component involved**: map overlay and desktop command panel layering
3. **Mobile component involved**: `.mobile-native-surface-layer`, mobile map controls, mobile bottom nav
4. **Shared selector/function/state**: z-index rules across `.map-tools-overlay`, `.mobile-native-surface-layer`, body mode selectors
5. **Why coupling exists**: Single stylesheet controls all surfaces with responsive overrides.
6. **Classification**: intentional + acceptable but fragile in large CSS file
7. **Regression risk level**: **medium**
8. **Recommended future direction**: isolate later with layer token map/doc (z-index registry)
9. **Immediate action required now**: No immediate code patch.

**Separation requirement analysis**
- Desktop depends on mobile state: **Only through shared CSS precedence order**.
- Mobile depends on desktop containers: **No direct dependency**.
- Shared selectors intentionally dual-purpose: **Yes**.
- Hidden or explicit: **Hidden risk due to stylesheet scale/order**.
- Future separation recommended: **Yes, documentation + tokenization later**.

---

## High-Risk Coupling Areas

1. Mobile Alerts flow targeting `#alertsSection` in `.desktop-command-panel`.
2. Mobile daily panel action dispatcher using direct DOM ID clicks into shared controls.
3. `scrollToSection()` doing both navigation intent and mobile mode mutation.

These three areas are primary regression-loop candidates.

---

## Low-Risk / Acceptable Coupling Areas

1. Shared map filter controls (`.geo-filter-shell`, `.map-tools-overlay`) where behavior is intentionally identical.
2. Body attribute mode switching (`data-layout-mode`) as centralized responsive switch.
3. Shared section target map (`navTargets`) as long as callers are platform-aware.

---

## Immediate Concerns

- Any rename/restructure of `#alertsSection`, drawer markup, or desktop panel class can silently break mobile Alerts mode.
- Any update to report or route control IDs may break mobile daily panel quick actions.
- Any new calls to `scrollToSection()` from mobile-only features can have unexpected mode effects.

---

## Future Cleanup Recommendations

1. Add a small "navigation adapter" layer: desktop scroll adapter vs mobile mode adapter.
2. Add a stable interface for daily-panel actions (functions), replacing click-by-selector calls over time.
3. Introduce a dedicated mobile alerts surface, or explicit adapter around desktop alerts drawer.
4. Add a CSS layer/z-index map doc to prevent overlay collisions.
5. Add a "coupling checklist" for PR reviews touching `routeNavSection`, `scrollToSection`, `setMobileUiMode`, and alerts markup.

---

## Tiny Safety Patches Added

- **None in this commit.**
- Rationale: this branch request prioritizes architecture visibility and avoids broad behavior changes.

---

## Exact Files Modified

- `DESKTOP_MOBILE_COUPLING_AUDIT_V63.md` (new)

---

## Architecture Untouched Confirmation

Confirmed:
- No layout redesign.
- No architecture rewrite.
- No Supabase logic changes.
- No broad routing refactor.
- No report flow rewrite.

This is an audit/documentation-only change.

---

## Regression Risks (Post-Audit View)

- **Current highest risk**: mobile alert flow coupling to desktop alert container.
- **Second-highest risk**: selector-based mobile action orchestration.
- **Third-highest risk**: shared navigation helpers with mixed desktop/mobile responsibilities.

