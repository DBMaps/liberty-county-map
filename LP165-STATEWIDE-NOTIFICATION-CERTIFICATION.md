# LP165 — Statewide Notification Certification

## Purpose and decision boundary
LP165 certifies the existing **notification-content contract** behind Know Before You Go: consumer meaning, location quality, freshness, uncertainty, lifecycle, and destination/route/Route Watch relevance. It does not implement or certify operating-system delivery, push, tokens, permissions, background execution, manufacturing, runtime expansion, deployment, or activation.

## Authoritative baseline
The branch baseline audited was commit `363b7db652cc6b4d4c084029f6fcfb60accd16ea`, containing completed LP160–LP164.1 evidence. The container branch was named `work` and had no `origin/main` ref; this environmental discrepancy is disclosed rather than concealed. Pre-existing untracked Android build caches and `node_modules` were not modified or committed.

## Architecture inventory

### Notification preferences
`js/app.js` stores Smart Alert preferences in local storage under `gridlySmartAlertsV1`. Existing settings cover route, rail, hazard, community, and confirmation-related choices. Preferences are user-interface state; they are not delivery subscriptions.

### Alert-generation and consumer wording path
The current production path normalizes active hazards and community reports in `js/app.js`, filters them through the selected awareness area and route/destination relevance, and presents consumer copy in alert cards, Awareness Brief, Community Pulse, Know Before You Go, destination intelligence, route intelligence, and Route Watch. Existing audit helpers include notification preference/architecture, location specificity, reference road, language consistency, freshness, confidence, lifecycle, cleared persistence, destination awareness, route intelligence, Community Pulse, and Know Before You Go audits. They are supporting observations; LP165 fixtures independently exercise the governed contract.

Road/crossing selection prefers a named public crossing, numbered highway/FM/county road, named public street, landmark, then community-only evidence. Certification never substitutes a centroid, midpoint, inferred road, or nearby road. Crossing packages and classifications remain authoritative and unchanged.

### Delivery architecture status
A PWA service worker exists for application-shell caching, but it has no push-event handler. Repository audit found no `Notification.requestPermission`, `new Notification`, PushManager subscription, Firebase Messaging, APNs, notification-token storage, native notification delivery, or background notification delivery. Therefore content can be certified offline, but live notification delivery is **not implemented and not certified**.

Network/Supabase/browser/native dependencies are excluded from deterministic verification. Live incident sources and browser/device execution require owner-controlled validation and are not counted as PASS.

## Consumer contracts

### Title and body
A title must explain the event or condition. A body must contain a governed useful location plus qualified freshness and trust/state language. Raw enums, source fields, coordinates, internal identifiers, duplicate location phrases, and unsupported NB/SB/EB/WB labels are prohibited.

### Location quality and road policies
The governed hierarchy is: named public crossing; numbered interstate/U.S./state/FM/county road; named public street; recognizable landmark; road/crossing plus community; community only when no safer specific evidence exists. Private roads, unnamed/unknown roads, industrial, rail-yard, and temporary-access labels are truthfully suppressed. No better-sounding location is invented.

### Freshness and trust
Zero-minute evidence uses “Updated just now”; recent evidence uses deterministic minutes/hours; evidence older than two hours says conditions may have changed. Invalid or future elapsed times fail as invalid incidents. One active report awaits additional reports; multiple reports may be community confirmed; conflicts explicitly state that reports conflict; older evidence stays qualified; cleared evidence says recently cleared. Reports remain evidence, not proof.

### Cleared conditions
Cleared fixtures are ineligible for active notifications, absent from active queues, do not rehydrate, and require new active evidence to reactivate. Recently-cleared content is a separate qualified state.

### Destination, route, and Route Watch
Exact destination/route identity is required. County membership alone is insufficient. Unrelated destination hazards, invalid route geometry, and failed/straight-line fallback routes are suppressed. Route Watch requires valid governed route identity and geometry; it does not activate from failed geometry.

## Representative counties and cases
Sixteen counties were deterministically selected, ordered by ascending FIPS: Brewster, Cameron, Dallas, El Paso, Fort Bend, Galveston, Harris, Jefferson, Liberty, Loving, Lubbock, Montgomery, Potter, Tarrant, Travis, and Webb. The cohort covers Panhandle, West/Central/North/South Texas, border, Gulf Coast, East Texas, dense metros, small rural communities, and crossing/destination-density variation. Liberty is mandatory.

Forty-two governed synthetic certification cases (explicitly not real incidents) cover 32 public active/cleared county cases plus public Route Watch, invalid route, unrelated destination, malformed metadata, missing location, private road, unnamed road, industrial, rail-yard, and temporary-access cases. Ordering is county FIPS, context, incident type, location class, normalized title, fixture ID.

## Deterministic boundary and protected artifacts
All reports use `1970-01-01T00:00:00.000Z`, sorted keys/arrays, canonical LF, stable IDs, and no network or machine paths. Verification generates twice in isolated temporary directories, compares both runs and governed bytes, reports path/hashes/first differing byte, detects mutable-state leakage, and confirms repository reports were not rewritten.

Tracked protected artifacts use canonical Git-blob bytes, preserving LP164.1 behavior across Windows CRLF conversion. Protection includes prior milestone summaries and tooling, `js/app.js`, service worker, address/destination/crossing/roadway manifests, routing/awareness evidence, and operational boundaries. Ignored outputs and dependencies are excluded.

## Results
- Representative counties: **16**
- Notification cases: **42**
- Eligible active cases: **18 PASS**
- Eligible cleared cases: **16 PASS**
- Truthful suppressions: **8 PASS**
- Consumer title/body, location quality, freshness, trust, geographic relevance: **PASS**
- Private-road, unnamed-road, technical metadata, duplicate-location, directional leakage failures: **0**
- Route Watch, destination relevance, route relevance, lifecycle: **PASS**
- Liberty preservation, including `274 County Road 677` as `NO_VERIFIED_RESULT`: **PASS**
- Determinism and canonical Git-blob identity: **PASS**

## Defects and patches
No production notification-content defect was proven. No runtime patch was required or applied. LP165 adds certification tooling, governed fixtures/reports, tests, scripts, and this documentation only.

## Remaining blockers and final classification
Operating-system notification delivery does not exist. Live device delivery, background execution, and live notification evidence remain outside deterministic scope and require future owner-controlled implementation/validation. This is not a content failure.

**Final classification: `CONDITIONALLY_CERTIFIED_LIVE_DELIVERY_NOT_IMPLEMENTED`.**

Runtime is **UNCHANGED**. Deployment is **UNAUTHORIZED**. Activation is **UNAUTHORIZED**.

## Owner validation (Windows PowerShell 5.1)
```powershell
Set-Location C:\GitHub\liberty-county-map
git branch --show-current
if (git status --porcelain) { throw "Working tree must be clean before validation" }
npm run certify:lp165
npm run verify:lp165
npm run test:lp165
npm run certify:lp164; npm run verify:lp164; npm run test:lp164
npm run certify:lp163; npm run verify:lp163; npm run test:lp163
npm run verify:lp162; npm run test:lp162
npm run verify:lp161; npm run test:lp161
npm run verify:lp1611; npm run test:lp1611
npm run verify:lp160; npm run test:lp160
npm run test:lp1601m
if (git status --porcelain) { throw "Certification or verification changed the working tree" }
git --no-pager log --oneline -5
```
