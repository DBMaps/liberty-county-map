# V441 — Historical Intelligence Surface Governance Policy

## 1. Purpose

Gridly remains **Awareness Platform First** and **Route Intelligence Second**.

Historical Intelligence may support Gridly only as a secondary awareness signal that helps users understand whether community-reported conditions have been observed before. It must not become prediction, forecasting, scoring, reputation, raw history browsing, route-decision authority, or a consumer history archive.

This policy governs the historical-intelligence language and surfaces discovered in V440. V441 is documentation-only and audit-only: it does not modify production behavior, UI, APIs, historical reads, dashboards, DriveTexas posture, Route Watch behavior, Supabase permissions, or passive capture behavior.

Historical Intelligence is allowed to support the awareness experience only when it:

- is framed as context about past community observations, not a forecast;
- is secondary to current awareness, current reports, and current route intelligence;
- suppresses raw historical rows, raw timestamps, source metadata, event counts, user scoring, and confidence percentages;
- avoids route instructions, predictions, rankings, or reliability judgments;
- handles low-evidence situations by suppressing historical language or using the approved caveat: **“Historical evidence is still limited.”**

## 2. Surface Classes

### Surface-class definitions

| Class | Meaning | Consumer visibility posture | Required governance posture |
|---|---|---|---|
| Approved Awareness Support Surface | A limited, adapter-controlled secondary historical context line that supports an existing awareness surface without exposing raw history or prediction. | Allowed only in the existing approved surface and only after safe-display validation. | Must remain adapter-sourced, non-predictive, low-claim, and suppress unsafe language. |
| Internal Diagnostic Surface | Browser-callable, script-backed, or audit-only tooling used to inspect readiness, safety, output validation, storage quality, projection state, or protected boundaries. | Not a consumer feature. | Must not be promoted into normal UI or treated as consumer-safe output. |
| Experimental Surface | A prepared, shadow, canary, or exploratory system that may help future validation but is not approved as consumer historical exposure. | Not approved for normal consumer expansion. | Must remain guarded, reversible, non-authoritative, and subject to future approval. |
| Not Approved for Consumer Expansion | A surface or output path that exists but is outside the approved Historical Awareness Adapter safe-display model. | Must not be expanded, promoted, renamed, or highlighted for consumers without a future safety milestone. | Requires explicit ownership, language, data-source, and visual hierarchy review before any beta or consumer release. |
| Future Review Required | A surface class with incomplete visibility, ownership, or map/layer exposure certainty. | No new consumer exposure until resolved. | Requires a focused audit before changes. |

### Classification of discovered historical surfaces

| Surface | V441 classification | Policy decision | Rationale |
|---|---|---|---|
| Awareness Brief historical context | Approved Awareness Support Surface | Allowed to remain as the existing limited secondary historical line when sourced and validated by the Historical Awareness Adapter. | V440 identified the Awareness Brief path as V439-approved adapter-controlled safe display. |
| Community Pulse historical context | Approved Awareness Support Surface | Allowed to remain as the existing limited secondary historical line when sourced and validated by the Historical Awareness Adapter. | V440 identified Community Pulse as an adapter-controlled, safe-display consumer support surface. |
| Alert Cards historical context | Approved Awareness Support Surface | Allowed to remain as existing limited secondary context only when adapter validation passes. | V440 identified Alert Cards as part of the approved adapter-controlled safe-display set. |
| Historical Intelligence Sheet | Not Approved for Consumer Expansion | Allowed to remain as-is for V441 only because this milestone changes no behavior; not approved for beta promotion, visual emphasis, language expansion, or consumer positioning until a future safety audit. | V440 found the sheet is not owned by the Historical Awareness Adapter and can include richer pattern language such as “Most reported,” “Usually clears,” and “Last reported.” |
| Historical Projection Systems | Internal Diagnostic Surface / Experimental Surface | Must remain shadow, diagnostic, and non-authoritative. Not approved as a consumer surface or production truth source. | Projection helpers and audits are useful for validation but must not become forecasts or route predictions. |
| Historical audits/debug helpers | Internal Diagnostic Surface | May remain browser-callable for internal validation but must not be treated as consumer UI, dashboards, APIs, or public history browsing. | V440 found multiple audit helpers for adapter output, projection, canary, writer, passive capture, historical intelligence, and final render readiness. |
| Historical map/layer references | Future Review Required | No expansion or consumer messaging until a focused map/layer historical exposure audit resolves ownership and visibility. | V440 found references but did not validate direct visible historical map-layer behavior. |

