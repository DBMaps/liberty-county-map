# Phase 28 exhaustive enum coverage

158 values across 27 types; static catalog/constraint coverage exhaustive; runtime equivalence classes documented below; unknown: 0. Descriptive and reserved vocabulary is explicitly distinguished from authorization transitions.

| Type | Value | Runtime behavior / equivalence |
|---|---|---|
| dispatch_private.unit_type | PUBLIC_WORKS | Descriptive classification; membership and scope determine access; Police/Public Works get no automatic authority. |
| dispatch_private.unit_type | LAW_ENFORCEMENT | Descriptive classification; membership and scope determine access; Police/Public Works get no automatic authority. |
| dispatch_private.unit_type | FIRE | Descriptive classification; membership and scope determine access; Police/Public Works get no automatic authority. |
| dispatch_private.unit_type | EMS | Descriptive classification; membership and scope determine access; Police/Public Works get no automatic authority. |
| dispatch_private.unit_type | EMERGENCY_MANAGEMENT | Descriptive classification; membership and scope determine access; Police/Public Works get no automatic authority. |
| dispatch_private.unit_type | UTILITIES | Descriptive classification; membership and scope determine access; Police/Public Works get no automatic authority. |
| dispatch_private.unit_type | TRANSPORTATION | Descriptive classification; membership and scope determine access; Police/Public Works get no automatic authority. |
| dispatch_private.unit_type | ADMINISTRATION | Descriptive classification; membership and scope determine access; Police/Public Works get no automatic authority. |
| dispatch_private.unit_type | OTHER | Descriptive classification; membership and scope determine access; Police/Public Works get no automatic authority. |
| dispatch_private.scope_type | COUNTY | All values share live scope/ownership branch; every value cast, classified and denied implicit platform authority. |
| dispatch_private.scope_type | MULTI_COUNTY | All values share live scope/ownership branch; every value cast, classified and denied implicit platform authority. |
| dispatch_private.scope_type | STATEWIDE | All values share live scope/ownership branch; every value cast, classified and denied implicit platform authority. |
| dispatch_private.scope_type | SERVICE_TERRITORY | All values share live scope/ownership branch; every value cast, classified and denied implicit platform authority. |
| dispatch_private.scope_type | CORRIDOR | All values share live scope/ownership branch; every value cast, classified and denied implicit platform authority. |
| dispatch_private.scope_type | ROUTE | All values share live scope/ownership branch; every value cast, classified and denied implicit platform authority. |
| dispatch_private.scope_type | FACILITY | All values share live scope/ownership branch; every value cast, classified and denied implicit platform authority. |
| dispatch_private.scope_type | SITE | All values share live scope/ownership branch; every value cast, classified and denied implicit platform authority. |
| dispatch_private.scope_type | NON_GEOGRAPHIC | All values share live scope/ownership branch; every value cast, classified and denied implicit platform authority. |
| dispatch_private.record_type | CONDITION | All four types tested across all 36 lifecycle pairs. HAZARD never admitted to pilot publishing. |
| dispatch_private.record_type | HAZARD | All four types tested across all 36 lifecycle pairs. HAZARD never admitted to pilot publishing. |
| dispatch_private.record_type | PLANNED_WORK | All four types tested across all 36 lifecycle pairs. HAZARD never admitted to pilot publishing. |
| dispatch_private.record_type | OPERATIONAL_NOTICE | All four types tested across all 36 lifecycle pairs. HAZARD never admitted to pilot publishing. |
| dispatch_private.unit_status | PLANNED | ACTIVE plus ready onboarding required; PLANNED/SUSPENDED/OFFBOARDED deny unit access. OFFBOARDED terminal. |
| dispatch_private.unit_status | ACTIVE | ACTIVE plus ready onboarding required; PLANNED/SUSPENDED/OFFBOARDED deny unit access. OFFBOARDED terminal. |
| dispatch_private.unit_status | SUSPENDED | ACTIVE plus ready onboarding required; PLANNED/SUSPENDED/OFFBOARDED deny unit access. OFFBOARDED terminal. |
| dispatch_private.unit_status | OFFBOARDED | ACTIVE plus ready onboarding required; PLANNED/SUSPENDED/OFFBOARDED deny unit access. OFFBOARDED terminal. |
| dispatch_audit.receipt_status | ACCEPTED | ACCEPTED is append-only evidence; rejected commands produce no receipt. |
| dispatch_private.review_state | NOT_SUBMITTED | Reserved vocabulary, executable review uses projection_status; no separate Phase 28 transition API (NOT_APPLICABLE runtime). |
| dispatch_private.review_state | PENDING_REVIEW | Reserved vocabulary, executable review uses projection_status; no separate Phase 28 transition API (NOT_APPLICABLE runtime). |
| dispatch_private.review_state | APPROVED | Reserved vocabulary, executable review uses projection_status; no separate Phase 28 transition API (NOT_APPLICABLE runtime). |
| dispatch_private.review_state | REJECTED | Reserved vocabulary, executable review uses projection_status; no separate Phase 28 transition API (NOT_APPLICABLE runtime). |
| dispatch_private.review_state | WITHDRAWN | Reserved vocabulary, executable review uses projection_status; no separate Phase 28 transition API (NOT_APPLICABLE runtime). |
| dispatch_private.scope_status | ACTIVE | ACTIVE only; SUSPENDED and REVOKED tested through live RLS. |
| dispatch_private.scope_status | SUSPENDED | ACTIVE only; SUSPENDED and REVOKED tested through live RLS. |
| dispatch_private.scope_status | REVOKED | ACTIVE only; SUSPENDED and REVOKED tested through live RLS. |
| dispatch_private.source_class | COMMUNITY | Provenance vocabulary; all values cast; Dispatch creates PRIVATE_OPERATIONAL and governed consumer ORGANIZATION. Caller classification never grants authority. |
| dispatch_private.source_class | OFFICIAL_PUBLIC | Provenance vocabulary; all values cast; Dispatch creates PRIVATE_OPERATIONAL and governed consumer ORGANIZATION. Caller classification never grants authority. |
| dispatch_private.source_class | ORGANIZATION | Provenance vocabulary; all values cast; Dispatch creates PRIVATE_OPERATIONAL and governed consumer ORGANIZATION. Caller classification never grants authority. |
| dispatch_private.source_class | PRIVATE_OPERATIONAL | Provenance vocabulary; all values cast; Dispatch creates PRIVATE_OPERATIONAL and governed consumer ORGANIZATION. Caller classification never grants authority. |
| dispatch_private.record_status | DRAFT | All 36 transition pairs for all four types; CLOSED/CANCELLED are terminal, no reopen. |
| dispatch_private.record_status | OPEN | All 36 transition pairs for all four types; CLOSED/CANCELLED are terminal, no reopen. |
| dispatch_private.record_status | IN_PROGRESS | All 36 transition pairs for all four types; CLOSED/CANCELLED are terminal, no reopen. |
| dispatch_private.record_status | MONITORING | All 36 transition pairs for all four types; CLOSED/CANCELLED are terminal, no reopen. |
| dispatch_private.record_status | CLOSED | All 36 transition pairs for all four types; CLOSED/CANCELLED are terminal, no reopen. |
| dispatch_private.record_status | CANCELLED | All 36 transition pairs for all four types; CLOSED/CANCELLED are terminal, no reopen. |
| dispatch_private.profile_status | ACTIVE | ACTIVE requires live Auth; DISABLED denies every command (40 command negatives). |
| dispatch_private.profile_status | DISABLED | ACTIVE requires live Auth; DISABLED denies every command (40 command negatives). |
| dispatch_private.record_priority | LOW | Descriptive private data; enum cast/constraint accepted for every value; never an authorization input or consumer field. |
| dispatch_private.record_priority | NORMAL | Descriptive private data; enum cast/constraint accepted for every value; never an authorization input or consumer field. |
| dispatch_private.record_priority | HIGH | Descriptive private data; enum cast/constraint accepted for every value; never an authorization input or consumer field. |
| dispatch_private.record_priority | CRITICAL | Descriptive private data; enum cast/constraint accepted for every value; never an authorization input or consumer field. |
| dispatch_private.recovery_status | FIRST_APPROVED | FIRST_APPROVED only; RECOVERED consumed; CANCELLED cannot complete. Two bound live approvers required. |
| dispatch_private.recovery_status | RECOVERED | FIRST_APPROVED only; RECOVERED consumed; CANCELLED cannot complete. Two bound live approvers required. |
| dispatch_private.recovery_status | CANCELLED | FIRST_APPROVED only; RECOVERED consumed; CANCELLED cannot complete. Two bound live approvers required. |
| dispatch_private.audit_event_type | ORGANIZATION_CREATED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | ORGANIZATION_UPDATED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | ORGANIZATION_ACTIVATED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | ORGANIZATION_SUSPENDED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | ORGANIZATION_REINSTATED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | ORGANIZATION_CLOSED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | MEMBER_INVITED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | INVITATION_ACCEPTED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | INVITATION_DECLINED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | INVITATION_EXPIRED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | MEMBER_SUSPENDED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | MEMBER_REACTIVATED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | MEMBER_REVOKED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | MEMBERSHIP_LEFT | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | ROLE_CHANGED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | OWNERSHIP_TRANSFER_INITIATED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | OWNERSHIP_TRANSFER_CANCELLED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | OWNERSHIP_TRANSFERRED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | OWNERSHIP_RECOVERED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | SCOPE_GRANTED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | SCOPE_REVOKED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | CAPABILITY_GRANTED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | CAPABILITY_SUSPENDED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | CAPABILITY_REVOKED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | RECORD_CREATED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | RECORD_UPDATED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | RECORD_ASSIGNED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | RECORD_CLOSED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | RECORD_CANCELLED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | PROJECTION_SUBMITTED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | PROJECTION_APPROVED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | PROJECTION_REJECTED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | PROJECTION_PUBLISHED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | PROJECTION_WITHDRAWN | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.audit_event_type | SETTINGS_CHANGED | Descriptive append-only event vocabulary; each value cast; none participates in authorization. Arbitrary update/delete denied. |
| dispatch_private.onboarding_state | PLANNED | Sequential owner review through private readiness; publication needs independent platform authority; SUSPENDED denies use; OFFBOARDED terminal. |
| dispatch_private.onboarding_state | IDENTITY_VERIFIED | Sequential owner review through private readiness; publication needs independent platform authority; SUSPENDED denies use; OFFBOARDED terminal. |
| dispatch_private.onboarding_state | ADMIN_ASSIGNED | Sequential owner review through private readiness; publication needs independent platform authority; SUSPENDED denies use; OFFBOARDED terminal. |
| dispatch_private.onboarding_state | MEMBERSHIP_CONFIGURED | Sequential owner review through private readiness; publication needs independent platform authority; SUSPENDED denies use; OFFBOARDED terminal. |
| dispatch_private.onboarding_state | SCOPE_CONFIGURED | Sequential owner review through private readiness; publication needs independent platform authority; SUSPENDED denies use; OFFBOARDED terminal. |
| dispatch_private.onboarding_state | MFA_VERIFIED | Sequential owner review through private readiness; publication needs independent platform authority; SUSPENDED denies use; OFFBOARDED terminal. |
| dispatch_private.onboarding_state | PRIVATE_PILOT_READY | Sequential owner review through private readiness; publication needs independent platform authority; SUSPENDED denies use; OFFBOARDED terminal. |
| dispatch_private.onboarding_state | PUBLISHING_REVIEW_REQUIRED | Sequential owner review through private readiness; publication needs independent platform authority; SUSPENDED denies use; OFFBOARDED terminal. |
| dispatch_private.onboarding_state | PUBLISHING_ENABLED | Sequential owner review through private readiness; publication needs independent platform authority; SUSPENDED denies use; OFFBOARDED terminal. |
| dispatch_private.onboarding_state | SUSPENDED | Sequential owner review through private readiness; publication needs independent platform authority; SUSPENDED denies use; OFFBOARDED terminal. |
| dispatch_private.onboarding_state | OFFBOARDED | Sequential owner review through private readiness; publication needs independent platform authority; SUSPENDED denies use; OFFBOARDED terminal. |
| dispatch_private.permission_scope | ORGANIZATION | ORGANIZATION uses live membership/role; PLATFORM uses independent live platform grant. Every API gets outsider denial. |
| dispatch_private.permission_scope | PLATFORM | ORGANIZATION uses live membership/role; PLATFORM uses independent live platform grant. Every API gets outsider denial. |
| dispatch_private.visibility_class | PRIVATE | Reserved vocabulary, no Phase 28 column/API transition uses this enum; no authorization branches (NOT_APPLICABLE runtime). |
| dispatch_private.visibility_class | ORGANIZATION | Reserved vocabulary, no Phase 28 column/API transition uses this enum; no authorization branches (NOT_APPLICABLE runtime). |
| dispatch_private.visibility_class | PROJECTION_CANDIDATE | Reserved vocabulary, no Phase 28 column/API transition uses this enum; no authorization branches (NOT_APPLICABLE runtime). |
| dispatch_private.visibility_class | PUBLIC_PROJECTION | Reserved vocabulary, no Phase 28 column/API transition uses this enum; no authorization branches (NOT_APPLICABLE runtime). |
| dispatch_private.assignment_status | ASSIGNED | ASSIGNED/CLEARED are private evidence vocabulary; assign creates ASSIGNED. No clear-assignment API in frozen command inventory. |
| dispatch_private.assignment_status | CLEARED | ASSIGNED/CLEARED are private evidence vocabulary; assign creates ASSIGNED. No clear-assignment API in frozen command inventory. |
| dispatch_private.capability_status | PENDING | ACTIVE plus nonexpired bounded duration only; PENDING/SUSPENDED/REVOKED cannot publish; revoked renewal denied. |
| dispatch_private.capability_status | ACTIVE | ACTIVE plus nonexpired bounded duration only; PENDING/SUSPENDED/REVOKED cannot publish; revoked renewal denied. |
| dispatch_private.capability_status | SUSPENDED | ACTIVE plus nonexpired bounded duration only; PENDING/SUSPENDED/REVOKED cannot publish; revoked renewal denied. |
| dispatch_private.capability_status | REVOKED | ACTIVE plus nonexpired bounded duration only; PENDING/SUSPENDED/REVOKED cannot publish; revoked renewal denied. |
| dispatch_private.invitation_status | PENDING | Only PENDING and unexpired can accept/revoke; terminal statuses cannot reopen; token bound to authenticated identity. |
| dispatch_private.invitation_status | ACCEPTED | Only PENDING and unexpired can accept/revoke; terminal statuses cannot reopen; token bound to authenticated identity. |
| dispatch_private.invitation_status | DECLINED | Only PENDING and unexpired can accept/revoke; terminal statuses cannot reopen; token bound to authenticated identity. |
| dispatch_private.invitation_status | EXPIRED | Only PENDING and unexpired can accept/revoke; terminal statuses cannot reopen; token bound to authenticated identity. |
| dispatch_private.invitation_status | REVOKED | Only PENDING and unexpired can accept/revoke; terminal statuses cannot reopen; token bound to authenticated identity. |
| dispatch_private.membership_status | INVITED | ACTIVE required; all remaining states deny live RLS; REVOKED cannot reactivate. |
| dispatch_private.membership_status | ACTIVE | ACTIVE required; all remaining states deny live RLS; REVOKED cannot reactivate. |
| dispatch_private.membership_status | SUSPENDED | ACTIVE required; all remaining states deny live RLS; REVOKED cannot reactivate. |
| dispatch_private.membership_status | REVOKED | ACTIVE required; all remaining states deny live RLS; REVOKED cannot reactivate. |
| dispatch_private.organization_type | FIRE | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | EMS | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | LAW_ENFORCEMENT | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | EMERGENCY_MANAGEMENT | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | UTILITY | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | FLEET | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | TRUCKING | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | MUNICIPALITY | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | SCHOOL_DISTRICT | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | CONTRACTOR | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | PRIVATE_COMPANY | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | INDUSTRIAL_OPERATOR | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | TRANSPORTATION_OPERATOR | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | INFRASTRUCTURE_OPERATOR | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.organization_type | OTHER | Descriptive: every value cast and every classification retains membership gates and fails platform-authority attempt. |
| dispatch_private.projection_status | SUBMITTED | SUBMITTED requires independent review; APPROVED required to publish; REJECTED/WITHDRAWN cannot publish. |
| dispatch_private.projection_status | APPROVED | SUBMITTED requires independent review; APPROVED required to publish; REJECTED/WITHDRAWN cannot publish. |
| dispatch_private.projection_status | REJECTED | SUBMITTED requires independent review; APPROVED required to publish; REJECTED/WITHDRAWN cannot publish. |
| dispatch_private.projection_status | WITHDRAWN | SUBMITTED requires independent review; APPROVED required to publish; REJECTED/WITHDRAWN cannot publish. |
| dispatch_private.role_template_key | OWNER | Fixed permission catalog: owner/admin/member/viewer and platform isolation exercised; no sector role exists. |
| dispatch_private.role_template_key | ORGANIZATION_ADMIN | Fixed permission catalog: owner/admin/member/viewer and platform isolation exercised; no sector role exists. |
| dispatch_private.role_template_key | SUPERVISOR | Fixed permission catalog: owner/admin/member/viewer and platform isolation exercised; no sector role exists. |
| dispatch_private.role_template_key | OPERATOR | Fixed permission catalog: owner/admin/member/viewer and platform isolation exercised; no sector role exists. |
| dispatch_private.role_template_key | VIEWER | Fixed permission catalog: owner/admin/member/viewer and platform isolation exercised; no sector role exists. |
| dispatch_private.verification_level | UNVERIFIED | Only VERIFIED_PUBLIC_ENTITY plus attestation/scope/grant authorizes public projection; other states cannot authorize publication. |
| dispatch_private.verification_level | VERIFIED_ORGANIZATION | Only VERIFIED_PUBLIC_ENTITY plus attestation/scope/grant authorizes public projection; other states cannot authorize publication. |
| dispatch_private.verification_level | VERIFIED_PUBLIC_ENTITY | Only VERIFIED_PUBLIC_ENTITY plus attestation/scope/grant authorizes public projection; other states cannot authorize publication. |
| dispatch_private.organization_status | PENDING | ACTIVE only permits tenant reads; every other state denied in live RLS matrix; CLOSED terminal for reactivation. |
| dispatch_private.organization_status | ACTIVE | ACTIVE only permits tenant reads; every other state denied in live RLS matrix; CLOSED terminal for reactivation. |
| dispatch_private.organization_status | SUSPENDED | ACTIVE only permits tenant reads; every other state denied in live RLS matrix; CLOSED terminal for reactivation. |
| dispatch_private.organization_status | CLOSED | ACTIVE only permits tenant reads; every other state denied in live RLS matrix; CLOSED terminal for reactivation. |
| dispatch_private.internal_share_class | PRIVATE_TO_UNIT | PRIVATE_TO_UNIT source isolates unit; PRIVATE_TO_ORGANIZATION remains tenant-only; selected sharing is separate sanitized recipient projection. |
| dispatch_private.internal_share_class | PRIVATE_TO_ORGANIZATION | PRIVATE_TO_UNIT source isolates unit; PRIVATE_TO_ORGANIZATION remains tenant-only; selected sharing is separate sanitized recipient projection. |
| dispatch_private.internal_share_class | SHARED_WITH_SELECTED_UNITS | PRIVATE_TO_UNIT source isolates unit; PRIVATE_TO_ORGANIZATION remains tenant-only; selected sharing is separate sanitized recipient projection. |
| dispatch_private.ownership_transfer_status | PENDING | PENDING only accepts/cancels. ACCEPTED/CANCELLED terminal; replay after acceptance denied, concurrent starts one pending. |
| dispatch_private.ownership_transfer_status | ACCEPTED | PENDING only accepts/cancels. ACCEPTED/CANCELLED terminal; replay after acceptance denied, concurrent starts one pending. |
| dispatch_private.ownership_transfer_status | CANCELLED | PENDING only accepts/cancels. ACCEPTED/CANCELLED terminal; replay after acceptance denied, concurrent starts one pending. |
