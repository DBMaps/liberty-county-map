# LP051.4 Owner-Side ZIP Source Acquisition & Import

## Executive conclusion
LP051.4 keeps ZIP personalization in a passive, blocked-source state in this repository snapshot because no usable owner-retained HUD USPS ZIP Code Crosswalk artifact is present under `data/source/zip/`. The tooling now supports owner-side acquisition, metadata/checksum retention, schema-gated detection, normalized launch-region ZIP-to-county output, candidate output, and deterministic runtime regeneration without fabricating source completion.

## Owner environment and exact acquisition attempt
Owner shell: Windows PowerShell 5.1 from `C:\GitHub\liberty-county-map`.

```powershell
Set-Location C:\GitHub\liberty-county-map
New-Item -ItemType Directory -Force .\data\source\zip | Out-Null
$env:GRIDLY_HUD_ZIP_COUNTY_URL = "OWNER PASTES OFFICIAL HUD ZIP-COUNTY DOWNLOAD URL LOCALLY"
$env:GRIDLY_HUD_TOKEN = "OWNER ENTERS TOKEN LOCALLY IF HUD REQUIRES ONE"
powershell -ExecutionPolicy Bypass -File .\scripts\build-gridly-zip-source.ps1
node .\tools\build-gridly-zip-source.js
node .\tests\lp051-4-owner-zip-source-acquisition-static.test.js
```

If HUD does not provide a scripted URL, manually download the official HUD ZIP-County Crosswalk file from HUD User, preserve the official filename, and place the still-zipped or original CSV/XLSX artifact in `C:\GitHub\liberty-county-map\data\source\zip\`. Then resume with:

```powershell
Set-Location C:\GitHub\liberty-county-map
node .\tools\build-gridly-zip-source.js
node .\tests\lp051-4-owner-zip-source-acquisition-static.test.js
```

## Source acquired, version, size, checksum
Current repository state: no HUD artifact acquired. Source filename, source version/reporting period, file size, and SHA-256 checksum remain unavailable until the owner supplies the artifact. The exact blocker is authentication/manual download requirement for the official HUD ZIP-County Crosswalk.

## Source authority and limitations
Primary authority is HUD USPS ZIP Code Crosswalk for ZIP-to-county relationship evidence and address ratios when present. Supporting Census Gazetteer ZCTA evidence is optional geography/centroid evidence only. ZIP/ZCTA equality is never sufficient: USPS ZIPs, HUD ZIP-county ratios, Census ZCTAs, and Gridly awareness assignments are separate evidence layers.

## Licensing and redistribution notes
Raw HUD or Census artifacts retained under `data/source/zip/` must be reviewed against source terms before commit. Credentials, HUD tokens, usernames, passwords, and restricted source files must not be committed.

## Normalized source architecture
`tools/build-gridly-zip-source.js` reads only schema-recognized artifacts, writes `data/generated/gridly-zip-county-source-v1.json`, writes `data/generated/gridly-zip-awareness-candidates-v1.json`, and regenerates compact `data/gridly-zip-awareness-index-v2.json`. Unknown files are listed as unknown but do not produce authoritative records.

## County mapping and candidate generation
County evidence maps by FIPS into existing Gridly county IDs only. County-only evidence creates review-required candidates; it does not automatically resolve a community or awareness area. No new county, community, or awareness identity is introduced.

## Split ZIP, Harris/Houston, and 77084 results
Split-ZIP policy is reviewable: single-county, dominant-county candidate, split supported counties, split supported/unsupported, insufficient evidence, and source conflict are distinct classifications. Harris County is not collapsed into generic Houston. Existing Houston regions and distinct Harris communities remain governed. ZIP 77084 remains ambiguous by default and cannot be resolved merely because one county has the highest ratio.

## ZIP-type findings
No new ZIP-type source is present. Existing governed examples remain: 77201 is `po_box_not_supported`, 77210 is `unique_zip_not_supported`, and military ZIP count is zero in the governed runtime.

## Runtime dataset result
The compact runtime remains `data/gridly-zip-awareness-index-v2.json` with 36 governed records. It contains no raw national HUD/Census payload and no credentials. Consumer labels remain communities and awareness areas, not ZIP-first identities.

## Certification and readiness
Source import certification status: `blocked` until a usable HUD artifact is present and schema-valid. Coverage certification status: `blocked` in this repository snapshot. UI integration readiness: `mergeReadyForUiIntegration: false`.

## Browser testing steps
1. Load the app in a browser.
2. Run `window.gridlyLp0514OwnerZipSourceAcquisitionAudit?.()`.
3. Confirm `passiveOnly: true`, `sourceImportCertificationStatus: "blocked"`, and `mergeReadyForUiIntegration: false`.
4. Run `window.gridlyResolveHomeZipAwareness?.("77084")`, `("77201")`, `("77210")`, `("abc")`, and `("99999")` to verify protected outcomes.

## Known limitations and next milestone
LP051.4 does not add visible ZIP onboarding or Settings integration. Recommended next branch: `LP051.5-source-backed-candidate-governance`, after the owner retains an official HUD crosswalk artifact and reviews generated candidates.
