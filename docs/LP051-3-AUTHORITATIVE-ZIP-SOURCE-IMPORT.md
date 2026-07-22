# LP051.3 — Authoritative ZIP Source Import

## Executive conclusion

LP051.3 is **source-import blocked** in this environment. The branch adds deterministic owner-side acquisition/build tooling, a compact generated runtime artifact, an authoritative browser audit, static/runtime tests, and documentation, but it does **not** claim a complete authoritative USPS ZIP import because no usable source artifact is locally present and external Census acquisition returned a 403 tunnel failure during implementation.

Manual setup remains active. No onboarding, Settings, setup persistence, active awareness state, Route Intelligence, alerting, weather, service worker, PWA, map focus, or report systems were changed.

## Source search performed

Repository search found:

- Existing governed LP051/LP051.1/LP051.2 ZIP records in `js/app.js`.
- Existing seed artifact `data/gridly-zip-awareness-index-v1.json`.
- Existing LP051, LP051.1, and LP051.2 documentation.
- Runtime county/community/awareness registries in `js/app.js`.
- County implementation road assets containing incidental TIGER `tiger:zip_left` and `tiger:zip_right` tags. These are not accepted as authoritative ZIP-to-awareness assignments.
- No retained HUD USPS ZIP Code Crosswalk artifact.
- No retained Census ZCTA relationship/gazetteer artifact.
- No retained TIGER/Line ZCTA shapefile.
- No retained ZIP-to-place, ZIP-to-county, or postal ZIP-type reference suitable for the 28-county launch footprint.

External search and acquisition evaluated:

- HUD USPS ZIP Code Crosswalk files: selected preferred source, but direct download requires HUD User login/API/token workflow.
- Census Gazetteer ZCTA national file: acceptable supporting ZCTA centroid evidence, but not official USPS ZIP boundaries. Acquisition attempted from Census and failed with `Tunnel connection failed: 403 Forbidden` in this environment.

## Source selected

Preferred selected source for owner-side acquisition is **HUD USPS ZIP Code Crosswalk ZIP-county data** because HUD documents that the files are derived from quarterly USPS Vacancy Data, are updated quarterly, and include residential/business/other address ratios useful for county overlap review.

Supporting source for later candidate enrichment is **Census Gazetteer ZCTA** data. It may provide ZCTA centroid evidence, but it must not be treated as official USPS ZIP boundary authority or as a consumer assignment.

## Source acquisition method

This branch adds `scripts/build-gridly-zip-source.ps1`, compatible with Windows PowerShell 5.1, for deterministic owner-side download attempts. It also adds `tools/build-gridly-zip-source.js`, which writes the compact runtime artifact and honestly reports blocked status when no source artifact exists.

## Source version

No local source version is certified because acquisition is blocked. The recommended HUD period should be recorded from the downloaded HUD ZIP-county file name and metadata at the time the owner runs the acquisition workflow.

## Source authority

HUD USPS ZIP Code Crosswalk is the preferred authority for ZIP-to-county address-ratio evidence. Census ZCTA sources are supporting geography only. Gridly governance remains the authority for consumer awareness assignment.

## Source limitations

- USPS ZIP Codes are postal delivery constructs, not stable Census geography.
- Census ZCTAs approximate ZIP delivery areas for tabulation and are not official USPS ZIP boundaries.
- ZIP-to-county ratios can show county overlap but do not prove a user's community identity.
- USPS preferred city names are mailing conventions and are not automatic Gridly awareness identities.
- Harris/Houston assignments require reviewed regional governance.

## Licensing or redistribution notes

HUD and Census sources are public-use government data sources, but HUD access currently requires login/API workflow. This branch does not commit restricted HUD source material. Owner-side regeneration must retain checksum, file size, original filename, acquisition date, source URL/origin, version/period, and transformation notes.

## ZIP versus ZCTA distinction

LP051.3 enforces separate evidence layers:

1. USPS ZIP Code: postal input.
2. Census ZCTA: Census tabulation geography and optional centroid/geometry evidence.
3. ZIP-to-county relationship: address-ratio evidence, preferably HUD USPS crosswalk.
4. Locality/place evidence: supporting naming/geography evidence only.
5. Gridly awareness assignment: governed consumer identity using existing county/community/awareness registries only.

