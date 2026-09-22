# LP244.47A roadway incident semantic correction

Starting HEAD: 9ac13c47b18d0f3267a40d2194aebda5c8a453df
Branch: LP244.47-marker-system-unification
Starting working tree: clean.

## RCA reported before modification
The registry aliased txdot_incident and roadway_incident to txdot_other. The txdot_other visual definition used 28-travel-advisory.png. The official renderer also returns txdot_other for unclassified records. Tests and the consolidation review board encoded the same incorrect assumption.

## Narrow correction
The registry now gives Travel Advisory its own explicit travel_advisory definition, with travel_advisory and txdot_travel_advisory input aliases. Generic incident, roadway_incident, txdot_incident and txdot_other resolve to other_hazard / Other Hazard / 16-other-hazard.png. Case and separator normalization continues to support ROADWAY_INCIDENT and Roadway Incident.

The shared renderer consumes the corrected registry without app.js changes. Specific recognized crash, flooding, construction and authority-supported closure remain specific. Generic wrappers with explicit travel advisory taxonomy can still select Travel Advisory. No standalone Roadway Incident visual is introduced. Raw normalization, provenance, lifecycle and geometry are unchanged. Impassable → Blocked and Fallen Tree → Debris compatibility remains intact.

## Validation
Focused LP244.47 marker + normalization suites: 50 passed, 0 failed.
Existing broader LP244.47 suites: 74 passed, 0 failed.
All 28 hazard/reference PNGs and 3 navigation PNGs match the starting Git commit byte-for-byte (SHA-256), as well as the prior approved source manifest. No PNG was edited or regenerated.
Local browser review: all images loaded; four consolidation cards verified; generic incident card uses #16 and explicit advisory card uses #28. Board screenshot refreshed from HTML using original asset URLs.

## Exact changed files
- js/gridlyMarkerRegistry.js
- tests/lp24447-marker-system.test.cjs
- tools/lp24447-png/review-board.cjs
- reports/lp24447-png-implementation.md
- reports/lp24447a-semantic-focused-tests.txt
- reports/lp24447a-semantic-broader-tests.txt
- reports/lp24447a-semantic-correction.md

Local ignored outputs refreshed:
- .artifacts/lp24447-approved-png-review/index.html
- .artifacts/lp24447-approved-png-review/review-board.png

Open the HTML directly in a browser. Rebuild with node tools/lp24447-png/review-board.cjs.

No approved artwork, backend, production state, reporting activation, native artifacts, push, merge or deployment changes.
