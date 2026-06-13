# Gridly V284 Directional Validation Strategy

Audit / strategy only. V284 does not implement user-facing directional display, add NB/SB/EB/WB labels, create directional UI, or change production behavior. Alerts, popups, Route Watch, reporting, Supabase, and map rendering remain unchanged.

## 1. Executive Summary

V283 established that directional display can improve incident clarity, but V284 finds that Gridly should not expose direction publicly until display decisions are governed by a stricter, per-incident validation gate. Directional display must answer a travel-impact question, not a corridor-shape question: **which traffic direction is affected by this specific incident?** If Gridly cannot prove that answer with compatible evidence, it must suppress the label and fall back to non-directional copy.

The core safety rule is: **Gridly can safely determine directional awareness only when independent evidence agrees at the incident segment or selected carriageway level. It must not infer travel direction from corridor axis alone.** Corridor axis can validate that a reported direction is plausible, but it cannot be displayed as the affected travel direction.

Current source and geometry signals are useful but uneven:

- TxDOT incidents already expose a normalized `travel_direction` field in the ingestion contract, but that field must be verified against route, segment, and carriageway evidence before display.
- Road name standardization already includes TX 146 and US 90 aliases, which helps corridor matching, but alias normalization is not directional proof.
- Existing language guidance treats US 90 as east / west and TX 146 as north / south examples, but V284 narrows that to **axis validation only** unless incident-level travel evidence is present.
- The prior directional audit already flagged TX 146 and TX 321 as mixed-orientation corridors where corridor-default direction wording can overstate precision.

Data review of `data/liberty-county-road-segments.geojson` confirms why TX 146 and TX 321 are not ready for public directional labels as whole corridors:

| Corridor | Matched road-segment features | Axis distribution observed in repository data | Primary readiness issue |
|---|---:|---|---|
| US 90 | 133 | 133 east / west | Strong corridor axis, but display still requires incident travel evidence. |
| US 59 / I-69 | 66 | 66 north / south | Alias and divided-carriageway validation are the main risks. |
| FM 1960 | 5 | 5 east / west | Good small-corridor pilot candidate if incident evidence is present. |
| FM 1409 | 9 | 9 north / south | Good validation candidate, with low feature count requiring sampling. |
| FM 1011 | 8 | 8 north / south | Needs segment checks because bearings vary and two features are one-way. |
| TX 146 | 87 | 53 east / west, 34 north / south | Mixed corridor due to US 90 overlap and local TX 146 geometry. |
| TX 321 | 40 | 26 east / west, 14 north / south | Mixed corridor due to TX 105 overlap and Cleveland-area routing. |

**Final recommendation: B. Additional Validation Required.** A limited future pilot can be considered after display-gate audits prove that labels are only emitted for incidents with segment-level or source-confirmed travel direction and are suppressed everywhere else.

## 2. Directional Display Gate Proposal

The display gate should be stricter than audit-only directional confidence. Audit confidence may say "this route usually runs east / west" or "this incident has a direction-like token." Display confidence must say "this exact label is safe enough to show to the public for this incident."

### 2.1 Gate Outputs

The gate should return exactly one of three public-copy decisions:

1. **Show directional label**
   - Allowed only when direction is incident-specific and validated.
   - Example: `Crash on US 90 Eastbound`.
2. **Suppress directional label**
   - Required when evidence is missing, conflicting, route-level only, or carriageway-ambiguous.
   - Example: `Crash on US 90`.
3. **Fallback to non-directional or partial-impact copy**
   - Used when a source says there is directional impact but the exact displayed direction is not validated.
   - Example: `Directional impact reported on US 90` or `Traffic impact reported on TX 146`.

### 2.2 Required Conditions to Show Direction

A public directional label should require all of the following:

- **Normalized corridor match:** the incident road name resolves to exactly one known corridor or one validated alias group.
- **Incident-local evidence:** the direction comes from official source direction, TxDOT `travel_direction`, a trusted raw incident direction field, a selected one-way carriageway, or an explicitly selected route segment.
- **Segment compatibility:** the selected road segment bearing supports the proposed direction within a configured tolerance.
- **Axis compatibility:** the proposed travel direction is compatible with the local segment axis, not merely the whole-corridor axis.
- **Carriageway safety:** if parallel same-name candidates are present, Gridly can identify the affected side or must suppress direction.
- **Alias safety:** all aliases involved resolve to the same physical corridor segment and do not cross-contaminate another route.
- **Conflict check:** no credible source reports the opposite direction, both directions, unknown direction, or a direction incompatible with the selected segment.
- **Fallback availability:** the calling surface has a tested neutral fallback string.

