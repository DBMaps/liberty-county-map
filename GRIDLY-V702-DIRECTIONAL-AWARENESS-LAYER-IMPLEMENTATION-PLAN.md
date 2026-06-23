# GRIDLY V702 — Directional Awareness Layer Implementation Plan

## 1. Mission alignment

Gridly remains **Know Before You Go**.

V702 preserves the product posture of **Awareness Platform First** and **Route Intelligence Second** by defining the first user-facing directional awareness implementation blueprint without implementing UI, changing runtime behavior, activating display, or connecting directional intelligence to route-oriented systems.

V702 is **planning only**. It does not modify `js/app.js`, `index.html`, CSS, DriveTexas, Transportation Intelligence, Route Watch, Alerts, or Destination Intelligence. It does not render directional awareness, expose directional labels, or activate user-facing directional intelligence.

Validated directional state carried into this plan:

| Metric | Validated state |
| --- | ---: |
| Total segments | 245 |
| Strong candidates | 164 |
| Review-excluded candidates | 81 |
| Blocked candidates | 0 |
| Bearing-only candidates | 0 |
| County containment | Pass |
| Fail-closed behavior | Pass |
| Service layer | Operational |
| Service consumer | Operational |

## 2. Protected-system verification

| Protected system | Required state | V702 verified state |
| --- | ---: | ---: |
| `historicalReadsEnabled` | `false` | `false` |
| `historyUiEnabled` | `false` | `false` |
| `DriveTexasPaused` | `true` | `true` |
| `TransportationIntelligenceEnabled` | `false` | `false` |
| `TransportationIntelligenceDisplay` | `false` | `false` |
| `TransportationIntelligenceActivation` | `false` | `false` |

Protected systems remain unchanged. V702 creates documentation and evidence only.

## 3. Awareness layer purpose

The Directional Awareness Layer adds direction-specific clarity to existing awareness content so users can understand whether a roadway condition is relevant to their expected movement before they decide what to do.

Directional awareness adds:

- Understanding the **direction of impact**.
- Understanding the **direction of delay**.
- Understanding the **direction of congestion**.
- Understanding the **directional consequence** of an observed roadway condition.
- Differentiating corridor impacts when only one direction is affected.

Directional awareness does **not** add:

- Routing.
- Navigation.
- Turn-by-turn guidance.
- Alternate-route recommendations.
- Trip optimization.
- Route Watch, Alerts, Destination Intelligence, DriveTexas, or Transportation Intelligence activation.

## 4. Awareness surface selection

### Surface evaluation

| Awareness surface | V702 evaluation | MVP decision | Rollout order |
| --- | --- | --- | ---: |
| Top Awareness cards | Highest awareness value, already aligned with quick condition scanning, low navigation implication when phrased carefully. | Selected for MVP | 1 |
| Awareness detail cards | Useful for expanded context, but should follow Top Awareness cards after initial visibility validation. | Deferred | 2 |
| Awareness summaries | Useful for aggregate understanding, but summary wording may overgeneralize directional context. | Deferred | 3 |
| Consequence cards | High value for impact explanation, but consequence language can imply guidance if introduced too early. | Deferred | 4 |
| Other awareness surfaces | Not selected until the MVP pattern is validated and explicitly authorized. | Deferred | 5 |

### MVP placement

MVP placement is **Top Awareness cards only**.

Directional text should appear as supporting awareness language inside the card content, not as a standalone navigation instruction, route recommendation, alert escalation, or map label.

### Rollout order

1. **Top Awareness cards** — first eligible user-facing placement after a future activation-readiness milestone and a separate implementation authorization.
2. **Awareness detail cards** — eligible only after Top Awareness card validation proves comprehension and no protected-system regression.
3. **Awareness summaries** — eligible only after summary wording rules are separately validated.
4. **Consequence cards** — eligible only after consequence phrasing is reviewed to avoid routing or instruction-like language.
5. **Other awareness surfaces** — require separate milestone approval.

## 5. User language specification

### Approved primary direction labels

Approved labels are full-word cardinal direction labels:

- `Northbound`
- `Southbound`
- `Eastbound`
- `Westbound`

### Approved awareness phrasing patterns

Approved patterns include:

- `Northbound delays reported`
- `Southbound congestion observed`
- `Eastbound traffic impacts`
- `Westbound roadway impacts`

### Not approved for MVP

The following are not approved for MVP display unless a later milestone separately authorizes them:

- `NB`
- `SB`
- `EB`
- `WB`
- `Inbound`
- `Outbound`
- `Toward <city>` directional substitutes
- Turn-by-turn wording such as `take`, `turn`, `reroute`, `avoid`, or `use instead`

### Formatting standards

- Direction label must be written as a full word with initial capital letter.
- Direction label should appear at the beginning of the directional phrase when possible.
- Direction text should be sentence-style, concise, and awareness-focused.
- Direction text must describe observed or reported impact, not instruct user action.
- Direction text must not imply that Gridly has calculated a route.
- Direction text must not expose confidence buckets, review-bucket names, OSM tags, internal candidate IDs, or bearing values.

## 6. Confidence visibility rules

Visibility threshold is **strong candidates only**.

| Candidate state | User-visible directional awareness? | Rule |
| --- | ---: | --- |
| Strong candidate | Yes, after future implementation authorization and if all other gates pass | Eligible |
| Review-required candidate | No | Excluded |
| Blocked candidate | No | Excluded |
| Bearing-only candidate | No | Excluded |

Confidence gating requirements:

1. Candidate confidence must be available.
2. Candidate confidence must equal the accepted strong-candidate threshold.
3. County containment must pass.
4. No review bucket may be present.
5. Candidate must not be bearing-only.
6. Service and source evidence must be available.
7. Any missing, stale, conflicting, or unavailable confidence state must fail closed with no directional awareness shown.

