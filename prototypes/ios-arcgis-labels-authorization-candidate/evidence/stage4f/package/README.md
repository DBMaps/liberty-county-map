# Isolated first-party labels interface — Stage 4F

Local implementation only. No listener, environment/secret lookup, default HTTP transport, database connector, production deployment or migration is supplied.

This additive package is retained under evidence/stage4f/package so the sealed Stage 4D package, its 196-entry manifest, workflow and native hashes remain byte-identical. It is executable candidate code, not historical hosted certification. Its separate source inventory must be included explicitly in any later reviewed publication/certification.

## Entry points

- authority.mjs: createLabelsAuthority(options) → async Request → Response.
- client.mjs: createAuthorityClient(options) → issueChallenge / authorize.
- gateway.mjs: createFirstPartyGateway(options) → issueChallenge / issueLease / requestTile.
- existing-apple.mjs: existingAppleProviderFactory(options) → a request-scoped existing Apple Node provider.
- contract.mjs: bounded canonical wire/authentication helpers. No Apple or tile cryptography is reimplemented.

Exact proposed first-party route: **POST /internal/v1/labels/verify** on one operator-pinned HTTPS origin. The client requires a single approvedAuthorities entry equal to authorityOrigin; no request field selects an endpoint. The authority rejects every other full URL, query, slash or method. Any future host/router must preserve this canonical endpoint; no production hostname has been selected.

## Server-owned configuration and ports

Both sides receive authorityOrigin, approvedAuthorities, labelOrigin and two distinct 32-byte labels-only HMAC keys: requestKey and responseKey. These are injected dependencies; local tests use explicit synthetic bytes. No production signing key was selected or created. Both request and reply include fixed identities, purpose, environments and gateway origin, with separate request/response MAC domains. Project/service-role/Apple private keys are never gateway configuration.

The authority additionally requires:

- registry.issue/read/consume wired through the **unchanged** labels RPC ports and the existing authoritative registry, never a copied counter.
- fingerprintKey and createProvider supplied inside the existing approved Apple verifier environment. The provider must return the existing normalizer's private branded result.
- replay.claim({namespace,id,expiresAt,signal}): atomic, bounded, durable and shared by all instances. Claim must reject duplicates/unavailable state. The test memory implementation is not a deployable replay store.
- isEnabled, default false. Local concurrency defaults to two active labels operations (hard configurable maximum four); configure a separately capped labels connector pool and deployment-wide caller/rate/replica limits before hosting. Do not share an unlimited pool with subscription refresh.

The client requires an injected HTTPS transport and independent atomic/shared response replay store. It has no default fetch and a two-operation concurrency limit. A missing configuration or replay dependency stays closed.

The gateway wrapper requires existing shared lease/quota/replay state, pending-challenge methods, a verified client and explicit config.enabled. It wraps the unchanged createLabelsGateway. Paired paid/attest decisions are closure-local per lease, branded and frozen by the validated client; plain verified=true objects are not accepted. Provider egress defaults off and requires the existing explicit Esri enable/transport/credentials gates.

## Wire contract

The packet is {body,mac}; MAC is HMAC-SHA256 over a versioned labels-only direction domain plus recursively key-sorted JSON. The body carries version, issuer, audience, purpose, appId, attestAppId, independent store/attest environments, pinned label origin, random requestId, issuedAt, expiresAt, operation and payload.

Fixed policy:

- App: com.gridlygo.gridly.
- App Attest identity: 2XSH6R7K37.com.gridlygo.gridly.
- StoreKit: sandbox; App Attest: production.
- Purpose: gridly-labels-lease-v1.
- Caller: gridly-labels-consumer-pilot-v1; issuer: gridly-labels-authority-v1.

Operations:

1. challenge: payload {id,input:{keyId,spki,paidEvidenceHash}}. The gateway generates id; the existing strict challenge issuer verifies inputs and requires an existing production key. The authority creates the short-lived challenge in the authoritative labels schema.
2. authorize: payload {challengeId,paidEvidence,attestEvidence,spki}. The service recomputes canonical binding, verifies the existing-key assertion, atomically consumes the challenge/advances the existing counter, then independently verifies paid ownership using the unchanged paid adapter.

The authenticated response binds requestId and the canonical request digest, an independently random responseId, issuer/audience/policy/origin, operation and a short expiry. Authorization result contains only labels_decision, challengeId, canonical binding, tile fingerprint, exact paid-evidence digest, and the existing bounded attest/paid decisions. No raw assertion counter/public SPKI record, purchase transaction/renewal record, provider bearer, entitlement signing key or subscription entitlement proof is returned.

