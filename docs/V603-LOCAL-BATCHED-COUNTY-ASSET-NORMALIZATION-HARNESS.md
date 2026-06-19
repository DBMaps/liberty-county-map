# GRIDLY V603 — Local/Batched County Asset Normalization Harness

## Final determination

**LOCAL NORMALIZATION HARNESS READY**

V603 implements a local-only, one-county-at-a-time normalization harness. It follows the V602 execution strategy by preserving committed source packages as immutable acquisition evidence, keeping generated or failed outputs out of Git by default, and emitting small validation reports instead of requiring Codex Cloud to diff large generated assets.

## Scope controls

The harness does **not**:

- Normalize all county assets.
- Modify committed source assets.
- Register runtime assets.
- Activate counties.
- Modify Supabase.
- Resume DriveTexas.
- Enable Transportation Intelligence.
- Enable historical reads, UI, API, or dashboard behavior.

## Supported counties

The harness supports these county slugs:

- `montgomery`
- `chambers`
- `san-jacinto`
- `polk`
- `jefferson`
- `harris`

## Harness script

Run the harness from the repository root:

```bash
node scripts/v603-county-normalization-harness.mjs --county montgomery
```

Default mode is validation-only. It validates expected road shapefile components, FRA crossing GeoJSON shape, and crossing override JSON. It writes a small per-county report to:

```text
assets/county-implementation/<county>/generated/local-normalization-staging/v603-<county>-validation-report.json
```

That staging directory is ignored by Git so local generated artifacts, failed conversion output, and temporary reports do not enter repository history unless a later milestone explicitly changes storage policy.

## Dry-run command that avoids generated outputs

Use `--no-write-report` for a dry-run validation command that does not write staging files:

```bash
node scripts/v603-county-normalization-harness.mjs --county montgomery --no-write-report
```

This is the preferred Codex Cloud-safe check because it does not generate large outputs.

## Optional local road conversion

Road conversion is opt-in and local-only:

```bash
node scripts/v603-county-normalization-harness.mjs --county montgomery --convert
```

When `--convert` is passed, the harness checks for `ogr2ogr` from GDAL. If `ogr2ogr` is unavailable, the report marks conversion as blocked for the local machine without mutating source assets. If available, it converts the county TIGER road shapefile to GeoJSON under the ignored staging path:

```text
assets/county-implementation/<county>/generated/local-normalization-staging/<county>-roads-source-converted.geojson
```

The converted file is a local generated artifact only. It is not a runtime asset, not registered, and not intended for Git review in V603.

## Validations performed

For each county, the harness validates:

1. Required source files exist:
   - `.shp`
   - `.shx`
   - `.dbf`
   - `.prj`
   - FRA crossing GeoJSON
   - crossing override JSON
2. Source files have byte sizes and SHA-256 checksums recorded in the report.
3. FRA crossing source is valid JSON with `FeatureCollection` type.
4. FRA crossing `features` is an array.
5. FRA crossing features include the required FRA-oriented properties:
   - `crossingid`
   - `statecode`
   - `countycode`
   - `countyname`
6. Crossing override JSON is exactly `{}` after trimming whitespace.
7. Optional road conversion uses `ogr2ogr` only when explicitly requested and available.

## Git and diff-safety policy

Generated staging output is ignored by Git via `.gitignore`:

```text
assets/county-implementation/*/generated/local-normalization-staging/
```

This keeps large generated GeoJSON files, partial conversions, and failed local outputs out of normal diffs. Future milestones may commit small manifests, validation summaries, or artifact pointers after explicit approval, but V603 intentionally does not register or activate generated assets.

## V602 alignment

V603 implements the V602 recommended Phase 1 harness design without running broad normalization. It uses county-by-county execution, read-only source handling, deterministic staging names, source checksums, schema summaries, and concise validation output. It leaves runtime integration, storage policy changes, county activation, and large generated artifact review to future authorized milestones.
