# LP125 — TCJS Workbook Acquisition Revision

## Governed source and parser

LP125 parses the physically governed Texas Commission on Jail Standards workbook at `evidence/lp125/sources/PopReportCurrent.xlsx`. The builder rejects any bytes except SHA-256 `77970ab3c5c0d3929e774e42c61dda092ad4afe828b21b9fcb223b30c00f540d`, resolves the `BY COUNTY` worksheet from the OOXML workbook relationships, requires `County/Facility` at row 5, and reads data beginning at row 6. It also parses and validates the workbook's `DATA DICTIONARY` definitions for county/facility identifiers, `(No Jail)`, `(P)`, and OLS.

Run `npm run build:lp125:tcjs` to regenerate `evidence/lp125/texas-statewide-county-jail-evidence.json` from the authentic workbook bytes.

## Latest-date reconciliation

The workbook contains 47 reporting dates. LP125 selects only the latest, **2026-07-01**, and does not treat older monthly observations as county identities. Its 258 latest-date rows reconcile to 253 of the 254 identities in `data/lp104/texas-counties.json`.

The source itself contains two unmarked `Young` rows and no `Yoakum` row at the latest date. LP125 preserves both Young source-row references and leaves Yoakum unclassified with `REVIEW_REQUIRED`; it does not silently relabel a Young row as Yoakum. This is a truthful source anomaly, not an inferred correction.

The resulting classifications are 227 counties with an unmarked county-jail entry, 22 `(No Jail)` counties, and eight counties with a `(P)` private-facility entry. No OLS identifier occurs at the latest reporting date; the zero count and the source dictionary definition remain explicit.

## Governance boundary

Every evidence record carries the workbook path and hash, publisher, worksheet, source row, identifier value, reporting date, and inventory identity. Raw `County/Facility` values are preserved rather than expanded into invented facility names. No address, contact information, or unsupported classification is added.

LP125 is evidence acquisition only. `candidateApproval`, `productionAuthorization`, `runtimeEligible`, `countiesActivated`, and `runtimeModified` remain `false`. No runtime file is changed by the builder.