## 3. Language Classes

Historical language must preserve Gridly’s awareness-first posture. Language may describe observed community-report history only when it is adapter-controlled, low-claim, and non-predictive.

### Allowed language

The following language is approved for safe awareness support when evidence and adapter validation allow it:

- “Repeated reports have been observed here.”
- “Community reports have occurred here before.”
- “Historical evidence is still limited.”

Allowed language properties:

- describes past observations only;
- does not imply a future event, future delay, future duration, or current route risk;
- avoids raw counts, timestamps, source metadata, database details, confidence percentages, and user scoring;
- keeps historical context secondary to current awareness.

### Conditional language / requires review

The following language is not automatically prohibited, but requires explicit review before consumer use because it may imply recurrence strength, time-window prediction, or clearance timing:

- “Recurring reports have been observed at this location.”
- “Reports have often appeared during this part of the day.”
- “Previous reports at this location have cleared after observed intervals.”

Conditional language may be considered only if all of the following are true:

1. it is adapter-sourced or passed through an adapter-equivalent safe-language gate;
2. it does not include exact event counts, raw timestamps, confidence percentages, source metadata, or database details;
3. it is not phrased as a prediction, expectation, recommendation, route instruction, or reliability judgment;
4. low-evidence handling either suppresses the line or includes the approved caveat;
5. visual hierarchy makes the line secondary to current conditions.

### Prohibited language

The following language and concepts are prohibited for consumer-visible historical intelligence:

- “Expect delays after 6 PM.”
- “This will likely clear in 1 hour.”
- “Forecasted risk is elevated.”
- “This location is unreliable.”
- “User reliability score.”
- “Confidence percentage.”
- “Event count history.”
- “Raw timestamps.”
- “Database/source metadata.”

Prohibited language categories include:

- predictions, forecasts, future likelihood, or expected delay language;
- clearance-time promises or implied ETA language;
- route risk, route ranking, route recommendation, or route-decision authority;
- location reputation or reliability judgments;
- user reputation, reporter scoring, or source reliability scoring;
- confidence percentages, numeric scoring, exact historical counts, raw timestamps, raw rows, database names, table names, schema names, source metadata, or storage metadata;
- dashboard-like history browsing or drill-down language.

## 4. Historical Intelligence Sheet Governance

V440 found that the Historical Intelligence Sheet is an existing historical intelligence exploration surface in the production bundle, registered through the Portrait V2 bottom dock sheet registry as `history` and rendered by `buildGridlyHistoricalIntelligenceSheetHtml`.

V441 classifies the Historical Intelligence Sheet as follows:

| Governance question | V441 decision |
|---|---|
| Is it existing historical intelligence exploration? | Yes. It is an existing Historical Intelligence Sheet / legacy consumer sheet system discovered in V440. |
| Is it adapter-controlled or engine-controlled? | It is not adapter-controlled. It is generated by in-app Historical Intelligence Sheet builders using local historical-intelligence storage snapshots and findings from the engine-style builder path. |
| Is it consumer-ready? | No. It is not classified as consumer-ready historical exposure under V441. |
| Is it allowed to remain as-is? | Yes, for V441 only, because this milestone is documentation-only and requires no behavior changes. This is not an approval to expand, promote, rename, expose, or visually emphasize it. |
| Does it require future review before beta? | Yes. It requires future visual, language, ownership, data-source, and low-evidence review before any beta positioning or consumer expansion. |

The Historical Intelligence Sheet must not be used as a precedent for expanding consumer historical intelligence. Before beta consideration, the sheet must pass a dedicated safety audit covering:

- adapter-sourced or adapter-equivalent output governance;
- removal or suppression of “Most reported,” “Typical delay,” “Usually clears,” “Last reported,” raw count, and raw timestamp patterns unless explicitly approved;
- prediction-language suppression;
- low-evidence suppression or the approved caveat;
- visual hierarchy review to ensure awareness support rather than dashboard behavior;
- browser audit of reachable states.

No behavior is changed by this policy.

## 5. Low-Evidence Rules

Historical Intelligence must default to silence when evidence is insufficient or when the available evidence would require overclaiming.

