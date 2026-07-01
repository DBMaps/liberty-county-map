# GRIDLY Audit and Test Cleanup Assessment V575A

## 1. Executive Summary

This assessment is documentation-only. It reviews Gridly's audit documents, runtime audit helpers, one-off diagnostic scripts, and currently visible automated test files before further Montgomery implementation work.

The repository has three different audit/test layers:

1. **Authoritative protection tests** in `tests/history-capture/` that actively validate passive historical capture boundaries, history-aware adapter output, schema exposure, rollback, monitoring, and writer behavior.
2. **Operational audit scripts** in `scripts/` and `scripts/history-capture/` that are useful, but not registered in `package.json` as canonical commands.
3. **Milestone audit documents** spread across the repository root, `docs/`, and `docs/audits/`; many are historical evidence or implementation handoff records rather than living audit gates.

Recommended direction: keep the authoritative tests and the newest safety-critical audit scripts, document/register the still-useful scripts, and defer any file retirement until after a manifest-based cleanup pass confirms no protected-system regressions.

No protected system should be modified by this cleanup. The cleanup should begin with documentation and command registration only, then progress to duplicate document archiving, and only later remove or retire superseded files after all protected checks pass.

## 2. Current Audit/Test Problem

### Problem statement

Gridly's audit estate has grown through milestone-driven development. Each milestone produced documents, helper exposure audits, runtime scripts, and sometimes tests. This created useful evidence, but now makes it difficult to know which artifacts are active gates versus historical records.

### Current symptoms

- **Audit documents are scattered** across root, `docs/`, and `docs/audits/`.
- **Milestone-specific audit helpers overlap** with newer tests and scripts.
- **Some helpers are browser/manual-only** and not represented as repeatable CLI checks.
- **`package.json` currently has no scripts section**, so authoritative checks are not discoverable through npm commands.
- **Route Watch geometry has several sequential scripts** from prototype, validation, fixture expansion, runtime audit, and road-name regression phases; these likely need consolidation before further implementation work.
- **Historical capture tests are active and boundary-focused**, but several are audit-style tests rather than unit tests; they should stay until a formal test taxonomy exists.

### Cleanup principle

Do not delete protected-system evidence or safety checks during the first cleanup stage. First create a manifest that marks each artifact as active, historical, duplicate, legacy, or candidate for retirement.

## 3. Authoritative Audit Set

The following artifacts should be treated as authoritative until a registered test/audit manifest replaces them.

### Automated tests: keep

| Artifact | Classification | Why it remains authoritative |
| --- | --- | --- |
| `tests/history-capture/historyCaptureFlags.test.js` | Keep | Validates default-disabled/passive behavior for historical capture flags. |
| `tests/history-capture/historyCaptureEnvelope.test.js` | Keep | Validates Phase 1A envelope constraints and event typing. |
| `tests/history-capture/historyCaptureIdempotency.test.js` | Keep | Protects duplicate write/idempotency behavior. |
| `tests/history-capture/historyCaptureWriter.test.js` | Keep | Validates writer disabled state, schema-qualified writes, diagnostics, and Supabase isolation behavior. |
| `tests/history-capture/historyCaptureMonitoring.test.js` | Keep | Validates monitoring artifacts and runtime observability for passive capture. |
| `tests/history-capture/historyCapturePhase1A.test.js` | Keep | Validates Phase 1A sidecar audit shape and hook inventory. |
| `tests/history-capture/historyCaptureRollback.test.js` | Keep | Validates rollback isolation and ensures public/protected systems are not targeted. |
| `tests/history-capture/historyCaptureSchemaExposure.test.js` | Keep | Validates Supabase schema exposure, grants, RLS, and no read/update/delete policy leakage. |
| `tests/history-capture/historyCaptureCanaryControlsStatic.test.js` | Keep | Validates canary/static control boundaries. |
| `tests/history-capture/historyAwarenessAdapterRuntimeValidation.test.js` | Keep | Validates adapter runtime behavior before any UI-facing historical context is allowed. |
| `tests/history-capture/historyVisibleAwarenessOutputAudit.test.js` | Keep | Protects Awareness Brief output language, placement, raw-history suppression, and no historical reads. |
| `tests/history-capture/historyCommunityPulseAudit.test.js` | Keep | Protects Community Pulse output language and secondary-only placement. |
| `tests/history-capture/historyAlertContextAudit.test.js` | Keep | Protects alert-context historical language boundaries. |
| `tests/history-capture/historyAwarenessLanguageV454.test.js` | Keep | Protects consumer-safe language rules for historical awareness. |

