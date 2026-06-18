# Gridly Audit/Test Cleanup Plan — V575E

## 1. Executive Summary

V575E is a planning-only cleanup sequence for Gridly's audit/test manifest after V575D expanded `docs/audit-test-manifest.json` into an item-level baseline and marked it **READY FOR CLEANUP PLANNING**.

This plan identifies the first safe cleanup order but does **not** authorize deletion, archival, helper retirement, helper consolidation, runtime edits, test logic edits, Supabase edits, Liberty data edits, Montgomery data edits, historical-system edits, DriveTexas resumption, or Transportation Intelligence activation.

**Final Determination:** **CLEANUP PLAN COMPLETE WITH OBSERVATIONS**

**Cleanup Readiness:** **FURTHER REVIEW REQUIRED**

Observation: item-level inventory is sufficient to plan batches, but Phase 1 should not execute until each target has explicit replacement coverage, caller/reference checks, and manifest-update instructions in the cleanup milestone.

## 2. Cleanup Planning Scope

### In scope

- Review the V575D-expanded 211-entry item-level manifest.
- Identify low-risk Phase 1 cleanup candidates.
- Define protected keep items that must not be removed in Phase 1.
- Stage cleanup into batches with risk, validation, rollback, and approval status.
- Define validation requirements for any future cleanup milestone.
- Define cleanup risk controls and owner-review gates.

### Out of scope / prohibited by this plan

This plan does not authorize any future agent or maintainer to:

- Delete audits or tests.
- Retire or consolidate helpers.
- Modify runtime behavior or application code.
- Modify test logic.
- Modify Supabase configuration, migrations, sync behavior, or data access.
- Modify Liberty boundary data, road data, fixtures, crossings, or overrides.
- Modify Montgomery source data, boundary data, readiness data, or implementation evidence.
- Modify historical capture, historical awareness, historical intelligence, writer, monitoring, canary, rollback, or schema systems.
- Resume DriveTexas.
- Enable Transportation Intelligence.

Any actual cleanup requires a separate cleanup milestone with explicit file targets, manifest updates, validation output, and protected-system verification.

## 3. Manifest Baseline

The V575E planning baseline is the V575D item-level manifest at `docs/audit-test-manifest.json`.

| Baseline metric | Value |
| --- | ---: |
| Total manifest entries | 211 |
| Grouped entries remaining | 0 |
| Unknown entries remaining | 69 |
| V575D readiness | READY FOR CLEANUP PLANNING |

### Baseline counts by category

| Category | Count |
| --- | ---: |
| Runtime Audit Helpers | 11 |
| Browser Console Debug Helpers | 2 |
| Unit Tests | 8 |
| Integration Tests | 6 |
| Documentation-Only Validation Checks | 48 |
| Legacy / Candidate Retirement Items | 74 |
| Unknown / Needs Review | 62 |

### Baseline counts by status

| Status | Count |
| --- | ---: |
| authoritative | 23 |
| keep | 3 |
| keep-register | 8 |
| duplicate | 1 |
| legacy | 36 |
| candidate-retirement | 71 |
| unknown | 69 |

## 4. Phase 1 Cleanup Candidates

Phase 1 candidates are planning candidates only. They are low-risk because they are documentation-only, alias-like, or already marked duplicate/candidate-retirement. They still require a future cleanup milestone before action.

### Candidate group A — documentation-only release-readiness duplicates

These items are candidate-retirement entries in the manifest but still require release-owner review before cleanup because they may retain store, PWA, Capacitor, or mobile shell evidence:

- `docs/BRANDING/GRIDLY-APP-ICON-STRATEGY.md`
- `docs/BRANDING/GRIDLY-ASSET-FOLDER-STRUCTURE.md`
- `docs/BRANDING/GRIDLY-SPLASH-SCREEN-STRATEGY.md`
- `docs/GRIDLY_V275_2_PWA_INSTALL_UX.md`
- `docs/GRIDLY_V275_PWA_FOUNDATION_IMPLEMENTATION.md`
- `docs/GRIDLY_V276_CAPACITOR_READINESS_AUDIT.md`
- `docs/GRIDLY_V276_1_CAPACITOR_FOUNDATION.md`
- `docs/GRIDLY_V276_2_NATIVE_BUILD_VALIDATION.md`
- `docs/GRIDLY_V276_3_EXTERNAL_NATIVE_BUILD_VALIDATION.md`
- `docs/GRIDLY_V276_4_GITHUB_ACTIONS_CAPACITOR_VALIDATION.md`
- `docs/GRIDLY_V276_4B_ANDROID_CAPACITOR_SHELL_COMPLETENESS.md`
- `docs/GRIDLY_V276_4D_ANDROID_PUBLIC_ASSETS_PLACEHOLDER.md`
- `docs/GRIDLY_V276_4E_COPY_WEB_ASSETS_BEFORE_CAPACITOR_DOCTOR.md`
- `docs/GRIDLY_V276_4F_CAPACITOR_WEBDIR_FIX.md`
- `docs/GRIDLY_V276_4G_RECREATED_CAPACITOR_VALIDATION_FIXES.md`
- Store checklist/caption/metadata files under `docs/STORE/`
- Mobile shell audit docs under `docs/audits/` such as `DESKTOP_MOBILE_COUPLING_AUDIT_V63.md`, `MOBILE_ALERTS_CENTER_AUDIT_V67.md`, and `V74_MOBILE_SHELL_DEVICE_CONSISTENCY_AUDIT.md`

