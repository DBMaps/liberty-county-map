# GRIDLY V684 — OSM Extraction Prototype

## 1. Mission alignment

Gridly remains **Know Before You Go**. V684 is an offline, audit-only source-data extraction milestone that supports the product posture of **Awareness Platform First** and **Route Intelligence Second**.

This milestone does not activate directional intelligence. It converts the audited OpenStreetMap source asset into normalized evidence records so later milestones can validate source extraction quality before any confidence validation or runtime consideration.

## 2. Protected-system verification

Protected systems remain unchanged and verified as:

| Protected system | Required value | V684 value |
| --- | ---: | ---: |
| `historicalReadsEnabled` | `false` | `false` |
| `historyUiEnabled` | `false` | `false` |
| `DriveTexasPaused` | `true` | `true` |
| `TransportationIntelligenceEnabled` | `false` | `false` |
| `TransportationIntelligenceDisplay` | `false` | `false` |
| `TransportationIntelligenceActivation` | `false` | `false` |

## 3. V683 dependency summary

V684 depends on the V683 metadata coverage audit final determination:

> **METADATA COVERAGE PARTIAL — EXTRACTION PROTOTYPE ALLOWED WITH REVIEW BUCKETS**

That determination allowed an extraction prototype only if ambiguous, risky, or incomplete source segments remain separated into review buckets.

## 4. Source asset path

Requested source asset:

`assets/directional-intelligence/source/osm/us59-i69-liberty-montgomery-source.geojson`

Repository-inspected source asset used by the prototype because it is the existing V683 source location in this checkout:

`assets/directional-intelligenc/source/osm/us59-i69-liberty-montgomery-source.geojson`

The generated inventory and evidence records preserve the requested source asset path and also record the inspected source asset path for audit traceability.

## 5. Extraction scope

V684 reads the OSM GeoJSON source asset, validates that it is a FeatureCollection, iterates the source features, and produces normalized corridor and segment inventory artifacts:

- `assets/directional-intelligence/extracted/v684-us59-i69-corridor-inventory.json`
- `assets/directional-intelligence/extracted/v684-us59-i69-segment-inventory.json`
- `assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json`

## 6. Explicit non-goals

V684 does **not**:

- Modify `js/app.js`.
- Modify `index.html`.
- Modify CSS.
- Add runtime loading.
- Add UI.
- Add directional labels.
- Add NB/SB/EB/WB display.
- Connect to Route Watch.
- Connect to Alerts.
- Connect to Awareness.
- Resume DriveTexas.
- Enable Transportation Intelligence.
- Change county operational status.
- Change Supabase.
- Introduce frameworks.

## 7. Extraction method

The extraction script is:

`tools/directional-intelligence/v684-osm-extraction-prototype.mjs`

For each source feature, the script preserves or derives:

- Source OSM way id from `properties["@id"]` or `feature.id`.
- Corridor identity evidence from `ref`, `fut_ref`, `name`, and `tiger:name_base`.
- County from `tiger:county`.
- Roadway class from `highway`.
- Direction metadata from `oneway` and `oneway:conditional`.
- Lane metadata from `lanes`, `turn:lanes`, and `destination:lanes`.
- Strategic metadata from `Texas_Trunk_System`, `NHS`, and `hgv:national_network`.
- Risk metadata from construction, bridge, toll, HOV/HOT, motor-vehicle, and fixme tags.
- Geometry evidence including type, coordinate count, start coordinate, end coordinate, bounding box, and approximate start-to-end bearing.

The bearing value is stored only as geometry evidence. It is not used as standalone directional confidence.

## 8. Corridor membership rules

A segment is treated as part of the US 59 / I-69 extraction candidate set when its `ref`, `fut_ref`, `name`, or `tiger:name_base` metadata indicates one of the following:

- `I 69`
- `I-69`
- `US 59`
- `US-59`
- `United States Highway 59`
- `Eastex Freeway` when paired with I-69 / US-59 refs or metadata

Segments that fail corridor membership are rejected into `non_primary_corridor`.

## 9. Segment inventory summary

V684 generated one normalized segment record for each source feature.

