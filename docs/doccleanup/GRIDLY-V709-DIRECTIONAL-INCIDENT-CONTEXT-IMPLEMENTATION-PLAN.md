# GRIDLY V709 — Directional Incident Context Implementation Plan

## Executive Summary

GRIDLY V709 is an implementation planning package only. It defines how directional awareness should later become incident context without changing runtime behavior, UI rendering, alert behavior, routing, navigation, Route Watch, destination intelligence, county systems, Supabase, or directional extraction.

The final recommendation is a hybrid model: **Option A — Direction Embedded In Location**, governed by **Option C — Conditional Direction Display** and **Option D — Corridor-Only Direction**. Direction should be added inside the existing incident location phrase only when a protected corridor, eligible incident type, county containment, and confidence threshold all pass. When any requirement fails, the existing incident wording remains unchanged.

Preferred future phrasing remains awareness-oriented and non-navigational:

- `Disabled Vehicle on US 90 Westbound at Waco Street`
- `Flooding on FM 1960 Eastbound near Dayton`
- `Train Blocking Crossing on TX 146 Southbound`

This package does not choose a secondary-line implementation as the default. A secondary location line remains a future fallback only if title length testing proves embedded location phrasing is not readable at production incident density.

## Current State

V704 implemented directional awareness infrastructure. V705 corrected visibility auditing. V706 identified that Awareness Brief ownership is displaced by the localized-intelligence hydration path. V707 aligned tests with the validated current state. V708 completed product review and approved the future direction: directional awareness should become incident context, not a standalone card, not a separate directional surface, not navigation guidance, not route recommendation logic, and not service-only infrastructure forever.

Current incident wording can appear as:

- `Disabled Vehicle on US 90 at Waco Street`
- `Awaiting additional reports`

Potential future contextual wording can become:

- `Disabled Vehicle on US 90 Westbound at Waco Street`
- `Awaiting additional reports`

or, if a future authorized readability package selects secondary-line ownership:

- `Disabled Vehicle`
- `US 90 Westbound near Waco Street`
- `Awaiting additional reports`

No runtime implementation is authorized by V709.

## Approved Product Direction

Directional awareness should become **incident context**.

Directional awareness should not become:

- Standalone awareness cards.
- Separate directional surfaces.
- Navigation guidance.
- Turn-by-turn instructions.
- Route recommendations.
- Alternate-route prompts.
- Service-only infrastructure forever.

Gridly remains:

1. **Awareness Platform First**.
2. **Route Intelligence Second**.

The mission is **Know Before You Go**. Directional context may clarify where an active condition is occurring, but it must never tell the user where to drive.

## Option Analysis

### Option A — Direction Embedded In Location

**Concept:** Direction is inserted into the existing road-location phrase.

Examples:

- `Disabled Vehicle on US 90 Westbound at Waco Street`
- `Flooding on FM 1960 Eastbound near Dayton`
- `Train Blocking Crossing on TX 146 Southbound`

**Evaluation:**

- **Mission Alignment:** Very high. Direction clarifies the incident location while preserving the Awareness Brief as the primary product owner.
- **Awareness Value:** High. The user learns which directional side of a corridor is affected without receiving route guidance.
- **User Clarity:** High when phrasing is concise and corridor names are familiar.
- **Trust Impact:** High if confidence-protected; damaging if direction is guessed or over-applied.
- **County Scalability:** High because county road labels can keep existing resolver and containment rules.
- **Rendering Complexity:** Low. The future implementation can reuse current incident title/location surfaces.
- **Ownership Complexity:** Low to medium. The Awareness Brief owner must accept a directional modifier inside the location label.
- **Future Compatibility:** High. Structured direction can later support destination-aware context or route intelligence without exposing navigation now.
- **Implementation Risk:** Medium. Main risk is long titles on mobile or complex road names.
- **Maintenance Cost:** Low to medium. Requires language tests and eligibility rules, but not a new surface.

### Option B — Direction Embedded In Secondary Location Line

**Concept:** The incident type remains a clean title and directional context appears in a location line.

Example:

- `Disabled Vehicle`
- `US 90 Westbound near Waco Street`
- `Awaiting additional reports`

**Evaluation:**

