# LP085 — Historical Narrative Generation Invocation Governance Handoff

## Executive summary and completed deliverables

LP085 adds the passive, deterministic execution boundary between LP084 narrative-input assembly and LP068 narrative generation. It validates an intact LP084 package, confirms LP068 compatibility, enforces explicit authorization and mode matching, creates an immutable invocation contract and plan, and returns a governance result without calling the generator. It generates no wording, ranks and presents nothing, and performs no production work.

Delivered are a versioned invocation contract; authorization and explicit lifecycle policies; nine-stage fail-closed input validation; LP068 compatibility evidence; deterministic planning, identity, duplicate prevention and idempotency; separately governed quiet packages; internal explainability; six governed fingerprint categories; passive diagnostics; focused regression coverage; and an isolated browser certification.

## Architecture and invocation contract

The program flow remains **LP082 retrieval → LP083 session → LP084 narrative input → LP085 invocation governance → LP068 generation → LP069 ranking → LP070 presentation boundary**. LP085 neither imports itself from a production entry point nor invokes LP068. LP068 remains the sole wording authority.

`LP085.invocation.v1` governs invocation, input/session/retrieval/request identities, knowledge and input fingerprints, mode, policies, authorization, lifecycle state, compatibility, lifecycle evidence and contract fingerprint. Contracts, plans, results, diagnostics, evidence, and failures are copied and recursively frozen.

## Authorization and lifecycle

Authorization is exactly `unauthorized`, `dry-run authorized`, or `generation authorized`. Unauthorized requests fail closed. Dry-run authorization matches only dry-run mode; generation authorization matches only generation mode. No default or inferred authorization exists.

Lifecycle states are created, validated, authorized, generation-ready, invoked, completed, rejected and interrupted. The transition table permits only explicit adjacent policy transitions and returns a frozen failure for invalid transitions. A successful plan records each transition through generation-ready; it remains `invoked: false`, because this milestone governs rather than executes generation.

## Validation and LP068 compatibility

The fixed validation stages cover contract version, self-fingerprint integrity, candidates, context, subject, duration evidence, ranking inputs, quiet state, and explainability. Any failed stage rejects the entire request. Compatibility separately records the intact LP084 contract, LP068/LP069/LP070 declarations, production isolation, and availability/version of LP068 authority without modifying it.

## Planning, duplicate prevention, and idempotency

Plans include the validated input identity/fingerprint, authorization, mode, expected narrative type, quiet path, duration eligibility, validation and compatibility evidence, quiet package, and invocation fingerprint. Canonical key-sorted serialization makes identities, plans, evidence, and results independent of insertion order. Equivalent authorized requests therefore converge on one invocation identity and byte-equivalent immutable governance result rather than duplicate work.

## Quiet invocation, explainability, fingerprints, and diagnostics

Quiet inputs take an explicit quiet-state path. Their package preserves deterministic quiet identity, retrieval evidence, reason, context, compatibility, source fingerprint and package fingerprint; it contains no generated quiet wording.

Internal explainability records all validation stages, authorization, compatibility decisions, lifecycle state, quiet decision, duration eligibility, and invocation fingerprint. FNV-1a fingerprints govern the invocation contract, plan, compatibility, validation, quiet package and result and change on material mutation.

Nine exact-match `v1` policy versions govern the contract, authorization, lifecycle, validation, compatibility, duplicate prevention, idempotency, quiet handling and explainability. Unsupported versions reject; there is no migration. Passive recursively frozen diagnostics report authorization, lifecycle, validation, compatibility, readiness, duplicate prevention, idempotency, quiet readiness, fingerprints, policy compatibility, and isolation. They cause no I/O.

## Browser certification

From the repository root:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/tests/lp085-browser-certification.html`, open the browser console, and run the complete block displayed on the page. It calls `window.gridlyLp085HistoricalNarrativeInvocationCertificationAudit()`, verifies all 23 required fields, uses `console.table`, reports failures, and prints `✅ LP085 BROWSER CERTIFICATION PASSED — SAFE TO MERGE` only when every check passes. `safeToMerge` is derived from all preceding checks.

## Regression summary and protected systems verification

`npm run test:lp085` covers supported and unsupported policies, deterministic/insertion-order-independent identity, authorization and mode enforcement, all lifecycle paths, LP084 integrity validation, LP068 compatibility, immutable plans, duplicate prevention, idempotency, quiet handling, explainability, fingerprints, recursive freezing, predecessor compatibility, certification, production isolation, and absence from `index.html` and `js/app.js`. The LP068, LP069, LP070 and LP084 suites remain compatibility gates.

No protected production file or system was modified: Community Pulse, Travel Brief, alerts, Shared Reports, Route Watch, awareness filtering, hazard lifecycle, alert generation, Unified Evidence, Destination Intelligence and Supabase synchronization remain unchanged. LP085 has no UI, persistence, networking, telemetry, clocks, randomness, user/device identity, timers, schedules, background work, generator call, ranking call or production activation.

## Merge recommendation, program status, and next milestone constraints

Merge is recommended after the five requested automated commands and manual browser gate pass. Historical Intelligence now includes learning, knowledge, retrieval, session, narrative-input and invocation infrastructure, while remaining disabled, detached, non-consumer, non-presentational and production isolated.

The next milestone must not bypass authorization, validation, compatibility or lifecycle governance; reinterpret LP084 evidence; generate outside LP068; rank outside LP069; present outside LP070; migrate policies implicitly; create automatic/background invocation; or activate production. Determinism, explicit invocation, fail-closed behavior, historical-only context, immutable evidence and current-alert authority must remain intact.
