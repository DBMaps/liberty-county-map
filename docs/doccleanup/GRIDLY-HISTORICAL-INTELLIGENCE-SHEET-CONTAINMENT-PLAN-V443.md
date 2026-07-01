# V443 — Historical Intelligence Sheet Containment / Beta Safety Plan

## 1. Quick Summary

V443 is a planning-only containment milestone for the existing Historical Intelligence Sheet. It makes no production behavior changes, no UI changes, no historical reads, no dashboard, no API, no Route Watch change, no Awareness Brief change, no Community Pulse change, no Alert Card change, and no DriveTexas restart.

Gridly remains **Awareness Platform First** and **Route Intelligence Second**. Historical Intelligence may support awareness only as secondary, past-observation context. It must not become prediction, forecasting, navigation, route recommendation authority, reputation scoring, reliability scoring, raw history browsing, or a consumer history dashboard.

**Containment finding:** the Historical Intelligence Sheet must be treated as an **Experimental Historical Surface** and must not be promoted into beta-facing or consumer-facing use until explicit future safety controls exist and a future approval milestone allows it.

**Merge recommendation:** merge this planning document only. Do not pair this milestone with behavior, UI, read-path, API, dashboard, Route Watch, DriveTexas, Awareness Brief, Community Pulse, or Alert Card changes.

## 2. Current State

### Ownership

The Historical Intelligence Sheet is owned by the in-app sheet-builder path, not by the approved Historical Awareness Adapter. V442 identified the sheet as generated in `js/app.js` by `buildGridlyHistoricalIntelligenceSheetHtml(options)`, which builds from `buildGridlyIntelligencePreviewCardModel(options)` and `gridlyBuildHistoricalIntelligenceFindings(options)`.

The sheet is therefore **sheet-builder owned** and **local-storage-snapshot driven**. It is not controlled by `gridlyHistoricalIntelligenceEngine`, the historical projection helpers, or the V439/V441 Historical Awareness Adapter safe-display path.

### Generation path

Current generation path:

1. Portrait V2 sheet registry registers a `history` sheet titled `Historical Intelligence`.
2. The sheet uses `buildGridlyHistoricalIntelligenceSheetHtml` as its HTML builder.
3. The builder calls `buildGridlyIntelligencePreviewCardModel`.
4. The model calls `gridlyBuildHistoricalIntelligenceFindings`.
5. The findings path reads local historical-intelligence storage snapshots through `gridlyReadHistoricalIntelligenceStorageSnapshot()`.
6. The sheet builder groups, scores, ranks, deduplicates, and renders compact pattern rows.

### Visibility

The sheet exists in the production bundle and is potentially reachable through the Portrait V2 bottom dock sheet registry as `history`. V440 classified this as potentially consumer-visible if users can open or route to the `history` dock sheet. V443 does not change that state.

### Current access path

The known access path is the Portrait V2 bottom dock sheet registry entry for `history`. Internal browser-callable historical audits may also inspect related historical intelligence readiness, but those audits are internal diagnostics and are not consumer dashboards.

### Current governance status

The sheet is:

- not adapter-controlled;
- not approved as a consumer historical exposure surface;
- not covered by the approved V439 Historical Awareness Adapter safe-display model;
- classified by V441 as **Not Approved for Consumer Expansion** and requiring future review;
- confirmed by V442 as **not consumer-ready in its current form**.

## 3. Containment Classification

### Classification

The Historical Intelligence Sheet is classified for containment as an:

> **Experimental Historical Surface**

### Why this classification applies

This classification is required because the sheet:

- exists as a historical surface outside the approved adapter-controlled awareness path;
- can present a distinct `Historical Intelligence` surface rather than a small secondary awareness-support line;
- derives output from local historical-intelligence snapshots and sheet-builder findings;
- includes ranking and significance-like ordering behavior even when scores are not directly displayed;
- includes language patterns that can imply recurrence, location reputation, route delay expectations, or time-of-day planning advice;
- has not passed future beta-readiness review, visual hierarchy review, or browser audit coverage for all reachable states.

### Current limitations

Current limitations include:

- no adapter-controlled output contract for this sheet;
- no approved awareness-language framework applied to every row, stat, title, subtitle, and empty state;
- no guaranteed suppression for raw counts, contributor counts, raw timestamps, duration language, or peak-time language;
- no dedicated low-evidence gate for beta-facing use;
- no documented browser audit matrix covering empty, low-evidence, normal, unsafe-language, and boundary-preservation states;
- no product approval for the sheet to act as a beta-facing historical surface.

### Consumer-readiness status

The current consumer-readiness status is:

> **Not consumer-ready. Not beta-ready. Not production-ready.**

The sheet may remain only as an existing contained surface while protected boundaries remain intact. This document is not approval to expand, rename, emphasize, route to, promote, or expose it.

