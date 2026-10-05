# DAYTON-INVITE-01-v1 — Invitation origin, sender and delivery

**OWNER_APPROVED GOVERNANCE POLICY — NO REAL ONBOARDING OR DELIVERY AUTHORIZATION.**

Authority: owner instruction “GRIDLY DISPATCH — OWNER GOVERNANCE DECISION: INVITATION ORIGIN / SENDER / DELIVERY POLICY.” Source assessment: Phase 28 invitation implementation inherited by Phase 29, at local HEAD `f958f5ef0330025e450c2f0836404771ca18ad44`. This document supplements historical planning; it does not modify frozen contracts, runtime configuration or prior certification.

## Approved origin and sender

Exact production Dispatch origin: **https://dispatch.gridlygo.com**. Production invitation acceptance, onboarding, verification and related participant flows must use this origin. Root gridlygo.com, www.gridlygo.com, app.gridlygo.com, localhost, arbitrary previews/staging and unapproved redirect origins are prohibited for production participant acceptance. Disposable local certification remains separate and does not authorize production use of localhost.

Visible sender: **dispatch@gridlygo.com**, clearly identifying Dispatch. Approved display name: **Gridly Dispatch**. Personal addresses, developer@gridlygo.com, noreply addresses and unrelated consumer support identities require separate approval before use.

## Resend provider — owner approved

The owner selected **Resend** as the outbound transactional provider, closing the provider portion of DAYTON-INVITE-01-v1. Approved visible sender: **Gridly Dispatch <dispatch@gridlygo.com>**. Approved production origin remains **https://dispatch.gridlygo.com**. Configuration, verification, credentials, real sending and activation remain unauthorized.

Owner-reported inbound state: dispatch@gridlygo.com is active in Cloudflare Email Routing and forwards to the owner inbox. This is owner evidence, not independently verified production state. Cloudflare handles inbound routing; Resend handles outbound invitations/onboarding. No receiving/MX migration is approved.

Require transactional API delivery, verified Gridly sending domain, SPF/DKIM, delivery visibility, bounce and supported complaint handling, environment separation and token-safe delivery audit. Evaluate DMARC separately. Future credentials must be server-side only, environment-specific, scoped to sending/domain where supported, absent from Git/client bundles/logs and rotatable without schema changes. No keys are created or inspected.

### Sending-domain recommendation — not configuration approval

Recommend **A: verify gridlygo.com for sending**, preserving dispatch@gridlygo.com, with a separately approved dedicated Return-Path subdomain for outbound/bounce authentication. Preserve Cloudflare root inbound routing. Return-Path is distinct from visible From and web origin. Future DNS work must use Resend's actual verification records, preserve inbound MX and validate SPF/DKIM/DMARC alignment and record conflicts; no record values are invented. The owner subsequently confirmed gridlygo.com is VERIFIED in Resend and manually added the required Cloudflare DNS records. The earlier recommendation is retained as design history; no additional verification DNS work is identified by this task. No DNS/account state was inspected.

Resend recommends sending subdomains for reputation segmentation. However, verifying only mail.gridlygo.com or dispatch.gridlygo.com is not a basis to assume permission to send as dispatch@gridlygo.com. A separate From subdomain requires owner approval and provider validation. Root verification fits the approved sender and DKIM alignment; a dedicated Return-Path improves operational separation but does not guarantee full reputation isolation. Do not conflate the website hostname with a mail-domain decision.

