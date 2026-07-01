# GRIDLY V726 — Directional Incident Context Authorization

## Mission

**Know Before You Go**

V726 is an authorization review only. It does not implement functionality, modify runtime behavior, enable rendering, change wording, alter ownership, or activate directional display.

## Final Determination

**DIRECTIONAL INCIDENT CONTEXT — AUTHORIZED WITH OBSERVATIONS**

Directional context is authorized for future incident-context enrichment only when routed through incident wording builders and only after a later implementation milestone explicitly enables the relevant rendering gate. V726 does not enable `userFacingRenderingEnabled` for any corridor.

## Required Answers

1. **Authorized future surfaces:** incident labels, alert card wording builders, hazard popup wording builders, crossing popup wording builders, `buildRoadHazardDisplay`, `buildLocalizedIncidentLabel`, `resolveGridlyAuthoritativeIncidentDisplayLocation`, and route-related wording surfaces that consume incident wording rather than claiming awareness ownership.
2. **Prohibited surfaces:** Awareness Brief primary ownership, Awareness Brief secondary ownership, Community Pulse ownership surfaces, and any ownership surface already controlled by active-awareness arbitration.
3. **Awareness Brief ownership participation:** directional context may not participate in Awareness Brief ownership.
4. **Community Pulse ownership participation:** directional context may not participate in Community Pulse ownership.
5. **US90 authorization:** US 90 is authorized for future incident-context use with observations, subject to confidence, containment, fallback, and explicit rendering authorization controls.
6. **TX146 authorization:** TX 146 is authorized for future incident-context use with observations, subject to confidence, containment, fallback, and explicit rendering authorization controls.
7. **FM1960 status:** FM 1960 remains deferred, fail-closed, and unauthorized for directional incident-context display.
8. **V727 recommendation:** implementation may proceed to a future V727 milestone, limited to incident wording integration and rendering-gate authorization design. V727 must not resurrect direct Awareness Brief DOM writes.

## 1. Existing Directional Architecture Review

| Layer | Reviewed asset | Finding | Reuse determination |
| --- | --- | --- | --- |
| Runtime candidate prototype | `js/gridlyDirectionalRuntimeCandidatePrototype.js` | Candidate state is protected by source traceability, evidence, confidence, county containment, bearing-only exclusion, review-bucket exclusion, and protected-system flags. | Reuse as the source validation pattern; do not rebuild corridor extraction or candidate generation. |
| Service layer | `js/gridlyDirectionalServiceLayer.js` | Service state remains fail-closed unless runtime evidence, county containment, bearing protection, review exclusion, and hidden runtime/display gates are all satisfied. | Reuse as the service boundary for future incident wording consumers. |
| Consumer layer | `js/gridlyDirectionalServiceConsumer.js` | Consumer keeps directional labels and bearing data unexposed, blocks review-bucket escapes, and leaves alerts, awareness, route watch, DriveTexas, and Transportation Intelligence disconnected. | Reuse the consumer boundary, but a future incident-specific consumer must remain wording-only and fail-closed. |
| Awareness layer | `js/gridlyDirectionalAwarenessLayer.js` | Existing awareness layer writes directly to `#gridlyV2TopStatusPrimary` and `#gridlyV2TopStatusSecondary`, which V706/V725 identified as the ownership conflict. | Do not reuse this direct awareness render path for V727. Reuse only lessons/evidence, not DOM ownership. |

## 2. Ownership Review

### Awareness Brief ownership

`refreshPortraitV2LocalizedIntelligence()` owns the active top Awareness Brief write path because it writes the localized primary and secondary text into `gridlyV2TopStatusPrimary` and `gridlyV2TopStatusSecondary`. Directional context is prohibited from competing for those targets.

### Community Pulse ownership

Community Pulse ownership remains a separate active-awareness surface. Directional context may not own, replace, or arbitrate Community Pulse headline/body surfaces. V726 authorizes only incident wording enrichment, not Community Pulse display or ownership participation.

### Incident wording ownership

Incident wording builders are suitable because they already assemble incident-facing phrases and can omit unsupported context without changing ownership of Awareness Brief or Community Pulse surfaces. Future directional enrichment must be incorporated as optional wording context inside those builders, not as separate DOM writes.

## 3. Incident Surface Review

