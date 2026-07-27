# LP086 — Historical Narrative Output Validation & Contract Governance Handoff

## Executive summary and completed deliverables

LP086 adds the passive, deterministic, fail-closed boundary after LP068 generation and before LP069 ranking. It supplies a recursively frozen, versioned output contract; allowlist normalization; integrity, grounding, language, subject, duration, quiet, completeness and compatibility validation; canonical duplicate governance; eligibility classification; explainability; fingerprints; policy governance; diagnostics; regression coverage; and isolated browser certification. It neither generates nor edits wording, ranks or presents output, activates Historical Intelligence, nor performs I/O.

## Architecture and output contract

The unchanged flow is **LP083 session → LP084 input → LP085 invocation → LP068 generation → LP086 validation → LP069 ranking → LP070 boundary**. LP068 remains the only generation authority; LP069 and LP070 retain ranking and presentation authority. LP086 is absent from production entry points.

`LP086.output.v1` governs output, invocation, input, retrieval, session and request identities; knowledge/input/invocation fingerprints; narrative type and subject; exact historical, duration and context statements; quiet package; provenance; compatibility; and policy versions. Canonical key-sorted serialization provides insertion-order independence. Missing optional duration/context/subject/quiet fields normalize to `null`; wording and punctuation are copied unchanged. Unknown fields reject rather than being silently retained. Every returned package is cloned and recursively frozen.

## Integrity, grounding, and historical language

Integrity checks exact policy/contract versions, canonical output identity, all upstream identities and fingerprints, type, quiet state, and required packages. Grounding binds subject/type to LP084/LP085, verifies context exactly, requires a provenance linkage, accepts only governed candidate identities, and requires the historical statement in the provenance support set. It invents no semantic evidence.

Deterministic patterns reject present/live-condition assertions, future or guaranteed assertions, reroute/avoid directives, and claims that a current alert exists. Approved historical language—including “historically,” “typically,” and “has often been reported”—is not rewritten. Failure returns stable sorted reason codes and the original wording remains visible only in the internal normalized contract.

## Subject, duration, quiet output, and completeness

Non-quiet output must retain LP084's exact selected subject identity/type and a historical statement. Generic substitutions such as “selected area,” “this location,” “nearby,” or “the region” reject. Duration is allowed only for the selected subject when LP084 evidence marks it eligible; one-minute artifacts and guaranteed/live timing reject. Duration is optional when ineligible.

Quiet output follows a separate contract: it must match LP084 quiet state and LP085 quiet identity/reason, have no subject or duration, and retain provenance, compatibility and fingerprints. LP086 creates no quiet wording. Contradictory quiet/non-quiet state fails closed. Complete non-quiet output becomes `ranking-eligible`, valid quiet output becomes `quiet-eligible`, and every failure becomes `rejected`; there is no partially valid pass-through.

## Compatibility, duplicate governance, explainability, and fingerprints

Compatibility requires explicit LP068, LP069, LP070, LP084, LP085 and production-isolation evidence. Equivalent content under the same invocation canonicalizes to the same output identity, result, reason codes, fingerprints and eligibility; no registry, cache or persistence is created.

Explainability records normalization stages and every validation family, duplicate evaluation, eligibility, stable reasons and fingerprints. Fingerprints cover normalized output, contract, grounding, language, duration, quiet, compatibility, explainability and final result, and materially change with governed mutation. Thirteen exact-match policy versions govern every requested policy family; unsupported versions reject and are never migrated. Frozen diagnostics expose statuses, eligibility, duplicate state, policy compatibility, fingerprints and isolation without logging, telemetry, analytics or networking.

## Browser certification and exact commands

From the repository root:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/tests/lp086-browser-certification.html`, then paste the complete console block displayed in that harness. It calls `window.gridlyLp086HistoricalNarrativeOutputCertificationAudit()`, tables all 27 required checks, lists failures, returns the complete result, and prints `✅ LP086 BROWSER CERTIFICATION PASSED — SAFE TO MERGE` only when all checks pass. `safeToMerge` is derived from all preceding certification fields, not independently hardcoded. Manual browser certification remains the final merge gate.

## Regression coverage and protected-system confirmation

`npm run test:lp086` covers version rejection, identity determinism, insertion ordering, recursive freezing, historical and quiet success, subject/type/statement/candidate failures, duration governance, prohibited language, provenance and fingerprints, contradictory state, all eligibility classes, deduplication, mutation detection, predecessor/downstream availability, certification and production-entry-point absence. LP068, LP069, LP070, LP084 and LP085 suites are compatibility gates; the broader historical suite provides practical regression coverage.

No protected production file was modified: `index.html`, `js/app.js`, Community Pulse, Travel Brief, alert rendering, Shared Reports, Route Watch, awareness filtering, hazard lifecycle, alert generation, Unified Evidence, Destination Intelligence and Supabase synchronization are unchanged. LP086 has no production storage, request, clock, randomness, identity, timer, schedule, worker, analytics, telemetry, logging, generation, ranking, presentation or activation path.

## Program status, merge gate, and next-milestone constraints

Historical Intelligence now includes isolated learning, knowledge, retrieval, session, narrative-input, invocation and output-validation infrastructure. It remains disabled, detached, non-consumer, non-presentational, unavailable to production surfaces, and production isolated. After automated regression commands pass, the branch is ready for the final manual browser gate; merge is recommended only after that gate passes.

The next milestone must consume only `ranking-eligible` or separately governed `quiet-eligible` results; never accept rejected/partial output, weaken exact policies, mutate wording, infer evidence, bypass LP084/LP085 linkage, generate outside LP068, rank outside LP069, present outside LP070, persist validation, schedule work, or activate Historical Intelligence.
