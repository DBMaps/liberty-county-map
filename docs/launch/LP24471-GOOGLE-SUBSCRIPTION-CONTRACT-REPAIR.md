# LP244.71 Google subscription contract repair

The active Google Play subscription is `com.gridlygo.gridly.monthly`, base plan
`monthly`. The earlier `gridly_monthly` identifier was an uncreated proposal.
This change is source only; no store, cloud, Edge deployment, scheduler, or
reporting state changes are part of this commit. Historical LP244.61–66
records retain their original observations.

## Product ID root cause

- Android BillingClient queried `gridly_monthly`, so Play's active ProductDetails
  could not match.
- The JavaScript native request contract and continuity validator expected the
  same proposed Google ID. Both now use the Google-specific contract entry.
- The Google server verifier checked the proposed line-item ID and its
  acknowledgment URL contained it. Both now require the active Play ID.
- The applied store cache migration constrained Google rows to the proposed ID.
  The forward migration replaces this constraint without changing Apple's
  explicit product branch. Expired old Google cache rows can be removed; an
  unexpired row causes the migration to abort.
- Fixtures, native certification issuer, and focused tests used the proposed
  ID. Historical launch documents still mention it as the then-current plan;
  this document supersedes that Google contract.

## Lifecycle behavior

- Fresh Google `SUBSCRIPTION_STATE_IN_GRACE_PERIOD` evidence retains entitlement
  only with an acknowledged purchase, `autoRenewEnabled=true`, and an unexpired
  Google line-item expiry. The signed lease ends within five minutes and no
  later than that expiry. Grace does not mint the 24-hour continuity proof.
  Expired grace and malformed evidence deny. Apple grace remains unsupported.
- The current Billing library compiles with
  `includeSuspendedSubscriptions(true)`. Launch, resume, and restore can now
  observe paused purchases; server `SUBSCRIPTION_STATE_PAUSED` remains a denial.
  Pause classification: **A, safe code repair now**.
- Only Google's `linkedPurchaseToken` responses can establish a replacement
  chain. The verifier fetches and validates at most four predecessors with the
  same package, product, base plan, region, and environment. Loops, unavailable
  or deeper chains fail closed. The new private ledger stores HMAC fingerprints
  and successor links, not raw tokens, and atomically refuses replay and forks.
  Deploy the forward migration before the updated Edge verifier. Existing
  tokens with no linked predecessor still reconcile through the new RPC.

## Acknowledgment scheduler audit

`gridly-subscription-ops` has a token-authenticated empty POST operations
entrypoint. The draft combined Cloudflare Worker calls that entrypoint, but
tracked `wrangler.jsonc` still points to `worker.mjs`, the cleanup-only Worker.
The earlier live audit found no subscription Cron job and no completed
production or sandbox acknowledgment tick. Background acknowledgment execution
is **not proven**. No scheduler was added or deployed here. RTDN is not
implemented.

The next Play-uploadable Android release needs `versionCode 2` because Play
accepted code 1 already. This source commit leaves code 1 unchanged; a later
release milestone must bump it. No paid purchase should be attempted until the
new cache migration and server function are deployed, the new Android bundle
is installed from a Play test track, and acknowledgment scheduling is proven.
