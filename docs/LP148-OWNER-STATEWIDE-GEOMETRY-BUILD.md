# LP148 owner-side statewide geometry build

LP148 uses a split execution model. Codex prepares the deterministic builder, membership contract, tests, and package commands only. The repository owner runs the full 254-county geometry build locally from Windows PowerShell in `C:\GitHub\liberty-county-map`.

## Authoritative source

The LP137 authoritative statewide geometry source is `assets/boundaries/texas-counties-boundaries.geojson`. It contains 254 Texas county features keyed by five-digit `GEOID` and is used as geometry source, not as activation authority.

## Read-only preflight

```powershell
Set-Location 'C:\GitHub\liberty-county-map'
git status --short
npm run plan:lp148
npm run verify:lp148
git status --short
```

Expected preflight result: `plan:lp148` reports `countyCount: 254`, `expectedCountyCount: 254`, `sort: "ascending-fips"`, source path `assets/boundaries/texas-counties-boundaries.geojson`, deploy/activation flags `false`, and rollback runtime count `28`.

## Statewide package build

```powershell
Set-Location 'C:\GitHub\liberty-county-map'
npm run build:lp148
```

The build writes only:

- `assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json`
- `assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json`

## Deterministic verification rerun and manifest/hash validation

```powershell
Set-Location 'C:\GitHub\liberty-county-map'
npm run verify:lp148
```

Expected success output includes `passed: true`, `countyCount: 254`, `packageByteLength`, `packageSha256`, and `rollbackRuntimeCountyCount: 28`. Verification rebuilds in memory and fails if the generated package or manifest differs from the deterministic bytes.

## Runtime membership audit

`npm run verify:lp148` also runs the runtime membership audit. It validates that the current 28-county LP138 baseline package remains unchanged as the rollback reference and confirms that LP148 does not activate counties.

## Exact git status review

```powershell
Set-Location 'C:\GitHub\liberty-county-map'
git status --short
```

Before the owner decides whether to track generated outputs, expected changed files after build are the two LP148 generated location-resolution artifacts only. No `js/app.js`, service worker, runtime membership contract, deployment, storage, Supabase, or activation file should change.
