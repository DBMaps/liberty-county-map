# Stage 3E hosting readiness

Review date: 2026-11-13. Local certification only. No remote target was selected, provisioned, or deployed.

## Platform and cost

Use a dedicated disposable Supabase project, one small first-party HTTPS ingress, and an owner-managed budget. Start with the smallest available Postgres compute; one canary worker/region where enforceable, 2 DB connections per isolate, 24 connections at the ingress and 32 active Edge requests per isolate. Confirm total worker/DB connection ceilings and headroom for maintenance before enabling anything. The Edge concurrency knob is per isolate; 64 global tile reservations are a DB rule, not a limit on Edge invocations.

| Item | Finding |
| --- | --- |
| Edge runtime | Deno locally. The managed platform documents 256 MB per worker, 2 s CPU per request, 150 s idle timeout and 150/400 s free/paid worker lifetime. Bundle limits: 20 MB local CLI bundling, 5 MB server-side. Managed runtime version and account-specific concurrency or request-size ceiling are **UNVERIFIED**. Enforce 48 KiB and a 6 s application deadline independently. Ingress socket timeouts are inactivity limits, not absolute time limits; choose a host or load balancer with a hard request deadline and verify it. |
| Billing | The managed function URL may be invoked directly; rejected calls can still incur invocation/log costs. The ingress and application cannot put a hard ceiling on those charges. Confirm upstream abuse protection and organization-level usage restrictions before enabling public traffic. Supabase currently documents 500,000 included Free and 2 million Pro invocations, with Pro overage at $2 per million. Egress, compute, ingress hosting and observability are separate. At the provisional 10,000/day and hard 512 KiB cap, successful tile payload alone can approach 4.88 GiB/day before overhead. |
| Project limits | Confirm dedicated project quota, residency, free/paid plan eligibility, spend cap, egress budget, storage and log retention before selection. Pro spend cap covers listed usage such as invocations and egress; it does not cap compute, add-ons, or ingress costs. No authenticated account facts were checked. |
| Database | Apply the two drafts in order as isolated migration owner, leave the schema out of Data API exposure, keep runtime on its limited login role, and use the isolated direct endpoint with the project's CA and hostname verification. Direct connections generally require IPv6; verify IPv6 and TLS from actual Edge. No pooler or weaker TLS fallback is configured. |
| Deployment | Require explicit isolated project ref and matching Supabase runtime URL. Keep both enable flags off and Apple ports unwired. The config uses platform `verify_jwt=false` only for this function; the trusted ingress header is verified in code. A normal Supabase gateway or custom domain alone does not establish pre-normalization route checks, customer-specific rate limits, or suppression of URL logs. |