### 2.3 Hard Blockers

Directional labels should remain blocked when any of the following occur:

- Direction was inferred only from corridor axis.
- Direction was inferred only from route name, route alias, or road category.
- Incident has point geometry but no trusted selected segment or validated nearest segment.
- Multiple same-name or alias-compatible segments are within the snap radius and carry opposite travel directions.
- The segment is part of a divided road and Gridly cannot determine the affected carriageway.
- Source direction conflicts with local segment bearing.
- Source says `both`, `all`, `unknown`, `various`, or only lane-side wording such as left / right without travel direction.
- The corridor is flagged `not_ready` and no segment-level override passes.
- The copy surface cannot safely fall back to non-directional wording.

### 2.4 Proposed Decision Schema

Future audit-only gate helpers should emit a provenance object like this, but V284 does not implement it:

```json
{
  "displayDecision": "show_direction|suppress_direction|fallback_partial",
  "proposedDirection": "northbound|southbound|eastbound|westbound|null",
  "corridor": "TX 146",
  "segmentId": "source-segment-id-or-null",
  "sourceDirection": "txdot.travel_direction|official_source|raw_incident|selected_carriageway|null",
  "axisUsedForDisplay": false,
  "axisValidation": "pass|fail|not_applicable",
  "carriagewayValidation": "pass|fail|not_required|unknown",
  "aliasValidation": "pass|fail|not_required",
  "conflictValidation": "pass|fail",
  "fallbackCopy": "Train blocking TX 146",
  "blockers": []
}
```

The `axisUsedForDisplay` field should always be `false` for public directional labels. Axis can validate or reject a label, not create it.

## 3. Evidence Source Classification Table

| Evidence source | Recommended classification | Safe for display? | Proper use | Primary risk |
|---|---|---:|---|---|
| Official source direction | Safe for display after validation | Conditional | Primary direction source when tied to an incident and compatible with selected segment. | May describe reporting direction, lane closure direction, or administrative direction rather than traffic impact. |
| TxDOT `travel_direction` | Safe for display after validation | Conditional | Strong source when normalized, route-matched, segment-compatible, and not contradicted. | Must not bypass geometry and alias validation. |
| Raw incident direction fields | Useful only for validation | Usually no | Corroborate official direction or selected segment direction. | Free text and optional fields are noisy. |
| Selected road segment | Safe for display only with source travel evidence or one-way proof | Conditional | Anchor local bearing and route identity. | Segment bearing alone identifies geometry orientation, not affected traffic. |
| One-way carriageway evidence | Safe for display after snap confidence | Conditional | If incident is confidently snapped to a one-way road segment, the one-way travel direction can be display evidence. | Wrong side selection on divided roads creates high user harm. |
| Divided-road side selection | Safe for display only after carriageway validation | Conditional | Distinguish parallel same-name candidates. | Close opposite-direction carriageways can be confused by GPS or point snapping. |
| Local segment bearing | Useful only for validation | No by itself | Check whether proposed direction is compatible with local road shape. | Bearing is not travel impact. |
| Corridor axis | Audit-only / validation-only | No | Determine whether a proposed direction is plausible on a corridor section. | Axis is often mistaken for travel direction. |
| Route aliases | Useful only for validation | No | Normalize US 59 / I-69 / Eastex Freeway, TX 146 variants, TX 321 variants, and FM road variants. | Alias overlap can select the wrong physical road. |
| User-selected location | Useful only for validation | No by itself | Improve snap confidence if user explicitly selected a mapped segment or side. | A point near a divided road is not necessarily the affected carriageway. |
| Route geometry | Useful only for validation | No by itself | Validate local axis, detect curves, find subdivision zones. | Geometry can support direction but cannot prove impacted traffic direction. |
| Lane side words (`left lane`, `right shoulder`) | Audit-only unless paired with travel direction | No by itself | Preserve as lane-detail metadata after direction is known. | Left / right is undefined without travel orientation. |
| Both-direction source tokens | Safe for non-directional impact copy | No single direction | Use `both directions affected` style internally, or fallback to neutral public copy if surface cannot support it. | Displaying one direction would be wrong. |

