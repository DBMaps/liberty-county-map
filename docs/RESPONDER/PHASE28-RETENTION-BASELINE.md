# Retention engineering baseline — not legal/privacy approval

This is an engineering model only. It is not a final legal retention policy. No deletion job is enabled. Production activation depending on retention requires explicit later legal/privacy validation of schedule, jurisdiction, contracts, holds, backup copies, exports, records obligations and disposition evidence.

| Class | Proposed window and anchor |
|---|---|
| Invitations | 1 year after terminal state |
| Assignments | 1 year after owning record closure |
| Command receipts | 2 years after accepted command, no shorter than replay/restore horizon |
| Projection candidates | 2 years after terminal review/withdrawal/expiry |
| Private operational records | 3 years after closure |
| Private record revisions | 3 years after owning record closure; never shorter than surviving record |
| Public-projection lineage | 3 years after withdrawal/expiry |
| Membership history | 7 years after terminal membership/organization closure |
| Audit | 7 years after event |
| Recovery records | 7 years after case closure |

Retain active records while active. A legal hold overrides expiration. Missing terminal anchors fail closed. Calendar anniversaries are used; February 29 clamps to February 28 where necessary. The pure calculator tests expiration boundaries and hold/active overrides; it does not prove legal correctness, database enforcement, or automated disposition.

The policy requires revoking user sessions, factors and memberships before erasing mutable profile/contact data. Retained immutable operational/audit evidence must use a nonreversible scope-specific actor token. New Phase 28 event tokens are random UUIDs per organization/user with a separately private mapping, not hashes of predictable identity. Destroying that mapping is part of approved erasure. Consumer views expose no private actor identity.

The closure package implements explicit historical conversion: raw actor links become nullable while scoped tokens retain identity lineage; nested historical UUID references are substituted; the private mapping is then destroyed. Evidence rows are preserved. The single Auth bridge verifies that Auth deletion has completed before the final conversion command. The runtime suite tests surviving revisions, receipts, audit, internal-share and consumer-projection lineage, distinct tokens across organizations, profile/session/factor removal, and retry idempotency. This engineering implementation is not legal authorization for production erasure.

Legal holds, retention classes and disposition events need a complete storage/administration contract before retention execution. `pilot_events` includes engineering retention metadata; it is not a complete hold-management system. Preserve immutable evidence while these gates remain open.
