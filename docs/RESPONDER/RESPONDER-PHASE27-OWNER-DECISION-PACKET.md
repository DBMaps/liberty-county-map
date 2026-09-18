# Gridly Dispatch Phase 27 — Owner Decision Packet

**OWNER REVIEW PACKET — NO PRODUCTION AUTHORIZATION**

## What this review does

Phase 26 proved the neutral Dispatch package on a disposable local Supabase clone. Phase 27 has closed the technical security design: a narrow command-only privileged role, one bounded live-Auth bridge, exact view grants, fresh step-up for ownership/recovery, and a stronger test standard. The following business, policy, and operating choices still require explicit owner approval before Phase 28 package preparation.

Approve each recommendation, reject it with a replacement, or defer the affected feature. Deferral means the related production feature remains disabled; it does not inherit a default.

## Approvals requested

### O27-01 — First pilot sector

**Recommended:** municipal public works.

**Why:** it fits the four frozen record types and public-awareness workflow with less infrastructure sensitivity than a utility and fewer child-safety/privacy concerns than a school district.

**Impact:** pilot language, verification operations, scope sources, support, and sales focus on municipal public works.

**If deferred:** no sector-specific pilot implementation or external pilot commitment; generic security package work may proceed only if all security-critical approvals are otherwise complete.

### O27-02 — Initial public capabilities

**Recommended:** enable condition, planned work, and official notice only. Keep hazard and road closure disabled initially.

**Why:** this is useful without granting the highest-impact safety authority. Hazard needs escalation/taxonomy support; road closure needs proven two-person publication and roadway authority.

**Impact:** private hazard/closure records may exist, but they cannot produce consumer projections.

**If deferred:** no live public capability grants or Consumer projection integration.

### O27-03 — Retention schedule

**Recommended operational defaults, subject to legal/privacy approval:** invitations 1 year after terminal state; assignments 1 year after record closure; command receipts and projection candidates 2 years; private records/revisions and public-projection lineage 3 years; memberships/audit/recovery evidence 7 years. Active data and legal holds remain longer as required.

**Why:** Dispatch holds workforce, operational, governance, and public-authority evidence; the Consumer 180-day rule is not suitable.

**Impact:** Phase 28 can design disposition/hold controls against explicit classes.

**If deferred:** no production data collection. Indefinite retention is not the fallback.

### O27-04 — User deletion and pseudonymization

**Recommended:** revoke access and erase the mutable profile/contact layer, while immutable history retains a non-reversible, scope-specific actor token. Raw deleted-user identity is not shown in routine views.

**Why:** hard deletion breaks operational/audit evidence; retaining names/emails by default over-collects personal data.

**Impact:** deletion is a governed workflow, not a cascade from Supabase Auth.

**If deferred:** production onboarding remains blocked.

### O27-05 — Invitation delivery

**Recommended:** approved transactional email from the Dispatch HTTPS origin, plus a controlled one-time manual-copy fallback for the pilot. Tokens are never logged or stored plaintext; reissue revokes the old token; links expire in 7 days.

**Why:** email is usable, while a tightly controlled fallback avoids onboarding dead ends. Neither path weakens authenticated identity matching or AAL2.

**Impact:** an email provider, sender identity, exact origin, redirect allowlist, and operational fallback procedure must be approved.

**If deferred:** production invitations/onboarding remain disabled.

### O27-06 — Organization verification renewal

**Recommended:** annual reverification for verified organizations and public entities; public entities with live publication capabilities also attest evidence every six months. Material changes or disputes trigger immediate review.

**Why:** identity and control evidence becomes stale, but verification must remain separate from authority grants.

**Impact:** platform staff need a renewal queue, evidence checklist, suspension path, and audit trail.

**If deferred:** do not issue live verified status or public capabilities.

### O27-07 — Capability renewal

**Recommended:** all pilot grants expire after at most 90 days; after pilot, condition/planned-work/official-notice grants may last 12 months and hazard/road-closure grants 6 months. No auto-renewal.

**Why:** public authority must not become permanent through inaction.

**Impact:** each renewal rechecks organization, scope/version, authority evidence, responsible contacts, and incidents.

**If deferred:** keep public capability grants disabled.

### O27-08 — Consumer removal SLA

**Recommended:** invalidation is immediate at the server, targeted under 1 minute for edge/online clients, and never more than 5 minutes for connected or approved offline display. Dispatch-derived responses remain `no-store` until a reviewed cache design exists.

**Why:** a suspended organization, revoked grant, withdrawn record, or expired projection must not remain safety guidance.

**Impact:** future Consumer work needs measurable origin/edge/client invalidation and a five-minute hard TTL.

**If deferred:** Dispatch projections do not enter Consumer Gridly.

### O27-09 — Platform recovery staffing

**Recommended:** at least three trained named platform administrators, with two distinct eligible approvers available for recovery; no shared accounts or bypass when the second approver is unavailable.

**Why:** two-person control is ineffective if accounts are shared or staffing routinely forces a bypass.

**Impact:** quarterly access review, semiannual recovery drills, and an emergency containment procedure are required. Containment may suspend access but cannot transfer ownership alone.

**If deferred:** remove/disable live ownership recovery. Normal ownership transfer can remain separately available after its controls are implemented.

## Security decisions already frozen

- Dedicated `NOLOGIN BYPASSRLS` owner only for exact command functions; no application login and no broad object ownership.
- `current_actor_id()` and `current_session_id()` become invoker helpers; only the no-argument boolean `has_live_aal2()` may remain postgres-owned.
- Security-invoker views receive exact column/function support only. Public roles do not receive raw candidate or table-wide private-record access.
- Runtime readiness means exhaustive catalog/value validation plus every distinct behavioral branch, not every redundant enum permutation.
- Ownership transfer requires fresh TOTP within 10 minutes for each actor.
- Platform recovery requires fresh TOTP within 5 minutes plus explicit case/target confirmation for each of two distinct approvers.
- Invitations expire after 7 days.
- Non-county scopes may be organization-declared for private operations, but public authority waits for governed source/version research.
- No live responder compatibility wrapper is installed if production preflight proves absent/empty and unreferenced. Any populated/referenced state stops for a migration-only plan.

## Owner sign-off record

Record approval outside this file using a dated, attributable decision artifact that references the Phase 27 commit and decision IDs O27-01 through O27-09. Approval to prepare Phase 28 is not approval to connect to or change production, create users, deploy, push, or merge.

## Scheduling note

After this owner/security review, return to the `gridlygo.com` public-website track for live visual/functional review and remaining fixes before further Dispatch implementation. This packet does not authorize a website change.
