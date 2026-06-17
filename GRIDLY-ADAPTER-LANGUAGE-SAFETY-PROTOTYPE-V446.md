# V446 — Adapter Language Safety Prototype

## 1. Executive Summary

**Answer: LIMITED YES.**

Gridly can safely support a larger historical-awareness phrase catalog through the Historical Awareness Adapter only if the adapter remains a strict safety translation layer rather than a historical-intelligence product surface. Expansion is acceptable as **prototype design only** when phrases are selected from an approved catalog, stripped of raw historical detail, suppressed on uncertainty, and audited for prediction, forecasting, route guidance, reliability scoring, reputation scoring, raw history browsing, count exposure, and timestamp exposure.

This milestone does **not** authorize implementation, production behavior changes, UI changes, historical reads, dashboards, APIs, Route Watch changes, Alert Card changes, Awareness Brief changes, Community Pulse changes, or DriveTexas work.

The safe posture remains:

1. **Awareness Platform First.** Historical language may add limited context to current awareness.
2. **Route Intelligence Second.** Historical language must not guide routes, imply delay expectations, or influence navigation decisions.
3. **Adapter-Controlled Only.** Historical findings must never become consumer language unless they pass adapter classification, suppression, phrase translation, and audit gates.

## 2. Current Adapter Review

### Current approved surfaces

Current adapter-approved historical-awareness language is limited to existing awareness surfaces:

- **Awareness Brief** — permitted only as short, secondary context.
- **Community Pulse** — permitted only as low-emphasis community-awareness context.
- **Alert Cards** — permitted only when subordinate to current alert content and not elevated into route guidance.

No surface is approved for historical browsing, history drill-down, historical dashboards, raw counts, timestamps, reliability scoring, or route recommendations.

### Current approved phrases

The current approved phrase set remains intentionally small:

| Phrase | Status | Safety rationale |
|---|---|---|
| “Community reports have occurred here before.” | Approved | Past observation only; no count, timestamp, forecast, or route instruction. |
| “Repeated reports have been observed here.” | Approved | Prior repeated observation; avoids future likelihood and exact volume. |
| “Previous community reports have been observed nearby.” | Approved | Nearby historical context without raw location history. |
| “Historical evidence is still limited.” | Approved caveat | Low-evidence caveat that reduces overconfidence. |

V445 also identified additional phrases that may be safe for future adapter study, but those phrases are not production-authorized by this prototype.

### Current suppression behavior

Current governance expects suppression when historical language would create any of the following risks:

- prediction or future-likelihood implication;
- forecast or clearance-time implication;
- route guidance, rerouting advice, or navigation influence;
- reliability, confidence, trust, or reputation scoring;
- raw history browsing through counts, timestamps, contributor counts, or drill-down language;
- unsupported finding category;
- insufficient evidence for a safe awareness statement.

### Current low-evidence handling

The current low-evidence model is suppression-first. When evidence is insufficient for a safe historical-awareness phrase, the adapter should either suppress historical language entirely or use the approved caveat:

> Historical evidence is still limited.

The caveat must not be paired with raw history, counts, timestamps, confidence percentages, or route-action language.

### Current audit coverage

Current audit expectations are governance-oriented rather than a new production API. Existing safety reviews have covered:

- approved surfaces;
- approved and prohibited phrases;
- low-evidence caveats;
- suppression expectations;
- protected boundaries around historical reads, UI, API exposure, dashboards, and DriveTexas pause state.

This V446 design proposes a future audit shape but does not implement it.

## 3. Proposed Safety Pipeline

### Recommended architecture

A future adapter language pipeline should be a closed, deterministic, allowlist-first translation system. Historical findings would enter the adapter as internal candidates, not as display text. The adapter would classify, suppress, translate, and audit candidates before any consumer surface could receive a phrase.

The recommended conceptual pipeline is:

1. **Historical finding generated**
   - Internal finding exists in shadow or governed input form.
   - No consumer text is produced at this stage.

2. **Finding classification**
   - Finding is classified into an approved safety category such as Historical Presence or Historical Context Support.
   - Unsupported categories are suppressed.

