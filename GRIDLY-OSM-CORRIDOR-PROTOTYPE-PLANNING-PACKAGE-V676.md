# GRIDLY V676 — OSM Corridor Prototype Planning Package

## Mission alignment

Gridly remains **Awareness Platform First** and **Route Intelligence Second**. V676 is a documentation-only planning package for knowing before going: it defines how a future milestone could safely evaluate whether OpenStreetMap (OSM) can provide trustworthy directional intelligence for major Gridly corridors without guessing, without runtime behavior changes, and without user-facing directional display.

V676 does **not** authorize implementation, activation, DriveTexas integration, Transportation Intelligence activation, route guidance, TIGER replacement, county-road asset replacement, Supabase changes, new counties, or framework changes.

## Protected systems verification

The following protected states remain required and unchanged by this package:

| Protected system | Required state | V676 posture |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Preserved; no runtime edits. |
| `historyUiEnabled` | `false` | Preserved; no UI edits. |
| `DriveTexasPaused` | `true` | Preserved; no DriveTexas activation or dependency. |
| `TransportationIntelligenceEnabled` | `false` | Preserved; planning only. |
| `TransportationIntelligenceDisplay` | `false` | Preserved; directional display remains blocked. |
| `TransportationIntelligenceActivation` | `false` | Preserved; no activation path added. |

V676 intentionally avoids `js/app.js`, runtime assets, Supabase configuration, county road geometry, and TIGER assets.

## V675 findings recap

V675 concluded that OSM can only be considered as a supplemental, corridor-only directional catalog after evidence proves route identity, geometry continuity, county containment, and directional confidence. V675 also identified high false-directional-confidence and user-trust risks, medium-to-high route-relation and DriveTexas mapping risks, and the need to keep TIGER as the baseline awareness geometry. V676 therefore scopes only a future prototype planning package and keeps all display and activation blocked.

## Prototype objectives

A future V677 prototype, if separately authorized, should answer a narrow question: can one major corridor be extracted, clipped, normalized, and scored well enough to determine whether OSM directional metadata is trustworthy for internal evaluation?

The smallest safe prototype would:

1. Select one corridor only.
2. Use approved county scope only: Liberty County, Montgomery County, and San Jacinto County.
3. Acquire OSM data only for the selected corridor and immediate OSM features required to prove continuity and directionality.
4. Produce offline artifacts only, not runtime display.
5. Score directional confidence with explicit evidence and blockers.
6. Compare bundle/storage size before any runtime loading is considered.
7. Keep TIGER as the existing awareness baseline and OSM as supplemental evidence only.

## Corridor candidate comparison

| Candidate corridor | Route identity strength | Corridor continuity | OSM relation quality expectation | County relevance | Directional confidence potential | Future transportation-awareness value | Prototype posture |
| --- | --- | --- | --- | --- | --- | --- | --- |
| US 59 / I-69 | Very strong because the corridor has major US and interstate identities, divided carriageways, controlled-access segments, frontage-road complexity, and regional recognition. | Strong through the Gridly region, with meaningful cross-county continuity and a recognizable north-south/east-west travel spine. | Expected to be among the strongest candidates because major highway relations and refs are likely better maintained than local roads, but must still be proven from extracted data. | High for Liberty and Montgomery; relevant for regional movement near the broader three-county Gridly footprint. | High potential if carriageways, one-way semantics, relation membership, and route refs align; blocked where frontage roads or ramps confuse identity. | High because major incidents on this corridor are likely to matter for awareness without requiring route guidance. | **Preferred prototype.** |
| US 90 | Strong US route identity and important Liberty County relevance. | Moderate to strong, but less useful as a three-county prototype because relevance is more concentrated in Liberty. | Likely adequate for route identity, but divided directional evidence may vary by segment. | High for Liberty; lower for Montgomery and San Jacinto. | Moderate; may prove route identity but less likely to stress divided-corridor directional rules than US 59 / I-69. | Medium to high for Liberty-focused awareness. | Good later candidate after the first major-corridor prototype. |
| TX 146 | Strong state-highway identity. | Moderate; important locally but less cross-county representative for the current three-county scope. | Likely variable near transitions and local naming. | Primarily Liberty/nearby regional relevance, less Montgomery/San Jacinto value. | Moderate; directional inference may depend heavily on geometry and local segment structure. | Medium for localized awareness. | Not first; narrower relevance. |
| TX 321 | Strong local state-highway identity. | Moderate; valuable in Liberty County but not the best regional corridor. | Likely adequate route refs but may have less rich relation evidence than major US/interstate corridors. | High in Liberty, limited for the broader three-county scope. | Moderate; may not test complex major-corridor directionality. | Medium for county awareness. | Not first; useful follow-up. |
| FM 1960 | Strong local and commuter identity. | Moderate to fragmented for current Gridly county scope; naming and urban segment complexity may be high. | Potentially inconsistent due to local names, route refs, and dense-road context. | More peripheral to the three-county operational focus. | Medium but high false-confidence risk because local naming and geometry can be complex. | Medium if future expansion emphasizes commuter corridors. | Not first; too noisy for smallest safe prototype. |
| SH 105 | Strong regional identity. | Stronger west-east relevance in Montgomery and Liberty context, with possible continuity value. | Potentially good but must be proven, especially through local alignments and intersections. | High for Montgomery/Liberty; less direct San Jacinto value. | Medium to high, but divided-carriageway evidence may be less consistent than US 59 / I-69. | High for regional awareness. | Strong alternate if US 59 / I-69 fails acquisition feasibility. |
| SH 150 | Clear state-highway identity. | Moderate and especially relevant to San Jacinto-area movement. | Likely smaller and easier to inspect, but may not represent major divided-corridor challenges. | High for San Jacinto; less balanced across the three counties. | Moderate; simpler geometry may make confidence easier but less representative. | Medium for local awareness. | Good later San Jacinto-focused candidate. |

