# Mock labels gateway contract

## Trust and issuance

| Signal | Meaning in the mock |
| --- | --- |
| Deployment environment | The gateway instance chooses `production` or `sandbox`. Both are local simulations. The request and both verified records must match that environment. A lease exists only in its issuing instance. |
| Paid evidence | An opaque synthetic ID resolves through a trusted adapter to a verified, unrevoked paid decision, its verification time, paid-period end, and purchase lineage. A continuity grant alone is ineligible. |
| Native integrity | A separate trusted adapter resolves a synthetic ID to a verified installation, one-time challenge, verification time, paid evidence ID, and SHA-256 fingerprint of the bound P-256 public key in SPKI DER form. This is a simulated verdict. |
| Labels lease | The issuer returns a random UUID, `gridly-labels-gateway-mock-v1` audience, `imagery-labels:read` scope, environment, UTC issue time and UTC expiry. Expiry is the earliest of issuance plus five minutes, paid verification plus five minutes, and paid-period end. |
| Native key | A public Node P-256 key object is bound at issuance. The private key stays with the synthetic caller. A lease ID grants no access by itself. |
| Quota identities | The installation comes from the integrity verdict. The purchase lineage comes from the paid verdict. Client-supplied identities or ordinary Gridly admission proofs cannot authorize a tile. |

The two-minute challenge is consumed synchronously when issuance succeeds. Reissuance requires fresh synthetic evidence. Revoking a lease removes it immediately. If a provider request is already in progress, it remains charged and its image is discarded if the lease is revoked or expired before return. An expired or revoked paid decision cannot mint a lease. The mock learns of changes through the verifier port at issuance or an explicit lease revocation. It has no subscription event feed.

## Tile and proof

Accept only `GET /v1/imagery-labels/{level}/{row}/{column}` in raw origin form. The fixed signed origin is `https://labels.mock.invalid` and is never contacted. Absolute targets, percent encoding, fragments, query parameters, dot segments, and caller-selected upstreams are rejected. Levels are canonical decimal 0–19 and each row and column is in `[0, 2^level)`.

The in-process request passes authorization fields separately from the target. Sign the UTF-8 JSON array `[audience, method, absoluteTarget, leaseId, timestamp, requestId]` with ECDSA P-256/SHA-256 in IEEE P1363 form and encode the 64-byte signature as canonical base64url. Timestamps use UTC milliseconds with ±30 seconds of allowed skew. A lowercase UUIDv4 request ID is unique within the lease. The gateway records the ID synchronously with a successful provider reservation. Requests refused before reservation cannot return tile data. Each accepted replay ID is retained for the lifetime of its lease. This wire format is specific to the mock. A production transport needs a reviewed proof-of-possession standard and transport-level authority validation before normalizing paths.

## Usage and failure

- Per UTC day, allow 500 attempts per verified installation, 1,000 per verified purchase lineage, and 10,000 total. Each actual provider attempt consumes quota, including failures, timeouts, and cancellations after dispatch. A caller retry is a new signed request with a new ID and a new reservation. The gateway makes one provider call per admitted request.
- Apply a separate rolling ingress limit of 60 authenticated requests per minute per installation, including requests later refused by the provider budget or concurrency limits. Cap active provider calls at four per installation and 64 globally. Return `429` before calling the provider when a limit is reached. Malformed requests, invalid signatures and already-consumed replay IDs cannot spend an installation's ingress budget.
- State capacity is bounded. Expired leases, challenges, and idle ingress entries are swept on subsequent calls. Daily counters reset on reservation for the next UTC day. Clock regression and exhausted state fail closed. Atomicity is limited to one JavaScript event loop. A production implementation needs shared atomic replay, budget, and concurrency controls plus ingress limits for unauthenticated traffic.
- A timeout or cancellation returns promptly and signals the provider. The active slot remains occupied until the provider settles. Invalid, oversized, redirected, or failed upstream results produce a generic error. PNG validation is bounded to 512 KiB compressed and the expected 512 × 512 scanlines, with chunk, CRC, and filter checks for this fixture's RGBA format. Broader provider PNG compatibility requires separate verification.
- Each admitted request receives its own provider result and buffer. The gateway has no tile cache or cross-request coalescing. It emits no logs and returns no raw provider details, private keys, purchase records, or integrity evidence. The labels layer can fail independently of World Imagery.

## Production dependencies

A later integration needs actual StoreKit verification, App Attest and a labels-specific challenge purpose, explicit app and store environment policy, durable lease revocation and quotas, and an authenticated HTTPS endpoint. TestFlight's app-attestation and store environments must be validated independently before allowing a sandbox purchase to use any nonproduction endpoint. A real Esri adapter must keep dedicated OAuth credentials and bearer tokens server-side, use a fixed upstream with redirects disabled, bound the stream before buffering, and retain required Esri and data-provider attribution. Verify the applicable provider terms, single-user response and cache restrictions, rate limits, and account billing before live integration.
