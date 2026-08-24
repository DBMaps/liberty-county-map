# LP233 owner browser acceptance

Select the requested canonical community and its explicit governed county in the normal UI, then run this same passive block. Repeat it for Katy (Harris, Fort Bend, and Waller), Corpus Christi, Austin, Abilene, Midland, Sulphur Springs, Liberty, Fredericksburg, and Pecos.

```js
await window.gridlyCanonicalCrossingRuntime.load();
const lp233 = window.gridlyLP233CanonicalCrossingRuntimeAudit();
console.table({
  canonicalCommunity: lp233.canonicalCommunity,
  canonicalKey: lp233.canonicalKey,
  placeGeoid: lp233.placeGeoid,
  selectedMembership: lp233.selectedMembership,
  allGovernedMemberships: lp233.allGovernedMemberships.join(", "),
  activeCounty: lp233.activeCounty,
  certifiedCrossingCount: lp233.certifiedCrossingCount,
  resolvedRuntimeCrossingCount: lp233.resolvedRuntimeCrossingCount,
  watchedCount: lp233.watchedCount,
  crossingIds: lp233.crossingIds.join(", "),
  crossingsBySourceCounty: JSON.stringify(lp233.crossingsBySourceCounty),
  missingCertifiedCrossingIds: lp233.missingCertifiedCrossingIds.join(", "),
  renderedMarkerCount: lp233.renderedMarkerCount,
  renderingSeparatedFromWatchedMembership: lp233.renderingSeparatedFromWatchedMembership,
  selectedMembershipInvariant: lp233.selectedMembershipInvariant,
  governancePreserved: lp233.governancePreserved,
  overallPass: lp233.overallPass
});
lp233;
```

The runtime artifact is precached with the shell. The first online visit refreshes it with the LP233 cache revision; subsequent launches can resolve canonical crossing membership offline without geometry, polling, or county switching.
