# GRIDLY County Registry Contract and Validation Plan V461

## 1. Executive Summary

V461 is a documentation-only planning milestone. It defines the formal county registry contract and validation plan required before any future county can be safely represented, evaluated, piloted, or activated.

No production code, migrations, UI flows, onboarding behavior, Route Watch behavior, reporting behavior, awareness behavior, historical-read behavior, Supabase behavior, DriveTexas activation, transportation-intelligence activation, county selection, or county activation is changed by this plan.

The platform mission remains:

- **Know Before You Go**
- **Awareness Platform First**
- **Route Intelligence Second**

The corrected county-platform roadmap remains:

```text
Gridly Platform
  -> County Context
  -> Localized Awareness Experience
  -> Transportation Intelligence
```

V461 answers: **What must a county registry entry contain, and how do we validate it before County #2?**

### Protected boundaries

The following boundaries remain closed and must be treated as protected validation requirements for every future registry plan:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`

DriveTexas remains **Designed / Validated / Governed / Paused**. Registry readiness does not activate DriveTexas, transportation intelligence, historical reads, historical UI, historical API exposure, or a consumer-facing history dashboard.

### V461 conclusion

A county registry entry should be a governed pointer to a county package, not an activation switch. It should identify the county, declare lifecycle and visibility, reference validated package artifacts, define storage/read/write containment, record source governance, and point to approval and rollback evidence. County #2 should not be added, evaluated visibly, piloted, or activated until the registry contract, package evidence, containment policy, rollback policy, and protected-boundary validations are complete.

The recommended next milestone is **V462 Storage Namespace and Legacy Liberty Compatibility Plan**.

## 2. Registry Contract Definition

### Contract purpose

The county registry should provide the minimum authoritative metadata needed to govern county availability. It should not embed full county package data. Instead, it should point to versioned artifacts and evidence owned by package, storage, operations, QA, product, and source-governance processes.

### Field readiness classes

| Readiness class | Meaning |
| --- | --- |
| Required before planned | Must exist before a county can be represented in the registry at all. |
| Required before prepared | Must exist before package assembly and internal validation can begin. |
| Required before validated | Must exist before validation can be considered complete. |
| Required before pilot_ready | Must exist before any controlled pilot exposure. |
| Required before activated | Must exist before public activation. |
| Optional | Useful metadata but not required for lifecycle movement. |
| Future | Reserved for later platform phases; must not imply current activation. |

### Registry field contract

| Field | Classification | Description | Validation intent |
| --- | --- | --- | --- |
| `countyId` | Required before planned | Canonical stable identifier, recommended lowercase slug such as `liberty-tx`. | Must be unique, immutable after activation, and safe for storage namespace use. |
| `displayName` | Required before planned | User-facing county name. | Must not be empty and must match package/localized copy expectations. |
| `stateCode` | Required before planned | Two-letter state code. | Must be uppercase and compatible with source identifiers. |
| `stateName` | Required before planned | Full state name. | Must match `stateCode`. |
| `lifecycleState` | Required before planned | Governance state: `planned`, `prepared`, `validated`, `pilot_ready`, `activated`, `paused`, or `retired`. | Must use allowed state and transition rules. |
| `visibility` | Required before planned | Exposure state: `hidden`, `internal`, `pilot`, or `public`. | Must be compatible with lifecycle state. |
| `defaultCity` | Required before prepared | Default locality label for awareness copy and map context. | Must be county-local and package-owned. |
| `boundaryRef` | Required before prepared | Pointer to the authoritative boundary artifact. | Must resolve to package boundary metadata before validation. |
| `packageRef` | Required before prepared | Pointer to the county package manifest or package root. | Must resolve to a versioned package bundle. |
| `awarenessConfigRef` | Required before prepared | Pointer to awareness-area and localized-awareness configuration. | Must resolve before awareness-area validation. |
| `storagePolicyRef` | Required before validated | Pointer to storage namespace and legacy compatibility policy. | Must prove namespace ownership and fallback limits. |
| `containmentPolicyRef` | Required before validated | Pointer to read/write containment policy. | Must prove county-scoped reads, writes, quarantine, and unsupported-county handling. |
| `rollbackPolicyRef` | Required before pilot_ready | Pointer to pause/deactivation/rollback policy. | Must prove the county can be paused or deactivated without data leakage. |
| `validationEvidenceRef` | Required before validated | Pointer to validation evidence bundle. | Must include boundary, fixtures, containment, rollback, source, and protected-boundary evidence. |
| `activationApprovalRef` | Required before activated | Pointer to approval record for public activation. | Must be absent or non-activating before `activated`; required for `activated`. |
| `sourceStatus` | Required before prepared | Source governance summary such as `not_started`, `inventory_only`, `contracted`, `validated_paused`, or `active`. | Must not imply transportation activation unless lifecycle, source, and pause gates permit it. |
| `sourceContractRef` | Required before validated | Pointer to county source contract bundle. | Must define source authorities, allowed uses, pause status, review cadence, and owner. |
| `transportationEligibility` | Future | Future readiness status for transportation intelligence. | Must remain non-activating in V461. |
| `countySourceIdentifiers` | Future | External source identifiers, such as state/county source codes. | Must be governed before transportation use. |
| `feedPauseStatus` | Future | Per-feed pause/active status. | Must preserve DriveTexas paused status unless separately authorized. |
| `DriveTexasPaused` | Required before planned for Texas counties | Explicit DriveTexas pause guard. | Must be `true` unless a future authorized milestone changes it. |
| `registryOwner` | Required before planned | Accountable owner for registry metadata. | Must be named role or team. |
| `packageOwner` | Required before prepared | Accountable owner for package artifacts. | Must be named role or team. |
| `qaOwner` | Required before validated | Accountable owner for validation evidence. | Must be named role or team. |
| `storageOwner` | Required before validated | Accountable owner for storage policy and containment. | Must be named role or team. |
| `sourceGovernanceOwner` | Required before validated | Accountable owner for source contracts. | Must be named role or team. |
| `operationsOwner` | Required before pilot_ready | Accountable owner for pilot/activation operations and rollback. | Must be named role or team. |
| `productOwner` | Required before pilot_ready | Accountable owner for user-facing readiness. | Must be named role or team. |
| `supportOwner` | Required before activated | Accountable owner for external support and escalation. | Must be named role or team. |
| `reviewCadence` | Required before pilot_ready | Review interval for package, source, and operations readiness. | Must be explicit before pilot exposure. |
| `lastReviewedAt` | Required before pilot_ready | Last governance review date. | Must be current enough for pilot/activation policy. |
| `notesRef` | Optional | Pointer to operations or governance notes. | Supports auditability but is not a lifecycle gate unless referenced by policy. |
| `retirementReasonRef` | Required before retired | Pointer to retirement decision and data handling plan. | Required when state is `retired`. |
| `pauseReasonRef` | Required before paused | Pointer to pause decision and restart criteria. | Required when state is `paused`. |

## 3. Lifecycle State Validation Rules

### Lifecycle state summary

| State | Purpose | Maximum visibility | General rule |
| --- | --- | --- | --- |
| `planned` | Registry placeholder for governed future work. | `hidden` | Identity only; no package assumptions or runtime use. |
| `prepared` | Package assembly and internal work may proceed. | `internal` | Package references exist, but evidence is incomplete. |
| `validated` | Evidence is complete enough for non-public readiness review. | `internal` | Validated does not mean pilot or public exposure. |
| `pilot_ready` | Controlled pilot exposure may be approved. | `pilot` | Requires rollback, operations, support, and approval gates. |
| `activated` | Public county availability is approved. | `public` | Requires activation approval and all blockers cleared. |
| `paused` | Temporarily disabled after prior readiness or activation. | `hidden` or `internal` | Requires pause reason and rollback/deactivation containment. |
| `retired` | Permanently removed from active lifecycle. | `hidden` | Requires retirement reason and no user-facing visibility. |

### `planned`

| Rule area | Requirement |
| --- | --- |
| Required registry fields | `countyId`, `displayName`, `stateCode`, `stateName`, `lifecycleState`, `visibility`, `registryOwner`, and Texas `DriveTexasPaused: true` where applicable. |
| Required package evidence | None. Package work may be unknown. |
| Allowed visibility | `hidden` only. |
| Allowed reads | No county-specific production reads. Registry metadata may be read by internal governance tools only. |
| Allowed writes | No county-scoped production writes. Planning notes only. |
| Allowed transitions | `planned -> prepared`, `planned -> retired`. |
| Disallowed behavior | Public listing, pilot listing, onboarding selection, county detection, awareness rendering, report routing, storage namespace creation in production, transportation activation, historical exposure. |

### `prepared`

| Rule area | Requirement |
| --- | --- |
| Required registry fields | All `planned` fields plus `defaultCity`, `boundaryRef`, `packageRef`, `awarenessConfigRef`, `packageOwner`, and `sourceStatus`. |
| Required package evidence | Package manifest exists in design, boundary and awareness references are identified, source inventory is started. |
| Allowed visibility | `hidden` or `internal`. |
| Allowed reads | Internal package review reads only; no consumer reads. |
| Allowed writes | No production user writes. Test fixture writes only in isolated non-production contexts if separately approved. |
| Allowed transitions | `prepared -> validated`, `prepared -> planned` for demotion, `prepared -> paused`, `prepared -> retired`. |
| Disallowed behavior | Public/pilot visibility, production report writes, broad read filters, default-county fallback for this county, Route Watch activation, transportation activation. |

### `validated`

| Rule area | Requirement |
| --- | --- |
| Required registry fields | All `prepared` fields plus `storagePolicyRef`, `containmentPolicyRef`, `validationEvidenceRef`, `sourceContractRef`, `qaOwner`, `storageOwner`, and `sourceGovernanceOwner`. |
| Required package evidence | Boundary, inside/outside fixtures, awareness-area validation, crossing validation if crossings exist, road-segment validation if road segments exist, source governance, protected-boundary checks, and read/write containment evidence. |
| Allowed visibility | `hidden` or `internal`. |
| Allowed reads | Internal validation reads only, scoped to package and fixture evidence. |
| Allowed writes | No production user writes; validation artifacts only. |
| Allowed transitions | `validated -> pilot_ready`, `validated -> prepared` for evidence correction, `validated -> paused`, `validated -> retired`. |
| Disallowed behavior | Pilot/public user exposure, production county selection, production county detection, activation approval bypass, historical UI/API exposure, DriveTexas activation. |

### `pilot_ready`

| Rule area | Requirement |
| --- | --- |
| Required registry fields | All `validated` fields plus `rollbackPolicyRef`, `operationsOwner`, `productOwner`, `reviewCadence`, and `lastReviewedAt`. |
| Required package evidence | All validation evidence plus rollback/deactivation proof, pilot support plan, pilot allowlist policy, and launch-blocker review. |
| Allowed visibility | `hidden`, `internal`, or `pilot`. |
| Allowed reads | Pilot-scoped reads only when a separate pilot authorization exists. |
| Allowed writes | Pilot-scoped writes only when containment, rollback, support, and quarantine rules are approved. |
| Allowed transitions | `pilot_ready -> activated`, `pilot_ready -> validated` for rollback from pilot readiness, `pilot_ready -> paused`, `pilot_ready -> retired`. |
| Disallowed behavior | Public visibility, unscoped writes, unsupported historical reads, consumer history dashboard, transportation activation without separate governance. |

### `activated`

| Rule area | Requirement |
| --- | --- |
| Required registry fields | All `pilot_ready` fields plus `activationApprovalRef` and `supportOwner`. |
| Required package evidence | Complete evidence bundle, launch approval, rollback approval, support readiness, source governance signoff, and protected-boundary signoff. |
| Allowed visibility | `public`; `internal` may be used only during emergency downgrade while transitioning to `paused`. |
| Allowed reads | County-scoped production reads only. Legacy/null reads must follow explicit county-specific compatibility policy. |
| Allowed writes | County-scoped production writes only, with county metadata and containment. |
| Allowed transitions | `activated -> paused`, `activated -> retired` only through governed rollback/retirement. |
| Disallowed behavior | Activation without approval, cross-county read/write leakage, Liberty fallback reuse for a different county, DriveTexas activation unless separately authorized, protected historical exposure. |

### `paused`

| Rule area | Requirement |
| --- | --- |
| Required registry fields | Existing state-appropriate fields plus `pauseReasonRef` and `rollbackPolicyRef`. |
| Required package evidence | Pause reason, impact assessment, restart criteria, containment proof, and data handling notes. |
| Allowed visibility | `hidden` or `internal`. |
| Allowed reads | Internal diagnostics only unless a specific read-only support mode is approved. |
| Allowed writes | No new user writes. Administrative remediation writes only if separately approved and contained. |
| Allowed transitions | `paused -> prepared`, `paused -> validated`, `paused -> pilot_ready`, `paused -> activated` only after state-appropriate revalidation; `paused -> retired`. |
| Disallowed behavior | Public/pilot visibility, new production writes, silent restart, historical exposure, transportation feed activation. |

### `retired`

| Rule area | Requirement |
| --- | --- |
| Required registry fields | Existing state-appropriate fields plus `retirementReasonRef`. |
| Required package evidence | Retirement decision, archival plan, support plan, and no-visibility proof. |
| Allowed visibility | `hidden` only. |
| Allowed reads | Internal archival/governance reads only. |
| Allowed writes | No new user writes. |
| Allowed transitions | None by default; any revival must begin as a new governed planning decision. |
| Disallowed behavior | Public/internal/pilot listing, new activation, new writes, source feed activation, use as fallback. |

## 4. Visibility Contract

### Visibility states

| Visibility | Meaning | User impact |
| --- | --- | --- |
| `hidden` | Not visible in product surfaces. | Users cannot select, view, pilot, or discover the county. |
| `internal` | Visible only to internal governance or validation tooling. | No consumer or pilot exposure. |
| `pilot` | Visible only to an approved pilot cohort or controlled pilot context. | Limited exposure may exist, but public activation has not occurred. |
| `public` | Visible to general users in supported product flows. | County is active and supported. |

### Visibility vs lifecycle

`lifecycleState` describes **governance readiness**. `visibility` describes **exposure**. A county can be `validated` but still `hidden`; validation evidence does not grant user exposure. A county can be `paused` after being previously `activated`, but its visibility must be downgraded to `hidden` or `internal`. Public visibility is a result of activation approval, not a package validation side effect.

### Allowed combinations

| Lifecycle state | `hidden` | `internal` | `pilot` | `public` |
| --- | --- | --- | --- | --- |
| `planned` | Allowed | Not allowed | Not allowed | Not allowed |
| `prepared` | Allowed | Allowed | Not allowed | Not allowed |
| `validated` | Allowed | Allowed | Not allowed | Not allowed |
| `pilot_ready` | Allowed | Allowed | Allowed | Not allowed |
| `activated` | Emergency downgrade only | Emergency downgrade only | Not allowed | Allowed |
| `paused` | Allowed | Allowed | Not allowed | Not allowed |
| `retired` | Allowed | Not allowed | Not allowed | Not allowed |

## 5. Package Reference Contract

A registry entry should point to package artifacts through stable references. V461 does not implement files or prescribe a final directory layout. It defines the expected reference types.

| Reference type | Purpose | Required by state | Notes |
| --- | --- | --- | --- |
| Package manifest | Declares package version, owners, artifacts, sources, validation status, and compatibility notes. | `prepared` | Registry `packageRef` should resolve here or to an equivalent package root. |
| Data folder | Groups package data artifacts. | `prepared` | Should remain package-owned, not registry-embedded. |
| Boundary artifact | County polygon and boundary metadata. | `prepared` | Must include source, version, coordinate system, and validation date by `validated`. |
| Awareness config | Area labels, default city/locality, localized awareness rules, and unavailable-state copy. | `prepared` | Must be validated before pilot readiness. |
| Crossing config | Crossing source data, identifiers, display labels, local overrides, and fallback rules. | `validated` if crossings are used | Optional only if the county package explicitly has no crossing-dependent surfaces. |
| Road segment config | Road/corridor geometry, names, aliases, normalization, and fixture expectations. | `validated` if road segments are used | Required before route or transportation compatibility claims. |
| Source contract bundle | Source authorities, allowed uses, cadence, licensing constraints, owners, pause status, and escalation. | `validated` | Transportation source contracts do not activate transportation intelligence. |
| QA fixture bundle | Boundary cases, inside/outside points, awareness samples, crossing samples, road samples, report samples, and route samples. | `validated` | Required for validation evidence. |
| Operations/governance notes | Pilot/activation owners, support plan, rollback plan, review cadence, and decision records. | `pilot_ready` | Required before pilot exposure and activation approval. |

## 6. Validation Evidence Contract

Validation evidence should be stored as a governed evidence bundle referenced by `validationEvidenceRef`. Evidence should be reproducible, dated, owner-approved, and associated with a package version.

| Evidence area | Required evidence | Required before |
| --- | --- | --- |
| Boundary validation | Boundary source, version, polygon validity, coordinate system, simplification notes, and known limitations. | `validated` |
| Inside/outside fixtures | Representative points inside, outside, near border, near default city, and near known boundary edge cases. | `validated` |
| Awareness-area validation | Area definitions, label coverage, default area behavior, unsupported-area behavior, and localized copy review. | `validated` |
| Crossing validation | Crossing identifiers, source match, duplicate handling, override governance, and display-name checks. | `validated` if crossing surfaces are used |
| Road segment validation | Segment geometry, corridor names, aliases, containment, route relevance samples, and normalization expectations. | `validated` if road/route surfaces are used |
| Storage policy validation | Namespace rules, key ownership, legacy compatibility, no cross-county preference leakage, and migration/rollback expectations. | `validated` |
| Read/write containment validation | County-scoped read filters, county metadata writes, null/legacy handling, unsupported-county quarantine, and audit coverage. | `validated` |
| Rollback validation | Pause behavior, visibility downgrade, read/write stop conditions, support fallback, and restart criteria. | `pilot_ready` |
| Source governance validation | Source authority, allowed use, owner, cadence, pause status, licensing notes, and escalation path. | `validated` |
| Protected-boundary validation | Proof that historical reads, history UI, historical API exposure, consumer history dashboard, DriveTexas activation, and transportation intelligence remain off unless separately authorized. | `planned` and every promotion |

## 7. Registry Error Classification

### Severity classes

| Severity | Meaning | Lifecycle impact |
| --- | --- | --- |
| Warning | Non-blocking issue that should be tracked. | Does not block current state, may block future promotion. |
| Blocker | Invalid for the requested state. | Blocks entry or promotion to that lifecycle state. |
| Launch blocker | Invalid for pilot or public exposure. | Blocks `pilot_ready` or `activated`. |
| Protected-boundary blocker | Violates a protected non-goal or safety boundary. | Blocks all promotion and requires immediate remediation. |

### Error catalog

| Error class | Severity | Applies when | Expected remediation |
| --- | --- | --- | --- |
| `missing_required_field` | Blocker | Field required for requested state is absent. | Add the governed field or demote lifecycle. |
| `invalid_county_id` | Blocker | `countyId` is malformed or unsafe for namespace use. | Rename before activation; never mutate active id without migration plan. |
| `duplicate_county_id` | Blocker | Another registry entry uses the same id. | Resolve uniqueness before registry acceptance. |
| `invalid_lifecycle_transition` | Blocker | Requested transition is not allowed. | Return to an allowed prior state and complete required evidence. |
| `invalid_visibility_for_state` | Blocker or launch blocker | Visibility exceeds lifecycle allowance. | Lower visibility or promote only after evidence and approval. |
| `missing_boundary_ref` | Blocker | Boundary reference is required but absent. | Add package boundary reference. |
| `missing_package_ref` | Blocker | Package reference is required but absent. | Add package manifest/root reference. |
| `missing_storage_policy` | Blocker | Storage policy is required but absent. | Add storage namespace and legacy policy reference. |
| `missing_containment_policy` | Blocker | Read/write containment policy is absent. | Add containment reference and validation evidence. |
| `missing_rollback_policy` | Launch blocker | Pilot/activation requested without rollback policy. | Add rollback/deactivation evidence. |
| `missing_validation_evidence` | Blocker | Validation requested without evidence bundle. | Add evidence bundle or demote. |
| `activated_without_approval` | Launch blocker | `activated` state lacks approval reference. | Add approval record or demote. |
| `paused_without_reason` | Blocker | `paused` state lacks pause reason. | Add pause reason and restart criteria. |
| `retired_with_visibility` | Blocker | `retired` state is not `hidden`. | Set visibility to `hidden`. |
| `protected_boundary_violation` | Protected-boundary blocker | Historical exposure, DriveTexas activation, or transportation activation is implied or enabled without authorization. | Stop promotion, preserve boundary, and require separate milestone. |
| `liberty_fallback_leakage` | Protected-boundary blocker | A non-Liberty county uses Liberty legacy/null fallback. | Remove fallback path and require county-specific containment. |
| `county2_activation_safety_failure` | Launch blocker | Future County #2 cannot prove containment, package evidence, rollback, or source governance. | Keep County #2 hidden and unactivated. |
| `source_status_overclaims_activation` | Protected-boundary blocker | Source fields imply live transportation intelligence without approval. | Downgrade source status and preserve paused feed status. |

## 8. County #1 Registry Mapping

This mapping is descriptive only. It does not change runtime behavior.

| Registry field | Liberty County status | Notes |
| --- | --- | --- |
| `countyId` | Already exists | Liberty is already treated as the canonical County #1 conceptually, with `liberty-tx` as the recommended id. |
| `displayName` | Already exists | Liberty County wording exists in current product/planning artifacts. |
| `stateCode` | Already exists | Texas context exists. |
| `stateName` | Already exists | Texas context exists. |
| `lifecycleState` | Partially exists | V458/V460 establish readiness conceptually, but no production registry schema exists. |
| `visibility` | Partially exists | Liberty is the only visible county today, but not through a formal registry contract. |
| `defaultCity` | Partially exists | Liberty-local default locality behavior exists but should become package-owned. |
| `boundaryRef` | Already exists | Liberty boundary artifact exists as a data concept; formal registry reference remains future implementation. |
| `packageRef` | Missing | Liberty package manifest/root has not been implemented as a formal county package. |
| `awarenessConfigRef` | Partially exists | Liberty awareness areas/copy exist in product behavior but not as a formal registry reference. |
| `storagePolicyRef` | Partially exists | County-scoped storage concepts exist, but a complete Liberty namespace and legacy compatibility policy remains planned. |
| `containmentPolicyRef` | Partially exists | County metadata and Liberty fallback concepts exist, but formal read/write containment validation is future work. |
| `rollbackPolicyRef` | Partially exists | V459/V460 define rollback architecture, but no registry-linked policy exists. |
| `validationEvidenceRef` | Partially exists | Audit/fixture evidence exists across planning artifacts; a formal evidence bundle is future work. |
| `activationApprovalRef` | Not applicable | Liberty is current supported behavior; this contract should not retroactively change runtime activation. Future registry activation records may document County #1 baseline. |
| `sourceStatus` | Partially exists | FRA/local source planning exists; DriveTexas remains paused. |
| `sourceContractRef` | Missing | Formal source contract bundle remains future work. |
| `transportationEligibility` | Future | Should remain non-activating. |
| `countySourceIdentifiers` | Future | Useful for later transportation governance. |
| `feedPauseStatus` | Future | Should explicitly preserve paused feeds before any transportation work. |
| `DriveTexasPaused` | Already exists | Protected boundary requires `true`. |
| `registryOwner` | Missing | Governance owner should be named before registry implementation. |
| `packageOwner` | Missing | Package owner should be named before formal package assembly. |
| `qaOwner` | Missing | QA owner should be named before formal validation. |
| `storageOwner` | Missing | Storage owner should be named in V462. |
| `sourceGovernanceOwner` | Missing | Needed before source contract validation. |
| `operationsOwner` | Missing | Needed before pilot/activation governance beyond County #1. |
| `productOwner` | Missing | Needed before user-facing county expansion. |
| `supportOwner` | Missing | Needed before any new public county activation. |
| `reviewCadence` | Missing | Needed before pilot readiness. |
| `lastReviewedAt` | Missing | Needed before pilot readiness. |
| `notesRef` | Optional | Planning documents serve as informal notes today. |
| `pauseReasonRef` | Not applicable | Liberty is not paused. |
| `retirementReasonRef` | Not applicable | Liberty is not retired. |

## 9. County #2 Registry Readiness

County #2 remains theoretical in V461. This section defines gates only; it does not add, select, evaluate, pilot, or activate a second county.

### Before being added as `planned`

A future County #2 must have:

1. Unique `countyId` that is not Liberty and is namespace-safe.
2. `displayName`, `stateCode`, and `stateName`.
3. `lifecycleState: planned`.
4. `visibility: hidden`.
5. `registryOwner`.
6. Protected-boundary confirmation, including no historical exposure and no DriveTexas/transportation activation.

### Before being `prepared`

A future County #2 must additionally have:

1. `packageRef` to a planned package manifest/root.
2. `boundaryRef`.
3. `awarenessConfigRef`.
4. `defaultCity`.
5. `packageOwner`.
6. `sourceStatus` that does not imply activation.
7. Internal-only visibility at most.

### Before being `validated`

A future County #2 must additionally have:

1. Boundary validation evidence.
2. Inside/outside fixtures.
3. Awareness-area validation.
4. Crossing and road-segment validation where applicable.
5. `storagePolicyRef` proving no Liberty namespace leakage.
6. `containmentPolicyRef` proving county-scoped reads/writes and no Liberty fallback reuse.
7. `validationEvidenceRef`.
8. `sourceContractRef` and source governance owner.
9. Protected-boundary validation.

### Before being `pilot_ready`

A future County #2 must additionally have:

1. `rollbackPolicyRef`.
2. Operations owner and product owner.
3. Review cadence and current review date.
4. Pilot allowlist/visibility policy.
5. Support and escalation readiness for pilot context.
6. Launch-blocker review with no unresolved launch blockers.

### Before being `activated`

A future County #2 must additionally have:

1. `activationApprovalRef`.
2. Support owner.
3. Public visibility approval.
4. Full read/write containment proof in production design.
5. Rollback/deactivation proof.
6. Source governance signoff.
7. Protected-boundary signoff.
8. Explicit confirmation that Liberty fallback remains Liberty-only and County #2 has no access to legacy/null Liberty behavior.

## 10. Registry Validation Audit Design

A future documentation-aligned audit helper may be shaped as:

```js
window.gridlyCountyRegistryValidationAudit?.()
```

V461 does not implement this helper. The future helper should be read-only, side-effect-free, safe to run in development or internal validation contexts, and explicit that passing the audit does not activate a county.

### Suggested output shape

```js
{
  ok: false,
  generatedAt: "ISO-8601 timestamp",
  registryVersion: "string or null",
  counties: [
    {
      countyId: "liberty-tx",
      lifecycleState: "activated",
      visibility: "public",
      status: "pass | warning | fail",
      errors: [
        {
          code: "missing_storage_policy",
          severity: "blocker",
          field: "storagePolicyRef",
          message: "Storage policy is required before validated."
        }
      ],
      evidence: {
        registryContractCompleteness: "pass | warning | fail",
        lifecycleValidity: "pass | warning | fail",
        visibilityValidity: "pass | warning | fail",
        packageReferences: "pass | warning | fail",
        validationEvidenceReferences: "pass | warning | fail",
        protectedBoundaries: "pass | warning | fail",
        libertyFallbackPreservation: "pass | warning | fail",
        county2ActivationSafety: "pass | warning | fail",
        driveTexasPausedStatus: "pass | warning | fail"
      }
    }
  ],
  summary: {
    warnings: 0,
    blockers: 0,
    launchBlockers: 0,
    protectedBoundaryBlockers: 0
  }
}
```

### Future audit checks

The helper should validate:

1. Registry contract completeness for each lifecycle state.
2. Lifecycle transition validity.
3. Visibility compatibility with lifecycle state.
4. Package reference presence and expected artifact categories.
5. Validation evidence reference presence and required evidence areas.
6. Protected boundaries: historical reads off, history UI off, historical API exposure off, consumer history dashboard off, DriveTexas paused.
7. Liberty fallback preservation: legacy/null fallback remains Liberty-only and is not generalized.
8. County #2 activation safety: no non-Liberty county can be public or pilot without package, containment, rollback, source governance, and approval evidence.
9. DriveTexas paused status: no county registry source field should imply DriveTexas activation.
10. Transportation-intelligence safety: source metadata can be inventoried without activating feeds or route intelligence.

## 11. Transportation Intelligence Compatibility

The registry should support future transportation intelligence by preserving governance hooks without activating any feed, inference, route intelligence, or DriveTexas behavior.

| Field or concept | Future purpose | V461 constraint |
| --- | --- | --- |
| `sourceStatus` | Summarizes source readiness and governance stage. | May indicate inventory or validation; must not imply live transportation activation. |
| `sourceContractRef` | Points to source authority, allowed uses, cadence, licensing, and owner. | Required before validated, but non-activating. |
| `transportationEligibility` | Future computed or reviewed readiness for transportation intelligence. | Future-only; should not be used for current runtime decisions. |
| `countySourceIdentifiers` | Stores source-specific county ids, district ids, corridor ids, or agency ids. | Future-only until source governance is approved. |
| `feedPauseStatus` | Records per-source pause status. | Must default to paused/not-active unless separately authorized. |
| `DriveTexasPaused` | Explicit guard for DriveTexas. | Must remain `true` under protected boundaries. |

Transportation compatibility should remain subordinate to the platform sequence: county context first, localized awareness second, transportation intelligence third. A county may be fully valid for awareness and still ineligible for transportation intelligence.

## 12. Recommended Milestone Sequence

Recommended sequence after V461:

1. **V462 Storage Namespace and Legacy Liberty Compatibility Plan**
   - Define county-scoped storage ownership, Liberty legacy/null compatibility, migration boundaries, and rollback expectations.
   - This should come first because storage namespace and fallback behavior are prerequisites for safe read/write containment.
2. **V463 Read/Write County Containment Validation Plan**
   - Define validation for county metadata writes, read filters, unsupported county quarantine, and no Liberty fallback leakage.
3. **V464 County Package Fixture Standard**
   - Standardize boundary, inside/outside, awareness, crossing, road segment, report, and route fixtures for Liberty and future counties.
4. **V466 Transportation Intelligence Data Governance Plan**
   - Define source contracts, feed pause policy, DriveTexas governance, source identifiers, and transportation eligibility without activation.
5. **V465 Regional Expansion Candidate Review**
   - Review regional candidates only after registry, storage, containment, fixture, and transportation governance standards exist. This remains a review milestone, not activation.

This sequence intentionally moves candidate review after the core safety contracts. County #2 should not be visibly evaluated before the registry, storage, containment, and fixture standards are defined.

## 13. Recommended Next Milestone

The recommended next milestone is **V462 Storage Namespace and Legacy Liberty Compatibility Plan**.

V462 should answer:

1. Which storage keys are global, Liberty-specific, county-scoped, legacy-only, or future migration candidates?
2. How should Liberty legacy/null records remain readable without becoming a generic fallback for future counties?
3. What namespace rules are required before County #2 can be represented safely?
4. What rollback rules protect existing Liberty users if county-scoped storage is later introduced?
5. What validation evidence should V463 use to prove read/write containment?

V462 should remain planning-only unless separately authorized. It should preserve all protected boundaries and should not activate County #2, DriveTexas, transportation intelligence, historical reads, historical UI, historical API exposure, or consumer history dashboards.
