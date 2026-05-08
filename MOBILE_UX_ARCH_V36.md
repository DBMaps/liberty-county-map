# V36 Mobile-First UX Architecture Plan (Pre-Coding)

## Objective
Redesign the **mobile home flow** to prioritize the fastest path through these user questions:
1. Where am I going?
2. Is my route clear?
3. Should I reroute or leave early?
4. Can I report a hazard fast?

This plan is architecture-only (no code changes yet) and preserves: route intelligence, `reportingState`, unified hazards, Route Watch, map rendering, Supabase, OSRM, and desktop layout.

---

## Current Mobile Audit: Problems

### 1) Too many top-level cards before core decision
Mobile users currently hit a long stack (`destination`, live hero, quick actions, commute, community, active crossings, corridor intel, status bar) that delays the route-clear decision.

**Impact:** high cognitive load; “what do I do now?” is not singular.

### 2) Duplicate or overlapping actions
- Reporting appears in multiple places (`mobileQuickReportBtn`, sticky `mobileReportBtn`, report drawer CTA copy, hazard launcher interactions).
- Route access appears in multiple ways (`mobileQuickRouteBtn`, commute CTA, map tab, route status card edit).

**Impact:** users must choose between equivalent entry points instead of being guided to one primary action.

### 3) Route signal is fragmented
Route confidence/status is split across route card, commute card, map status, and Route Watch details. “Leave now vs reroute” is not surfaced as one decisive recommendation above the fold.

### 4) Advanced/reporting controls are visible too early
Manual reporting (`search`, `select`, type selection) and dual report mode controls are present in the same general flow as quick reporting.

**Impact:** fast reporters face unnecessary decision branches.

### 5) Desktop command-center concepts leak into mobile hierarchy
Mobile home surfaces “community impact” and additional intelligence blocks that are useful but secondary for quick commute checks.

---

## Proposed Mobile Information Architecture (Section Order)

### New mobile home order (top to bottom)
1. **Route Intent Header (primary)**
   - “Where are you headed?” + current selected destination chip.
   - Single “Change” affordance.

2. **Route Decision Card (primary decision block)**
   - Route status: Clear / Delay / Blocked risk.
   - Explicit recommendation: **Leave now / Leave early / Reroute**.
   - ETA delta + confidence + freshness in compact form.
   - Primary CTA: **Open Route Watch** (or “View Route Details”).

3. **Fast Report CTA (primary action block)**
   - One dominant action: **Report Hazard Fast**.
   - Secondary inline: “Mark Cleared”.

4. **Live Map Preview strip**
   - Compact status: nearby active incidents count, one-liner summary.
   - CTA: “Open Live Map”.

5. **Details accordion (collapsed by default)**
   - Community trust
   - Corridor intelligence badges
   - Expanded freshness/metric diagnostics
   - Last report timeline

6. **Utilities row (lowest priority)**
   - Alerts/settings/profile shortcuts.

---

## What to Remove / Collapse on Mobile Home

### Remove from default mobile home feed
- Standalone “Community Impact” card.
- Standalone “Most Active” card.
- Standalone premium status bar card.

### Collapse under “Details”
- Corridor intelligence narrative and badges.
- Confidence/freshness micro-metrics beyond summary.
- Extended trust and “latest driver update” style text.

### Consolidate actions
- Merge multiple report entry prompts into one primary report CTA zone.
- Merge multiple route entry prompts into the Route Decision Card + one secondary route button.

---

## Desktop-Only (unchanged desktop layout)
Keep desktop command-center modules desktop-focused:
- Left rail operational navigation.
- Desktop command strip summary grid.
- Desktop route setup card and desktop insights grid.
- Desktop multi-panel side modules (Rail Pulse, Impact Score, desktop Route Watch rail).
- Advanced map legend density and broader control surface.

Mobile may still access equivalents through map/report views, but these should not dominate mobile home hierarchy.

---

## Primary CTA Recommendation

### Primary mobile CTA
**“Report Hazard Fast”** (sticky and in-card unified action).

Why this CTA:
- Matches key behavior requirement: rapid hazard reporting.
- Converts passive awareness into community signal quickly.
- Can branch into crossing vs road hazard while preserving one entry point.

### Route-focused companion CTA
Within Route Decision Card: **“Open Route Watch”** (secondary to reporting CTA in global visual priority, primary within routing context).

---

## What Goes Behind “Details”

Place these in one collapsed details surface:
- Route confidence breakdown (scoring factors).
- Freshness explanation + report expiry detail.
- Corridor badges and expanded movement intelligence narrative.
- Community trust/confirmation stats.
- Historical/secondary alert text.

Default state: collapsed to keep above-the-fold decision loop short.

---

## Recommended Implementation Phases

### Phase 0 — Instrumentation baseline (no visual disruption)
- Track taps for all current mobile CTAs.
- Capture time-to-first-route-check and time-to-report-start.
- Baseline completion for report submit and route-open flows.

### Phase 1 — IA shell refactor (mobile-only)
- Reorder mobile sections to new hierarchy.
- Keep existing IDs/state wiring where possible.
- Hide/collapse non-primary cards into details container.

### Phase 2 — CTA unification
- Route all quick report entry points through one CTA + one flow manager.
- Preserve `reportingState` transitions and hazard/crossing mode parity.

### Phase 3 — Route decision consolidation
- Promote single recommendation output (leave/reroute timing) from existing route intelligence.
- Reduce duplicate route cards/buttons; preserve Route Watch features.

### Phase 4 — Progressive disclosure polish
- Move secondary intelligence into details drawer.
- Tune copy hierarchy and spacing for sub-10-second scan.

### Phase 5 — Validation and rollback safety
- Compare baseline vs new metrics.
- Keep desktop untouched.
- Feature-flag mobile IA if needed for safe rollback.

---

## Safest First Coding Step

**Safest first step:** implement a **mobile-only structural wrapper + section reordering via feature flag**, without changing business logic.

Concretely:
1. Create one mobile home container that reuses existing bound elements/IDs.
2. Reorder presentation only (DOM grouping/CSS order) for mobile breakpoint.
3. Keep all data sources and state machines intact (`reportingState`, route intelligence, hazards pipeline).
4. Do not alter Supabase/OSRM/map/report submission code in step one.

This delivers high UX impact with lowest regression risk because it avoids logic rewrites and backend coupling.

---

## Architecture Guardrails (Must Preserve)
- Keep unified hazard model and reporting pathways intact.
- Keep route intelligence computations and Route Watch activation logic intact.
- Keep Supabase real-time/report persistence integration intact.
- Keep OSRM route computation + reroute capability intact.
- Keep map rendering and filters intact.
- Keep desktop layout and interactions intact.
