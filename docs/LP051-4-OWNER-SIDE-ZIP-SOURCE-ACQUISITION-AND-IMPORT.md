# LP051.4 Owner-Side ZIP Source Acquisition & Import

## Executive conclusion
LP051.4R1 now detects and imports the owner-retained official HUD USPS ZIP Code Crosswalk workbook at `data/source/zip/ZIP-COUNTY_032026.xlsx`. The source is used only as ZIP-to-county evidence. Communities remain the consumer experience, runtime behavior remains passive, and UI integration remains disabled until candidate governance is reviewed.

## Source acquired, schema, version, and checksum
- Official HUD file acquired: `ZIP-COUNTY_032026.xlsx`.
- Source path: `data/source/zip/ZIP-COUNTY_032026.xlsx`.
- Source name: HUD USPS ZIP Code Crosswalk.
- Source period/version: `03/2026`, derived from the filename token `032026`.
- Worksheet used: `Sheet1`.
- Header row: row `1`; no title or metadata rows precede the header.
- Exact headers used: `zip`, `geoid`, `res_ratio`, `bus_ratio`, `oth_ratio`, `tot_ratio`, `city`, `state`.
- Parsed source row count: `54,562` data rows.
- SHA-256 checksum: `e71413b42849648e74b4d479cde2983bbab7b7e10db2ff3ba11a9057fdfa4b00`.

## Normalized source architecture
`tools/build-gridly-zip-source.js` narrowly recognizes official HUD Excel workbook names matching `ZIP-COUNTY_*.xlsx` and `ZIP_COUNTY_*.xlsx`, then validates the worksheet/header structure before treating the artifact as authoritative. Arbitrary `.xlsx` files are not authoritative. The parser reads the workbook inside the existing pipeline and does not require manual conversion outside the repository workflow.

The normalized evidence written to `data/generated/gridly-zip-county-source-v1.json` includes five-character `zip`, `countyFips`, ratio fields, `sourceName`, `sourceVersion`, `sourceFile`, and per-record `sourceChecksum`. County names are not invented from HUD data; when available they come only from the existing Gridly county mapping layer.

## County mapping and launch-region filtering
LP051.4R1 filters the national HUD workbook down to launch-region ZIP/county evidence. The generated normalized launch-region row count is `743`, with `566` source-backed ZIPs. Existing Gridly county IDs are used for mapped launch counties, and unsupported neighboring county rows are retained only when needed to classify split ZIPs.

ZIP/ZCTA equality is never sufficient: USPS ZIPs, HUD ZIP-county ratios, Census ZCTAs, and Gridly awareness assignments remain separate evidence layers. County-only HUD evidence is never promoted into a resolved community, awareness area, or setup identity. It creates review-required candidate evidence for governance.

## Split ZIP and candidate generation results
Candidate generation produced `566` review-required rows in `data/generated/gridly-zip-awareness-candidates-v1.json`:

- `441` `single_county_source_backed` candidates.
- `78` `dominant_county_candidate` candidates.
- `34` `split_supported_counties` candidates.
- `13` `split_supported_and_unsupported` candidates.
- `0` `insufficient_county_evidence` candidates in the filtered launch-region output.

ZIP `77084` remains governed as `ambiguous` in the runtime data. Its HUD county evidence is county-only evidence and is not sufficient to select a consumer setup result without review. ZIP `77201` remains `po_box_not_supported`, and ZIP `77210` remains `unique_zip_not_supported`.

## Runtime dataset result
`data/gridly-zip-awareness-index-v2.json` remains compact with the existing `36` governed runtime records. The full national HUD workbook is not pushed into browser runtime data. Governance overrides are preserved, unknown county/community/awareness identities remain zero, setup/storage mutation remains absent, and Route Intelligence stays independent.

## Certification and readiness
- Source import certification status: `complete`.
- Coverage certification status: `partial`.
- UI integration readiness: `mergeReadyForUiIntegration: false`.
- Recommended next milestone: source-backed candidate governance review before consumer UI activation.

## PowerShell rerun commands
```powershell
Set-Location C:\GitHub\liberty-county-map
node .\tools\build-gridly-zip-source.js
node .\tests\lp051-4-owner-zip-source-acquisition-static.test.js
```

## Browser testing steps
1. Load the app in a browser.
2. Run `window.gridlyLp0514OwnerZipSourceAcquisitionAudit?.()`.
3. Confirm `primarySourceArtifactDetected: true`, `primarySourceArtifactPath: "data/source/zip/ZIP-COUNTY_032026.xlsx"`, `primarySourceRecordCount > 0`, `primarySourceChecksumAvailable: true`, `primarySourceSchemaValid: true`, `normalizedCountySourceRecordCount > 0`, `sourceBackedZipCount > 0`, `sourceImportCertificationStatus: "complete"`, `coverageCertificationStatus: "partial"`, and `mergeReadyForUiIntegration: false`.
4. Run `window.gridlyResolveHomeZipAwareness?.("77084")`, `("77201")`, `("77210")`, `("abc")`, and `("99999")` to verify protected passive outcomes.

## Acquisition note
The owner has completed the manually download fallback for this milestone; future refreshes should manually download the official HUD workbook when scripted acquisition is unavailable, preserve the official filename, and rerun the builder.
