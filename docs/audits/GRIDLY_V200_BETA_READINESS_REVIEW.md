# Gridly V200 Beta Readiness Review

Date: 2026-05-31

Scope: review-only assessment of the current Liberty County Gridly system. No feature implementation was performed.

## Critical Issues

1. **Runtime version and build labels are inconsistent for a V200 review.** The README still identifies the app as `Gridly V7 Hybrid Dashboard`, the runtime constant reports `Gridly V199`, and the Settings About panel still displays `Gridly V198` / `Build 1710`. This will confuse beta support, bug triage, and user-facing readiness claims.
2. **No production analytics or error telemetry foundation exists.** There are many diagnostic/audit helpers and local counters, but no durable event pipeline, no page/action/error capture, and no privacy-gated analytics sink. The left-rail Analytics action only opens an impact drawer.
3. **Live data is dependent on browser-side public Supabase access and client polling/realtime.** The app creates a Supabase client directly in the browser and reads/writes the `reports` table from client code. That may be acceptable for a controlled pilot only if Row Level Security, abuse limits, and schema constraints are already configured server-side; those controls are not represented in this repository.
4. **TxDOT is not part of the live incident model.** The TxDOT service exists and can fetch/normalize data when configured, but the main unified incident pipeline still returns empty `futureTxdotIncidents()`, so TxDOT records do not contribute to live alerts/map intelligence by default.
5. **Route Watch depends on third-party OSRM routing at runtime with no app-owned fallback or quota guard.** A beta with 250+ users could hit availability, latency, or throttling issues unless routing is proxied, cached, or operationally monitored.

## High Priority Issues

1. **Settings contain multiple future-state controls.** Notification toggles explicitly store preferences only and do not schedule or deliver notifications; theme preferences are saved for a future engine and do not apply a full theme redesign. These need clearer beta copy or gating.
2. **Local storage is the source of truth for device identity, saved places, profile, settings, and movement intelligence.** This is simple and privacy-preserving, but it means settings do not roam, can be lost on browser clearing, and are difficult to support remotely.
3. **Protected baseline disables heavy runtime crossing enrichment/source joins.** This is good for performance, but it means some intelligence remains cached/deferred and may not reflect full contextual enrichment during interactions.
4. **Report feed is capped and refreshed aggressively.** The client polls every 15 seconds, subscribes to all report table changes, and limits reads to 300 active rows. This is likely fine for 100 users but needs operational measurement before larger cohorts.
5. **Mobile landscape is intentionally blocked.** The app asks users to rotate back to portrait because landscape is being improved. This is acceptable for a narrow beta but should be disclosed.

## Medium Priority Issues

1. **Alert rendering is corridor-first and can show “Routes currently clear” when no corridor clusters are available.** This may hide the difference between no data, no configured route, and genuinely clear conditions.
2. **Multiple diagnostic surfaces remain exposed globally.** The app exposes many `window.gridly*Audit` and debug helpers. Useful for beta support, but review whether all should remain public in production.
3. **Saved place creation can infer coordinates from current map/user location.** This helps onboarding but can produce incorrect Route Watch anchors if the user does not understand what was saved.
4. **Visual styling has many repeated overrides for the same components.** Route Watch, buttons, alerts, and mobile surfaces have multiple CSS definitions over time, increasing regression risk.
5. **Cache-busting/build numbers are manually embedded.** Static script/style query params and build labels can drift, as seen in current version labels.

## Low Priority Issues

1. README documentation is stale relative to current feature scope and build naming.
2. Settings feedback is still a placeholder, not a real support intake path.
3. Analytics navigation label may overpromise because it routes users to an impact score area, not a true analytics dashboard.
4. The app currently loads Leaflet and Supabase from CDNs, which is convenient but should have a deployment policy for outage/SRI/cache considerations.

## Beta Recommendation

**Ready for 100 Users**

Rationale: the core Liberty County map/report/Route Watch experience appears pilotable for a small cohort, with guarded runtime behavior and active diagnostics. It is **not yet ready for 250 or 500 users** because analytics, operational observability, TxDOT production integration, routing resilience, and user-facing settings expectations are not mature enough.

## Data Collection Readiness

### Current State

- Community report data is stored in Supabase `reports` and loaded into active rail/hazard collections.
- Device identity is generated locally as `gridlyDeviceId`.
- Preferences and saved places are stored in localStorage.
- Diagnostics exist in memory for refresh counts, lifecycle traces, report rendering, Route Watch state, TxDOT debug state, and visual audits.
- No durable product analytics stream is present in the repository.

