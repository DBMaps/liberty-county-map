# LP097 — Compliant Address Resolution and Local Destination Expansion

## 1. Executive Summary
LP097 adds address-specific intent modeling, rural-road normalization, a deterministic three-attempt provider strategy, precision classification, address-first ranking, honest consumer states, and a governed Liberty County destination index. It preserves the existing selected-coordinate handoff to destination route preview. The direct browser provider remains a production launch blocker; this milestone does not claim production or manual-device certification.

## 2. LP096 Baseline
LP096 found one direct browser Nominatim free-form path, a five-candidate request/display cap, no structured full-address attempts, no exactness contract, and no consumer distinction between provider failure and no match.

## 3. Existing Search Architecture
The 350 ms live-input pipeline is retained. Saved Places and local seeds render immediately; remote results are normalized, ranked, contained, deduplicated, displayed in five compact rows, selected, and passed to the unchanged destination-marker/OSRM preview path.

## 4. Existing Curated Destination Inventory
The prior inline inventory mixed communities, roadway corridors, crossings, civic places, schools, medical facilities, and retailers. Many records lacked aliases, county IDs, verification metadata, activation state, or a canonical category. LP097 does not delete valid legacy roadway seeds. Governed LP097 records are separate from user addresses and are merged into the existing seed search adapter.

## 5. Address Intent Model
`buildGridlyLp097AddressModel` retains the original query and separately produces a display normalization, house number, street, locality, ZIP, rural/highway flags, structured components, and no more than three provider variants. House numbers are never removed from address variants.

## 6. Rural Address Normalization
`CR`, `County Rd`, `County Road`, and `Co Rd` normalize to `County Road` for controlled provider attempts. FM, TX, US, and State Highway forms retain their route number and any leading house number. The original input remains the final fallback.

## 7. Provider Boundary
The repository has no deployable owned search API contract. LP097 therefore retains the guarded direct Nominatim call rather than inventing an unavailable proxy. `providerBoundaryAvailable` is false and `safeToMerge` remains false in the audit until an owned boundary and browser certification exist.

## 8. Provider Compliance and Privacy
Requests are limited to three sequential attempts, stop after a coordinate-valid exact match, reuse a two-minute memory cache, suppress duplicate in-flight calls, throttle, and apply cooldowns. Raw queries are not written to storage or audit output. Nominatim attribution already remains part of the app's map/provider attribution. A future Gridly boundary must identify Gridly, rate-limit, cache transiently, avoid permanent raw-query logs, and return typed unavailable/rate-limited responses.

## 9. Controlled Query Strategy
1. Structured street/city/county/state/postal/country attempt for a recognized complete address.
2. Locality-aware expanded free-form attempt.
3. Original free-form fallback.

The evaluated provider limit is 15 per attempt, while the visible list remains five. Attempts are sequential and never exceed three.

## 10. Result Classification
Consumer labels are Exact address, Address, Place, Public service, Medical, School, Government, Retail, Road, Highway, Community, and Approximate location. Provider-internal class/type values are used only as internal signals.

## 11. Ranking Model
Exact house-number and road agreement receives the highest boost. Saved places follow; an exact governed name/alias match precedes general address and POI matches. Address-intent road, highway, and broad approximate results are penalized so they cannot impersonate the requested house address.

## 12. Consumer Failure States
The UI distinguishes temporarily unavailable, cooldown, unconfirmed exact address, approximate classification, and genuine no-match. It never labels a road corridor as an exact address.

## 13. Curated Destination Data Model
Every LP097 record has a stable ID, canonical name, aliases, category/subcategory, public address, community/county/state/ZIP, valid coordinates, source/coordinate verification description, verification date, and active state. The browser data file is immutable.

## 14. Liberty County Destination Expansion
The governed set covers medical/emergency, city and county government/law enforcement, education, libraries/post offices, retail, park, and airport destinations in Dayton, Liberty, and Cleveland. Expansion remains intentionally county-scoped and controlled.

## 15. Seed Governance
- **Verifier:** a maintainer checks the named public authority or official facility/store locator and map coordinate before review.
- **Required fields:** all fields in the LP097 canonical record; private residences are prohibited.
- **Coordinates:** building/entrance or authoritative facility point only; never a community centroid or roadway centerline.
- **Duplicates:** canonical ID uniqueness plus normalized name/community and coordinate proximity review.
- **Aliases:** recognizable former/alternate official names only; aliases may not make unsupported service claims.
- **Categories:** one product category and a controlled subcategory.
- **Updates:** refresh source, coordinate, and `verifiedAt` together; retain stable ID.
- **Deactivation:** set `active: false`; do not silently repoint an ID to another facility.
- **County expansion:** add a separately reviewed county batch only after its category and coordinate validation passes.

