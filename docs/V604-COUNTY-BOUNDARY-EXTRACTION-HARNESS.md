# GRIDLY V604 — County Boundary Extraction Harness

## Final determination

**COUNTY BOUNDARY EXTRACTION HARNESS READY**

V604 adds a local-only validation and preparation harness for county boundary GeoJSON assets. It validates committed county-owned boundary files when they already exist and reports missing county boundaries as local extraction work rather than unsafe runtime failures.

## Scope controls

V604 is intentionally limited to a script, generated-staging ignore policy, and documentation. It does not activate counties, register county runtime assets, modify app runtime behavior, resume DriveTexas, enable Transportation Intelligence, enable historical reads or historical UI, or commit national/state county shapefile data.

## Why V604 exists

V602 and V603 established the asset strategy for county-by-county local preparation: keep large source packages local, keep generated outputs ignored by Git, validate deterministic per-county inputs, and avoid runtime registration until a future explicit activation step. The remaining gap is county boundary generation. Montgomery already has a committed county-owned boundary GeoJSON, while Chambers, San Jacinto, Polk, Jefferson, and Harris need a safe local path to prepare boundary output without downloading or committing broad Census/state source datasets.

## Relationship to V602/V603

V604 continues the V602/V603 approach by:

- running one county at a time;
- validating existing committed assets before any optional conversion;
- requiring explicit opt-in for local extraction;
- writing generated output only under ignored county staging;
- avoiding large generated diffs; and
- leaving runtime integration and county activation to a future approved milestone.

## Supported counties

| County slug | FIPS |
| --- | --- |
| `montgomery` | `48339` |
| `chambers` | `48071` |
| `san-jacinto` | `48407` |
| `polk` | `48373` |
| `jefferson` | `48245` |
| `harris` | `48201` |

## Usage examples

Dry-run validation for Montgomery:

```bash
node scripts/v604-county-boundary-harness.mjs --county montgomery --no-write-report
```

Dry-run readiness check for a missing-boundary county:

```bash
node scripts/v604-county-boundary-harness.mjs --county chambers --no-write-report
```

Write a local generated report:

```bash
node scripts/v604-county-boundary-harness.mjs --county harris
```

Optional local extraction from a locally supplied county boundary dataset:

```bash
node scripts/v604-county-boundary-harness.mjs --county harris --extract --source /path/to/local/county-boundaries.shp
```

`--convert` is accepted as an alias-style explicit opt-in for the same local boundary extraction flow:

```bash
node scripts/v604-county-boundary-harness.mjs --county harris --convert --source /path/to/local/county-boundaries.shp
```

## Dry-run behavior

The default mode is dry-run validation. It validates that:

- the county slug is supported;
- the expected FIPS mapping exists;
- the county implementation directory exists;
- the boundary directory exists;
- generated boundary staging is ignored by Git;
- an existing committed boundary GeoJSON is valid JSON;
- the GeoJSON is a `FeatureCollection`;
- the feature collection has at least one feature;
- at least one `Polygon` or `MultiPolygon` geometry exists; and
- an expected FIPS/GEOID property matches the county FIPS when a FIPS/GEOID-like property is available.

Dry-run mode does not download data, does not invoke `ogr2ogr`, does not write generated boundary GeoJSON, and does not overwrite committed boundary files.

## Optional extraction behavior

Optional extraction only runs when `--extract` or `--convert` is supplied. Extraction also requires `--source <local-path>` and local `ogr2ogr` availability. The harness filters the local source by the selected county `GEOID` and writes output to:

```text
assets/county-implementation/<county>/generated/boundary-staging/<county>-county-boundary.geojson
```

The generated output is then validated by the same GeoJSON checks used for committed boundaries. V604 never promotes this staged output into the committed boundary directory and never overwrites an existing committed boundary.

## Missing-boundary behavior

For counties without committed boundary GeoJSON, V604 reports `READY_FOR_LOCAL_EXTRACTION` when required directories and ignore policy are valid. This is not a failure. It means a national or state county boundary source must be supplied locally by the operator before explicit extraction can run.

V604 does not download Census data and does not commit national/state boundary sources.

## Generated staging policy

Generated boundary staging is ignored by Git at:

```text
assets/county-implementation/*/generated/boundary-staging/
```

This keeps generated GeoJSON, partial extraction output, and local reports out of normal diffs unless a future milestone explicitly creates a promotion process.

## Protected boundaries

V604 protects the following boundaries:

- no county activation;
- no runtime asset registration;
- no app runtime behavior changes;
- no DriveTexas work;
- no Transportation Intelligence enablement;
- no historical reads or historical UI enablement;
- no national/state county shapefile commits; and
- no large generated diffs.

## Next recommended step

Run the harness locally for each target county. For counties that report `READY_FOR_LOCAL_EXTRACTION`, supply a local trusted county boundary dataset and run explicit extraction into ignored staging. Review the staged GeoJSON locally, then create a separate future promotion milestone if a county boundary should be committed.
