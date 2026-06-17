# V393 — Passive Historical Capture File-Boundary and Hook-Readiness Review

## 1. Program Summary

V355–V392 established Phase 1 passive historical evidence capture as a documentation-led, non-authoritative sidecar program governed by the rule:

> Capture Everything. Show Nothing. Depend On Nothing.

The authoritative implementation review package and V392 proposal define an append-only, disabled-by-default, fail-open archive that may later observe completed production actions and post-decision lifecycle events. The archive remains invisible to users, independent of live incident authority, and unavailable to Phase 1 production reads.

Current state remains unchanged:

- Migration applied: **NO**.
- Migration executed: **NO**.
- Supabase changed: **NO**.
- Historical reads: **NO**.
- Historical writes: **NO**.
- History UI: **NO**.
- Production integration: **NO**.
- Production behavior changes: **NO**.

V393 answers the file-boundary and hook-readiness question only: where future passive capture could attach without risking protected production behavior. V393 does not implement capture.

## 2. File Boundary Review

The following inventory classifies future implementation file boundaries. No files are modified by this review other than this documentation file.

| Boundary | Classification | Review Finding |
| --- | --- | --- |
| New dedicated sidecar module for capture gates, envelope construction, canonicalization, idempotency, writer adapter, and maintainer-only monitoring | **Safe** | Safe if created as an additive module with no production imports that execute writes by default, all gates default disabled, and no historical reads are exported to production UI or protected systems. |
| New dedicated sidecar test files and fixtures for gates, envelopes, duplicate suppression, fail-open handling, and parity checks | **Safe** | Safe because tests can validate isolation without changing runtime behavior. Fixtures must not require Supabase commands or real production credentials. |
| New documentation files for review packages, validation plans, rollback plans, and operational runbooks | **Safe** | Safe because documentation changes do not alter production behavior. |
| Future migration review package describing a dedicated `history_capture` schema | **Requires Review** | A migration package can be prepared later, but actual SQL, grants, RLS, table definitions, constraints, and deployment steps require separate approval. |
| New SQL migration file for `history_capture` | **Requires Review** | Out of V393 scope. Any migration file must be reviewed in a future migration milestone before application or execution. |
| New environment/configuration documentation for disabled-by-default capture gates | **Safe** | Safe as documentation only. Runtime configuration readers require implementation review before use. |
| Future runtime configuration reader for capture flags | **Requires Review** | The reader is acceptable only if missing, malformed, unknown, ambiguous, or unreadable state resolves to disabled and cannot affect production success paths. |
| Future archive writer adapter | **Requires Review** | The writer must be isolated, timeout-bounded, append-only, and invoked only after source success. It must not share authority with live report writes. |
| Future hook adapter around report creation/clear success boundaries | **Requires Review** | Potentially acceptable only as a post-success sidecar call. Exact insertion points require code-level approval and parity validation. |
| Future post-decision incident lifecycle dispatcher or adapter | **Requires Review** | Likely needed for lifecycle hooks because protected live collections must not be edited inline. The adapter must receive already-decided transition facts only. |
| `js/app.js` | **Out Of Scope** | Protected for V393. No modifications are approved. Future edits, if any, require explicit implementation authorization and should be limited to reviewed post-success/post-decision sidecar attachment points. |
| `index.html` | **Out Of Scope** | Protected for V393 and Phase 1 history UI remains unapproved. |
| `css/styles.css` | **Out Of Scope** | Protected for V393 and no user-visible history UI is approved. |
| Existing SQL files and Supabase project state | **Out Of Scope** | No SQL changes, migration execution, migration application, or Supabase deployment are approved. |
| Alert, awareness, marker, Route Watch, and DriveTexas files or logic | **Out Of Scope** | These systems must not read capture state, branch on capture state, or change output due to capture. |

## 3. Hook Readiness Review

### `report_created`

- **Readiness assessment:** Moderately ready for future implementation review. V392 identifies post-success report insert boundaries as the correct attachment class.
- **Ownership assessment:** Production report submission remains owner of insert success, duplicate guards, confirmation behavior, and refresh behavior. Capture may only receive copied post-success evidence.
- **Isolation assessment:** Strong if implemented in a separate sidecar adapter after durable insert success and before/parallel to refresh without being a prerequisite.
- **Fail-open feasibility:** High. Capture can be skipped, timeout, or fail after the production insert has succeeded without altering report creation behavior.