| Metric | Count |
| --- | ---: |
| Total source features | 245 |
| Total LineString features | 245 |
| Extracted segments | 245 |
| Rejected segments | 0 |
| Review segments | 81 |
| Extracted without review | 164 |

Each segment record includes `segmentId`, source identity, corridor identity, source metadata, strategic tags, risk tags, geometry summary, extraction status, review bucket, review reasons, and evidence signals.

## 10. Review bucket model

Review reasons are accumulated independently. The segment `reviewBucket` is assigned by the highest-priority applicable reason:

1. `geometry_invalid`
2. `non_primary_corridor`
3. `reversible_lane`
4. `construction_segment`
5. `hov_hot_lane`
6. `missing_ref`
7. `missing_oneway`
8. `missing_county`
9. `manual_review_required`
10. `none`

## 11. Extraction results

Review bucket distribution:

| Review bucket | Count |
| --- | ---: |
| `none` | 164 |
| `missing_county` | 36 |
| `manual_review_required` | 17 |
| `hov_hot_lane` | 10 |
| `construction_segment` | 8 |
| `reversible_lane` | 7 |
| `missing_oneway` | 3 |

County distribution:

| County | Count |
| --- | ---: |
| Montgomery, TX | 92 |
| Harris, TX | 61 |
| Missing | 56 |
| Liberty, TX | 31 |
| San Jacinto, TX | 5 |

Highway distribution:

| Highway | Count |
| --- | ---: |
| motorway | 233 |
| construction | 7 |
| secondary_link | 2 |
| tertiary | 2 |
| secondary | 1 |

## 12. Rejected segment summary

No segments were rejected.

| Rejection bucket | Count |
| --- | ---: |
| `geometry_invalid` | 0 |
| `non_primary_corridor` | 0 |

## 13. Manual review summary

81 extracted segments require review before downstream validation. The most important review themes are:

- Missing county attribution on 36 highest-priority bucketed segments and 56 segments overall.
- Manual fixme review on 17 highest-priority bucketed segments.
- HOV/HOT-related signals on 17 segments, with 10 assigned to the HOV/HOT highest-priority bucket.
- Construction signals on 8 segments.
- Reversible-lane or `oneway:conditional` reverse-flow signals on 7 segments.
- Missing oneway metadata on 3 highest-priority bucketed segments.

## 14. Evidence coverage summary

| Evidence signal | Count |
| --- | ---: |
| `hasRef` | 245 |
| `hasFutureRef` | 39 |
| `hasName` | 182 |
| `hasCounty` | 189 |
| `hasOneway` | 242 |
| `hasOnewayConditional` | 7 |
| `hasLanes` | 220 |
| `hasTurnLanes` | 60 |
| `hasDestinationLanes` | 43 |
| `hasStrategicTags` | 223 |
| `hasGeometry` | 245 |
| `isReversible` | 7 |
| `isConstruction` | 8 |
| `isHovHot` | 17 |
| `hasFixme` | 17 |

## 15. Risk review

V684 confirms the extraction can produce complete source-to-segment inventory records, but the result is not ready for directional confidence work without validation. Risks requiring review include reversible flow metadata, construction segments, HOV/HOT signals, missing county attribution, missing oneway tags, and fixme tags.

## 16. Runtime/UI non-change confirmation

V684 is offline source-data extraction only.

- `runtimeChanged`: `false`
- `appJsChanged`: `false`
- `uiChanged`: `false`
- `driveTexasChanged`: `false`
- `transportationIntelligenceChanged`: `false`

No runtime application files were changed.

## 17. Final determination

**EXTRACTION PROTOTYPE PARTIAL — VALIDATION ALLOWED WITH REVIEW BUCKETS**

Reason: all 245 LineString source features were normalized into extracted segment records with zero rejected segments, but 81 extracted segments require review buckets before downstream validation.

## 18. Recommended next milestone

**V685 — OSM Extraction Validation Audit**

V685 should validate the extracted segment inventory and review buckets before any confidence validation, runtime integration, directional display, DriveTexas work, or Transportation Intelligence consideration.