## 4. Beta Safety Requirements

Before the Historical Intelligence Sheet could ever be considered for beta exposure, a future milestone would need to satisfy all of the following requirements.

### Output governance

- Sheet output must be adapter-controlled or pass through an adapter-equivalent safety gate.
- Every title, subtitle, row label, summary line, expanded stat, empty state, supporting copy line, and fallback must use an approved language framework.
- Unsafe generated strings must be suppressed before rendering, not merely documented after rendering.

### Low-evidence handling

- Low-evidence states must default to suppression or the approved caveat: **“Historical evidence is still limited.”**
- Low evidence must not be compensated for with raw counts, raw timestamps, contributor metrics, ranking, confidence percentages, or stronger recurrence language.
- Empty states must avoid implying that future history browsing or pattern exploration is guaranteed.

### Prohibited-language suppression

The beta candidate must suppress or rewrite language that implies:

- prediction or forecasting;
- expected route delay;
- likely clearance time;
- route recommendation or route avoidance;
- location reputation;
- reliability scoring;
- confidence scoring;
- contributor scoring;
- raw event-history browsing.

### Raw-history suppression

The beta candidate must not expose:

- raw historical rows;
- exact historical event counts;
- contributor counts;
- raw timestamps or `Last reported` style values;
- source metadata;
- database or schema details;
- drill-down archive behavior.

### Prediction suppression

The beta candidate must suppress or safely rewrite:

- `Usually clears in [duration]`;
- `Typical delay [duration]`;
- `Most reported [time window]`;
- language that implies future recurrence, expected timing, or likely condition duration.

### Route-decision suppression

The beta candidate must not influence navigation decisions through direct or indirect route authority. It must avoid wording that can be read as:

- avoid this route;
- take another route;
- expect delays at a specific time;
- this crossing is unreliable;
- this area is a delay corridor;
- this road is safer or less safe than alternatives.

### Browser audit coverage

A future beta candidate must include browser-audit coverage for at least:

- empty storage;
- low-evidence storage;
- normal safe historical context;
- unsafe generated-language suppression;
- prohibited raw-count suppression;
- prohibited timestamp suppression;
- prohibited duration suppression;
- protected boundary preservation;
- visual hierarchy verification.

### Visual hierarchy review

A future beta candidate must prove the sheet remains secondary to current awareness. It must not appear as a primary dashboard, route-planning tool, map authority, route-ranking layer, location reputation index, or history archive.

## 5. Containment Findings

The containment finding is that Gridly must prevent accidental promotion by treating the Historical Intelligence Sheet as a contained, experimental, non-authoritative surface.

Required containment posture:

- no automatic exposure through beta flags;
- no automatic promotion because related adapter surfaces are approved;
- no reuse of the sheet as evidence that historical intelligence is broadly consumer-ready;
- no visual emphasis, onboarding callout, marketing copy, navigation entry, or beta release note for this sheet without explicit approval;
- no coupling to Route Watch, route ranking, alert priority, or navigation recommendations;
- no DriveTexas dependency or restart.

## 6. Explicit Beta Blockers

The current sheet is blocked from beta exposure by the following known issues:

1. **Non-adapter language generation** — output is generated by the sheet-builder path rather than the approved Historical Awareness Adapter.
2. **Duration phrasing** — phrases such as `Usually clears in [duration]` and `Typical delay [duration]` can imply future clearance or route-delay expectations.
3. **Peak-time phrasing** — `Most reported [time window]` can imply forecast-like time-of-day planning advice.
4. **Count-based phrasing** — exact report counts can create raw-history browsing, significance, or reliability implications.
5. **Contributor metrics** — contributor counts can imply reporter identity certainty, reliability, or crowd-confidence.
6. **Last-reported phrasing** — raw-ish recency values can turn the sheet into a history browser.
7. **Recurrence-strength language** — `Recurring`, `Frequently`, `Common`, `Hotspot`, and similar terms can imply future likelihood or location reputation.
8. **Ranking and significance ordering** — even undisplayed scoring can create a scorecard-like experience if surfaced without controls.
9. **Unsupported governance coverage** — the current sheet has not passed adapter-equivalent language gating, low-evidence gating, visual hierarchy review, or browser audit coverage.
10. **Consumer positioning risk** — the standalone `Historical Intelligence` surface can read as a product feature rather than secondary awareness context.

## 7. Protected Boundary Preservation

The following protected boundaries must remain unchanged through this containment plan and any future beta-readiness work unless a later explicit approval milestone changes them:

| Boundary | Required state |
|---|---|
| `historicalReadsEnabled` | `false` |
| `historyUiEnabled` | `false` |
| `historicalApiExposure` | `false` |
| `consumerFacingHistoryDashboard` | `false` |
| `DriveTexasPaused` | `true` |

V443 does not enable reads, UI, APIs, dashboards, DriveTexas, Route Watch changes, or consumer historical exposure.

