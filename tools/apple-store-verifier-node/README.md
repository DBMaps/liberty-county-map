# LP244.66S AWS Node Apple verifier

This package is a **public certificate capability probe only**. It contains Apple's published test certificates and a synthetic JWS with a deliberately invalid signature. It contains no Gridly transaction, Apple private key, shared token, or production verifier. It cannot create a paid proof. The Lambda handler accepts only a direct `Invoke` event `{ "probe": "lp24466s_public_chain" }`; do not configure a Function URL or API Gateway for this probe.

Target runtime: AWS Lambda `nodejs24.x`, `x86_64`, no custom VPC. Handler: `preflight.handler`. Package `@apple/app-store-server-library` exactly `3.1.0` with `npm ci --ignore-scripts`. Invoke with the exact event above. Capture only the bounded boolean result, AWS function ARN/version, runtime, and package hash. Do not log or export certificate material or response bodies.

`pass=true` requires all of: library boot, Node X.509 raw access and chain signatures, Apple's `enableOnlineChecks=true` public-chain verification including both OCSP responses, denial of malformed/bad-chain/bad-signature synthetic JWS, and HTTP-level reachability of Apple's Production and Sandbox App Store Server API hosts. The API reachability checks expect an unauthenticated 4xx; they do **not** certify provider credentials or an ownership transaction.

The owner ran the public probe in AWS Lambda `nodejs24.x` in `us-east-1` and reported `pass=true` with all nine capability booleans true, including online OCSP and both Apple API hosts. The owner-reported function is `gridly-apple-store-verifier` version 1. This workspace has no AWS CLI or authenticated AWS session, so AWS source parity remains to be inspected independently before production promotion.

For AWS deployment, use an existing Lambda execution role trusted for `lambda.amazonaws.com` and a scoped operator identity that can create and invoke only `gridly-apple-store-verifier` in the selected region. Minimum operations for a new function with an existing role are `lambda:CreateFunction`, `lambda:GetFunction`, `lambda:GetFunctionConfiguration`, `lambda:InvokeFunction`, and `iam:PassRole` restricted to that role and Lambda. If the name already exists, inspect it before changing anything. No public invocation policy, Function URL, VPC, Apple credentials, or Supabase mutation is needed for this preflight.

## Prepared production promotion

`verifier.mjs` uses the pinned Apple library with `enableOnlineChecks=true`, the three public Apple PKI roots checked against fixed SHA-256 hashes, strict Production/Sandbox verifier instances, and `AppStoreServerAPIClient.getAllSubscriptionStatuses`. It verifies the original StoreKit JWS, then the current transaction and signed renewal from Apple's current status response. Bundle, product, environment, original transaction reference, expiry, renewal and status are checked before a bounded result is signed. The handler accepts POST `/` only, bounds the request, checks `x-gridly-apple-node-token` before touching store evidence, and returns only a canonical HMAC-authenticated result or fixed error code. It has no evidence or credential logging.

The production ZIP is `.artifacts/lp24466s-aws-node-verifier.zip`. Its handler is `verifier.handler`. It needs these six Lambda environment variables, all set by the owner through a secure interface without putting values in a command line, log, repository file, or assistant message:

- `GRIDLY_APPLE_ISSUER_ID`
- `GRIDLY_APPLE_KEY_ID`
- `GRIDLY_APPLE_PRIVATE_KEY_P8`
- `GRIDLY_APPLE_APP_ID`
- `GRIDLY_APPLE_NODE_INTERNAL_TOKEN` (fresh, at least 32 random bytes encoded as URL-safe base64)
- `GRIDLY_APPLE_NODE_RESPONSE_HMAC_KEY` (fresh 32 random bytes encoded as standard base64)

The last two values must be entered identically into the Supabase production secrets of the same names. Supabase also needs `GRIDLY_APPLE_NODE_URL`, set to the exact HTTPS Function URL. Existing App Attest/challenge/cache/proof secrets remain in Supabase; the new production Apple path reads the Apple API credential from Lambda. Any preexisting Supabase Apple credential secret remains untouched until separately reviewed cleanup. The public PKI roots are packaged in the ZIP and are not secrets.

Promotion order: inspect Lambda version 1 and current configuration; upload the production ZIP to the same function; set handler, runtime and six environment variables; wait for the update; create a Function URL with `AuthType=NONE` and **no CORS** only after token validation is active; add the AWS required URL-only invoke policies; safely prove unauthenticated GET/POST denial and no evidence in responses; set the matching Supabase secrets and exact URL; deploy only `gridly-verify-apple-subscription`; confirm deployed source parity and zero entitlements; then request one nonpurchase TestFlight Retry. A `NONE` Function URL is publicly invokable at the AWS boundary, so the strong internal token is mandatory and checked before verification. Any missing or mismatched secret leaves Apple verification closed.
