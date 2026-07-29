# LP102 Rural Address Canonical Candidate Pipeline Repair

## Retained production evidence

The retained production invocation of `window.gridlyLp102RuralAddressInvestigation()` reported production behavior, an intact Gridly provider boundary, no browser-direct provider access, truthful canonical outcome classification, no misleading fallback, preserved Route Preview, unchanged protected systems, no failed checks, and `safeToProceed: true`. Its finding was `canonical_candidate_lost_inside_gridly_pipeline`: at least one rural case had a non-empty canonical result count but no visible result. This is a confirmed Gridly-controlled defect, not a provider outage or coverage limitation.

## Root cause and loss stage

The candidate crossed the LP100 boundary and was present in `providerCandidates`. LP097 exactness then compared the entered mailing city with the provider's canonical physical locality. A difference produced `city_conflict`. LP101 ranking treated that reason as a hard geographic conflict and applied the same severe penalty used for ZIP/county/state conflicts. Because deduplication limits the evaluated set before the explicit relevance gate, the otherwise useful matching house-and-road candidate could fall out before `relevanceGateOutput` and `finalRenderInput`. The DOM truthfully rendered the empty pipeline output.

The rejected candidate's production identity and fields remain in the browser diagnostic rather than being copied into source documentation. LP102 now records canonical identity; entered/candidate house, road, locality, county, and ZIP values; exactness reasons; last observed stage; rejection phase/rule; patch decision; acceptance; and final visible outcome. This allows the retained production case to identify whether loss occurred before ranking, after ranking, or at rendering without provider-specific assumptions.

## Repair

For county-road and highway address models only, a locality difference becomes `mailing_city_difference` when both canonical county and ZIP independently agree. This remains non-exactness evidence, so the candidate cannot be labeled an exact address. It is no longer scored as a hard geographic conflict. Candidate acceptance additionally requires matching house and road and rejects genuine house, street, state, city, county, ZIP, enriched-locality, or distance conflicts. Road-only geometry cannot satisfy a numbered-house query.

Before the patch, a supported rural house candidate could receive the hard `city_conflict` ranking penalty and disappear before visible output. After the patch, the candidate survives as a truthful non-exact address when its house, road, county, and ZIP support it. Genuine conflicts and unrelated-road fallbacks remain rejected. The rule is provider-independent and consumes only the canonical Gridly address contract; it contains no address, locality, ZIP, Web/Webb, or historical-alias special case.

## Diagnostic and case selection

`gridlyLp102RuralAddressInvestigation({ caseNames })` now executes only valid requested names, returns `requestedCaseNames` and `executedCaseNames`, and clearly lists invalid entries in `unknownCaseNames`. Omitting options still runs the complete matrix. Search behavior is unchanged by case selection.

Each received candidate has a `rejectionTrace` containing its canonical identity, compared values, exactness reasons, last observed stage, rejection stage and rule, whether LP102 changed its treatment, and final acceptance. Web and Webb remain independent inputs; LP102 adds no speculative alias.

## Visible browser certification

Run the production investigation subset:

```js
await window.gridlyLp102RuralAddressInvestigation?.({
  caseNames: ["county_road_full", "web_address", "webb_address", "business_control", "governed_control"]
})
```

Run the complete visible certification:

```js
await window.gridlyLp102VisibleRuralAddressCertification?.()
```

The certification uses the real search UI twice (targeted-filter proof and full matrix), compares pipeline output with visible cards, selects a result through the real card handoff, and verifies rural retention/precision, canonical no-result behavior, business and governed controls, Route Preview, boundary use, direct-provider absence, and protected-system invariants. `safeToMerge` is true only when `failedChecks` is empty.

## Precision policy and limitations

An exact address still requires matching house and road with no exactness reasons. A supported rural mailing-city difference is displayed as a non-exact address. A road without matching house evidence remains road precision. A canonical no-result remains a no-result, and an unavailable boundary remains unavailable. Provider absence for Web/Webb or any other spelling remains a provider limitation when the canonical response actually contains no results; this patch neither manufactures a point nor asserts an alias.

## Browser procedure and merge recommendation

Open production or a production-equivalent build, open destination search, run the two commands above, and retain their output. Then visibly test the four County Road 677 spellings, Web Road, Webb Road, the road-only query, the impossible numbered road, Dayton Walmart, and Liberty Courthouse. For a retained rural result, compare displayed canonical fields, select it, open Route Preview, and confirm identity and coordinates agree.

Merge is recommended only after the visible certification returns `failedChecks: []` and `safeToMerge: true`. Automated contracts alone are insufficient.