### Suppress historical language when

- evidence is too sparse to support a safe awareness-support line;
- the only available output would require raw counts, raw timestamps, event history, source metadata, confidence percentages, or scoring;
- the output would imply prediction, forecast, expected delay, likely clearing time, location reputation, or route reliability;
- the surface is not adapter-controlled or has not passed an adapter-equivalent safety gate;
- the surface is a diagnostic, projection, canary, writer, or debug helper being viewed outside an approved consumer context;
- current context cannot clearly distinguish historical observation from live condition.

### Caveat historical language when

A limited awareness-support line may be shown with the required safe caveat when evidence exists but is not strong enough for stronger wording:

> Historical evidence is still limited.

Use the caveat only as secondary context. Do not pair it with raw event history, exact counts, raw timestamps, confidence percentages, source metadata, or prediction language.

### Historical language is not allowed when

- historical reads would need to be enabled;
- a UI would become a raw history browser, dashboard, or archive;
- historical output would affect route ranking, route instructions, Route Watch behavior, alert prioritization, user trust scoring, or location reputation;
- DriveTexas work would need to restart;
- Supabase permissions, passive capture, or API exposure would need to change;
- protected boundaries cannot be verified as intact.

## 6. Protected Boundaries

The following boundaries must remain unchanged:

```text
historicalReadsEnabled: false
historyUiEnabled: false
historicalApiExposure: false
consumerFacingHistoryDashboard: false
DriveTexasPaused: true
```

These boundaries mean V441 does not authorize historical reads, new history UI, history APIs, consumer-facing history dashboards, DriveTexas work, Route Watch changes, Supabase permission changes, or passive capture behavior changes.

## 7. Future Expansion Gates

Before any new historical surface becomes consumer-visible, all of the following gates are required:

1. **Adapter-sourced output** — output must come from the Historical Awareness Adapter or an explicitly approved adapter-equivalent safety layer.
2. **Safe-language scan** — allowed, conditional, and prohibited language must be checked before release.
3. **Raw-history suppression** — raw rows, exact event histories, event counts, timestamps, source metadata, database/schema/table details, and storage metadata must be suppressed.
4. **Prediction-language suppression** — forecasts, expected delays, likely clearance times, risk scoring, route recommendations, and reliability claims must be suppressed.
5. **Low-evidence handling** — insufficient evidence must suppress historical language or use the approved caveat.
6. **Visual hierarchy review** — historical context must remain secondary to current awareness and must not look like a dashboard, scorecard, reputation system, or decision authority.
7. **Browser audit** — visible states must be audited in browser-accessible flows, including empty, low-evidence, normal, and unsafe-language cases.
8. **Regression tests for Awareness Brief, Community Pulse, and Alert Cards** — approved existing surfaces must retain safe adapter behavior and must not regress when new surfaces are introduced.

No expansion may skip these gates because the Historical Intelligence Sheet or diagnostics already exist in the bundle.

## 8. Recommended Next Milestone

Recommended next milestone: **V442 Historical Intelligence Sheet Safety Audit**.

Rationale:

- V440 identified the Historical Intelligence Sheet as the main unresolved potentially consumer-accessible historical surface.
- V441 classifies the sheet as not consumer-ready and not adapter-controlled while allowing it to remain unchanged for this documentation-only milestone.
- The highest-value next step is a focused audit of the sheet’s ownership, reachable UI states, visual hierarchy, low-evidence behavior, and language safety before any beta or expansion decision.

Alternative future milestones remain possible after the sheet safety audit:

- **V442 Historical Adapter Coverage Expansion** — appropriate only after sheet safety questions are resolved or explicitly deferred.
- **V442 Historical Beta Readiness Review** — premature until the sheet and any unresolved historical map/layer references pass focused review.

## Explicit Non-Goals

V441 does not:

- modify app behavior;
- modify UI;
- enable historical reads;
- expose raw history;
- create dashboards;
- create APIs;
- change Route Watch;
- restart DriveTexas;
- change Supabase permissions;
- change passive capture.

## Merge Recommendation

Merge V441 as a documentation-only governance policy.

This policy formalizes the historical-intelligence surface classes, language classes, protected boundaries, low-evidence rules, and future expansion gates needed to keep Gridly awareness-first while preserving existing V439-approved awareness support surfaces unchanged.
