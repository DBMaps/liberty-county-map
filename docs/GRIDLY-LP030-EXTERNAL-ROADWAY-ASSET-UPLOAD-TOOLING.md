# GRIDLY LP030.1 External Roadway Asset Upload Tooling

## Purpose

LP030.1 adds operator tooling for staging externally hosted roadway GeoJSON assets without changing Gridly production runtime behavior. The tooling is intentionally limited to validation, copy/staging, checksum generation, and deployment-manifest creation for assets that will be hosted outside the app repository.

## Scope controls

This milestone does **not** continue LP029, does **not** modify DriveTexas, does **not** modify production runtime behavior, and does **not** modify `data/road-segments/`.

Created files:

- `scripts/Deploy-Lp030RoadwayAssets.ps1`
- `scripts/Test-Lp030RoadwayAssetDeployment.ps1`
- `docs/GRIDLY-LP030-EXTERNAL-ROADWAY-ASSET-UPLOAD-TOOLING.md`

## Deployment script

`Deploy-Lp030RoadwayAssets.ps1` stages one or more `.geojson` files from a caller-provided source directory to a caller-provided external asset staging directory. It writes a JSON deployment manifest containing:

- LP030.1 contract version
- UTC generation timestamp
- asset file name
- optional county ID
- package version
- optional externally hosted URL
- SHA-256 checksum
- byte size
- GeoJSON feature count
- source path and staged path
- explicit flags confirming production runtime, DriveTexas, and `data/road-segments/` were not modified

Example:

```powershell
pwsh ./scripts/Deploy-Lp030RoadwayAssets.ps1 `
  -SourceDirectory ./external-roadway-build-output/liberty `
  -DestinationDirectory ./external-roadway-upload-staging/lp030/liberty `
  -ManifestOutputPath ./external-roadway-upload-staging/lp030/liberty-manifest.json `
  -BaseUrl https://static-assets.example/gridly/roadways/lp030/liberty `
  -CountyId liberty-tx `
  -PackageVersion lp030.1-20260719
```

Use `-WhatIf` for a no-write review of copy and manifest operations. Use `-Force` only when intentionally replacing an existing staged artifact.

## Validation script

`Test-Lp030RoadwayAssetDeployment.ps1` creates a temporary GeoJSON fixture, runs the deployment script, verifies that the staged copy and manifest were produced, validates the feature count and SHA-256 checksum, and confirms the `data/road-segments/` protection guard rejects protected destinations.

Run:

```powershell
pwsh ./scripts/Test-Lp030RoadwayAssetDeployment.ps1
```

## Operational notes

- Source assets must be GeoJSON `FeatureCollection` files.
- The script only processes files ending in `.geojson` in the top level of the source directory.
- HTTP upload to a cloud provider is intentionally not embedded in this milestone so credentials, bucket naming, cache policy, CDN invalidation, and promotion rules can remain outside the app repository.
- Generated manifests are review artifacts for external asset deployment; they are not wired into the production runtime by this milestone.