References: [Edge limits](https://supabase.com/docs/guides/functions/limits), [invocations](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations), [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [spend cap](https://supabase.com/docs/guides/platform/cost-control), [connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres), [TLS](https://supabase.com/docs/guides/platform/ssl-enforcement), [pricing and retention](https://supabase.com/pricing).

## Ingress and privacy gates

Run the ingress outside managed Supabase; the Nginx example is a starting point. One named HTTPS host, pinned upstream, no client-controlled upstream, no redirects/retries/caching, 48 KiB body limit, per-source and aggregate throttles, TLS verification and an allowlist of forwarded headers. The function independently validates exact tile coordinates and caps the response at 512 KiB (or a lower configured delivery cap). Platform-generated error bodies and the ingress absolute deadline still need hosted checks. Use network admission to permit only the named synthetic tester during the trial. Do not treat an origin or Referer as native identity.

Stage 3E.1 replaces the coordinate-bearing URL with a fixed POST path; see [the privacy boundary](FIXED-PATH-PRIVACY.md). Verify actual invocation, API gateway and proxy log sources with distinct synthetic sentinels. Keep access logs and tracing off, and retain only aggregates. Budget and monitoring controls must cover direct function invocations separately.

## Genuine authorization handoff

- Apple paid evidence: `tools/apple-store-verifier-node/verifier.mjs:verifyStore`, `supabase/functions/_shared/entitlement/providers.mjs:appleAdapter` / `appleEnvironmentAdapter`, and `core.mjs` purchase normalization. Adapt the verified sandbox transaction/status result to the labels port, checking Apple trust chain, app/bundle and product IDs, current paid period, revocation and opaque purchase lineage. For any signed wrapper, pin the issuer and labels audience and verify expiry and native binding explicitly. Existing signed entitlement responses and continuity grants are not accepted as labels leases or as standalone eligibility.
- App Attest: `apple-app-attest.mjs:createAppleAppAttestVerifier().verify({authorization,digest,environment,readKey})` plus the atomic counter/challenge behavior modeled by `native-authorization.mjs:createNativeAuthorizer` and `native-rpc-ports.mjs:nativeAuthorizationRpcPorts`. The existing verifier pins the production Gridly app identity and the existing RPC uses production-oriented service-role ports. Stage D must explicitly pin the isolated app identity and labels digest, provide isolated key/counter persistence, and use no production RPC or service-role credential. Production App Attest and sandbox StoreKit are independently selected; neither substitutes for the other. No verified install/key binding, genuine issuer/audience check, or Apple eligibility integration is claimed for the unconfigured entrypoint.

## Operations

Use the isolated migration owner or a separately approved monitor; no public metrics endpoint. Public `/health` only indicates process reachability.

```sql
-- Run through a verify-full connection to the explicitly approved database.
select current_database(), current_user, 1 as database_ok;
select ssl from pg_stat_ssl where pid = pg_backend_pid();
select enabled, utc_day, attempts, oauth_count, ingress_count from label_pilot.control;
select count(*) as reserved_slots from label_pilot.active;
select utc_day, counters from label_pilot.telemetry;
```

`attempts` counts quota reservations, not charges. The bounded UTC-day telemetry records tile/OAuth dispatch **intent**, authorization denials, quota exhaustion, provider errors/timeouts and coarse latency buckets; it cannot prove provider receipt. Early proxy/edge rejects are outside the DB metrics; compare with aggregate ingress and platform counts. A platform termination may drop best-effort outcomes. A failing token refresh uses only a still-valid cached token for transient failures; otherwise labels fail closed.

**Abandoned worker:** close ingress, disable provider and pilot flags, run `select label_pilot.pilot_disable();`, and fence outbound access. Verify the prior revision cannot start work and all old workers and outstanding provider calls have stopped. Only then, as migration owner, run `select label_pilot.recover_after_drain();`. It refuses enabled state or any unrevoked lease and removes only concurrency slots. There is no age-based reclaim, attempt refund, or replay reset. If quiescence cannot be proven, keep the pilot off. Roll back to the previously reviewed disabled function, verify denial, rotate isolated credentials if exposed, and obtain separate approval before reopening. If retiring the pilot, delete the isolated function and secrets, ingress/DNS and project under separately approved teardown; retain only approved aggregates.

## Proposed hosted acceptance â€” do not execute under Stage 3E

1. Record the exact new project ref, owner, region, expiry, ingress host, and budget. Use no existing Gridly project. From the package root run `node verify-sources.mjs`. Review `supabase --version` and `supabase functions deploy --help` first; v3 is local by default. After separate approval, explicitly target the isolated project: `supabase functions deploy gridly-labels --remote="$PILOT_REF"` (for a pinned v2 CLI, use the documented `--project-ref "$PILOT_REF"` instead). No linking or implicit remote target. Apply the two ordered drafts via `psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261113000100_labels_foundation.sql -f supabase/migrations/20261113000200_labels_edge_state.sql`, using a separately verified `PGHOST=db.$PILOT_REF.supabase.co`, `PGSSLMODE=verify-full`, `PGSSLROOTCERT`, and protected login. Stop on the first error.
2. Render the ingress privately; run `nginx -t -c "$PILOT_NGINX_CONFIG"`. Keep real flags false, leave provider secret names unset, restrict source to the test client, and use public certificate validation. Use `curl --silent --show-error --max-time 8 --path-as-is --output /dev/null --write-out '%{http_code}\n' "$PILOT_ORIGIN/health"` (200), POST the unsigned fixed tile (503 when unwired), and repeat with GET, query string, encoded slash, a legacy coordinate path, dot segment and foreign Host (rejected). No insecure TLS flag or redirect following.
3. Stage C uses a separately reviewed, temporary canary entrypoint on that same isolated project. Wire the existing runtime to synthetic verifier ports and an in-process fixed PNG transport, with **no external fetch** or actual Esri credential. The tested synthetic path is demonstrated by `GRIDLY_LABELS_LOCAL_BENCH=1 node --test edge.test.mjs`; the hosted canary artifact and client driver require a separate review before publication. Keep the real entrypoint unwired; do not add a runtime switch that selects test admission. Limit the canary to one named source, two synthetic users, ten minutes and 20 reservations; cap installation concurrency at one. Use the private aggregate SQL above to compare results, before and after the run.
4. Canary client sequence: issue distinct challenges and leases for two fresh P-256 keys; send the canonical coordinate body and sign the [fixed POST proof](FIXED-PATH-PRIVACY.md) with raw 64-byte P1363 signature. Expect 201 for each valid synthetic lease, 200 and exact fixture SHA-256 with `no-store` for a valid tile, 401 for a modified signature, the other key, or duplicate proof, and 429 for the losing request in a concurrent one-slot race. Verify one debit for one dispatch reservation and no response sharing. Send a fake Authorization marker, custom-header marker, body marker and sentinel coordinate; compare all log sources. Verify TLS rejection with a wrong trust root, direct URL denial without ingress proof, provider-disabled denial, and no external DNS or provider traffic in monitoring. A coordinate or body marker in any log blocks genuine activation even if all synthetic flow checks pass.
5. Close ingress, disable both switches and the DB, verify zero new outbound work, remove the canary revision, and record only aggregate results. Any unanticipated response or log exposure stops the run; no automatic repeat.

## Separate owner approvals

| Stage | Approve only this action |
| --- | --- |
| A | Select/provision a dedicated nonproduction project and approve region, ingress and resource budget. |
| B | Deploy the reviewed disabled function and restricted synthetic acceptance controls. |
| C | Run one bounded hosted test for HTTPS, database, logging, and kill switch; tear down the canary. |
| D | Integrate genuine Apple eligibility and App Attest in isolation and verify identity, audience, counter and revocation. |
| E | Confirm Esri relay and attribution/caching terms, dedicated Static Basemap Tiles OAuth scope and bearer support, then approve one metered live tile trial. |
| F | Integrate the verified service into isolated iOS Build 19 source. |
| G | Build/sign as separately approved and test on a physical iPhone through TestFlight. |
| H | Authorize public release independently after device and store review. |

Stage 3E changes neither Build 18's labels behavior nor the November 30 risk for older original-key installs.
