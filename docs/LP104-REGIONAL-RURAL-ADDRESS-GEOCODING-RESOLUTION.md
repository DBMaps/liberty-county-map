# LP104.1 — Texas statewide open address foundation

## Status and honest completion boundary

The statewide **architecture and deterministic 254-county inventory are implemented**. Statewide data acquisition, license approval, builds, the protected 28-county real-address suite, and county activation are not complete. The checked-in coverage report therefore records zero source-covered, eligible, built, certified, or active counties and fails closed. Architecture is not coverage. Google is disabled and is not a completion dependency.

## Source and licensing findings (review snapshot: 2026-07-29)

`data/lp104/source-license-manifest.json` is the machine-readable decision record. Exact current finding: no address source has yet passed Gridly's license gate, so no residential records were downloaded or committed.

| Priority | Source | Finding | Production decision |
|---|---|---|---|
| 1 | Texas Geographic Information Office / TNRIS | Gridly has not acquired a current statewide address-point artifact with an explicit license, county counts, release date, redistribution, derivative, storage, automation, attribution, and residential-coordinate terms. A public viewer is not permission. | Review required; do not ingest. |
| 2 | U.S. National Address Database | A bulk federal aggregator is a candidate. Texas participation, county coverage, record count, release version/date, source-level rights, and residential restrictions must be measured from a pinned release. | Review required; do not ingest. |
| 3 | Texas COG and county 911/E911 | Potentially the strongest local authority, but coverage, endpoints, refreshes, and grants are dataset-specific and 911 restrictions may apply. | Written permission and source manifest required; never scrape viewers. |
| 4 | County appraisal situs | Situs may be text-only or a parcel centroid rather than an entrance. Public-record access does not by itself establish bulk redistribution or product rights. | Per-county legal/precision review required. |
| 5 | OpenAddresses | Bulk tooling is available, but each contributing source retains its own license and attribution. Texas coverage is release-dependent. | Approve and preserve provenance source by source. |
| 6 | Overture Maps addresses | Bulk releases can provide a supplemental corpus. Release license, source provenance, attribution, Texas counts, and address-point precision must be pinned and reviewed. | Release review and measured county audit required. |