### CLI audit scripts: keep but register/document

| Artifact | Classification | Recommended status |
| --- | --- | --- |
| `scripts/audit-marker-png-dimensions.mjs` | Keep but register/document | A small deterministic asset check; should become a documented asset audit command. |
| `scripts/v311-road-name-regression-audit.mjs` | Keep but register/document | Useful Liberty road-name regression guard; should be documented as Liberty-boundary/road-data protection. |
| `scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs` | Keep but register/document | Safety-relevant Route Watch runtime shadow audit. Keep until replaced by a consolidated Route Watch audit runner. |
| `scripts/v294-route-watch-geometry-shadow-scoring-fixtures.mjs` | Keep but register/document | Fixture-based geometry scoring harness; keep as the deterministic Route Watch geometry fixture gate. |
| `scripts/v295-route-watch-geometry-fixture-expansion.mjs` | Duplicate | Alias to V294. Keep temporarily only if milestone command compatibility is needed. |
| `scripts/history-capture/v430-historical-intelligence-audit.mjs` | Keep but register/document | Historical-intelligence audit evidence; should be tied to history-capture protected boundary checks. |
| `scripts/history-capture/v431-historical-intelligence-runtime-validation.mjs` | Keep but register/document | Runtime validation companion to V430; should be registered or merged with V430/V432. |
| `scripts/history-capture/v432-historical-awareness-integration-audit.mjs` | Keep but register/document | Awareness integration audit; overlaps with newer tests but still useful as an integration audit. |
| `scripts/active-hazard-inventory.mjs` | Unknown / needs review | Live Supabase inventory helper; useful operationally but touches active hazard data paths and should be documented as manual-only and read-only before use. |

### Runtime/browser audit helpers: keep with explicit safety label

| Artifact | Classification | Recommended status |
| --- | --- | --- |
| `js/gridlyRouteWatchGeometryRuntimeShadowAudit.js` | Keep but register/document | Runtime Route Watch audit helper. It is safety-disabled/fast-return oriented and should remain protected until Route Watch audit consolidation is complete. |
| Browser globals exposed by history awareness adapter audits | Keep | Covered by history awareness tests and should not be removed until tests are refactored to direct module exports. |

## 4. Duplicate / Legacy Audit Candidates

### Duplicate or superseded Route Watch geometry artifacts

| Artifact | Classification | Rationale |
| --- | --- | --- |
| `scripts/v291-route-watch-geometry-prototype.mjs` | Legacy | Early prototype using TxDOT geometry retention; superseded by V292 validation, V294/V295 fixture harness, and V296 runtime shadow audit. |
| `scripts/v292-route-watch-geometry-validation.mjs` | Legacy / candidate for consolidation | Useful historical threshold evidence, but likely superseded by fixture-driven V294 and runtime V296. Keep until the consolidated Route Watch audit manifest names replacement coverage. |
| `scripts/v295-route-watch-geometry-fixture-expansion.mjs` | Duplicate | The file is an alias for V294. Retire after command compatibility is no longer needed. |
| `GRIDLY_V307_ACTIVE_ROUTE_CONTEXT_GEOMETRY_RELEVANCE_SHADOW_SCORING.md` | Legacy documentation | Milestone evidence for active route scoring; should be linked from a Route Watch archive rather than used as a current gate. |
| `GRIDLY_V308_2_FORCE_SHADOW_AUDIT_FAST_RETURN.md` | Keep as safety history | Documents emergency fast-return behavior; do not delete until V296/V308 runtime audit behavior is fully represented in registered tests. |
| `docs/GRIDLY_V296_ROUTE_WATCH_GEOMETRY_RUNTIME_SHADOW_AUDIT.md` | Keep but register/document | Current Route Watch runtime audit documentation; should become part of a Route Watch audit index. |
| `docs/GRIDLY_V297_DESTINATION_ROUTE_VS_ROUTE_WATCH_GEOMETRY_OBSERVATION_AUDIT.md` | Legacy / needs review | Likely observational evidence superseded by V296/V307/V308 artifacts. |
| `docs/GRIDLY_V298_ROUTE_WATCH_FUNCTIONAL_READINESS_AUDIT.md` | Keep but register/document | High-level functional readiness audit; keep until Route Watch manifest identifies exact replacement. |

