# Phase 25 owner decision register

**DESIGN ONLY — NOT AUTHORIZED FOR PRODUCTION EXECUTION**

| Decision | Recommendation | Alternatives | Reason | Security Critical? | Required Before Phase 26? | Required Before Production? | Owner Status |
|---|---|---|---|---|---|---|---|
| Pilot sector | Municipal public works or tightly bounded utility after support review | School district; defer pilot | Validates neutrality without broad simultaneous launch | No | No | Yes | OWNER_DECISION_REQUIRED |
| First live capability set | Condition, hazard, planned work, official notice; defer road closure until two-person staffing exists | Any subset of five frozen IDs | Limits high-impact publication | Yes | No | Yes | OWNER_DECISION_REQUIRED |
| Production retention durations | Approve a Dispatch-specific legal schedule by retention class | Indefinite hold; category-specific deletion | Community 180-day rules are not applicable | Yes | No | Yes | OWNER_DECISION_REQUIRED |
| User deletion/pseudonymization | Retain immutable actor UUID evidence with governed pseudonymous presentation | Hard delete; reversible identity vault | Balances accountability and privacy | Yes | No | Yes | OWNER_DECISION_REQUIRED |
| Ownership/recovery fresh step-up | Ship AAL2-only MVP plus a disabled `minimum_iat` hook; decide freshness before live recovery | Mandatory recent step-up; no freshness | Phase 24 proved AAL2, not recent-operation assurance | Yes | No | Yes | OWNER_DECISION_REQUIRED |
| Invitation expiry/delivery | Approved SMTP with a bounded expiry configured outside SQL | Manual pilot delivery; enterprise provider | Default delivery is not certified | Yes | No | Yes | OWNER_DECISION_REQUIRED |
| Verification renewal | Risk-based interval by organization type/level plus event-triggered review | One fixed interval; event-only | Verification confidence changes | Yes | No | Yes | OWNER_DECISION_REQUIRED |
| Non-county authoritative datasets | Enable each type only after immutable source/version and topology review | Internal governed source; external source; defer | Enum support is not authority evidence | Yes | No | Yes | OWNER_DECISION_REQUIRED |
| Consumer projection cache SLA | Bounded freshness with explicit offline expiry and push/poll invalidation | No-store; polling only | Revocation must remove stale awareness | Yes | No | Yes | OWNER_DECISION_REQUIRED |
| Platform recovery staffing | At least two named individual admins and two distinct approvals | Larger quorum/on-call rotation | Prevents shared-account or unilateral takeover | Yes | No | Yes | OWNER_DECISION_REQUIRED |
| Responder compatibility mode | Select `ABSENT`, `EMPTY`, or `POPULATED/REFERENCED` only from fresh preflight | Forced rename; unconditional coexistence | Snapshot evidence cannot prove current state | Yes | Yes | Yes | OWNER_DECISION_REQUIRED |

## Phase 27 closure lineage

Phase 27 supersedes the open-status interpretation of the table above without rewriting its Phase 25 historical record. The authoritative closure and rationale are in:

- `docs/RESPONDER/RESPONDER-PHASE27-DISPATCH-NEUTRAL-OWNER-DECISION-CLOSURE.md`
- `docs/RESPONDER/RESPONDER-PHASE27-OWNER-DECISION-PACKET.md`

| Decision ID | Phase 25 topic | Phase 27 disposition |
| --- | --- | --- |
| D27-05 | Pilot sector | `OWNER_APPROVAL_REQUIRED` — municipal public works recommended |
| D27-06 | First live capability set | `OWNER_APPROVAL_REQUIRED` — condition, planned work, official notice only |
| D27-07 | Production retention durations | `OWNER_APPROVAL_REQUIRED` — explicit proposed class schedule; legal/privacy approval required |
| D27-08 | User deletion/pseudonymization | `OWNER_APPROVAL_REQUIRED` — pseudonymous immutable actor evidence |
| D27-09 / D27-10 | Ownership/recovery fresh step-up | `FROZEN` — 10-minute ownership and 5-minute recovery TOTP recency |
| D27-11 / D27-12 | Invitation expiry/delivery | Expiry `FROZEN` at 7 days; provider/origin `OWNER_APPROVAL_REQUIRED` |
| D27-13 | Verification renewal | `OWNER_APPROVAL_REQUIRED` — annual plus public-capability attestation/events |
| D27-15 | Non-county datasets | `FROZEN` — private declaration allowed; public authority requires governed source research |
| D27-16 | Consumer projection cache SLA | `OWNER_APPROVAL_REQUIRED` — immediate server, under 1-minute target, 5-minute hard bound |
| D27-17 | Platform recovery staffing | `OWNER_APPROVAL_REQUIRED` — three trained admins, two distinct approvers |
| D27-18 | Responder compatibility | `FROZEN` evidence-selected rule; production mode awaits read-only preflight |
