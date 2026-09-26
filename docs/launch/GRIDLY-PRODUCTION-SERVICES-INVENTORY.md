# Gridly production services inventory

## Authority and maintenance

Initial inventory date: **2026-09-26**. Repository main reference: `5851ebad09882f82fe53b47b2da6bb201c8e5821`. Prepared on `LP244.59-production-services-inventory` from that exact HEAD with a clean initial working tree.

This is the authoritative service inventory, based on tracked implementation, LP244.55–LP244.58 operator documentation and the owner's LP244.59 resource statements. It is documentation only, not a fresh production audit. Recorded runtime observations below come from LP244.58's final closure; owner-confirmed provider evidence is distinguished from independent observations. Unknown account, capacity, billing and recovery details are marked **OWNER VERIFICATION NEEDED**.

Update this inventory whenever Gridly adds/removes a production external service or materially changes a critical resource/account. Record the date, source commit, evidence provenance and changed resources. Never copy credential values into an update.

## 1. Supabase

| Field | Inventory |
|---|---|
| Production purpose | Production PostgreSQL, reporting admission/protocol, retention and compliance cleanup, private cleanup health evidence and authenticated health Edge endpoint. |
| Launch criticality | Launch-critical; operationally critical after launch. Reporting activation remains separately gated. |
| Owner/account | Production project **Gridly Platform**, ref `nhwhkbkludzkuyxmkkcj`, recorded region `us-east-1`. Account owner/organization and administrator coverage: **OWNER VERIFICATION NEEDED**. |
| Free/paid tier | **OWNER VERIFICATION NEEDED**; no plan or paid backup entitlement established here. |
| Critical resources | Edge `gridly-cleanup-health`; RPC `public.gridly_cleanup_alert_health()`; private `report_retention.health` and `moderation.cleanup_health`; Cron `gridly-community-report-retention` and `gridly-community-compliance-cleanup`. Both existing jobs run `* * * * *`, invoking `report_retention.run_cleanup()` and `moderation.run_compliance_cleanup()` respectively. |
| Domains | `nhwhkbkludzkuyxmkkcj.supabase.co`; health path `/functions/v1/gridly-cleanup-health`. |
| Secret/environment names | `GRIDLY_MONITOR_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`; non-secret configuration `SUPABASE_URL`. Service-role credential stays inside Supabase, never in the Worker. |
| Credential storage | Provider secret stores and owner password manager are authoritative where applicable; actual recovery custody/access: **OWNER VERIFICATION NEEDED**. |
| Runtime/deployment | Managed Supabase PostgreSQL/Cron and Edge Functions. Recorded health Edge ACTIVE version 4. JWT verification is disabled for this function; handler authenticates the dedicated `X-Gridly-Monitor-Token` header. Empty POST, fixed no-argument RPC; direct database monitor login is rejected. |
| Dependents | Gridly production data/reporting contracts, cleanup jobs, Cloudflare health monitor; geocoding Edge is also tracked in source (see section 5). |
| Unavailable behavior | Production data and health endpoint may be unavailable; Worker classifies failed health retrieval as `monitor_error`. Cleanup execution and stored freshness must be verified after recovery. No inference that an outage enables reporting. |
| Recovery/operator action | Check project availability, recent job runs and bounded health evidence; verify ledger, admission and guards read-only. Follow recovery runbook for a separately authorized restoration. Never replay historical LP244.22 reset/repair or automatically release reporting. |
| Monitoring/evidence | LP244.58 recorded read-only snapshot `2026-09-26 19:16:28.649748 UTC`: 17 exact migrations each once, newest `20260926021558`; two active cleanup jobs; both healthy with zero overdue/breach/late counts. RPC returns exactly two bounded 11-field rows with zero compliance source scans, EXECUTE restricted to owner `postgres` and `service_role`. Protocol 2, `reporting_enabled=false`, guard consumed/unlaunched. These are recorded observations, not rechecked by LP244.59. |
| Runbooks | [LP244.58 closure](LP24458-OWNER-VISIBLE-CLEANUP-ALERTING.md), [health access review](LP24458-HEALTH-READ-OPERATOR-REVIEW.md), [LP244.57](LP24457-CLEANUP-RETENTION-HEALTH-CLOSURE.md), [recovery](../LEGAL/LP24421-RECOVERY-RUNBOOK.md), [retention](../LEGAL/LP24421-REPORT-RETENTION.md), [deletion](GRIDLY-DATA-DELETION-RUNBOOK.md), [moderation](GRIDLY-UGC-MODERATION-RUNBOOK.md). |
| Renewal/billing | Confirm project subscription, payment continuity, quotas, backup/PITR entitlements and restoration access; no entitlement inferred from project existence. |
| Owner verification needed | Account ownership/admin recovery; tier/payment/quotas; backup/PITR and controlled-copy recovery evidence; log expiry and operator readiness; current live state at the next authorized release checkpoint. |

