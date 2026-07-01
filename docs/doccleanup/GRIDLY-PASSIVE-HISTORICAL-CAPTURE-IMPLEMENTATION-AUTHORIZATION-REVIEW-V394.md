# V394 — Passive Historical Capture Implementation Authorization Review

## 1. Executive Decision

**Decision: A. Authorize Implementation Package Preparation.**

V394 authorizes preparation of a Phase 1 passive historical evidence capture implementation package. This is an implementation-package preparation authorization only. It does not authorize implementation, migration execution, Supabase deployment, historical reads, historical writes, history UI, production activation, or production behavior changes.

The authorized next package must remain consistent with the governing principle:

> Capture Everything. Show Nothing. Depend On Nothing.

The package must preserve passive, fail-open, non-authoritative, reversible, and user-invisible behavior.

## 2. Authorization Rationale

Implementation-package preparation is authorized because V391, V392, and V393 provide enough existing evidence to make a decision without creating a new governance framework or additional authorization chain.

The authorization rationale is:

- The implementation concept is sufficiently bounded as a disabled-by-default, fail-open, append-only sidecar.
- The storage direction is identified as a future dedicated `history_capture` schema in the existing Supabase project, with migration review still separate and unapproved.
- The candidate event taxonomy is defined: `report_created`, `report_updated`, `report_cleared`, `incident_transitioned`, and `incident_closed`.
- V393 identifies safe attachment classes for report events as post-success observations, not production prerequisites.
- V393 identifies lifecycle events as requiring a post-decision adapter before attachment, avoiding inline edits to protected live incident collections.
- The protected systems remain explicitly outside the capture authority boundary.
- Current state remains unchanged: no migration applied, no Supabase change, no historical reads, no historical writes, no history UI, no production integration, and no production behavior changes.

The decision is therefore to proceed toward an implementation-package review, not to perform implementation work now.

## 3. Authorized Scope

V394 authorizes only the preparation of an implementation package that defines exact future implementation work. The package may include:

1. Exact proposed file list for future additive sidecar implementation files.
2. Exact proposed test file list and fixture list for gate, envelope, idempotency, duplicate suppression, fail-open, timeout, and parity validation.
3. A sidecar module design for capture gates, environment allowlist evaluation, envelope construction, canonicalization, idempotency key generation, payload digest generation, duplicate classification, writer adapter boundaries, and maintainer-only monitoring.
4. A disabled-by-default gate specification covering emergency disablement, environment allowlist, global capture, write gate, and source-level gates.
5. A fail-open writer design showing that capture errors, duplicate errors, malformed envelopes, timeout, credential failure, archive unavailability, and monitoring failure cannot alter production outcomes.
6. Exact post-success report hook candidates for `report_created` and `report_cleared`, described as future attachment points only.
7. Conditional `report_updated` hook treatment that remains disabled unless an approved production update path exists.
8. A post-decision lifecycle adapter design for `incident_transitioned` and `incident_closed` that receives already-decided lifecycle facts and does not mutate protected live collections.
9. A validation plan proving no effect on protected production outputs, including report submission success, report clear success, live incident membership, alerts, awareness, markers, Route Watch, and DriveTexas.
10. A rollback and disablement verification plan proving capture can be disabled without migrations, cleanup scripts, protected-system edits, data restores, UI changes, or production behavior changes.
11. A migration-review input summary for a future dedicated `history_capture` schema, without SQL implementation or migration application.
12. Maintainer-only monitoring event definitions and redaction expectations.
13. Privacy and data-minimization field eligibility requirements for the implementation package.

This scope authorizes package preparation only. It does not authorize code changes to production behavior.

## 4. Explicitly Excluded Scope

The following remain prohibited by V394:

- migration execution;
- migration application;
- SQL changes;
- Supabase deployment;
- Supabase project changes;
- historical reads;
- historical writes;
- history UI;
- analytics UI;
- production activation;
- production behavior changes;
- runtime integration that attempts archive writes;
- production use of historical evidence;
- database triggers on live production tables;
- backfill of old data;
- direct edits to protected systems for capture authority;
- changes to `loadSharedReports()` behavior;
- changes to `activeHazards` behavior;
- changes to `getLiveHazardIncidents()` behavior;
- changes to `unifiedRoadIncidents` behavior;
- changes to `activeUnifiedIncidents` behavior;
- changes to alerts;
- changes to awareness;
- changes to markers;
- changes to Route Watch;
- changes to DriveTexas;
- any user-visible history surface;
- any dependency from production correctness to capture success, archive availability, duplicate suppression, monitoring, or historical storage.