## 8. Promotion Gates

No automatic promotion is allowed.

Before any future consumer exposure, all of the following promotion gates are required:

1. **Governance review** — confirms ownership, data source, surface class, protected boundaries, non-goals, and consumer posture.
2. **Safety audit** — confirms the surface cannot become prediction, route authority, scoring, reliability judgment, or raw history browsing.
3. **Language audit** — validates all generated and fallback strings against approved allowed, conditional, and prohibited language rules.
4. **Low-evidence audit** — confirms weak evidence suppresses output or uses the approved caveat without raw counts or overclaiming.
5. **Raw-history audit** — confirms no raw rows, counts, timestamps, contributor metrics, source metadata, or archive-like drill-downs are exposed.
6. **Browser audit** — validates reachable rendered states, including empty, low-evidence, normal, unsafe-language, and protected-boundary states.
7. **Visual hierarchy review** — confirms historical context remains secondary to current awareness and does not become a dashboard or route-planning authority.
8. **Beta review** — evaluates beta-specific user interpretation risk and support burden.
9. **Explicit approval milestone** — names the approved surface, scope, copy framework, gates passed, rollback posture, and release limits.

Failure of any gate blocks beta promotion.

## 9. Recommended Future Paths

This section evaluates future paths only. It does not recommend implementation in V443.

### Option A — Keep sheet internal indefinitely

**Benefits**

- Lowest consumer-risk path.
- Preserves awareness-first posture without creating a new historical product surface.
- Avoids prediction, reputation, route-decision, and raw-history browsing concerns.
- Allows internal audits to continue without new consumer expectations.

**Risks**

- The existing sheet remains a contained surface that must not be accidentally promoted.
- Internal-only surfaces can still create confusion if named or routed like product features.
- Requires continued release discipline so beta flags or navigation changes do not expose it.

### Option B — Future adapter-based safe consumer version

**Benefits**

- Aligns any future consumer version with the approved Historical Awareness Adapter model.
- Enables central language governance, low-evidence suppression, and prohibited-language filtering.
- Can preserve limited awareness value while reducing raw-history and prediction risk.

**Risks**

- Requires a new implementation and audit effort.
- Standalone sheet format may still be too dashboard-like even with safe language.
- Users may interpret a dedicated historical sheet as route advice unless visual hierarchy is carefully constrained.

### Option C — Replace with awareness-style historical summaries

**Benefits**

- Best aligns with Gridly’s awareness-first posture.
- Keeps historical intelligence as secondary support beneath current conditions.
- Reduces risk of raw browsing, ranking, or route-planning interpretation.
- Can reuse the existing adapter-controlled safe-display model more naturally.

**Risks**

- Provides less exploratory value than a sheet.
- Requires product clarity on where summaries appear and how often they should be suppressed.
- Still requires language, browser, low-evidence, and visual hierarchy audits before expansion.

## 10. Risk Assessment

| Stage | Risk classification | Rationale |
|---|---|---|
| Current contained state | Medium | The sheet exists in the bundle and may be reachable through the `history` dock path, but V443 makes no expansion and preserves protected boundaries. |
| Closed beta exposure in current form | High | Current language can imply prediction, duration expectations, peak-time guidance, raw history browsing, and route-decision relevance. |
| Public beta exposure in current form | High / Critical | Broader user interpretation risk, support burden, and governance gaps would increase significantly. |
| Production exposure in current form | Critical | Production release would conflict with the awareness-first policy and could create de facto prediction, route authority, history browsing, or reputation scoring. |

## 11. Recommended Next Milestone

Recommended next milestone:

> **V444 — Historical Intelligence Adapter Expansion Study**

This is the most appropriate next milestone because the primary containment gap is not just visual or beta-readiness review; it is ownership and output governance. V444 should study whether any future historical sheet-like consumer experience can be safely adapter-controlled or adapter-equivalent without violating Gridly’s awareness-first posture.

V444 should remain study-only unless explicitly scoped otherwise. It should not implement UI, enable reads, create APIs, create dashboards, restart DriveTexas, or modify Route Watch.

## 12. Merge Recommendation

Merge V443 as a planning and containment document.

Do not merge V443 with any code or behavior change that would:

- expose the Historical Intelligence Sheet to beta users;
- enable historical reads;
- enable a history UI flag;
- create a consumer dashboard;
- create a historical API;
- route users to the sheet from onboarding, navigation, alerts, Route Watch, Awareness Brief, Community Pulse, or Alert Cards;
- restart DriveTexas;
- change route recommendations, route ranking, or alert priority.

## 13. Testing

Required validation for V443:

- `node --check js/app.js`
- Documentation validation confirming this planning document contains the requested sections and preserves the protected boundaries.

No browser screenshot is required because V443 makes no UI or behavior changes.
