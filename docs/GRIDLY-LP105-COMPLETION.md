# GRIDLY LP105 — Texas statewide source and licensing readiness

## Purpose and boundary

LP105 adds a repeatable, aggregate-only inventory of the immutable TxGIO file geodatabase. It does **not** export address rows, build a package, activate a county, change search/runtime behavior, or establish legal permission.

## Architecture and source safety

`tools/lp105/inventory-txgio-statewide.mjs` selects counties from the canonical LP104 254-county manifest and invokes `ogrinfo` once per county with `-ro` and a SQL aggregate. Counts cover source rows, geometry presence, exact house numbers, canonical street-name presence, and a conservative potentially usable intersection. The query writes no source data and Node never holds statewide address rows. Reports contain aggregates and a privacy-safe source fingerprint—not the absolute geodatabase path.

The CLI fails clearly if the geodatabase or GDAL is unavailable. `--gdal` accepts an `ogrinfo.exe` path or a QGIS bin directory. Default concurrency is **1**, appropriate for a single large file geodatabase and an approximately 8 GB machine. Values up to 4 are accepted but should be raised only after local observation.

## Resume and recovery

After every county, an atomic checkpoint replacement preserves completed results. `--resume` is the default; successful counties are skipped while failed counties are retried. A portable identity uses dataset basename, layer, declared record count, directory size, and modification time. A mismatch refuses resume. Use `--force` only to intentionally replace reuse of the prior checkpoint. Temporary JSON is renamed atomically, so interruption cannot leave partial JSON as the checkpoint.

Progress identifies position, county/FIPS, start, completion, raw/usable counts, elapsed time, failures, resume skips, and final totals. A heartbeat is printed every 15 seconds while GDAL remains active.

## Reports

The chosen report directory receives `<name>.checkpoint.json`, `<name>.json`, `<name>.md`, `<name>.coverage-ledger.json`, and `<name>.pilot-candidates.json`. The generated ledger keeps source presence/inventory/usable estimates separate from licensing, eligibility, package, certification, and activation evidence. LP105 never turns the latter fields on for a new county and preserves Liberty's existing evidence.

## Size estimates and pilots

Estimates scale potentially usable rows by Liberty accepted-record compressed and decompressed byte baselines. They are not actual artifacts. The JSON includes a 0.65–1.5 planning range and warnings for urban density, street-string length, compression ratio, rejection variation, and source order. Pilot profiles are selected from observed results (with preferred representative counties only when present), and remain ineligible while licensing is blocked. No pilot package is built.

## Licensing policy

`data/lp105/txgio-license-decision.json` is unresolved and fail closed. All required authorization fields plus evidence, reviewer, and review date must be affirmative before the tool reports the licensing gate approved. Inventory evidence alone cannot make production eligible. See `docs/lp105-txgio-licensing-questions.md` for the owner request.

## PowerShell 5.1 statewide command

Run from `C:\GitHub\liberty-county-map`:

```powershell
$env:GRIDLY_TXGIO_GDB = 'C:\GitHub\Gridly-Source-Data\Texas-Address-Points\Raw\Texas-2026.gdb'
node .\tools\lp105\inventory-txgio-statewide.mjs --all-texas --gdal 'C:\Program Files\QGIS 3.44.11\bin' --reports '.\data\generated\lp105' --name 'texas-2026-statewide' --resume --concurrency 1
```

This displays progress, remains resumable, and generates no production packages.

## Known limitations and next decision

Geometry validity is estimated by non-null geometry, not county containment or topology. Potential usability is an aggregate intersection and does not deduplicate records. Size estimates use Liberty and may not transfer cleanly to unusual counties. A directory-metadata identity detects normal source replacement but is not a full multi-gigabyte content hash. SQL field compatibility depends on the documented TxGIO 2026 layer.

After the real run, review failures, empty/low-quality counties, estimate outliers, and pilot profiles. Separately obtain written licensing answers. Only then decide whether a later, separately governed milestone may generate pilot packages; LP105 itself never does so.