## Preferred prototype corridor

**Preferred corridor: US 59 / I-69.**

US 59 / I-69 is the best first prototype because it has the strongest route identity, the best chance of OSM relation and `ref` support, meaningful Liberty/Montgomery relevance, high regional awareness value, and enough divided-corridor complexity to test whether Gridly can reject unsupported directional claims rather than merely succeed on an easy corridor. If this corridor cannot pass without guessing, directional display should remain blocked for all corridors.

## County containment strategy

A future prototype must enforce county containment before any catalog is treated as eligible evidence:

1. Use only the approved county slugs: `liberty-tx`, `montgomery-tx`, and `san-jacinto-tx`.
2. Clip extracted OSM ways to authoritative county boundary polygons already approved by Gridly governance; do not add counties.
3. Preserve original OSM relation and way identifiers as metadata, but mark any geometry crossing a county boundary as `boundary_cut: true`.
4. Reject candidate segments whose centroid and clipped geometry cannot be assigned to exactly one approved county.
5. Keep out-of-scope continuation metadata non-runtime and non-displayable.
6. Fail the prototype if continuity requires unapproved counties or if county clipping changes directional interpretation.

## OSM acquisition strategy

A future V677 prototype should acquire only a corridor-specific OSM extract, not a full-road county extract. Required OSM inputs would include:

- OSM route relations for `US 59`, `I 69`, and any concurrent refs used by the corridor.
- OSM ways that are members of those relations within the approved county scope.
- `highway`, `ref`, `name`, `oneway`, `junction`, `bridge`, `tunnel`, `lanes`, `destination`, and relation-role metadata where present.
- Immediate connector/ramp/frontage-road features only if needed to distinguish mainline identity from non-mainline geometry.
- Extraction date, source planet/replication timestamp, query text, and checksum.

The prototype should not acquire DriveTexas data, live incident data, Supabase data, or non-corridor OSM road networks.

## OSM preprocessing strategy

Preprocessing should be offline and reproducible:

1. Filter by candidate relation membership and route refs.
2. Normalize route refs (`US 59`, `I-69`, `I 69`, and equivalent tagging variants) into a canonical corridor ID.
3. Split ways at county boundaries, intersections, and relation discontinuities.
4. Classify each feature as `mainline`, `frontage`, `ramp`, `connector`, or `excluded_unknown` using tags and relation context.
5. Remove or quarantine segments with conflicting route identity.
6. Compute segment bearings only as supporting evidence, never as standalone direction proof.
7. Produce an audit table showing every accepted, rejected, and quarantined segment with reasons.
8. Generate a non-runtime corridor catalog candidate for measurement only.

## Corridor catalog design

A future offline catalog should be minimal and explicit:

```json
{
  "corridorId": "us-59-i-69",
  "source": "osm",
  "runtimeEligible": false,
  "displayEligible": false,
  "segments": [
    {
      "segmentId": "stable-derived-id",
      "county": "liberty-tx",
      "osmWayIds": [],
      "osmRelationIds": [],
      "routeRefs": ["US 59", "I-69"],
      "classification": "mainline",
      "directionalEvidence": {
        "oneway": null,
        "carriagewayPairing": "unproven",
        "bearingBand": "supporting_only",
        "relationRole": null
      },
      "confidenceScore": 0,
      "confidenceStatus": "blocked",
      "blockers": ["prototype_not_authorized_for_display"]
    }
  ]
}
```

The catalog must remain an offline artifact until a later milestone separately authorizes any runtime use.

## Directional confidence framework

Directional confidence must be calculated by evidence, not guessing. A proposed score uses 100 possible points with mandatory blockers:

| Evidence area | Points | Requirement |
| --- | ---: | --- |
| Route identity | 25 | Segment is in expected OSM relation or has matching normalized `ref` and `name` evidence. |
| Geometry continuity | 20 | Segment connects to adjacent accepted mainline segments without unexplained gaps, overlaps, or reversals. |
| Directional semantics | 25 | Direction is supported by one-way tags, paired carriageway structure, relation roles, or other explicit OSM evidence. |
| County containment | 15 | Segment is fully clipped and assigned to one approved county without ambiguous boundary behavior. |
| Conflict review | 15 | No conflicting refs, local names, ramp/frontage confusion, or duplicated geometry remains unresolved. |