Sources: [verified domains](https://resend.com/docs/dashboard/domains/introduction), [custom Return-Path](https://resend.com/docs/dashboard/domains/custom-return-path), [scoped API keys](https://resend.com/docs/api-reference/api-keys/create-api-key). This recommendation is a design inference, not a current account verification claim.

### Delivery-event design recommendation

Correlate non-secret invitation ID, attempt ID, provider message/event IDs, event type and timestamps. Require signature verification, event deduplication, replay protection and out-of-order-safe processing. Store bounded status/reason categories, never raw email bodies, invitation URLs/tokens or arbitrary provider errors in application audit. Minimize recipient/contact metadata under DAYTON-RETENTION-01. Assess provider-side message-content/log access and aging before activation: email necessarily contains the secret link. Disable invitation click/open tracking unless separately approved.

Map email.sent to API acceptance; email.delivered to recipient-mail-server acceptance (not reading); email.bounced to permanent failure; email.complained to complaint review; email.failed/API rejection to bounded failure evidence. Also handle delayed/suppressed transport states. Hard bounce/complaint should suppress automated sends pending authorized review; do not bypass provider suppression. Delivery states remain separate from authority: delivery never activates membership, bounce never creates a new invitation, and reissue remains an authorized operator action with atomic old-token invalidation. Idempotent retries must recheck expiry/revocation and must not extend authority. Exact retry/suppression-release rules require implementation review.

Source: [Resend event types](https://resend.com/docs/webhooks/event-types). No webhook, delivery attempt, suppression rule or account setting is configured here.

## URLs and redirects

Production invitation links must resolve to the exact approved origin. Explicit same-origin redirect destinations only, unless separately approved; no wildcard patterns. Arbitrary query-provided return URLs, third-party origins, consumer origins and unverified previews cannot be acceptance destinations. Exact paths/routes are not invented here: approve an explicit route/redirect list before implementation/activation. Validate destinations server-side; origin approval is not permission to configure DNS or Auth settings now.

## Frozen lifecycle and fallback

Preserve the seven-day lifecycle: invitation expiration after seven 24-hour periods; reissue invalidates the prior invitation; single-use identity-bound acceptance; revoked/accepted invitations cannot be accepted again. Authoritative state is server-derived. Never log token material or retain reusable secrets beyond the necessary lifecycle. Terminal minimized evidence follows DAYTON-RETENTION-01, subject to legal/privacy review.

Transactional email is the primary method. Controlled one-time manual copy remains permitted only for recovery/operational fallback, never the default. Require authorized operator action, verified recipient identity before disclosure, one-time token, identical expiry/identity/revocation/reissue rules and minimized operator audit without plaintext secrets. No real token is generated or disclosed by this policy task.

## Invitation content

Identify Gridly Dispatch, inviting organization and department/unit where applicable, recipient identity context, purpose, expiration window, approved origin, support path and a warning not to forward. Do not include capability/reviewer/recovery secrets, sensitive operational content or unnecessary governance detail. The actual support destination, copy/template, routes and fallback runbook must be approved before real sending; no values are invented here.

## Current implementation support matrix

Read-only source comparison, not new runtime certification. SUPPORTED means present in the local database command boundary; it does not claim a deployed web/email flow.

| Requirement | Status | Evidence and gap |
| --- | --- | --- |
| Exact origin allowlist | NOT IMPLEMENTED | `dayton-pilot.json` records DISPATCH_HTTPS_ONLY but approvedExactOrigin is null; no delivery/acceptance web-layer exact-origin enforcement |
| Sender identity configuration | NOT IMPLEMENTED | No implemented Dispatch sender/template/domain-verification configuration |
| Provider abstraction | NOT IMPLEMENTED | TRANSACTIONAL_EMAIL is a planning identifier, not an adapter, event pipeline or sandbox boundary |
| Resend implementation | NOT IMPLEMENTED | No Resend sender, credential boundary or domain-verification integration |
| Delivery-event correlation | NOT IMPLEMENTED | No correlation ledger or verified/deduplicated webhook |
| Bounce/complaint state | NOT IMPLEMENTED | No transport suppression/review state separate from invitation authority |
| Seven-day expiry | PARTIAL | `pilot_command` permits supplied expiry between now + 1 second and now + 7 days; acceptance refuses expired state. No authoritative exact seven-24-hour issuance default; frozen maximum must remain intact |
| Reissue invalidation | PARTIAL | Explicit revoke command exists; no atomic revoke-and-reissue command/delivery workflow. Issuing another invitation alone does not invalidate an old one |
| Single-use acceptance | SUPPORTED | `accept_invitation` atomically requires PENDING, unexpired, matching authenticated user identity and token digest, then sets ACCEPTED; terminal acceptance refused. Authorized idempotent receipt replay does not create a second membership |
| Controlled manual-copy fallback | PARTIAL | Policy/runbook permits fallback and digest-only acceptance exists; no implemented audited one-time disclosure channel or recipient-verification workflow |
| Redirect allowlist | NOT IMPLEMENTED | No implemented route/return-URL allowlist or server redirect validator in the inherited invitation command package |
| Audit without token leakage | PARTIAL | Database stores token digests/request hashes and bounded result/audit evidence rather than raw invitation secrets; email/provider/web/operator logs and disclosure handling have no implemented end-to-end controls |

Source references: `docs/RESPONDER/RESPONDER-PHASE27-OWNER-DECISION-PACKET.md` O27-05; `docs/RESPONDER/PHASE28-ONBOARDING-RUNBOOK.md`; `tools/responder/phase28/dayton-pilot.json`; `tools/responder/phase28/package.local.sql` (`organization_invitations`, `invite_member`, `accept_invitation`, `revoke_invitation`, `pilot_command`, receipt/audit boundaries); `tools/responder/phase28/closure-runtime.test.mjs` terminal invitation denial coverage. Historical null configuration is preserved; this new governance artifact is authoritative for the newly approved origin/sender.

## Activation boundary and stop

Origin, sender identity, Resend selection, provider requirements, redirect constraints and fallback policy are approved. Provider configuration, DNS changes, sender authentication, production secrets, real invitations/email and participant activation are not approved by this decision.

**STOP BEFORE RUNTIME IMPLEMENTATION.** Gaps require separately authorized delivery/web integration and focused certification: exact-origin/same-origin route validation; sender/provider adapter and verified domain; exact issuance deadline; atomic reissue; controlled fallback; safe templates/support route; secret-safe delivery/error/bounce/operator audit and lifecycle cleanup. No runtime/schema/configuration changes, network visit to the Dispatch origin, DNS inspection, production connection or real invitation/email are performed. Other governance decisions may continue; real onboarding remains blocked.

## Owner-confirmed sending-domain verification and pre-runtime status

DAYTON-INVITE-01-v1: **Resend provider OWNER_APPROVED; sending domain gridlygo.com VERIFIED**. Authority: owner confirmation in the task titled Record verified Resend domain + commit invitation provider decision. Verification is recorded from the owner, without independent account or DNS inspection. The owner manually added the Cloudflare DNS records required for Resend verification.

Approved visible sender: **Gridly Dispatch <dispatch@gridlygo.com>**. Approved Dispatch origin: **https://dispatch.gridlygo.com**.

Cloudflare remains authoritative DNS and handles inbound Email Routing for dispatch@gridlygo.com to the owner inbox. Resend is the outbound transactional provider with verified gridlygo.com sending domain. Resend does not handle inbound Dispatch mail under this decision; Cloudflare is not the transactional invitation sender.

Real Resend API credentials are **NOT YET CREATED / CONFIGURED**. Real invitation sending is **NOT YET ENABLED**. The following remain NOT YET IMPLEMENTED / NOT YET ACTIVE as complete delivery controls (existing partial database primitives remain as documented above):

- Server-side, environment-specific Resend credential configuration.
- Resend delivery adapter.
- Exact-origin validation and explicit redirect allowlist.
- Atomic invitation reissue with prior-token invalidation.
- Delivery-event correlation and verified, deduplicated webhook handling.
- Bounce/complaint suppression state and authorized release rules.
- Controlled manual-copy disclosure and audit workflow.
- Real invitation sending.

Domain verification closes the sending-domain verification governance prerequisite; it is not runtime certification or permission to send. Safe to proceed to separately authorized invitation-delivery runtime implementation, preserving frozen security controls and requiring local/disposable certification. No API key, webhook, email, invitation, DNS/Email Routing change, production access or activation is performed by this documentation task.

## DAYTON-HOSTING-01-v1 — Local Worker integration plan

**OWNER_APPROVED ARCHITECTURE; LOCAL HOSTING CODE NOT YET IMPLEMENTED; NO PRODUCTION RESOURCE AUTHORIZATION.**

The owner approved dedicated Cloudflare Worker gridly-dispatch-delivery-production (proposed name), dedicated Dispatch Supabase Database/Auth, TLS Cloudflare Hyperdrive with query caching DISABLED and Cloudflare Worker Secrets. Current locally certified invitation adapter: 89ea4e648f18f9c2794e4ce4388aa4c5300a1b42. Earlier NOT IMPLEMENTED assessments above describe the historical pre-adapter state; hosting, real network transport, credentials and live routes remain inactive.

### Exact proposed local components

These paths are proposed for the next separately authorized implementation; none is created here.

| Proposed path | Responsibility |
| --- | --- |
| tools/responder/phase29/worker/index.mjs | Exact HTTP host/path/method, bounded streaming body, verification and safe responses |
| tools/responder/phase29/worker/config.mjs | Private environment binding, sender/origin/path validation, signing-secret decoding, disabled-send gate |
| tools/responder/phase29/worker/resend-transport.mjs | Fixed Resend endpoint, server credential, attempt idempotency, bounded response/error mapping; no blind ambiguous-send retry |
| tools/responder/phase29/worker/delivery-repository.mjs | Fixed parameterized claim/result/event calls with transaction-local role |
| tools/responder/phase29/worker/wrangler.jsonc | Pinned compatibility date/nodejs_compat, narrow route, isolated environments, secret names and placeholder Hyperdrive binding; no values |
| tools/responder/phase29/worker/package.json and package-lock.json | Isolated pinned Worker tooling/database driver/test dependencies; no consumer package edits |
| tools/responder/phase29/worker/README.md | Local workflow, rotation, isolation and later deployment gates |
| tools/responder/phase29/worker/database-principal.local.sql | Disposable-only narrow login/role rehearsal; no embedded password or production installation authority |
| tests/responder-phase29-worker-hosting.test.mjs | Actual local Worker-runtime HTTP/config/crypto/transport/logging tests |
| tools/responder/phase29/worker/database-principal.runtime.test.mjs | Disposable privilege, transaction/role reset and refusal tests |
| reports/responder/responder-phase29-worker-hosting.json | New local evidence; do not overwrite historical reports |

Existing invitation-delivery.mjs needs explicit node:buffer import and actual Worker compatibility certification. Preserve lifecycle and frozen command semantics. Reuse the guarded disposable TEMP/Docker certification harness; never run Supabase CLI from this repository or touch supabase/.temp/cli-latest. Any runner extension must preserve its local-only guards. No production forward migration is supplied by this plan.

### Dedicated Dispatch Supabase prerequisites

Purpose: isolated Dispatch database and identity/session/MFA authority. Separate local/disposable, staging and production environments; no consumer project, identities, service credentials or runtime bindings. No tests against production.

Verify pgcrypto, the baseline extensions-qualified UUID/digest functions, auth.users, auth.sessions and auth.mfa_factors, and PostgreSQL/Auth compatibility. No speculative new extensions. Preserve forced RLS, exact grants, sole postgres Auth bridge, NOLOGIN command owner, invoker identity/session helpers and fresh TOTP/AAL2. Expose only reviewed participant RPCs through the Data API; private/audit/candidate schemas remain inaccessible to browser roles. Delivery uses direct restricted PostgreSQL commands, not service_role.

Operator commands use dedicated-project identity-bound sessions and live membership/permission checks. TOTP must be available. Actual Auth signup policy, approved redirects, Auth mail configuration, recovery staff and participant provisioning require separate owner setup approval; transport credentials have no Auth administration.

Baseline installation is a prerequisite. Phase 26/28/29, reviewer alignment and invitation packages have disposable markers/install dependencies. Do not apply local-only packages remotely. A separately reviewed deployment-safe baseline/forward migration with exact privileges and compatibility/refusal tests is required before remote installation.

Backups must support DAYTON-RETENTION-01-v1: restricted access, bounded aging, and restore-time reapplication of holds/remediation/disposition. Approve project region/plan, RPO/RTO, recovery owners, backup/PITR selection and restore rehearsal before activation. Exact schedules remain owner/legal decisions; existing retention execution gaps remain open. Dedicated-project isolation is not retention compliance.

### Hyperdrive and narrow database bootstrap

Dedicated delivery Hyperdrive configuration per environment; proposed binding DISPATCH_DELIVERY_DB. Dedicated Dispatch origin database only, TLS with certificate verification, parameterized fixed calls, query caching explicitly DISABLED, no authorization/suppression/session caching. Store the origin credential in Hyperdrive configuration, never Git/client code. Select a Supabase endpoint supporting the custom login; direct/pooler behavior must be certified, not assumed. Bound concurrency/timeouts based on later capacity evidence.

Proposed login: dispatch_delivery_connection, LOGIN, NOINHERIT, NOBYPASSRLS, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION. Permit dedicated database CONNECT and only explicit assumption of dispatch_delivery_transport, without role administration/inheritance. Check effective PUBLIC privileges too: no schema/database CREATE or unrelated privileged function authority. If this cannot be isolated without weakening frozen controls, STOP.

Keep dispatch_delivery_transport NOLOGIN/NOINHERIT/NOBYPASSRLS with only private-schema usage and existing invitation_claim_send(uuid) and invitation_transport_result(jsonb) EXECUTE. BEGIN; SET LOCAL ROLE dispatch_delivery_transport; parameterized fixed call; COMMIT or ROLLBACK. No session-persistent role/identity state in pooled connections. Test resets after success/refusal/reuse. No command-owner membership, broad table access, service_role or additional Auth bridge.

Issuance/reissue/manual disclosure remain a distinct authenticated operator path with existing identity/TOTP/live checks. The transport login cannot issue invitations. Recipient resolution and operator HTTP bindings require separate narrow design review; no broad Auth service credential is implied.

### Exact secret/config bindings

Proposed destination: Cloudflare Dashboard > Workers & Pages > gridly-dispatch-delivery-production > Settings > Variables and Secrets > Secret. Resource does not yet exist; staging has separate secrets/bindings.

| Binding/config | Classification | Value/boundary |
| --- | --- | --- |
| GRIDLY_DISPATCH_RESEND_API_KEY | SECRET | Dedicated environment-specific Sending access key restricted to gridlygo.com; not created |
| GRIDLY_DISPATCH_RESEND_WEBHOOK_SECRET | SECRET | Provider signing material decoded server-side; not created |
| DISPATCH_DELIVERY_DB | PRIVATE SERVER BINDING | TLS cache-disabled Hyperdrive; narrow credential stored in its configuration |
| GRIDLY_DISPATCH_EMAIL_FROM | NON-SECRET CONFIG | Gridly Dispatch <dispatch@gridlygo.com> |
| GRIDLY_DISPATCH_ORIGIN | NON-SECRET CONFIG | https://dispatch.gridlygo.com |
| GRIDLY_DISPATCH_PROVIDER_ENVIRONMENT | NON-SECRET CONFIG | Explicit PRODUCTION for eventual real integration; TEST continues to forbid real credentials/non-.invalid recipients |
| GRIDLY_DISPATCH_INVITATION_SENDING_ENABLED | NON-SECRET CONFIG | false; refuse issuance, reissue and manual disclosure while disabled |
| GRIDLY_DISPATCH_WEBHOOK_URL | NON-SECRET CONFIG | https://dispatch.gridlygo.com/api/resend/webhook |
| GRIDLY_DISPATCH_INVITATION_TEMPLATE_VERSION | NON-SECRET CONFIG | Actual template/version requires approval; no invented production value |
| acceptPath, supportPath, redirectPaths | NON-SECRET CONFIG | Exact approved same-origin paths remain unresolved; synthetic paths are not production approval |

Names beyond the two approved secrets are proposed bindings. Display name is part of From; no separate region secret is needed. Region/endpoints are infrastructure metadata. Rotation uses replacement provider material, controlled Worker versions, verification, then old-material retirement; never accept caller-supplied verification keys. Ordinary wrangler secret put deploys immediately, so later operations require controlled deployment approval. No secrets in chat/Git/logs/responses/builds/client bundles.

### Webhook HTTP contract

POST only, exact HTTPS host dispatch.gridlygo.com, exact /api/resend/webhook path; no query string, alternate host or unrelated path ownership. Proposed responses: 404 unmatched host/path; 405 with Allow: POST wrong method; 415 unsupported content type/encoding; 413 oversized body; 400 malformed structure; 401 invalid/missing/stale signature; 409 conflicting duplicate; 503 missing configuration, unknown correlation or retryable database failure. Fixed bounded bodies, Cache-Control: no-store, no reflected provider/database errors or credentialed browser CORS.

Require application/json with supported UTF-8 parameter; refuse unsupported Content-Encoding. Stream at most 65,536 raw bytes; Content-Length alone is insufficient. Preserve bytes, reject malformed UTF-8 rather than silently replacing it, and verify Svix ID/timestamp/signature with decoded server-held secret before JSON/event processing. Preserve five-minute timestamp bounds and constant-time HMAC. Webhook authentication is provider signature; it requires no participant JWT. Operator routes retain participant authentication and are outside this narrow route approval.

Allow email.sent, email.delivered, email.bounced, email.complained, email.delivery_delayed, email.failed, email.suppressed. No invented email.rejected. Only normalized non-secret event/message IDs, status and timestamp reach the database. Return 204 only after durable success or an identical committed duplicate. Unknown correlation triggers bounded retry; never fabricate state. Preserve deduplication/conflict refusal, adverse precedence and delivery-only suppression; events cannot confer access.

Never log raw request/message bodies, invitation links/tokens, recipient addresses, signature/authorization headers, secrets or database connection strings. Use bounded categories and approved non-secret correlation only. No endpoint caching or automatic consumer forwarding. Proposed HTTP mappings require local tests.

### Local certification and later owner actions

Local: actual Worker crypto/Buffer compatibility; provider secret format; exact routing/method/config; streamed size limits and raw-byte integrity; valid/invalid/stale signatures; safe responses/logging; transport normalization/idempotency; disabled sending. Fake outbound transport only, no real key/email/invitation. Disposable synthetic database tests: effective login privileges, parameterization, transaction-local role resets/pooling, event deduplication/conflicts/unknown correlation, adverse precedence and suppression. Recheck affected invitation tests and Phase 27 continuity. Mocks cannot prove live Cloudflare routing/Hyperdrive/provider connectivity.

Cloudflare owner actions later: approve account/access ownership; create dedicated Worker/environments; create TLS cache-disabled Hyperdrive with narrow credential; inspect hostname/proxy state then configure exact route; enter secrets directly; approve deployment separately. Disable unapproved workers.dev/preview exposure. No broader routes or inbound mail changes.

Supabase owner actions later: approve project/region/plan/admins; create dedicated projects; approve deployment-safe baseline installation and narrow principal provisioning; configure network/Auth/approved redirects/backups and rehearse restore. Retention legal/privacy/execution gates remain before activation. No consumer project work.

Resend owner actions later: after private destination exists, create dedicated domain-restricted Sending access key; after approved endpoint deployment, register exact webhook and seven events; copy signing material directly to Worker Secrets; review provider retention/tracking settings. Never paste secrets into chat. No documented combined no-send key/sender acceptance test; any send-based verification requires separate owner approval.

DNS change requirement is UNDETERMINED until authorized hostname/proxy inspection. A narrow Worker route is required. Sending-domain verification and inbound Email Routing remain unchanged. No production resource, secret, provider configuration, deployment or runtime/schema implementation is performed by this plan.
