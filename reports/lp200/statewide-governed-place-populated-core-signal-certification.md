# LP200 — Statewide governed PLACE populated-core signal certification

## Final classification

**NOT_READY_OWNER_INPUT_REQUIRED**

No populated-core candidate was emitted or activated. Runtime, LP197, identities, memberships, ZIPs, and cameras are unchanged.

## Address package reconciliation

The manifest has **254** entries. Current physical package files: **59**; identity-valid package files / unique county FIPS: **59 / 59**; missing county FIPS: **195**; governed records represented: **4,590,210** of 12,142,647.

The initial **59** was a package-file count, not a package-tree count. Both the historical and current HEAD trees contain 149 entries and the additive comparison found zero historical files absent from HEAD. Sidecars, certificates, and the manifest account for the difference between 149 tree entries and package files. No historical directory restore is needed or safe.

## Governed statewide PLACE polygon

Prior statewide geometry and LP191 used **2025 TIGER/Line Places — Texas**, `tl_2025_48_place.zip`, vintage 2025: 9782040 bytes; SHA-256 `5a0c4d49641f69028ee9f5c343bf09936ec00a378e5e6393115b106bab935e13`; source CRS EPSG:4269; identity field `GEOID`; Polygon (promoted to MultiPolygon for prior analysis); 1863 source features reconciling to 1859 eligible PLACEs. Classification: **IDENTITY_KNOWN_BUT_BYTES_UNAVAILABLE**. Known owner path: `C:\GitHub\Gridly-Source-Data\Census\TIGER2025\PLACE\original\tl_2025_48_place.zip`. Portable input contract: `GRIDLY_TEXAS_PLACE_ZIP`. Required toolchain is QGIS 3.44.11 / GDAL 3.13.x (OGR/GEOS/PROJ). The strict preflight checks filename, bytes, hash, GDAL version, feature count, geometry, fields, CRS, and governed eligibility contract and fails closed.

Prior certification references are recorded in the JSON. The source is not replaced or reacquired.

## Authorization gate (separate decisions)

A. Internal certification-only computation is **not known to be prohibited**, but owner governance classification is required before execution. B. Committing derived populated-core coordinates is **not authorized while derivative classification remains unresolved**; this is not stated as a known prohibition. C. Raw address redistribution is **not authorized**. D. The present derivative gate is an **unresolved governance classification, not a known blanket prohibition**. Storage remains governed and permitted. These decisions are not conflated.

## Execution readiness

Polygon preflight: **NOT_RUN_BYTES_UNAVAILABLE**. Full statewide address coverage: **false**. Calibration controls ready: Port Arthur; blocked: Amarillo, Austin, Corpus Christi, Dallas, El Paso, Fort Worth, McAllen, Tyler, Waco. Real processing therefore cannot run now. No missing county is fabricated and no null candidate artifact is emitted.

All 1,859 PLACE rows remain `ADDRESS_SIGNAL_UNAVAILABLE` because package coverage, raw polygon availability, and authorization are evaluated separately and the required gates do not currently coexist.

## Safe owner procedure (PowerShell)

Never restore a historical evidence, report, or generated-input directory over HEAD. Historical recovery, if later proven necessary, must be additive, file-specific, identity-verified, and non-destructive.

```powershell
Set-Location C:\GitHub\liberty-county-map
$env:GRIDLY_TEXAS_PLACE_ZIP = 'C:\GitHub\Gridly-Source-Data\Census\TIGER2025\PLACE\original\tl_2025_48_place.zip'
npm run build:lp200
npm run verify:lp200
npm run test:lp200
```

The next owner action is to set the environment variable to the already governed archive and rerun LP200. The build validates the archive and every physically present package by bytes and SHA-256. Do not modify runtime or LP197.
