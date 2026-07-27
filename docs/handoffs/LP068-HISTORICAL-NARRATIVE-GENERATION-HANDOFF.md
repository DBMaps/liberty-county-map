# LP068 — Historical Narrative Generation Handoff

## Executive summary

LP068 adds a dedicated, internal narrative layer on top of LP067 Historical Pattern Intelligence. It converts a meaningful, currently relevant historical pattern into concise driver language that says what has been reported, where and when it was reported, why that history is relevant to the current travel period, and where to verify live conditions. A quiet or non-meaningful input returns `null` without filler.

The generator is deliberately absent from the production document and runtime. No production UI, consumer surface, live-alert authority, report workflow, synchronization path, confidence calculation, or freshness calculation has changed.

## Historical narrative architecture

### Input boundary

`generateNarrative` and `buildNarrativeRecord` accept the relevance result produced by LP067 (`{ status: "relevant", pattern }`). A direct meaningful pattern is also accepted for isolated internal certification. Quiet, irrelevant, missing, emerging, and otherwise non-meaningful inputs return `null`.

### Pattern-specific composition

The generator classifies relevant patterns into six narrative types: crossing delay, flooding, construction, congestion, community activity, and roadway hazard. Each type has a distinct opening and vocabulary. Crossing and congestion narratives may add a rounded typical-duration sentence when LP067 supplies duration evidence; other types do not invent duration or causal context.

Timing is translated into conversational weekday/weekend mornings, afternoons, evenings, nights, or travel periods. The narrative explicitly connects that historical timing to the current travel period, then closes with the unified instruction: “Check current alerts for live conditions.” All statements describe past reports. The module does not forecast, state probabilities, advise a route, suggest avoidance, or claim that a condition is currently active.

### Consumer and internal contracts

`generateNarrative` returns only the consumer-friendly string or `null`. It never includes report counts, confidence, scoring, metadata keys, or implementation details in the prose.

`buildNarrativeRecord` retains a separate frozen internal metadata object containing the matched pattern identity, narrative type, current-relevance reason, confidence category, and first/last historical timestamps. The record is marked `consumerVisible: false`, `productionIntegration: false`, and `nonPredictive: true` for future milestone governance. The metadata is available only through the explicitly internal record API and is not embedded in consumer prose.

### Isolation boundary

- The implementation performs deterministic, read-only string composition with no network, storage, timers, DOM writes, or Supabase access.
- `index.html` does not load the generator.
- Community Pulse, Travel Brief, Destination Intelligence, Unified Evidence, Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, and synchronization remain untouched.
- The standalone LP068 certification page is the only browser document that loads the generator; it is not linked from production presentation.

## Browser certification instructions

1. From the repository root, run `python3 -m http.server 4173`.
2. Open `http://localhost:4173/tests/lp068-browser-certification.html` in a current stable browser.
3. Confirm all seven checks show **PASS** and the body has `data-certification="pass"`.
4. In DevTools, evaluate `window.__LP068_CERTIFICATION__`. Confirm `passed` is `true`, `narrative` uses crossing language, `flood` uses flooding language, and `record.metadata.narrativeType` is `crossing_delay`.
5. In the Network panel, confirm only the certification document, LP067 engine, and LP068 generator load. The page must not load `index.html`, `app.js`, production providers, or synchronization code.
6. Open production `index.html` separately and confirm presentation is unchanged and no historical narrative appears.
7. Run `npm run test:lp068`, `npm run test:lp067`, and the LP061–LP066 regression tests before merge.

## Certification coverage

- Narrative generation from an LP067 relevant pattern.
- Null-only quiet behavior for absent, quiet, irrelevant, and non-meaningful inputs.
- Distinct language across all six supported narrative types.
- Consumer-language checks for current-period relevance and live-alert guidance.
- Exclusion of counts, scores, confidence labels, technical metadata, predictions, and route advice from prose.
- Retention of frozen internal narrative metadata.
- Static protected-runtime isolation and prior-milestone regression validation.

## Merge recommendation

**Recommend merge** after LP068, LP067, and LP061–LP066 automated certifications pass and one supported browser completes the standalone LP068 page. The change is additive, internal-only, and isolated from production runtime and presentation.

## Next-chat project handoff

Start with this document and continue treating LP067 and LP068 as inactive internal capabilities. A later milestone must define an explicit, approved activation contract before any production surface imports either module. That work should:

1. Choose the authorized consumer surface and preserve current alerts as the live-condition authority.
2. Define whether the surface receives only the narrative string or a presentation-safe DTO that cannot leak internal metadata.
3. Validate wording with representative regional fixtures and accessibility review.
4. Establish the authoritative local-time source before presenting time-sensitive relevance.
5. Re-certify that quiet results render nothing and do not create empty containers or fallback copy.
6. Re-run protected-system isolation checks before any integration is approved.

Do not interpret historical relevance as a forecast, do not recommend routes, and do not expose report volume, confidence, scores, or historical metadata to consumers.
