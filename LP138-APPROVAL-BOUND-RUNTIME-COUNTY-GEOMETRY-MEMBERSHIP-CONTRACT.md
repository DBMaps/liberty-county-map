# LP138 — Approval-bound runtime county geometry membership contract

## Determination and scope

LP138 defines a versioned, machine-readable contract and fail-closed reference validator for future runtime county geometry membership. Authorization is an exact set of canonical county IDs paired with five-digit Texas FIPS—not a count, registry flag, geometry availability, certification, adjacency, readiness tier, or geographic inference.

This is an audit/design milestone only. Two contract roles prevent “no new approval” from being confused with “no existing membership.” The authoritative reconciliation baseline records all **28 counties already operational before LP138**, zero newly approved counties, and no new authority. The separate future-wave draft contains zero counties, is candidate-only, and grants no permission. Neither artifact retroactively grants or recertifies an LP132 approval. The certified runtime package, manifest, `GRIDLY_COUNTY_REGISTRY`, builder, browser/PWA/mobile delivery, geometry sources, LP132 status, and protected systems remain unchanged.

## Contract artifacts

| Artifact | Purpose |
| --- | --- |
| `evidence/lp138/county-geometry-membership-contract.schema.json` | Normative JSON Schema: versions, authority, time policy, approval, cohort, exact members, evidence, permissions, rollback and provenance |
| `evidence/lp138/county-geometry-membership-contract.baseline.json` | Authoritative 28-county `CURRENT_OPERATIONAL_BASELINE`; historical/current reconciliation only, with zero newly approved counties and every permission false |
| `evidence/lp138/county-geometry-membership-contract.draft.json` | Non-authorizing design instance; deliberately empty because LP132 grants no present activation approval |
| `tools/lp138/validate-county-geometry-membership.mjs` | Read-only reference semantics for identities, ordering, count, hashes, gates, permissions and set equality |
| `tests/lp138-approval-bound-county-geometry-membership.test.mjs` | Positive and adversarial contract tests; it does not invoke the production builder |

`generatedAtPolicy.mode` is `APPROVAL_RECORDED_UTC`: an authorized snapshot copies the approval record's RFC 3339 UTC time rather than using wall-clock build time. Revalidation does not rewrite it. Contract version changes only through a reviewed record; identical inputs serialize identically.

## Exact membership and provenance

Each member carries `countyId`, `fips`, `displayName`, identity evidence, activation evidence references, and exactly seven gate records. IDs and FIPS form one inseparable identity tuple. A future implementation must validate that tuple against a separately governed canonical Texas county identity authority; a familiar display name is not identity evidence. In the baseline, `approvedCounties` represents the preserved pre-LP138 runtime set for schema compatibility, while `existingBaselineCountyCount: 28` and `newlyApprovedCountyCount: 0` explicitly prevent that historical membership from being presented as a new approval.

Members are strictly sorted by ascending five-digit FIPS. There is no tie: FIPS is unique. Filesystem enumeration, locale collation, insertion order, and runtime environment are forbidden ordering inputs. `approvedCountyCount` is derived and must equal array length; it reports the set but never authorizes it.

`GRIDLY_CANONICAL_JSON_V1` recursively sorts object keys by Unicode code point, preserves array order, uses JSON scalar encoding, and emits no insignificant whitespace. `membershipSha256` is lowercase SHA-256 of those canonical `approvedCounties` bytes. Every geometry source and governing evidence artifact must also have an independently verified raw-byte SHA-256 in `sourceHashes` or `evidenceHashes`. This resolves LP137's line-ending qualification by requiring the approval record to identify the exact bytes; silent text normalization is prohibited.

Validation fails on a missing or extra county, duplicate ID or FIPS, unknown/malformed identity, ID/FIPS disagreement with the identity authority, incomplete evidence, count drift, nonascending order, or hash drift. Registry and proposed package identities are normalized only for comparison, then must be set-equal to the approved tuples. Package availability, certification and registry presence supply no approval.

## Approval lifecycle

The only forward sequence is:

```text
DRAFT → EVIDENCE_COMPLETE → APPROVED_FOR_PACKAGE_GENERATION
      → APPROVED_FOR_DEPLOYMENT → APPROVED_FOR_RUNTIME_ACTIVATION
```

Any non-revoked state may transition to `REVOKED`; `REVOKED` is terminal. Corrections, expiration, changed evidence, changed membership, changed source bytes, or rollback require a new version beginning at `DRAFT`. Skips and backward transitions fail closed. State is evidence of a decision boundary, not inheritance of later permission.

