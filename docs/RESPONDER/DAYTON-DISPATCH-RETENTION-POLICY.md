# DAYTON-RETENTION-01 — Retention, deletion and redaction

**OWNER_APPROVED POLICY BASELINE — LEGAL/PRIVACY REVIEW STILL REQUIRED BEFORE PRODUCTION ACTIVATION.**

Authority: owner instruction “GRIDLY DISPATCH — OWNER GOVERNANCE DECISION: RETENTION / DELETION / REDACTION POLICY.” Version: DAYTON-RETENTION-01-v1. Assessed against local implementation commit `02a73f90ce9a82ea6e128f62e62ec4a8af662cf9`. Governance only: no runtime changes, deletion jobs, live holds, production access or activation are authorized. This supplements, without modifying, the frozen Phase 29 reporting contract and Phase 27/28 historical recommendations.

## Retention matrix and clocks

Retain active operational objects only while operationally necessary. Calendar anniversaries apply (February 29 clamps to February 28). Missing or ambiguous terminal anchors block disposition pending resolution; they do not authorize indefinite retention as policy. Holds are bounded exceptions. Dependency-aware disposition must preserve surviving evidence without unnecessarily retaining source plaintext.

| Object class | Approved operational baseline | Clock / minimum retained evidence |
| --- | --- | --- |
| Invitations | Active until accepted, revoked, replaced or expired; terminal metadata 1 year | Terminal timestamp; required delivery/security metadata only; no reusable secrets/tokens |
| Organization/unit memberships | Active duration; historical evidence 7 years | Termination/offboarding timestamp; minimized actor-token evidence |
| Capability grants/reviewer authorizations | Active duration; historical evidence 7 years | Actual revocation or expiry timestamp; scope, authority reference, issuer token, policy and terminal metadata |
| Private reports/details, road impacts and provenance | Active while operationally active; terminal records 3 years | Terminal operational timestamp, independent of impact CLEARED; preserve identity/revision relationships |
| Revisions/impact revisions | 3 years after supersession or owning record terminal state, using the later applicable anchor while needed by surviving record/lineage | Avoid deleting evidence still referenced by an active record or retained publication; no silent cascade |
| Assignments | Active record + 1 year after terminal state, capped by owning record retention | Owning record closure; remove unnecessary assignee display/contact data |
| Public projections/publication lineage | Active only while eligible; history 3 years | Withdrawal, expiry or supersession timestamp; published content, author/reviewer, scope/version and correction chain |
| Candidates/publication reviews/review-state snapshots | 2 years after final disposition | Preserve core reviewed-revision/digest/policy references with actual publication lineage for its 3-year window; minimize rather than retaining entire candidate indefinitely |
| Receipts/command evidence | 2 years by default; minimized security/governance evidence up to 7 years where classified | Accepted-command timestamp; never shorter than replay/restore risk horizon without a reviewed archive/refusal rule; no sensitive payload duplication |
| Audit/high-risk security events | 7 years | Event timestamp; minimized tokens/identifiers |
| Recovery cases/approvals | 7 years | Case closure timestamp; minimized evidence, no reusable recovery secrets |
| Bilateral agreements/parties/recipient authorizations | Active duration; historical agreement evidence 7 years | Revocation/expiry timestamp; both approvals, scope, purpose, fields/categories and terminal metadata |
| Shared representations/recipient rows | Underlying report/internal/public category, never longer merely because shared | Underlying terminal anchor; sharing expiry immediately removes eligibility, not necessarily retained evidence |
| Screening/quarantine/remediation evidence | Minimized evidence 7 years as high-risk security/audit class | Screening/disposition/remediation event timestamp; no rejected plaintext; linked evidence survives without restoring payload |
| Redacted records | Underlying record category; minimized remediation evidence 7 years | Original category anchor, not a reset merely because redacted |
| Mutable profiles/contact/identity mappings | Erase promptly after authorized offboarding unless specifically required | Separate access termination from identity erasure; retain minimized lineage, not unnecessary mutable profiles |
| Backups/snapshots/exports/evidence bundles | No independent indefinite extension | Exact backup-aging/export deadlines require legal/privacy and operational approval before activation; object-level obligations survive restoration |

The newer grant/reviewer/sharing and screening/remediation classes reconcile Phase 29 with the Phase 27 1/2/3/7-year recommendations. The revision dependency rule preserves the Phase 28 “never shorter than surviving record” constraint. Receipt replay safety is a security floor, not permission for indefinite ordinary payload retention. No existing legal schedule or provider backup window is claimed to be approved here.

## Quarantine and prohibited plaintext

Target maximum suspected-prohibited plaintext quarantine duration: **30 days from quarantine creation**, with materially earlier removal as soon as review/remediation completes. This is a ceiling, not a required holding period or permission to add plaintext storage. Current Phase 29 rejected intake stores only quarantine identity/metadata and a digest, with no plaintext quarantine column; preserve that safer design.

A false-positive disposition permits only sanitized, independently approved content through normal governed intake. Remove any restricted review copy promptly after confirmation. Confirmed prohibited plaintext must be removed/redacted as soon as remediation completes; never retain it for ordinary audit convenience. Retain only event ID, actor/reviewer tokens, category, rule/classifier and policy versions, decision, timestamp, disposition, appropriate digest and removal proof. Digests themselves remain restricted and minimized; they are not proof that content is legally anonymous.