### `report_updated`

- **Readiness assessment:** Conditionally ready. The event contract is defined, but V392 does not assert a current centralized production update path.
- **Ownership assessment:** Any future update action remains production-owned. Capture cannot decide whether an update is accepted.
- **Isolation assessment:** Strong only if an approved update boundary exists and the hook is attached after durable success. If update ownership is absent or distributed, capture should remain disabled for this source.
- **Fail-open feasibility:** High once a clear post-success boundary exists; otherwise not implementable safely without first resolving ownership.

### `report_cleared`

- **Readiness assessment:** Ready with conditions. The proposed boundary is immediately after successful clear report insertion where current clear semantics are report-backed.
- **Ownership assessment:** Production clear handling remains owner of clear semantics and live lifecycle effects.
- **Isolation assessment:** Strong if capture stores provenance only and never closes, suppresses, hides, or mutates live incidents.
- **Fail-open feasibility:** High. Capture can fail after clear evidence is durably accepted by production without affecting live clear behavior.

### `incident_transitioned`

- **Readiness assessment:** Requires a reviewed post-decision lifecycle adapter before implementation.
- **Ownership assessment:** Production lifecycle code remains owner of active/stale/recently-cleared/closed decisions and collection membership.
- **Isolation assessment:** Acceptable only if capture receives immutable transition facts after production decision completion. Inline edits to protected lifecycle collections are not acceptable.
- **Fail-open feasibility:** Medium to high after adapter creation. Without an adapter, the risk of perturbing protected behavior is too high.

### `incident_closed`

- **Readiness assessment:** Requires the same reviewed post-decision lifecycle adapter as `incident_transitioned`.
- **Ownership assessment:** Production lifecycle rules remain owner of terminal state and close reason. Capture stores terminal evidence only.
- **Isolation assessment:** Acceptable only as a specialized terminal transition emitted after the closed decision is complete.
- **Fail-open feasibility:** Medium to high after adapter creation. Capture failure must never reopen, hide, close, or suppress incidents.

## 4. Protected System Impact Review

| Protected system | Impact assessment |
| --- | --- |
| `loadSharedReports()` | Must remain authoritative for live report loading. Future capture must not change its query, filtering, normalization, refresh cadence, return value, or error behavior. |
| `activeHazards` | Must remain production-owned live state. Capture must not add, remove, sort, expire, or annotate active hazards. |
| `getLiveHazardIncidents()` | Must remain a live incident derivation path. Capture must not become an input or fallback. |
| `unifiedRoadIncidents()` / `unifiedRoadIncidents` | Must remain derived from approved live sources only. Capture must not affect merge, dedupe, relevance, or display membership. |
| `activeUnifiedIncidents()` / `activeUnifiedIncidents` | Must remain active live incident state. Capture must not affect active membership or lifecycle classification. |
| Alerts | No historical evidence, capture state, duplicate state, monitoring state, or archive availability may affect alert eligibility, timing, text, suppression, priority, or routing. |
| Awareness | No historical evidence or capture monitoring may affect awareness state, copy, persistence, priority, or visibility. |
| Markers | Capture must not affect marker count, ownership, icon, label, popup, cluster, layer, click behavior, or refresh timing. |
| Route Watch | Capture must not affect route geometry, matching, relevance, destination ownership, route cards, route alerting, or route incident counts. |
| DriveTexas | Capture must not affect DriveTexas fetching, parsing, authority, fallback, merge logic, monitoring, or presentation. |

## 5. Capture Boundary Risk Assessment

