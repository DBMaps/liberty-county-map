# LP244.46 Hazard, advisory and winter normalization

## Before-patch inventory

See `reports/lp24446-normalization-inventory.json` for the bounded source audit. The existing UI mixes community physical observations with closure authority, omits winter choices, and assigns ice a water marker. Protocol v2 remains the persistence boundary; normalization is derived in the client. No migration is required.

Implementation and validation evidence will be appended after verification.

## Implemented contract

The browser UMD module js/gridlyHazardNormalization.js adds normalizedEvent at community, DriveTexas and NWS ingestion. Legacy payload fields remain present. The authoritative inventory and complete alias/label/marker mapping are in the companion JSON files.

- condition separates physical observations from operational advice. All 17 requested conditions are supported, plus existing disabled-vehicle and traffic-backup meanings. Unknown input remains UNKNOWN; NWS physical road condition is NOT_APPLICABLE.
- severity is UNKNOWN, LOW, MODERATE, HIGH or SEVERE. Missing values remain UNKNOWN, including the report adapter. Existing explicit source severities remain readable; minor maps to LOW and extreme to SEVERE. Counts never change severity.
- advisory is separate from condition. USE_CAUTION, EXPECT_DELAYS and MONITOR_CONDITIONS are community-safe. AVOID_AREA, RESTRICTED_ACCESS, IMPASSABLE, ROAD_CLOSED, DETOUR_REQUIRED and TRAFFIC_CONTROL require the official ingestion boundary. Unknown advice remains UNKNOWN, with NOT_APPLICABLE permission metadata.
- authorityClass is assigned by the calling ingestion adapter, never by a report's source or claimed authority. Community input cannot acquire official closure/detour wording through fields, severity or confirmations. SYSTEM_DERIVED remains nonofficial. AUTHORIZED_ORGANIZATION and the DISPATCH_PRIVATE / CONSUMER_PROJECTABLE classifications reserve vocabulary only; no organization authorization or Dispatch projection path has been enabled.
- confidence retains a scalar source value and separate bounded confirmation count; absent/unrated confidence is UNKNOWN. It is not verification or authority. The model introduces no reporter/device identity or position history.
- lifecycle maps ACTIVE, UPDATED, RESOLVED, EXPIRED, CANCELLED and UNKNOWN. Legacy confirmed/needs-confirmation states retain active semantics. Cleared, cancelled and expired evidence is excluded from active consumers and map eligibility. Read-time expiry prevents a cached active projection from remaining active after its deadline. Missing legacy state follows the existing active-until-expiry contract; unrecognized explicit state stays UNKNOWN.
- geometryPrecision supports POINT, LINE, POLYGON, ROAD_SEGMENT, PLACE_ONLY, COUNTY_ONLY and UNKNOWN. Valid line and polygon coordinates are copied without centroid replacement. Invalid geometry never claims line/polygon precision; existing provider geometry ownership and locality/radius checks are unchanged. Road-segment/place/county references do not imply point precision.
- provenance retains source event identity, raw type, source classification, observedAt and updatedAt. materialRevision covers condition, severity, advisory, lifecycle, geometry, access observation and official expiry; confirmations/recency alone do not change it. materiallyReopened requires the same identity, a terminal predecessor, active successor and newer explicit source update time. It does not implement deduplication or notification delivery.

Future consumers can obtain condition/severity/advisory/authority/lifecycle directly, geometry from sourceGeometry with geometryPrecision, and source identity/update time from provenance. These are readiness fields, not notification or Route Watch behavior.

## Consumer presentation

Legacy community road_closed stays readable as Road appears blocked. New road_blocked and road_impassable options use observational wording. Official closure alone produces advisory ROAD_CLOSED with UNKNOWN physical condition, since closure is not evidence of an obstruction. Official detour remains Detour Required; a community directive attempt cannot receive that wording. A winter observation with explicit impassableObserved evidence can retain ICE plus accessObservation ROAD_IMPASSABLE and display both observations without an operational directive.