Confidence statuses:

- `pass_candidate`: score >= 90 and no mandatory blockers.
- `review_required`: score 70-89 or any non-critical inconsistency.
- `blocked`: score < 70 or any mandatory blocker.

Mandatory blockers:

- Bearing-only direction inference.
- Segment outside approved counties.
- Conflicting route identity.
- Mainline/frontage/ramp ambiguity.
- Missing source timestamp or checksum.
- Any proposed user-facing NB/SB/EB/WB display.
- Any DriveTexas or Transportation Intelligence activation dependency.

## PASS criteria

A future V677 prototype should be considered a PASS only if all of the following evidence is produced offline:

1. At least 95% of candidate mainline mileage within the approved county scope has verified route identity.
2. At least 90% of accepted mainline mileage has `pass_candidate` directional confidence.
3. 100% of accepted segments are clipped to `liberty-tx`, `montgomery-tx`, or `san-jacinto-tx`.
4. 100% of segments have source timestamp, OSM IDs, relation/ref evidence, and rejection/quarantine status.
5. Frontage roads, ramps, and connectors are either correctly classified or blocked.
6. Runtime/storage measurements show the offline catalog remains small enough for later review without loading it at runtime.
7. No runtime files, display code, DriveTexas code, Transportation Intelligence flags, TIGER assets, Supabase assets, or county road assets are changed.

PASS means only that a later governance milestone may review whether limited non-display runtime experimentation should be planned. PASS does not authorize display or activation.

## FAIL criteria

The prototype should FAIL if any of the following occurs:

- Directional confidence depends on bearing-only assumptions.
- County containment cannot be proven for every accepted segment.
- OSM relation/ref evidence is incomplete enough to make mainline identity uncertain.
- Frontage roads, ramps, connectors, or local names cannot be reliably separated from mainline segments.
- Bundle/storage impact is not measured or is too large for corridor-only purpose.
- Any runtime behavior changes are required to evaluate the prototype.
- Any protected system flag changes state.
- Any directional display, route guidance, DriveTexas activation, or Transportation Intelligence activation is proposed as part of the prototype.

FAIL should keep the directional display block in place and require either a narrower follow-up audit or abandonment of OSM directional intelligence for that corridor.

## Runtime/storage measurement plan

V676 does not load or generate runtime data. A future V677 measurement plan should compare:

- Raw OSM extract size.
- Filtered corridor extract size.
- Preprocessed catalog JSON size.
- Compressed catalog size.
- Segment count by county and classification.
- Quarantined/rejected segment counts.
- Estimated parse time in an offline script only.
- Hypothetical bundle delta, explicitly marked non-runtime.

Measurement must be performed without importing the catalog into `js/app.js`, without changing existing assets, and without changing the runtime build path.

## TIGER coexistence strategy

TIGER remains the baseline road-awareness asset. OSM must coexist as a supplemental corridor-only evidence layer if a future milestone authorizes an offline prototype. Coexistence rules:

1. Do not replace TIGER geometry.
2. Do not modify county road assets.
3. Do not use OSM to overwrite existing road names or county geometry.
4. Keep OSM catalog IDs separate from TIGER IDs.
5. Compare OSM against TIGER only for audit context, not runtime substitution.
6. Treat mismatches as review items, not automatic corrections.

## Risk review summary

Key risks remain active: false directional confidence, OSM extraction errors, county containment failure, runtime size creep, user trust erosion, maintenance burden, corridor-selection bias, and future DriveTexas dependency assumptions. The separate V676 risk review recommends keeping directional display blocked.

## Future milestone roadmap

Before directional display could ever be considered, the following separate milestones would be required:

1. **V677 offline prototype authorization**: approve one-corridor OSM extraction and preprocessing artifacts only.
2. **Offline evidence review**: inspect source timestamps, route identity evidence, county containment, rejected segments, and confidence scores.
3. **Runtime impact gate**: measure catalog size and performance without loading it into production runtime.
4. **Governance decision**: determine whether OSM should remain abandoned, continue as offline-only, or proceed to a non-display runtime canary plan.
5. **Non-display runtime canary plan**: if ever approved, load internal-only metadata without UI, DriveTexas, or Transportation Intelligence activation.
6. **User-language and trust review**: define awareness-only phrasing and prohibit route guidance language.
7. **DriveTexas-specific mapping audit**: only if DriveTexas is separately unpaused by governance; not part of V676 or V677.
8. **Directional display authorization milestone**: a future explicit approval would be required before any NB/SB/EB/WB display.

## Final recommendation

A future V677 offline prototype should be **considered, but not yet authorized**, using **US 59 / I-69** as the single preferred corridor. The prototype should proceed only if governance accepts that it remains offline, non-runtime, non-display, county-contained, and blocked from DriveTexas and Transportation Intelligence activation. Directional display must remain blocked.
