# GRIDLY San Jacinto Activation Hardening Plan V647

## Mission Posture

```text
Know Before You Go

Awareness Platform First
Route Intelligence Second
```

## Documentation-Only Milestone

V647 is a documentation-only remediation and hardening plan for San Jacinto County following the V646 controlled activation failure and V646.4 activation hold. It does not activate San Jacinto, expose San Jacinto in selectors, create production awareness areas, alter Liberty behavior, alter Montgomery behavior, or modify protected systems.

San Jacinto remains:

- Runtime Onboarded
- Runtime Validated
- Activation Held
- Not Activated
- Not Operational
- Not Selectable
- Production Blocked

Protected systems remain unchanged:

- `historicalReadsEnabled`
- `historyUiEnabled`
- `DriveTexasPaused`
- `TransportationIntelligenceEnabled`
- `TransportationIntelligenceDisplay`
- `TransportationIntelligenceActivation`

---

## 1. Quick Summary

V646 browser validation found production-blocking San Jacinto issues that were not fully detected by onboarding, validation, readiness, authorization, or audit-only review. The browser findings override prior audit pass status for activation purposes.

V647 classifies five unresolved hardening blockers:

1. Boundary Verification
2. Report Visibility
3. Consumer Language
4. Count Reconciliation
5. Audit Reliability

San Jacinto is not activation-ready. Future activation work must first complete boundary and ownership hardening, language and count reconciliation hardening, browser validation audit, activation reauthorization, and only then a controlled activation retry.

---

## 2. Activation Blocker Analysis

### 2.1 Boundary Shape Credibility Failure

**Observed in V646 browser validation:**

- A county-specific San Jacinto boundary source loaded.
- Geometry quality audit passed.
- The displayed county shape did not appear visually correct.

**Finding:** Visual correctness must override an audit pass. A geometrically parseable or metadata-valid boundary is not sufficient for activation if browser validation indicates the rendered shape is not credible for San Jacinto County.

**Activation impact:** San Jacinto cannot be activated until the county boundary is verified against trusted provenance, expected county outline, ownership metadata, and browser-rendered visual correctness.

**Classification:** **BLOCKER**.

### 2.2 Report Visibility / Ownership Failure

**Observed in V646 browser validation:**

- San Jacinto report submissions did not consistently appear through the active county experience.

**Finding:** Report ownership and visibility must be hard-validated before activation. A report path that accepts or stores San Jacinto metadata is not sufficient unless submitted reports consistently appear across every intended user-facing San Jacinto surface.

**Activation impact:** San Jacinto cannot be activated until submitted San Jacinto reports consistently resolve through marker visibility, alert visibility, awareness visibility, county ownership, and refresh/persistence paths.

**Classification:** **BLOCKER**.

### 2.3 Awareness Language Regression

**Observed in V646 browser validation:**

- `Road Closed on Local road impact`
- `Road Closed Reported`

**Finding:** San Jacinto surfaced generic fallback language that should not appear in production county activation. Production-facing copy must identify useful location context, road names when known, and consumer-readable awareness language rather than fallback artifacts.

**Activation impact:** San Jacinto cannot be activated until Top Awareness, alert cards, alert detail, location wording, and road naming are hardened against generic placeholder text and fallback copy.

**Classification:** **BLOCKER**.

### 2.4 Count Reconciliation Failure

**Observed in V646 browser validation:**

- Alerts count did not match location card count.
- Location card count did not match awareness count.

**Finding:** Incident classification and count ownership are not fully aligned for San Jacinto. User-facing county counts must derive from a shared incident-level source and must not diverge by surface.

**Activation impact:** San Jacinto cannot be activated until marker counts, alert counts, awareness counts, and route/location counts reconcile from the same county-owned incident source.

**Classification:** **BLOCKER**.

### 2.5 Audit Reliability Gap

**Observed in V646 browser validation:**

- San Jacinto submission audit returned `not_applicable_no_attempt` during active browser testing.

**Finding:** Audit coverage did not accurately represent real runtime behavior. Activation audit output must match browser-observed report submission, ownership, visibility, and county behavior.

**Activation impact:** San Jacinto cannot be activated until report submission audits, visibility audits, ownership audits, and county audits represent actual browser-observed behavior.

**Classification:** **BLOCKER**.

---

## 3. Hardening Workstreams

### Workstream A — Boundary Verification

**Review required:**

- San Jacinto boundary source.
- County geometry provenance.
- Visual correctness.
- County ownership metadata.
- Browser-rendered county outline.
- Active-only rendering behavior.
- Liberty and Montgomery boundary regression safety.

**Required outcome:** Verified production-grade San Jacinto county boundary with trusted provenance, correct GEOID/county ownership, visually credible rendering, and no regression to active Liberty or Montgomery boundary behavior.

**Classification:** **BLOCKER until verified**.

### Workstream B — Report Ownership & Visibility

**Review required:**

- County assignment.
- Report ownership.
- Marker visibility.
- Alert visibility.
- Awareness visibility.
- Submitted-report refresh behavior.
- Persistence behavior.
- Cross-county containment.

**Required outcome:** Submitted San Jacinto reports appear consistently across all intended user-facing San Jacinto surfaces and remain isolated from Liberty and Montgomery contexts.

**Classification:** **BLOCKER until verified**.

### Workstream C — Consumer Language Hardening

**Review required:**

- Top Awareness wording.
- Alert card wording.
- Alert detail wording.
- Location wording.
- Road naming.
- Fallback suppression.
- Placeholder suppression.
- Browser-visible copy acceptance.

**Required outcome:** No production-visible `Local road impact`, generic placeholder wording, ambiguous fallback labels, or fallback language artifacts appear in San Jacinto activation paths.

**Classification:** **BLOCKER until verified**.

