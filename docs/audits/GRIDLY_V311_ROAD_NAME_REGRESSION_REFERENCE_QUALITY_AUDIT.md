# Gridly V311 — Road Name Regression & Reference Quality Audit

## Quick summary

V311 is audit-only. It adds a local diagnostic script that samples the OSM-derived Liberty County road segment dataset, compares nearest road candidates, and documents formatter-path risk without changing production wording, resolver choice, coordinates, report placement, FRA data, Supabase sync, alert generation, Route Watch, directional display, or data models.

The main risk found is not a single formatter bug. The risk is that different surfaces can consume different road evidence: some paths prefer explicit incident/corridor fields, while nearest-road and marker-adjacent paths can prefer the geometrically closest segment. That is correct for raw proximity, but it can be weaker for human reference wording near intersections, crossings, and named local streets.

## Road-name regression findings

| Road | Dataset coverage | Sample coordinate | Selected primary road in audit | Selected reference road in audit | Finding |
|---|---:|---|---|---|---|
| US 90 | 127 features | 30.013413, -94.932175 | US 90 | Wolf Island Road | PASS for primary road; reference depends on nearest non-US-90 local segment. |
| Waco Street | 6 features | 30.040870, -94.898167 | Waco Street | US 90 | PASS for Waco primary in the sampled Dayton-area Waco segment; US 90 appears as a useful nearby reference. |
| Sawmill Road | 8 features | 30.031194, -94.992830 | Sawmill Road | Private Road 6057 | PASS for Sawmill primary at its own geometry; not a useful substitute for Waco when the user-facing event is a Waco crossing/location. |
| TX 321 | 40 features | 30.319013, -94.996551 | TX 321 | TX 105 | WATCH: shared-alignment naming can surface TX 105 as reference near TX 321. |
| TX 146 | 91 features | 30.073631, -94.783780 | North Main Street | Jefferson Drive | WATCH: local named street can win over the route ref because production resolver checks `name` before `ref`. |
| FM 1960 | 5 features | 30.047972, -95.022031 | FM 1960 | CR 682W | PASS for sampled primary. |
| FM 1409 | 9 features | 29.950068, -94.843544 | Farm-to-Market Road 1409 | CR 4431 | WATCH: audit script flags raw long-form naming; production display normalizers should collapse this to FM 1409 on user-facing surfaces. |
| Stilson Road | 2 features | 30.028269, -94.919946 | Stilson Road | US 90 | PASS for primary; US 90 is a useful nearby reference. |

## US 90 / Waco Street / Sawmill Road analysis

The Dayton-area Waco sample resolves Waco Street as the closest primary road and US 90 as the nearby reference road. That is the desired evidence shape for a human-facing crossing/location reference around Waco and US 90.

Sawmill Road is present and resolves correctly at its own geometry, but it is not a better human reference than Waco Street for a Waco/US 90 event. If Sawmill appears in Waco/US 90 wording, the mismatch is most likely caused by nearest-segment proximity at the event coordinate or by a formatter path using a stored nearest-road field rather than crossing/local-reference evidence.

The diagnostic result supports this root-cause split:

- **Nearest-road resolver risk:** closest segment can be geometrically true but human-weak.
- **Reference-road resolver risk:** first non-primary nearby candidate is not always the most recognizable reference.
- **Alert formatter risk:** alert cards can hide the source of their road evidence because they consume a normalized alert model.
- **Popup formatter risk:** crossing popups and unified incident popups can use different source records.
- **Different formatter-path risk:** awareness/corridor logic can prefer explicit route/corridor fields while marker/popup logic can reflect marker coordinates and nearest-road evidence.

## Formatter path comparison

| Surface | Observed/source path | Road evidence behavior | Mismatch risk |
|---|---|---|---|
| Alert cards | `buildGridlyAlertCardConsumerModel()` and road-hazard display helpers | Normalized alert fields plus shared road lookup. | Medium: can inherit resolver output or upstream alert fields. |
| Awareness headline | top-status corridor diagnostics and `inferCorridorLabel()` | Prefers explicit corridor/road fields before local fallback labels. | Medium: can differ from nearest-road popup text by design. |
| Hazard popups | `renderUnifiedIncidents()` -> `buildUnifiedIncidentPopup()` | Uses unified incident coordinates and road display helpers. | Medium-high near crossings/intersections. |
| Crossing popups | crossing render/popup family | Uses crossing inventory/report fields. | Medium: can be more crossing-specific than unified incident popups. |
| Route impact/details | localized location phrase and route detail summaries | Uses corridor inference, route relevance, and localized phrases. | Medium: route context can emphasize corridor over closest local street. |
| Rendered map marker metadata | unified incident marker creation | Marker metadata follows unified incident lat/lng and source fields. | Medium-high if marker coordinate is closer to a weaker road reference. |

## Recommended fix scope if needed

Do not change wording in V311. A later patch should be narrowly scoped to reference-road selection quality, not coordinates or alert generation. Recommended future scope:

1. Add a reference-road scoring layer that ranks recognizable roads/crossing roads above incidental closest local segments when the primary road is already known.
2. Keep nearest-road resolver output available as raw evidence, but separate `closestRoad` from `humanReferenceRoad`.
3. Add side-by-side diagnostics to alert card, popup, awareness, marker, and route-detail models so they report the evidence field they consumed.
4. Validate Waco/US 90, Stilson/US 90, TX 146 shared-alignment, TX 321/TX 105, FM 1409, and FM 1960 before changing production wording.

## Regression risk assessment

- **Primary-road regression risk:** Medium. Most sampled roads resolve correctly, but TX 146 and FM 1409 show alias/name-vs-ref risk.
- **Reference-road regression risk:** High. The nearest non-primary road is not necessarily the best human reference.
- **Formatter divergence risk:** High. Multiple formatter paths can consume different road evidence.
- **Coordinate/placement risk from this audit:** None. V311 does not modify coordinates, placement, or renderer behavior.
- **Production behavior risk from this audit:** None. The diagnostic script and report are audit-only.

## Testing completed

- `node scripts/v311-road-name-regression-audit.mjs`
- `git diff --check`

## Merge recommendation

Merge V311 as an audit-only baseline. Do not merge a production wording/resolver change until a follow-up patch adds explicit reference-road diagnostics and validates the Waco/US 90/Sawmill edge case against real rendered alert and popup surfaces.
