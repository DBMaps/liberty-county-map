# GRIDLY LP030.2 External Roadway Asset Upload Tooling

LP030.2 replaces the LP030.1 local-staging-only workflow with safe external roadway asset upload tooling. The script reads the protected source directory, validates the approved county inventory and LP028 runtime asset metadata, and uploads through Supabase Storage REST only when explicitly requested.

## Protected source directory

Source assets remain in `data/road-segments/`. The tooling may enumerate files, read files, calculate SHA-256 hashes, stream file contents for upload, and read `lp028-roadway-runtime-assets.json`. It must not modify, rewrite, copy over, rename, move, delete, stage, commit, ignore, clean, or reset that directory.

## Expected upload inventory

Exactly 24 county GeoJSON packages are allowed: Austin, Brazoria, Brazos, Calhoun, Chambers, Colorado, Fayette, Fort Bend, Galveston, Grimes, Hardin, Jackson, Jasper, Jefferson, Lavaca, Matagorda, Newton, Orange, Polk, Tyler, Walker, Waller, Washington, and Wharton.

Liberty, Montgomery, San Jacinto, and Harris are not uploaded. Harris is rejected explicitly if a Harris package is detected.

## Deployment architecture

`scripts/Deploy-Lp030RoadwayAssets.ps1` defaults to dry-run and requires `-Execute` for network upload. It validates source inventory, rejects missing or extra counties, rejects non-GeoJSON packages, compares files with `data/road-segments/lp028-roadway-runtime-assets.json`, calculates SHA-256 with `Get-FileHash`, and uses streamed upload bodies (`Invoke-WebRequest -InFile`) so roadway GeoJSON packages are not parsed into memory.

Real uploads use Supabase Storage REST with stable object paths:

```text
roadways/{county-id}/{version}/{filename}
```

The script requires HTTPS storage URLs except localhost, refuses remote overwrite unless `-AllowOverwrite` is supplied, retries bounded transient failures, verifies remote accessibility after upload, verifies remote byte length when the server exposes `Content-Length`, and writes machine-readable JSON outside `data/road-segments/`.

## Environment variables

Real upload requires:

- `GRIDLY_ROADWAY_STORAGE_BASE_URL` — Supabase project/storage base URL, for example `https://example.supabase.co`.
- `GRIDLY_ROADWAY_STORAGE_BUCKET` — target Supabase Storage bucket.
- `GRIDLY_ROADWAY_STORAGE_TOKEN` — bearer/API token. The script never prints this token.

## Dry-run command

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Deploy-Lp030RoadwayAssets.ps1 `
  -ResultOutputPath .\lp030-roadway-upload-results\lp030-dry-run.json `
  -Version lp030
```

## Execute command

```powershell
$env:GRIDLY_ROADWAY_STORAGE_BASE_URL = 'https://YOUR-PROJECT.supabase.co'
$env:GRIDLY_ROADWAY_STORAGE_BUCKET = 'YOUR-BUCKET'
$env:GRIDLY_ROADWAY_STORAGE_TOKEN = 'YOUR-TOKEN'
powershell -ExecutionPolicy Bypass -File .\scripts\Deploy-Lp030RoadwayAssets.ps1 `
  -Execute `
  -ResultOutputPath .\lp030-roadway-upload-results\lp030-execute.json `
  -Version lp030
```

Add `-AllowOverwrite` only for an intentional replacement deployment.

## Verification command

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-Lp030RoadwayAssetDeployment.ps1
```

Codex/static validation can also run:

```bash
node tests/lp030-2-roadway-upload-tooling-static.test.js
```

## Result schema

Each county result contains `countyId`, `countyName`, `localPath`, `fileName`, `objectPath`, `publicUrl`, `version`, `sha256`, `localByteLength`, `remoteByteLength`, `uploadAttempted`, `uploadStatus`, `httpStatus`, `verificationStatus`, `verified`, and `error`.

The deployment result is for later runtime manifest registration. LP030.2 does not modify `data/roadway-runtime-manifest.json`.