## 4. Corridor-by-Corridor Validation Strategy

### 4.1 US 90

**Current posture:** Best candidate for a future directional pilot, but only for incidents with incident-specific travel direction. Repository road-segment data matched 133 US 90 features, all with east / west local axes. This makes US 90 strong for axis validation.

**Display strategy:**

- Allow eastbound / westbound labels only when source direction or selected one-way carriageway evidence exists.
- Use the local segment bearing to reject northbound / southbound labels unless the incident is on a validated ramp, connector, or alias exception.
- Suppress direction for rail-crossing blockages unless the source specifies affected travel direction; a crossing blocked at US 90 may affect both directions.

**Blocked until proven:** corridor-axis-only labels such as converting every US 90 incident to eastbound / westbound from road orientation.

### 4.2 US 59 / I-69

**Current posture:** Directionally promising but higher-risk because of alias overlap, freeway-style geometry, frontage roads, ramps, and divided carriageways. Repository road-segment data matched 66 US 59 / I-69 features, all one-way and all north / south axis, which supports validation but also indicates carriageway complexity.

**Display strategy:**

- Treat `US 59`, `I-69`, `I 69`, `Eastex Freeway`, frontage-road labels, and bypass variants as an alias group requiring physical-segment confirmation.
- Require selected carriageway or source direction plus a local one-way segment match.
- Block labels when the nearest candidate could be either main lanes or frontage road unless source or location selection resolves it.

**Blocked until proven:** displaying main-lane direction for frontage-road incidents, or merging US 59 and I-69 aliases without segment-level identity.

### 4.3 FM 1960

**Current posture:** Good candidate for a second-stage pilot. Repository data matched five FM 1960 features, all east / west axis.

**Display strategy:**

- Require source direction or a selected segment with one-way evidence.
- Use local segment bearing as validation, not generation.
- Because feature count is small, require manual QA samples before pilot.

**Blocked until proven:** direction on reports that only say `FM 1960` with no incident-local directional evidence.

### 4.4 FM 1409

**Current posture:** Validation candidate. Repository data matched nine FM 1409 features, all north / south axis.

**Display strategy:**

- Require source direction.
- Use segment bearing to validate northbound / southbound only.
- Suppress direction for ambiguous cross-street or rural location references without selected segment.

**Blocked until proven:** direction labels inferred only from known north / south corridor axis.

### 4.5 FM 1011

**Current posture:** Not a first pilot candidate. Repository data matched eight FM 1011 features, all north / south axis, but with varied local bearings and two one-way features from an FM 834 / FM 1011 overlap.

**Display strategy:**

- Require segment-level validation for every incident.
- Treat overlaps with FM 834 as alias/route-combination risk.
- Use route-segment subdivision where local bearing changes materially.

**Blocked until proven:** corridor-level default northbound / southbound labels.

### 4.6 TX 146

**Current posture:** Critical corridor, not public-display ready as a whole corridor. Repository data matched 87 TX 146 features with mixed axes: 53 east / west and 34 north / south. Many matched features are shared with US 90, so whole-corridor TX 146 direction is ambiguous.

**Display strategy:**

- Do not use TX 146 corridor axis to create direction.
- Permit future per-segment labels only in validated zones where the incident has source direction and the selected segment is unambiguous.
- Separate US 90 / TX 146 overlap from standalone TX 146 before any display pilot.

### 4.7 TX 321

**Current posture:** Critical corridor, not public-display ready as a whole corridor. Repository data matched 40 TX 321 features with mixed axes: 26 east / west and 14 north / south. The data includes TX 105 Business / TX 321 and TX 105 / TX 321 overlaps, which makes route identity and direction ambiguous.

**Display strategy:**

- Do not use TX 321 corridor axis to create direction.
- Permit future per-segment labels only after the TX 105 overlaps are separated into display-safe zones.
- Require official direction plus segment-level confirmation for any pilot entry.

## 5. TX 146 Path-to-Ready Assessment

### 5.1 Why TX 146 Is Currently Failing Readiness

TX 146 fails readiness because it is not a single clean north / south display corridor in the current source geometry. Repository road-segment data includes both standalone TX 146 features and US 90 / TX 146 overlap features. The observed TX 146 match set is mixed: 53 east / west-axis features and 34 north / south-axis features. This means a corridor-level rule such as "TX 146 is northbound / southbound" would produce unsafe labels on overlap or turning sections.

