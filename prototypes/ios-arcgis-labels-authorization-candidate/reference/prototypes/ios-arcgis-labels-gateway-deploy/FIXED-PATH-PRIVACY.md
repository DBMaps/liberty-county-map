# Stage 3E.1: fixed-path tile privacy

The old pilot used `GET /v1/imagery-labels/{level}/{row}/{column}`. The first-party proxy forwarded the path to Supabase, where the invocation path may be retained. The new candidate accepts only `POST /v1/imagery-labels/tile`; the managed invocation uses the same fixed suffix. There is no old-route fallback. Lease and challenge routes are unchanged.

## Wire format

- Exactly `Content-Type: application/json`, no content encoding, body at most 64 bytes, strict UTF-8. The only accepted representation is `{"level":12,"row":1689,"column":968}` with the corresponding numeric values. Field order, quoting and punctuation are fixed. No whitespace, BOM, duplicate keys, extra fields, escaping, fractional notation, leading zeroes, signs, or query string. Level 0–19; row and column each in `[0, 2^level)`.
- Sign the UTF-8 bytes of the compact JSON array below. The digest is unpadded base64url SHA-256 of the **exact** canonical body bytes. No client-supplied digest header is needed. The signature is raw 64-byte P1363 ECDSA P-256/SHA-256, encoded as unpadded base64url. Lease, timestamp, request ID and signature headers are unchanged.

```text
["gridly-labels-pilot-v1","gridly-labels-tile-body-v1","POST",origin+"/v1/imagery-labels/tile",bodyDigest,leaseId,unixMilliseconds,requestUUID]
```

The origin is the configured HTTPS public origin, never a forwarded header or the platform URL. The server checks the exact method and target, validates the body before proof and quota reservation, recomputes the digest, verifies the signature, and uses that same parsed body to form the fixed Esri tile path. The new proof domain rejects old GET signatures. The DB replay key stays `(lease, request UUID)` regardless of body. There are no SQL or certified foundation changes.

## Native parity

`native-fixed-path/` contains the isolated Swift outbound request builder and shared fixture. A later integration replaces only outbound URL/body/proof construction inside the existing HTTPS transport and retains its pinned origin, lease and challenge handling, PilotHTTP limits, status handling, PNG validation, and cancellation. The local WebKit custom scheme remains GET and Leaflet's lifecycle stays unchanged.

Before live use, on macOS run `swift test --package-path native-fixed-path`: confirm the Swift encoder matches the checked-in canonical bytes, CryptoKit verifies the Node-generated P1363 proof, and altered coordinates fail. Then feed a fresh **Swift-generated** signature and public SPKI into Node/Deno verification, including a negative altered-body case, and run the isolated iOS simulator transport test (local GET → fixed POST → verified fixture PNG, cancellation, style transitions and error handling). Neither macOS nor iOS parity is certified by this Windows run.

The Stage 3E.2 workflow prepares the simulator project from hash-verified copies in runner temporary storage. Its URLProtocol intercepts all native HTTP requests, verifies the signed POST in CryptoKit, and returns only locally rendered synthetic label tiles. Separately, the Swift XCTest exports a fresh public vector so Node and Deno can exercise the real Edge handler with a synthetic lease and transport. The WebKit screenshot and the two gateway acceptance checks are separate evidence; no simulator request reaches Supabase or Esri.

## Data and logs

| Surface | Expected exposure |
| --- | --- |
| Native local WebKit request | Coordinates remain in the local custom scheme. No remote gateway URL or query contains coordinates. |
| First-party ingress and managed Edge URL | Fixed path for accepted traffic. Exact raw-target allowlist at the proxy; access logging off. Do not add request-body logging, tracing or raw error logs. Arbitrary rejected direct URLs can still be logged by the platform. |
| Request body and signature | TLS carries canonical coordinates in the body. The proof binds their hash. Treat body, hash, proof headers, lease IDs and ingress credential as private. |
| Errors and application telemetry | Fixed error codes; aggregate outcome and latency buckets only. No raw exception text, body, URL or identifiers are emitted by the gateway. |
| Esri | The upstream service still receives coordinates in its fixed tile path and the server bearer token in its Authorization header. Gridly does not control Esri access logs or retention. |

Supabase's [invocation logging documentation](https://supabase.com/docs/guides/functions/logging#what-invocation-logs-contain) states that function invocation logs retain paths and selected headers, but not bodies, Authorization, or custom headers. This does not certify API gateway, ingress, network, exception, trace, or export behavior. In one separately authorized synthetic run, verify fixed URLs and look for distinct sentinel body, proof/header, and exception markers in every relevant log source, including error paths. Stop if any sensitive marker is recorded.

Direct platform invocations cannot obtain a lease or tile without the private ingress header; checks precede body parsing and DB work. Even an authenticated ingress caller faces the signed lease and durable replay, quota, concurrency, and disable checks. Public platform requests can still consume invocation and logging budgets before rejection. Confirm provider-side abuse controls, limits and billing separately. Do not turn on genuine verifiers or provider credentials for hosted privacy testing.
