# V798 County Boundary And Map Camera Isolation

## Summary

V798 isolates county boundary rendering to the active county feature and moves the map camera whenever active county context changes. Jefferson County uses runtime county id `jefferson-tx`, GEOID `48245`, and seeded awareness areas only: Jefferson County, Beaumont, Port Arthur, Nederland, and Port Neches.

Plain `Jefferson` remains unsupported because it is ambiguous with Jefferson, Texas town/city and does not explicitly resolve to Jefferson County.

## Evidence

See `docs/certifications/evidence/V798-county-boundary-and-map-camera-isolation.json`.

## Browser Console Certification

Expected console checks:

```js
window.gridlySetActiveCountyContext?.("jefferson-tx")
window.gridlyGetActiveCountyRuntimeSources?.()
window.gridlyCountyBoundaryOverlayAudit?.()
window.gridlySetAwarenessAreaForTest?.("Beaumont")
window.gridlySetAwarenessAreaForTest?.("Port Arthur")
window.gridlySetAwarenessAreaForTest?.("Nederland")
window.gridlySetAwarenessAreaForTest?.("Port Neches")
window.gridlySetAwarenessAreaForTest?.("Jefferson")
```

Expected audit values include `activeCountyId: "jefferson-tx"`, `activeCountyGeoid: "48245"`, `activeBoundaryLayerCount: 1`, `activeBoundaryRenderedFeatureCount: 1`, `activeBoundaryRenderedGeoids: ["48245"]`, `passiveCountyBoundaryRendered: 0`, and `mapCameraCountyPass: true` after the map camera is fitted or centered.
