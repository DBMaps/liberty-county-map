# GRIDLY V701 — User-Facing Directional Intelligence Design Package

## 1. Mission alignment

Gridly remains **Know Before You Go**. V701 preserves the product posture of **Awareness Platform First** and **Route Intelligence Second** by defining how directional intelligence should eventually be expressed to users without implementing display, changing runtime behavior, or exposing directional intelligence.

V701 is **design only**. It does not modify `js/app.js`, render UI, add directional labels, connect directional intelligence to Route Watch, connect directional intelligence to Alerts, connect directional intelligence to Awareness, modify DriveTexas, or modify Transportation Intelligence.

Current validated directional state carried into this design package:

| Metric | Validated state |
| --- | ---: |
| Total segments | 245 |
| Eligible candidates | 164 |
| Excluded review candidates | 81 |
| Blocked candidates | 0 |
| Bearing-only candidates | 0 |
| County containment | Pass |
| Fail-closed behavior | Pass |
| Service layer | Operational |
| Service consumer | Operational |

Strategic baseline: **SERVICE STRATEGY RECOMMENDED**. User-facing directional intelligence is the intended destination, but V701 does not activate it.

## 2. Protected-system verification

| Protected system | Required state | V701 verified state |
| --- | ---: | ---: |
| historicalReadsEnabled | false | false |
| historyUiEnabled | false | false |
| DriveTexasPaused | true | true |
| TransportationIntelligenceEnabled | false | false |
| TransportationIntelligenceDisplay | false | false |
| TransportationIntelligenceActivation | false | false |

Protected systems remain unchanged. V701 creates documentation and evidence only.

## 3. User value definition

Directional intelligence solves a user-awareness problem: users often need to understand **which direction of impact** is relevant before they decide whether a condition matters to them.

Primary value cases:

- Understanding delay direction.
- Understanding impact direction.
- Understanding crossing impact direction.
- Understanding roadway hazard direction.

Directional intelligence exists to improve awareness. It does **not** exist to provide navigation, routing, turn-by-turn guidance, or travel optimization.

## 4. Placement evaluation

| Placement | Value | Complexity | Risk | Mission alignment | Preferred order |
| --- | --- | --- | --- | --- | ---: |
| Awareness Cards | High | Low to moderate | Moderate | High | 1 |
| Dedicated Directional Surface | Moderate to high | Moderate to high | Moderate | Moderate to high | 2 |
| Destination Intelligence | Moderate | Moderate | Moderate to high | Moderate | 3 |
| Alert Cards | Moderate | Moderate | High | Moderate | 4 |
| Route Watch | Moderate | High | High | Low to moderate | 5 |

### A. Awareness Cards

Awareness Cards are the best first placement because they support the existing user promise: understand what is happening before deciding what to do. Directional context can clarify a condition without implying that Gridly is routing the user.

### B. Alert Cards

Alert Cards have value when directional context affects urgency or relevance, but alert wording is safety-sensitive. Directional information in alerts could be interpreted as higher confidence, broader severity, or operational instruction. Alert Cards should follow later validation, not lead the first rollout.

### C. Route Watch

Route Watch is closer to route intelligence than awareness. Directional intelligence may eventually support Route Watch, but Route Watch-first rollout risks shifting the product posture toward navigation before the user-facing awareness pattern has been validated.

### D. Destination Intelligence

Destination Intelligence may benefit from direction context near a destination, but users may interpret destination-adjacent direction text as travel advice. It should not be the first user-facing placement.

### E. Dedicated Directional Surface

A dedicated surface could support a mature directional program, auditability, and focused education. It is not preferred for MVP because it requires new information architecture and could overemphasize directionality before user language is proven.

Preferred placement: **Awareness Cards first**, with any future dedicated surface considered after awareness validation.

## 5. Language evaluation

| Option | Language | Readability | User understanding | Ambiguity | Scalability | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| A | NB / SB / EB / WB | Low to moderate | Moderate for familiar drivers | Moderate | High | Not primary |
| B | Northbound / Southbound / Eastbound / Westbound | High | High | Low | High | Primary |
| C | Toward Houston / Toward Cleveland / Toward Conroe / Toward Liberty | High when local context is known | High for familiar destinations | Moderate | Moderate to low | Future supplement only |
| D | Inbound / Outbound | Moderate | Low without a reference point | High | Low | Not recommended |

Recommended primary strategy: **full-word cardinal direction labels** — Northbound, Southbound, Eastbound, and Westbound.