### Duplicate or superseded historical capture artifacts

| Artifact family | Classification | Rationale |
| --- | --- | --- |
| V363-V386 historical projection/schema/capture planning docs | Legacy / historical record | These describe design and readiness before Phase 1A implementation. Archive after extracting still-active constraints into a manifest. |
| V398-V406 Phase 1A readiness/activation docs | Legacy / needs review | Many are pre-implementation readiness gates now represented by tests. Keep until mapped to specific test coverage. |
| V411-V424 storage/wiring/schema exposure docs | Keep as safety history | Schema exposure, rollback, and storage authorization remain sensitive; retain until migration tests and Supabase manifest citations are formalized. |
| V429-V454 historical intelligence/language docs | Keep but consolidate | The language-safety and adapter-output docs overlap with tests; consolidate into one historical-awareness safety index before retiring duplicates. |
| `GRIDLY-HISTORICAL-LANGUAGE-AUDIT-PROTOTYPE-V447.md`, `GRIDLY-HISTORICAL-TRANSLATION-SAFETY-AUDIT-V449.md`, `GRIDLY-HISTORICAL-LANGUAGE-EXECUTION-AUTHORIZATION-REVIEW-V453.md` | Duplicate / legacy candidates | Overlapping language-safety milestones. Keep one current language safety reference and archive the rest after test mapping. |

### Older audit-helper exposure documents

| Artifact family | Classification | Rationale |
| --- | --- | --- |
| `docs/audits/GRIDLY_V141_5C_ROUTE_AUDIT_HELPER_EXPOSURE.md`, `GRIDLY_V143_0B_ROUTE_RELEVANCE_HELPER_EXPOSURE.md`, `GRIDLY_V143_5B_COMMUTE_AUDIT_HELPER_EXPOSURE.md`, `GRIDLY_V143_7B_COMMUTE_HELPER_EXPOSURE_FIX.md`, `GRIDLY_V143_8B_AUDIT_HELPER_EXPOSURE_REGISTRY.md`, `GRIDLY_V143_9C_AUDIT_REGISTRY_ENFORCEMENT.md` | Legacy / candidate for consolidation | These appear to document iterative audit-helper exposure and registry hardening. Preserve as historical evidence, but replace active use with one audit-helper registry document. |
| `docs/audits/GRIDLY_V144_0_STRICT_AUDIT_CYCLE_ISOLATION.md` and V144 commute/crossing audit docs | Legacy / needs review | Likely useful evidence for commute/crossing isolation; should be reviewed before archive because commute and crossing behavior may affect protected awareness and alert paths. |

### Other audit documents

| Artifact family | Classification | Rationale |
| --- | --- | --- |
| App store, Capacitor, PWA, branding, icon, and mobile shell audits | Candidate for retirement / archive | Keep only if still part of release readiness. Otherwise move to historical release evidence. |
| County activation/readiness framework docs | Keep but consolidate | These are relevant to Montgomery work and future county rollout; consolidate rather than retire. |
| Montgomery boundary/source/readiness docs V502-V575 | Keep | Directly relevant to Montgomery implementation and protected source/boundary data. Do not archive yet. |
| San Jacinto, Jefferson, Chambers fast-track docs | Legacy / future reference | Not current Montgomery work; archive under county-expansion evidence when manifest exists. |

