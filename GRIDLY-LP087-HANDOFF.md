# LP087 — Historical Narrative Ranking Input Governance Handoff

## Executive summary

LP087 adds a passive, deterministic, fail-closed governance boundary between validated LP086 narrative output and LP069 ranking. It registers only accepted validation results, classifies eligibility, suppresses identity-equivalent candidates, assembles immutable groups, and prepares (but never applies) stable tie-break evidence. Historical Intelligence remains disabled and detached from production.

## Completed deliverables and architecture

The isolated flow is LP084 input assembly → LP085 invocation governance → LP068 generation → LP086 output validation → **LP087 ranking-input governance** → LP069 ranking → LP070 presentation boundary. LP087 neither calls the ranking selector nor emits presentation content.

The `LP087.input.v1` contract includes ranking-input, narrative-output, invocation, narrative-input, retrieval, session, request, candidate, evidence, eligibility, compatibility, explainability, and fingerprint fields. Every returned package is recursively frozen.

## Registration, eligibility, grouping, and duplicates

`registerCandidate` accepts only successful LP086 validation results and preserves narrative type, subject, historical provenance, compatibility, and quiet/ranking eligibility. `classifyEligibility` produces `ranking-ready`, `quiet-ready`, or `rejected`; rejected entries never enter a group. `prepareRankingInput` sorts by canonical candidate identity, groups immutable references, and suppresses candidates only when both governed narrative-output identity and fingerprint match. Equivalent inputs therefore converge on registration identity, eligibility, and fingerprints.

## Tie-break preparation and explainability

LP087 records subject specificity, historical relevance, LP086 completeness quality, declared lifecycle stability, evidence strength, duration eligibility, and quiet state. These are evidence only: LP069 remains the ranking authority. Internal explainability covers registration, grouping, eligibility, duplicate evaluation, tie-break preparation, compatibility, and associated fingerprints.

## Compatibility, fingerprints, and policy versions

Compatibility fails closed unless LP069, LP070, LP086, and production-isolation declarations are available. FNV-1a fingerprints cover ranking input, registration, candidate group, eligibility, explainability, compatibility, and the final package; canonical serialization makes object insertion order irrelevant. Explicit v1 policies govern the contract, registration, eligibility, grouping, duplicates, tie-break evidence, compatibility, and explainability. Unsupported versions reject without migration.

## Diagnostics and production isolation

Recursively frozen diagnostics report registration and eligibility counts, duplicates, grouping identity, compatibility, fingerprints, policy compatibility, and production isolation. The module performs no networking, storage, telemetry, scheduled work, generation, ranking, presentation, or runtime-clock access. It is absent from `index.html` and `js/app.js`; protected consumer systems are unchanged.

## Browser certification

Open `tests/lp087-browser-certification.html`, open developer tools, and paste the single block displayed on the page. It runs `window.gridlyLp087HistoricalRankingInputCertificationAudit()`, verifies every required field, displays `console.table`, identifies failures, and prints `✅ LP087 BROWSER CERTIFICATION PASSED — SAFE TO MERGE` when complete.

## Regression summary and merge recommendation

Run:

```sh
npm run test:lp087
npm run test:lp069
npm run test:lp070
npm run test:lp086
```

Focused LP087 coverage verifies supported and unsupported versions, deterministic identity, insertion-order independence, recursive freezing, registration, all eligibility states, grouping, duplicate suppression, tie-break preparation, explainability, material-mutation fingerprints, downstream compatibility, production isolation, and absence from production entry points. With all four suites passing and the browser audit passing, LP087 is safe to merge as isolated infrastructure.

## Historical Intelligence program status and next milestone constraints

Historical Intelligence now contains learning, knowledge, retrieval, session, narrative-input, invocation, output-validation, and ranking-input infrastructure only. Activation remains disabled. The next milestone must consume only accepted LP087 packages, preserve LP069 as sole ranking authority and LP070 as sole presentation-boundary authority, remain deterministic and fail-closed, and must not attach this module to production without a separately governed activation milestone.
