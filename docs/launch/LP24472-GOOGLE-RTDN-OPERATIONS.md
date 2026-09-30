# LP244.72 Google RTDN and acknowledgment operations

This is a source-only deployment candidate. No Google Play Console, Pub/Sub,
IAM, Supabase production, Worker, purchase, reporting, or Android versionCode
change occurred. LP244.71's database migration remains undeployed.

## Official contract and selected architecture

Google Play publishes to one Cloud Pub/Sub topic, configured in Play Console
as `projects/{project_id}/topics/{topic_name}`. The recommended candidate in
the existing `gridly-play-billing` project is
`projects/gridly-play-billing/topics/gridly-google-rtdn`. Grant the **Google
Play publisher principal**
`google-play-developer-notifications@system.gserviceaccount.com` the
`pubsub.topics.publish` permission on that topic. `roles/pubsub.publisher` is
Google's documented convenient grant. The billing-server service account is
not the Play publisher. [Google setup](https://developer.android.com/google/play/billing/getting-ready#grant-publish-rights-on-your-topic)

A push subscription fits this low-volume HTTPS Edge consumer. Pull would
require an additional polling runtime; Google recommends push when unsure.
Create it with payload wrapping enabled and authenticated push. The push
identity must be a user-managed service account **in the subscription's
project**, preferably dedicated to this endpoint. The subscription creator
needs `iam.serviceAccounts.actAs` on that identity (Service Account User is a
role convenience). The Pub/Sub service agent for project number
`219024907806`,
`service-219024907806@gcp-sa-pubsub.iam.gserviceaccount.com`, needs
`iam.serviceAccounts.getOpenIdToken` on the push identity (Service Account
Token Creator is a role convenience). These grants have not been made.
[Push authentication](https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions)

The candidate subscription name is
`projects/gridly-play-billing/subscriptions/gridly-google-rtdn`. Its HTTPS
endpoint and OIDC token audience must both be exactly
`https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-google-rtdn`.
Set `GRIDLY_GOOGLE_RTDN_SUBSCRIPTION` to that full subscription name and
`GRIDLY_GOOGLE_RTDN_PUSH_IDENTITY_EMAIL` to the selected user-managed push
service account email, as server-side settings only. The Edge function has
`verify_jwt=false` because Supabase's platform JWT checker would reject
Google's OIDC token; the handler verifies Google's RS256 signature, issuer,
audience, email, verified email claim, and validity period before reading a
message. It pins Google's public JWKS URL and never accepts caller-provided
keys. [Supabase function authentication](https://supabase.com/docs/guides/functions/function-configuration),
[Pub/Sub JWT validation](https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions#validate_tokens)

The wrapped Pub/Sub request has `message.data` (base64 DeveloperNotification),
`message.messageId`, and `subscription`. The receiver bounds the body and
decoded message, checks the exact subscription and package, and accepts one
notification kind. `testNotification` and validated one-time-product events
finish without a purchase lookup; this app has no one-time product. A voided
**subscription** notification triggers a fresh subscription lookup; order-level
void information remains a separate future Voided Purchases API concern. Play
Console should select **subscriptions and all voided purchases**, not the
all-products option. The event code never grants access.
[RTDN envelope and event types](https://developer.android.com/google/play/billing/rtdn-reference)

Subscription types 1–7, 9–13, 17–20, and 22, plus deprecated 8, are accepted
only as reconciliation triggers. This includes purchase, renewal, cancellation,
expiry, grace, hold, recovery, pause and schedule change, restart, revocation,
deferment, and price changes. Fresh `purchases.subscriptionsv2.get` state,
including the LP244.71 product, base plan, environment, and replacement chain
checks, determines the cache state. Pending ACK work is durably enqueued and
reverified through the existing queue. No proof is signed by RTDN.

## Idempotency, retry, and failure handling

The LP244.72 migration follows LP244.71. Its private RLS-protected table stores
only Pub/Sub message IDs, 90-second processing leases, states, timestamps, and
safe error categories. No notification body or purchase token is stored.
`done` and `terminal` duplicates get HTTP 204; an in-flight duplicate gets
503. Leases recover after expiry. Receipt retention is 31 days and is pruned
by both new claims and the existing bounded subscription housekeeping RPC.
The separate private health row counts completions, retries, terminals,
duplicates, and busy deliveries over a 24-hour window.

Pub/Sub push is at least once and normally unordered. The server ignores event
time when deciding entitlement and re-reads current Google state. HTTP 204
acknowledges a completed or durably terminal event. Malformed or unauthorized
requests return 400/401. Provider, credential, database, and ACK failures
return 503, so Pub/Sub retries. Google-confirmed invalid purchase/evidence is
recorded terminal and returns 204 without a grant. No raw token, envelope, or
secret is logged. Choose a push acknowledgment deadline sufficient for the
bounded provider and database path (candidate: 120 seconds), a bounded retry
policy, and monitor push delivery failures and the private health RPC.
[Pub/Sub response semantics](https://cloud.google.com/pubsub/docs/push),
[delivery order](https://cloud.google.com/pubsub/docs/subscription-overview)

A dead-letter topic is **not** created here. Later, if approved, configure a
dead-letter topic and maximum delivery attempts on the push subscription.
The Pub/Sub service agent then needs `pubsub.topics.publish` on that topic and
`pubsub.subscriptions.consume` on the source subscription; Publisher and
Subscriber roles are documented conveniences. Review dead-letter messages
without placing purchase tokens in alert bodies. Do not treat a DLQ event as
entitlement evidence. [Dead-letter permissions](https://cloud.google.com/pubsub/docs/dead-letter-topics)

## Acknowledgment scheduler

The exact Edge entrypoint is `POST /functions/v1/gridly-subscription-ops` with
the server-held `X-Gridly-Subscription-Ops-Token` and an empty body. The
existing queue claims at most 10 records with `FOR UPDATE SKIP LOCKED`, gives
each a 60-second lease, and checks deadline and lease before acknowledging.
The Edge operation has a 35-second abort and a bounded housekeeping call; the
Worker HTTP request has a 40-second timeout. This schedules durable ACK work
and cleanup, and never signs an entitlement proof.

Use the existing one-minute cleanup Worker schedule by deploying the reviewed
`wrangler.subscription-rollout.jsonc` candidate, which selects the existing
`combined-worker.mjs`. The live default `wrangler.jsonc` still points to the
cleanup-only `worker.mjs`; production scheduling remains unproven. Verify one
completion tick per minute, no overlapping lease work, retry/terminal counts,
dead-man heartbeat, and no alert secrets in output before calling the schedule
ready. No deploy or live schedule change is part of LP244.72.

## Later production deployment order (review only)

1. Review and apply LP244.71 migration `20260930210000_lp24471_google_subscription_contract.sql`; confirm old-product cache precheck and RLS/ACLs.
2. Apply LP244.72 migration `20260930220000_lp24472_google_rtdn.sql`; confirm receipts, health, RPC privileges, and housekeeping.
3. Deploy the updated Google verifier/shared server code and existing subscription operations entrypoint; confirm Apple remains unchanged and reporting OFF.
4. Configure the two RTDN server settings and deploy `gridly-google-rtdn` with Google OIDC validation; confirm unauthenticated denial before connecting Pub/Sub.
5. Review and deploy the combined Worker candidate on the existing one-minute schedule; prove ACK ticks, leases, bounded retry and monitoring.
6. Create the Pub/Sub topic and authenticated push subscription in `gridly-play-billing`; grant only the publisher and push identity permissions above. Prepare a DLQ only through a later approved change.
7. Configure the topic in Google Play Console for subscription and voided notifications; send one console test notification after the authenticated endpoint is ready.
8. Perform read-only postflight of JWT identity, receipt/health counters, test delivery, ACK ticks, Pub/Sub delivery, cache ACLs, and reporting OFF.
9. Produce and upload a separately authorized Android internal-test build with `versionCode 2`; do not release to production.
10. Install the Play-delivered build on a physical tester device.
11. Confirm Play Integrity admission on that installation.
12. Conduct one separately authorized, controlled Google purchase, ACK, restore, renewal/cancel/denial lifecycle test; reconcile Google API state and RTDN receipts. Do not activate reporting.