## 5. Test Suite Review

### Still authoritative tests

The entire `tests/history-capture/` directory should remain authoritative for now. These tests protect the following areas:

- Historical capture default-off and write gating.
- Phase 1A envelope shape, allowed events, and hook inventory.
- Idempotency and writer diagnostics.
- Monitoring/canary behavior.
- Supabase schema exposure and rollback isolation.
- Historical awareness language safety.
- Awareness Brief, Community Pulse, and alert context placement rules.
- No raw history exposure, no predictive language, no consumer-facing history dashboard, and no historical reads.

### Tests that are obsolete, redundant, or superseded

No automated test file should be removed in the first cleanup stage. However, the following redundancy should be reviewed later:

| Test area | Status | Later action |
| --- | --- | --- |
| Awareness language tests vs visible/community/alert audits | Redundant by theme, not by exact assertion | Keep until a shared fixture-driven language-policy test can cover all surfaces. |
| Phase 1A audit-shape assertions vs historical capture monitoring/writer tests | Partially overlapping | Keep until sidecar audit contract is separated from implementation behavior tests. |
| Schema exposure vs rollback tests | Complementary | Keep both; they protect different migration directions. |
| History runtime validation scripts vs history awareness tests | Overlapping | Prefer tests as CI gates; keep scripts as manual integration audits until registered. |

### Missing test registration problem

Because `package.json` has no `scripts` section, maintainers cannot discover or run a canonical audit/test suite from npm. Before retiring files, add documentation or package scripts that define:

- `test:history-capture`
- `audit:route-watch-geometry`
- `audit:markers`
- `audit:road-names`
- `audit:historical-awareness`

Do not add those scripts in this V575A documentation-only assessment; this is a later cleanup stage.

## 6. Cleanup Risk Assessment

### High-risk cleanup areas

| Area | Risk | Reason |
| --- | --- | --- |
| Shared Reports | High | Tests and helper scripts may indirectly guard report creation/clearing, alert context, and active hazard behavior. |
| Route Watch | High | Multiple runtime and fixture audit scripts are overlapping but safety-relevant. Removing one early could hide regressions. |
| Awareness Filtering | High | Historical awareness tests protect consumer language and visibility boundaries. |
| Hazard Lifecycle | High | Historical capture hooks and active hazard inventory touch lifecycle-adjacent behavior. |
| Alert Generation | High | Alert context audit protects wording and historical context boundaries. |
| Supabase Sync | High | Schema exposure, writer, rollback, and inventory scripts touch Supabase concepts. |
| Liberty boundary data | High | Road-name and Route Watch scripts depend on Liberty data; do not mutate or retire validations prematurely. |
| Montgomery source data | High | Current implementation depends on Montgomery acceptance/source docs; do not archive until Montgomery implementation stabilizes. |
| DriveTexas | Medium/high | Historical awareness boundaries explicitly preserve DriveTexas paused state. |
| Transportation Intelligence | Medium/high | Route Watch and TxDOT geometry audits overlap with transportation intelligence behavior. |
| Historical systems | High | The current tests are mostly historical-system safeguards. |

### Low-risk candidates after manifesting

- Pure milestone aliases such as `scripts/v295-route-watch-geometry-fixture-expansion.mjs`, once callers are confirmed.
- Historical release-readiness audits unrelated to current runtime behavior, once indexed.
- Older audit-helper exposure documents after a single current registry document replaces them.
- Superseded planning documents after active constraints are copied into a current architecture or audit manifest.

## 7. Staged Cleanup Plan

### Stage 0 — Freeze and inventory

- Do not modify protected systems.
- Create an audit/test manifest that lists every audit document, helper, script, and test.
- Add classification fields: keep, keep/register, duplicate, legacy, candidate retirement, unknown.
- Record the authoritative command or replacement artifact for each item.

