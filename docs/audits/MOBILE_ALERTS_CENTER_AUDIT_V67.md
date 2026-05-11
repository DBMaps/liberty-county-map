# MOBILE ALERTS CENTER AUDIT V67

## 1) Executive summary

This V67 audit reviewed the mobile-native Alerts Center path added in V65 and parity tuning from V66, with focus on separation, data parity, fallback behavior, and regression risk.

**Bottom line:** the primary mobile Alerts Center path is now native-surface based (`#mobileNativeSurfaceLayer` + `#mobileNativeSurfaceBody`) and does **not** require desktop container rendering in normal operation. A fallback path still references `#alertsSection` (intentional safety path). Data parity for rail/crossing incidents appears aligned through shared selectors (`getPrioritizedRailAlertIncidents()` and `getConsolidatedIncidents()`), and road hazards are sourced consistently via `getRoadHazardSurfaceIncidents()`. Main residual risks are mostly around focus/accessibility behavior and diagnostic verbosity, not data pipeline divergence.

## 2) Current architecture summary

### Mobile primary path (audited)

- Mobile Daily Panel actions route through `bindDailyPanel()` and `data-mobile-surface-action` dispatch.
- Opening Alerts Center triggers `renderMobileNativeAlertsCenter()` for native rendering inside `#mobileNativeSurfaceBody`.
- Surface visibility and mode are managed by `#mobileNativeSurfaceLayer.hidden`, `aria-hidden`, and `setMobileUiMode("alert")`.

### Mobile fallback path (audited)

- If native render throws, handler logs warning and falls back to:
  - `setMobileUiMode("alert", { silent: true })`
  - `scrollToSection("alertsSection")`
- On mobile viewport, `scrollToSection("alertsSection")` maps to mode-change behavior (no desktop-style smooth-scroll).

### Desktop path (audited)

- Desktop alert rendering continues through existing `renderAlerts()`, `renderRoadHazards()`, and `renderTrendingCrossings()` targets bound to desktop DOM.
- No direct desktop renderer rewrite detected in this branch audit scope.

## 3) Desktop/mobile separation findings

### Coupling findings matrix (explicit)

| Finding | Desktop component involved | Mobile component involved | Shared function/state/selector | Coupling type | Action needed |
|---|---|---|---|---|---|
| Primary mobile Alerts Center render is isolated from desktop panel container. | `#alertsSection` (not used in primary render path) | `#mobileNativeSurfaceLayer`, `#mobileNativeSurfaceBody` | `renderMobileNativeAlertsCenter()` | Intentional + acceptable | No immediate action |
| Fallback path references desktop alerts anchor. | `#alertsSection` | mobile action handler in `bindDailyPanel()` | `scrollToSection("alertsSection")` | Intentional temporary safety coupling | Keep for now; document as fallback-only dependency |
| Rail alert ranking source shared across desktop/mobile. | desktop alerts list | mobile native rail block | `getPrioritizedRailAlertIncidents()`, `getConsolidatedIncidents()`, `activeReports` | Intentional shared data coupling | Acceptable |
| Shared alert focus behavior used in both surfaces. | desktop alert rows | mobile native alert rows | `data-alert-focus`, delegated click/keydown handlers | Intentional UX coupling with accessibility risk | Add focus/accessibility hardening before polish |
| Desktop command panel selectors still used in desktop command flow only. | `.desktop-command-panel` | none directly in mobile native Alerts Center | `handleDesktopCommandAction()` selector usage | Acceptable desktop-only coupling | No immediate action |

## 4) Data parity findings

- **Rail/crossing source parity:** Mobile native rail section uses `getPrioritizedRailAlertIncidents(6)` (same prioritization helper used by desktop `renderAlerts()`).
- **Trending crossings parity:** Mobile native trending uses `getConsolidatedIncidents().slice(0,3)`; desktop trending uses same base source and slice behavior.
- **Road hazard source parity:** Mobile native hazards use `getRoadHazardSurfaceIncidents(4)` while desktop hazard list uses same source with a display limit of 3; source parity intact, count difference intentional display behavior.
- **Report read path:** Rail/crossing incident generation ultimately reads from `activeReports` via consolidated incident helpers; no separate mobile-only rail data feed found.
- **Report submission path:** No submission flow rewrite in audited code; existing shared report creation methods remain unchanged.

## 5) Surface/state/focus findings

- `renderMobileNativeAlertsCenter()` sets `layer.hidden = false` and `aria-hidden = false` and then sets mode `alert`.
- `closeSurface()` sets `hidden = true`, `aria-hidden = true`, and resolves `nextMode` (default `live`, explicit `alert` only when swapping from panel to native center).
- `scrollToSection()` on mobile is mode-driven (`mapSection` => live, `alertsSection` => alert), reducing accidental desktop scroll behavior.
- **Risk:** native surface open does not explicitly shift keyboard focus to heading or first interactive card; this can produce focus ambiguity for keyboard/screen reader users.
- **Risk:** close path does not restore prior focus target.
- **Risk level:** medium accessibility risk; low data/logic risk.