ZIP/ZCTA equality is never sufficient by itself for setup resolution.

## Raw source artifact contract

Expected fields are retained only when actually available: `zip`, `zipType`, `sourceCountyFips`, `sourceCountyName`, `countyShare`, `residentialShare`, `businessShare`, `otherShare`, `zcta`, `placeName`, `placeCode`, `state`, `latitude`, `longitude`, `sourceName`, `sourceVersion`, `sourceRecordType`, `sourceAuthority`, and `sourceConfidence`.

Unavailable fields must remain null or explicitly unavailable.

## Normalized source artifact

The normalized launch-region source should live under `data/source/zip/` or a documented equivalent and include only the 28 operational counties plus neighboring overlap rows needed to classify split ZIPs involving supported counties.

## Generated runtime dataset

`data/gridly-zip-awareness-index-v2.json` is the compact deterministic runtime artifact for LP051.3. In the current environment it preserves governed LP051.2 behavior and reports `sourceImportStatus: blocked` rather than fabricating broader coverage.

## Governance override architecture

The intended architecture is:

Raw retained source artifact → launch-region normalized source → source-derived candidates → `gridly-zip-governance-overrides` → compact certified runtime index.

LP051/LP051.1/LP051.2 governed records survive. 77084 remains ambiguous. PO Box-only and unique ZIP behavior remains unsupported unless explicitly governed in a later milestone.

## County coverage

All 28 operational counties remain represented by the existing governed foundation, but LP051.3 does not certify imported source-backed county expansion because source acquisition is blocked.

## Community coverage

Community coverage remains partial. The audit reports configured, eligible, directly resolvable, governed, ambiguous, not ZIP-addressable, and uncovered counts from live runtime targets.

## Awareness-area coverage

Awareness-area coverage remains partial and passive. ZIP is not presented as the consumer identity.

## Split-ZIP findings

77084 remains the protected split/ambiguous ZIP. It returns `status: "ambiguous"`, `resolved: false`, and candidate detail without mutating setup.

## PO Box-only findings

77201 remains `po_box_not_supported`.

## Unique ZIP findings

77210 remains `unique_zip_not_supported`.

## Military ZIP findings

No military ZIP source artifact was available locally, so military ZIP count is zero and no military ZIP is supported.

## Harris/Houston findings

The existing simplified Houston regional model is preserved. Records continue to use existing consumer regions such as Downtown / Midtown, North Houston / Greenspoint, Southeast Houston / Hobby, and Baytown rather than collapsing all Houston ZIPs to a generic Houston identity or creating new neighborhoods.

## 77084 decision

77084 remains explicitly ambiguous. It must not resolve automatically until source evidence plus reviewed Gridly governance proves one safe outcome.

## Regeneration steps

1. Acquire source with `scripts/build-gridly-zip-source.ps1` or an approved HUD API/token workflow.
2. Place the permitted raw/normalized artifact under `data/source/zip/`.
3. Run `node tools/build-gridly-zip-source.js`.
4. Run static tests.
5. In browser, run `window.gridlyLp0513AuthoritativeZipSourceImportAudit?.()` and resolver spot checks.

## Windows PowerShell commands

```powershell
Set-Location C:\path\to\liberty-county-map
powershell -ExecutionPolicy Bypass -File .\scripts\build-gridly-zip-source.ps1
node .\tools\build-gridly-zip-source.js
node .\tests\lp051-3-authoritative-zip-source-import-static.test.js
```

## Known limitations

- Source import status is blocked in this environment.
- No new authoritative ZIP assignments are fabricated.
- Existing representative governed records remain the only runtime coverage.
- UI integration remains disabled.

## Source import status

`blocked` — no usable authoritative source artifact could be acquired or provided in this environment.

## Coverage certification status

`blocked` for LP051.3 because source acquisition failed. LP051.2 governed behavior remains safe and partial.

## UI integration readiness

`mergeReadyForUiIntegration: false`.

## Recommended next milestone

LP051.4 should run owner-side HUD acquisition, normalize launch-region ZIP-county ratios, add candidate generation against existing Gridly identities, and review Harris/Houston plus split ZIP assignments before any guarded UI test.