## 5. Remaining Blockers

The following are the only actual implementation-package blockers:

1. Exact future sidecar file names and exports are not yet specified.
2. Exact future test file names, fixtures, and parity assertions are not yet specified.
3. Exact future `report_created` and `report_cleared` post-success insertion points are not yet specified at line-level precision.
4. The existence and ownership of an approved production `report_updated` path must be confirmed before enabling or implementing that source.
5. The post-decision lifecycle adapter design for `incident_transitioned` and `incident_closed` is not yet specified.
6. The future migration package details for schema, tables, indexes, constraints, grants, RLS, writer identity, and rollback expectations are not yet specified.
7. The maintainer-only monitoring destination, event names, thresholds, and redaction rules are not yet specified.
8. Privacy and data-minimization approval for retained fields, retention duration, redaction profile, and deletion obligations is not yet documented for implementation review.
9. The non-production validation environment and acceptance evidence format are not yet specified.

There are no governance blockers identified by V394. There are no hypothetical blockers listed here.

## 6. Recommended Initial Event Set

### Phase 1A

Phase 1A should include the lowest-risk post-success report provenance events:

- `report_created`
- `report_cleared`

Rationale: both can be modeled as observations after durable production report actions succeed. Capture can fail open after production success without becoming a prerequisite for report creation, clear semantics, live incident state, alerts, awareness, markers, Route Watch, or DriveTexas.

### Phase 1B

Phase 1B should include lifecycle events after the post-decision lifecycle adapter is designed and approved in the implementation package:

- `incident_transitioned`
- `incident_closed`

Rationale: these events are valuable historical evidence, but V393 correctly identifies that they require a reviewed adapter receiving already-decided transition facts. They should not be attached inline to protected live incident collection mutation paths.

### Deferred

The following event should be deferred until an approved production update path exists and is documented:

- `report_updated`

Rationale: the event contract is valid, but current readiness is conditional because a centralized approved production update boundary has not been confirmed. If no approved update path exists at implementation time, the source-level gate must remain disabled and expected event volume must be zero.

## 7. Implementation Package Entry Criteria

Before implementation-package review, the following information must exist:

1. Exact proposed implementation file paths, test file paths, and fixture paths.
2. Exact proposed exports and responsibilities for each sidecar module.
3. Exact gate names, defaults, precedence, failure behavior, and environment allowlist behavior.
4. Exact event envelope field list, required/optional field rules, canonicalization rules, idempotency key rules, payload digest rules, and duplicate collision behavior.
5. Exact timeout and fail-open handling for each capture stage.
6. Exact `report_created` and `report_cleared` post-success hook candidates, including file and line-level placement proposals.
7. A clear `report_updated` disposition: either a confirmed approved update boundary or a disabled source with zero expected events.
8. Exact post-decision lifecycle adapter design for `incident_transitioned` and `incident_closed`, including inputs, outputs, and proof that it receives already-decided facts only.
9. A protected-system parity validation plan covering `loadSharedReports()`, `activeHazards`, `getLiveHazardIncidents()`, `unifiedRoadIncidents`, `activeUnifiedIncidents`, alerts, awareness, markers, Route Watch, and DriveTexas.
10. A migration-review summary sufficient to support a later SQL review, without executing or applying SQL.
11. Maintainer-only monitoring definitions, redaction rules, thresholds, and disablement signals.
12. Privacy/data-minimization approval inputs for retained fields, excluded fields, redaction profile, retention duration, and deletion obligations.
13. Non-production validation environment requirements and acceptance evidence format.
14. Rollback and emergency-disable verification steps showing no production behavior dependency on capture.

## 8. Final Recommendation

Gridly should proceed toward implementation-package review.

The recommended path is to prepare a precise, disabled-by-default, fail-open implementation package for Phase 1 passive historical evidence capture. The package should start with Phase 1A report provenance events, keep lifecycle events in Phase 1B behind a post-decision adapter design, and defer `report_updated` until a production update boundary is confirmed.

This recommendation does not approve implementation or activation. It authorizes the next review artifact needed to decide whether a concrete implementation patch is safe.

## 9. Explicit Non-Approval Statement

V394 does **NOT** approve:

- migration execution;
- migration application;
- Supabase deployment;
- historical reads;
- historical writes;
- history UI;
- production activation.

V394 also does **NOT** approve SQL changes, Supabase changes, application changes, production integration, production behavior changes, protected-system modifications, or any dependency from live production correctness to passive historical capture.