### 5.2 Specific Validation Checks Currently Failing

TX 146 currently fails these display-readiness checks:

- **Corridor-axis uniformity:** fail, because matched segments include both east / west and north / south axes.
- **Alias/overlap isolation:** fail, because many features are tagged `US 90;TX 146`, not just TX 146.
- **Segment selection requirement:** not guaranteed, because incidents may have point geometry and road names without a selected source segment.
- **Carriageway certainty:** not guaranteed, because 42 matched features are one-way while 43 have blank `oneway` and 2 are explicitly `no`.
- **Direction-source availability:** not guaranteed, because not every incident has trusted source direction.
- **Conflict rejection:** not yet auditable as a display gate.

### 5.3 Failure Type

The TX 146 failure is primarily **corridor-level and source-data-level**, with possible **segment-level and carriageway-level** failure for individual incidents.

- Corridor-level: TX 146 is mixed-orientation in the county data.
- Source-data-level: route overlaps are encoded in road references, especially US 90 / TX 146.
- Segment-level: individual incidents need selected segments to know whether they are on the standalone north / south section or overlap/transition sections.
- Carriageway-level: one-way segments require side selection before display.

### 5.4 Can Per-Segment Validation Overcome Corridor-Level Ambiguity?

Yes, but only for specific incidents. A TX 146 incident can become directionally safe if all of these are true:

- The incident snaps to exactly one TX 146-compatible segment or one validated same-direction candidate group.
- The source supplies a travel direction or the selected one-way carriageway supplies a direction.
- The local segment bearing is compatible with the proposed display label.
- The segment is not an unresolved US 90 / TX 146 overlap or transition unless alias identity is explicitly resolved.

Per-segment validation should not make the whole corridor ready; it should create small display-safe zones.

### 5.5 Can Official Source Direction Resolve Ambiguity?

Official source direction can resolve TX 146 ambiguity only when it is tied to the affected route segment. For example, `travel_direction = southbound` is valuable if the incident is snapped to a standalone TX 146 segment whose local axis supports north / south travel. The same field is not sufficient if the point could be on US 90 / TX 146 overlap, a frontage/connector, or a nearby parallel carriageway.

### 5.6 Can Local Geometry Clustering Improve Confidence?

Yes. TX 146 should be clustered into geometry zones such as:

- Standalone north / south TX 146 segments.
- US 90 / TX 146 overlap segments.
- Transition segments where bearing changes.
- One-way or divided sections requiring carriageway selection.

Clustering can mark which zones are eligible for display-gate testing, but clustering alone is validation support, not display evidence.

### 5.7 Can Route-Segment Subdivision Create Safer Directional Zones?

Yes. TX 146 should be subdivided into display zones with independent readiness states:

- **Zone A: standalone TX 146 north / south section** — possible future candidate after source-direction and segment-snap audits pass.
- **Zone B: US 90 / TX 146 overlap** — blocked until alias identity and axis interpretation are explicitly handled.
- **Zone C: transition/turning segments** — blocked until local bearing, source direction, and copy behavior are tested.
- **Zone D: one-way/divided sections** — blocked unless selected carriageway is known.

### 5.8 Additional Data Required

TX 146 needs:

- Stable segment IDs for matched road features.
- Official or TxDOT source direction on incidents.
- A route-alias table that distinguishes standalone TX 146 from US 90 / TX 146 overlap.
- Carriageway side metadata for one-way or divided sections.
- Segment snap distance, candidate count, and confidence metrics.
- QA samples comparing source location text, point geometry, selected segment, and proposed display label.

### 5.9 What Would Make TX 146 Safe Enough for Display?

TX 146 should become display-safe only for incidents that pass a per-incident display gate:

- Source direction exists and is normalized.
- Selected segment is uniquely identified.
- Local segment axis supports the source direction.
- Segment is in a pre-approved TX 146 display zone.
- Alias overlap is resolved or not present.
- Carriageway validation passes when required.
- The fallback copy has been tested on every calling surface.

### 5.10 What Should Remain Blocked for TX 146?

Keep blocked:

- Whole-corridor TX 146 directional defaults.
- Direction labels for US 90 / TX 146 overlap without alias and segment resolution.
- Direction labels where selected side of a divided road is unknown.
- Direction labels based only on local bearing.
- Direction labels based only on user point location near multiple candidates.
- Any TX 146 label in alerts, Route Watch, or Awareness Brief until popup pilot evidence proves safety.