| Surface / builder | V726 suitability | Authorization |
| --- | --- | --- |
| `buildLocalizedIncidentLabel` | Suitable for optional direction because it is an incident label builder and already participates in incident title/label generation. | Authorized for future V727 design. |
| `buildRoadHazardDisplay` | Suitable for optional direction inside road hazard display text when the underlying corridor candidate is eligible. | Authorized for future V727 design. |
| `resolveGridlyAuthoritativeIncidentDisplayLocation` | Suitable as a location authority checkpoint before any direction is added to incident wording. | Authorized for future V727 design. |
| Alert card wording builders | Suitable if they consume enriched incident wording and do not write Awareness Brief or Community Pulse ownership surfaces. | Authorized for future V727 design. |
| Hazard popup wording builders | Suitable if direction is omitted when confidence is insufficient. | Authorized for future V727 design. |
| Crossing popup wording builders | Suitable only when the authoritative incident/crossing location resolves to an eligible corridor candidate. | Authorized for future V727 design. |
| Route-related wording surfaces | Suitable only as wording consumers of incident context; not as routing, navigation, or ownership activators. | Authorized for future V727 design. |

## 4. Confidence and Eligibility Requirements

Directional context may be displayed only when all of these conditions pass:

1. Corridor runtime asset is activated for controlled runtime use.
2. `userFacingRenderingEnabled` is explicitly authorized by a later milestone for the exact corridor and surface class.
3. Candidate is runtime eligible and activation eligible.
4. Candidate confidence class is high/promotable; medium, bearing-only, missing oneway, reversible-lane, construction-segment, HOV/HOT-lane, missing-county, missing-ref, manual-review-required, blocked, ambiguous, or leaked candidates must not display direction.
5. County containment passes and the candidate is source traceable.
6. The incident location resolves authoritatively to the eligible corridor/candidate.
7. The direction token is one of the approved full words: Northbound, Southbound, Eastbound, or Westbound.
8. No direct DOM write or ownership claim is introduced for Awareness Brief, Community Pulse, Route Watch, DriveTexas, Transportation Intelligence, routing, navigation, Supabase, or protected systems.

### Required fallback behavior

If any confidence, eligibility, containment, rendering, ownership, or source-trace condition is insufficient, the future implementation must:

- omit direction entirely;
- fall back to current wording;
- remain fail-closed;
- avoid placeholder direction text; and
- avoid changing user-facing wording outside the authorized incident wording surface.

## 5. Runtime Asset Review

| Corridor | Runtime asset | Activation status | Rendering status | Runtime candidates | V726 authorization |
| --- | --- | --- | --- | ---: | --- |
| US 90 | `assets/directional-intelligence/runtime/v719-us90-directional-runtime.json` | `activationEnabled: true` | `userFacingRenderingEnabled: false` | 81 | Authorized for future incident-context use with observations; no V726 rendering. |
| TX 146 | `assets/directional-intelligence/runtime/v719-tx146-directional-runtime.json` | `activationEnabled: true` | `userFacingRenderingEnabled: false` | 36 | Authorized for future incident-context use with observations; no V726 rendering. |
| FM 1960 | `assets/directional-intelligence/runtime/v719-fm1960-directional-runtime.json` | `activationEnabled: false` | `userFacingRenderingEnabled: false` | 0 | Deferred, fail-closed, and unauthorized. |

## Protected Systems Verification

V726 is documentation/evidence only and confirms the protected systems remain unchanged:

| Protected system | Required state | V726 state |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Unchanged |
| `historyUiEnabled` | `false` | Unchanged |
| `DriveTexasPaused` | `true` | Unchanged |
| `TransportationIntelligenceEnabled` | `false` | Unchanged |
| `TransportationIntelligenceDisplay` | `false` | Unchanged |
| `TransportationIntelligenceActivation` | `false` | Unchanged |

## Observations

- US 90 and TX 146 have sufficient controlled-runtime readiness for a future incident-context integration review, but rendering remains disabled until explicitly changed by a later milestone.
- FM 1960 has zero runtime candidates and remains blocked by fail-closed behavior.
- The V706 ownership conflict is avoided only if V727 uses incident wording builders and never direct Awareness Brief DOM writes.
- Directional context should improve awareness by adding context to incident-specific wording, not by becoming a new ownership surface.

## Merge Recommendation

1. **Quick summary:** approve V726 as an authorization artifact confirming that directional incident context may be designed for future incident wording surfaces only, with US 90 and TX 146 eligible with observations and FM 1960 deferred.
2. **Merge recommendation:** merge V726 documentation/evidence because it changes no runtime behavior and preserves all rendering and protected-system gates.
3. **Exact next step:** open V727 for a limited implementation plan that adds fail-closed incident wording enrichment behind explicit per-corridor `userFacingRenderingEnabled` authorization, without using direct Awareness Brief or Community Pulse ownership writes.
