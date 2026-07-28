# LP101.5 address certification root-cause analysis

## Scope and authoritative observation

This is an investigation record only. It does not change the search pipeline, renderer,
canonical contract, routing, or certification implementation. The authoritative production
observation supplied for this RCA was:

- all three non-address cases passed;
- candidate-pipeline agreement, render/DOM agreement, and Route Preview passed;
- the address case had zero visible cards, observed a canonical response, did not observe a
  relevant address, and failed only `address:passed`.

No raw query, address, coordinates, provider response, credentials, or personal history are
recorded here.

## Proven failed requirement

The only value consistent with that observation and the production expression is
`noResultMessageObserved === false`.

This follows without guessing:

1. `address:resultStateSettled` is absent, so `settled` was true.
2. The absence of the address boundary, HTTP, canonical, provider-boundary, HTTP-failure, and
   direct-provider failed checks proves every member of `runtimeCasePassed` was true.
3. Aggregate and case render/identity checks passed. With zero visible cards,
   `renderDomAgreement` proves `renderInputCount === 0`; identity agreement also proves zero stale
   visible cards.
4. `canonicalResponseObserved` was explicitly true.
5. Therefore every operand of `truthfulNoResult` was true except its final
   `noResultMessage` operand. Since the address did not take the relevant-result branch, that false
   value propagated through `canonicalNoResultAccepted` and the final address expression.

The minimal production-equivalent reconstruction is:

```text
relevantAddressResultObserved = false
noResultMessageObserved       = false   <- sole failed address requirement
truthfulNoResultObserved      = true && true && true && true && true && false = false
canonicalNoResultAccepted     = false && true && true = false
misleadingRoadFallbackAbsent  = false || false || true = true
addressOutcome                = "failed"
address passed                = true && true && true && true && (false || false) = false
```

## Complete decision tree

### Evidence and shared runtime gate

`canonicalResponseObserved` is
`canonicalSuccessResponseObserved || canonicalFailureResponseObserved`. It does **not** require a
canonical failure/no-result response specifically. A canonical HTTP-200 success containing an empty
`results` array therefore satisfies this evidence gate, as does a canonical failure envelope received
over a successful HTTP response.

`runtimeCasePassed` requires all of:

- `boundaryRequestAttempted`;
- `boundaryReachable`;
- `httpSuccessObserved`;
- `canonicalResponseObserved`;
- absence of `fatalHttpObserved` (401, 404, 5xx, null status, or malformed response);
- `providerIndependentResponseConfirmed`; and
- `directUpstreamBrowserRequestsAbsent`.

The authoritative failed-check list proves this complete shared gate passed. Neither the later global
audit nor `candidatePipelineAgreement`, aggregate `renderDomAgreement`, or Route Preview secretly
caused the address failure: all passed, and the only recorded failure was `address:passed`.

### Relevant-result branch

`validAddress` requires at least one current, visible, in-container card whose rendered text contains
both the governed house-number token and the governed roadway identity. Then:

```text
relevantAddressResultObserved = validAddress && visibleCardCount > 0
```

The authoritative zero-card observation makes this branch false.

### Truthful-no-result branch

```text
finalGateHasNoCandidates = renderInputCount === 0

truthfulNoResultObserved =
  settled
  && canonicalResponseObserved
  && finalGateHasNoCandidates
  && visibleCardCount === 0
  && staleVisibleNodeCount === 0
  && noResultMessageObserved

canonicalNoResultAccepted =
  truthfulNoResultObserved
  && runtimeCasePassed
  && renderDomAgreement
```

`noResultMessageObserved` searches only `.gridly-search-results-status` descendants of the active
`#gridlySearchResults`, rejects hidden/ARIA-hidden status nodes and nodes whose nearest results
container is not the active container, normalizes punctuation/case, and accepts only the semantic
phrases “couldn't confirm” or “no matching destination(s) found.” The supplied production result
forces this detector to be false. It cannot distinguish these causes in its current returned object:

- no status node existed;
- the node was outside/nested under a different results container;
- the node was hidden;
- or its text represented a temporary pause/unavailable/error state rather than either accepted
  no-result meaning.

### Final address outcome

```text
misleadingRoadFallbackAbsent =
  relevantAddressResultObserved
  || truthfulNoResultObserved
  || no visible card text looks like a road

addressOutcome = relevantAddressResultObserved
  ? "relevant_result"
  : canonicalNoResultAccepted
    ? "truthful_no_result"
    : "failed"

address passed =
  settled
  && runtimeCasePassed
  && renderDomAgreement
  && misleadingRoadFallbackAbsent
  && (relevantAddressResultObserved || canonicalNoResultAccepted)
```

With no cards, the anti-fallback condition passes vacuously. It is not the failure.

## Runtime shape, fixture, DOM, and canonical findings

The LP101.5 fixture manufactures a `.gridly-search-results-status` inside its mock results container
with the exact approved “couldn't confirm” meaning. It also marks every HTTP-200 response as
`canonicalSuccess: true`, always uses `canonicalFailure: false`, and does not model provider cooldown,
rate-limit, unavailable, or alternate status text. Consequently, the fixture proves the intended
boolean branch but not the production status-selection states.

The real renderer places its normal empty-state node inside `#gridlySearchResults`. For a zero-result
address it selects among three materially different messages based on diagnostics:

- cooldown: temporarily paused;
- provider failed/rate-limited: temporarily unavailable; or
- otherwise: the approved exact-address “couldn't confirm” message.

Only the third is recognized by certification. Thus there is no static selector or normal-message
spelling mismatch: the selector, containment, and approved text agree between renderer and
certification. The observed false detector proves that the final production DOM did not present a
visible, in-container status with one of the two approved meanings at inspection time. The existing
privacy-safe result does not expose which of the four DOM subcauses above occurred.

The canonical client records an empty successful envelope as `canonicalSuccess`, not
`canonicalFailure`. That is compatible with the current certification, which uses their OR. There is
no `canonicalNoResultEvidenceObserved` field and no requirement for `canonicalFailureResponseObserved`
in LP101.5. Accordingly, missing canonical-failure evidence is not the failing boolean, and the test's
all-success evidence is consistent with its passing no-result case.

## Root cause and smallest recommended correction

**Proven root cause:** the truthful-no-result path is blocked solely by
`noResultMessageObserved === false`. LP101.5 describes a complete active-container no-result state,
but its executable acceptance remains coupled to two exact status-message meanings. The production
summary does not include that detector or the safe status classification, so the only way to identify
the failure is boolean elimination; the fixture always supplies the accepted message and therefore
cannot reproduce the authoritative DOM/evidence combination.

Before any patch, run a session-only, privacy-safe diagnostic in the production browser that reports
the status node count, visibility/containment booleans, and a bounded enum such as
`confirmed_no_result | unavailable | paused | other | absent`, together with every operand above.
Do not return status text. That observation will separate a diagnostics-selected unavailable/paused
state from absence, containment, or visibility issues.

After that browser observation is reviewed, the smallest correction should be confined to making the
documented truthful-no-result evidence and the executable detector agree. Do not alter ranking,
queries, the candidate pipeline, renderer behavior, canonical responses, or routing. No merge is
recommended by this investigation.