## 6. TX 321 Path-to-Ready Assessment

### 6.1 Why TX 321 Is Currently Failing Readiness

TX 321 fails readiness because current repository geometry is mixed-orientation and includes route overlaps with TX 105 and TX 105 Business. Road-segment data matched 40 TX 321 features: 26 east / west-axis features and 14 north / south-axis features. The matched names include `TX 105 Business;TX 321`, `TX 105;TX 321`, standalone `TX 321`, and `TX 321 | North Cleveland Street`. That mix prevents a safe corridor-wide direction default.

### 6.2 Specific Validation Checks Currently Failing

TX 321 currently fails these checks:

- **Corridor-axis uniformity:** fail, because the matched segment set is mixed east / west and north / south.
- **Alias/overlap isolation:** fail, because TX 321 appears with TX 105 and TX 105 Business overlap references.
- **Route identity certainty:** fail for incidents near shared TX 105 / TX 321 sections unless the selected segment is explicit.
- **Segment subdivision:** not yet defined for Cleveland-area, overlap, and standalone sections.
- **Carriageway certainty:** not guaranteed, because six matched features are one-way and the rest do not provide one-way display proof.
- **Direction-source validation:** not yet audited as an incident-level display gate.

### 6.3 Failure Type

The TX 321 failure is primarily **corridor-level and source-data-level**, with likely **segment-level** ambiguity in overlap areas and possible **carriageway-level** ambiguity on one-way sections.

### 6.4 Can Per-Segment Validation Overcome Corridor-Level Ambiguity?

Yes, for individual incidents. A TX 321 incident can be directionally safe even if the whole corridor remains mixed, but only when the incident has a unique selected segment and a validated source direction. Per-segment validation is especially important near TX 105 / TX 321 overlaps because the public label should not imply the wrong route or travel axis.

### 6.5 Can Official Source Direction Resolve Ambiguity?

Official source direction can help but should not be treated as sufficient by itself. On TX 321, a source `eastbound` or `westbound` value may be correct for a TX 105 / TX 321 overlap section, while `northbound` or `southbound` may be correct for another local segment. The display gate must validate the source value against the selected segment and alias group.

### 6.6 Can Local Geometry Clustering Improve Confidence?

Yes. TX 321 should be clustered into:

- TX 105 Business / TX 321 overlap.
- TX 105 / TX 321 overlap.
- Standalone TX 321 segments.
- North Cleveland Street-labeled sections.
- One-way or urban segments requiring selected-side validation.

This clustering can identify where direction labels may be eligible in the future and where they should remain blocked.

### 6.7 Can Route-Segment Subdivision Create Safer Directional Zones?

Yes. Recommended TX 321 zones:

- **Zone A: standalone TX 321 north / south-compatible sections** — possible future candidate after source direction and unique segment snapping pass.
- **Zone B: TX 105 / TX 321 overlap** — blocked until route identity and public naming rules are defined.
- **Zone C: TX 105 Business / TX 321 overlap** — blocked until alias and route-priority rules are defined.
- **Zone D: urban one-way sections** — blocked unless carriageway side is known.

### 6.8 Additional Data Required

TX 321 needs:

- Stable segment IDs.
- Explicit route-overlap metadata for TX 105, TX 105 Business, and TX 321.
- Incident source direction tied to the selected road segment.
- Segment-snap confidence and candidate counts.
- Local route-name priority rules for public copy.
- QA samples across overlap and standalone zones.

### 6.9 What Would Make TX 321 Safe Enough for Display?

TX 321 should become display-safe only when:

- The incident is in a pre-approved TX 321 subdivision zone.
- Route overlap has been resolved for public naming.
- Source direction exists and is compatible with the selected segment.
- Carriageway validation passes when one-way or divided sections are involved.
- Fallback copy works on all target surfaces.

### 6.10 What Should Remain Blocked for TX 321?

Keep blocked:

- Corridor-wide TX 321 defaults.
- TX 105 / TX 321 and TX 105 Business / TX 321 overlap labels without route identity resolution.
- Any axis-derived direction label.
- Any label where incident point geometry could match multiple segments with different axes.
- Alerts, Route Watch, Awareness Brief, and map marker direction until a lower-risk popup pilot proves the display gate.

