# Internal shared-awareness contract

Internal sharing is not consumer projection. It has its own storage, recipient relation, permission checks, sanitized view and decision events. There is no `PUBLIC` internal classification and no wildcard municipal audience.

| Classification | Meaning |
|---|---|
| PRIVATE_TO_UNIT | Private source accessible only through owning-unit membership plus organization permission/scope |
| PRIVATE_TO_ORGANIZATION | Explicit organization-owned source; does not escape that organization |
| SHARED_WITH_SELECTED_UNITS | A separate sanitized awareness representation with nonempty, explicit recipient IDs; never source access |

The source's private classification stays intact. A share decision represents SHARED_WITH_SELECTED_UNITS; creating a share does not change the source into an organization-visible record. The current executable share table encodes that classification structurally through its required recipient relation. No broader municipal-awareness level is enabled.

The sender needs `internal.share`, owning-unit membership, a live scope, AAL2, and the exact source revision. Recipients must be active units in the same organization. At most 20 explicit recipients are accepted per command; duplicates fail atomically. A recipient needs live organization membership, unit membership and `internal.read`. Source/recipient unit suspension or offboarding, recipient removal/revocation, source revision change, expiry, closure or cancellation removes access on the next request. The public candidate path is never consulted for internal authorization.

Share payload is a separately reviewed title (1–160 characters) and summary (1–500), with an explicit INTERNAL_SAFE_V1 attestation and at most a one-day expiry. Arbitrary source JSON, private notes, assignments, identity, contact, priority, attachments, tactical detail and unit-private metadata cannot be copied by a database projection. Human review must also inspect free text: an attestation is not a content classifier or a CJIS safeguard by itself.

Recipient replacement and revocation require sender permission and expected share revision. Source revision and unit lineage are immutable. Every decision records the source revision, sanitization version/attestation, recipient IDs, actor token and command hash. Recipients can read only the view's ID/title/summary/timestamps and cannot edit the source or re-share it. Sender and recipient permissions do not imply consumer publication authority.

An organization with independent Police/Public Works organizations is privately usable in this pilot model, but cross-organization sharing is deliberately denied. A future governed inter-agency mechanism is separate scope; organization membership must never be bypassed to approximate it.
