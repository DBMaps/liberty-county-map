# GRIDLY Read/Write County Containment Validation Plan V463

## 1. Executive Summary

V463 is a documentation-only planning milestone. It defines how Gridly should validate that county boundaries are respected across reads, writes, storage, awareness, route intelligence, registry access, county packages, historical capture, and future transportation-intelligence domains.

No production code, migrations, Supabase changes, UI changes, reporting changes, Route Watch changes, awareness changes, historical-read changes, historical UI exposure, historical API exposure, county activation, County #2 evaluation, DriveTexas activation, or transportation-intelligence activation are made by this plan.

The platform mission remains:

- **Know Before You Go**
- **Awareness Platform First**
- **Route Intelligence Second**

V463 answers: **How do we prove County A cannot contaminate County B?**

### Protected boundaries

The following protected boundaries remain closed and must be enforced by future containment validation:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`

DriveTexas remains **Designed / Validated / Governed / Paused**. Transportation intelligence may be planned for containment, but it is not activated by this milestone.

### V463 conclusion

County containment should be validated as a platform safety property before County #2 can enter visible evaluation. Every future county-aware write should carry explicit county context, every future county-aware read should prove its county filter, and every legacy Liberty exception should be bounded, auditable, and unavailable as a generic fallback for future counties.

The recommended next milestone is **V464 County Package Fixture Standard**, followed by containment audit design and regional candidate review only after fixture expectations are stable.

## 2. County Containment Philosophy

### Core principles

1. **Every county-scoped write belongs to exactly one county.** A write that creates or updates county-specific state should include canonical `countyId`, source domain, schema version, and validation evidence.
2. **Every county-scoped read belongs to exactly one county or an explicitly governed aggregate.** A read should not infer county from viewport, most recent report, user preference, or Liberty fallback unless the compatibility policy explicitly allows it.
3. **Unknown counties fail closed.** Unknown, paused, disabled, malformed, or registry-missing county references should block writes and should return no county-local reads except safe error, diagnostic, or eligibility metadata.
4. **Legacy Liberty compatibility is not generic fallback.** Missing county metadata may be Liberty-compatible only when the record is known to be Liberty-era and the read path is authorized for County #1 compatibility.
5. **County isolation is the default.** County A reports, awareness state, routes, crossings, hazards, source health, saved-place overlays, and package metadata should not appear in County B read or write flows.
6. **Regional aggregation requires explicit governance.** Multi-county summaries, if later authorized, must read from validated county children, preserve per-county provenance, and avoid writing blended results back into a single county namespace.
7. **Future transportation intelligence is contained before activation.** Construction, road work, closures, lane restrictions, advisories, disruptions, and DriveTexas-style feeds must prove county ownership before user-facing use.
8. **Protected boundaries override convenience.** Historical and DriveTexas pause flags remain blockers even if a containment test otherwise passes.
9. **Auditability is required before expansion.** County #2 readiness requires repeatable evidence that reads, writes, storage keys, registry entries, package fixtures, and rollback paths do not cross-contaminate.

### County context expectations

A county context should be treated as valid only when it has:

- Canonical `countyId` from the County Registry.
- Lifecycle state permitting the attempted operation.
- County package reference when package-owned data is involved.
- Storage namespace or row ownership consistent with the requested domain.
- Legacy compatibility mode only when explicitly allowed.

### Unknown county behavior

Unknown county behavior should be conservative:

| Case | Write behavior | Read behavior |
| --- | --- | --- |
| Missing county context in future county-aware path | Block or quarantine. | Return no county-local data. |
| Unknown `countyId` | Block. | Return no county-local data and surface diagnostic metadata only where safe. |
| Paused county | Block public writes unless separately authorized for QA. | Return no public county data except lifecycle-safe registry metadata. |
| Malformed county metadata | Block. | Block or quarantine result. |
| Legacy Liberty row with missing county metadata | Allow only through Liberty compatibility policy. | Read only for County #1 compatibility. |

### Regional aggregation restrictions

Regional aggregation should remain future-only until county containment is proven. When eventually considered, it should:

- Read from county-scoped children rather than unscoped global tables.
- Preserve county provenance on every item.
- Avoid mixed-county deduplication unless source lineage is retained.
- Never write aggregate state into a county namespace without explicit derivation metadata.
- Exclude historical reads and transportation intelligence unless separately authorized.

## 3. Write Containment Model

| Domain | Required county context | Required validation | Failure behavior | Legacy behavior |
| --- | --- | --- | --- | --- |
| Reports | Canonical `countyId`, report location, report source, schema version. | Location belongs to county or approved boundary rule; county is active for reporting; storage target matches county. | Block new write or quarantine invalid submission. | Missing metadata may be treated as Liberty-era only for existing legacy rows, not new writes. |
| Feedback | `countyId` when feedback references county-local behavior; global category when not county-specific. | Feedback domain must match scope; county references must exist in registry. | Store as global only if truly non-county-specific; otherwise block/quarantine. | Legacy general feedback remains readable; county-specific legacy feedback may map to Liberty only under compatibility gates. |
| Saved Places | User/device identity plus county resolution for place overlays. | Geocoded county membership or explicit out-of-county classification; namespace matches user/device/county policy. | Save global shell without county overlay, or block county overlay if invalid. | Existing Liberty saved places remain compatible; future counties cannot inherit Liberty overlays. |
| Route Watch | Route intent, origin/destination county membership, active county, route corridor metadata. | Route segments and watched disruptions must be county-owned or explicitly cross-county governed. | Block county-scoped Route Watch write or store only non-county intent. | Legacy Liberty route state remains County #1-compatible only. |
| Historical Capture | County provenance for captured event, capture domain, protected-boundary flags. | Capture may write only passive governed records; reads/UI/API exposure remain disabled. | Block or quarantine if county missing or protected boundaries would be weakened. | Legacy capture records remain protected; no historical read exposure. |
| Awareness State | County package, county areas, report/hazard inputs, lifecycle state. | Awareness inputs must all be county-owned or safely global; package version must match county. | Block awareness state write or mark invalid. | Liberty awareness compatibility remains bounded to County #1. |
| Alert State | County-owned alert source, alert area, severity, lifecycle state. | Alert references must match county package or county-owned report/hazard source. | Block alert state write; do not emit cross-county alert. | Legacy Liberty alert state remains County #1-compatible. |
| Crossing Review Data | County package crossing ID, reviewer scope, package version. | Crossing ID must exist in county package; review target namespace must match county. | Block review write. | Legacy Liberty crossing review maps only to Liberty package assumptions. |
| Source Health Metadata | County source contract, source ID, observed status, timestamp. | Source belongs to county or governed global source; DriveTexas paused guard preserved. | Block/quarantine source health write. | Existing Liberty source notes remain County #1-compatible if identifiable. |
| County Metadata | Registry `countyId`, lifecycle state, package pointer, governance owner. | Registry schema, lifecycle rules, uniqueness, activation gates. | Block metadata write and treat as launch blocker. | Liberty County #1 metadata may preserve compatibility aliases but not generic fallback. |

## 4. Read Containment Model

| Domain | Allowed reads | County filters | Legacy compatibility | Failure behavior |
| --- | --- | --- | --- | --- |
| Awareness Brief | Current county package, county-owned reports/hazards/alerts, safe global platform metadata. | Require active `countyId` and package version. | Liberty brief may consume legacy Liberty-compatible inputs. | Return no county brief or safe unavailable state. |
| Community Pulse | County-owned report and signal summaries. | Filter by canonical county and approved time/source window. | Legacy Liberty rows may be included only in County #1 pulse. | Suppress pulse rather than mix counties. |
| Alert Cards | County-owned alert state and relevant report/hazard inputs. | Filter by alert county, area, and package IDs. | Legacy Liberty alert cards remain Liberty-only. | Hide invalid cards and flag containment failure. |
| Route Watch | County route state, route intent overlays, county disruptions. | Filter by active county and governed route corridor. | Liberty route reads remain County #1-compatible. | Return no county route intelligence; preserve non-county user intent only. |
| Historical Capture | Passive write evidence and governed diagnostics only. | County provenance required for capture records. | Legacy Liberty capture remains protected. | No public read; preserve protected boundaries. |
| Historical Awareness | Not allowed for consumer/public reads. | Future-only; would require county and protected-boundary authorization. | No legacy public exposure. | Block as protected-boundary failure. |
| Crossings | County package crossing inventory and review status. | Package-owned county filter. | Liberty crossings remain County #1 package-compatible. | Return no crossings for invalid county/package. |
| Hazards | County-owned hazards, report-derived hazards, package-defined hazard areas. | Filter by `countyId`, area, source, and lifecycle state. | Liberty hazard reads can include compatible legacy rows. | Suppress invalid hazards. |
| Saved Places | User/device places plus county overlays relevant to active county. | Read global shell plus matching county child only. | Legacy Liberty overlays available only for Liberty. | Omit county overlay if invalid; do not substitute Liberty. |
| Feedback | User support records in allowed scope; county-specific feedback for matching county. | Filter by user/device and county where applicable. | Legacy Liberty-specific feedback remains Liberty-only. | Hide or quarantine mismatched feedback. |
| County Registry | Publicly safe lifecycle metadata and active/available county entries. | Registry keyed by canonical `countyId`. | Liberty aliases may resolve to County #1. | Unknown county returns unavailable/unsupported state. |
| County Packages | Package metadata and assets for allowed county lifecycle state. | Exact package pointer for `countyId`. | Liberty package remains compatibility anchor. | Do not load package for invalid county. |
| Transportation Intelligence | Future governed feeds only; no active consumer reads now. | Future reads must be county/source scoped and DriveTexas-guarded. | No legacy generic transportation exposure. | Block while paused. |

## 5. Containment Failure Classification

| Failure type | Definition | Default severity | Notes |
| --- | --- | --- | --- |
| Cross-county read leak | County A data appears in County B read result. | Launch Blocker | Protected-Boundary Blocker if historical or transportation data is involved. |
| Cross-county write leak | Write intended for County A lands in County B namespace or row ownership. | Launch Blocker | Must block County #2 activation. |
| Missing county metadata | County-scoped record lacks `countyId`. | Blocker | Warning only for known legacy Liberty inventory not used by future counties. |
| Invalid county metadata | Malformed, non-registry, or lifecycle-ineligible `countyId`. | Blocker | Launch Blocker for county launch paths. |
| Unknown county references | Read/write references county not present in registry. | Blocker | Should fail closed. |
| Legacy row contamination | Legacy Liberty row is consumed by non-Liberty county. | Launch Blocker | Escalates if awareness/route output is affected. |
| Storage contamination | Storage key, namespace, or cache blends county payloads. | Launch Blocker | Includes localStorage, remote rows, and package caches. |
| Route contamination | Route Watch or route disruption mixes counties without governance. | Launch Blocker | Cross-county routes need explicit future policy. |
| Awareness contamination | Brief, pulse, alert, hazard, or area output includes wrong county data. | Launch Blocker | Directly affects public awareness trust. |
| Historical contamination | Historical read/UI/API exposure or mixed historical county provenance. | Protected-Boundary Blocker | Protected flags remain closed. |
| Transportation-intelligence contamination | DriveTexas-style or transportation feed data leaks across counties or activates while paused. | Protected-Boundary Blocker | DriveTexas remains paused. |
| Registry/package mismatch | County registry entry points to wrong package or package contains wrong county IDs. | Launch Blocker | County #2 cannot proceed. |
| Aggregation provenance loss | Regional summary drops county provenance. | Blocker | Launch Blocker if user-facing. |

## 6. Containment Validation Matrix

| System | Write Containment | Read Containment | Legacy Compatibility | County #2 Readiness | Validation Required |
| --- | --- | --- | --- | --- | --- |
| Reporting | New writes require county ownership. | Reads filtered by county and source. | Legacy Liberty rows are County #1-only. | Must block non-Liberty consumption of legacy rows. | Report row county audit, location-boundary checks, namespace checks. |
| Awareness Brief | Writes derived state only from county-owned inputs. | Brief reads active county package and inputs. | Liberty brief preserves existing behavior. | Requires package fixture and input isolation. | Brief input lineage audit. |
| Community Pulse | Pulse state must be county-owned. | Pulse reads matching county rows only. | Liberty legacy rows allowed only for Liberty. | Requires no mixed-county counts. | Pulse aggregation containment audit. |
| Alert Cards | Alert state writes require county alert ownership. | Cards read matching county alerts. | Liberty cards remain compatible. | Requires alert package/source isolation. | Alert source and area audit. |
| Route Watch | County route overlays must be county-scoped. | Route reads matching county corridor only. | Liberty route state remains County #1-only. | Requires cross-county route policy before expansion. | Route corridor and disruption containment audit. |
| Historical Capture | Passive capture writes require provenance. | Consumer historical reads remain disabled. | Legacy capture remains protected. | Requires protected-boundary evidence. | Protected flag audit and provenance audit. |
| Historical Awareness | No new public writes. | No consumer reads. | No legacy UI/API exposure. | Not ready until separately authorized. | Protected-boundary blocker audit. |
| Crossings | Review writes require county package IDs. | Crossings read package-matching county. | Liberty package remains anchor. | Requires fixture-backed package IDs. | Package inventory and review audit. |
| Hazards | Hazard writes require county source or report lineage. | Hazard reads matching county only. | Liberty hazard compatibility remains bounded. | Requires source lineage isolation. | Hazard source/county lineage audit. |
| County Registry | Registry writes require governance and lifecycle validation. | Reads resolve canonical county IDs only. | Liberty aliases are bounded. | Requires County #2 lifecycle and package entry. | Registry schema/lifecycle audit. |
| Storage | County writes use county namespace. | Reads never use generic Liberty fallback. | Legacy keys remain Liberty-compatible. | Requires namespace separation evidence. | Storage key and row ownership audit. |
| Transportation Intelligence | Future writes require county/source contracts; no activation now. | Reads remain blocked while paused. | No generic legacy exposure. | Requires DriveTexas pause and source containment evidence. | Protected-boundary and source-contract audit. |

## 7. Legacy Liberty Compatibility Review

Legacy Liberty records protect County #1 continuity, not regional expansion convenience.

### Legacy record behavior

- Legacy Liberty records with missing county metadata may be interpreted as `liberty-tx` only when the path is explicitly in Liberty compatibility mode.
- Legacy records should not be rewritten, migrated, or reclassified by this plan.
- Future county-aware records should not omit county metadata merely because legacy Liberty rows did.
- Legacy compatibility should be observable in audit output as `compatibilityMode: "legacy-liberty"` or an equivalent future marker.

### Missing county metadata behavior

Missing county metadata should be classified as:

| Context | Behavior |
| --- | --- |
| Known legacy Liberty read for County #1 | Allowed under compatibility policy. |
| New county-aware write | Block or quarantine. |
| Future county read | Block from result set. |
| Registry/package metadata | Blocker. |
| Historical or transportation record | Protected-boundary review required; no public exposure. |

### Legacy report rows

Legacy report rows may remain part of Liberty County awareness, pulse, alert, and hazard behavior if existing behavior depends on them. They must not be used to seed County #2, regional summaries, or transportation intelligence without explicit future validation.

### Liberty fallback protection

Liberty fallback remains protected when it is:

- Explicitly labeled as County #1 compatibility.
- Disabled for unknown or future counties.
- Prevented from satisfying County #2 package, registry, storage, route, or awareness requirements.
- Audited separately from canonical county-aware records.

### County #2 isolation

County #2 must not read Liberty legacy rows, write into Liberty namespaces, inherit Liberty package data, use Liberty route assumptions, or activate Liberty fallback when its own county context is missing.

## 8. County #1 Containment Assessment

| Area | Assessment | Rationale |
| --- | --- | --- |
| Liberty County identity | Already Compatible | Prior milestones established Liberty as County #1 and compatibility anchor. |
| Legacy report compatibility | Partially Compatible | Existing rows can remain Liberty-compatible, but future validation must prove missing metadata cannot leak to County #2. |
| Awareness Brief | Partially Compatible | Liberty behavior can continue, but input lineage should be audited before expansion. |
| Community Pulse | Partially Compatible | Legacy Liberty inputs may be acceptable for County #1; aggregation containment needs future evidence. |
| Alert Cards | Partially Compatible | County-local presentation is expected, but source/area validation should be audited. |
| Route Watch | Requires Future Validation | Route corridors, saved places, and disruptions need explicit county ownership evidence before County #2. |
| Historical Capture | Requires Future Validation | Passive capture may have provenance requirements, while public reads remain disabled. |
| Historical Awareness | Future | Protected boundaries prevent activation or public exposure. |
| Crossings | Partially Compatible | Liberty package assumptions can continue; fixture-backed package IDs should be standardized. |
| Hazards | Partially Compatible | Hazard lineage should prove Liberty-only consumption of legacy rows. |
| Storage | Partially Compatible | Legacy keys remain compatible; future namespaces require validation before expansion. |
| County Registry | Partially Compatible | Registry contract exists conceptually; validation tooling is future work. |
| Transportation Intelligence | Future | Designed and governed only; DriveTexas remains paused. |

## 9. County #2 Containment Readiness

County #2 must not enter visible evaluation until these containment requirements are satisfied:

1. **Write isolation.** All county-scoped writes require canonical County #2 context and cannot land in Liberty namespaces.
2. **Read isolation.** County #2 reads return only County #2 package data, County #2-owned rows, or safe global metadata.
3. **Storage isolation.** Local, remote, cached, package, and QA storage use County #2 namespaces or exact registry/package references.
4. **Registry isolation.** County #2 has a governed registry entry with lifecycle state, package pointer, and validation status.
5. **Package isolation.** County #2 package fixtures contain no Liberty IDs, Liberty-only assumptions, or placeholder data presented as active.
6. **Awareness isolation.** Briefs, pulse, alerts, hazards, and areas are generated only from County #2 inputs.
7. **Route isolation.** Route Watch and saved-place overlays cannot use Liberty route assumptions or disruptions.
8. **Historical isolation.** Historical reads, UI, API exposure, and dashboards remain disabled; passive capture provenance must be county-owned if authorized later.
9. **Transportation isolation.** Transportation intelligence remains inactive unless a future milestone authorizes source contracts and DriveTexas pause changes.
10. **Rollback isolation.** Pausing County #2 should not alter Liberty behavior or expose orphaned County #2 records through Liberty fallback.

## 10. Transportation Intelligence Compatibility

Transportation intelligence remains planning-only. Future containment should cover:

| Future feed/data type | Containment requirement | Activation status |
| --- | --- | --- |
| Construction | County/source contract, geometry ownership, source timestamp, county package mapping. | Not active. |
| Road Work | County-owned work-zone location and source lineage. | Not active. |
| Lane Closures | County route segment ownership and lane metadata provenance. | Not active. |
| Road Closures | County boundary validation, closure source, affected route/crossing linkage. | Not active. |
| Travel Advisories | County relevance rules and advisory provenance. | Not active. |
| Transportation Disruptions | County-scoped disruption IDs and route-impact derivation metadata. | Not active. |
| DriveTexas-style feeds | Explicit DriveTexas governance, pause guard, county/source contract, and protected-boundary validation. | Paused. |

Future transportation reads and writes must not be enabled by registry readiness, package readiness, or storage readiness alone. They require a separately authorized transportation governance milestone and explicit removal or modification of the `DriveTexasPaused: true` boundary.

## 11. Future Audit Design

V463 does not implement audit helpers. Future helpers may take the following shape.

### `window.gridlyCountyContainmentAudit?.()`

**Inputs**

- Optional `countyId`.
- Optional domain list: reporting, awareness, routes, storage, registry, packages, history, transportation.
- Optional mode: `summary`, `strict`, `county2-readiness`, `protected-boundary`.

**Outputs**

- Overall status: `pass`, `warning`, `blocker`, `launch-blocker`, `protected-boundary-blocker`.
- County registry resolution evidence.
- Read/write containment summary by domain.
- Legacy Liberty compatibility findings.
- County #2 readiness findings.
- Protected-boundary findings.

### `window.gridlyCountyReadContainmentAudit?.()`

**Validation categories**

- Read query county filters.
- Result county ownership.
- Legacy Liberty inclusion/exclusion.
- Package and registry consistency.
- Awareness and route output provenance.
- Historical and transportation read blocking.

**Expected checks**

- County A query returns no County B rows.
- Unknown county query returns no county-local data.
- Liberty legacy rows appear only in Liberty-compatible reads.
- Historical awareness and transportation reads remain blocked unless separately authorized.

### `window.gridlyCountyWriteContainmentAudit?.()`

**Validation categories**

- Required `countyId` on county-scoped writes.
- Namespace or row ownership match.
- Source/package/lifecycle validation.
- Quarantine/block behavior for invalid county context.
- Legacy write prevention.

**Expected checks**

- Missing county metadata blocks new county-scoped writes.
- Unknown county writes fail closed.
- County #2 writes cannot use Liberty namespaces.
- Historical and transportation protected boundaries cannot be weakened by writes.

### Audit severity model

Audit helpers should report both machine-readable status and human-readable evidence. A single protected-boundary failure should dominate the audit result even if other categories pass.

## 12. County Activation Dependency Review

| Dependency | Containment impact | Unresolved dependency |
| --- | --- | --- |
| County Activation Lifecycle | Lifecycle gates must include read/write containment status before visible evaluation or launch. | Define exact lifecycle gate names and evidence format. |
| County Registry | Registry must be source of canonical county IDs and lifecycle eligibility. | Implement future registry validation tooling. |
| Storage Namespace | Namespaces must prove no Liberty fallback for future counties. | Define storage audit fixtures and namespace manifest. |
| County Packages | Packages must contain county-owned IDs, geometry, areas, crossings, hazards, and source references. | Standardize package fixture contract. |
| County Validation | Validation must include cross-county negative tests, legacy compatibility tests, and protected-boundary tests. | Create future audit helper design and fixture runner. |
| County Launch | Launch requires no launch blockers or protected-boundary blockers. | Define launch evidence checklist and rollback evidence. |
| Rollback | Rollback must preserve Liberty and hide invalid future-county state. | Define rollback containment tests. |
| Transportation Governance | Transportation containment must remain separate from county activation. | Future governance plan required before activation. |
| Historical Governance | Historical reads/UI/API/dashboard remain disabled. | Future historical read authorization would require separate protected-boundary review. |

## 13. Recommended Milestone Sequence

Recommended sequence after V463:

1. **V464 County Package Fixture Standard.** Define fixture structure needed to prove package identity, county ownership, crossing IDs, awareness areas, hazards, registry mapping, and negative containment cases.
2. **V465 County Containment Audit Helper Design.** Convert this plan into implementation-ready audit helper contracts without implementing production behavior.
3. **V466 Transportation Intelligence Data Governance Plan.** Define source contracts, pause guards, provenance, and county containment for future construction, closures, advisories, and DriveTexas-style data without activation.
4. **V467 Regional Expansion Candidate Review.** Review candidate counties only after package fixture and containment audit standards exist; do not activate County #2 during review.
5. **V468 County #2 Readiness Evidence Package.** Assemble readiness evidence only after candidate review, containment fixtures, and audit design are complete.

This sequence intentionally places package fixtures and containment audit design before regional candidate review so County #2 is not evaluated against incomplete safety criteria.

## 14. Recommended Next Milestone

The recommended next milestone is **V464 County Package Fixture Standard**.

V464 should remain documentation-only unless separately authorized. It should define the minimum fixture and evidence package needed for a county package to support future containment validation, including registry identity, package versioning, county-owned IDs, boundary fixtures, negative cross-county fixtures, legacy Liberty compatibility fixtures, protected-boundary assertions, and County #2 readiness evidence.