## 7. Surface-Specific Directional Strategy

| Surface | Minimum confidence | Allowed direction sources | Fallback copy | Risk level | Recommended rollout order |
|---|---|---|---|---|---:|
| Hazard Popups | High display confidence for the specific incident | Official source direction or TxDOT `travel_direction` validated by selected segment; selected one-way carriageway with unique snap | `Crash on US 90`; `Train blocking TX 146`; `Traffic impact reported on TX 146` | Medium | 1 |
| Alerts | Very high confidence plus popup pilot success | Same as popups, plus copy QA and alert dedupe safety | `Crash on US 90`; `Traffic impact reported on US 90` | High | 3 |
| Route Watch | Very high confidence plus route-leg compatibility | Source direction validated against incident segment and user's affected route direction | `Issue reported on your route near US 90`; `Traffic impact reported on TX 146` | Very high | 4 |
| Awareness Brief | High confidence only after alerts prove safe | Official or TxDOT direction validated by segment and corridor zone | `Flooding reported on TX 146`; `Traffic impact reported on TX 146` | High | 5 |
| Map markers | Do not put direction in marker icon; popup-only label if gate passes | None for icon; popup may use gated direction | Non-directional marker and popup title | Medium-high | 2 for popup text; never for icon by default |

Surface rule: **the earlier the surface interrupts or summarizes user decisions, the stricter the gate must be.** A wrong direction in Route Watch is more harmful than a suppressed direction in a popup.

## 8. Copy Fallback Contract

Directional copy must be optional. Every surface that requests a directional label must also supply a neutral fallback and a partial-known fallback.

### 8.1 Safe Direction Known

Use only when the display gate returns `show_direction`:

- `Crash on US 90 Eastbound`
- `Train blocking TX 146 Southbound`
- `Construction on US 59 / I-69 Northbound`
- `Flooding on FM 1960 Westbound`

### 8.2 Direction Not Safe

Use when the gate returns `suppress_direction`:

- `Crash on US 90`
- `Train blocking TX 146`
- `Construction on US 59 / I-69`
- `Flooding on FM 1960`

### 8.3 Direction Partially Known or Source-Reported but Not Display-Safe

Use when the gate returns `fallback_partial`:

- `Directional impact reported on US 90`
- `Traffic impact reported on TX 146`
- `Directional closure reported on US 59 / I-69`
- `Traffic impact reported near FM 1409`

### 8.4 Copy Rules

- Never convert corridor axis into travel direction.
- Never display `NB/SB/EB/WB` abbreviations in the first pilot; use full words if display is later approved.
- Never show direction if fallback copy is unavailable.
- Never combine uncertain direction with urgent wording such as `avoid eastbound`.
- If both directions are affected, prefer `Traffic impact reported on [road]` unless a surface has explicit approved both-direction copy.

## 9. Pilot Rollout Recommendation

### Phase 0: Audit-Only Gate Design

Before any display, define and run audit helpers that simulate the display gate without changing copy. Required pass conditions:

- Every incident receives a gate decision and blockers.
- No axis-only incident receives `show_direction`.
- All focus corridors have corridor and per-segment readiness summaries.
- Fallback copy exists for every surface.

### Phase 1: First Corridor Pilot Candidate — US 90 Hazard Popups

US 90 should be the first candidate because the repository segment match set is consistently east / west, making it good for validating source direction against local axis. Entry criteria:

- Only hazard popups, not alerts or Route Watch.
- Only incidents with official or TxDOT source direction.
- Selected segment must be unique.
- Direction must be eastbound or westbound and compatible with local segment.
- Rail-crossing incidents default to non-directional unless source explicitly identifies affected travel direction.

### Phase 2: Second Corridor Candidate — FM 1960 or FM 1409

FM 1960 is the recommended second corridor if east / west sample coverage is sufficient. FM 1409 is a good north / south validation counterpart. Entry criteria:

- Phase 1 audit results show no false positive labels.
- Manual QA validates segment snapping.
- Source-direction coverage is sufficient.
- No corridor-axis-only labels are emitted.

### Phase 3: US 59 / I-69 Controlled Freeway Pilot

US 59 / I-69 should wait until alias and carriageway validation are proven. Entry criteria:

- US 59 / I-69 / Eastex Freeway aliases resolve to a physical segment group.
- Main lanes and frontage roads are distinguished.
- One-way carriageway checks pass.
- Wrong-side snap rate is measured and acceptable.

