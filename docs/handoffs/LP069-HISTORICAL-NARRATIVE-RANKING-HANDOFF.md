# LP069 — Historical Narrative Ranking Handoff

## 1. Executive Summary

LP069 adds an internal-only arbitration layer after LP067 relevance evaluation and LP068 narrative generation. It constructs comparable candidates, excludes candidates that fail confidence, geography, time, specificity, or usefulness governance, semantically suppresses duplicate behavior, and deterministically selects no more than one primary historical takeaway. When nothing deserves attention, the layer returns a structured quiet result with no filler wording.

The implementation is additive and is not imported by `index.html` or any production application runtime. Its result contract explicitly reports `productionIntegration: false` and `consumerVisible: false`.

## 2. Ranking Architecture

The isolated certification flow is:

1. LP067 normalizes observations, discovers patterns, qualifies confidence, and evaluates present-context relevance.
2. LP068 creates a historical, consumer-friendly narrative record for each independently relevant pattern.
3. `buildCandidate` joins the LP067 pattern and LP068 record into a frozen candidate containing identity, subject/place/event evidence, historical window, relevance reason, live-condition guidance, and internal factor values.
4. `selectPrimary` constructs all candidates, applies eligibility governance, sorts eligible candidates, suppresses overlaps, evaluates weak ambiguity, and returns either one `selected` result or one explicit `quiet` result.

Selection never modifies LP067 confidence/freshness logic or LP068 wording. Ranking metadata is retained for certification and debugging but is not embedded in narrative prose.

## 3. Ranking Factors and Tie-Breaking Order

Eligibility requires meaningful-or-better confidence, compatible awareness-area/community geography, compatible weekday/weekend and 90-minute present-time context, a named subject, and the minimum deterministic usefulness score.

Eligible candidates use this stable descending comparison order:

1. Relevance quality (a combined exact-place and present-time measure).
2. Subject specificity (crossing, roadway, community, then broad area/county).
3. Geographic match quality (exact crossing, exact roadway, area/community, county).
4. Temporal match quality (within 30, 60, or 90 minutes in the matching day class).
5. Confidence category.
6. Historical consistency across distinct observations/dates.
7. Supporting-data freshness (30, 180, and 365-day bands).
8. Supported duration quality.
9. Lexicographically ascending canonical identifier.

The final identifier comparison makes exact ties repeatable without randomness or dependence on input ordering. The usefulness score supports only minimum-governance and weak-ambiguity decisions; it does not replace the documented lexicographic tie-breaking order.

## 4. Duplicate-Resolution Approach

Duplicate resolution never compares narrative strings. Candidates overlap when they share an explicit underlying-behavior identity or pattern identity. They can also overlap when they share event family, community/awareness-area/county, and a compatible named place; a generic place may be absorbed by the stronger specific representation of that same behavior.

Candidates are sorted before grouping, so the strongest and most specific candidate becomes canonical. Every suppressed candidate is recorded internally with its canonical identifier, retained identifier, and `duplicate_or_overlapping_behavior` reason. Different event families remain independently eligible even when they occur in the same community.

## 5. Quiet-State Governance

The result is quiet when there are no constructible candidates, no meaningful candidates, no geographic or temporal compatibility, emerging/insufficient confidence only, subjects are too vague, the minimum usefulness threshold is not met, or weak near-tied competition cannot justify primary attention. Quiet results contain `selectedNarrative: null` and `selectedCandidate: null`; they never manufacture fallback copy.

Selected wording remains the unchanged LP068 historical narrative and retains “Check current alerts for live conditions.” LP069 does not predict, forecast, state probability, claim a live condition, recommend a route, command avoidance, or alter narrative wording.

## 6. Browser Certification Instructions

1. From the repository root, run `python3 -m http.server 4173`.
2. Open `http://localhost:4173/tests/lp069-browser-certification.html` in a current browser.
3. Confirm all ten rows report **PASS** and `<body>` has `data-certification="pass"`.
4. Inspect `window.__LP069_CERTIFICATION__` and confirm `passed === true`, `winner.status === "selected"`, `quiet.status === "quiet"`, and duplicate suppressions are present.
5. In the Network panel, confirm the page loads only the certification document plus LP067, LP068, and LP069 scripts. It must not load `index.html`, `app.js`, production providers, or synchronization code.
6. Run `npm run test:lp069`, followed by LP061–LP068 regression certifications.

The page reports candidate construction, deterministic ranking, current-relevance priority, subject-specificity priority, duplicate suppression, quiet governance, the one-primary contract, explainability, non-predictive wording, and runtime isolation.

## 7. Protected-System Confirmation

LP069 does not reference or modify Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase synchronization, Community Pulse, Travel Brief, Destination Intelligence, Unified Evidence, existing confidence/freshness calculations, LP067 behavior, or LP068 wording. `index.html` has no LP069 reference. No production UI or consumer presentation has been added.

- `productionIntegration: false`
- `consumerVisible: false`

## 8. Merge Recommendation

**Recommend merge** after the LP069 automated certification, LP061–LP068 regressions, and one supported-browser run of the standalone page pass. The milestone meets the internal single-takeaway/quiet-state contract while preserving production isolation.

## 9. Recommended Next Milestone

The next milestone should certify a presentation-safe activation boundary without activating it: define an allowlisted DTO that contains only the selected historical narrative and required non-predictive guidance, specify authorized consumer ownership, validate local-time authority and accessibility, and establish telemetry-free quiet rendering. Any eventual production integration should require a separate explicit approval and re-certification of protected systems.

## Updated Next-Chat Handoff

Begin with LP067 relevance, LP068 narration, this ranking contract, and the standalone LP069 certification. Treat all three modules as inactive internal capabilities. Do not import them into production. Preserve deterministic ranking, semantic duplicate suppression, the one-or-zero result invariant, current-alert authority, and historical-only wording. Before any activation proposal, re-run LP061–LP069 and demonstrate that quiet creates no wording or empty consumer container.
