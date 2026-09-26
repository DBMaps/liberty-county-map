# LP244.62 — Entitlement server verification foundation

## Decision and source proof

**Local foundation: PASS. Production entitlement service: NO-GO.** This phase implements a draft migration, provider adapters, pure state normalizers, an authenticated-handler composition contract, disabled Edge entrypoints, and synthetic tests. It does not deploy an operational store verifier. Production provider/security prerequisites still prevent composition, so the local commit is `Prepare entitlement server verification foundation`.

- Branch: `LP244.62-entitlement-server-verification-foundation`.
- Starting HEAD: `a986fdf7d16eb778b65016501781ba9725e1f63e`; initial working tree clean.
- Repository: `C:\GitHub\liberty-county-map`.
- Certification date: September 26, 2026.
- No production connection, SQL, migration application, credentials, secret creation, deployment, reporting change, native build, push, or merge occurred.
- Production reporting remains disabled by the inherited owner baseline; this phase did not make a fresh live production query. LP244.54 remains CLOSED/PASS. Old LP244.22 reset/repair must not be replayed.

## 1. Existing backend audit

The starting repository already contained `report_retention`, `moderation`, and `privacy_ops` private schemas. Their migrations use private tables, RLS and revocations, SECURITY DEFINER functions with an empty search path, and narrowly granted public RPCs. LP244.58's health RPC provides the service-role-only pattern, including an explicit function ACL invariant. The API schema configuration exposes `public` and `graphql_public`, not those private schemas.

The existing cleanup Edge Function has a modular handler and custom monitor-token authentication. Its token is an operational monitor credential, unsuitable for consumer native requests and not reused here. Existing reporting replay/submission evidence and moderation/privacy tables are separate systems, not subscription ownership records. Reporting/device linkage must never become subscription identity.

LP244.61/61A supplied isolated client entitlement/proof/recovery contracts in `js/gridly-entitlement.mjs` and `js/gridly-store-verification.mjs`. They were not an operational backend verifier. No existing entitlement table, Apple verifier, Google verifier, provider credential placeholder or consumer account ownership system was found in the audited backend paths. The migration naming follows the existing timestamp/version convention; the new local draft is the eighteenth tracked migration, after the seventeen existing files. That is repository inventory, not fresh production ledger evidence.

## 2. Architecture and authority

Native store evidence → native request admission → independent provider verification/current state → private idempotent cache reconciliation → optional Google acknowledgment → bounded signed LP244.61 proof.

Store ownership remains authoritative. The cache never grants ownership by itself. Reconciliation always starts with fresh store evidence; there is no public lookup by hash, account, device or installation ID. There is no consumer account table or email/password flow.

New source:

- `supabase/functions/_shared/entitlement/core.mjs`: state normalization, trusted-record branding, HMAC references, bounded proof signing.
- `supabase/functions/_shared/entitlement/providers.mjs`: Apple verifier/API adapter and Google REST adapter.
- `supabase/functions/_shared/entitlement/handler.mjs`: bounded request handling and explicit required security/provider/cache/signing ports.
- `supabase/functions/gridly-verify-apple-subscription/index.ts` and `gridly-verify-google-subscription/index.ts`: disabled composition skeletons.

Both entrypoints return HTTP 503 while ports are absent. There is no configuration flag, synthetic credential or client field that enables missing ports. Supabase authentication configuration is unchanged; default JWT behavior is not a completed native admission design. No deployable provider composition or service-role cache transport is claimed.

## 3. Private schema and RPCs

Draft: `supabase/migrations/20260926205345_lp24462_store_entitlement_cache.sql`.

The transaction requires the `postgres` owner and an absent `subscription_ops` schema. It creates one owner-only RLS table, with no client/service-role direct table/schema access. Platform, environment, product/base plan, state consistency, verified dates, fingerprint and error values are constrained. Production and sandbox/test have separate keys. A NULL Google base plan is rejected.

Exact stored metadata:

| Fields | Purpose |
| --- | --- |
| `platform`, `environment` | Isolate Apple/Google and production/`sandbox_test` |
| `chain_fingerprint` | HMAC-SHA256 of platform, environment and provider reference; private idempotence key |
| `product_id`, `base_plan_id` | Fixed monthly product validation |
| `subscription_state`, `entitlement_state` | Current verified normalized decision |
| `current_period_end` | Verified expiry when known; nullable for unknown/pending |
| `last_verified_at`, `verification_source` | Provider observation provenance/freshness |
| `error_category` | Only `none`, `verification_unavailable`, `purchase_pending` |
| `reconciled_at` | Server cache update timestamp |
| `cache_expires_at` | Proposed bounded operational-cache deletion deadline |

