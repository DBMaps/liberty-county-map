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