## 7. Review bucket exclusion rules

Review buckets are internal-only and must never be user visible.

Excluded review buckets:

- `reversible_lane`
- `construction_segment`
- `hov_hot_lane`
- `missing_county`
- `missing_oneway`
- `missing_ref`
- `manual_review_required`

Implementation requirements for a future implementation milestone:

- Never display review-bucket directional awareness.
- Never surface review-bucket labels.
- Never promote review-bucket records into Top Awareness cards, detail cards, summaries, consequence cards, alerts, Route Watch, Destination Intelligence, or map labels.
- Treat any review-bucket presence as a fail-closed display blocker.

Review bucket exclusion result: **review buckets are never displayed, never surfaced, and never promoted**.

## 8. County containment rules

Directional awareness may appear only when county containment passes and county ownership is valid.

Display containment requirements:

- County containment must pass before any directional awareness text is eligible.
- County ownership must be valid for the active county context.
- Directional awareness must not leak across county boundaries, county packages, or active-area contexts.
- Any containment ambiguity must suppress directional awareness.

Containment failure behavior:

- No directional awareness shown.
- No directional labels shown.
- No fallback bearing-based text shown.
- Fail closed.

County containment result: **county containment pass is required; containment failure produces no directional awareness**.

## 9. Bearing protection rules

Bearing-only direction is never sufficient for user-facing directional awareness.

Bearing-only records must be:

- Never visible.
- Never surfaced.
- Never displayed.
- Never used as directional awareness.
- Never used as a fallback when accepted directional metadata is unavailable.

Implementation protections for a future milestone:

1. Do not derive Northbound, Southbound, Eastbound, or Westbound labels from geometry bearing alone.
2. Require accepted directional metadata and strong candidate confidence.
3. Fail closed when only bearing is available.
4. Keep bearing-only records internal for audit or review only.

Bearing protection result: **bearing-only candidates remain non-visible and cannot produce awareness text**.

## 10. Fail-closed display rules

Directional awareness display must fail closed if any required evidence or service condition is unavailable or invalid.

Fail-closed triggers:

- Source unavailable.
- Confidence unavailable.
- Confidence below strong-candidate threshold.
- Containment invalid.
- County ownership invalid.
- Review bucket present.
- Bearing-only state present.
- Service unavailable.
- Service response malformed, stale, conflicting, or incomplete.
- Protected-system state cannot be verified.

Expected result for every fail-closed trigger: **no directional awareness shown**.

## 11. Awareness card examples

Mock content examples for future implementation planning only:

- `Northbound delays reported near Dayton.`
- `Southbound traffic impacts observed.`
- `Eastbound congestion affecting corridor travel.`
- `Westbound roadway impacts reported.`
- `Northbound roadway impacts reported near the corridor.`
- `Southbound congestion observed near the affected area.`
- `Eastbound delays reported near the work area.`
- `Westbound traffic impacts observed near the incident area.`

These examples are not implemented, not activated, and not rendered by V702.

## 12. Rollout validation plan

Before any activation or user-facing implementation work, a future milestone must validate:

1. **Containment validation** — only county-contained, county-owned candidates can produce directional awareness.
2. **Confidence validation** — only strong candidates pass visibility gates.
3. **Review bucket validation** — all review buckets are suppressed from every user-facing surface.
4. **Bearing protection validation** — bearing-only records cannot produce directional text.
5. **Fail-closed validation** — missing source, confidence, containment, review-bucket, bearing, or service evidence produces no display.
6. **User visibility validation** — Top Awareness cards are the only MVP placement and no other surface receives directional awareness.
7. **Language validation** — only full-word labels and approved awareness phrasing are emitted.
8. **Protected-system validation** — historical reads/UI, DriveTexas, and Transportation Intelligence protected states remain unchanged.
9. **Runtime non-regression validation** — future implementation must prove no route, alert, destination, DriveTexas, or Transportation Intelligence coupling occurs.

## 13. Risk review

| Risk | Mitigation in this plan |
| --- | --- |
| Users interpret awareness as navigation | Top Awareness cards only; no route, turn, avoid, or reroute language. |
| Abbreviations reduce readability | Full-word direction labels only. |
| Review-bucket leakage | Review buckets are display blockers and never surfaced. |
| Bearing-only leakage | Bearing-only candidates are prohibited from user-facing text. |
| Cross-county leakage | County containment and county ownership are required visibility gates. |
| Over-broad surface rollout | MVP limited to Top Awareness cards; other surfaces deferred. |
| Protected-system regression | Protected states remain verified false/paused and unchanged. |
| Premature activation | V702 is planning only and authorizes no display or runtime behavior change. |

## 14. Rollout readiness state

`awareness_layer_plan_complete`

The plan is complete because it defines the awareness purpose, MVP surface, rollout order, approved language, confidence threshold, review-bucket exclusion, county containment, bearing protection, fail-closed behavior, mock content, validation requirements, protected-system verification, and next milestone.

## 15. Final determination

**AWARENESS LAYER IMPLEMENTATION PLAN COMPLETE**

Evidence supports a complete implementation plan. V702 defines how directional awareness should eventually appear to users while preserving all current restrictions: no implementation, no activation, no runtime behavior changes, no directional display, no Route Watch connection, no Alerts connection, no Destination Intelligence connection, no DriveTexas change, and no Transportation Intelligence change.

## 16. Recommended next milestone

Recommended next milestone:

**V703 — Directional Awareness Layer Activation Readiness Review**

Purpose: conduct the final review before any user-facing implementation work begins.

Restrictions remain:

- No implementation.
- No activation.
- No runtime behavior changes.
- No directional display rollout.
