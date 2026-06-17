# V448 — Historical Phrase Translation Prototype

## 1. Executive Summary

**Answer: LIMITED YES.**

Historical findings can be safely translated into awareness language only when translation is treated as a restricted prototype design activity and not as a new product behavior. The safe path is limited because historical findings can easily imply prediction, route guidance, timing expectations, reliability scoring, or raw history browsing if translated too directly.

A limited translation framework is acceptable when all of the following remain true:

- translated language describes **past observation only**;
- translation is performed through an allowlisted catalog, not open-ended generation;
- unsupported findings are suppressed rather than softened into misleading phrases;
- no historical reads, UI, dashboard, API, DriveTexas work, or production behavior changes are introduced;
- the V446-style safety pipeline remains the controlling authority for consumer-facing language.

This prototype therefore supports design exploration only. It does not authorize implementation or exposure of historical intelligence.

## 2. Translation Framework

### Proposed flow

```text
Historical Finding
↓
Classification
↓
Translation Candidate
↓
Safety Review
↓
Suppression Review
↓
Approved Awareness Phrase
```

### Flow design

1. **Historical Finding**
   - Internal, non-consumer historical signal or finding.
   - Not read from production history as part of this milestone.
   - Not displayed directly.

2. **Classification**
   - Assign the finding to a supported prototype category.
   - Classify as Safe, Conditional, or Not Supported.
   - Findings that cannot be classified cleanly are suppressed.

3. **Translation Candidate**
   - Convert the classified finding into a candidate phrase family.
   - Candidate text must use historical, observational framing.
   - Candidate text must avoid counts, timestamps, probabilities, durations, and route-action wording.

4. **Safety Review**
   - Review for prediction, forecasting, route guidance, navigation influence, reliability scoring, reputation scoring, raw history browsing, and timing implication.
   - Any future-oriented or action-oriented implication fails review.

5. **Suppression Review**
   - Determine whether the safest outcome is no phrase.
   - Suppression is required when translation would become vague, misleading, overly specific, or behavior-changing.

6. **Approved Awareness Phrase**
   - Final phrase must be allowlisted.
   - Final phrase must remain secondary awareness context.
   - Final phrase must not create a new dashboard, API response, UI surface, or route decision aid.

## 3. Finding Categories

| Finding category | Evaluation | Rationale |
|---|---|---|
| Historical Presence | Safe | Can be translated as prior observation if it avoids counts, dates, severity, and source reliability. |
| Recurrence Awareness | Conditional | Multiple prior observations may be useful, but direct recurrence language can imply likelihood or prediction. |
| Historical Resolution Awareness | Conditional | Resolution context is high risk because it can imply clearance timing, delay duration, or reassurance. |
| Activity Awareness | Conditional | Generic prior activity can be safe, but time windows, volume, and planning cues must be suppressed. |
| Historical Context Support | Safe | Broad contextual support can remain awareness-safe when phrased as limited past observation. |

## 4. Translation Examples

### Example 1

**Input:**

> Recurring reports detected

**Output:**

> Recurring reports have been observed here.

**Allowed?** Yes.

**Reason:** The output is past-tense and observational. It avoids counts, timing estimates, probabilities, forecasts, and route recommendations. It should still remain secondary and should not be paired with hotspot, likely, frequent, or avoid language.

### Example 2

**Input:**

> Usually clears in 1 hour

**Output:**

> Previous reports at this location have cleared after observed intervals.

**Allowed?** No.

**Reason:** Even though the output removes the exact one-hour claim, it still references clearance behavior and may imply that a current or future event has an expected resolution pattern. Historical resolution awareness is conditional at best and should be suppressed unless a future safety audit proves a non-actionable phrase can avoid timing expectations.

### Example 3

**Input:**

> Most reported between 6 PM and 8 PM

**Output:**

> Community activity has been observed here before.

**Allowed?** Yes, conditionally.

**Reason:** The output removes the time window and avoids planning guidance. It is only acceptable if the translation intentionally discards the time-pattern finding and reduces it to generic prior activity awareness. If the consumer context suggests commute planning, route choice, or timing decisions, it must be suppressed.

### Additional prototype examples

| Input finding | Candidate output | Allowed? | Reason |
|---|---|---:|---|
| Prior reports detected nearby | Previous community reports have been observed nearby. | Yes | Past observation only; no counts, timing, or route action. |
| 12 reports in the last 30 days | Community reports have occurred here before. | Conditional | Safe only if all raw count and recency detail are removed and the phrase does not imply frequency. |
| Confidence 84% recurrence | Repeated reports have been observed here. | No | Confidence and recurrence scoring create probability and prediction risk. |
| Avoid this road during storms | None; suppress. | No | Direct route guidance and future-condition implication. |
| Reporter reliability is high | None; suppress. | No | Reliability and reputation scoring are prohibited. |

## 5. Non-Translatable Findings

The following findings should always be suppressed:

- **Raw counts** — expose historical browsing behavior and can imply frequency or significance.
- **Timestamps and recency details** — expose raw history and may create planning cues.
- **Confidence percentages** — create probability language and prediction risk.
- **Reliability scores** — create source, location, or community reputation scoring.
- **Forecasts** — violate the past-observation boundary.
- **Route recommendations** — convert awareness context into navigation or route guidance.
- **Clearance durations** — imply timing estimates, expected delays, or reassurance.
- **Time-window patterns** — can influence departure timing or route decisions.
- **Hotspot labels** — create location reputation and future-likelihood implications.
- **Contributor counts** — expose raw history and may imply trust or credibility.
- **Severity rankings** — can become route-decision guidance or reputation scoring.
- **Comparative location claims** — can rank roads, neighborhoods, or routes by historical issues.