### Phase 4: TX 146 Path-to-Ready Pilot

TX 146 can enter a limited pilot only after subdivision zones are defined. Entry criteria:

- Standalone TX 146 zones are separated from US 90 / TX 146 overlap zones.
- At least one zone has stable segment IDs, source direction, and unique snapping.
- Overlap zones remain blocked.
- Popup-only display has safe fallback copy.

### Phase 5: TX 321 Path-to-Ready Pilot

TX 321 should enter after TX 146 because it requires TX 105 / TX 105 Business overlap handling. Entry criteria:

- TX 321 subdivision zones are defined.
- TX 105 and TX 105 Business overlaps have public naming rules.
- Source direction and selected segment agree for pilot incidents.
- Urban one-way segments are blocked unless carriageway side is validated.

## 10. Required Future Audits

V284 recommends future audit helpers only. Do not implement them until explicitly requested.

### 10.1 `window.gridlyDirectionalDisplayGateAudit?.()`

Should check:

- Per-incident gate output: show, suppress, or fallback.
- Whether source direction exists.
- Whether axis was used only for validation.
- Whether segment snap was unique.
- Whether carriageway validation was required and passed.
- Whether alias validation passed.
- Whether fallback copy exists for each target surface.
- List of blockers for every suppressed case.
- Count of labels that would be shown by corridor and source.
- Hard fail if any axis-only case would display direction.

### 10.2 `window.gridlyDirectionalCorridorPathToReadyAudit?.()`

Should check:

- Corridor readiness for US 90, US 59 / I-69, FM 1960, FM 1409, FM 1011, TX 146, and TX 321.
- Segment count, axis distribution, one-way distribution, alias groups, and overlap routes.
- Which corridors are ready, conditionally ready, not ready, or blocked.
- Specific path-to-ready blockers for TX 146 and TX 321.
- Candidate subdivision zones and their readiness state.

### 10.3 `window.gridlyDirectionalIncidentValidationAudit?.()`

Should check each active incident for:

- Normalized road and alias group.
- Candidate segment IDs and snap distances.
- Selected segment ID and local bearing.
- Source direction and raw direction tokens.
- Compatibility between source direction and local bearing.
- Carriageway side ambiguity.
- Divided-road candidate count.
- Final gate decision and fallback copy.

### 10.4 `window.gridlyDirectionalAliasAudit?.()`

Should check:

- US 59 / I-69 / Eastex Freeway alias normalization.
- TX 146 standalone vs US 90 / TX 146 overlap.
- TX 321 standalone vs TX 105 / TX 321 and TX 105 Business / TX 321 overlap.
- FM road variants and spelling differences.
- Cases where multiple aliases produce different physical segment candidates.

### 10.5 `window.gridlyDirectionalCarriagewayAudit?.()`

Should check:

- Parallel same-name candidates within snap radius.
- Opposite one-way directions within proximity.
- Main lane vs frontage-road candidates.
- Divided-road side selection.
- Whether an incident point is centered between carriageways.
- Whether the selected side is source-confirmed or only nearest-geometry inferred.

## 11. Final Go / No-Go Recommendation

**Recommendation: B. Additional Validation Required.**

Gridly should not begin user-facing directional display yet. Directional display is promising, and US 90 may become safe for a limited popup pilot, but the current system needs a strict display gate, per-incident provenance, alias validation, carriageway validation, and corridor path-to-ready audits before any public label appears.

### Go Conditions for a Limited Future Pilot

A future limited pilot can begin only when all of these are true:

- Display-gate audit exists and proves no axis-only labels are emitted.
- US 90 or another pilot corridor has incident-level source direction and unique selected segments.
- Fallback copy is verified on the chosen surface.
- TX 146 and TX 321 remain blocked except for explicitly approved subdivision zones.
- Alerts, Route Watch, Awareness Brief, reporting, Supabase, and map rendering remain unchanged during the first pilot.

### No-Go Conditions That Must Remain in Force

Do not ship directional display if:

- Any label depends on corridor axis alone.
- TX 146 or TX 321 is treated as ready at whole-corridor level.
- Divided-road side selection is unresolved.
- Alias overlap is unresolved.
- The destination or Route Watch experience would use direction before popup-only pilot evidence exists.

V284 therefore closes as a validation strategy, not an implementation phase.