### Candidate group B — obsolete helper exposure/global-check docs

These are candidate-retirement documentation records around iterative helper exposure and audit registry hardening. They are cleanup candidates only after the audit registry is named as the current source of truth and no runtime/test references depend on the older docs:

- `docs/audits/GRIDLY_V141_5C_ROUTE_AUDIT_HELPER_EXPOSURE.md`
- `docs/audits/GRIDLY_V143_0B_ROUTE_RELEVANCE_HELPER_EXPOSURE.md`
- `docs/audits/GRIDLY_V143_5B_COMMUTE_AUDIT_HELPER_EXPOSURE.md`
- `docs/audits/GRIDLY_V143_7B_COMMUTE_HELPER_EXPOSURE_FIX.md`
- `docs/audits/GRIDLY_V143_8B_AUDIT_HELPER_EXPOSURE_REGISTRY.md`
- `docs/audits/GRIDLY_V143_9C_AUDIT_REGISTRY_ENFORCEMENT.md`
- `docs/audits/GRIDLY_V144_0_STRICT_AUDIT_CYCLE_ISOLATION.md`

### Candidate group C — legacy audit aliases with newer authoritative replacements

- `scripts/v295-route-watch-geometry-fixture-expansion.mjs` is the only manifest entry marked `duplicate`. It appears to be an alias/duplicate candidate for the Route Watch geometry fixture sequence, but because it is a script touching Route Watch/Liberty geometry fixtures, it is not approved for immediate deletion in this plan.
- `scripts/v291-route-watch-geometry-prototype.mjs` and `scripts/v292-route-watch-geometry-validation.mjs` are legacy Route Watch geometry scripts. They should remain protected until the V294/V296 audit path and any package/CI/manual references are documented.

### Candidate group D — stale release-readiness files superseded by newer release notes

The app store, PWA, Capacitor, branding, and store docs are possible stale release-readiness artifacts. Cleanup requires confirmation that newer release notes, current store metadata, or an active release checklist fully supersede each item.

### Explicitly excluded from Phase 1 candidates

- All authoritative tests and integration tests.
- All history-capture runtime helpers.
- All awareness, alert, Supabase, writer, rollback, schema exposure, monitoring, canary, and Phase 1A test/helper artifacts.
- County readiness and future-county governance docs.
- Montgomery implementation/source/boundary/readiness docs.
- Liberty runtime data or Liberty road/fixture evidence.
- Any DriveTexas or Transportation Intelligence pause-state evidence.

## 5. Protected Keep List

The following items must not be removed in Phase 1.

### Authoritative tests and historical-system gates

- `tests/history-capture/historyCaptureFlags.test.js`
- `tests/history-capture/historyCaptureEnvelope.test.js`
- `tests/history-capture/historyCaptureIdempotency.test.js`
- `tests/history-capture/historyCaptureWriter.test.js`
- `tests/history-capture/historyCaptureMonitoring.test.js`
- `tests/history-capture/historyCaptureRollback.test.js`
- `tests/history-capture/historyCaptureCanaryControlsStatic.test.js`
- `tests/history-capture/historyAwarenessLanguageV454.test.js`
- `tests/history-capture/historyCapturePhase1A.test.js`
- `tests/history-capture/historyCaptureSchemaExposure.test.js`
- `tests/history-capture/historyAwarenessAdapterRuntimeValidation.test.js`
- `tests/history-capture/historyVisibleAwarenessOutputAudit.test.js`
- `tests/history-capture/historyCommunityPulseAudit.test.js`
- `tests/history-capture/historyAlertContextAudit.test.js`

### Runtime helpers and browser-exposed debug helpers

