# Gridly V312 — Road Hazard Location Description Audit

## 1. Quick summary

V312 is audit-only and does not change production wording, resolver output, formatter behavior, coordinates, placement, alert generation, crossings, Route Watch, Active Route Context, Supabase sync, or data models.

For road hazards only, the strongest future strategy is a four-tier hierarchy: true intersection when verified, crossing-reference when the hazard is best oriented by a named crossing, community-distance when there is no meaningful intersection or crossing reference, and the current nearest-road model as the fallback.

The current road-hazard wording is generally safe but often underspecified. It usually identifies the hazard type and a road/corridor, but it can leave drivers asking where along a long road segment the issue is. Crossing wording should remain untouched because the crossing location system already has reviewed crossing naming and crossing-specific context.

## 2. Current road-hazard wording audit

### Surfaces reviewed

| Surface | Current road-hazard location behavior | Audit finding |
| --- | --- | --- |
| Awareness headlines | Headline models commonly combine event type with road or awareness-area context. | Useful for broad awareness, but not always precise enough for corridor-scale hazards. |
| Alert cards | Road hazards use an event-first title and a `Reported near {locationLabel}` location line. Crossing-related cards use crossing-specific evidence separately. | Good card anatomy, but road hazards currently lean on a single location label rather than a richer road-plus-reference phrase. |
| Hazard popups | Hazard popups resolve a road label and render `Reported on {roadLabel}` for normal hazards or `Reported near {roadLabel}` for other hazards. | Clear but corridor-only in many cases; does not consistently expose nearest intersection, crossing, or community-distance context. |
| Route impact language | Route-relevant markers and route-impact state are derived separately from wording. | Future location copy changes should not change route relevance or marker priority behavior. |
| Route detail language | Existing route detail models consume incident fields and route context. | Future wording should be presentation-only and avoid changing route calculations or incident scoring. |
| Unified incident popups | Unified popups delegate rail/crossing incidents to crossing popup models and road incidents to hazard popup models. | Road hazard copy can evolve independently if the rail/crossing branch remains unchanged. |

### Existing production pattern

Current road-hazard phrasing is best described as a nearest-road / nearest-location model:

- Event title: `Road Closed`, `Crash / Wreck`, `Flooding`, `Construction`, `Disabled Vehicle`, `Downed Power Line`, `Livestock on Road`, or `Road Hazard`.
- Location line: usually `Reported near {locationLabel}` on alert cards.
- Popup location line: usually `Reported on {roadLabel}` or `Reported near {roadLabel}`.
- Longer headline examples can become `Road Closed on US 90 near Sawmill Road` when upstream fields include both road and reference-road terms.

This is technically safe because it rarely overclaims a precise intersection. Its weakness is that a long-road label plus a weak nearby-road label can be less useful than a driver-oriented reference such as a verified intersection, a known rail crossing, or distance from Dayton/Liberty/Cleveland.

## 3. Road-hazard scenario inventory

| Scenario | Example | Current nearest-road usefulness | Better future reference candidate | Notes |
| --- | --- | ---: | --- | --- |
| Highway hazard near crossing | Road Closed on US 90 near Waco Street crossing | Medium | Crossing-reference or true-intersection, depending on geometry | Use crossing reference only as a navigation landmark; do not alter crossing naming. |
| Highway hazard with no nearby intersection | Flooding on TX 146 between rural segments | Low to medium | Community-distance | Distance from a recognized town is more useful than a weak unnamed road. |
| Town-street hazard | Crash on Main Street near Travis Street | High | True-intersection | Drivers understand town-street intersections quickly. |
| Rural FM road hazard | Livestock on FM 1410 near Hull | Medium | Community-distance or verified reference road | Community anchor often beats a minor private/field road reference. |
| County road hazard | Downed Power Line on CR 676 | Medium | True-intersection if present; otherwise community-distance | County road names may be valid but need orientation if the segment is long. |
| Inside city limits | Construction on US 90 in Dayton | Medium | True-intersection first, then city/community-distance | City context helps local triage but should not replace road/intersection detail. |
| Outside city limits | Disabled Vehicle on US 90 east of Dayton | High | Community-distance | Distance and cardinal direction are often the clearest rural mental model. |
| Hazard near a named business/landmark | Emergency Response on TX 146 near a school or public facility | Medium | True-intersection first; landmark only if validated in existing data | Avoid introducing unverified POI claims during wording work. |
| Multiple incidents on same corridor | Crash and Road Closed both on US 90 | Low without references | Intersection/crossing/community-distance differentiators | Prevents multiple cards from looking identical. |
| Other Hazard with weak subtype | Other Hazard near this area | Low | Any verified tier above fallback | Generic event types need stronger location context to be actionable. |

## 4. Candidate strategy comparison

### A. Current nearest-road model

Example: `Road Closed on US 90 near Sawmill Road`

Strengths:

- Conservative and low-risk.
- Uses fields the app already knows how to resolve.
- Avoids implying a true intersection when only nearest-road data exists.

Weaknesses:

- Can feel vague on long highways.
- A nearby road may be technically nearest but not recognizable.
- Multiple hazards on the same corridor can be hard to distinguish.

### B. Crossing-reference model

Example: `Road Closed on US 90 near the Waco Street crossing`

Strengths:

- Highly useful where the rail crossing is a known local landmark.
- Works well for highway hazards near a reviewed crossing.
- Preserves crossing location system if used as a read-only reference.

Weaknesses:

- Must not imply the crossing itself is blocked unless the incident is a crossing incident.
- Requires careful distance thresholds and copy guardrails.
- Can confuse users if a road hazard is near, but not at, a crossing.

