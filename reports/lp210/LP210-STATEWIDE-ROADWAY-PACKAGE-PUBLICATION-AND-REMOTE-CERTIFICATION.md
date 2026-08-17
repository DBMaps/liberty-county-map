# LP210 Statewide Roadway Package Publication and Remote Certification

## Decision

`BLOCKED_FOR_STATEWIDE_ROADWAY_PUBLICATION`

The committed evidence is an intentionally conservative pre-owner publication plan. The 226 LP209 candidates are planned, but the owner-local 3.41 GB workspace and production Storage credentials are not present in this repository, so no upload or remote certification is claimed.

## Governed storage contract

Repository LP030/LP032 evidence establishes Supabase project `nhwhkbkludzkuyxmkkcj`, public bucket `gridly-roadways`, and county/version paths below `roadways/{countyId}/{version}`. LP210 uses the isolated candidate-only version `lp210`, package paths `roadways/{countyId}/lp210/packages/{fileName}`, and `candidate-roadway-manifest.json`. GeoJSON uses `application/geo+json`; manifests use `application/json`; uploads set `x-upsert: false` and cache control `max-age=3600`. Public GET downloads—not ETags—are hashed for certification.

## Plan and accounting

The committed LP209 identities derive 226 counties: 219 single-package and seven partitioned counties, with 237 package/partition objects plus 226 manifests (463 total). Expected bytes are recorded in the aggregate report and every expected identity/path is in the certification manifest. The seven partitioned counties remain Bexar (2), Collin (2), Dallas (4), Denton (2), Hidalgo (2), Tarrant (4), and Travis (2).

## Guards

The owner executor defaults to `WhatIf`. Every local package and manifest is byte-counted and SHA-256 hashed before the first remote request. Existing exact remote bytes are skipped; absent objects are uploaded only in explicit `Apply`; conflicting bytes fail closed; and every uploaded/existing object is downloaded through the governed public retrieval contract and independently hashed. Uploads are sequential and resumable. No runtime file or database is written.

The 28-county runtime manifest remains SHA-256 `56549d67569f2c74cd202a1e93a30f79591b119ef1fdf58c8d138ffdefaad7bd`, with 28 counties before and after. Owner Apply/Verify must replace the compact pending evidence with certified results before readiness can advance.

## Owner execution

Run in order from the repository root with the production credential in `SUPABASE_SERVICE_ROLE_KEY` or `GRIDLY_ROADWAY_STORAGE_TOKEN`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File tools/lp210/Publish-LP210StatewideRoadways.ps1 `
  -Mode WhatIf

powershell -NoProfile -ExecutionPolicy Bypass `
  -File tools/lp210/Publish-LP210StatewideRoadways.ps1 `
  -Mode Apply

powershell -NoProfile -ExecutionPolicy Bypass `
  -File tools/lp210/Publish-LP210StatewideRoadways.ps1 `
  -Mode Verify
```

Then run `npm run verify:lp210` without credentials to prove portable closure and commit only `reports/lp210` evidence.