## 16. Certification Fixture Inventory
The 60-record fixture contains 15 public complete addresses, 10 synthetic County Road forms, five CR forms, five highway-address forms, 15 public-place searches, five broad searches, and five intentional ambiguous/no-match searches. Synthetic rural entries test contracts and do not claim provider coverage. The owner-supplied private test address is deliberately absent.

## 17. Static Test Results
The LP097 test validates fixture coverage, governed required fields, coordinate ranges, duplicate IDs, category coverage, request limits, structured lookup, stop-early behavior, ranking/classification copy, passive audit availability, and private-fixture exclusion.

## 18. Provider Integration Results
Status: **not executed**. This environment could not reach the provider (tunnel 403 before an HTTP provider response). No success percentage is fabricated. Controlled-provider and production-browser results remain pending.

## 19. Browser Certification
Run the supplied console block in production after deployment. The passive helper performs no requests or persistence. `safeToMerge` intentionally remains false until the owned provider boundary, browser run, and manual portrait run are certified.

## 20. Mobile Manual Testing
Use a fresh private session at mobile portrait width. Search a fixture public address; verify Exact address is above road seeds, select it, and confirm route preview. Repeat with a public rural address, CR spelling, and omitted locality. Verify approximate and provider-unavailable states, and confirm Enter does not duplicate requests. Then search one destination from every governed category and regression-check US 90, TX 146, Saved Places, Home, Work, Favorites, Route Watch, crossings, reporting, and awareness filters. For the owner-only address, record only yes/no, rank, coordinate validity, route handoff, and persistence pass; do not capture or store its text.

## 21. Protected Systems Confirmation
No Shared Reports, Route Watch calculation, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase synchronization, Historical Intelligence, Official Source Integration, crossing interaction, Saved Places storage, Home/Work contract, OSRM behavior, reporting, or notification code was changed.

## 22. Known Limitations
There is no production-owned provider boundary; rural resolution remains dependent on provider map coverage. Provider integration, production browser, and physical-device portrait certification are pending. The curated set is useful but intentionally not an exhaustive business directory.

## 23. Launch Recommendation
Keep the full-address launch gate closed. The patch is ready for controlled browser validation, but merge/launch should wait for the owned provider boundary plus successful browser and real-device evidence.

## 24. Files Changed
`index.html`, `js/app.js`, `js/lp097-curated-destinations.js`, `css/styles.css`, the LP097 fixture/test, and this document.

## 25. Tests Performed
Run `node tests/lp097-address-resolution-and-destinations.test.js`, `node --check js/app.js`, and the existing LP096 contract test. Provider probing was attempted separately and was blocked before provider response.

## LP097.1 — Destination Governance and Runtime Certification

### 1. Browser Findings

The production-like browser established that complete County Road addresses can reach the visible list as **Exact address**, retain their house number, outrank roadway seeds, and hand valid coordinates to the existing route-preview path. It also established that the governed medical and government destinations are discoverable. LP097.1 treats those observations as runtime evidence, not as facts inferred from source presence.

### 2. Duplicate Destination Finding

A provider row and the governed Liberty-Dayton Regional Medical Center row could represent one facility. The previous title-plus-rounded-coordinate dedupe was too narrow. LP097.1 evaluates cross-source identity before the display cap and prefers an active governed curated record when identity is established safely.

### 3. Locality Ranking Finding

An unqualified local query could admit a distant result alongside strong active-area results. LP097.1 preserves strong in-area candidates ahead of distant fallback candidates. It does not ban out-of-state destinations.

### 4. Cross-Source Deduplication Model

The deterministic model requires canonical-name or governed-alias agreement, compatible category families, and corroborating geography: close coordinates plus matching community/county/ZIP, or matching street/locality with bounded coordinate agreement. Name similarity alone, coordinate proximity alone, and address equality alone are insufficient. Same-building departments, incompatible categories, coordinate disagreements, campuses, and ambiguous matches remain separate. Curated records are never mutated with provider data. Passive evidence reports before/after candidate counts, duplicate groups, curated-over-provider survivors, unresolved possible duplicates, and reason codes.