The approval record must name its record ID, accountable authority, immutable reference, effective time and expiry. `EVIDENCE_COMPLETE` means reviewable only. Each later state requires a distinct governed transition record. An expired or absent record behaves as unauthorized.

## Independent permissions

| Permission | Meaning | Minimum independent authority |
| --- | --- | --- |
| `prepareGeometry` | Permit non-runtime candidate geometry preparation | Named preparation record; no package implication |
| `generateRuntimePackage` | Permit generation for exactly the approved set | Exact `APPROVED_FOR_PACKAGE_GENERATION` transition |
| `deploy` | Permit release of named package bytes | Exact `APPROVED_FOR_DEPLOYMENT` transition/change record |
| `activateRuntime` | Permit runtime behavior for named package/counties | Exact `APPROVED_FOR_RUNTIME_ACTIVATION`, unexpired Gate 7 authority |
| `storageUpload` | Permit any Storage upload or mutation | Separately named Storage change authority; never implied by another permission |

Every permission has its own Boolean and authority reference. A validator must never derive one from another. Package generation does not permit deployment, activation, Storage changes, or registry promotion. Deployment does not permit activation. Both committed contracts set every permission—including Storage upload—to false. The reference validator deliberately requires the approval state matching any enabled downstream permission; a future signed record may preserve prior decisions as history, but may not use them to silently enable another Boolean.

## LP132 gate reconciliation

Each county records Gates 1–7 in order with `PASS`, `BLOCKED`, or `NOT_EVALUATED`, evidence reference and hash, evaluation time, and reviewer. LP138 maps them without weakening them:

1. package integrity; 2. certification complete; 3. community readiness; 4. destination readiness; 5. crossing readiness; 6. runtime validation; 7. production approval.

Evidence completion may describe blocked/unevaluated gates, but a county enters a package-generation approved set only under the separately recorded governing decision. Runtime activation additionally requires every gate for every member to be `PASS`. `BLOCKED`, `NOT_EVALUATED`, missing, out-of-order, stale, expired, mismatched-hash, or mismatched-county evidence fails closed. A later gate cannot cure or bypass an earlier non-pass.

## Future integration contract

```text
Statewide County Geometry
        ↓
LP132 Gate Evidence
        ↓
Approval-Bound Membership Contract
        ↓
Exact Registry Membership Validation
        ↓
Runtime Geometry Builder
        ↓
Runtime Geometry Package + Manifest
        ↓
Deployment Approval
        ↓
Runtime Activation Approval
```

In a separately authorized implementation milestone, the builder must receive an immutable contract explicitly (never discover “latest”), verify schema/signature or governed hash, evidence freshness, identity authority, permissions and provenance, then compare the exact contract set against `GRIDLY_COUNTY_REGISTRY`. Only after equality may it select statewide/county boundary inputs. The emitted package and manifest must repeat contract ID/version/hash, membership hash, ordered identity tuples, source hashes, generation authorization and output hashes. Verification must compare the proposed package set again; count is only a derived invariant.

Deployment tooling must validate the separately named deployment permission and exact package hash. Runtime promotion must validate the separately named activation permission, Gate 1–7 PASS, effective/expiry window and deployed hash. No component may promote the registry automatically from a contract.

## Rollback and revocation

Before deployment or activation, `rollback` must name owner, immutable plan, prior approved contract/package target, trigger references and rehearsal evidence. Revocation blocks new generation/deployment/activation immediately; execution follows the governed rollback plan and produces a new evidence record. It does not delete evidence or silently mutate this snapshot. A rollback target is independently hash-verified and still requires the authority appropriate to the action.

## LP138 result and non-authorization

LP138 replaces the *design concept* of fixed cardinality authorization with exact-set authority; it does not edit the current production builder's `EXPECTED_COUNT = 28`. The baseline contract records the exact current registry/package identity set in ascending FIPS order and the validator tests equality directly against both committed sources. The future draft remains an empty template, not the operational baseline. Current 28-county membership and all LP137/LP137.1/LP137.2A locks remain intact.

No county was prepared, added, removed, activated, deployed, promoted, rebuilt or regenerated. No runtime behavior, registry, Storage, Supabase, Edge Function, protected system, statewide geometry, county boundary, runtime package or runtime manifest was modified. LP132 governance is unchanged, LP136 remains `CONDITIONALLY_READY`, and every baseline and draft permission is false.