Primary review locations: [TxGIO/TNRIS](https://tnris.org/), [National Address Database](https://www.transportation.gov/gis/national-address-database), [Texas 9-1-1 entities](https://www.csec.texas.gov/9-1-1-entities/), [OpenAddresses results](https://results.openaddresses.io/), and [Overture downloads](https://docs.overturemaps.org/getting-data/). Internet search and direct fetch were attempted in this environment but returned HTTP 401/403; accordingly, this work makes no fresh legal or coverage assertion from inaccessible pages. Counsel/data-owner confirmation is a release gate.

## 254-county coverage and eligibility report

`data/lp104/texas-counties.json` contains all 254 Census county identities and FIPS codes; the 28 product cohort is metadata, not pipeline logic. `data/lp104/texas-county-coverage.json` contains every required field for every county and separately reports source availability, eligibility, build, certification, and activation. Null completeness means “not measured,” not zero quality. The initial report deliberately says `source_unavailable` until a qualified manifest and measured build update it.

Rollout states are: `source_unavailable`, `source_review`, `source_approved`, `build_pending`, `built`, `certification_pending`, `certified`, `activation_pending`, `active`, and `blocked`. Activation requires approved licensing, deterministic build, accepted/rejected reconciliation, containment pass, protected representative certification, privacy review, runtime health, and an explicit owner promotion. A build never activates a county.

## Address contract, hierarchy, and strict acceptance

The normalized record contract includes deterministic `id` and `lookupHash`, house number, canonical road, locality and evidence-backed aliases, county ID/FIPS, state/ZIP, coordinate and precision, complete source/license provenance, consumer eligibility, and build version. County Road, FM, SH/TX, US, Interstate, and named-road normalization is county-neutral. Named-road aliases are not invented.

Deterministic precedence is:

1. authoritative county/911 point;
2. authoritative regional/statewide point;
3. National Address Database point;
4. other license-approved open address point;
5. protected Gridly verified exception;
6. strict Census interpolation (never accepted when number/road/geography mismatches and never promoted as an address point);
7. truthful no-result.

Within a tier, precision, recency, stable source ID, and record ID break ties. Conflicting duplicates are retained as build diagnostics; only the winning eligible record is packaged. Runtime final acceptance still requires exact house and canonical road, Texas, no ZIP/county conflict, county containment, approved license/precision, and an address/approved parcel or entrance point. Road geometry, centroids, rejected candidates, and Census mismatches cannot reach Route Preview.

## Storage and runtime decision

Use protected Supabase Postgres/PostGIS as the serving index, list-partitioned by county FIPS, with an exact `(county_fips, lookup_hash)` partial index. The migration enables RLS, removes anonymous/authenticated access, and exposes a security-definer RPC only to `service_role`. The Edge Function computes the lookup key and is the only browser boundary. It queries the Gridly index before the optional legacy disabled commercial adapter, protected exception registry, and Census fallback.

For multi-million-row acquisition, stage encrypted, county-partitioned NDJSON/Parquet packages in private object storage. Keep immutable source/build manifests and hashes there, load only changed county partitions into Postgres, and retain rejects/conflicts in protected build storage—not browser assets. This hybrid keeps resumable ETL cheap while Postgres supplies governed low-latency exact lookup. Cache only accepted response envelopes with controlled TTLs; never provide bulk enumeration.

## Acquisition and build commands

Do not run acquisition until the corresponding license manifest has `productionEligible: true` and the legal fields are filled. Provider-specific download commands belong in an approved source manifest/runbook; never scrape a GIS viewer. After placing an approved bulk extract in protected local storage, transform it to NDJSON and run:

```bash
npm run build:lp104:inventory
node tools/lp104/build-texas-address-foundation.js --input=/protected/source.ndjson --source-manifest=/protected/approved-source.json --out=/protected/build/2026-07-29 --build-version=2026-07-29.1
node tools/lp104/build-texas-address-foundation.js --input=/protected/source.ndjson --source-manifest=/protected/approved-source.json --out=/protected/build/2026-07-29/48001 --build-version=2026-07-29.1 --county-fips=48001
supabase db push
supabase functions deploy gridly-geocode
```

The county option provides resumable isolated rebuilds. Stable sorting and hashes make manifests deterministic. Production loading should use a service-role `COPY` job from private storage inside a controlled worker; do not ship packages to the web root or Git.

## Certification and rollout

### Initial 28 counties

Maintain an encrypted local/production-only manifest with at least two valid rural addresses per county, plus an urban control where applicable. Across the suite cover County Road, FM, SH, US, named roads, unincorporated communities, ZIP/locality differences, and both sides of county lines. Add a nearby wrong-number/road negative for every positive. The owner's Liberty address is a required protected positive and the known Census mismatch is a required negative. Confirm point-in-county against authoritative geometry, exact result/Route Preview coordinate equality, cold/warm behavior, failover, and aggregate latency. Commit no address, coordinate, upstream payload, or screenshot containing private data.

### Remaining 226 counties

Roll out in source/release batches, but build and certify independently by county: license approval → county metrics → isolated build/reconciliation → at least two rural and one applicable urban protected controls → road-class and boundary risks → privacy/runtime review → explicit activation. Prioritize source authority and operational readiness, not geography alone. Rebuild only counties whose source/version or normalization dependency changed. A statewide source release does not waive county certification.

## Browser certification

Load the protected cases locally, never in source control, then run:

```js
await window.gridlyLp104TexasCountyCoverageAudit?.()
await window.gridlyLp104TexasAddressFoundationAudit?.({ cases: protectedCases, googleProviderEnabled: false })
await window.gridlyLp104VisibleRegionalRuralAddressCertification?.({ cases: protectedCases, googleProviderEnabled: false })
```

The result contains the required statewide counts and booleans, redacted per-case classifications/agreements, `failedChecks`, and `safeToMerge`. It must expose no input query, address, coordinate, secret, raw row, or source payload. Network inspection must show browser requests only to Gridly's geocoding boundary.

## Remaining blockers

1. Restore official-site access and complete dated legal review for each candidate source.
2. Acquire at least one qualified Texas release and compute actual county/record/update/completeness metrics.
3. Load and version authoritative county polygons into the protected PostGIS boundary table; lookup containment is already enforced but fails closed while polygons are absent.
4. Load all eligible county packages through a private service-role job and reconcile counts/hashes.
5. Run the protected 28-county suite, including the owner Liberty case; then explicitly activate each passing county.
6. Progressively source, build, certify, and activate the remaining 226 counties.

Until those gates pass, `initial28CoveragePass`, `initial28CertificationPass`, and `safeToMerge` truthfully remain false. Full Texas activation is not claimed.
