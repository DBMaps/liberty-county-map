# GRIDLY Audit/Test Manifest Foundation V575B

## 1. Executive Summary

V575B creates a documentation-only manifest foundation for Gridly's audit and test estate before any cleanup, retirement, consolidation, or removal work begins.

This milestone adds a human-readable foundation document and a machine-readable manifest at `docs/audit-test-manifest.json`. The manifest identifies currently visible authoritative tests, runtime audit helpers, browser/manual debug helpers, documentation-only validation checks, legacy or duplicate candidates, and unknown items that require later owner review.

No audits were deleted. No tests were deleted. No runtime behavior, application code, audit helper behavior, test logic, Supabase configuration, Liberty data, Montgomery data, historical-system behavior, DriveTexas state, or Transportation Intelligence state was changed.

## 2. Why the Manifest Exists

V575A identified audit/test sprawl across Gridly. The repository contains active automated tests, runtime audit helpers, browser-only debug surfaces, one-off CLI audit scripts, milestone documents, readiness documents, and historical evidence records. That sprawl makes it difficult to distinguish active safety gates from duplicate, historical, or candidate-retirement artifacts.

V575B intentionally does **not** clean up the sprawl. Instead, it creates a safe inventory layer so maintainers can review classifications before any future cleanup milestone changes files. The manifest is the first guardrail: cleanup must be driven by reviewed status, replacement coverage, and protected-system verification rather than by filename age or apparent duplication.

## 3. Manifest Scope

The initial manifest covers these artifact types:

- Runtime audit helpers and audit-adjacent modules that protect Route Watch, historical capture, historical awareness, and Supabase-sync boundaries.
- Browser console/debug helpers that are manually invoked or exposed for audit visibility.
- Unit-style tests under `tests/history-capture/`.
- Integration/audit-style tests under `tests/history-capture/`.
- Documentation-only validation checks, including CLI audit scripts and active governance documents.
- Legacy, duplicate, or candidate-retirement items that should remain untouched until replacement coverage is reviewed.
- Unknown or needs-review items, especially helpers or document families whose operational ownership must be confirmed before cleanup.

The machine-readable manifest is intentionally conservative. It includes exact files where known and grouped document families where enumerating every historical milestone document would create a noisy first-pass inventory. Later milestones can expand grouped families into per-file entries after review.

## 4. Authoritative Audit/Test Categories

### Categories

1. **Runtime Audit Helpers** — Runtime modules or helper files that support audit behavior, protected boundaries, or audit-visible calculations.
2. **Browser Console Debug Helpers** — Browser/manual debug surfaces or globals that support audit inspection but are not necessarily repeatable CLI checks.
3. **Unit Tests** — Focused automated tests for module contracts, data-shape boundaries, flag defaults, language constraints, or isolated behavior.
4. **Integration Tests** — Automated tests or audit-style tests that validate multi-module boundaries, schema exposure, output placement, or cross-surface behavior.
5. **Documentation-Only Validation Checks** — CLI scripts and documents that currently serve as repeatable or reviewable validation evidence without changing runtime behavior.
6. **Legacy / Candidate Retirement Items** — Superseded, duplicate, historical, or candidate-retirement artifacts that must be reviewed before archive or removal.
7. **Unknown / Needs Review** — Items whose ownership, active use, or cleanup safety is not yet established.

### Status Values

- **authoritative** — Current safety gate or source of truth that must remain protected.
- **keep** — Should remain in place, but may not require registration as a canonical command yet.
- **keep-register** — Should remain and should be documented or registered as a canonical future command/check.
- **duplicate** — Appears to duplicate another artifact, but must not be removed until callers and replacement coverage are verified.
- **legacy** — Historical evidence or superseded implementation record that should remain until an archive/consolidation milestone is approved.
- **candidate-retirement** — Potential cleanup candidate after manifest review, replacement mapping, and protected-system checks.
- **unknown** — Requires owner review before classification or cleanup.

## 5. Initial Manifest Summary

The initial machine-readable manifest contains **45 entries**.

### Counts by Category

| Category | Count |
| --- | ---: |
| Runtime Audit Helpers | 11 |
| Browser Console Debug Helpers | 2 |
| Unit Tests | 8 |
| Integration Tests | 6 |
| Documentation-Only Validation Checks | 8 |
| Legacy / Candidate Retirement Items | 7 |
| Unknown / Needs Review | 3 |

### Counts by Status

| Status | Count |
| --- | ---: |
| authoritative | 23 |
| keep | 3 |
| keep-register | 8 |
| duplicate | 1 |
| legacy | 5 |
| candidate-retirement | 3 |
| unknown | 2 |

### Initial Interpretation

The highest-confidence authoritative set is the historical-capture automated test suite and the runtime helpers those tests protect. Route Watch geometry scripts and marker/road-name scripts remain useful but should be registered or documented before any cleanup. The Route Watch prototype/alias sequence, older audit-helper exposure documents, and historical language/readiness document families are candidates for later consolidation, not immediate deletion.

## 6. Cleanup Guardrails

Cleanup must not occur until this manifest is reviewed.

Future cleanup milestones must follow these guardrails:

1. Do not delete or archive an artifact only because it looks old.
2. Do not remove duplicate-looking files until callers, command references, and milestone compatibility are checked.
3. Do not remove runtime audit helpers until equivalent registered tests or audit commands exist.
4. Do not remove documentation-only validation checks until the replacement source of truth is named.
5. Do not alter audit helper behavior as part of manifest maintenance.
6. Do not alter test logic as part of manifest maintenance.
7. Do not modify Supabase migrations, Liberty data, Montgomery source data, or historical systems as part of audit/test cleanup.
8. Require protected-system verification after any future cleanup stage.

## 7. Protected Systems Verification

V575B is documentation/manifest only. The following protected systems were not changed:

- **Shared Reports** — No report runtime, report storage, or report UI changes occurred.
- **Route Watch** — No Route Watch runtime behavior, scoring behavior, helper behavior, or data behavior changed.
- **Awareness Filtering** — No awareness filtering logic, output language, placement rules, or adapter behavior changed.
- **Hazard Lifecycle** — No hazard creation, update, inventory, lifecycle, or clearing behavior changed.
- **Alert Generation** — No alert creation, alert context, alert language, or delivery behavior changed.
- **Supabase Sync** — No Supabase config, migrations, schema exposure, writer behavior, sync behavior, or data access changed.
- **Liberty boundary data** — No Liberty boundary, road segment, crossing, fixture, or override data changed.
- **Montgomery source data** — No Montgomery boundary/source/readiness data or documentation content was modified.
- **Historical systems** — No historical capture, historical intelligence, historical awareness, storage, writer, or rollback behavior changed.
- **DriveTexas** — DriveTexas remains paused/not resumed; no DriveTexas integration state changed.
- **Transportation Intelligence** — Transportation Intelligence was not enabled and no transportation-intelligence runtime behavior changed.

## 8. Recommended Next Step

The recommended next step is a future staged cleanup milestone **only after manifest review**. That milestone should first expand grouped document-family entries into per-file entries where needed, then register canonical checks without deleting files, and only later propose archive/removal candidates with explicit replacement coverage and protected-system verification.

## Merge Recommendation

1. **Quick summary** — Merge V575B as a manifest-only foundation for future audit/test cleanup governance. It creates the authoritative starting inventory without changing runtime or test behavior.
2. **Testing results** — `git diff --check` passed, and `git status --short` was run to verify the working tree contents.
3. **Merge recommendation** — Recommended to merge because the change is documentation/manifest only, low risk, and establishes review guardrails before cleanup.
