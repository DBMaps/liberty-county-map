# V804 Boundary Manufacturing Source Path Support Certification

## Scope

V804 updates the county boundary manufacturing script so it can read the canonical local Census TIGER/Line source shapefile from an explicit `-SourceShapefile` argument while preserving the original repository-relative default path.

## Certified behavior

- `tools/BoundaryPackages/Build-GridlyCountyBoundaryPackage.ps1` accepts `-SourceShapefile` for an explicit TIGER/Line county shapefile path.
- If `-SourceShapefile` is omitted, the script keeps the existing default source path: `county_sources/census-tiger-2025/tl_2025_us_county.shp`.
- If the default source path is absent and `C:\GitHub\Gridly-Source-Data\Census\tl_2025_us_county\tl_2025_us_county.shp` exists, the script falls back to that canonical local source path.
- V802 county boundary manufacturing validations and the V803 PowerShell interpolation fix are preserved.

## Non-goals and controls

- No boundary coordinates are manually edited by V804.
- No promotion tooling is changed by V804.
- Existing V802/V803 manufactured boundary semantics are retained.

## Evidence

Machine-readable evidence is recorded in `docs/certifications/evidence/V804-boundary-manufacturing-source-path-support.json`.
