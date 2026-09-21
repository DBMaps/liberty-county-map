# Phase 28 authorization and capability matrices

All allows require live AAL2/TOTP, user/session/profile, organization membership/permission, active organization and appropriate scope. The table describes intended and exercised behavior; actual test outcomes belong in the execution report.

| Actor / action | Own private unit | Other unit source | Explicit sanitized share | Consumer candidate |
|---|---|---|---|---|
| Public Works OPERATOR | Read/create/update with scope | Deny Police | Read if recipient | Submit only with independent governed eligibility |
| Police OPERATOR | Read/create/update with scope | Deny Public Works | Read if recipient | No authority from classification |
| Multi-unit SUPERVISOR | Only explicit units | Deny other units | Only recipient units | Permission + grant + review gates |
| Organization admin without unit membership | Deny | Deny | Deny unless recipient member | Deny unit source |
| Platform admin without org membership | Deny | Deny | Deny | Cannot act as tenant publisher |
| VIEWER | Read only in explicit unit | Deny | Read if recipient | Deny mutation |
| Revoked unit member | Deny | Deny | Deny next request | Deny |
| Another organization | Deny | Deny | Deny | Deny |
| AAL1 / anon | Deny | Deny | Deny | Deny mutation |

Unit and internal tables have forced RLS. Storage without an explicit client policy/grant is default deny. Private record/revision/assignment predicates use source ownership. Raw candidates, audit, receipts, actor mappings, verification evidence, private JSON and share recipients have no browser table grants. No INSERT/UPDATE/DELETE grants are given to browser roles. Runtime tests exercise both PostgREST and role-switched direct SQL.

| Internal condition | Result |
|---|---|
| No recipients / wildcard / foreign organization unit | Deny atomically |
| Sender lacks internal.share or source unit | Deny |
| Recipient gets explicit active membership + permission | Sanitized view only |
| Recipient removed/revoked; source revised/closed/cancelled; unit offboarded | Invisible on next read |
| Recipient attempts source mutation or recipient-list mutation | Deny without independent source permission |
| Stale expected share revision | Deny |

| Publishing capability | Public Works initial configuration | Police initial configuration |
|---|---|---|
| awareness.condition.publish | Eligible for independent governed grant, not enabled by config | None automatically |
| awareness.planned_work.publish | Eligible for independent governed grant, not enabled by config | None automatically |
| awareness.official_notice.publish | Eligible for independent governed grant, not enabled by config | None automatically |
| awareness.hazard.publish | Disabled | Disabled |
| awareness.road_closure.publish | Disabled | Disabled |

Consumer publication requires VERIFIED_PUBLIC_ENTITY plus current verification/attestation, approved organization policy, matching active scope/version with governed evidence, active capability with valid start/end and max-90-day duration, source unit publishing readiness, source revision/status, sanitation and independent review. Department admin cannot grant platform capabilities. No universal VERIFIED_AUTHORITY state exists.

Hazard record type and hazard/road-closure safety classifications fail the initial eligibility predicate even when a condition capability exists. Private declared scope alone is not public authority. A missing grant, wrong scope/type, future/expired/revoked grant, AAL1, absent/expired verification, absent governance source/version or stale source is a denial. Publication attribution must match the organization's governed display name, fixed source label and record-type taxonomy. Free-text semantics still require human sanitation; a role/capability test alone does not prove text safe.

Enabling publication for an individual unit also requires live platform.capability.manage permission in addition to explicit organization unit-management permission. A department admin/owner cannot enable Police or another unit merely because an organization-wide capability exists. The platform reviewer must have explicitly approved organization membership for this action; platform status alone never inherits private unit access.

Phase 20 and Phase 27 had no standalone test files in the starting repository. The closure contract suite adds focused Phase 27 security-catalog checks. Complete command certification, enum values/equivalence descriptions, lifecycle combinations and live authorization results are emitted by the closure rehearsal. See `PHASE28-COMMAND-CERTIFICATION.md` and the machine-readable evidence; static catalog checks alone are not runtime certification.
