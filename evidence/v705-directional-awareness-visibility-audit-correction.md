# V705 Directional Awareness Visibility Audit Correction

## Summary

V704 directional awareness candidates and service-layer records can exist without proving that directional wording is actually visible to users. The corrected audit now uses `document.body.innerText` as the visibility source for `userVisible` and `visibleDirectionalCards`.

## Before

Browser validation showed the audit could report candidate-derived visibility:

```json
{
  "enabled": true,
  "visibleDirectionalCards": 4,
  "candidateCount": 164,
  "reviewExcludedCount": 81,
  "containmentPass": true,
  "bearingProtectionPass": true,
  "failClosedPass": true,
  "displayFormat": "corridor-first",
  "userVisible": true
}
```

But DOM checks returned no visible directional wording:

```js
[...document.body.innerText.matchAll(/\b(Northbound|Southbound|Eastbound|Westbound)\b/g)].map(m => m[0])
// []

document.body.innerText
  .split('\n')
  .filter(t => /Northbound|Southbound|Eastbound|Westbound/.test(t))
// []
```

## After

When the same DOM checks return empty arrays, the audit is expected to report DOM-derived non-visibility:

```json
{
  "enabled": true,
  "visibleDirectionalCards": 0,
  "candidateCount": 164,
  "reviewExcludedCount": 81,
  "containmentPass": true,
  "bearingProtectionPass": true,
  "failClosedPass": true,
  "displayFormat": "corridor-first",
  "userVisible": false,
  "domDirectionalTextMatches": [],
  "visibleDirectionalTextSamples": [],
  "visibilitySource": "none",
  "candidateVisibilityMismatch": true
}
```

If visible DOM text later includes full directional wording (`Northbound`, `Southbound`, `Eastbound`, or `Westbound`), the audit counts only those `document.body.innerText` matches and identifies `visibilitySource` as `dom-text`.

## Report

This correction does not add new directional UI, route guidance, routing behavior, hazard generation, Supabase behavior, county activation, or protected-system changes. It only corrects the audit contract so V704 service/candidate availability remains separate from proven user-visible directional rendering.