3. **Phrase eligibility review**
   - Candidate category is mapped to an allowlisted phrase family.
   - Free-form language is not permitted.

4. **Low-evidence evaluation**
   - Evidence state is classified as display, caveat, or suppress.
   - Low evidence defaults to suppression unless the caveat is safer.

5. **Prohibited-language scan**
   - Candidate text and source labels are scanned for prohibited words and concepts such as usually, likely, expect, best route, confidence, score, frequent, hotspot, and last reported.

6. **Prediction-risk scan**
   - Candidate is checked for future-likelihood, recurrence-as-forecast, clearance expectation, or time-window planning cues.

7. **Route-decision-risk scan**
   - Candidate is checked for avoid, reroute, delay expectation, route preference, navigation confidence, or current-action implication.

8. **Approved phrase translation**
   - Candidate is translated into an approved, past-tense, low-specificity phrase.
   - If no approved translation exists, suppress.

9. **Surface eligibility review**
   - Phrase is checked against the destination surface.
   - The same phrase may be allowed on Awareness Brief but conditional on Alert Cards depending on prominence and context.

10. **Audit validation**
    - Final output is recorded as approved or suppressed with reason codes.
    - Protected boundary state is validated before any surface can consume the language.

### Pipeline design principles

- The adapter owns consumer language safety.
- Historical findings are never rendered directly.
- Phrase output is allowlist-based, not generative free text.
- Suppression is a successful safety outcome.
- Low evidence must reduce language, not increase caveats or explanations.
- Every emitted phrase must have an audit trail and a suppression alternative.

## 4. Historical Finding Classification Model

### Category model

| Category | Definition | Classification | Safe output posture |
|---|---|---|---|
| Historical Presence | Prior community reports or activity existed at or near a location. | Safe | Past-observation phrase only. |
| Recurrence Awareness | Multiple similar reports were observed historically. | Conditional | Must be softened; no future likelihood, frequency label, or hotspot language. |
| Historical Resolution Awareness | Past reports included resolution or clearance-related signals. | Conditional / generally not recommended | Suppress by default; avoid duration, ETA, waiting advice, and reassurance. |
| Historical Context Support | Historical evidence adds non-actionable context to current awareness. | Safe / conditional | Context-only phrase or low-evidence caveat. |
| Activity Awareness | Prior community activity was observed in a broad area. | Safe if generic | No time windows, counts, or planning cues. |
| Time-Pattern Findings | Historical concentration around hours, days, seasons, or commute windows. | Prohibited in direct form | Suppress or reduce to generic activity awareness only after review. |
| Duration / Delay Findings | Historical delay length, clear time, or typical duration. | Prohibited in direct form | Suppress; do not translate into route expectations. |
| Count / Recency Findings | Exact counts, contributor counts, last-reported dates, or raw history facts. | Prohibited in direct form | Suppress or remove all raw detail before any generic translation. |
| Reliability / Reputation Findings | Claims about location, route, source, reporter, or community reliability. | Prohibited | Always suppress. |
| Navigation / Route Findings | Claims advising route choice or avoidance. | Prohibited | Always suppress. |

### Classification outcomes

- **Safe** — eligible for approved phrase translation if evidence and surface checks pass.
- **Conditional** — eligible only after stricter review, lower visual prominence, and stronger suppression checks.
- **Prohibited** — never eligible for consumer historical-awareness language.

## 5. Approved Phrase Generation Model

Future phrase generation should be better described as **approved phrase translation**. The adapter should not generate open-ended language. It should translate classified findings into approved phrases from a controlled catalog.

### Translation examples

| Internal input | Approved output | Disallowed output |
|---|---|---|
| Prior reports detected | “Community reports have occurred here before.” | “This road has a history of problems.” |
| Repeated similar reports detected | “Similar community reports have been observed here before.” | “This issue is likely to happen again.” |
| Nearby prior reports detected | “Previous community reports have been observed nearby.” | “Avoid this area because reports happen nearby.” |
| Limited evidence | “Historical evidence is still limited.” | “Confidence is low because only 2 reports exist.” |
| Time-window cluster detected | Suppress or translate only to generic activity after review. | “Most reports happen during evening commute.” |
| Duration pattern detected | Suppress. | “Usually clears in 1 hour.” |

