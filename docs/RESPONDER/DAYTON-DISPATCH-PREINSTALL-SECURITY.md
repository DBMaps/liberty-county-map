# Dayton Dispatch pre-install security and owner-action packet

Decision: **DAYTON-PREINSTALL-01-v1**. Target: Gridly Dispatch, DBMaps, `cmrrvwgkgjhmdugzhnrh`, us-east-1, Micro. Starting implementation: d75850f574edf1a9ddf063e1526bd7bc20735349. This packet prepares local work only. No remote changes are authorized in this task.

## Owner-applied settings — VERIFIED LIVE

OWNER_APPROVED: open signup OFF; anonymous auth OFF; Site URL https://dispatch.gridlygo.com; Data API ON; automatic table exposure OFF; automatic RLS OFF; mandatory SSL ON without reducing TLS 1.2 minimum; no PITR purchase now; restore rehearsal before activation. Owner accepts daily backups with 7-day retention for empty setup/initial pilot preparation. Exact backup/log retention remains to be independently verified. This is neither legal/privacy approval nor completed retention execution.

## Exact redirect allowlist — OWNER_APPROVED, VERIFIED LIVE

Owner-approved Supabase Auth redirect allowlist (two entries only):

- https://dispatch.gridlygo.com/auth/callback
- https://dispatch.gridlygo.com/auth/recovery

These are approved Auth configuration entries. The frontend endpoints are not yet implemented and are not approved Worker routes. `/auth/callback` completes PKCE sign-in and any Auth identity confirmation. `/auth/recovery` receives recovery confirmation; it must enforce the recovery session before password update. No wildcard, root-domain consumer URL, localhost, arbitrary `next`, or preview origin is allowed. Treat redirect routing separately from the approved webhook-only Worker route.

The current Dispatch invitation token is an application invitation, not a Supabase Auth signup link. Propose `/invitations/accept` for its server-bound invitation validation and completion in the same flow; it is an application link, not another Supabase Auth redirect. Invitation completion and TOTP enrollment/verification use authenticated application state and require no extra Auth redirect. Preserve any pending invitation in server-side bounded state across `/auth/callback`; never forward the invitation token through arbitrary return URLs. Use the existing Dispatch support email for manual support; no additional support redirect is needed. The two Auth allowlist entries are approved for manual dashboard configuration; route implementation and workflow certification remain prerequisites before participant activation. The proposed application invitation path still requires separate route approval and implementation. New Auth-user provisioning remains a separately governed prerequisite with signup disabled; the delivery principal cannot administer Auth.

## Session/password settings — OWNER_APPROVED, VERIFIED LIVE

- JWT expiry: 900 seconds (15 minutes), verified live.
- Maximum session lifetime: 12 hours.
- Inactivity timeout: 1 hour — OWNER_APPROVED PLATFORM VARIANCE. The originally proposed 30-minute value is unavailable in the current hosted Supabase configuration; the owner approves the supported one-hour value, superseding 30 minutes for DAYTON-PREINSTALL-01-v1. This is based on refresh activity rather than guaranteed UI inactivity.
- Single-session enforcement: ON, individual accounts only.
- Refresh-token replay detection: ON; reuse interval: 10 seconds.
- Leaked-password protection: ON; minimum password length: 14 characters; no extra character-class requirement proposed.
- Secure password change: ON; require current password on normal authenticated password changes: ON. Certify the dedicated recovery-session exception before activation.
- Email confirmation: ON. Secure email change: ON. TOTP enrollment/verification: ON. SMS MFA: OFF. AAL1 MFA duration restriction: ON (15 minutes).

The owner approves the listed expiry, session, replay, password-change, password-length, leaked-password and email-confirmation values; TOTP and the current reviewed AAL1 posture remain unchanged. SMS and additional password character classes are not newly authorized by this decision. Supabase applies session limits on refresh, so a remaining JWT can extend observed cutoff by its lifetime; UI inactivity is not the same as refresh inactivity. Preserve the frozen live-session/permission checks and application fresh-step-up controls independently: transfer TOTP <=10 minutes; EACH recovery approver TOTP <=5 minutes. Do not change the frozen bridge or claim that dashboard timeouts replace these checks. If stricter immediate session cutoff is desired, review separately rather than silently weakening or changing the bridge.