`public.gridly_reconcile_store_entitlement(jsonb)` accepts exactly eleven allowlisted record fields, at most 8 KiB, and a recent verification timestamp. It accepts newer provider observations; exact retries succeed without extending TTL; stale or conflicting same-time observations return false. Clients cannot submit this RPC directly. It is not itself a store verifier: the trusted service composition must call it only after provider validation.

`public.gridly_prune_store_entitlement_cache(integer DEFAULT 500)` deletes only expired cache entries, at most 500 per call, using an expiry index and a fixed statement timestamp. It returns only the removed count. No Cron job is installed. One expiry index plus the primary-key index are added only in the draft/local fixture.

Both RPCs are SECURITY DEFINER, owned by postgres, with empty search paths. EXECUTE ACLs are limited to owner and service_role; PUBLIC, anon, authenticated and unexpected explicit grantees cause the migration postcheck to fail. Service_role cannot delegate EXECUTE. Table ACL postcheck rejects every non-owner grantee. Unrelated roles, default privileges and existing production grants are not altered.

## 4. Apple verification

Input uses the LP244.61A request contract: `platform`, `environment`, `nonce`, fixed `productId`, and `evidence.signedTransactions`. This foundation accepts exactly one bounded signed transaction per reconciliation. Empty/multiple evidence fails unavailable rather than asserting lack of ownership. Unknown request fields are rejected.

The adapter requires Apple's `SignedDataVerifier.verifyAndDecodeTransaction`, then `AppStoreServerAPIClient.getAllSubscriptionStatuses(originalTransactionId)`, then independent verification of current signed transaction and signed renewal information. Bundle, product, type, environment, original chain and renewal identity are checked. Revocation denies access; verified expiry denies; cancellation before expiry stays entitled until the verified deadline. Grace never grants launch access.

**Decision:** local validation of a historical JWS alone is insufficient for current launch reconciliation. Current server status is also required. A legitimately signed old transaction must not conceal later cancellation/revocation.

The actual Apple library, trusted Apple roots, online certificate checks, production numeric appAppleId, runtime compatibility and credentials are not installed/composed or certified here. Tests inject synthetic verifier/API ports; they prove the required call order and refusal on verifier errors, not real Apple certificate-chain verification. Before production, use the official library with environment, bundleId and appAppleId correctly fixed, verify both production and sandbox paths, and certify the chosen exact dependency/runtime in the Edge environment.

