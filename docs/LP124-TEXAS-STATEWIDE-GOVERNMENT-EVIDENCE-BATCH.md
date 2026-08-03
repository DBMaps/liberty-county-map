# LP124 — Texas Statewide Government Evidence Batch

## Decision and boundary

LP124 executes the first LP123 evidence-class batch for `GOVERNMENT`. It creates exactly 254 independent Texas county/FIPS work units in a candidate-only evidence location. It activates no county, changes no runtime or selector, uploads nothing, and grants neither candidate approval nor production authorization. Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, and Supabase Sync remain unchanged.

## Acquisition attempt

The packaged 254-county control list is `data/lp104/texas-counties.json`. The acquisition source selected for the assertion `COUNTY_GOVERNMENT_IDENTITY` is the United States Census Bureau 2020 PL county endpoint, an official government dataset accountable for county legal names and state/county FIPS relationships. It is classified `SECONDARY`, so an acquired identity would be `MEDIUM`, pending human review; automation does not assign `HIGH`.

The 2026-08-03 execution environment rejected the HTTPS tunnel to `api.census.gov` with HTTP 403 before source content could be observed. Therefore all 254 work units truthfully terminate as `SOURCE_UNAVAILABLE`; none is mislabeled `NO_EVIDENCE_FOUND`, and no evidence record is accepted from inaccessible content. Unsupported values remain `null`.

## Resume and owner prerequisite

Run `LP124_OBSERVATION_DATE=YYYY-MM-DD npm run build:lp124:government` in an owner-controlled environment that permits HTTPS access to `api.census.gov`, then run `npm run test:lp124`. The builder makes one bounded request, reconciles returned state/county FIPS and exact legal names against the packaged inventory, uses deterministic FIPS-based IDs, replaces rather than appends the governed output, checkpoints every county, and seals the result. Any mismatch becomes `REVIEW_REQUIRED`; it is not inferred or silently accepted.

Human reviewers must assess any acquired records later. This milestone must not upload, activate, approve, authorize, promote, or copy its output into a runtime or production path.

## Sealed result

- County work units: 254
- `SOURCE_UNAVAILABLE`: 254
- All other terminal outcomes: 0
- Accepted records: 0
- Assertion, confidence, review-status, and source-priority record counts: 0
- Candidate approval: false
- Production authorization: false
- Runtime modified: false