## 2. Cloudflare

| Field | Inventory |
|---|---|
| Production purpose | Public site resources and domain DNS; separate independent cleanup alert Worker with KV deduplication and once-per-minute supervision. |
| Launch criticality | Production website/DNS launch-critical; cleanup monitor operationally critical after launch and part of accepted LP244.58 launch readiness. Preview is supporting/non-blocking. |
| Owner/account | Owner-confirmed resources; exact Cloudflare account/administrator identity: **OWNER VERIFICATION NEEDED**. |
| Free/paid tier | **OWNER VERIFICATION NEEDED**. |
| Critical resources | Public website `gridly-public`; preview `gridly-preview` (distinct from production alerting); Worker `gridly-cleanup-alert-production`; KV namespace `gridly-cleanup-alert-state`, binding `ALERT_STATE`, recorded namespace ID `b09eb7275e614d1bb44783f11f51125a`. Website resource names are owner-confirmed in LP244.59; exact product type, deployment IDs and routing are **OWNER VERIFICATION NEEDED**. |
| Domains | Owner-confirmed DNS for `gridlygo.com`; `alerts.gridlygo.com` sending-domain records. Domain registrar, registration renewal and exact website/preview routes: **OWNER VERIFICATION NEEDED**. |
| Secret/environment names | Secrets `GRIDLY_MONITOR_TOKEN`, `RESEND_API_KEY`, `DEADMAN_PING_URL`; configuration `EDGE_URL`, `ALERT_FROM`, `ALERT_TO`; KV binding `ALERT_STATE`. |
| Credential storage | Cloudflare Secrets for the three secret values; provider stores/owner password manager authoritative. No Hyperdrive or direct database credential in this Worker. Deployment credential custody: **OWNER VERIFICATION NEEDED**. |
| Runtime/deployment | Source [Worker directory](../../tools/retention/cleanup-alert-worker/), [Wrangler configuration](../../tools/retention/cleanup-alert-worker/wrangler.jsonc). One-minute Cron `* * * * *`; `workers_dev=false`. Recorded active version 13, deployment `7a35ea32-f086-4b1d-a635-3a0628e87217`, 100% rollout. |
| Dependents | Public/domain-dependent services; Worker calls Supabase health Edge, sends owner email through Resend and heartbeats to Healthchecks.io. DNS supplies Resend sending-domain records. |
| Unavailable behavior | Website/DNS issues can affect public access and domain-dependent delivery. Worker outage stops independent health checks and heartbeats; Healthchecks can detect missing heartbeats subject to its availability/configuration. KV failure can affect suppression/recovery bookkeeping. |
| Recovery/operator action | Inspect only the affected resource, deployed version, Cron, binding names and safe execution categories. Restore reviewed configuration/code through separately authorized deployment; verify healthy Edge calls, no healthy email and heartbeat routing. Do not modify public/preview while repairing alert Worker. |
| Monitoring/evidence | LP244.58 ordinary scheduled execution `2026-09-26 19:16:50 UTC` succeeded with configured heartbeat; seven expected bindings and empty KV inventory recorded. Healthy state sends no alert; stale/failed/overdue/monitor_error are supported. Repeated incidents are suppressed for one hour with retry/recovery behavior; KV consistency means best-effort deduplication, not an exactly-once guarantee. |
| Runbooks | [LP244.58 closure](LP24458-OWNER-VISIBLE-CLEANUP-ALERTING.md), [delivery operator review](LP24458-ALERT-DELIVERY-OPERATOR-REVIEW.md), [Worker source](../../tools/retention/cleanup-alert-worker/worker.mjs). |
| Renewal/billing | Confirm Worker/KV usage limits, account payment and DNS/domain renewal custody. DNS hosting does not prove Cloudflare is the registrar. |
| Owner verification needed | Account recovery/admin coverage; subscription/quotas; website/preview product, routes and deployed versions; registrar/renewal; current public/legal publication evidence. |