References: [Apple server library](https://github.com/apple/app-store-server-library-node), [API client](https://apple.github.io/app-store-server-library-node/classes/AppStoreServerAPIClient.html), [current subscription statuses](https://developer.apple.com/documentation/AppStoreServerAPI/Get-All-Subscription-Statuses).

## 5. Google verification and acknowledgment

Input adds fixed `basePlanId: monthly` and `evidence.purchaseTokens`. The server fixes package `com.gridlygo.gridly`, product `gridly_monthly`, and base plan `monthly`. It calls **purchases.subscriptionsv2.get**, not deprecated purchases.subscriptions.get. The URL and package are server constants, redirects are refused, requests have an eight-second timeout, and provider JSON is limited to 64 KiB. OAuth is an injected trusted server callback, not native input.

The result must have the fixed line item/base plan, US region, appropriate test marker/environment and recognized acknowledgment/state values. Unexpected offers or linked replacement tokens fail closed; replacement-chain support requires later review. Expired/on-hold/paused states deny; pending/grace states are unknown and deny; canceled future-expiry purchases remain entitled only until expiry.

The backend explicitly owns acknowledgment: after successful verified cache reconciliation, pending entitled purchases call the distinct `purchases.subscriptions.acknowledge` POST with `{}`. A failure produces no signed access response. Production must add durable/reliable acknowledgment retry and monitoring within Google's deadline. The privacy-minimal hash cache cannot reconstruct a token to retry autonomously. Native retry alone is not yet a certified launch guarantee. No Google service-account credentials, OAuth signer or Play configuration is created.

References: [subscriptionsv2.get](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get), [response contract](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2), [acknowledge](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge), [billing security](https://developer.android.com/google/play/billing/security).

## 6. Native API/security contract

POST-only requests have no query string, bounded JSON body and strict contract fields. Unauthenticated requests cannot reach provider verification. The mandatory `authorizeNative` port must validate app/device attestation, a fresh server challenge bound to nonce/environment/body digest, replay consumption and rate limits. It must not introduce a consumer login or make installation identity ownership. These controls are requirements; their production implementation is outstanding. An anon API key, Origin header or possession of an arbitrary receipt is insufficient admission authority.

Provider-normalized records are branded in-process; generic JSON cannot be signed or converted to a cache write. Errors return fixed categories, never provider bodies or tokens. The signed ES256 P-256 response contains only the existing LP244.61 fields, nonce/audience and a lease at most five minutes, capped at verified entitlement expiry. No raw provider reference is returned. Signing-key distribution/rotation remains a separate security prerequisite.

The handler's fifteen-second timeout denies late access responses. Production ports must additionally implement cancellation/bounded writes: an already-running cache call can complete after response timeout; this skeleton does not claim cancellation of downstream work. No raw request/URL/body logging is permitted in future provider telemetry, especially Google's token-bearing provider URL.

## 7. Reinstall and reconciliation

Apple: fresh StoreKit evidence → independent signed validation + current server status → new verified proof.

Google: fresh BillingClient purchase query → current purchase token → subscriptionsv2.get → acknowledgment if needed → new verified proof.

Synthetic tests repeat these paths without old installation IDs, profiles or consumer accounts. This proves the server recovery contract only; StoreKit/BillingClient native wiring and real device restore remain downstream. The HMAC key must be server-held, domain-separated as implemented, and managed consistently. Its rotation may invalidate/delist caches, but fresh store proof still establishes ownership.

## 8. Privacy and bounded retention

Raw JWS, original transaction IDs and purchase tokens exist transiently during provider calls. Only the keyed fingerprint and listed metadata are persisted. No full card data, email, consumer account, device/install identifier, report data or raw provider payload is stored or returned. Hashes remain private pseudonymous purchase references, not anonymous data.

The proposed cache TTL is **24 hours from last verification**, independent of subscription duration. Exact replay does not refresh it; new current provider verification does. This is a proposed operational-cache policy requiring owner review before production, not a newly approved reporting retention rule. Records become due for deletion at expiry; TTL alone does not physically delete them. A separately authorized bounded purge runner, overdue monitoring and a maximum deletion lag must be in place before production application. Under load, 500-per-call capacity and rate/admission limits must demonstrably keep backlog bounded.

This table is not a financial ledger and retains no indefinite fraud/accounting history. Apple/Google hold their own billing records. Required accounting/support records, provider notifications and any token persistence for acknowledgment retry require a separate purpose/retention review before implementation. No report-device joins or changes to existing community-report retention/deletion rules occur. A valid store proof can support a future targeted cache deletion operation; none is exposed here. Without a proof the cache has no consumer email/account lookup. Expired cache entries are physically removed, not retained in an audit trail.

## 9. Certification

Command:

```powershell
$env:GRIDLY_LP24462_LOCAL_DB_TEST='1'
node --test tests/lp24461-subscription-entitlement.test.mjs tests/lp24461a-store-owned-recovery.test.mjs tests/lp24462-server-verification.test.mjs tests/lp24462-entitlement-db.test.cjs
Remove-Item Env:\GRIDLY_LP24462_LOCAL_DB_TEST
```

**33 passed, 0 failed, 0 skipped**, including 15 new server/database tests. PostgreSQL 17 disposable fixture used only `127.0.0.1:55462`, synthetic roles/data and a uniquely named database; each test run drops its own database. It did not use Supabase production. The fixture has trust authentication only on loopback and is stopped after certification.

Certified: clean migration application; private/RLS table access; exact RPC ACLs; forbidden fields; idempotent TTL; stale/conflict denial; nullable base-plan/period rejection; environment separation; active/expired/canceled/unknown states; bounded prune; verifier-error redaction; fixed provider URLs; signed client interoperability; restored proof without install/account identity; disabled default entrypoints. A synthetic reporting sentinel stays false/protocol 2. This is not a fresh live production-state assertion.

No native acceptance, network store verification or production service test was run. No package/lock/native/UI/onboarding/config file changed. Bounded source secret scan and `git diff --check` passed before commit. Database tests require explicit opt-in and never accept production connection settings.

## 10. Exact prerequisites and next work

Before any production deployment or migration, obtain separate owner approval for exact schema/RPCs, cache retention and cleanup operation; verify current ledger/schema/grants; provision native admission/challenge/replay/rate-limit implementation; compose restricted service RPC transport and environment-bound proof signing; review request logs and downstream cancellation.

Apple needs owner-managed key ID, issuer ID, private signing key, appAppleId, Apple roots and official verifier/client runtime composition. Google needs a narrowly authorized Play Developer API service identity and server OAuth lifecycle, real product/base-plan configuration, acknowledgment retry/health strategy and replacement-token policy. Server proof-signing and HMAC keys are separate credentials. No credential values should be supplied in Codex or committed.

Proposed downstream allocation (planning only; not new authorization): LP244.63 Apple native purchase/restore and real provider certification; LP244.64 Google purchase/restore, acknowledgment/replacement handling and real provider certification; LP244.65 runtime paid gating, web denial and end-to-end launch certification. Their actual scope requires owner direction. Public access must not launch from this skeleton.

**NO-GO for production entitlement/paid launch.** Local foundation certification does not enable reporting, store billing, consumer access or deployment. Launch remains $2.99/month through Apple/Google, 18+, no trials/annual/grace/direct checkout; paid runtime enforcement and real store verification remain outstanding.