- `js/gridlyRouteWatchGeometryRuntimeShadowAudit.js`
- `js/gridlyRouteWatchGeometryShadowScoring.js`
- `js/history-capture/historyCaptureFlags.js`
- `js/history-capture/historyCaptureEnvelope.js`
- `js/history-capture/historyCaptureIdempotency.js`
- `js/history-capture/historyCaptureWriter.js`
- `js/history-capture/historyCaptureMonitoring.js`
- `js/history-capture/historyCapturePhase1A.js`
- `js/history-capture/historyIntelligenceEngine.js`
- `js/history-capture/historyAwarenessAdapter.js`

### Keep-register audit commands and manual checks

- `scripts/audit-marker-png-dimensions.mjs`
- `scripts/v311-road-name-regression-audit.mjs`
- `scripts/v294-route-watch-geometry-shadow-scoring-fixtures.mjs`
- `scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs`
- `scripts/history-capture/v430-historical-intelligence-audit.mjs`
- `scripts/history-capture/v431-historical-intelligence-runtime-validation.mjs`
- `scripts/history-capture/v432-historical-awareness-integration-audit.mjs`

### Protected domain families

- Shared Reports documentation, reporting audits, and any report creation/clearing evidence.
- Route Watch runtime, geometry scoring, activation, readiness, and fixture evidence.
- Awareness Filtering and historical awareness language/placement tests.
- Hazard Lifecycle inventory and active hazard evidence.
- Alert Generation and alert-context audits.
- Supabase Sync boundaries including schema exposure, writer, rollback, and read-only inventory.
- Historical capture, passive history, live history, historical intelligence, and historical language systems.
- County readiness, county activation, county registry, county package, and fast-track frameworks.
- Montgomery source, boundary, registry, rollback, activation, implementation, and artifact evidence.
- Liberty runtime data, boundary data, road names, crossings, fixtures, markers, and overrides.
- DriveTexas paused-state evidence.
- Transportation Intelligence paused-state evidence.

## 6. Cleanup Batch Plan

| Batch | Target items | Risk level | Required validation | Rollback expectation | Approval status |
| --- | --- | --- | --- | --- | --- |
| Batch 1: documentation-only duplicates | Release-readiness, app store, PWA, Capacitor, branding, store, and mobile shell documentation where a current source of truth is identified. | Low to medium | Manifest update; reference search for each file; owner confirmation of replacement doc; `git diff --check`; `git status --short`. | Restore removed docs from git and revert manifest status changes. | Requires further review. |
| Batch 2: obsolete helper exposure/global-check docs | Helper exposure and audit registry hardening docs from V141.5C, V143.0B, V143.5B, V143.7B, V143.8B, V143.9C, and V144.0. | Low to medium | Manifest update; reference search; audit registry replacement mapping; relevant helper exposure checks; `git diff --check`; `git status --short`. | Restore docs and registry mappings from git. | Requires further review. |
| Batch 3: legacy audit aliases | `scripts/v295-route-watch-geometry-fixture-expansion.mjs`, with possible later review of `scripts/v291-route-watch-geometry-prototype.mjs` and `scripts/v292-route-watch-geometry-validation.mjs`. | Medium | Manifest update; caller/reference search; prove V294/V296 coverage; run Route Watch geometry fixture/runtime audit commands; smoke test if any runtime file is touched. | Restore scripts and manifest entries from git; rerun geometry audits. | Requires further review; not approved for immediate cleanup. |
| Batch 4: candidate-retirement helpers requiring code review | Any runtime helper or script marked legacy/candidate-retirement, including `js/gridlyTxdotGeometryRetentionPrototype.js`, only after code review proves no active runtime or debug dependency. | Medium to high | Code ownership review; manifest update; reference search; relevant unit/integration tests; helper exposure checks; browser/global checks if applicable; runtime smoke test if touched. | Revert helper change; restore exported/global surface; rerun relevant tests and smoke checks. | Requires owner/code review. |
| Batch 5: unknown entries requiring owner review | All `unknown` entries, including `scripts/active-hazard-inventory.mjs`, county-readiness docs, future-county docs, audit coverage-gap docs, and any ambiguous documentation. | High until classified | Owner review; status reclassification; protected-system impact analysis; no cleanup until replacement or keep decision exists. | No cleanup should occur; if mistakenly changed, full revert required. | Not approved; owner review required. |

## 7. Validation Requirements

Every future cleanup milestone must include, at minimum:

1. Manifest update in `docs/audit-test-manifest.json` for every changed item.
2. `git diff --check`.
3. Relevant unit tests for any domain touched.
4. Relevant integration tests for historical, awareness, alert, writer, rollback, schema, or runtime-adjacent changes.
5. Relevant audit helper exposure/global checks when helper visibility, audit registry, or browser debug surfaces are involved.
6. Relevant manual audit scripts when scripts are retired, renamed, or replaced.
7. Smoke test if any runtime file is touched.
8. Protected-system verification covering Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase Sync, Liberty boundary data, Montgomery source data, historical systems, DriveTexas, and Transportation Intelligence.
9. Explicit rollback instructions for every removed, archived, renamed, or reclassified artifact.
10. `git status --short` after validation.