## 6. Translation Safety Rules

All translated historical-awareness phrases must follow these rules:

1. **Past observation only** — use only language that indicates something was observed before.
2. **No future implication** — avoid likely, expected, usually, typical, tends to, forecast, or may happen again.
3. **No route recommendation** — avoid avoid, take, reroute, safer route, best route, delay, detour, or navigation language.
4. **No probability language** — avoid confidence, percent, chance, risk score, likelihood, or certainty claims.
5. **No timing estimates** — avoid durations, clearance windows, peak hours, time of day, day of week, or commute-window claims.
6. **No count exposure** — avoid exact counts, approximate counts, contributor counts, incident totals, and report volumes.
7. **No reputation scoring** — avoid reliable, unreliable, chronic, hotspot, problem area, or trusted-source language.
8. **No raw history browsing** — do not expose event lists, timestamps, past reports, or drill-down details.
9. **No production behavior change** — design language only; do not alter runtime behavior.
10. **Suppress on ambiguity** — if a safe interpretation is not clear, emit no phrase.

## 7. Prototype Phrase Catalog

### APPROVED TRANSLATIONS

| Historical finding type | Approved awareness phrase |
|---|---|
| Historical Presence | Community reports have occurred here before. |
| Historical Presence | Previous community reports have been observed nearby. |
| Historical Context Support | Historical context is available only as general awareness. |
| Historical Context Support | Historical evidence is still limited. |
| Activity Awareness | Community activity has been observed here before. |

### CONDITIONAL TRANSLATIONS

| Historical finding type | Conditional awareness phrase | Condition |
|---|---|---|
| Recurrence Awareness | Recurring reports have been observed here. | Allowed only when not paired with frequency, likelihood, hotspot, or future wording. |
| Recurrence Awareness | Similar reports have been observed here before. | Allowed only as secondary context and without count or timing exposure. |
| Activity Awareness from time-pattern input | Community activity has been observed here before. | Allowed only after removing all time-window details. |
| Raw count reduced to presence | Community reports have occurred here before. | Allowed only when count, recency, and volume implications are fully discarded. |
| Low-evidence support | Historical evidence is still limited. | Allowed only when a caveat is safer than silence and does not invite interpretation as confidence scoring. |

### SUPPRESSED TRANSLATIONS

| Historical finding type | Suppression reason |
|---|---|
| Raw counts | Exposes history and implies frequency. |
| Timestamps or last-seen values | Exposes history and creates planning cues. |
| Confidence percentages | Creates probability and prediction language. |
| Reliability scores | Creates reputation scoring. |
| Forecasts | Violates past-observation-only boundary. |
| Route recommendations | Creates navigation guidance. |
| Clearance durations | Creates timing expectations. |
| Time-window patterns | Can influence travel timing. |
| Hotspot labels | Creates future-likelihood and location reputation risk. |
| Severity rankings | Creates route-decision and reputation risk. |

## 8. Adapter Integration Assessment

Translation should **not** occur before the V446 safety pipeline as an independent pre-processing step. Translating first would create unsafe intermediate consumer-like language before safety controls are applied.

Translation must occur **inside the safety pipeline** so that classification, candidate generation, prohibited-language checks, suppression review, surface eligibility, and audit enforcement are part of one controlled adapter process.

**Recommendation:** translation belongs inside the adapter safety pipeline, with audit enforcement before any phrase can be treated as approved awareness language.

## 9. Consumer Safety Assessment

| Risk | Assessment | Mitigation |
|---|---|---|
| Prediction risk | Medium to high if recurrence, timing, or clearance findings are translated directly. | Use past-observation language only; suppress timing, probabilities, and future implications. |
| Route-decision risk | Medium if phrases appear near route or alert surfaces. | Keep language secondary; prohibit avoid, reroute, delay, safer, best route, or navigation wording. |
| Misunderstanding risk | Medium because users may infer future likelihood from historical context. | Use generic awareness phrasing, avoid specificity, and suppress when the safe phrase would be too vague or misleading. |

## 10. Protected Boundary Validation

The prototype must preserve the following protected boundaries:

```text
historicalReadsEnabled: false
historyUiEnabled: false
historicalApiExposure: false
consumerFacingHistoryDashboard: false
DriveTexasPaused: true
```

Validation result: **PASS for design only**. This document does not authorize or implement reads, UI, API exposure, dashboards, DriveTexas work, or production behavior changes.

## 11. Recommended Architecture

**Recommendation: C — Translation + Safety Pipeline + Audit Enforcement.**

Architecture C is the safest option because it treats translation as a controlled adapter operation and requires an audit decision before any phrase can be approved. Direct translation is too risky because raw findings can become consumer-facing language. Translation plus safety pipeline is better, but without audit enforcement there is no durable proof that suppression rules, protected boundaries, and phrase allowlists were respected.

Architecture C should remain prototype-only until a separate milestone validates audit coverage and failure behavior.

## 12. Recommended Next Milestone

**Recommended milestone: V449 Historical Translation Safety Audit.**

This is the best next step because V448 identifies which finding types can be translated, which must be suppressed, and why. The next milestone should audit whether the proposed translation catalog and suppression rules can be enforced safely before any implementation is considered.

## 13. Merge Recommendation

**Merge recommendation: Merge as prototype documentation only.**

This milestone is safe to merge because it creates only a design document and does not modify application behavior, UI, APIs, historical reads, dashboards, Route Watch, DriveTexas, Awareness Brief, Community Pulse, or Alert Cards.

## 14. Testing

Required check:

```bash
node --check js/app.js
```

Expected result: syntax validation should pass because this milestone does not modify runtime JavaScript.