### Translation principles

1. Use past-tense observation language.
2. Prefer “community reports” over authoritative-sounding source labels.
3. Remove exact counts, timestamps, contributor counts, durations, and scores.
4. Remove future, likely, usually, typical, forecast, expect, and route-action language.
5. Avoid labels that create location reputation, such as hotspot, frequent issue area, or unreliable crossing.
6. Keep historical language secondary to current awareness.
7. Suppress if the safe translation would become too vague, misleading, or overbroad.

## 6. Suppression Model

### Suppression triggers

Suppress historical-awareness language when any of the following are true:

- evidence is low and a caveat would not materially improve understanding;
- candidate contains prohibited language;
- candidate implies prediction, forecasting, likelihood, clearance timing, or future recurrence;
- candidate could influence route decisions, navigation, avoidance, or waiting behavior;
- candidate exposes raw counts, timestamps, contributor counts, or last-reported information;
- category is unsupported or prohibited;
- classification confidence is insufficient;
- surface prominence is too high for secondary historical context;
- protected boundaries are not intact;
- audit validation cannot produce a clear approved or suppressed outcome.

### Recommended suppression hierarchy

1. **Protected boundary failure** — suppress all historical language.
2. **Prohibited category** — suppress.
3. **Prohibited language detected** — suppress.
4. **Prediction or forecast risk** — suppress.
5. **Route-decision risk** — suppress.
6. **Raw history exposure risk** — suppress.
7. **Reliability or reputation risk** — suppress.
8. **Low evidence** — suppress or show the required caveat only if caveat is safer.
9. **Surface ineligibility** — suppress for that surface.
10. **Audit uncertainty** — suppress.

Suppression should be treated as an intended safe state, not as an error.

## 7. Low-Evidence Framework

The required caveat remains:

**Historical evidence is still limited.**

### Evidence states

| Evidence state | Recommended action | Rationale |
|---|---|---|
| Sufficient evidence, safe category, safe phrase | Display approved phrase | Historical context may support awareness. |
| Moderate evidence with uncertainty | Display approved phrase only if paired with low visual emphasis; otherwise caveat | Prevents overclaiming. |
| Low evidence but awareness value remains | Use required caveat | Communicates uncertainty without raw details. |
| Very low evidence | Suppress | Avoids manufacturing significance. |
| Conflicting evidence | Suppress | Avoids false confidence. |
| Evidence depends on counts or timestamps to be understandable | Suppress | Avoids raw history browsing and false precision. |
| Evidence supports only route, duration, or forecast inference | Suppress | Outside awareness boundary. |

### Display / caveat / suppress rules

- **Display** only when the finding is safe, evidence is adequate, and the phrase is allowlisted.
- **Caveat** only when uncertainty itself is useful and the caveat does not invite raw history interpretation.
- **Suppress** when evidence is too weak, too specific, too route-relevant, too predictive, or too dependent on hidden historical details.

## 8. Safety Scan Prototype

The future safety audit should include conceptual scans before display and after phrase selection.

| Scan | Conceptual operation |
|---|---|
| Raw History Scan | Detects counts, timestamps, contributor counts, last-reported language, drill-down references, and history-dashboard implications. |
| Prediction Scan | Detects likely, recurring-as-future, risk will, expected, likely to happen again, and similar future-likelihood language. |
| Forecast Scan | Detects ETA, duration, clear-time, typical delay, usually clears, time-window, and schedule-like framing. |
| Route Guidance Scan | Detects avoid, take, reroute, best route, alternate route, proceed, wait, delay expectation, or navigation instruction. |
| Reliability Scoring Scan | Detects confidence percentages, reliability scores, source trust, verified ranking, and authority weighting. |
| Reputation Scan | Detects location reputation, hotspot, frequent issue area, bad route, unreliable crossing, or community reputation framing. |
| Count Exposure Scan | Detects exact or implied volumes such as 12 reports, many users, most reports, or repeated quantified references. |
| Timestamp Exposure Scan | Detects last reported, first reported, date ranges, time of day clusters, and recency cues. |
| Surface Prominence Scan | Detects whether the phrase would be visually or semantically elevated above current awareness. |
| Low-Evidence Scan | Confirms whether display, caveat, or suppression is warranted. |
| Protected Boundary Scan | Confirms historical reads, UI, APIs, dashboards, and DriveTexas boundaries remain unchanged. |