### 5. Locality Priority Model

Saved places and exact addresses retain their existing score advantages. Governed exact-name destinations retain their strong score. Results in the active community/county or nearby configured coverage are reserved ahead of distant candidates; Texas remains preferred to unqualified distant United States results. The rule reads awareness/search context and is not Dayton-specific.

### 6. Explicit Out-of-Area Preservation

An explicit non-Texas state or a known destination community that differs from the current anchor disables local reservation. Thus Houston City Hall, Denver City Hall, and Dayton Ohio remain eligible, while an unqualified `Dayton city` query in Dayton continues to prefer Dayton, Texas. Distant results remain available when local alternatives are insufficient.

### 7. Provider Runtime Evidence

Runtime memory records attempted request, received response, sanitized status category, candidate presence/count, normalized exact-address presence, visible provider count, selected source class, provider error, cooldown, and success during the current page session. Audit output contains `queryRedacted: true`; it contains neither query text, coordinates, nor provider URLs. Reloading clears all evidence.

### 8. Temporary Provider Boundary Status

The active Nominatim integration is still a **temporary direct-browser provider boundary**. Gridly does not claim an owned proxy. `ownedProviderBoundaryAvailable` remains false and `ownedProviderBoundaryRequiredBeforePublicLaunch` remains true.

### 9. Browser Certification Recording

`window.gridlyRecordLp097BrowserCertification(record)` accepts only the ten governed boolean/rank fields, rejects missing or unknown fields, stores the validated record only in JavaScript runtime memory, and returns the passive audit. It performs no fetch, storage write, database write, logging, or source-code-based auto-certification.

### 10. `safeToMerge` Decision

`safeToMerge` becomes true only in the same runtime after a successful provider request and response were observed, at least one provider result reached the visible list, and every governed manual browser flag was explicitly recorded. Before those observations it remains false.

### 11. `safeForPublicLaunch` Decision

`safeForPublicLaunch` is intentionally false. Merge certification is not public-launch certification.

### 12. 28-County Pre-Launch Requirement

Liberty County is the reference implementation. All 28 currently supported Gridly counties must receive comparable governed destination coverage and certification before public launch. An owned provider boundary is also a formal pre-launch requirement.

### 13. Tests Performed

Static contracts cover the three-attempt provider limit, fifteen-candidate evaluation pool, five-row renderer, exact/approximate copy, audit APIs, and privacy boundaries. Deterministic governance tests cover the medical and City Hall duplicates, aliases, category disagreement, coordinate disagreement, same-address departments, and provider-only/curated-only results. Locality contracts cover local reservation and explicit out-of-area preservation. Manual browser testing remains required because source tests cannot certify a live provider response or route-preview rendering.

### 14. Files Changed

`index.html` loads the governance module; `js/lp097-search-governance.js` owns pure cross-source identity; `js/app.js` connects dedupe, locality reservation, provider evidence, selection evidence, and certification; LP097.1 tests and this document establish contracts.

### 15. Known Limitations

Direct-browser Nominatim remains temporary and provider coverage remains data-dependent. Governed destination inventory is not expanded beyond Liberty County in this patch. Ambiguous possible duplicates intentionally remain visible. Browser and mobile portrait certification cannot be fabricated by deterministic tests.

### 16. Merge Recommendation

LP097.1 may be safe to merge after the exact browser certification below passes in a production-like browser and mobile portrait checks pass. It is not sufficient for public launch and does not authorize public launch.

### Exact browser certification block

