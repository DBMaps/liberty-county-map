# LP101.6 address provider availability resolution

## Executive summary

The authoritative LP101.5B production capture was valid and correctly reported a visible
`temporarily_unavailable` address state. The failure was not stale DOM, candidate-pipeline drift,
or certification drift. The browser's variant recorder classified the canonical `no_results`
envelope as a provider failure because the canonical contract intentionally represents no-result
as `ok: false`. Its sticky provider status then allowed that normal empty response (and any later
temporary failure) to select unavailable copy.

LP101.6 preserves the canonical boundary and changes only browser variant disposition and aggregate
classification. A canonical empty response is now `canonical_no_result`; a relevant result wins;
a canonical no-result wins over a non-blocking temporary failure; and unavailable/paused is selected
only when every completed variant temporarily fails. No result is fabricated.

## Authoritative finding and exact failure stage

The supplied active final-render capture proved: canonical response observed, zero render input,
zero visible cards, no misleading road fallback, and `temporarily_unavailable`. Repository tracing
located the failure at **client variant status aggregation**, after the Gridly boundary returned a
canonical envelope and before renderer status selection:

1. The edge function returns HTTP 200 with `{ ok: false, status: "no_results", results: [] }` for a
   valid empty provider response.
2. `fetchGridlyNominatimSearch` previously sent every `!response.ok` outcome to the `failed` event.
3. `recordGridlyDestinationProviderEvent` made `failed` sticky in `providerStatus`.
4. The empty renderer interpreted `failed` as temporary-unavailable instead of confirmed no-result.

Thus the proven cause is malformed **classification of a valid canonical no-result**, compounded by
sticky per-variant aggregation. It is not evidence of provider cooldown, timeout, reservation denial,
rate limiting, or provider-unavailable response in the authoritative session.

## Privacy-safe variant findings

The session-only `window.gridlyLp101AddressProviderRca?.()` helper executes the governed address case
and reports one record per attempted variant. Each record contains only: variant index, intent,
attempt flag, Gridly endpoint origin/function slug, HTTP status, canonical success/failure and result
count, bounded failure flags, retry/cooldown/reservation/timeout/malformed/network booleans, and final
disposition. It never returns a query, address, coordinates, provider payload, credentials, headers,
or personal destination data.

The helper makes the runtime alternatives mechanically distinguishable:

- HTTP 200 canonical empty: `canonical_no_result`;
- canonical results: `relevant_results`;
- 429/cooldown: `provider_cooldown`;
- reservation/configuration denial: `provider_reservation_denied`;
- timeout, network, malformed, or unavailable: `temporary_failure`.

Its aggregate reports whether any canonical success/no-result, relevant result, or temporary failure
occurred, whether all variants were empty or temporarily failed, the final consumer classification,
and classification agreement.

## Provider governance findings

LP100 governance remains intact. The browser continues to call only
`/functions/v1/gridly-geocode`. The edge function still reserves the globally serialized provider
slot, honors `Retry-After`, writes global cooldown, applies its timeout, uses canonical caching and
inflight coalescing, and fails closed on configuration/provider errors. LP101.6 neither reduces the
reservation interval nor disables rate limits/cooldowns. Variants remain sequential and stop after an
exact result; no parallel or direct upstream request was introduced.

## Smallest production correction

The correction is limited to address outcome bookkeeping:

1. recognize `status: "no_results"` as a successful canonical no-result disposition despite
   canonical `ok: false`;
2. retain privacy-safe final evidence per variant;
3. derive the address provider status from all completed dispositions rather than sticky event order;
4. render confirmed no-result when at least one variant establishes it, unless a relevant result wins;
5. preserve paused/unavailable only when all variants genuinely fail temporarily.

Business, category, governed-destination ranking, candidate gates, DOM agreement, misleading-road
rejection, Route Preview, and certification fail-closed checks are unchanged. The visible
certification milestone is LP101.6; temporary-unavailable still cannot pass the address case.

## Validation and merge criteria

Run the repository LP097–LP101.6 suite and syntax/diff checks listed in the LP101.6 change. Then run
the authoritative browser command:

```js
await window.gridlyLp101VisibleSearchCertification?.()
```

Merge only when `failedChecks` is empty; candidate-pipeline and render/DOM agreement are true; Route
Preview is verified; business, category, and governed destination pass; and address is either
`relevant_result` or `truthful_no_result` with `safeToMerge: true`. If needed, the separate RCA helper
may be run without manual Network inspection; its evidence remains in memory for the current session.
