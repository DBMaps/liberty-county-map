# Texas Metro Regionalization Candidate Audit

## Governance

- auditOnly: **true**
- productionChangeAuthorized: **false**
- regionalizationImplementationAuthorized: **false**
- auditStatus: **BLOCKED_PENDING_GOVERNED_GEOMETRY_EVIDENCE**

## Houston reference model

Houston (GEOID 4835000) is the 15-child-region reference control and is excluded from candidates. The exact runtime reference is documented by the audit generator from `GRIDLY_LP035_HOUSTON_REGION_MODEL`.

## Input evidence identities

The required `reports/statewide-place-presentation-geometry-audit.json` is absent. The audit fails closed rather than inventing geometry or owner evidence.

## Candidate selection algorithm

Required candidates plus every PLACE meeting: 100+ square miles, multi-county, multipart and at least 10 square miles, statewide top-25 candidate disagreement, or extreme computed bounds sprawl. Deduplicate and sort by GEOID; exclude Houston. Expansion awaits the governed geometry report.

## Candidate table

| GEOID | PLACE | Governed type | Current result |
|---|---|---|---|
| 4804000 | Arlington | INCORPORATED_PLACE | REVIEW — governed geometry required |
| 4805000 | Austin | INCORPORATED_PLACE | REVIEW — governed geometry required |
| 4817000 | Corpus Christi | INCORPORATED_PLACE | REVIEW — governed geometry required |
| 4819000 | Dallas | INCORPORATED_PLACE | REVIEW — governed geometry required |
| 4824000 | El Paso | INCORPORATED_PLACE | REVIEW — governed geometry required |
| 4827000 | Fort Worth | INCORPORATED_PLACE | REVIEW — governed geometry required |
| 4841464 | Laredo | INCORPORATED_PLACE | REVIEW — governed geometry required |
| 4845000 | Lubbock | INCORPORATED_PLACE | REVIEW — governed geometry required |
| 4865000 | San Antonio | INCORPORATED_PLACE | REVIEW — governed geometry required |

## Classification summary

- REGIONALIZE_LIKE_HOUSTON: **0**
- KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM: **0**
- REVIEW: **9**
- NO_CHANGE_NEEDED: **0**

## Detailed per-candidate records

All required candidates remain REVIEW / INPUT_EVIDENCE_REQUIRED. Geometry fields and regionalization outcomes are intentionally not fabricated.

## Recommended next-stage sequencing

1. Run the governed geometry audit owner-locally.
2. Run this candidate audit.
3. Review classifications and only then govern child definitions in a separately authorized change.

## Explicit limitations

- Deterministic expansion cannot be completed without the governed geometry report.
- Population is unavailable in governed inputs and is not used.
- No runtime data, Houston behavior, child areas, or camera behavior is changed.

## Owner PowerShell command

`npm run audit:statewide-place-presentation-geometry -- "C:\path\to\tl_2025_48_place.zip"; if ($LASTEXITCODE -eq 0) { npm run audit:texas-metro-regionalization }`