### Workstream D — Count Reconciliation Hardening

**Review required:**

- Marker counts.
- Alert counts.
- Awareness counts.
- Route/location counts.
- Incident classification ownership.
- Duplicate suppression.
- County-scoped count derivation.

**Required outcome:** All San Jacinto county surfaces derive counts from a shared incident-level source and reconcile consistently across markers, alert surfaces, awareness surfaces, and route/location surfaces.

**Classification:** **BLOCKER until verified**.

### Workstream E — Audit Reliability Hardening

**Review required:**

- Report submission audits.
- Visibility audits.
- Ownership audits.
- County audits.
- Browser-observed event coverage.
- Audit result naming and applicability.
- Audit mismatch escalation.

**Required outcome:** Browser-observed behavior matches audit output. Active San Jacinto browser testing must not produce `not_applicable_no_attempt` for attempted submission and visibility paths.

**Classification:** **BLOCKER until verified**.

---

## 4. Readiness Matrix

| Category | Status | Notes |
| --- | --- | --- |
| Boundary Verification | BLOCKER | County-specific source and audit pass are insufficient because browser visual credibility failed. |
| Report Visibility | BLOCKER | Submitted San Jacinto reports did not consistently appear through the active county experience. |
| Consumer Language | BLOCKER | Generic fallback language appeared in browser-visible San Jacinto surfaces. |
| Count Reconciliation | BLOCKER | Alerts, location-card, and awareness counts diverged. |
| Audit Reliability | BLOCKER | Submission audit returned `not_applicable_no_attempt` despite active browser testing. |
| Containment | OBSERVATION | V646.4 hold keeps San Jacinto non-operational, non-selectable, and isolated from Liberty/Montgomery while blockers are remediated. |
| Regression Protection | OBSERVATION | Future hardening must not alter Liberty behavior, Montgomery behavior, or protected systems. |
| Activation Readiness | BLOCKER | San Jacinto is not activation-ready until all hardening blockers are resolved and reauthorized. |

---

## 5. Blocker Review

| Finding | Classification | Required disposition before activation retry |
| --- | --- | --- |
| Boundary Verification | BLOCKER | Verify production-grade San Jacinto geometry provenance, ownership, and browser-rendered visual correctness. |
| Report Visibility | BLOCKER | Prove San Jacinto submitted reports appear consistently across marker, alert, awareness, refresh, and persistence paths. |
| Consumer Language | BLOCKER | Remove production-visible generic fallback wording and validate copy on Top Awareness, cards, details, location text, and road names. |
| Count Reconciliation | BLOCKER | Reconcile marker, alert, awareness, route, and location counts from a shared incident-level source. |
| Audit Reliability | BLOCKER | Make audit output match browser-observed San Jacinto submission, ownership, visibility, and county behavior. |
| Containment | OBSERVATION | Preserve activation hold and fail-closed behavior while hardening work proceeds. |
| Regression Protection | OBSERVATION | Preserve Liberty, Montgomery, and protected-system behavior throughout remediation. |

---

## 6. Recommended Implementation Sequence

### V648 — San Jacinto Boundary & Ownership Hardening

Resolve boundary provenance, visual correctness, county ownership, report ownership, marker visibility, alert visibility, awareness visibility, and cross-county containment validation. V648 must not reactivate San Jacinto unless separately authorized by a later activation milestone.

### V649 — San Jacinto Language & Count Reconciliation Hardening

Harden consumer-facing awareness language, alert wording, detail wording, location labels, road names, fallback behavior, incident classification, duplicate handling, and count reconciliation across county surfaces.

### V650 — San Jacinto Browser Validation Audit

Run browser-observed validation and update audits so real runtime behavior matches audit output. This milestone should explicitly retest the V646 failure cases and confirm that audit results do not mask active browser attempts.

### V651 — San Jacinto Activation Reauthorization Review

Reassess San Jacinto after V648, V649, and V650. Reauthorization must treat V646 findings as prior production blockers and may approve a retry only if every blocker is resolved or explicitly denied for activation.

### V652 — San Jacinto Controlled Activation Retry

Attempt a new controlled activation only after reauthorization. The retry must be narrow, observable, reversible, browser-validated, and regression-protected. It must preserve Liberty, Montgomery, and protected-system behavior.

---

## 7. County #3 Status Recommendation

San Jacinto should remain County #3 in staged status only.

Recommended status:

- Runtime Onboarded
- Runtime Validated
- Activation Held
- Not Activated
- Not Operational
- Not Selectable
- Production Blocked
- Not Activation-Ready

San Jacinto should not be replaced as County #3 solely because V646 failed. The correct next step is remediation and hardening, not production activation. If future remediation cannot verify boundary credibility, report visibility, consumer language, count reconciliation, and audit reliability, then County #3 activation should remain blocked and candidate sequencing should be revisited in a separate governance milestone.

---

## 8. Merge Recommendation

Merge V647 as a documentation-only hardening plan if review confirms:

- all V646 activation blockers are identified;
- the V646.4 activation hold remains in force;
- San Jacinto remains safely staged;
- no runtime behavior changes occur;
- no activation occurs;
- Liberty behavior is unchanged;
- Montgomery behavior is unchanged;
- protected systems are unchanged;
- `git diff --check` passes.

Do not merge V647 as an activation, activation authorization, selector exposure, production awareness-area creation, or runtime behavior change.

---

## Documentation-Only Validation

Required validation for V647:

- ✅ Review V646 browser findings.
- ✅ Review V646.4 activation hold.
- ✅ Review authorization evidence.
- ✅ Run `git diff --check`.

No runtime changes, activation, selector exposure, production awareness-area creation, Liberty changes, Montgomery changes, or protected-system changes are authorized by V647.
