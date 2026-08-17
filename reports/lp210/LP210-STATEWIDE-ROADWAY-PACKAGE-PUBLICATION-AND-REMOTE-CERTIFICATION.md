# LP210 Statewide Roadway Package Publication and Remote Certification

## Decision

`READY_FOR_STATEWIDE_ROADWAY_RUNTIME_ACTIVATION`

The committed owner certificate proves publication and exact remote identity for all 226 LP210 counties. Portable verification consumes only the two committed LP210 JSON certificates and the protected production runtime manifest; it requires no owner-local files, credentials, remote downloads, source ZIPs, or candidate packages.

## Governed storage contract

Repository LP030/LP032 evidence establishes Supabase project `nhwhkbkludzkuyxmkkcj`, public bucket `gridly-roadways`, and county/version paths below `roadways/{countyId}/{version}`. LP210 uses the isolated candidate-only version `lp210`, package paths `roadways/{countyId}/lp210/packages/{fileName}`, and `candidate-roadway-manifest.json`. GeoJSON uses `application/geo+json`; manifests use `application/json`; uploads set `x-upsert: false` and cache control `max-age=3600`. Public GET downloads—not ETags—are hashed for certification.

## Plan and accounting

The certificate covers 226 counties: 219 single-package and seven partitioned counties, with 237 package/partition objects plus 226 manifests (463 total and 1,861,133,206 certified bytes). Every object has matching expected and actual bytes, SHA-256, governed remote path, and `REMOTE_OBJECT_EXACT_MATCH` status. The seven partitioned counties remain Bexar (2), Collin (2), Dallas (4), Denton (2), Hidalgo (2), Tarrant (4), and Travis (2).

## Guards

The owner executor defaults to `WhatIf`. Every local package and manifest is byte-counted and SHA-256 hashed before the first remote request. Existing exact remote bytes are skipped; absent objects are uploaded only in explicit `Apply`; conflicting bytes fail closed; and every uploaded/existing object is downloaded through the governed public retrieval contract and independently hashed. Uploads are sequential and resumable. No runtime file or database is written.

The 28-county runtime manifest remains SHA-256 `56549d67569f2c74cd202a1e93a30f79591b119ef1fdf58c8d138ffdefaad7bd`, with 28 counties before and after. LP210 performed zero runtime activations, production runtime changes, database writes, or uploads during final portable closure. LP211 is the separate 28-to-254 roadway runtime activation milestone.

## Portable closure

Run from the repository root without credentials or owner-local artifacts:

```sh
npm run verify:lp210
npm run test:lp210
```