```js
(() => {
  console.clear();

  const record =
    typeof window.gridlyRecordLp097BrowserCertification === "function"
      ? window.gridlyRecordLp097BrowserCertification({
          addressExactResultObserved: true,
          addressRank: 1,
          addressCoordinateValidityPass: true,
          addressRouteHandoffPass: true,
          curatedMedicalResultObserved: true,
          curatedGovernmentResultObserved: true,
          duplicateMedicalResultResolved: true,
          localityPriorityPass: true,
          distantFallbackPreserved: true,
          privatePersistencePass: true
        })
      : null;

  const audit = typeof window.gridlyLp097AddressResolutionAudit === "function"
    ? window.gridlyLp097AddressResolutionAudit()
    : record;
  const checks = {
    auditAvailable: !!audit,
    milestoneCorrect: audit?.milestone === "LP097.1" || audit?.milestone === "LP097",
    passive: audit?.passive === true,
    productionIsolationPreserved: audit?.productionIsolationPreserved === true,
    addressIntentDetectionAvailable: audit?.addressIntentDetectionAvailable === true,
    countyRoadNormalizationAvailable: audit?.countyRoadNormalizationAvailable === true,
    exactAddressRankingPass: audit?.exactAddressRankingPass === true,
    crossSourceDeduplicationAvailable: audit?.crossSourceDeduplicationAvailable === true,
    duplicateMedicalResultResolved: audit?.duplicateMedicalResultResolved === true,
    localityPriorityAvailable: audit?.localityPriorityAvailable === true,
    distantResultSuppressionAvailable: audit?.distantResultSuppressionAvailable === true,
    explicitOutOfAreaQueryPreserved: audit?.explicitOutOfAreaQueryPreserved === true,
    providerRequestObservedThisSession: audit?.providerRequestObservedThisSession === true,
    providerResponseObservedThisSession: audit?.providerResponseObservedThisSession === true,
    providerResultRenderedThisSession: audit?.providerResultRenderedThisSession === true,
    browserAddressResultObserved: audit?.browserAddressResultObserved === true,
    browserCuratedDestinationObserved: audit?.browserCuratedDestinationObserved === true,
    browserRouteHandoffObserved: audit?.browserRouteHandoffObserved === true,
    browserPrivatePersistenceCheckRecorded: audit?.browserPrivatePersistenceCheckRecorded === true,
    temporaryBoundaryDocumented: audit?.temporaryDirectProviderBoundaryActive === true,
    ownedBoundaryRequirementPreserved: audit?.ownedProviderBoundaryRequiredBeforePublicLaunch === true,
    publicLaunchStillBlocked: audit?.safeForPublicLaunch === false,
    protectedSystemsUnchanged: audit?.sharedReportsUnchanged === true && audit?.routeWatchUnchanged === true && audit?.awarenessFilteringUnchanged === true && audit?.hazardLifecycleUnchanged === true && audit?.alertGenerationUnchanged === true && audit?.supabaseSyncUnchanged === true && audit?.historicalIntelligenceUnchanged === true && audit?.crossingInteractionsUnchanged === true && audit?.savedPlacesUnchanged === true && audit?.homeWorkPersonalizationUnchanged === true,
    deterministicAssessmentPass: audit?.deterministicAssessmentPass === true,
    safeToMerge: audit?.safeToMerge === true
  };
  const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  console.table(checks);
  console.log("Full LP097.1 audit:", audit);
  if (failedChecks.length) {
    console.error("❌ LP097.1 BROWSER CERTIFICATION FAILED", failedChecks);
    return { passed: false, failedChecks, audit };
  }
  console.log("✅ LP097.1 BROWSER CERTIFICATION PASSED — SAFE TO MERGE");
  return { passed: true, failedChecks: [], audit };
})();
```

### Exact mobile portrait testing steps

Use a fresh private/incognito session at approximately 390 × 844 CSS pixels.

1. **Complete address:** manually enter the owner-provided address (never place it in console); verify the exact address is first, says **Exact address**, no highway precedes it, selection has valid coordinates, route preview opens, and raw input is not persisted.
2. **Medical deduplication:** search `Liberty-Dayton Medical`; verify one real-facility choice, the governed result survives with **Medical**, and route preview opens.
3. **Locality priority:** search `Dayton city`; verify Dayton City Hall precedes unrelated distant results, Dayton City Park remains visible when relevant, and Colorado does not displace strong local matches.
4. **Out-of-area:** separately search `Houston City Hall`, `Denver City Hall`, and `Dayton Ohio`; verify each explicit geography is respected.
5. **Curated destinations:** select Dayton City Hall, Liberty County Courthouse, Liberty-Dayton Regional Medical Center, Cleveland Emergency Hospital, Dayton Police Department, Liberty County Sheriff's Office, US Post Office Dayton, Jones Public Library, Dayton High School, Walmart Supercenter Liberty, Dayton City Park, and Liberty Municipal Airport. For each verify canonical/alias match, community, category, valid coordinates, no duplicate, precedence over generic roads, and route preview.
6. **Regressions:** verify US 90, TX 146, County Road, Saved Places, Home, Work, Favorites, Route Watch, crossing alert focus, Reporting, and Awareness Filtering.
7. Only after all checks pass, run the certification block and retain pass/fail evidence only—never the private address.