Rationale:

- More readable than abbreviations.
- More accessible for casual users.
- Less ambiguous than inbound/outbound.
- More scalable than toward-city phrasing.
- Compatible with future secondary display patterns if local place references are later validated.

## 6. Confidence threshold design

Recommended minimum visibility threshold: **strong candidates only**.

Rejected options:

- Strong + reviewed.
- All candidates.

Rationale: user-facing directional display must begin with the most reliable directional candidates only. Review-bucket records and ambiguous candidates should remain non-visible unless a future milestone separately validates and authorizes them.

## 7. Review bucket visibility design

User visibility is **prohibited** for every review bucket:

- `reversible_lane`
- `construction_segment`
- `hov_hot_lane`
- `missing_county`
- `missing_oneway`
- `missing_ref`
- `manual_review_required`

Decision: review buckets remain excluded from user-facing directional intelligence. They may support internal review only and must not appear in Awareness Cards, Alert Cards, Route Watch, Destination Intelligence, or a dedicated directional surface.

## 8. Bearing protection design

Bearing-only directional intelligence remains prohibited.

Required prohibitions:

- Bearing-only directional intelligence: **prohibited**.
- Bearing-only display: **prohibited**.
- Bearing-only awareness: **prohibited**.

Required safeguards:

1. Do not derive user labels from geometry bearing alone.
2. Require accepted directional metadata before user visibility.
3. Fail closed when only bearing is available.
4. Keep bearing-only records internal for review, not user presentation.

## 9. County containment design

Directional intelligence may only appear when county containment passes.

Containment failure behavior:

- No directional display.
- No directional awareness wording.
- No downstream user-facing surface consumption.
- Fail closed.

County containment is a user-facing visibility gate, not merely an internal validation detail.

## 10. User-facing safety rules

Minimum required display safety rules for any future implementation:

1. Strong candidate threshold required.
2. County containment pass required.
3. Review bucket exclusion required.
4. Bearing-only exclusion required.
5. Fail closed on missing, degraded, stale, conflicting, or non-contained evidence.
6. Use full-word cardinal direction labels as the primary language pattern.
7. Do not imply routing, navigation, or turn-by-turn guidance.
8. Do not connect to Route Watch, Alerts, Destination Intelligence, DriveTexas, or Transportation Intelligence without future explicit authorization.
9. Do not expose directional intelligence until a future implementation milestone authorizes display.

## 11. Minimum viable experience

Preferred MVP: **Directional Awareness Layer**.

The smallest acceptable user-facing release should provide directional context in an awareness-first surface only, using full-word direction language for strong, county-contained candidates.

The MVP should exclude:

- Routing.
- Navigation.
- Turn-by-turn guidance.
- Route Watch integration.
- Alert integration.
- Destination Intelligence integration.
- DriveTexas.
- Transportation Intelligence.

## 12. Product strategy recommendation

Recommended strategy: **Awareness-first directional rollout**.

This strategy best aligns with Gridly's mission and posture. Awareness-first rollout allows Gridly to add useful directional clarity while avoiding premature navigation, alert-prioritization, or route-intelligence implications.

## 13. Risk review

| Risk | Design treatment |
| --- | --- |
| Users interpret direction as navigation | Use awareness-first placement and non-navigation language. |
| Abbreviations reduce comprehension | Use full-word direction labels as primary language. |
| Review-bucket leakage | Prohibit all review buckets from user visibility. |
| Bearing-only inference leakage | Prohibit bearing-only display and awareness. |
| Cross-county leakage | Require county containment pass and fail closed on failure. |
| Premature Route Watch or Alert coupling | Defer all non-awareness integrations to future authorization. |
| Protected-system regression | Verify protected systems remain unchanged. |

## 14. Final determination

**DESIGN PACKAGE COMPLETE WITH CONSTRAINTS**

Evidence supports a complete design package because V701 defines user value, preferred placement, language strategy, confidence threshold, review-bucket visibility, bearing protections, county containment rules, safety rules, MVP scope, and product strategy. The constraints remain material: no implementation, no display activation, no runtime behavior change, no Route Watch wiring, no Alerts wiring, no Awareness wiring, no DriveTexas change, and no Transportation Intelligence change.

## 15. Recommended next milestone

Recommended next milestone:

**V702 — Directional Awareness Layer Implementation Plan**

Purpose: translate the approved V701 design into an implementation plan.

Restrictions:

- Still no implementation.
- Still no display activation.
- Still no runtime behavior change.
