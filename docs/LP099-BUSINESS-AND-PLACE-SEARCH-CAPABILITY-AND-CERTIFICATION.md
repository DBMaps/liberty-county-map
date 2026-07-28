# LP099 — Business and Place Search Capability and Certification

## 1. Executive Summary
LP099 extends the LP097 destination pipeline with a distinct `business_place` intent, conservative consumer aliases, named-place ranking, category presentation, and a deterministic 112-query certification set spanning all 28 LP098 counties. It continues to use the existing remote place provider; it does not create a business directory or replace governed destinations.

## 2. Search Sources
Saved Places (including Home, Work, and Favorites), LP097/LP098 governed destinations, existing local seeds, recent results, and OpenStreetMap Nominatim provider results remain active. LP099 adds no provider and removes no source.

## 3. Business Search Model
LP099 recognizes named businesses and place categories separately from numbered address intent. Apostrophes, hyphens, and spacing are normalized only for a bounded alias list: H-E-B/HEB, Home Depot/HomeDepot, McDonald's/McDonalds, Buc-ee's/Bucees, Lowe's/Lowes, and Chick-fil-A/Chick fil A. The model classifies provider results into consumer categories without exposing provider metadata.

## 4. Ranking
The score extension preserves the LP097 model and adds tiers for saved exact, governed exact, exact business, strong alias, and fallback matches. Exact named businesses receive a material boost and road results receive a penalty, so a matching road cannot outrank an exact business. A governed record representing the same place remains the deduplication survivor.

## 5. Locality
Existing awareness-area, Home/map anchor, county containment, explicit locality, Texas, and distance signals remain authoritative. Business intent uses provider search without bounded suppression, so an explicit out-of-area named-place query remains eligible.

## 6. Representative Certification
The immutable dataset contains four searches for each of 28 counties (112 total): a governed/public destination, a representative business, a hospital/public place, and a pharmacy/approximate or out-of-area case. Brands rotate across retail, grocery, restaurant, fuel, pharmacy, hotel, bank, and church. Deterministic tests additionally certify aliases, restaurant/pharmacy categories, address separation, source precedence, and road demotion. This is representative capability certification, not a promise that a third-party provider contains every business at all times.

## 7. Browser Certification
After loading `index.html`, run this exact console block:

```js
(() => {
  const audit = window.gridlyLp099BusinessSearchAudit?.();
  const passed = Boolean(
    audit?.available === true &&
    audit?.milestone === "LP099" &&
    audit?.businessSearchAvailable === true &&
    audit?.governedDestinationSearchAvailable === true &&
    audit?.providerBusinessSearchAvailable === true &&
    audit?.representativeBusinessQueries >= 100 &&
    audit?.representativeBusinessPasses === audit?.representativeBusinessQueries &&
    audit?.certifiedCountyCount === 28 &&
    audit?.businessAliasCertificationPassed === true &&
    audit?.businessRankingCertificationPassed === true &&
    audit?.duplicateBusinessResults === 0 &&
    audit?.addressSearchRegressionDetected === false &&
    audit?.routePreviewRegressionDetected === false &&
    audit?.protectedSystemsUnchanged === true &&
    audit?.safeToMerge === true
  );
  console.table(audit);
  console.log(passed ? "✅ LP099 BROWSER CERTIFICATION PASSED — SAFE TO MERGE" : "❌ LP099 BROWSER CERTIFICATION FAILED", audit);
  return { passed, audit };
})();
```

For consumer-visible spot checks, search `Walmart Liberty`, `H-E-B Cleveland`, `Buc-ee's Baytown`, `McDonald's Liberty`, `First Baptist Church Dayton`, `Houston Hobby Airport`, and `Walmart Dallas`; confirm the named place is above roads and select one coordinate-valid result to confirm the unchanged route-preview handoff.

## 8. Protected Systems
Shared Reports, Route Watch, LP097 address resolution, the LP098 inventory, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase Sync, Historical Intelligence, Official Source Integration, crossing interactions, Saved Places, Home, Work, Favorites, Reporting, and Notifications are unchanged. LP099 calls the existing destination selection and route-preview path.

## 9. Known Limitations
Live business completeness, hours, closure status, and spelling depend on existing provider data and availability. The browser audit certifies shipped model wiring and deterministic representative cases; consumer spot checks certify the live provider response. No thousands-entry business snapshot is shipped. Department-within-business duplicate identity remains conservatively distinct.

## 10. Files Changed
`js/lp099-business-search.js` owns the bounded model, dataset, and browser audit. `js/app.js` wires intent, ranking, and category display. `index.html` loads LP099 before the application. `tests/lp099-business-and-place-search.test.js` provides deterministic certification. `package.json` exposes the test. This document records the milestone.

## 11. Tests
Run `npm run test:lp099`, all LP097/LP098 regression suites, and JavaScript syntax checks for the application and LP099 module.

## 12. Merge Recommendation
Recommend merge when deterministic suites pass and the exact browser console block returns `passed: true`. Live provider spot checks should show named places above roads, no governed/provider duplicate, and successful selection into the existing route preview.