- **Mission Alignment:** High. Direction remains tied to an incident rather than becoming its own product surface.
- **Awareness Value:** High. The direction is visible and easier to scan than a long title.
- **User Clarity:** Very high if the visual hierarchy clearly marks the second line as location context.
- **Trust Impact:** High when confidence-gated; moderate risk if users perceive the line as a route instruction.
- **County Scalability:** High, but requires consistent county-level location-line formatting.
- **Rendering Complexity:** Medium. Requires rendering ownership for a distinct location line and wrapping/truncation rules.
- **Ownership Complexity:** Medium to high. The future implementation must decide which owner controls incident title, location line, and status line.
- **Future Compatibility:** High. Structured title/location/status fields are extensible.
- **Implementation Risk:** Medium. The risk is not the data; it is ownership displacement and brief hierarchy changes.
- **Maintenance Cost:** Medium. Requires more snapshot, layout, and language governance than Option A.

### Option C — Conditional Direction Display

**Concept:** Direction is shown only when confidence, corridor readiness, and awareness value pass.

Show examples:

- `Flooding on I-69 Northbound`
- `Traffic Backup on US 90 Westbound near Dayton`

Hide examples:

- `Disabled Vehicle on unnamed local road`
- `Hazard near residential street`

**Evaluation:**

- **Mission Alignment:** Very high. It prevents direction from becoming noise or pseudo-navigation.
- **Awareness Value:** Very high. Direction appears only where it materially improves situational awareness.
- **User Clarity:** High. Users see directional language only on recognizable corridors.
- **Trust Impact:** Very high. Fail-closed suppression protects confidence.
- **County Scalability:** High. Counties can graduate corridors into readiness without forcing local-road coverage.
- **Rendering Complexity:** Low to medium. Rendering stays simple, but gating decisions must be evaluated before language generation.
- **Ownership Complexity:** Medium. The incident-context owner must consume an eligibility decision, not raw direction.
- **Future Compatibility:** Very high. Gating can later support ranking, auditing, and destination relevance.
- **Implementation Risk:** Medium. Requires carefully documented thresholds and test fixtures.
- **Maintenance Cost:** Medium. Corridor readiness and confidence rules must be maintained.

### Option D — Corridor-Only Direction

**Concept:** Direction is displayed only on protected, directionally meaningful corridors such as US highways, interstates, major state highways, and approved farm-to-market corridors.

Display candidates:

- US highways.
- Interstates.
- Major state highways.
- Protected corridors.
- Directional-ready FM corridors where county validation passes.

Do not display on:

- Local roads.
- Residential roads.
- Private roads.
- Ambiguous or unnamed roads.

**Evaluation:**

- **Mission Alignment:** Very high. County-contained corridor awareness is aligned with Know Before You Go.
- **Awareness Value:** High. Direction matters most on divided or directional corridors.
- **User Clarity:** High. `US 90 Westbound` and `I-69 Northbound` are familiar patterns.
- **Trust Impact:** Very high. Limiting display to protected corridors reduces false precision.
- **County Scalability:** High. Counties can maintain corridor allowlists and readiness states.
- **Rendering Complexity:** Low. Once eligibility is resolved, rendering uses the same text pattern.
- **Ownership Complexity:** Medium. Corridor readiness ownership must be explicit.
- **Future Compatibility:** High. Protected corridors provide a durable foundation for later route intelligence.
- **Implementation Risk:** Low to medium. Partial coverage is expected and acceptable.
- **Maintenance Cost:** Medium. Corridor inventories must be audited as counties expand.

## Decision Matrix

Scores use a 1–5 scale where 5 is strongest. For complexity, risk, and cost rows, 5 means lowest complexity, lowest implementation risk, or lowest maintenance cost.

| Evaluation Criteria | Option A: Direction Embedded In Location | Option B: Direction Embedded In Secondary Location Line | Option C: Conditional Direction Display | Option D: Corridor-Only Direction |
| --- | ---: | ---: | ---: | ---: |
| Mission Alignment | 5 | 4 | 5 | 5 |
| Awareness Value | 5 | 5 | 5 | 4 |
| User Clarity | 4 | 5 | 4 | 4 |
| Trust Impact | 4 | 4 | 5 | 5 |
| County Scalability | 5 | 4 | 5 | 5 |
| Rendering Complexity | 5 | 3 | 4 | 5 |
| Ownership Complexity | 4 | 2 | 3 | 3 |
| Future Compatibility | 5 | 5 | 5 | 5 |
| Implementation Risk | 3 | 3 | 3 | 4 |
| Maintenance Cost | 4 | 3 | 3 | 3 |
| **Total** | **44** | **38** | **42** | **43** |

## Preferred Rendering Model

Preferred model: **Option A with Option C and Option D gates**.

Future implementation should produce a single incident-context location phrase:

`<Incident Type> on <Road Label> <Direction> <Connector> <Anchor>`

Approved examples:

- `Disabled Vehicle on US 90 Westbound at Waco Street`
- `Flooding on FM 1960 Eastbound near Dayton`
- `Traffic Backup on I-69 Northbound near Community Drive`
- `Train Blocking Crossing on TX 146 Southbound`

Approved road-direction style:

- `US 90 Westbound`
- `I-69 Northbound`
- `FM 1960 Eastbound`
- `TX 146 Southbound`

Prohibited language:

- `Toward Houston`
- `Toward Liberty`
- `Inbound`
- `Outbound`
- `Take Route`
- `Avoid Route`
- `Use Route`

Option B should remain a future readability fallback, not the initial implementation target. It should only be reconsidered if validation shows embedded titles exceed acceptable readability or wrapping limits.

## Candidate Source Layer

The candidate source layer for future implementation should be the existing directional awareness service output after it has passed:

1. County containment validation.
2. Corridor or road-asset matching.
3. Direction extraction or bearing classification.
4. Confidence scoring.
5. Fail-closed eligibility evaluation.

The incident-language owner should not consume raw geometry, raw OSM direction, or raw bearing values directly. It should consume a normalized directional incident context object such as:

- `roadLabel`: `US 90`
- `directionLabel`: `Westbound`
- `anchorLabel`: `Waco Street`
- `connector`: `at` or `near`
- `confidence`: protected numeric or tier value
- `eligible`: boolean
- `suppressionReason`: populated when not eligible

This keeps rendering simple and prevents UI surfaces from owning directional extraction logic.

## Eligibility Rules

Directional context is eligible only when all required gates pass:

1. The incident is road-related.
2. The incident has a resolved road label.
3. The road is a protected or directional-ready corridor.
4. The incident location is county-contained.
5. Direction confidence meets or exceeds the required threshold.
6. Direction adds awareness value.
7. The output phrase uses only approved directional wording.
8. The current incident wording can be retained if direction is suppressed.

Eligible incident types include:

- Road hazards.
- Rail crossing incidents that affect a named crossing or named corridor.
- Traffic backup.
- Flooding on or immediately affecting a road corridor.
- Construction or lane-impacting work zones.
- Disabled vehicle.
- Crash or collision reports where the road and direction are confidently known.
- Road closure or lane closure reports where direction is confidently known.
- Debris, stalled vehicle, high-water, washout, or obstruction events tied to a protected corridor.

## Exclusion Rules

Directional context is not eligible for:

- Non-road events.
- Location-ambiguous events.
- Events with no resolved road label.
- Events on unnamed local roads.
- Events on residential roads unless explicitly promoted to a protected corridor in a future county package.
- Private roads.
- Driveways, parking lots, campuses, or facility-only locations.
- General community notices.
- Weather alerts not tied to a road segment.
- Power, utility, fire, medical, law-enforcement, or public-safety events unless the incident explicitly affects a protected road corridor.
- Any event where direction would imply a recommendation, route choice, or navigation action.

## Confidence Rules

Future implementation should use conservative thresholds and fail closed.

Recommended planning thresholds:

| Confidence Input | Required Planning Rule |
| --- | --- |
| County containment | Required pass. No direction may display outside the active county or approved county package. |
| Road/corridor match | Required pass against a protected or directional-ready corridor. |
| Direction confidence | Minimum high-confidence tier, recommended `>= 0.80` if numeric scoring is used. |
| Bearing consistency | Required pass when bearing is part of extraction. |
| Anchor consistency | Required pass when an intersection, crossing, or nearby landmark is displayed. |
| Conflicting candidates | Suppress direction when multiple plausible directions compete. |
| Missing confidence | Suppress direction. |

If the system cannot prove direction, it must not display direction.

## Fallback Rules

Fallback behavior is simple: **retain current wording unchanged**.

Examples:

- If direction passes: `Disabled Vehicle on US 90 Westbound at Waco Street`.
- If direction fails: `Disabled Vehicle on US 90 at Waco Street`.
- If corridor is not eligible: use the existing non-directional incident wording.
- If anchor is unavailable: use the existing current phrase; do not invent a directional phrase.
- If confidence is missing, stale, conflicting, or below threshold: suppress direction.

No placeholder such as `unknown direction`, `possibly westbound`, or `likely northbound` should be user-visible.

## County Containment Requirements

Directional incident context must remain county-contained.

Requirements:

- Direction may display only for the active county context.
- Cross-county road segments must not leak into the active county wording unless explicitly approved by a county package.
- County package readiness must define protected corridors before display.
- Suppression must occur when geometry, anchor, road label, or incident source cannot be contained.
- County expansion must include validation fixtures for corridor labels and direction labels.

## Protected Corridor Considerations

Protected corridors should be governed as a county-owned readiness asset, not inferred casually at render time.

Initial protected corridor classes:

- Interstates.
- US highways.
- Major Texas state highways.
- FM corridors explicitly validated as directionally meaningful.
- Rail crossings only when attached to a protected road corridor or named crossing with reliable road direction.

Protected corridor records should include:

- Canonical road label.
- Accepted aliases.
- Directional vocabulary.
- County containment boundary.
- Segment readiness state.
- Anchor naming rules.
- Exclusion notes for frontage roads, ramps, spurs, and ambiguous split alignments.

## Risk Review

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Long incident titles | Reduced readability | Start with Option A, validate wrapping, and reserve Option B as fallback. |
| False precision | Reduced trust | Require confidence thresholds, protected corridors, and fail-closed suppression. |
| Navigation interpretation | Product drift | Ban route verbs and destination-oriented wording. |
| Ownership displacement | Lost visible context | Future implementation must integrate with the final Awareness Brief/localized-intelligence owner. |
| County inconsistency | Scaling defects | Require county package corridor readiness and label fixtures. |
| Partial coverage | User confusion | Treat suppression as normal; current wording remains unchanged. |
| Over-maintenance | Slower county rollout | Keep corridor-only readiness lightweight and auditable. |

## Implementation Phasing

### Phase 0 — Planning Complete

- V709 document accepted.
- No runtime changes.
- No UI changes.
- No protected-system changes.

### Phase 1 — Ownership Contract Design

- Define the normalized directional incident context object.
- Assign final language ownership to the Awareness Brief/localized-intelligence owner.
- Add test-only fixtures for eligible and suppressed cases.

### Phase 2 — Eligibility and Confidence Contract

- Implement or expose a non-rendering eligibility result.
- Verify suppression reasons.
- Validate county containment and protected corridor readiness.

### Phase 3 — Rendering Authorization Package

- Only after a future authorization, embed direction into the incident location phrase.
- Validate examples across mobile and desktop layouts.
- Ensure no new standalone cards or directional surfaces are created.

### Phase 4 — County Expansion Governance

- Add county-specific protected corridor inventories.
- Audit direction labels and aliases.
- Require regression tests before each county enables display.

## Future Validation Requirements

A future implementation package must validate:

- Direction appears only on eligible incident types.
- Direction appears only on protected or directionally ready corridors.
- Direction never appears for excluded incident types.
- Suppression retains current wording unchanged.
- Confidence below threshold fails closed.
- Conflicting candidates fail closed.
- County containment failure fails closed.
- Prohibited language never appears.
- No route recommendation, alternate route, or navigation copy appears.
- Historical, DriveTexas, and Transportation Intelligence protected states remain unchanged.

## Final Recommendation

Adopt **Option A — Direction Embedded In Location** as the preferred rendering model, with mandatory **Option C — Conditional Direction Display** and **Option D — Corridor-Only Direction** gates.

Do not adopt Option B as the initial implementation model. Keep Option B available only as a future readability fallback if embedded location wording is proven too long.

## Final Determination

V709 determines that future directional incident context should be implemented as confidence-protected, county-contained incident location language. The display should be silent unless all eligibility, corridor, confidence, and containment gates pass.

This plan authorizes future implementation planning only. It does not authorize runtime changes, UI changes, directional rendering changes, alert changes, route changes, navigation changes, county-system changes, Supabase changes, or directional extraction changes.

## Protected Systems Verification

V709 is documentation-only. The protected systems remain unchanged and must continue to be treated as closed or paused:

| Protected System | Required State | V709 State |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Unchanged |
| `historyUiEnabled` | `false` | Unchanged |
| `DriveTexasPaused` | `true` | Unchanged |
| `TransportationIntelligenceEnabled` | `false` | Unchanged |
| `TransportationIntelligenceDisplay` | `false` | Unchanged |
| `TransportationIntelligenceActivation` | `false` | Unchanged |

## Non-Goals Confirmation

V709 does not implement or modify:

- Directional context runtime behavior.
- Awareness ownership.
- Alert rendering.
- Route Watch.
- Destination intelligence.
- Routing.
- Navigation.
- County systems.
- Supabase.
- Directional extraction.