The portrait and legacy pickers group seven winter choices: Ice, Possible black ice, Bridge / overpass icing, Snow-covered road, Sleet / freezing rain, Reduced visibility and Other winter road hazard. Road appears impassable is a separate primary choice. The existing selection, placement, review, acceptance and submission paths remain the owners. No report submission is activated by this change.

One 256-unit SVG winter pin serves all winter subtypes. It replaces the water marker for ice and uses the existing marker asset/anchor system. Subtypes remain in popup/card text. Legacy community closure observations use the generic hazard marker rather than an official closure symbol. Existing source labels distinguish Community reports, Official Roadways / DriveTexas and Official weather.

KBYG and the existing central condition-label adapter preserve winter subtype wording. NWS Winter Storm / Ice Storm warnings retain their weather event name and never produce observed road ice. Active Issues retain source grouping and use normalized terminal lifecycle exclusion. Nearby, Area, County and All retain existing geographic qualification. Delays excludes winter markers unless an EXPECT_DELAYS advisory supports inclusion; no geographic or filter redesign was made.

## Protocol, storage and protected systems

Protocol version 2, its field whitelist and all RPC names are unchanged. The repository's create RPC requires nonempty text report_type and severity, fixes persisted source to user, caps expiry and applies the same admission gate. New report types use those existing fields. normalizedEvent is derived after reads and is never added to the RPC payload. Existing aliases are accepted at the read adapter; legacyReportType preserves the stored spelling. The shared hazard type inventory includes new types under the same cleanup policy.

No migration, database mutation, moderation, deletion linkage, retention duration, reporting gate, public-site, Dispatch, notification, native push, Route Watch relevance, route threshold or awareness-context change was made. No production requests were used for testing. Local Playwright routes abort remote traffic; Leaflet/Supabase libraries and empty NWS responses are supplied locally.

## Verification

The final targeted suite is recorded in reports/lp24446-final-tests.txt. It includes focused normalization, 29 LP244.45 context tests, existing label/KBYG tests, UGC compliance, community lifecycle and official geometry/weather regressions. The focused suite covers legacy aliases, authority spoofing/directives, all winter types, unknown severity, confirmations, system-derived authority, terminal lifecycle, geometry validation, impassability and filter behavior.

The copied, phase-specific browser harness preserves the accepted Cleveland → Crosby → Cleveland → Dayton sequence, also exercises repeated switching/stale generations, and verifies Home storage is unchanged. Portrait checks at 320, 360, 390 and 440 select every winter option through the actual picker handler, verify readable production popup wording and no horizontal overflow, and capture picker/popup PNGs. The SVG is browser-decoded at 256 × 256. The browser benchmark normalizes 10,000 small community fixtures; timings are evidence of cost on this host, not a service-level guarantee.

Nine historical failures were reproduced unchanged against starting HEAD using a read-only app-source substitution: LP197 (2 missing VM helper failures), LP219 (6 existing contract-classification assertions), LP243H8 (1 superseded geometry assertion). These are not new failures. The two database-dependent protocol/client-readiness suites could not run their setup because the local database at 127.0.0.1:55441 is unavailable; no live/production replacement was attempted. Client source compatibility and the unchanged protocol file are checked separately.

## Owner review and deferred work

Review the four portrait sizes, the community/official wording distinction and the seven winter fixture models in reports/lp24446-portrait-browser.json. Database-backed integration remains unverified in this environment. Organization authorization, Dispatch projection admission, notification eligibility/deduplication/delivery and route relevance belong to later phases. LP244.45 remains owner-accepted.

The branch is LP244.46-hazard-advisory-winter-normalization, starting at 6c5504b38d7aa1dbffb41586fda6b0ec1f337aac. This evidence is included in the single local implementation commit named Normalize hazards advisories and winter conditions. No push, merge or deployment is part of this phase.

Final result: **124/124 targeted tests pass**, including 22 focused LP244.46 and 29 LP244.45 tests. Portrait browser errors: 0. Final measured cost: 13.3 ms for 10,000 small normalization fixtures. See `reports/lp24446-test-evidence.json` for the A–V matrix and protected-file checks.