Request maximum 52 KiB; response maximum 4 KiB. Exact schema checks reject extra/missing fields, wrong identities/environments/purposes and forged client flags. The strict underlying authorizers enforce the challenge's two-minute life and the paid eligibility rules. Replies are no-store; failures are fixed 503 JSON with freshEvidenceRequired, without underlying errors.

## Timing and commit behavior

Maximum transport/request decision lifetime is five seconds; default whole client/service budget is 4,500 ms, with 10…4,500 ms configurable local budgets. There are no automatic retries. This fits inside the existing default six-second gateway budget without extending native deadlines.

existingAppleProviderFactory wraps the existing Apple Node adapter's fetch port with the caller signal and its existing 11-second signal; the shorter current request wins. The service/client race uncooperative ports against the deadline, return sanitized failure, and retain their occupied slots until work actually settles. This bounds admission concurrency but does not claim a hostile or broken driver can be forcibly undone.

A committed assertion is never rewound/refunded. Cancellation, lost COMMIT acknowledgment, failed paid verification or late gateway state commit requires fresh evidence. A late/unknown local gateway commit can leave an unusable expiring lease; neither a late success nor a stale decision is exposed. The wrapper rechecks cancellation and decision expiry **after** the existing gateway returns.

Real HTTP disconnect propagation, TLS, DB driver cancellation, actual Apple latency and aggregate deployment limits are still unverified. A genuine operation that cannot fit fails closed. Changing budgets or deployment capacity requires a separate reviewed change.

## Hosting dependency — no deployment authorized

1. Prove deployed verifier source/import and Apple Node provenance; retain existing subscription handlers, registration, entitlement proof and paid reporting entrypoints unchanged.
2. Separately approve/apply unchanged labels SQL in the authoritative database. Dedicated authority login: no superuser/BYPASSRLS/create-role/database/replication, no table DML, only reviewed SET ROLE membership into labels_auth_verifier. This role has only schema usage and three labels RPC executes. No service_role credential in the gateway.
3. Host the new route beside the existing approved verifier trust boundary. Add only an inert host composition/router invoking these modules; do not repurpose the public subscription challenge or verification endpoint. Supply the existing Apple provider factory/configuration only there.
4. Provision dedicated labels-only request/response service trust and durable replay persistence after approval. Scope the caller to the isolated gateway, restrict ingress, and ensure deployments/replicas share replay and aggregate rate/capacity enforcement.
5. HTTPS must verify CA/hostname, pin origins, reject redirects, enforce body limits and explicit deadlines. Actual DB connector must have verified TLS and reviewed network restrictions, bounded connections/statements/locks, and destroy uncertain sessions. Existing role/transaction ports remain unchanged.
6. The isolated gateway host must retain the certified Edge handler's ingress authentication, bounded body parsing, pending-challenge, throttling, emergency-disable and fixed public route controls. This package exposes no listening/public handler and is not a ready-to-deploy Edge bundle. Route composition must dispatch to this wrapper without bypassing those controls; certify that exact host adapter before deployment.
7. Prove coordinate/evidence/header/DB-bind logging privacy on actual hosts with harmless canaries, review log/error/metric/export retention and access, and confirm account costs/direct invocation exposure. Application modules here log nothing.
8. Disable by closing the first-party route, disabling the gateway/control/provider flags, cancelling native work and withdrawing only new labels role/service access. Preserve all subscription grants and committed counters. Rollback removes/reverts only the new host/config/labels additions after draining; never restore a counter snapshot.
9. Genuine owner-device production App Attest + sandbox StoreKit evidence and current paid verification remain required. No initial registration redesign or entitlement proof change.
10. Esri remains separate: dedicated server-held OAuth, current Static Basemap Tiles access/terms/attribution/relay/caching/retention approval, bounded usage/cost and one approved genuine tile test. No Esri credential or bearer reaches the phone. No provider contact occurred.

## Local evidence and release limits

78 interface tests passed under a preload that blocks fetch/TCP/TLS/HTTP network entry points. Three additional tests ran the HTTP interface against actual unchanged SQL and the same persisted synthetic App Attest key as the unchanged subscription authorizer. Existing regressions: 19 candidate, 114 protected subscription/security, 39 gateway passes with one optional benchmark skip, and 25 PostgreSQL passes. Total: 278 pass, 0 fail, 1 skip.

Historical CryptoKit/Node vector reverified; no new Swift/rendering/simulator or physical-device certification occurred. All tests use synthetic evidence/transports. Local PASS does not prove genuine Apple/Esri authorization, deployment privacy, full consumer integration or release readiness.

