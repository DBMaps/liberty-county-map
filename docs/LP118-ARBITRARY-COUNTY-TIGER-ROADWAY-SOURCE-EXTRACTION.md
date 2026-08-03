# LP118 — Arbitrary-County TIGER Roadway Source Extraction

## Startup verification and located contract

LP118 began on branch `work` at `a30fb3342b7884e97b5a699b6c780e4f58b47163`; only the permitted generated Android and `node_modules` directories were untracked. No applicable `AGENTS.md` was present.

The implementation reuses the LP028/LP032 TIGER county-road identity fields (`LINEARID`, `FULLNAME`, `RTTYP`, `MTFCC`, state/county FIPS), NAD83 source CRS, seven-decimal coordinate precision, stable identity ordering, boundary-touch acceptance, and LP116's normalization, adaptive partitioning, manifests, and certification. LP118 does not create a runtime path.

## Supported authoritative layouts and GDAL

`--tiger-root` recursively and unambiguously selects exactly one `tl_<year>_<fips>_roads.shp`, `.zip`, or controlled `.geojson` per county. `--source` accepts one explicit source for one county. The two options are mutually exclusive. Shapefiles and ZIPs are read through `ogr2ogr` (ZIPs use GDAL `/vsizip/`) with explicit `EPSG:4269` input and `EPSG:4326` output. `--gdal` accepts the QGIS/GDAL bin directory or executable. Sources are never opened for writing.

## Governance

Requested FIPS must be unique five-digit Texas codes in `data/lp104/texas-counties.json` and are processed in sorted order. The boundary source must contain exactly one name/FIPS-agreeing feature. Only finite `LineString` and `MultiLineString` geometries whose every coordinate is inside or touching that boundary survive. Null, point, polygon, collection, non-finite, duplicate, and out-of-county records are counted and rejected. Source fields are preserved; only county identity is added.

Candidate GeoJSON and checkpoints are atomic, deterministic, EPSG:4326, and written below `reports/lp118/<fips>/`. Reports bind source, boundary, and output SHA-256/size evidence. `--resume` reuses a candidate only when every binding agrees; a changed source or boundary rebuilds it. `--force` and `--resume` are mutually exclusive. County failures are independently checkpointed.

## LP116 and LP114 integration

The exported `extract()` interface returns each candidate source path/evidence. LP114's `--tiger-road-root` flow builds/verifies LP117 boundary evidence, invokes LP118, and passes each successful candidate to LP116. The existing explicit `--roadway-source` compatibility path remains available. LP116 remains solely responsible for normalization, partitioning, packages, manifests, and certification.

## Authentic target status and owner requirement

Checked-in authoritative road sources exist for previously governed counties, but not for Burleson (48051), Trinity (48455), or Victoria (48469). Controlled GeoJSON fixtures validate extraction behavior; they are not authentic county results. Owner execution remains required against the maintained TIGER2025 source directory. Missing sources are truthfully `REQUIRES_OWNER_SOURCE`, never `NOT_APPLICABLE`.

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\GitHub\liberty-county-map'
node .\tools\lp118\extract-tiger-roadways.mjs --fips 48051,48455,48469 --candidate --resume --tiger-root 'C:\GitHub\Gridly-Source-Data\Census\TIGER2025' --boundaries '.\assets\boundaries\texas-counties-boundaries.geojson' --gdal 'C:\Program Files\QGIS 3.44.11\bin' --reports '.\reports\lp118'
node .\tools\lp114\manufacture-county-bundle.mjs --fips 48051,48455,48469 --resume --skip-addresses --tiger-road-root 'C:\GitHub\Gridly-Source-Data\Census\TIGER2025' --tiger-gdal 'C:\Program Files\QGIS 3.44.11\bin' --roadway-boundaries '.\assets\boundaries\texas-counties-boundaries.geojson' --reports '.\reports\lp114'
```

## Cleanup and production boundary

Remove only `reports/lp118/<fips>` (and the candidate LP114/LP116 report directories) to discard candidates. Never copy them into `data`, production manifests, or runtime assets without a separate governed activation milestone. LP118 has no upload, deployment, activation, runtime-selection, cache, or consumer behavior. Merge is recommended after CI repeats the governed regression suite; authentic manufacturing evidence must be produced by the owner command above.
