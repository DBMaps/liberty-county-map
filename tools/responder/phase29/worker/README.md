# Dispatch Worker hosting layer — local only

DAYTON-HOSTING-01-v1. Governance commit 94faa3b2406c0e5eea1cbecdf618c6aa33c4d0a0. No Cloudflare/Supabase/Hyperdrive resource, real credential, webhook, email or deployment is created. This directory is a private server artifact, not a browser build.

## Local checks

Install the exact isolated lockfile with npm ci in this directory. From the Dispatch worktree run:

    node --test tests/responder-phase29-worker-hosting.test.mjs tests/responder-phase29-invitation-delivery.test.mjs tests/responder-phase29-durable-contract.test.mjs

Actual local workerd (Miniflare 4.20260730.0) runs the production HTTP handler with synthetic signing material, injected event persistence and outbound network refusal. It checks Web Crypto/Node HMAC/SHA-256 parity, random UUID/bytes and Buffer behavior. The fixture is runtime-fixture.mjs; it is never the Wrangler main. esbuild uses Node platform/built-ins and an explicit createRequire banner for the local test bundle.

Use the existing guarded harness:

    ./tools/responder/phase29/run-certification.ps1 -WorkerOnly

It creates an unlinked disposable TEMP Supabase/Docker project, installs the baseline and invitation package, rehearses empty rollback/reinstall, runs 15 reporting/reviewer/invitation runtime tests, then performs 10 real-login/pooled-principal checks and the unchanged Phase 28 security postflight. Separate evidence: reports/responder/phase29-evidence/worker-hosting. No Supabase CLI commands run from the repository. Synthetic password exists only transiently in the disposable test process/database. Cleanup destroys that local database.

## HTTP boundary

Production main: index.mjs. Exact HTTPS origin/path, POST, JSON/UTF-8 and no content encoding. Stream at most 65,536 bytes independently of Content-Length, decode strictly without changing BOM/raw representation, then authenticate Svix before JSON parsing/event handling. Missing secrets/configuration fail closed. The core now requires canonical v1 base64 signature shape, preventing permissive-decoder acceptance of malformed signatures.

Responses have empty bodies and Cache-Control: no-store: 404 unmatched route, 405 wrong method, 415 unsupported content, 413 oversized, 400 stream/UTF-8 failure, 401 signature or signed event/JSON refusal, 409 conflicting duplicate, 503 unavailable configuration/persistence/unknown correlation, 204 durable success/identical duplicate. Signed malformed JSON returns 401 through the existing single verification/refusal boundary; no payload or exception is disclosed.

No raw webhook/email body, recipient, token, signature, authorization header, provider error or credential is logged. Only normalized IDs/status/time enter the command. All seven approved events are supported; SQL retains deduplication, adverse precedence and delivery-only suppression. Webhook handling cannot issue invitations or grant membership.

## Sending and operator boundary

resend-transport.mjs targets only https://api.resend.com/emails, refuses redirects, enforces exact sender/allowlisted request, bounded response, five-second timeout and attempt idempotency. Tests inject fetch; no real provider request occurs. No blind retry after an ambiguous send.

GRIDLY_DISPATCH_SENDING_ENABLED=false is the default Wrangler state. The transport refuses before fetch; invitation-service.mjs refuses issuance/reissue/manual disclosure before token generation or operator writes. Missing key refuses before issuance. An enabled service requires separately authenticated server-owned operator/recipient/repository ports and explicit acceptance/support/redirect paths. No operator HTTP route or broad Auth credential is supplied. The narrow webhook route does not authorize broader onboarding endpoints. TEST continues to exclude real credentials/non-.invalid recipients.

## Database/Hyperdrive boundary

Binding: DISPATCH_DELIVERY_DB. Validate the narrow username, credential presence, TLS/caching declarations and disallow insecure sslmode. pg clients require certificate verification, connection/query/statement/idle-transaction bounds. Each command creates/closes its logical client; Hyperdrive owns the origin pool.

Repository exposes claim, complete and event only. Fixed parameterized SQL: BEGIN, SET LOCAL ROLE dispatch_delivery_transport, local timeouts, the one bounded command, COMMIT; failures ROLLBACK and close. No table reads or issue/suppression-admin commands. Unknown correlation is unavailable; conflicting committed duplicate is separately classified.

database-principal.local.sql requires the existing synthetic marker/current postgres and refuses collisions or effective PUBLIC CREATE authority. The login has no ownership or inherited privileges and only SET membership in dispatch_delivery_transport. It cannot assume command-owner/Auth/API roles. Existing transport grants remain unchanged; no Auth bridge is added.

Hyperdrive query caching must be explicitly disabled at account configuration. GRIDLY_DISPATCH_DB_CACHING_DISABLED=true and GRIDLY_DISPATCH_DB_TLS_REQUIRED=true are required deployment assertions, not remote-state introspection. Dedicated origin, TLS verification, direct Supabase connection, pooling settings and effective account-side cache configuration still require later owner verification. Local TCP PostgreSQL tests do not certify real Hyperdrive TLS/networking.

## Activation and rotation gates

wrangler.jsonc contains an unusable owner-configuration placeholder, exact narrow route and disabled workers.dev/preview exposure. There is no deploy script. Keep environments separate; no consumer bindings. Real keys go only into Worker Secrets GRIDLY_DISPATCH_RESEND_API_KEY and GRIDLY_DISPATCH_RESEND_WEBHOOK_SECRET. No private values in vars or source. The database credential belongs in Hyperdrive configuration.

Future creation/deployment needs separate approval, actual project/account IDs, reviewed production baseline/forward installation, narrow login provisioning, approved real routes/template, account-side TLS/cache checks, secret-safe logging/build review and legal/privacy/retention readiness. Existing retention gaps are unchanged. Rotate provider material through controlled secret versions/deployment and retire old material after verification. Secret commands may deploy; none is run here.

Sources: Cloudflare Node compatibility/crypto/Worker Secrets/Hyperdrive node-postgres documentation and Resend Svix manual verification. This implementation makes no claim of real provider connectivity, production readiness or legal compliance.

## Locally certified readiness route

GET https://dispatch.gridlygo.com/health is the only additional route. It uses the existing narrow Hyperdrive binding validation, certificate verification and bounded pg client, without Resend secrets. Two read-only transactions verify session_user/current_user, SET LOCAL ROLE dispatch_delivery_transport, rollback and reset on the same logical client. Hyperdrive owns physical pooling; local proof does not establish live Hyperdrive reuse. Production connectivity and identity-of-origin assertions still require separately authorized account preflight. No application query, data mutation, bearer secret or diagnostic output is introduced. Failures return a fixed sanitized 503; success returns only service/environment/status and verification booleans. No deployment is performed by this local change.

Readiness certification: 80 PASS / 0 FAIL (55 HTTP/static including 12 new readiness checks; 15 reporting/reviewer/invitation runtime; 10 real-login/role-reset runtime), existing 329 assertion groups, Phase 27 security postflight PASS. Existing guarded WorkerOnly harness used an unlinked TEMP Supabase project and separate disposable evidence; no production connection. Focused readiness role transitions use injected clients; real PostgreSQL role/reset/pool boundaries are independently certified by the unchanged principal suite. Live Hyperdrive pooling remains unverified until production connectivity authorization.
