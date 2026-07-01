# GRIDLY County Package Fixture Standard V464

## 1. Executive Summary

V464 is a documentation-only milestone. It defines the standardized fixture requirements every future county package must satisfy before any future county can be evaluated for activation readiness.

This standard builds on:

- V459 County Activation Architecture Plan
- V460 Liberty County #1 Normalization Plan
- V461 County Registry Contract and Validation Plan
- V462 Storage Namespace and Legacy Liberty Compatibility Plan
- V463 Read/Write County Containment Validation Plan

No production code, runtime behavior, registry code, storage code, Supabase configuration, migrations, county activation, County #2 evaluation, historical reads, history UI, historical APIs, DriveTexas behavior, or transportation-intelligence behavior are changed by this document.

The platform mission remains:

- **Know Before You Go**
- **Awareness Platform First**
- **Route Intelligence Second**

V464 answers: **What evidence must a county package provide before activation readiness can even be evaluated?**

### Protected boundaries

The following protected boundaries remain explicit and closed:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`

DriveTexas remains paused:

- `DriveTexasPaused: true`

Transportation intelligence remains disabled:

- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

### V464 conclusion

Every future county package should be treated as incomplete until it contains fixture-backed proof for boundaries, awareness areas, crossings, road segments, community reports, alerts, Route Watch, containment, validation, rollback, and activation-readiness gates. Fixture packages are not activation packages; they are evidence packages used to prove county ownership, schema stability, negative-case handling, Liberty compatibility boundaries, and readiness for a later audit framework.

The recommended next milestone is **V465 County Activation Readiness Audit Framework**.

## 2. Fixture Philosophy

County package fixtures should be deterministic, reviewable, versioned, and safe. They exist to prove that a county package can be validated before it is activated. They must never serve as a shortcut around registry lifecycle gates, protected-boundary flags, or containment requirements.

Core principles:

1. **Evidence before activation.** A county package should not be evaluated for activation readiness until fixtures demonstrate ownership, containment, validation behavior, and rollback behavior.
2. **Fixtures are non-runtime evidence.** Fixture creation does not change production behavior, add database rows, enable UI, or expose APIs.
3. **County ownership is explicit.** Every county-scoped fixture should carry canonical `countyId`, package version, source domain, and provenance metadata.
4. **Negative fixtures are required.** A fixture package is incomplete unless it includes invalid, foreign-county, missing-county, malformed, paused, and legacy-boundary cases.
5. **Containment is a safety property.** Fixtures should prove County A data cannot satisfy County B validation, reads, writes, route state, awareness state, or storage expectations.
6. **Liberty compatibility is bounded.** County #1 compatibility fixtures may preserve legacy Liberty behavior, but future counties must not inherit Liberty fallbacks.
7. **Protected boundaries are first-class assertions.** Historical reads, history UI, historical APIs, consumer dashboards, DriveTexas, and transportation intelligence must remain off in every fixture package unless a future milestone explicitly changes those boundaries.
8. **Rollback is part of readiness.** Fixture packages should prove that a county can be paused, deactivated, or removed from evaluation without contaminating Liberty or another county.
9. **Human review remains required.** Passing fixture shape checks is not the same as activation approval.

## 3. Fixture Package Structure

A future county fixture package should be organized as a self-contained evidence bundle. The exact file format may be defined later, but the bundle should include the following logical sections:

| Section | Purpose | Required status |
| --- | --- | --- |
| `manifest` | Identifies county, package version, fixture version, lifecycle intent, and evidence inventory. | Required |
| `registry` | Provides registry-ready county identity and lifecycle fixture data. | Required |
| `boundaries` | Defines county polygon or authoritative boundary references. | Required |
| `awarenessAreas` | Defines internal awareness zones, labels, and area relationships. | Required |
| `crossings` | Defines package-owned crossings and crossing metadata. | Required when county has crossings; explicit empty evidence otherwise |
| `roadSegments` | Defines package-owned road or corridor segments used by awareness and Route Watch. | Required |
| `communityReports` | Provides representative report fixtures and report validation cases. | Required |
| `alerts` | Provides alert card and alert-source fixtures. | Required |
| `routeWatch` | Provides route, corridor, saved-place, and disruption relevance fixtures. | Required |
| `containment` | Provides cross-county, missing-county, legacy, and namespace isolation fixtures. | Required |
| `validation` | Provides expected pass/fail results and failure classifications. | Required |
| `activationReadiness` | Provides checklist evidence for later readiness audit. | Required |
| `rollback` | Provides pause, deactivate, and removal expectations. | Required |
| `protectedBoundaries` | Asserts historical, DriveTexas, and transportation-intelligence guards. | Required |

Fixture data should be QA-only and must not be stored in production namespaces. Fixture packages should be suitable for local validation, CI validation, human audit, and future readiness review without requiring Supabase mutations or live external feeds.

## 4. Naming and Versioning Expectations

Fixture names and versions should be stable enough for audit records to reference them unambiguously.

Recommended expectations:

- Use canonical registry `countyId` in every county-scoped fixture path or manifest entry.
- Use immutable fixture package versions, such as `fixtureVersion: "v1"`, paired with county package versions, such as `packageVersion: "2026.1"`.
- Include a schema version for each fixture family, such as `boundaryFixtureSchemaVersion`, `reportFixtureSchemaVersion`, or equivalent.
- Mark fixture lifecycle intent as `draft`, `validation-ready`, `registry-ready`, `activation-audit-ready`, `paused`, or `retired`.
- Avoid ambiguous labels such as `current`, `latest`, `test`, or `new-county` in durable fixture identifiers.
- Include source provenance and reviewer notes when fixture evidence is manually derived.
- Treat fixture updates as additive or versioned; do not silently rewrite previously reviewed fixture evidence.

## 5. Standard Fixture Metadata

Every fixture family should include common metadata:

| Field | Requirement |
| --- | --- |
| `countyId` | Canonical county ID from the County Registry contract. |
| `countyName` | Human-readable county name for review only. |
| `state` | State or jurisdiction code. |
| `fixtureId` | Stable unique identifier within the package. |
| `fixtureType` | Boundary, awareness area, crossing, road segment, report, alert, Route Watch, containment, validation, activation-readiness, or rollback. |
| `fixtureVersion` | Version of the fixture evidence. |
| `packageVersion` | County package version the fixture validates. |
| `schemaVersion` | Schema version for the fixture type. |
| `source` | Authoritative or derived source description. |
| `provenance` | How the fixture was created and reviewed. |
| `expectedResult` | Pass, fail, blocked, warning, or not-applicable. |
| `failureClassification` | Required when `expectedResult` is fail or blocked. |
| `protectedBoundaryImpact` | Whether historical, DriveTexas, or transportation-intelligence boundaries are implicated. |
| `legacyLibertyCompatibility` | Whether the fixture is Liberty-compatible, Liberty-only, future-county-only, or not applicable. |

## 6. Boundary Fixtures

### Purpose

Boundary fixtures prove the county package has a canonical geographic ownership envelope and can determine whether reports, roads, awareness areas, crossings, and routes belong to the county.

### Required evidence

- Authoritative county boundary geometry or governed reference to the boundary source.
- Boundary checksum, version, and provenance.
- Interior sample points, edge sample points, and outside sample points.
- Neighbor-county boundary-adjacent samples.
- Simplification tolerance notes if geometry is simplified for app use.

### Required fields / structure

- `countyId`
- `boundaryFixtureId`
- `geometryType`
- `geometryVersion`
- `sourceAuthority`
- `sourceDate`
- `checksum`
- `interiorSamples`
- `edgeSamples`
- `outsideSamples`
- `neighborSamples`
- `expectedContainmentResults`

### County ownership requirements

The boundary must belong to exactly one canonical county. Shared edges may be represented as adjacency evidence, but ownership assertions should never allow one county package to claim another county's interior.

### Validation expectations

- Interior samples validate as inside the county.
- Outside and neighbor samples validate as outside the county.
- Awareness areas, crossings, road segments, and report fixtures reference the same boundary version.
- Boundary checksum matches the package manifest.

### Negative test expectations

- Foreign county polygons fail.
- Missing or malformed geometry fails.
- Samples outside the boundary fail county ownership.
- Boundary/package `countyId` mismatch is a launch blocker.

### Containment expectations

Boundary fixtures should prove that County #2 cannot use Liberty's boundary and that Liberty cannot silently accept a future county boundary as its own.

### Failure classifications

- `Launch Blocker`: Missing boundary, wrong county boundary, checksum mismatch, or package/registry mismatch.
- `Blocker`: Missing sample coverage or unreviewed geometry source.
- `Warning`: Documentation gap that does not affect ownership determination.

### County #1 / Liberty compatibility notes

Liberty boundary fixtures may preserve County #1 assumptions, but they should be explicitly labeled `legacyLibertyCompatibility: "liberty-only"` when they support legacy behavior.

### Future County #2 readiness relevance

County #2 cannot be evaluated until boundary fixtures prove canonical ownership, neighbor exclusion, and no Liberty fallback.

## 7. Awareness-Area Fixtures

### Purpose

Awareness-area fixtures prove that localized areas used by briefings, community pulse, alert routing, and map presentation are county-owned and boundary-contained.

### Required evidence

- Area identifiers and display labels.
- Area geometry or boundary-derived references.
- Parent county relationship.
- Representative report and alert assignments.
- Overlap and adjacency evidence.

### Required fields / structure

- `countyId`
- `areaId`
- `areaName`
- `areaType`
- `geometryReference`
- `displayPriority`
- `parentBoundaryVersion`
- `expectedReportAssignments`
- `expectedAlertAssignments`

### County ownership requirements

Every awareness area must belong to one county package. Areas may be adjacent to another county, but they must not include another county's package identifiers or legacy Liberty-only area identifiers unless the county is Liberty.

### Validation expectations

- Area geometry is inside or explicitly clipped to the county boundary.
- Area IDs are unique within the county package.
- Display labels are reviewable and non-placeholder.
- Report and alert assignments match expected areas.

### Negative test expectations

- Foreign area IDs fail.
- Areas outside county boundary fail.
- Duplicate area IDs fail.
- Placeholder labels such as `TBD` or copied Liberty names fail for future counties.

### Containment expectations

Awareness-area fixtures should prevent brief, pulse, hazard, or alert output from blending counties.

### Failure classifications

- `Launch Blocker`: Cross-county area ownership or package mismatch.
- `Blocker`: Missing area geometry, duplicate IDs, or invalid labels.
- `Warning`: Minor naming or display-order review issue.

### County #1 / Liberty compatibility notes

Liberty awareness areas may remain compatible with existing County #1 behavior. Missing modern metadata should not become a model for future counties.

### Future County #2 readiness relevance

County #2 needs independent awareness-area fixtures before any awareness output can be evaluated.

## 8. Crossing Fixtures

### Purpose

Crossing fixtures prove that bridge, railroad, water, low-water, or locally significant crossing records are package-owned and can be referenced safely by alerts, reports, and Route Watch.

### Required evidence

- Crossing inventory or explicit evidence that no package-managed crossings are applicable.
- Crossing coordinates, road association, and area association.
- Source/provenance notes.
- Positive and negative lookup cases.

### Required fields / structure

- `countyId`
- `crossingId`
- `crossingType`
- `name`
- `coordinates`
- `roadSegmentIds`
- `awarenessAreaIds`
- `sourceAuthority`
- `reviewStatus`

### County ownership requirements

Each crossing must belong to one county package. Crossings near county lines require boundary evidence and should not be resolved through Liberty fallback.

### Validation expectations

- Crossing coordinates are inside the county or documented as boundary-adjacent with explicit ownership.
- Referenced road segments and awareness areas exist in the same package.
- Crossing IDs are unique and stable.

### Negative test expectations

- Unknown crossing IDs fail.
- Crossings owned by another county fail.
- Crossings with missing coordinates or missing package references fail.
- Liberty crossing IDs used by a future county fail.

### Containment expectations

Crossing fixtures should prove crossing review state and crossing-related alerts cannot leak between counties.

### Failure classifications

- `Launch Blocker`: Cross-county crossing ownership, missing package reference, or wrong county ID.
- `Blocker`: Missing coordinate, road, or area evidence.
- `Warning`: Non-critical display metadata issue.

### County #1 / Liberty compatibility notes

Legacy Liberty crossing assumptions may remain County #1-only. Future county packages must provide their own crossing inventory or explicit empty evidence.

### Future County #2 readiness relevance

County #2 cannot borrow Liberty crossing fixtures to satisfy crossing readiness.

## 9. Road Segment Fixtures

### Purpose

Road segment fixtures prove that roads, corridors, and route-relevant segments used by awareness and Route Watch are county-owned and package-versioned.

### Required evidence

- Segment identifiers and geometry references.
- Road names, aliases, and classification.
- County boundary relationship.
- Segment-to-area and segment-to-crossing relationships.
- Route Watch relevance evidence.

### Required fields / structure

- `countyId`
- `roadSegmentId`
- `roadName`
- `aliases`
- `classification`
- `geometryReference`
- `awarenessAreaIds`
- `crossingIds`
- `routeWatchEligible`
- `sourceAuthority`

### County ownership requirements

Road segments must be county-owned, boundary-contained, or explicitly marked as governed cross-boundary segments for future review. Cross-boundary segments must not activate regional behavior by their existence.

### Validation expectations

- Segment geometry aligns with the county boundary model.
- Segment IDs are unique within the county package.
- References to areas and crossings resolve within the same package.
- Route Watch eligible segments have route relevance metadata.

### Negative test expectations

- Segments outside the county fail unless explicitly documented as governed boundary-adjacent fixtures.
- Missing geometry or source authority fails.
- Liberty segment identifiers in future county fixtures fail.
- Cross-county route blending fails.

### Containment expectations

Road fixtures should prove route, hazard, alert, and report assignment logic cannot use another county's road inventory.

### Failure classifications

- `Launch Blocker`: Wrong county road inventory, cross-county route contamination, or registry/package mismatch.
- `Blocker`: Missing geometry, unresolved references, or unreviewed source.
- `Warning`: Alias or display-name inconsistency.

### County #1 / Liberty compatibility notes

Liberty road segment assumptions may remain compatible for County #1, but they must be labeled as Liberty-only and not treated as generic defaults.

### Future County #2 readiness relevance

County #2 readiness requires its own route-relevant road segment fixtures before Route Watch or awareness evaluation.

## 10. Community Report Fixtures

### Purpose

Community report fixtures prove that user-submitted report examples can be accepted, rejected, assigned, displayed, or quarantined according to county ownership rules.

### Required evidence

- Representative valid reports inside the county.
- Boundary-edge reports.
- Outside-county reports.
- Missing-county, malformed-county, and foreign-county report examples.
- Legacy Liberty report examples when County #1 compatibility is relevant.

### Required fields / structure

- `countyId`
- `reportFixtureId`
- `reportType`
- `coordinates`
- `submittedCountyId`
- `expectedResolvedCountyId`
- `awarenessAreaId`
- `roadSegmentId`
- `timestampPolicy`
- `expectedValidationResult`

### County ownership requirements

A valid county-scoped report must resolve to exactly one county. Future county report fixtures must not rely on missing county metadata or Liberty fallback.

### Validation expectations

- Valid reports resolve to the expected county, area, and optional road segment.
- Invalid reports are blocked or quarantined.
- Legacy Liberty reports are accepted only through County #1 compatibility paths.

### Negative test expectations

- Missing `countyId` fails for future county writes.
- Unknown `countyId` fails.
- Foreign-county coordinates fail.
- Legacy Liberty rows fail when consumed by non-Liberty counties.

### Containment expectations

Community report fixtures should prove report reads, writes, pulse counts, alert derivation, and hazard derivation remain county-scoped.

### Failure classifications

- `Launch Blocker`: Cross-county report leak or write into wrong namespace.
- `Blocker`: Missing county metadata in future write path.
- `Warning`: Non-critical category-label mismatch.

### County #1 / Liberty compatibility notes

Known Liberty-era rows with missing county metadata may remain Liberty-compatible only for County #1. This exception must be explicit and auditable.

### Future County #2 readiness relevance

County #2 cannot be evaluated if it can read Liberty reports, accept missing county metadata, or write into Liberty report namespaces.

## 11. Alert Fixtures

### Purpose

Alert fixtures prove that alert cards, alert sources, severity levels, affected areas, and suppression behavior are county-owned and package-consistent.

### Required evidence

- Valid county alert examples.
- Source authority and severity mapping.
- Area, road, crossing, or report lineage.
- Suppression and expiration expectations.
- Invalid and foreign alert examples.

### Required fields / structure

- `countyId`
- `alertFixtureId`
- `alertType`
- `severity`
- `sourceDomain`
- `sourceId`
- `awarenessAreaIds`
- `roadSegmentIds`
- `crossingIds`
- `derivedFromReportIds`
- `expiresPolicy`
- `expectedDisplayState`

### County ownership requirements

Alerts must be sourced from county-owned reports, package-owned areas, county-owned sources, or safe global platform metadata. A future county alert must not use Liberty-only source assumptions.

### Validation expectations

- Alert references resolve within the same county package.
- Severity and display behavior are deterministic.
- Expired or suppressed alerts do not display.
- Protected boundaries remain closed.

### Negative test expectations

- Foreign alert source fails.
- Alert referencing another county area fails.
- Missing source lineage fails.
- Transportation-intelligence alert fixtures remain disabled unless future authorized.

### Containment expectations

Alert fixtures should prove alert cards cannot cross county boundaries or activate paused transportation domains.

### Failure classifications

- `Protected-Boundary Blocker`: Alert fixture activates historical or transportation display.
- `Launch Blocker`: Cross-county alert display or wrong package reference.
- `Blocker`: Missing severity, source, or area linkage.
- `Warning`: Copy or display-priority review issue.

### County #1 / Liberty compatibility notes

Liberty alert fixtures may preserve County #1 behavior but must not define global alert defaults for future counties.

### Future County #2 readiness relevance

County #2 requires independent alert fixtures before public alert-card readiness can be audited.

## 12. Route Watch Fixtures

### Purpose

Route Watch fixtures prove that saved places, route corridors, road segments, crossings, and route-relevant disruptions are resolved within county containment rules.

### Required evidence

- Valid in-county origin/destination cases.
- Boundary-adjacent route cases.
- Out-of-county and cross-county route cases.
- Saved-place overlay cases.
- Invalid county, missing county, and Liberty fallback cases.

### Required fields / structure

- `countyId`
- `routeWatchFixtureId`
- `origin`
- `destination`
- `routeCorridorId`
- `roadSegmentIds`
- `crossingIds`
- `savedPlaceScope`
- `expectedCountyResolution`
- `expectedRouteWatchState`

### County ownership requirements

Route Watch county overlays must belong to the active county. Global user intent may exist separately, but county route intelligence must not be derived from another county package.

### Validation expectations

- In-county routes resolve to county-owned corridors.
- Cross-county routes are blocked, reduced to non-county intent, or marked for future governed regional policy.
- Saved-place overlays do not inherit Liberty context for future counties.

### Negative test expectations

- Missing county context fails county route overlay creation.
- Liberty route assumptions fail for future counties.
- Foreign road or crossing references fail.
- DriveTexas-derived route disruption fixtures remain paused.

### Containment expectations

Route Watch fixtures should prove route intelligence is county-contained and cannot activate transportation intelligence.

### Failure classifications

- `Protected-Boundary Blocker`: DriveTexas or transportation-intelligence activation.
- `Launch Blocker`: Cross-county route contamination or wrong county namespace.
- `Blocker`: Missing route corridor or unresolved road references.
- `Warning`: Saved-place label issue that does not affect containment.

### County #1 / Liberty compatibility notes

Legacy Liberty route state may remain County #1-compatible. Future counties must use explicit county overlays and must not inherit Liberty route state.

### Future County #2 readiness relevance

County #2 requires Route Watch fixtures before route readiness can be audited, but those fixtures do not activate Route Watch for County #2.

## 13. County Containment Fixtures

### Purpose

County containment fixtures prove that reads, writes, storage, package resolution, registry resolution, awareness output, alerts, reports, crossings, and Route Watch remain isolated by county.

### Required evidence

- Positive same-county read/write examples.
- Cross-county read leak probes.
- Cross-county write leak probes.
- Missing county metadata probes.
- Unknown county probes.
- Paused county probes.
- Legacy Liberty fallback probes.
- Storage namespace probes.

### Required fields / structure

- `containmentFixtureId`
- `activeCountyId`
- `targetCountyId`
- `operationType`
- `domain`
- `inputCountyContext`
- `expectedReadResult`
- `expectedWriteResult`
- `expectedStorageNamespace`
- `expectedFailureClassification`

### County ownership requirements

Containment fixtures must model at least two county identities: Liberty County #1 and one future candidate placeholder. The placeholder does not evaluate or activate County #2; it only proves that non-Liberty data cannot be satisfied by Liberty compatibility.

### Validation expectations

- Same-county operations pass only when lifecycle and fixture rules allow them.
- Cross-county operations fail closed.
- Unknown counties return no county-local data.
- Paused counties do not allow public writes or public activation behavior.

### Negative test expectations

- Liberty fallback for non-Liberty county fails.
- Future county data appearing in Liberty output fails.
- Missing county metadata in future county path fails.
- Wrong storage namespace fails.

### Containment expectations

Containment fixtures are the primary proof that county package evidence cannot be mixed across counties.

### Failure classifications

- `Launch Blocker`: Cross-county read/write/storage/package contamination.
- `Protected-Boundary Blocker`: Historical or transportation exposure.
- `Blocker`: Missing containment probes for a required domain.
- `Warning`: Missing optional diagnostic metadata.

### County #1 / Liberty compatibility notes

Liberty compatibility must be represented as an explicit allowed case only for County #1. It must also have negative paired fixtures proving the same fallback is forbidden for future counties.

### Future County #2 readiness relevance

County #2 cannot enter visible evaluation without passing containment fixture expectations.

## 14. Validation Fixtures

### Purpose

Validation fixtures define expected pass, fail, blocked, warning, and not-applicable outcomes for every fixture family.

### Required evidence

- Validation matrix covering all fixture families.
- Expected failure classifications.
- Schema-valid and schema-invalid examples.
- Lifecycle-valid and lifecycle-invalid examples.
- Protected-boundary assertion results.

### Required fields / structure

- `validationFixtureId`
- `fixtureTypeUnderTest`
- `inputFixtureIds`
- `expectedOutcome`
- `expectedFailureClassification`
- `expectedDiagnosticMessage`
- `protectedBoundaryAssertion`
- `reviewStatus`

### County ownership requirements

Validation fixtures must validate county-scoped evidence against the package's own `countyId` and should reject cross-county fixture substitution.

### Validation expectations

- Positive fixtures pass only when complete and county-owned.
- Negative fixtures fail with the expected classification.
- Protected-boundary fixtures block activation behavior.
- Registry/package mismatches fail.

### Negative test expectations

- A validator that accepts missing future-county `countyId` fails.
- A validator that accepts Liberty fallback for a future county fails.
- A validator that ignores protected boundaries fails.
- A validator that treats fixture warnings as activation approval fails.

### Containment expectations

Validation fixtures should prove that validation itself is county-scoped and cannot be satisfied by another county's evidence.

### Failure classifications

- `Launch Blocker`: Validator accepts cross-county evidence.
- `Protected-Boundary Blocker`: Validator permits historical, DriveTexas, or transportation activation.
- `Blocker`: Required validation outcome missing.
- `Warning`: Diagnostic wording requires review.

### County #1 / Liberty compatibility notes

Validation fixtures should permit known Liberty-only compatibility cases and reject those same cases outside County #1.

### Future County #2 readiness relevance

County #2 readiness depends on validation fixtures that prove complete, isolated, repeatable evidence.

## 15. Activation-Readiness Fixtures

### Purpose

Activation-readiness fixtures summarize whether a county package has sufficient evidence for a future readiness audit. They do not activate a county.

### Required evidence

- Completed fixture package checklist.
- Registry-ready evidence.
- Validation-ready evidence.
- Containment-ready evidence.
- Rollback/deactivation evidence.
- Protected-boundary assertions.
- Human review status.

### Required fields / structure

- `activationReadinessFixtureId`
- `countyId`
- `packageVersion`
- `fixtureVersion`
- `registryReady`
- `validationReady`
- `containmentReady`
- `rollbackReady`
- `protectedBoundariesPreserved`
- `humanReviewRequired`
- `activationDecision`

### County ownership requirements

Activation-readiness fixtures must reference exactly one county package and must not aggregate multiple counties into a single readiness decision.

### Validation expectations

- Readiness may be `not-ready`, `audit-ready`, or `blocked`; it must not be `active`.
- Any protected-boundary failure blocks readiness.
- Any launch blocker blocks readiness.
- Missing required fixture family blocks readiness.

### Negative test expectations

- Readiness fixture with `activationDecision: "active"` fails.
- Readiness fixture that omits protected boundaries fails.
- Readiness fixture that accepts County #2 without registry/package evidence fails.
- Readiness fixture that uses Liberty evidence for a future county fails.

### Containment expectations

Activation-readiness fixtures should prove readiness is county-local and cannot be inherited from Liberty or another future county.

### Failure classifications

- `Protected-Boundary Blocker`: Protected boundary omitted or weakened.
- `Launch Blocker`: Readiness claims activation, cross-county evidence, or missing package evidence.
- `Blocker`: Required readiness checklist incomplete.
- `Warning`: Non-blocking reviewer note.

### County #1 / Liberty compatibility notes

Liberty may have compatibility-ready evidence for County #1 continuity. That evidence does not imply readiness for County #2.

### Future County #2 readiness relevance

County #2 cannot be evaluated until activation-readiness fixtures say only that it is ready for a future audit, not active.

## 16. Registry-Ready Fixture Requirements

A fixture package is registry-ready when it provides enough evidence to compare package identity against the County Registry contract without changing registry code.

Required registry-ready evidence:

- Canonical `countyId`.
- Human-readable county and state labels.
- Lifecycle intent that is not active unless already authorized by a separate milestone.
- Package version and fixture version.
- Boundary checksum and package checksum.
- Compatibility flags for Liberty-only behavior.
- Protected-boundary declarations.
- Expected registry validation result.

Registry-ready does not mean activation-ready. It means the county package can be checked against registry identity and lifecycle rules in a future validation framework.

## 17. Validation-Ready Fixture Requirements

A fixture package is validation-ready when every fixture family includes positive and negative cases with expected outcomes.

Required validation-ready evidence:

- Schema-valid examples for every required fixture type.
- Schema-invalid examples for every required fixture type.
- County ownership pass/fail examples.
- Protected-boundary pass/fail examples.
- Failure classifications for every negative case.
- Evidence that Liberty compatibility is allowed only for County #1.
- Evidence that unknown, paused, missing, and malformed counties fail closed.

Validation-ready does not authorize runtime validation changes or activate county behavior.

## 18. Activation-Ready Fixture Requirements

A fixture package is activation-ready only for the purpose of a future audit when it has:

- Complete boundary evidence.
- Complete awareness-area evidence.
- Complete crossing evidence or explicit not-applicable evidence.
- Complete road segment evidence.
- Complete community report evidence.
- Complete alert evidence.
- Complete Route Watch evidence.
- Complete county containment evidence.
- Complete validation evidence.
- Complete rollback/deactivation evidence.
- Protected-boundary assertions.
- Human review status.
- No launch blockers.
- No protected-boundary blockers.

Activation-ready fixture status is not activation. It is a prerequisite for a later audit framework.

## 19. Rollback and Deactivation Fixture Expectations

Rollback/deactivation fixtures prove that a county can be paused, deactivated, retired, or removed from evaluation safely.

Required expectations:

- Paused county reads return only lifecycle-safe metadata.
- Paused county public writes are blocked unless separately authorized for QA.
- Deactivated county package data does not appear in Liberty output.
- Liberty compatibility does not absorb deactivated future-county data.
- Storage namespaces remain isolated after rollback.
- Route Watch county overlays are suppressed without deleting global user intent.
- Alerts, awareness areas, crossings, and road segments stop contributing to public output.
- Protected boundaries remain closed during rollback.

Rollback failure classifications:

- `Launch Blocker`: Deactivation leaks county data into another county.
- `Protected-Boundary Blocker`: Rollback exposes historical or transportation data.
- `Blocker`: Paused lifecycle still permits public writes.
- `Warning`: Non-public diagnostic cleanup remains incomplete.

## 20. Legacy Liberty Compatibility Fixture Expectations

Legacy Liberty compatibility fixtures protect County #1 continuity while proving that Liberty fallback is not generic.

Required Liberty compatibility evidence:

- Known Liberty-compatible missing-county records.
- Explicit County #1 expected pass cases.
- Paired future-county expected fail cases.
- Legacy storage namespace examples.
- Legacy report compatibility examples.
- Legacy route or saved-place examples when relevant.
- Evidence that Liberty aliases resolve only to County #1.

Compatibility restrictions:

- Liberty fixtures must not satisfy future county registry requirements.
- Liberty fixtures must not satisfy future county boundary requirements.
- Liberty fixtures must not satisfy future county report, alert, crossing, road, or Route Watch requirements.
- Liberty fallback must be visible in validation output as legacy compatibility, not normal county behavior.

## 21. Protected-Boundary Fixture Assertions

Every fixture package must include explicit protected-boundary assertions:

```yaml
historicalReadsEnabled: false
historyUiEnabled: false
historicalApiExposure: false
consumerFacingHistoryDashboard: false
DriveTexasPaused: true
TransportationIntelligenceEnabled: false
TransportationIntelligenceDisplay: false
TransportationIntelligenceActivation: false
```

Required assertions:

- Historical records, if present as passive evidence, are not publicly readable.
- History UI remains disabled.
- Historical APIs remain unexposed.
- Consumer-facing history dashboards remain disabled.
- DriveTexas remains paused.
- Transportation intelligence remains disabled, undisplayed, and unactivated.
- Alert, Route Watch, road, and source fixtures do not smuggle transportation-intelligence activation through package evidence.

Failure classifications:

- `Protected-Boundary Blocker`: Any protected flag is missing, true when it must be false, false when pause must be true, or contradicted by fixture evidence.
- `Launch Blocker`: Protected assertions exist but are not connected to activation-readiness checks.
- `Blocker`: Protected-boundary fixture family missing.

## 22. Minimum Fixture Package Checklist

A future county package should not be considered ready for activation-readiness audit unless all checklist items are complete:

- [ ] Manifest identifies canonical `countyId`, package version, fixture version, and lifecycle intent.
- [ ] Boundary fixtures include positive, edge, outside, neighbor, and malformed cases.
- [ ] Awareness-area fixtures include county-owned areas and negative cross-county cases.
- [ ] Crossing fixtures include inventory or explicit not-applicable evidence.
- [ ] Road segment fixtures include route-relevant and negative foreign-road cases.
- [ ] Community report fixtures include valid, invalid, missing-county, unknown-county, and foreign-county cases.
- [ ] Alert fixtures include source lineage, display expectations, suppression, and negative cases.
- [ ] Route Watch fixtures include in-county, boundary-adjacent, out-of-county, and Liberty-fallback-negative cases.
- [ ] County containment fixtures include read, write, storage, package, registry, and legacy fallback probes.
- [ ] Validation fixtures include expected outcomes and failure classifications.
- [ ] Activation-readiness fixtures state audit readiness only and do not activate the county.
- [ ] Rollback/deactivation fixtures prove pause and deactivation isolation.
- [ ] Legacy Liberty compatibility fixtures are County #1-only and paired with future-county negative cases.
- [ ] Protected-boundary assertions are present and closed.
- [ ] No fixture requires Supabase changes, migrations, runtime code changes, production writes, historical reads, DriveTexas activation, or transportation-intelligence activation.

## 23. County #2 Readiness Relevance

V464 does not evaluate County #2. It defines the fixture standard that County #2, and every future county, must satisfy before any activation-readiness audit can begin.

County #2 must not proceed to visible evaluation until a future milestone can prove:

1. County #2 has its own registry-ready fixture identity.
2. County #2 has its own boundary, awareness-area, crossing, road, report, alert, and Route Watch fixtures.
3. County #2 fixtures do not use Liberty compatibility as normal behavior.
4. County #2 fixtures fail closed when county metadata is missing, unknown, malformed, paused, or foreign.
5. County #2 fixture validation preserves all protected boundaries.
6. County #2 rollback fixtures prove deactivation cannot contaminate Liberty.
7. County #2 activation-readiness fixtures request audit review only and do not activate the county.

## 24. Recommended Next Milestone

**V465 — County Activation Readiness Audit Framework**

V465 should remain documentation-only unless separately authorized. It should define how fixture evidence from V464 is audited for activation readiness. It should not activate County #2, evaluate County #2, modify registry code, modify storage code, modify Supabase, create migrations, enable historical reads, enable history UI, expose historical APIs, resume DriveTexas, or enable Transportation Intelligence.