## 8. Cleanup Risk Controls

- Cleanup must be additive-planning-first: classify, map replacements, and validate before removing anything.
- Unknown entries are blocked from cleanup until owner-reviewed.
- Candidate-retirement does not mean deletion-ready.
- Legacy does not mean deletion-ready.
- Duplicate does not mean deletion-ready when a script, runtime helper, fixture, or protected domain is involved.
- Documentation-only cleanup must still prove there are no active references, release dependencies, or governance dependencies.
- Runtime helpers cannot be retired without equivalent registered tests/audits and explicit smoke validation.
- Historical-system artifacts remain protected unless a future milestone proves exact replacement coverage.
- County and Montgomery documents remain protected while county rollout and Montgomery implementation evidence are active.
- Liberty data and Route Watch geometry evidence remain protected until county-agnostic validation replaces them.

## 9. Deferred Items / Owner Review Required

The following remain deferred and require owner review before cleanup:

- All 69 manifest entries with `status: unknown`.
- `scripts/active-hazard-inventory.mjs`, because it is hazard-lifecycle and Supabase-read-only adjacent.
- County activation, county readiness, county governance, county package, and future-county fast-track documents.
- Montgomery source, implementation, rollback, registry, activation, asset, boundary, and artifact assessment documents.
- Documentation-only coverage-gap audit docs whose current operational relevance is unclear.
- App store, PWA, Capacitor, branding, and store documentation until release ownership confirms current replacement sources.
- Route Watch V290-V299 geometry/activation docs and V291/V292/V295 scripts until V294/V296 replacement coverage and caller checks are complete.
- Historical capture V363-V386 legacy docs until a historical archive/index milestone proves they are no longer active readiness evidence.
- Historical language V447-V455 docs until the active historical awareness language tests and matrix are explicitly mapped as replacements.

## 10. Protected Systems Verification

V575E created only this cleanup plan. No protected runtime, data, tests, helper logic, Supabase assets, or historical-system behavior were modified.

Explicit verification:

- Shared Reports — no report runtime, storage, UI, audit logic, or reporting data changed.
- Route Watch — no Route Watch runtime behavior, geometry scoring, helper behavior, activation state, fixture data, or audit script changed.
- Awareness Filtering — no awareness filtering logic, output language, placement rule, adapter behavior, or awareness test changed.
- Hazard Lifecycle — no hazard creation, update, inventory, lifecycle, clearing behavior, or active hazard data changed.
- Alert Generation — no alert creation, alert context, alert language, delivery behavior, or alert audit changed.
- Supabase Sync — no Supabase config, migrations, schema exposure, writer behavior, sync behavior, rollback behavior, or data access changed.
- Liberty boundary data — no Liberty boundary, road segment, crossing, fixture, marker, road-name, or override data changed.
- Montgomery source data — no Montgomery boundary, source, registry, readiness, implementation, rollback, activation, or evidence data changed.
- Historical systems — no historical capture, passive history, live history, historical intelligence, historical awareness, storage, writer, canary, monitoring, or rollback behavior changed.
- DriveTexas — DriveTexas remains paused/not resumed; no DriveTexas integration state changed.
- Transportation Intelligence — Transportation Intelligence remains paused/not enabled; no transportation-intelligence runtime behavior changed.

## 11. Final Recommendation

V575E should be merged as a planning-only milestone. It establishes the first safe cleanup sequence and guardrails but intentionally leaves cleanup blocked until future milestones provide file-specific replacement coverage, owner review, and validation evidence.

**Final Determination:** **CLEANUP PLAN COMPLETE WITH OBSERVATIONS**

**Cleanup Readiness:** **FURTHER REVIEW REQUIRED**

## Testing

- ✅ `git diff --check`
- ✅ `git status --short`

## Merge Recommendation

1. **Quick summary** — Merge V575E as a cleanup-plan-only milestone. It defines staged cleanup batches without deleting audits, deleting tests, retiring helpers, changing runtime behavior, changing test logic, modifying data, resuming DriveTexas, or enabling Transportation Intelligence.
2. **Testing results** — `git diff --check` passed, and `git status --short` was run to verify the working tree.
3. **Merge recommendation** — Recommended to merge because the change is documentation-only and preserves conservative cleanup gates; actual cleanup should remain blocked pending owner review and future validation-backed cleanup milestones.