## 3. Resend

| Field | Inventory |
|---|---|
| Production purpose | Owner-visible cleanup incident and recovery email delivery from the Worker. |
| Launch criticality | Operationally critical after launch; accepted LP244.58 alert-delivery prerequisite. Not the Healthchecks independent delivery path. |
| Owner/account | Owner-controlled service; account owner/administrator identity: **OWNER VERIFICATION NEEDED**. Approved recipient `developer@gridlygo.com` is an operational mailbox, not proof of account identity. |
| Free/paid tier | **OWNER VERIFICATION NEEDED**. |
| Critical resources | Owner-confirmed verified sending domain `alerts.gridlygo.com`; sender `Gridly Alerts <monitor@alerts.gridlygo.com>`; recipient `developer@gridlygo.com`. Exact API key label/scope and account identifiers: **OWNER VERIFICATION NEEDED**. |
| Domains | Sending domain `alerts.gridlygo.com`; Resend delivery API. |
| Secret/environment names | `RESEND_API_KEY`; Worker configuration `ALERT_FROM`, `ALERT_TO`. |
| Credential storage | API key in Cloudflare Secret; values remain in provider stores/owner password manager, never Git. |
| Runtime/deployment | Resend SaaS; delivery adapter executes in Cloudflare cleanup Worker. |
| Dependents | Worker-generated Gridly owner alerts; depends on configured recipient and verified Cloudflare DNS records. Receiving-mailbox provider is **OWNER VERIFICATION NEEDED**. |
| Unavailable behavior | Worker email delivery can fail or be delayed; API acceptance alone does not prove inbox delivery. Healthy execution normally sends no email. Independent dead-man notification uses the separately configured Healthchecks path. |
| Recovery/operator action | Inspect provider status, verified domain, DNS, safe delivery status and recipient mailbox; repair authorized configuration. Preserve retry/dedup state. Never resend synthetic proof automatically or transmit customer data. |
| Monitoring/evidence | LP244.58 owner confirmed one real dated synthetic alert reached the approved inbox. Exact send timestamp/message identifier was not supplied; none is invented. Email adapter restricts output to approved safe health fields; existing closure tests passed. |
| Runbooks | [LP244.58 closure](LP24458-OWNER-VISIBLE-CLEANUP-ALERTING.md), [delivery review](LP24458-ALERT-DELIVERY-OPERATOR-REVIEW.md), [Worker modules](../../tools/retention/cleanup-alert-worker/). |
| Renewal/billing | Confirm subscription, send limits, payment continuity and any domain verification requirements; do not infer a free or paid tier. |
| Owner verification needed | Account/admin recovery; API key scope/custody; tier/quotas/payment; delivery-log retention; inbox provider/recovery and ongoing deliverability. |

## 4. Healthchecks.io