### Stage 1 — Register without deleting

- Add documented commands for current tests and audits.
- Keep all existing files.
- Make history-capture tests easy to run as a suite.
- Add manual-only labels for scripts that require live Supabase or browser state.

### Stage 2 — Consolidate Route Watch audits

- Create one Route Watch geometry audit index covering V291, V292, V294, V295, V296, V307, and V308 safety behavior.
- Keep V294 fixture harness and V296 runtime fast-return audit as active gates.
- Mark V291/V292 as historical and V295 as alias/duplicate.
- Do not remove runtime helper code until equivalent registered tests exist.

### Stage 3 — Consolidate historical awareness and language safety

- Build a single historical-awareness language safety matrix covering Awareness Brief, Community Pulse, and alert context.
- Map V447/V449/V453/V454 docs and tests to the matrix.
- Retire only documents that are fully superseded by the matrix and active tests.

### Stage 4 — Archive milestone docs

- Move or index legacy docs as historical evidence rather than deleting them immediately.
- Preserve Montgomery source/boundary docs in place until Montgomery implementation is complete.
- Preserve Liberty boundary and road-data evidence until new county-agnostic data validation exists.

### Stage 5 — Remove duplicates only after verification

- Remove only files with all of the following:
  - manifest classification is duplicate or retired;
  - replacement artifact is named;
  - no protected-system owner objection;
  - full protected-system verification passes;
  - Git history contains this V575A cleanup assessment and the manifest.

## 8. Protected Systems Verification

This assessment did not modify the following protected systems:

- Shared Reports
- Route Watch
- Awareness Filtering
- Hazard Lifecycle
- Alert Generation
- Supabase Sync
- Liberty boundary data
- Montgomery source data
- DriveTexas
- Transportation Intelligence
- Historical systems

Before any future cleanup PR that removes or moves files, run and record at minimum:

```bash
git diff --check
git status --short
node tests/history-capture/historyCaptureFlags.test.js
node tests/history-capture/historyCaptureEnvelope.test.js
node tests/history-capture/historyCaptureIdempotency.test.js
node tests/history-capture/historyCaptureWriter.test.js
node tests/history-capture/historyCaptureMonitoring.test.js
node tests/history-capture/historyCapturePhase1A.test.js
node tests/history-capture/historyCaptureRollback.test.js
node tests/history-capture/historyCaptureSchemaExposure.test.js
node tests/history-capture/historyCaptureCanaryControlsStatic.test.js
node tests/history-capture/historyAwarenessAdapterRuntimeValidation.test.js
node tests/history-capture/historyVisibleAwarenessOutputAudit.test.js
node tests/history-capture/historyCommunityPulseAudit.test.js
node tests/history-capture/historyAlertContextAudit.test.js
node tests/history-capture/historyAwarenessLanguageV454.test.js
node scripts/audit-marker-png-dimensions.mjs
node scripts/v311-road-name-regression-audit.mjs
node scripts/v294-route-watch-geometry-shadow-scoring-fixtures.mjs
node scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs
```

Live or manual-only checks should be separately labeled and should not run automatically unless credentials and blast-radius controls are explicit.

## 9. Final Recommendation

Proceed with cleanup, but only in a staged and manifest-driven way.

Immediate recommendation:

1. Keep all `tests/history-capture/` tests as authoritative.
2. Keep and register/document V294, V296, V311, marker dimensions, V430, V431, and V432 audit scripts.
3. Treat V295 as a duplicate alias, but do not remove it until command compatibility is confirmed.
4. Treat V291/V292 and older helper exposure audits as legacy, not deletion-ready.
5. Consolidate historical language/audit docs into one current safety matrix before retiring duplicates.
6. Do not archive or remove Montgomery, Liberty boundary, Supabase, Route Watch, or historical-system artifacts until the replacement coverage is explicit and tested.

The safest next step is to create a repository-level audit/test manifest and command registry, not to delete files.