### C. Community-distance model

Example:

`Road Closed on US 90`

`1.5 miles east of Dayton`

Strengths:

- Strong for travelers and rural road segments.
- Avoids obscure reference roads.
- Gives quick orientation even without a true intersection.

Weaknesses:

- Requires reliable town/community anchors and distance/cardinal calculations.
- Less precise inside a dense town grid where intersections are better.
- Needs consistent rounding and direction language.

### D. True-intersection model

Example: `Road Closed on US 90 at Waco Street`

Strengths:

- Best clarity when the incident is actually at a verified intersection.
- Concise and familiar to drivers.
- Strong for town-street hazards and highway junctions.

Weaknesses:

- Highest overclaim risk if derived from nearest-road data only.
- Requires evidence that a true intersection exists and the hazard is at/very near it.
- Needs safeguards to avoid converting crossing references into false intersections.

## 5. Scoring table

Scores use 1 = weak / high burden and 5 = strong / low burden. For implementation complexity and regression risk, a higher score means easier or lower risk.

| Strategy | Clarity | Local usefulness | Traveler usefulness | Consistency | Awareness value | Implementation complexity | Regression risk | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A. Current nearest-road | 3 | 3 | 2 | 5 | 3 | 5 | 5 | 26 |
| B. Crossing-reference | 4 | 5 | 4 | 3 | 4 | 3 | 3 | 26 |
| C. Community-distance | 4 | 4 | 5 | 4 | 5 | 3 | 4 | 29 |
| D. True-intersection | 5 | 5 | 5 | 4 | 5 | 2 | 2 | 28 |

Interpretation:

- True-intersection is the best user-facing phrase when verified, but it has the highest correctness burden.
- Community-distance has the best broad usefulness for rural/highway hazards and should become the primary fallback after verified intersections/crossings.
- Crossing-reference is valuable as a landmark tier, not as a replacement for crossing incident copy.
- Current nearest-road remains important as the safe fallback.

## 6. Regression-risk assessment

| Risk | Severity | Why it matters | Mitigation for future implementation |
| --- | --- | --- | --- |
| False precision from nearest-road data | High | `at Waco Street` is misleading if the hazard is only nearby. | Require explicit intersection evidence or strict geometry thresholds before using `at`. |
| Crossing system contamination | High | Crossing labels, popups, reports, and reviewed overrides are out of scope. | Treat crossing names as read-only landmarks for road hazards; do not change crossing resolvers. |
| Route-scoring side effects | High | Wording must not affect Route Watch, Active Route Context, route calculations, or alert generation. | Add presentation-only fields and keep route relevance consumers on existing data. |
| Duplicate/inconsistent surfaces | Medium | Alert cards, popups, awareness headlines, and route details could diverge. | Introduce one road-hazard presentation-location formatter used only by display surfaces. |
| Confusing crossing vs road incident | Medium | Users may think a train/crossing issue exists when only a road hazard exists nearby. | Use `near the {name} crossing`, never `at the crossing`, unless the incident type is crossing-related. |
| Community anchor disputes | Medium | A location can be between towns or outside city limits. | Use nearest recognized community plus distance/cardinal direction, with conservative thresholds. |
| Long or cluttered cards | Low to medium | Two-line community-distance descriptions may crowd alert cards. | Use title + compact location line in cards; allow richer line in popups/details. |
| Data availability gaps | Low | Some hazards only have coordinates and category. | Keep nearest-road / this-area fallback. |

## 7. Recommended hierarchy

For road hazards only, evaluate a future presentation hierarchy like this:

1. **True intersection** — Use `on {primaryRoad} at {crossStreet}` only when a true intersection is explicitly known or confidently verified by geometry.
2. **Crossing reference** — Use `on {primaryRoad} near the {crossingName} crossing` when a road hazard is near a reviewed/known crossing but is not itself a crossing incident.
3. **Community-distance reference** — Use `on {primaryRoad}, {distance} {direction} of {community}` when no verified intersection or crossing reference is better, especially outside city limits and on long corridors.
4. **Nearest-road fallback** — Use the current `on/near {roadLabel}` style when only the current road/nearest-location evidence exists.

The hierarchy should be evidence-driven rather than text-driven. A future formatter should record which tier was selected and why, but should not mutate the underlying incident.

## 8. Recommended future implementation scope

A future implementation phase should be limited to road-hazard presentation text and diagnostics:

- Add a road-hazard-only presentation-location resolver that returns a display model such as `tier`, `primaryRoad`, `referenceLabel`, `distanceMiles`, `direction`, `community`, `phrase`, and `evidence`.
- Wire that model only into road-hazard awareness headlines, road-hazard alert cards, road-hazard popups, and road-hazard route-detail text.
- Preserve existing crossing popup, crossing label, crossing review override, crossing coordinate, FRA, reporting, Route Watch, Active Route Context, route calculation, alert generation, Supabase, hazard coordinate, and data-model behavior.
- Add audit fixtures covering the scenario inventory in this document.
- Add diagnostics that compare old phrase vs selected future phrase without changing production copy until reviewed.
- Add copy guardrails: `at` only for true intersections; `near the {name} crossing` only for landmark references; community-distance outside dense town grids; fallback when evidence is weak.

## 9. Merge recommendation

Merge V312 as an audit/documentation change only.

Do not implement production wording changes in V312. The recommended next phase should be a shadow-mode road-hazard presentation resolver that produces diagnostics and side-by-side candidate phrases before any user-facing wording is changed.