| Field | Inventory |
|---|---|
| Production purpose | Independent heartbeat/dead-man supervision of the cleanup alert Worker, including failure notification to the owner. |
| Launch criticality | Operationally critical after launch; LP244.58 dead-man launch requirement accepted with the limitation below. |
| Owner/account | Owner-created check; account owner/administrator identity: **OWNER VERIFICATION NEEDED**. |
| Free/paid tier | **OWNER VERIFICATION NEEDED**. |
| Critical resources | Named check **Gridly Cleanup Alert Worker**, period **1 minute**, grace **3 minutes**; owner-confirmed failure notification to `developer@gridlygo.com`. Check identifier/integration settings: **OWNER VERIFICATION NEEDED**, without recording its secret Ping URL. |
| Domains | Healthchecks.io service; token-bearing Ping URL deliberately omitted. |
| Secret/environment names | `DEADMAN_PING_URL`. |
| Credential storage | Cloudflare Secret; owner/provider stores authoritative for value and account recovery. Ping URL is a credential. |
| Runtime/deployment | Independent hosted check; Cloudflare scheduled Worker emits heartbeats. |
| Dependents | Owner notification when Worker execution/heartbeat fails. Notification integration and owner mailbox must remain operational. |
| Unavailable behavior | Independent dead-man notification may be unavailable/delayed; successful Worker health checks alone cannot prove this external path is operating. |
| Recovery/operator action | Check provider status and named-check routing, period/grace, integrations and last heartbeat. Verify owner-visible notification through a separately authorized bounded test; do not disclose or copy the Ping URL into logs/docs. |
| Monitoring/evidence | LP244.58 owner confirmed correct routing and active heartbeats; accepted explicit `/fail` produced DOWN and owner-visible failure email. Ordinary scheduled execution with heartbeat succeeded. **The Worker schedule-outage timeout itself was not separately induced during LP244.58.** Independent failure notification was proven; separately induced schedule-outage timeout delivery was not. Owner accepted this limitation and closed LP244.58. |
| Runbooks | [LP244.58 final owner acceptance](LP24458-OWNER-VISIBLE-CLEANUP-ALERTING.md), [delivery operator review](LP24458-ALERT-DELIVERY-OPERATOR-REVIEW.md). |
| Renewal/billing | Confirm check/integration limits, subscription/payment and account recovery; no hosted-service availability guarantee inferred. |
| Owner verification needed | Account/admin recovery; tier/limits/payment; integration custody and recipient continuity; future separately authorized outage test only if needed, without reopening accepted LP244.58. |

## 5. Additional external map/search services evidenced in source

OpenStreetMap public tiles and Nominatim are external runtime services, not general software dependencies. The current application configures a standard tile layer and Nominatim discovery/reverse lookup; the geocoding Edge source defaults to Nominatim. **OWNER VERIFICATION NEEDED** for deployed provider configuration, capacity approval and any production replacement/account. Source defaults do not establish a paid production account or live deployment state.

| Field | Inventory |
|---|---|
| Service name | OpenStreetMap public tile service / Nominatim public geocoding. |
| Production purpose | Basemap tiles and remote address/place discovery where these tracked paths are deployed. |
| Launch criticality | Basemap/search capability is launch-critical; acceptance of these particular public providers at production scale is **OWNER VERIFICATION NEEDED**. |
| Owner/account | Externally operated public services; Gridly-specific managed account not evidenced. |
| Free/paid tier | No paid account/tier established; production usage permission/capacity **OWNER VERIFICATION NEEDED**. |
| Critical resources | Standard tile layer in `js/app.js`; source geocoding Edge `gridly-geocode`. Live Edge deployment/provider selection **OWNER VERIFICATION NEEDED**. |
| Domains | `tile.openstreetmap.org`, `nominatim.openstreetmap.org`. |
| Secret/environment names | Provider configuration `GRIDLY_GEOCODE_PROVIDER`, `GRIDLY_GEOCODE_PROVIDER_URL`, `GRIDLY_GEOCODE_CACHE_NAMESPACE`, `GRIDLY_GEOCODE_USER_AGENT`, `GRIDLY_GEOCODE_ALLOWED_ORIGINS`. No public-provider API key established. |
| Credential storage | Any separately configured provider credentials must use provider/Edge secret stores; none recorded here. |
| Runtime/deployment | Application tile/reverse lookup paths and Supabase geocoding implementation; exact live provider configuration **OWNER VERIFICATION NEEDED**. |
| Dependents | Map display and remote discovery; local saved places/POI seeds may still provide partial search results. |
| Unavailable behavior | Tiles or remote results can fail; available local results do not guarantee complete address search or a full basemap. |
| Recovery/operator action | Verify deployed providers, policy compliance, capacity and fallback behavior before changing provider configuration. Any migration to a managed provider requires separate review/authorization. |
| Monitoring/evidence | Source explicitly flags public tile/geocoder risk and `productionProviderCapacityApproved: false`; this is a source diagnostic, not a newly executed acceptance test. |
| Runbooks/source | [Application](../../js/app.js), [geocoding Edge](../../supabase/functions/gridly-geocode/index.ts). |
| Renewal/billing | Verify intended provider agreements, quotas and any replacement subscription; no account/payment invented. |
| Owner verification needed | Live provider choice/deployment; policy/capacity approval; responsible account if replacing public services; monitoring/recovery ownership. |