No scan is implemented by this milestone.

## 9. Surface Eligibility Framework

| Surface | Eligibility | Finding |
|---|---|---|
| Awareness Brief | Allowed | Best fit for one short, secondary phrase when all safety gates pass. |
| Community Pulse | Allowed / conditional | Safe for broad community-awareness context; must avoid turning pulse into history browsing or trend analytics. |
| Alert Cards | Conditional | Higher risk because cards can influence user action; historical language must remain subordinate and non-route-guiding. |
| Future awareness surfaces | Conditional | May be eligible only if designed as awareness-first, non-navigational, non-dashboard surfaces. |
| Route Watch or navigation surfaces | Not recommended | Historical language could become route guidance or route-decision support. |
| Historical dashboard or raw history browser | Not recommended / prohibited | Violates containment boundary and raw history browsing prohibition. |

## 10. Audit Prototype Design

A future browser-audit shape could be designed as:

```js
window.gridlyHistoricalLanguageSafetyAudit?.()
```

This is design-only and must not be implemented in this milestone.

### Prototype output categories

| Field | Meaning |
|---|---|
| `approvedPhrase` | Final allowlisted phrase selected for display, if any. |
| `suppressedPhrase` | Candidate phrase suppressed before display, if tracked in audit-only context. |
| `suppressionReason` | Reason code such as `LOW_EVIDENCE`, `PREDICTION_RISK`, `ROUTE_DECISION_RISK`, or `PROHIBITED_LANGUAGE`. |
| `predictionRisk` | Boolean or enum describing whether future-likelihood risk was detected. |
| `routeDecisionRisk` | Boolean or enum describing whether route-action risk was detected. |
| `lowEvidenceState` | `DISPLAY`, `CAVEAT`, or `SUPPRESS`. |
| `surfaceEligibility` | Surface-level status such as `ALLOWED`, `CONDITIONAL`, or `NOT_RECOMMENDED`. |
| `protectedBoundaryStatus` | Confirms historical reads, UI, API exposure, dashboards, and DriveTexas state remain protected. |
| `rawHistoryExposure` | Indicates count, timestamp, contributor, or drill-down exposure risk. |
| `reputationRisk` | Indicates reliability, confidence, or location/source reputation risk. |
| `auditDecision` | Final `APPROVED` or `SUPPRESSED` decision. |

### Audit requirements

- Must be read-only.
- Must not expose raw historical records.
- Must not expose counts or timestamps to consumers.
- Must validate suppression reasons as first-class outcomes.
- Must fail closed if protected boundaries are not intact.

## 11. Consumer Safety Assessment

| Risk | Assessment | Mitigation in prototype model |
|---|---|---|
| Prediction risk | Medium without controls; low with allowlisted past-tense phrases. | Prediction and forecast scans; suppress future-likelihood language. |
| Route-decision risk | Medium on prominent or action-oriented surfaces. | Surface eligibility, route-decision scan, no route verbs, no delay expectations. |
| Trust risk | Medium if phrases imply authority, confidence, or reliability. | No scores, confidence, source ranking, or reputation language. |
| Misunderstanding risk | Medium for recurrence and resolution language. | Prefer generic historical presence; suppress resolution and time-window details. |
| Raw history browsing risk | High if counts/timestamps appear. | Count and timestamp scans; no dashboard or API exposure. |

The prototype model is safe only because it narrows language, suppresses uncertain outputs, and treats historical intelligence as contextual awareness rather than decision authority.

## 12. Protected Boundary Validation

The following boundaries must remain unchanged:

```js
historicalReadsEnabled: false
historyUiEnabled: false
historicalApiExposure: false
consumerFacingHistoryDashboard: false
DriveTexasPaused: true
```

Any future adapter-language milestone must fail closed if these values are not preserved.

## 13. Recommended Architecture

### Options

| Architecture | Description | Assessment |
|---|---|---|
| Architecture A — Minimal phrase expansion | Keep only current phrase set with minor audit refinements. | Safest but may underuse approved awareness context. |
| Architecture B — Controlled adapter expansion | Expand only through allowlisted phrases, suppression hierarchy, surface eligibility, and audit checks. | Recommended balance of awareness value and safety. |
| Architecture C — Broad awareness-language expansion | Larger catalog with broader categories and more varied language. | Not recommended; increases prediction, trust, and route-decision risk. |

### Recommendation

**Recommend Architecture B — Controlled adapter expansion.**

Architecture B best matches V445’s LIMITED YES conclusion. It permits carefully governed historical-awareness language while preserving Gridly’s protected boundaries and avoiding production behavior changes in this prototype. It treats phrase expansion as a controlled adapter function, not as a UI feature, API feature, dashboard, route product, or history browser.

## 14. Recommended Next Milestone

**Recommended next milestone: V447 Historical Language Audit Prototype.**

This is the most appropriate next step because the safety framework should be auditable before any phrase catalog expansion is prototyped. An audit prototype can validate suppression reasons, prediction-risk detection, route-decision-risk detection, low-evidence state, surface eligibility, and protected boundary status without exposing new historical language to users.

## Required Output Summary

### 1. Quick Summary

Gridly can support a larger historical-awareness phrase catalog only as a **LIMITED YES** through the Historical Awareness Adapter. The adapter must use approved phrases, suppression-first behavior, low-evidence caveats, safety scans, and audit validation. This milestone is design-only and introduces no behavior or UI changes.

### 2. Safety Pipeline Design

The proposed pipeline is: finding generated → classification → phrase eligibility → low-evidence evaluation → prohibited-language scan → prediction-risk scan → route-decision-risk scan → approved phrase translation → surface eligibility → audit validation.

### 3. Classification Model

Safe categories include Historical Presence and generic Activity Awareness. Conditional categories include Recurrence Awareness, Historical Resolution Awareness, and Historical Context Support. Prohibited direct categories include time-pattern findings, duration findings, count/recency findings, reliability/reputation findings, and navigation/route findings.

### 4. Suppression Model

Suppress on protected boundary failure, prohibited category, prohibited language, prediction risk, route-decision risk, raw history exposure, reputation risk, low evidence, surface ineligibility, or audit uncertainty.

### 5. Low-Evidence Framework

Use the required caveat — **Historical evidence is still limited.** — only when it is safer than silence and helpful for awareness. Otherwise suppress.

### 6. Safety Scan Design

Future scans should cover raw history, prediction, forecast, route guidance, reliability scoring, reputation, count exposure, timestamp exposure, surface prominence, low evidence, and protected boundaries.

### 7. Surface Eligibility Findings

Awareness Brief is allowed. Community Pulse is allowed/conditional. Alert Cards are conditional. Future awareness surfaces are conditional. Route Watch, navigation surfaces, dashboards, and raw history browsers are not recommended or prohibited.

### 8. Architecture Recommendation

Recommend **Architecture B — Controlled adapter expansion** because it provides limited awareness value while preserving suppression-first safety and protected boundaries.

### 9. Recommended Next Milestone

Recommend **V447 Historical Language Audit Prototype**.

### 10. Merge Recommendation

**Recommend merge.** This document is a design-only safety prototype. It does not implement phrase generation, alter adapter behavior, modify UI, expose historical reads, expose dashboards, expose APIs, modify Route Watch, restart DriveTexas, or alter Awareness Brief, Community Pulse, or Alert Cards.

### 11. Testing

Required validation:

- `node --check js/app.js`
- Documentation validation by reviewing this markdown for required sections, explicit non-goals, protected boundaries, and design-only scope.
