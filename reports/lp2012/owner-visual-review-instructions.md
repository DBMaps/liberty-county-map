# LP201.2 Owner Visual Review Harness

This is an audit-only, owner-operated browser-console harness. It reads the certified inactive WhatIf and calls only the live Leaflet map's `setView` method. It does not dispatch a semantic camera, persist state, or load during normal application startup.

## Start and install

Start the existing local server (for example, `npm run dev` if that is the server command used for the checkout), open Gridly, open Developer Tools → Console, and run:

```js
await import("/tools/lp2012/owner-visual-review.mjs").then(m => m.installLp2012VisualReview())
```

## Review commands

```js
gridlyLp2012VisualReview("Dayton") // exact unique name
gridlyLp2012VisualReview("4819432") // exact canonical GEOID
gridlyLp2012ShowCurrent()
gridlyLp2012ShowProposed()
gridlyLp2012RequiredCohort()
gridlyLp2012TopDistance() // deterministic top 10 proposed changes
```

Names are exact and case-sensitive. An ambiguous name fails closed and reports matching identities; use a GEOID. `showProposed` fails closed for retained and unresolved records.

For Austin, Dallas, El Paso, and Fort Worth only, the explicitly non-promotable LP201.1 comparison can be displayed after selecting the PLACE:

```js
gridlyLp2012ShowComparison() // COMPARISON ONLY — OWNER CAMERA REMAINS AUTHORITATIVE
```

## Record and export audit-only findings

```js
gridlyLp2012RecordDecision("Dayton", "PASS_PROPOSED", "Optional owner note")
gridlyLp2012RecordDecision("Tyler", "RETAIN_CURRENT")
gridlyLp2012RecordDecision("Waco", "NEEDS_REVIEW", "Optional owner note")
copy(gridlyLp2012ExportDecisions())
```

The only accepted decisions are `PASS_PROPOSED`, `RETAIN_CURRENT`, and `NEEDS_REVIEW`. Decisions live only in memory, default to `PENDING`, and are never written to browser storage or production files. Reloading discards them unless the owner explicitly copies the export.

This harness does not constitute visual certification, runtime activation, or permission to alter camera authority.