Optional authoritative Google geocoding is disabled by default in source; Census fallback is explicitly enabled by configuration. NWS weather feeds are referenced in source. These references do not establish additional owner-operated production accounts. Confirm live configuration before adding them as active account entries. This inventory does not claim Firebase/APNs or a new paid geocoder is deployed.

## Secrets and credential handling

No secret **VALUE** belongs in Git. Ping URLs with embedded tokens, API keys, service-role credentials and `GRIDLY_MONITOR_TOKEN` are secrets. Documentation records secret names only; owner password manager/provider secret stores remain authoritative for values where applicable. No credential-storage product is inferred.

The health alert path transmits only environment, subsystem, health state, UTC timestamps, bounded counts and safe error categories. No report content/IDs, coordinates, user/device identifiers, operation tokens, database credentials or private customer data belong in monitor output or email. Supabase service-role authority stays inside its Edge runtime; Worker has no direct DB access or Hyperdrive. Do not copy raw responses or secret-bearing request headers during recovery.

## Dependency and failure map

| Failure | Affected capability | Operator focus |
|---|---|---|
| Supabase unavailable | Production data/cleanup or Edge health retrieval; Worker may produce `monitor_error` | Project/Edge status, bounded health/job evidence and recovery runbook. |
| Cleanup Worker unavailable | Independent monitor stops; heartbeats eventually stop | Cloudflare Cron/version/bindings; Healthchecks last heartbeat and notification. Timeout test limitation remains explicit. |
| Resend unavailable | Worker-generated email delivery affected | Provider delivery/domain status and retries; independent Healthchecks path is separate. |
| Healthchecks unavailable | Independent dead-man alert path affected | Check availability/routing/integration; Worker health evidence alone is insufficient. |
| Cloudflare DNS unavailable/misconfigured | Public/domain-dependent services may be affected; sending-domain verification/delivery can be affected | Correct zone records, routing and provider status; do not assume immediate failure of every service. |
| KV unavailable/inconsistent | Alert suppression/recovery bookkeeping affected | Binding and bounded state; no exactly-once promise. |
| Owner inbox unavailable | Either email path may not be seen | Receiving provider/access/recovery; API acceptance is insufficient. |
| Public tile/geocoder unavailable | Degraded map/remote discovery on configured paths | Deployed provider/capacity and available local fallback; no blanket availability guarantee. |

## Operational classification and preserved launch gates

| Service/resource | Classification |
|---|---|
| Supabase production platform | Launch-critical and operationally critical after launch. |
| Cloudflare production DNS/public website | Launch-critical. |
| Cloudflare cleanup Worker/KV | Operationally critical after launch; LP244.58 accepted readiness prerequisite. |
| Cloudflare preview | Supporting/non-blocking. |
| Resend owner alerts | Operationally critical after launch; LP244.58 delivery requirement closed. |
| Healthchecks.io dead-man | Operationally critical after launch; LP244.58 closed with documented timeout-test limitation. |
| External basemap/geocoding capability | Launch-critical capability; exact live public-provider suitability/capacity requires owner verification. |

This classification is not a new launch audit or release authorization. **Production reporting remains documented as disabled; activation remains STILL NO-GO** until separately authorized. LP244.58 remains CLOSED/PASS and LP244.54 remains CLOSED/PASS. Old LP244.22 reset/repair must not be replayed.

Existing remaining gates include owner legal/live-policy approval and publication, backup/PITR/recovery/log-expiry/operator readiness and privacy/moderation decisions, final configured candidate/store declarations/review access, and a fresh pre-release checkpoint before owner-only reporting release. See [LP244.55 readiness](LP24455-PRODUCTION-LAUNCH-ACTIVATION-READINESS.md) and [LP244.58 final closure](LP24458-OWNER-VISIBLE-CLEANUP-ALERTING.md). Unknown inventory facts do not silently override those decisions.

## Inventory verification record

Names and recorded runtime facts reconciled against LP244.55–LP244.58, current Worker configuration/implementation, Supabase geocoding source and the owner's LP244.59 statements. Website resource names/DNS and Healthchecks period/grace are owner evidence where independently tracked configuration is not available. Only this document is added; no runtime, infrastructure, credential or production state changed. Before commit: bounded secret-pattern scan, relative document/source link check, single-file scope check and `git diff --check`. No native builds or runtime tests are required for this documentation-only change.
