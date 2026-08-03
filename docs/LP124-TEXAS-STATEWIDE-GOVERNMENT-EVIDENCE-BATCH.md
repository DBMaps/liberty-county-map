# LP124 — Texas Statewide Government Evidence Batch

## Decision and source audit

LP124 remains an LP123-governed, candidate-only `GOVERNMENT` batch with exactly 254 FIPS-keyed work units. It activates, uploads, deploys, approves, authorizes, and promotes nothing; runtime and production remain unchanged.

The repository audit distinguished three roles rather than treating packaged data as automatically independent evidence:

| Role | Source | Decision |
| --- | --- | --- |
| `CONTROL_INVENTORY` | `data/lp104/texas-counties.json` | The maintained reconciliation list only. Its SHA-256 is sealed in the batch; it is not counted as corroboration. |
| `ACQUISITION_SOURCE` | `assets/boundaries/texas-counties-boundaries.geojson` via the governed LP124 source descriptor | Qualifying immutable local snapshot. It contains 254 Texas features with original TIGER 2025 fields (`STATEFP`, `COUNTYFP`, `GEOID`, `NAME`, and `NAMELSAD`) and was already documented by LP117 as the checked-in authoritative statewide Census boundary package. |
| `CORROBORATING_SOURCE` | None | No independent source was asserted or fabricated. |

The acquisition publisher is the United States Department of Commerce, United States Census Bureau, Geography Division. The exact published artifact identity is `https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip`; the locally read GeoJSON snapshot is immutably pinned by SHA-256 `a9f5a0cf44f40d4f9fae81c16756e9ad32d36b7e9d08e34e96f1f02f94f8a50d`. Its governed descriptor is `evidence/lp124/sources/census-tiger-2025-county-identity-source.json`.

## Local-source contract and execution

The default command uses the governed descriptor and validates its metadata, referenced artifact hash, exact 254-row Texas scope, unique five-digit FIPS values, and legal names before reconciliation:

```bash
npm run build:lp124:government
node tools/lp124/build-government-evidence-batch.mjs --source /owner/path/authoritative-source.json
# LP124_SOURCE=/owner/path/authoritative-source.json npm run build:lp124:government
```

Two machine-validated JSON forms are supported:

1. A governed descriptor with `format: "CENSUS_TIGER_COUNTY_GEOJSON"`, the metadata below, and `artifact.path` plus `artifact.sha256`. The artifact must expose the Census TIGER fields used by the checked-in snapshot.
2. A governed record snapshot with the same metadata and a `counties` array of exactly 254 objects containing `countyFips` and `officialLegalName`.

Required metadata is `sourcePublisher`, exact URL or immutable `sourceIdentity`, ISO `observationDate`, nullable ISO `evidenceDate`, and `sourcePriority`; `acquisitionMethod` should identify owner-snapshot custody. Duplicate, missing, malformed, non-Texas, or non-254 content fails closed. Exact legal-name/FIPS matches become `EVIDENCE_ACQUIRED`; name mismatches become `REVIEW_REQUIRED` and are not accepted.

The authentic local execution read and hash-validated the existing snapshot, reconciled all 254 identities exactly, and accepted 254 candidate evidence records. Every record is `MEDIUM`, `PENDING_REVIEW`, reviewer `null`, county-contained, candidate approval false, production authorization false, and runtime eligible false.

## Optional live adapter

`npm run build:lp124:government:live` retains the Census 2020 PL adapter only as an optional path. It requires successful HTTP status, an `application/json` content type, parseable JSON, headers `NAME`, `state`, and `county`, and exactly 254 unique Texas FIPS rows. An HTTP 200 “Missing Key” HTML page is specifically recorded as `SOURCE_UNAVAILABLE` with diagnostic `UNEXPECTED_CONTENT_TYPE`; malformed JSON and schema failures retain their own diagnostic codes. Live access is no longer the sole owner prerequisite.

## Sealed result and boundary

- County work units: **254**
- `EVIDENCE_ACQUIRED`: **254**
- All other terminal outcomes: **0**
- Accepted records: **254**
- Confidence: **254 MEDIUM**, **0 HIGH**
- Review status: **254 PENDING_REVIEW**
- Remaining prerequisite for acquisition: **none**; human review remains required for any later decision
- Candidate approval, production authorization, runtime eligibility, counties activated, and runtime modified: **false**

The builder replaces rather than appends output, uses deterministic FIPS IDs, checkpoints each terminal work unit, and seals the canonical payload. No LP123 governance file required modification.