Sources: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [password security](https://supabase.com/docs/guides/auth/password-security). Approved settings require workflow testing with the approved participant frontend before activation.

## Network policy — OWNER_APPROVED DEFERRAL

Do not apply IP/network restrictions yet. The owner explicitly defers restrictions until Hyperdrive connectivity requirements, Cloudflare egress behavior and owner/admin/recovery access requirements are verified and finalized. This is not approval for unrestricted networking after activation. No owner/admin/recovery source CIDRs are supplied, so there is no concrete safe allowlist to apply yet. Keep authenticated direct owner database access temporarily available for installation/rehearsal, require certificate-verified TLS, and keep credentials outside reports/Git.

Later, permit the selected Hyperdrive connection's documented Cloudflare egress ranges plus explicit owner/admin and recovery CIDRs (both IPv4/IPv6 as applicable), then exercise connection, recovery and role-reset behavior before removing unrestricted access. Supabase restrictions can coexist with Hyperdrive provided the actual egress is allowed. Cloudflare ranges are shared infrastructure, not a unique Worker identity: narrow database credentials remain necessary. Do not guess a single stable Worker IP. Direct endpoint IPv6/Hyperdrive/custom-role support must be proven before choosing the endpoint; no consumer binding. Query caching stays DISABLED. No Tunnel/VPC/add-on purchase is proposed here.

Source: [Hyperdrive firewall/networking](https://developers.cloudflare.com/hyperdrive/configuration/firewall-and-networking-configuration/).

## Exact configuration/installation order

1. Separate authorization; reconfirm dedicated project identity/emptiness and recovery access.
2. Disable signup; retain anonymous OFF. Enable mandatory SSL with certificate verification.
3. The owner may manually set the approved Site URL and exact redirect entries. Route readiness remains an activation prerequisite. Never substitute synthetic paths.
4. The owner may manually apply the approved session/password values; retain TOTP and email confirmation. Record actual settings evidence without secrets.
5. Verify Data API ON, automatic exposure OFF, automatic RLS OFF; approve only `dispatch_api` as the Dispatch surface. Do not expose private/audit/projection source tables. Evaluate removing unused public/graphql_public exposure in the same separately approved packet.
6. Run deployment-safe baseline A–F atomically via verified dedicated connection. No participants or publishing grants.
7. Validate postflight and capacity; provision the delivery password separately through a secret-safe owner procedure. Missing password means the installed login remains unusable for real transport.
8. Approve/configure Hyperdrive and Worker separately, with caching disabled, narrow transport role, sending disabled.
9. Restore rehearsal, legal/privacy retention review/execution gates, participant/reviewer training, authority/scope/grants and operational sign-off before onboarding. Onboarding remains Police → Fire/EMS → Public Works.

## Owner-action checklist

Redirect and session/password values and the candidate installer are OWNER_APPROVED under GRIDLY DISPATCH — APPROVE PRE-INSTALL SETTINGS + COMMIT DEPLOYMENT-SAFE INSTALLER. The owner applied the approved dashboard settings; fresh readback passed. This recording/commit task makes no remote changes. Approve later API exposure and exact network CIDRs; verify actual 7-day backup/log retention and RPO/RTO; identify recovery administrators; review candidate installer and its source locks, object/ACL inventory, refusal and rollback evidence. Real baseline installation requires a separate explicit authorization. Restore rehearsal must reapply holds/remediation/disposition under an approved policy; existing DAYTON-RETENTION-01-v1 execution gaps remain OPEN. No participant activation, public publication or delivery is authorized by this packet.
## Candidate installer approval and certification

The deployment-safe installer is OWNER_APPROVED as the candidate for the empty dedicated Dispatch project; remote baseline installation remains separately authorized and is not permitted by this task. Recorded local certification: 57 static PASS, 15 installer runtime PASS, 15 reporting/reviewer/invitation runtime PASS, 10 delivery-principal runtime PASS; 97 total PASS / 0 FAIL and 329 runtime assertion groups. Security postflight, empty rollback/reapply, evidence-bearing destructive rollback refusal, Phase 27/29 continuity and DAYTON-REVIEW-01 / DAYTON-INVITE-01 passed. DAYTON-RETENTION-01-v1 legal/execution gaps remain OPEN. Certification evidence retains its original assessment-time metadata; this owner decision supersedes its pending-approval labels without changing test results.

### Verified fresh pre-install readback — owner confirmation

Authority: GRIDLY DISPATCH — RECORD VERIFIED PRE-INSTALL SETTINGS + PLATFORM VARIANCE; reference: the preceding FRESH PRE-INSTALL READBACK AFTER OWNER DASHBOARD CONFIGURATION report, confirmed by the owner. Gridly Dispatch (`cmrrvwgkgjhmdugzhnrh`) is ACTIVE_HEALTHY, us-east-1 / North Virginia, Micro, and still empty: no Dispatch schemas/roles, application users/migrations/data or Storage application buckets.

Verified: signup OFF; anonymous auth OFF; confirm email, secure email change, secure password change, current-password requirement and leaked-password protection ON; minimum password length 14; TOTP enabled; SMS MFA disabled; AAL1 restriction ON / 15 minutes; single-session ON; maximum lifetime 12 hours; refresh replay detection ON / reuse interval 10 seconds; access-token expiry 900 seconds. Site URL https://dispatch.gridlygo.com with exactly https://dispatch.gridlygo.com/auth/callback and https://dispatch.gridlygo.com/auth/recovery; no wildcard, localhost or consumer redirects. Mandatory SSL ON, minimum TLS 1.2; Data API ON, automatic table exposure OFF, automatic RLS OFF; PITR OFF; network restrictions intentionally deferred.

Inactivity timeout is verified at **1 hour — OWNER_APPROVED PLATFORM VARIANCE**: the current hosted Supabase configuration does not offer the originally proposed 30 minutes. The owner-approved supported value supersedes that earlier value for DAYTON-PREINSTALL-01-v1. JWT expiry is already 900 seconds; no JWT alignment or signing-key change is needed. Daily backups are active and a physical backup was observed; exact retention duration remains independently unverified.

Readback result: **A. READY FOR BASELINE INSTALLATION**, only after separate explicit installation authorization and fresh installer target/preflight checks. No baseline is installed. Route/workflow readiness, restore rehearsal, retention legal/execution gaps and other participant-activation gates remain open. Networking deferral is not approval for unrestricted networking after activation. This documentation task does not reconnect to or modify the real project.
