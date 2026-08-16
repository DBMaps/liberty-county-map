# Owner-local governed data workflows

No download or governed-source replacement was performed.

## County geometry

The repository already has complete authoritative geometry: 254/254 valid Polygon/MultiPolygon records, source SHA-256 `09b9bc52c53f983451bb55899a03109f4002a3bcb1b47e0fe69cc38ed804332c`, statewide runtime package SHA-256 `6c6eeb549bb5e03d79efbc4d421783c06988c81c0f728c79add32f8c219e3d49`. **No owner extraction is required for the present gap.** The gap is runtime bounds configuration.

Previously proven tools are PowerShell 5.1 plus GDAL/OGR (`ogr2ogr`) supplied by QGIS/OSGeo4W, with a local Census TIGER/Line 2025 county shapefile. The existing boundary wrapper currently hard-codes five supported counties, so it is a precedent, not a safe all-254 command without a governed extension.

```powershell
# Verification/rebuild of the already-governed statewide package (repository)
npm run verify:county-geometry-deterministic
npm run audit:county-geometry-membership
# Only if owner authorizes rebuilding from the already-present governed source:
npm run build:county-geometry
```

County-specific precedent (do not run merely for this audit):

```powershell
$env:Path = "C:\Program Files\QGIS 3.xx\bin;$env:Path"
.\tools\BoundaryPackages\Build-GridlyCountyBoundaryPackage.ps1 `
  -County liberty `
  -SourceShapefile 'C:\Gridly-Source-Data\Census\tl_2025_us_county.shp' `
  -WhatIf -Json
```

## Railroad crossings

A governed statewide FRA GeoJSON already exists in the repository (16,101 records; 200 counties positive, 54 zero). Candidate manufacturing for all 226 counties outside production is repository-completable without source extraction or architecture change. LP115 is deliberately candidate-only and cannot activate production.

```powershell
$all = (Get-Content .\data\lp104\texas-counties.json -Raw | ConvertFrom-Json).counties.fips -join ','
node .\tools\lp115\manufacture-candidate-crossings.mjs --fips $all --candidate --resume
npm run test:lp115
```

Expected: 254 deterministic outcomes if run for all FIPS: 200 generated positive candidates and 54 `NOT_APPLICABLE`/zero certifications. For the remaining-production cohort specifically, expect 226 candidate outcomes. Production certification, manifest promotion and runtime activation remain separately governed and are not authorized by LP115.

## Roads

Current runtime has 28 counties. For missing counties, LP118 expects owner-held TIGER/Line county road sources named `tl_<vintage>_<FIPS>_roads.(shp|zip|geojson)`, a governed 254-county boundary source, Node.js, and `ogr2ogr` on PATH (or `--gdal` pointing to QGIS/OSGeo4W binaries). No Python is required.

```powershell
$fips = '48309' # McLennan example
node .\tools\lp118\extract-tiger-roadways.mjs `
  --fips $fips --candidate `
  --tiger-root 'C:\Gridly-Source-Data\Census\TIGER-2025\ROADS' `
  --gdal 'C:\Program Files\QGIS 3.xx\bin' `
  --boundaries .\assets\boundaries\texas-counties-boundaries.geojson `
  --resume
node .\tools\lp116\manufacture-candidate-roadways.mjs --help
npm run test:lp118
npm run test:lp116
```

Exact immediately extractable count cannot be established from this container because the owner TIGER roads workspace is not mounted. It is **not** correct to say all 226 are source-missing: the repository proves an owner-local discovery workflow, while only the owner machine can inventory the frozen source root.
