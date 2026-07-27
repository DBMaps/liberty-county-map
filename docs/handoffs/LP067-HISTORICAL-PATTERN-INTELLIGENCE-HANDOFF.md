# LP067 — Historical Pattern Intelligence Foundation Handoff

## Executive summary

LP067 adds an isolated, read-only intelligence foundation that converts historical reports into normalized observations, discovers repeated place-and-time behaviors, qualifies their historical confidence, binds meaningful patterns to a driver's present awareness context, and produces at most one internal driver summary. It does not forecast, recommend a route, expose a score, change report storage or Supabase, or activate any consumer experience.

The module is deliberately absent from `index.html`. Production presentation and runtime behavior therefore remain unchanged. A standalone browser certification page exercises the complete pipeline without loading the application runtime.

## Historical intelligence architecture

### 1. Normalization

`normalizeObservation` accepts common camel-case and snake-case historical report fields without changing their source. It derives a canonical awareness area, community, county, roadway, crossing, hazard/event identity, local day of week, minute of day, observed duration, timestamp, subject, and behavior key. Invalid timestamps and observations without both a subject and geographic context are rejected.

Time derivation accepts an explicit `utcOffsetMinutes`; the engine does not infer a timezone from a county or silently mutate source timestamps.

### 2. Pattern discovery

`discoverPatterns` groups compatible observations by area, subject, hazard, and event behavior. It deduplicates episodes and requires recurrence on at least three distinct dates. A pile of reports from one day is not treated as a recurring pattern.

The engine then evaluates whether the behavior repeats in a stable weekday/weekend and time window, spans meaningful history, and includes reasonably fresh historical evidence. This discovers repeated behavior rather than merely ranking report counts.

### 3. Pattern confidence

Confidence is an internal categorical state: `insufficient`, `emerging`, or `meaningful`. The supporting basis is expressed as factual booleans for distinct-day recurrence, stable time context, sustained span, and historical freshness. No percentage or numeric confidence is generated for consumer use.

### 4. Current relevance

`determineCurrentRelevance` requires a meaningful pattern to match the current awareness geography, weekday/weekend context, and a 90-minute present-time window. Supplied nearby crossing and road sets further constrain candidates. Candidate ordering favors an exact nearby subject, then temporal proximity and recent historical observation. It returns one pattern or an explicit quiet state.

### 5. Internal summary

`generateDriverSummary` returns one concise historical statement and directs the driver to current alerts for live conditions. It returns `null` for a quiet state. Wording communicates what has commonly been reported and avoids prediction, probability, navigation, or route advice.

### Boundary contract

- Read-only, deterministic computation; no network, timers, storage, DOM writes, or Supabase operations.
- No script registration in the production document.
- No changes to Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, synchronization, Community Pulse, Travel Brief, Destination Intelligence, Unified Evidence, or existing confidence/freshness logic.
- The returned `productionIntegration: false` flag makes the foundation's non-activation explicit.

## Browser certification instructions

1. From the repository root, serve static files: `python3 -m http.server 4173`.
2. Open `http://localhost:4173/tests/lp067-browser-certification.html` in current stable Chrome, Safari, Firefox, and Edge.
3. Confirm all eight rows display **PASS** and the document body has `data-certification="pass"`.
4. In DevTools, evaluate `window.__LP067_CERTIFICATION__`. Confirm `passed` is `true`, `result.relevance.status` is `relevant`, and the summary describes historical reports rather than a future outcome.
5. Change the fixture context time to `20:00:00Z`, reload, and confirm the quiet-state check remains **PASS**.
6. In the Network panel, confirm the page loads only the certification document and `js/historical-pattern-intelligence.js`; it must not load `index.html`, `app.js`, providers, or synchronization code.
7. Open the production `index.html` separately and confirm there is no new historical summary or other presentation change.
8. Run `npm run test:lp067`, followed by the LP061–LP066 regression suite listed below.

The browser page is certification-only and must not be linked from production UI.

## Validation coverage

- Historical observation normalization, aliases, derived day/time, duration, and invalid-input rejection.
- Repeatable behavior discovery and same-day report-volume rejection.
- Meaningful confidence qualification and factual basis.
- Place, day, nearby-subject, and time relevance.
- Quiet state for mismatched contexts and insufficient history.
- Single non-predictive internal summary.
- Production document isolation and protected runtime presence.
- LP061–LP066 consumer decision-surface regressions.

## Merge recommendation

**Recommend merge** after the automated LP067 certification and LP061–LP066 regressions pass, and after one supported browser completes the standalone certification page. The implementation is additive, does not register itself with production runtime, and establishes the requested intelligence boundary without altering consumer presentation.

## Next-chat project handoff

Begin from this document and treat LP067 as an internal, inactive foundation. A future milestone may define an approved historical-data adapter and an explicit consumer activation contract, but it must not wire this module into production implicitly. Before activation:

1. Decide the authoritative timezone/UTC-offset source for each awareness context.
2. Define the approved read-only historical report adapter without changing report storage or Supabase schema.
3. Validate thresholds against representative crossing, flooding, congestion, roadway-hazard, and community-activity fixtures across multiple counties.
4. Decide whether any consumer surface may request this result, with Unified Evidence and existing language contracts preserved.
5. Re-certify quiet behavior and confirm that current alerts remain the authority for live conditions.

Do not interpret the categorical historical confidence as a prediction, and do not expose internal observation counts or pattern basis as a consumer score.
