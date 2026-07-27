# LP084 — Historical Narrative Input Assembly & Selection Governance Handoff

## Executive summary and completed deliverables

LP084 adds a deterministic, explicitly invoked, in-memory assembly boundary between governed LP082 retrieval/LP083 sessions and LP068. It validates both inputs, preserves retrieval order and evidence, selects the most geographically specific available subject, prepares duration and LP069 ranking evidence, creates a governed quiet package, and returns a recursively frozen narrative-input contract. It generates, ranks, and presents no narrative.

Delivered are the versioned contract; eight-stage fail-closed pipeline; candidate, subject, context, duration, quiet, ranking-input, explainability, compatibility, fingerprint, policy-version, and diagnostic governance; focused Node regression coverage; and an isolated browser certification page. No production entry point or predecessor module changed.

## Narrative-input architecture and contract

The architecture remains **LP081 knowledge base → LP082 retrieval → LP083 session governance → LP084 input assembly → LP068 generation → LP069 ranking → LP070 presentation boundary**. LP084 accepts only an intact LP082 result referenced by a coherent LP083 session with matching knowledge fingerprint, request fingerprint, timezone, policies, and production-isolation metadata.

The `LP084.input.v1` result contains narrative input, request, session, retrieval and knowledge identities/fingerprints; ordered candidate identities and evidence; selected subject identity/type; normalized context; prepared ranking inputs; quiet state; explainability; compatibility metadata; contract/policy versions; duration evidence; package fingerprints; and passive diagnostics. Results and all nested members are copied and recursively frozen.

## Assembly, candidates, subject, and context

The fixed pipeline validates retrieval integrity, session coherence, compatibility, candidate identities, narrative evidence, ranking inputs and quiet state before constructing the immutable input. A failure returns a stable, frozen, fail-closed code; there is no migration or partial assembly.

Candidates retain LP082 order and identity and copy only retrieved context and relevance, quality, lifecycle, and ranking evidence. No candidate is invented and input candidates are never mutated. Subject selection checks crossing, roadway, awareness area, community, then county—the governed geographic specificity order. Context normalizes county, community, awareness area, roadway, crossing, canonical timezone, and explicitly requested historical time, using `null` for absent values.

## Duration, quiet state, and ranking preparation

Duration eligibility is evidence preparation only: each candidate records historical consistency/evidence strength, quality and lifecycle stability and is eligible only when all three contain positive governed evidence. LP068 retains all wording authority.

A quiet package is always assembled. It records whether retrieval was quiet, normalized context, retrieval identity/considered evidence, rejection summaries, the LP082 quiet reason, internal reasoning, and its own fingerprint—never consumer copy. Ranking preparation maps each candidate without sorting to relevance, specificity, quality, lifecycle stability, evidence strength, geographic precision, and time relevance. LP069 remains the ranking authority.

## Explainability, compatibility, fingerprints, policies, and diagnostics

Internal explainability records the retrieval summary, all eight assembly stages, included/excluded candidates, subject selection, duration decisions, quiet reasoning, and fingerprints. Compatibility metadata explicitly preserves LP068, LP069, LP070, LP082, LP083 and isolation boundaries. Validation fails closed on mutated retrievals, incoherent sessions, unreferenced results, stale knowledge/timezone context, or incompatible retrieval metadata.

Deterministic canonical serialization and FNV-1a fingerprints cover the narrative input, candidate assembly, context, quiet, ranking, and explainability packages and change on material mutation. Explicit `v1` policies govern contract, assembly, candidates, subject selection, duration, quiet state, ranking inputs, and explainability; every policy must exactly match and unsupported versions reject without migration.

Frozen passive diagnostics report assembly readiness, candidate count, subject, aggregate duration eligibility, quiet readiness, compatibility, all fingerprints, policy compatibility, and production isolation. They perform no logging, telemetry, storage, scheduling, networking, or automatic execution.

## Browser certification (manual final merge gate)

From the repository root run:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/tests/lp084-browser-certification.html`, open the browser console, and execute the complete block displayed on that page:

```js
(() => {
  const result = window.gridlyLp084HistoricalNarrativeInputCertificationAudit();
  const required = ["passive","productionIsolationPreserved","narrativeInputContractAvailable","assemblyPipelineAvailable","candidateAssemblyAvailable","subjectSelectionAvailable","contextAssemblyAvailable","durationGovernanceAvailable","quietStateAssemblyAvailable","rankingPreparationAvailable","explainabilityAvailable","compatibilityValidationAvailable","fingerprintGovernanceAvailable","policyVersionGovernanceAvailable","diagnosticsAvailable","deterministicNarrativeInputPass","lp068CompatibilityPreserved","lp069CompatibilityPreserved","lp070CompatibilityPreserved","lp082CompatibilityPreserved","lp083CompatibilityPreserved","activationStillDisabled","protectedSystemsUnchanged","safeToMerge"];
  const rows = required.map(check => ({check, pass: result[check] === true}));
  console.table(rows);
  const failed = rows.filter(row => !row.pass).map(row => row.check);
  console.log(failed.length ? "❌ LP084 BROWSER CERTIFICATION FAILED" : "✅ LP084 BROWSER CERTIFICATION PASSED — SAFE TO MERGE", failed);
  return result;
})()
```

The audit exposes every required Boolean, derives `safeToMerge` from every preceding check, tables the result, reports failures, and prints `✅ LP084 BROWSER CERTIFICATION PASSED — SAFE TO MERGE` only on complete success.

## Regression, protected systems, and production isolation

`npm run test:lp084` covers supported/unsupported versions, deterministic identity and insertion-order independence, retrieval-ordered candidates, deterministic subject selection, immutable context and recursive freezing, duration and quiet decisions, ranking preparation, explainability, material-mutation fingerprints, fail-closed integrity/coherence, predecessor compatibility, activation state, and absence from `index.html`/`js/app.js`. LP068, LP069, LP070, LP082, and LP083 regression suites provide the requested compatibility gates.

Protected production systems—including Community Pulse, Travel Brief, alert rendering, Shared Reports, Route Watch, awareness filtering, hazard lifecycle, alert generation, Unified Evidence, Destination Intelligence, and Supabase synchronization—remain untouched. LP084 is detached from `index.html` and `js/app.js`; it has no UI, consumer copy, storage, network, telemetry, clock, randomness, identity, scheduled/background work, or production activation.

## Merge recommendation, program status, and next milestone

Merge is recommended after all six automated commands and the manual browser gate pass. Historical Intelligence now includes observation, learning, archive, lifecycle, quality, knowledge, deterministic retrieval, coherent sessions, and deterministic narrative-input infrastructure, while remaining disabled, detached, non-consumer, non-presentational, and historical-only.

The next milestone must not reinterpret LP082 order/evidence, bypass LP083 coherence, move wording from LP068, move ranking from LP069, move DTO authority from LP070, automatically migrate policies, or activate production. It must preserve immutable deterministic inputs, fail-closed compatibility, explicit invocation, current-alert authority, non-predictive historical context, and complete production isolation.