Existing-record quarantine currently removes eligibility but can leave text in ordinary source/revision tables until explicit redaction. The 30-day ceiling applies to any such retained suspected-prohibited plaintext as well: operational remediation must be earlier when possible. This is an implementation gap, not authorization to leave confirmed prohibited text there for 30 days. A legal requirement to retain actual prohibited plaintext requires separately restricted hold storage and legal direction, never ordinary application/quarantine tables.

## Controlled redaction

Remove prohibited plaintext from source, revisions, candidate/public and shared representations while preserving event/record identity, relationships and revision lineage. Redacted state must carry reason category, redaction event reference, policy version, authorized actor/reviewer token and timestamp. No hidden copy in ordinary tables. Keep minimized remediation proof under its evidence clock. Current explicit redaction command has partial coverage of these requirements; see gaps below. Automated screening is supplemental defense, not a compliance guarantee.

## Deletion and offboarding

Immediately make login/sessions, memberships, unit membership, reviewer authority, participant capability eligibility, invitation, sharing and recovery authority unusable; no grace period. Revoke sessions/factors and finish verified Auth removal before identity erasure. Preserve required report authorship, review, audit, recovery, grant and publication lineage using random organization-scoped actor tokens; destroy private token-to-user mappings and unnecessary profile/contact data. Organization-bound capabilities do not disappear merely because their issuer leaves; participant eligibility must cease and issuer identity must be minimized. Distinguish effective denial from persisted revocation records: both need an explicit accountable procedure.

## Holds, backups and exports

Every hold requires exact objects/classes, reason/reference, authorized issuer, start, review/expiry and release evidence; no global indefinite default. A hold suspends only scoped disposition. Prefer minimized evidentiary substitutes for prohibited plaintext. Separately restricted storage is required if legal direction truly requires plaintext preservation.

Document active-system deletion timing, exact backup-aging window, export expiry/custodian and restore-time reapplication. Before reopening a restored system, reapply deletion/redaction, revocation and expiry obligations; reconcile command receipts/replay evidence. Never resurrect revoked access or prohibited plaintext. Exports follow the same minimum-necessary rules and legal holds. These provider/runbook values remain unresolved activation gates; no external provider was inspected.

## Current implementation support and exact gaps

Source inspection only; no new runtime certification. Existing certified tests remain evidence for their original scope, not proof of this new policy's execution.

| Requirement | Support | Evidence / exact missing execution |
| --- | --- | --- |
| Terminal-state retention calculation | PARTIAL | Phase 28 engineering calculator and timestamps/events exist; Phase 29 classes and all authoritative terminal/supersession anchors are not integrated into an execution schedule |
| Pseudonymization | PARTIAL | Phase 28 `pseudonymize_user` retires profile and identity mapping with retained tokens; Phase 29 opaque reviewer lineage survives mapping retirement. No complete policy-driven erasure/export/backup inventory or all-path persisted revocation workflow |
| Quarantine plaintext deletion | PARTIAL | Rejected intake stores no plaintext (`content_quarantine` metadata only). Existing-record quarantine retains ordinary text until manual `redact_report`; no deadline queue/escalation or autonomous purge; no retained-copy/false-positive disposition workflow |
| Redaction evidence | PARTIAL | `redact_report` scrubs source/revisions/reviews/projections/shares and creates remediation evidence; no complete explicit reason-category/authorized independent remediation-review/removal-proof model or all historical quarantine-copy reconciliation |
| Legal holds | NOT IMPLEMENTED | `pilot_events.legal_hold` is isolated engineering metadata under append-only control; no complete scoped hold object, authorized commands, expiry/review/release, restricted plaintext hold storage or enforcement |
| Disposition scheduling | NOT IMPLEMENTED | No integrated Phase 29 scheduler, dependency-aware delete/archive commands, replay-retirement refusal or immutable disposition proof across the matrix; ordinary append-only guards/FKs must not be bypassed |
| Backup-restoration reapplication | NOT IMPLEMENTED | No implemented deletion/redaction obligation ledger and restore reconciliation gate/runbook proving no resurrection; provider aging/export windows unapproved |

Additional precision: authorizing publication review is not authorization for independent remediation review. Current `redact_report` uses general `projection.review` and a supplied policy reference; do not present DAYTON-REVIEW-01 as a complete redaction authorization policy. Historic audit/receipt scrubbing for already-stored prohibited plaintext and external copies requires a separately reviewed inventory; current redaction command cannot be assumed to cover arbitrary historical payloads. Actual purge of append-only evidence after its retention clock requires narrow separately authorized boundaries, never weakening frozen Phase 27 controls.

**STOP — POLICY RECORDED; EXECUTION ALIGNMENT AND LEGAL/PRIVACY REVIEW REQUIRED BEFORE ACTIVATION.** No runtime/schema repair is performed. The owner may continue governance decisions; production retention execution and real collection remain blocked. No legal hold, deletion, export, disposition job, real participant or publishing state was created or changed.

Sources: `docs/RESPONDER/RESPONDER-PHASE27-DISPATCH-NEUTRAL-OWNER-DECISION-CLOSURE.md` (retention/deletion recommendations), `docs/RESPONDER/PHASE28-RETENTION-BASELINE.md`, `tools/responder/phase28/package.local.sql` (`pilot_events`, offboarding and pseudonymization), `tools/responder/phase29/schema.local.sql` (screening, quarantine, redaction and sharing), `tools/responder/phase29/review-authority.local.sql` (reviewer evidence), and the activation owner decision register. No legal interpretation or external legal review is asserted.