### Gaps

- No formal event taxonomy for activation, route setup, report submission, alert open, settings save, map filter use, or errors.
- No analytics consent/privacy policy implementation.
- No server-side event collector or warehouse schema.
- No funnel metrics for first-run onboarding, saved place completion, Route Watch activation, alert engagement, report success/failure, or retention.
- No production client error logging, network failure aggregation, or performance telemetry.

### Recommended V201 Analytics Foundation

- Define a privacy-first event contract with stable event names, anonymous device/session ID, timestamp, app version/build, viewport class, and coarse location context only when necessary.
- Add a small analytics adapter (`track(eventName, properties)`) that queues events, respects opt-out, strips precise coordinates by default, and can run in dry-run mode.
- Capture core beta funnels: first open, location permission prompt/result, save home/work/favorite, start Route Watch, route preview success/failure, report mode opened, report submitted/succeeded/failed, alert panel opened, alert row focused, settings opened/saved, TxDOT fetch status.
- Capture operational events: Supabase init/read/write errors, OSRM request success/failure/duration, TxDOT fetch success/failure/duration, render refresh duration buckets, unhandled errors/rejections.
- Create daily beta health dashboard metrics: DAU, route-watch activations, report submissions, failed submissions, active reports, alert opens, average route request latency, error rate, TxDOT freshness, and retention.

## Visual Consistency Findings

- The product has a strong dark visual direction with shared CSS variables for background, text, muted text, accent, warning, danger, and blue.
- Component consistency is at risk because many Route Watch, alert, button, and mobile surface styles are repeatedly redefined later in the stylesheet.
- There are at least three major surface paradigms: desktop dashboard/rail, legacy modal/drawer surfaces, and Portrait V2 shell. This creates beta regression risk when the same action appears in multiple places.
- Landscape mobile is intentionally unavailable, so visual QA should focus on mobile portrait and desktop widths.

## Settings Findings

- Settings are locally stored and explicitly described as device-local.
- Route Watch settings expose Home, Work, and saved places management.
- Notification controls exist, but copy states they are preference storage only and do not deliver notifications.
- Display controls include Map Style, Theme, and Text Size; the theme note says it is saved for a future theme engine.
- About panel version/build is stale for a V200 review.
- Feedback is a placeholder.

## Route Watch Findings

- Route Watch requires at least two configured places with valid coordinates and disables the start button when selections/coordinates are incomplete.
- Route Watch activation depends on successfully rendering a route preview, which depends on OSRM.
- Home/destination labels and setup hints are actively managed and can guide users through missing setup steps.
- Route Watch state is in-memory (`routeWatchActivated` / `window.__gridlyRouteWatchActive`) rather than a durable active route session.
- Baseline/commute intelligence exists as a blueprint/local sample foundation, but not as a robust beta analytics product.

## Alert Findings

- Alerts are rendered from commute consequence/corridor intelligence and unified incidents, with recently cleared incidents included.
- Alert rows have diagnostic/focus helpers that can focus incidents on the map when row metadata is present.
- Smart Alerts preference UI exists, but there is no actual notification delivery system in this repo.
- Alert copy has extensive fallback and de-genericization logic, suggesting prior issues with generic or misleading location labels; this should remain a beta QA focus.

## TxDOT Findings

- A dedicated TxDOT service exists, with configuration, endpoint template, refresh interval setting, normalization, local summaries, analytics, and debug helpers.
- Without `GRIDLY_TXDOT_API_KEY`, the service reports `TxDOT API key is not configured` and clears the external store.
- The service is loaded by `index.html`, but no automatic fetch loop or unified incident integration is visible in the main boot flow.
- `futureTxdotIncidents()` currently returns an empty array, so TxDOT is not part of the default unified incident list.
- V201 should either fully integrate TxDOT with clear source labeling and freshness or hide TxDOT readiness claims from beta users.

## Recommended Next Version After V200

**V201: Beta Analytics & Operational Readiness Foundation**

Primary goals:

1. Add privacy-first analytics/event collection and beta health dashboard foundations.
2. Add production-grade error/network/performance telemetry.
3. Resolve version/build labeling across README, runtime, Settings, and cache-busting.
4. Gate or clarify future-state Settings/Smart Alerts controls.
5. Decide TxDOT path: fully integrate into unified incidents/alerts/map or keep disabled behind an internal readiness flag.
6. Add Route Watch reliability metrics and routing fallback/proxy plan before expanding beyond 100 users.
