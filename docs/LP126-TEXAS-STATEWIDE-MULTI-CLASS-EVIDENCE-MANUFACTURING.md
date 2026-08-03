# LP126 — Texas Statewide Multi-Class Evidence Manufacturing

LP126 is the single governed, repeatable manufacturing program for the eight LP123 evidence classes. It is audit-first, runtime-isolated, and produces independent county/class outcomes; it does not activate counties, approve candidates, upload evidence, authorize production, or modify protected systems.

## Governed run

Run `npm run manufacture:lp126:evidence`, or invoke `node tools/lp126/manufacture-statewide-evidence.mjs`. Filters include `--class CLASS`, `--classes A,B`, `--source-root PATH`, `--output PATH`, `--resume`, `--force`, and `--dry-run`. Writes use a temporary file and atomic rename. A resumed identical run leaves the sealed artifact unchanged. Adapter exceptions are contained to their class and cannot erase other class results.

The committed run contains exactly 254 LP104 counties, eight LP123 classes, and 2,032 county/class cells. GOVERNMENT wraps all 254 authentic LP124 records. PUBLIC_SAFETY wraps all 254 LP125 reconciliation records (253 acquired and Yoakum review-required), retaining the duplicate Young workbook rows, no-jail, private-facility, OLS, and latest-date semantics. COMMUNITY and DESTINATION each retain one accepted LP122 record for Lee, Milam, and Robertson; those six cells remain review-required because LP122 explicitly records unresolved scope, and the other 502 cells are source-unavailable rather than invented.

HEALTHCARE, EDUCATION, TRANSPORTATION, and PARK have explicit disabled gap adapters. Repository assets that serve runtime, roadway, search, or production purposes were not reclassified as authoritative acquisition sources. Their cells are `NOT_REGISTERED` until an owner governs a suitable source and assertion scope.

## Extension contract

Future statewide work normally adds or enables a registry adapter, records its source in the inventory, and reruns this orchestrator. A separate architecture is warranted only for a genuinely generalized parser, licensing/governance conflict, major schema change, or demonstrated manufacturing limitation—not merely for another evidence class.

The matrix distinguishes adapter implementation, source availability, acquisition execution, evidence acquisition, human review, candidate approval, and production authorization. Evidence acquisition never implies approval; approval never implies production authorization. All committed records and cells keep `candidateApproval`, `productionAuthorization`, and `runtimeEligible` false.

## Owner prerequisites

Owners must select and govern authoritative statewide sources and bounded assertion types for HEALTHCARE, EDUCATION, TRANSPORTATION, and PARK. They should add those adapters to LP126 in one statewide action, preserving source licensing, dates, nulls, county containment, anomaly semantics, and deterministic sealing. No one-class milestone sequence is recommended.