| Hook | Classification | Rationale |
| --- | --- | --- |
| `report_created` | **Safe With Conditions** | Safe only as an additive post-insert sidecar after durable production success, with all gates disabled by default and fail-open behavior proven. |
| `report_updated` | **Safe With Conditions** | Safe if a centralized approved update path exists. If no update path exists, source gate must remain disabled and expected events must be zero. |
| `report_cleared` | **Safe With Conditions** | Safe as post-success provenance capture for production clear report inserts; must not itself close incidents or suppress markers. |
| `incident_transitioned` | **Requires Refactor** | Requires an explicit post-decision lifecycle dispatcher/adapter outside protected collection mutation paths before safe attachment. |
| `incident_closed` | **Requires Refactor** | Requires the same post-decision dispatcher/adapter and must be modeled as terminal evidence only. |

No proposed hook is classified as unconditionally safe because all require future implementation controls, default-disabled gates, parity validation, and protected-system non-interference proof. No hook is currently classified as not recommended if the stated conditions are met.

## 6. Migration Review Readiness

A future migration review package can be prepared, but V393 does not prepare it and does not approve any SQL.

The future package is ready to define review topics for:

- dedicated `history_capture` schema naming;
- append-only evidence table shape;
- unique idempotency constraint strategy;
- payload digest and duplicate collision storage rules;
- writer role, grants, RLS, and credential scope;
- migration rollback expectations;
- retention and privacy governance assumptions;
- non-production validation before any write gate is enabled.

Open migration details remain unresolved and must be handled in a separate milestone.

## 7. Implementation Review Readiness

The implementation proposal is sufficiently defined for an implementation authorization review, provided that authorization remains limited to disabled-by-default sidecar implementation and does not include migration execution, Supabase deployment, writes, reads, UI, or production activation.

Implementation authorization review should require:

- exact file list approval before coding;
- proof that `js/app.js`, `index.html`, `css/styles.css`, SQL files, protected systems, alerts, awareness, markers, Route Watch, and DriveTexas remain unchanged unless explicitly authorized;
- sidecar module design with no historical reads;
- disabled-by-default gate hierarchy;
- fail-open and timeout-bounded writer behavior;
- parity tests for protected outputs;
- non-production validation before write activation.

## 8. GO / NO-GO Recommendation

**Recommendation: A. Ready For Implementation Authorization Review.**

Rationale:

- The safe attachment classes are now identified as post-success report actions and post-decision lifecycle events.
- File boundaries are clear enough to distinguish safe sidecar/documentation/test additions from protected production files.
- Hook risk is understood: report hooks are safe with conditions, while lifecycle hooks require a reviewed adapter/refactor before attachment.
- Migration review can proceed separately without applying or executing SQL.
- The program still preserves Capture Everything, Show Nothing, Depend On Nothing because Phase 1 remains disabled by default, fail-open, non-authoritative, reversible, and invisible to users.

## 9. Remaining Open Items

Only the following implementation-review items remain unresolved:

1. Exact future sidecar module file names and exports.
2. Exact future report-created and report-cleared insertion lines, subject to code-level implementation authorization.
3. Whether a centralized approved `report_updated` production path exists at implementation time.
4. Design of the post-decision lifecycle dispatcher/adapter for `incident_transitioned` and `incident_closed`.
5. Exact migration schema, table, index, constraint, grant, RLS, and writer identity details.
6. Monitoring destination, thresholds, and maintainer runbook.
7. Privacy/legal approval for retention duration, redaction profile, deletion obligations, and field eligibility.
8. Non-production validation environment and acceptance evidence format.

## 10. Next Milestone Recommendation

Recommended next milestone:

**V394 — Passive Historical Capture Implementation Authorization Review**

V394 should decide whether to authorize a disabled-by-default sidecar implementation plan with exact file paths, exact tests, and explicit protected-file constraints. V394 should not authorize migration execution, Supabase deployment, historical reads, history UI, production writes, or production activation unless separately instructed.

## 11. Explicit Non-Approval Statement

V393 does **NOT** approve:

- migration execution;
- migration application;
- Supabase deployment;
- historical reads;
- historical writes;
- history UI;
- production integration;
- production behavior changes.

V393 also does **NOT** approve SQL changes, Supabase commands, modifications to `js/app.js`, modifications to `index.html`, modifications to `css/styles.css`, changes to alerts, changes to awareness, changes to markers, changes to Route Watch, changes to DriveTexas, or changes to protected live incident authority.