## 6) Diagnostics/logging findings

- `logDailyPanelAction()` emits multiple `console.info` checkpoints for open/render/close states.
- Native render fallback includes explicit warning log with reason.
- Existing diagnostic density is useful for branch audit/stabilization, but currently verbose for steady-state production.

**Temporary logs likely removable later:**
- repetitive final-state logs (`mobile alerts center final state`, repeated visibility snapshots)
- high-frequency interaction logs once confidence is established

## 7) Regression risks

### High-risk regressions (must-fix before polish)

No clear high-risk data-path regression found in audited scope.

### Medium-risk regressions

1. **Focus restoration gap** when closing native surface.
2. **No explicit initial focus target** when opening native surface.
3. **Fallback dependency on `alertsSection`** remains (acceptable short-term, but should stay intentionally bounded to error path).

### Low-risk observations

- Verbose diagnostics may obscure signal in console during manual QA.

## 8) Immediate fixes recommended (small/safe)

1. Add a small focus-management guard when opening/closing native surface:
   - set focus to close button or first alert row on open;
   - restore focus to invoking control on close.
2. Keep fallback to `alertsSection` as-is for resilience, but document it as explicit fallback-only dependency.
3. Optionally gate non-critical info logs behind a debug flag after V67 audit sign-off.

## 9) Future cleanup recommendations

- Introduce a scoped mobile-surface diagnostics flag (`GRIDLY_MOBILE_SURFACE_DEBUG`) to reduce noise without losing deep tracing capability.
- Convert fallback error branch into a named helper for clearer intent and easier instrumentation.
- Add a lightweight regression test script/checklist around mode transitions (`live -> alert -> live`) and focus behavior.

## 10) Testing checklist

### Programmatic validation run

- [x] `node --check js/app.js` (pass)

### Manual checklist (to execute/confirm in device QA)

- [ ] Fresh mobile load
- [ ] Daily Panel → Alerts
- [ ] Open Alerts Center
- [ ] Rail alerts appear when crossing reports exist
- [ ] Road hazards still appear
- [ ] Trending crossings still appear when available
- [ ] Alert row focus works
- [ ] Close returns clean map
- [ ] Route still works
- [ ] Report still works
- [ ] Geo filters return in live mode
- [ ] Desktop Alerts Center unchanged

## 11) Exact files modified

- `MOBILE_ALERTS_CENTER_AUDIT_V67.md` (new)

## 12) Architecture untouched confirmation

Confirmed: this audit deliverable does not redesign UI, does not add features, does not rewrite architecture, does not alter Supabase/report/route pipelines, and does not modify desktop behavior. It documents current behavior and risks only.

## Required audit questions (direct answers)

1. **Does mobile Alerts Center still depend on `#alertsSection` or `.desktop-command-panel` in its primary path?**
   - **Primary path:** No. Native render path uses `#mobileNativeSurfaceLayer` and `#mobileNativeSurfaceBody`.
2. **Does the fallback path still reference `#alertsSection`? Is that acceptable?**
   - Yes. It references `scrollToSection("alertsSection")` on native render failure. Acceptable as temporary resilience fallback.
3. **Does desktop Alerts Center remain unchanged?**
   - Within audited scope, yes (desktop render functions remain in place and are still invoked through existing paths).
4. **Does mobile Alerts Center use the same rail/crossing report source as desktop?**
   - Yes, via shared consolidated/prioritized incident helpers.
5. **Does mobile Alerts Center use the correct road hazard source?**
   - Yes, `getRoadHazardSurfaceIncidents()`.
6. **Are trending crossings rendered from the expected source?**
   - Yes, consolidated incidents (`getConsolidatedIncidents()`).
7. **Could Route or Report flows be affected by the new renderer?**
   - Low direct risk; renderer is read-focused. Medium UX risk exists through mode/focus transitions.
8. **Are diagnostics useful or excessive?**
   - Useful for stabilization; somewhat excessive for long-term default logging.
9. **Are any temporary logs ready to remove later?**
   - Yes, repeated state snapshot logs after stabilization.
10. **Are there any hidden z-index, aria-hidden, or focus risks?**
    - `aria-hidden` toggles are present; focus entry/restore risks remain.
11. **Does close behavior return to the correct mode?**
    - Yes in current logic (`nextMode` default `live`; explicit `alert` during action handoff).
12. **Are there any high-risk regressions that should be fixed before polish?**
    - No high-risk data regressions found; focus-management hardening is the highest-priority small fix before polish.
