# LP132 — Texas Statewide Activation Roadmap

## Purpose and authority

LP132 is a planning and governance milestone. It defines how later, separately authorized work can move counties from audited readiness to production activation. It does **not** activate a county, approve a deployment, alter runtime behavior, rebuild a package, or change Storage, Supabase, Edge Functions, protected systems, or address search.

The sole statewide readiness baseline for this roadmap is LP131. Its authoritative position is:

| Baseline measure | LP131 count |
| --- | ---: |
| Texas counties audited | 254 |
| Address packages | 254 |
| Package sidecars | 254 |
| Certified packages | 240 |
| Certification-blocked packages | 14 |
| Runtime-ready counties | 1 |
| Tier 1 / Tier 2 / Tier 3 / Tier 4 | 1 / 2 / 25 / 226 |
| Counties lacking governed community coverage | 251 |
| Counties lacking destination or production-crossing coverage | 226 |

These counts are planning inputs, not activation approvals. The LP131 county inventory remains the authority for county-level status. A future change to that status must be established by a new governed audit; LP132 must not be edited to imply that work occurred.

## 1. Statewide activation philosophy

The program has crossed a deliberate boundary:

> **Past focus:** Building statewide infrastructure

> **Future focus:** Using statewide infrastructure

Manufacturing is complete: every Texas county has an address package and sidecar. Future milestones must consume those artifacts rather than rebuild them or create another manufacturing architecture. The remaining work is governed production activation: resolve bounded certification blockers, establish the supporting community/destination/crossing evidence, validate the existing artifacts through the runtime and consumers, and make an explicit production decision.

The operating rule remains **Audit First, Patch Second**:

1. **Audit:** Reproduce the LP131 position, identify the exact failed gate, name the evidence authority, and bound the county cohort.
2. **Patch:** Only a separately scoped and approved milestone may address that failure. It must be minimal, reversible, and confined to the failed gate.
3. **Re-audit:** Re-run the applicable certification and validation checks. A patch is not evidence of readiness; passing results are.
4. **Approve separately:** Technical readiness does not authorize production. Activation requires the final approval gate and a distinct change record.

No county advances because a wave needs more members, because another county is adjacent, or because a package merely exists. Waves organize eligible work; gates control advancement.

## 2. Activation wave strategy

Waves are dynamic cohorts derived from the latest governed evidence. A county enters a wave only when it meets that wave's entry rule and exits only after its evidence is recorded. Tier describes the LP131 baseline; wave describes a future work sequence. Neither is production authorization.

| Wave | Objective cohort and entry rule | Planned work | Exit condition |
| --- | --- | --- | --- |
| **0 — Production control** | The one LP131 Tier 1, runtime-ready county already serving as the production control | Preserve as the reference; record health, regression, consumer, rollback, and operational baselines | Control evidence is current and suitable for comparison; no new activation occurs |
| **1 — Near-ready validation** | LP131 Tier 2 counties, plus any future county whose governed audit shows supporting community, destination, and crossing coverage with no integrity failure | Close any certification/activation-evidence boundary; exercise Gates 1–6 in a non-production context | Each county has a complete gate dossier and is either approval-eligible or returned to its named blocker |
| **2 — Bounded-gap readiness** | LP131 Tier 3 counties, ordered by the prioritization framework after mandatory gates are considered | Close the documented one or two supporting-coverage gaps, then perform full non-production validation | Required evidence passes Gates 1–6; unresolved counties remain inactive |
| **3 — Community and coverage expansion** | LP131 Tier 4 counties and any county missing all three supporting dataset classes | Govern community coverage first, then destination and crossing coverage; use completed address manufacturing as-is | County is re-audited into an eligible readiness state, without implied activation |
| **4 — Statewide completion** | All counties not yet approved after Waves 1–3, including exceptions and deferred counties | Resolve residual governed exceptions, validate operational capacity, and progress in controlled batches | All 254 counties have a recorded outcome: active, approval-eligible, deferred with owner/date, or blocked with evidence |

Wave numbers are not promises or deadlines. Counties may move between cohorts when a governed audit changes their evidence. A county cannot skip a failed mandatory gate, and a higher priority score never waives a gate.

## 3. Measurable readiness criteria

Every criterion must have a named artifact, reproducible check, reviewer, timestamp, and pass/fail result. “Present,” “looks correct,” and candidate-only evidence are not passes.

| Criterion | Measurable requirement | Why it matters |
| --- | --- | --- |
| **Address package integrity** | Existing county package and sidecar are present; identifiers agree; required checksums/schema/count checks reproduce without unexplained drift | Proves the manufactured artifact being evaluated is intact, without rebuilding it |
| **Address certification** | The authoritative certification reports PASS for the exact immutable package identity under the approved rule set; no open certification exception exists | Separates package existence from governed fitness; the 14 blocked packages remain inactive until this is satisfied |
| **Community coverage** | Governed community records cover the county's approved community inventory; names, aliases, county/FIPS association, provenance, and review status meet the community specification; uncovered entries are zero or explicitly approved exceptions | Prevents address discovery from depending on ungoverned or incomplete locality labels |
| **Destination coverage** | The approved destination inventory has a governed searchable record for every in-scope destination, with valid county association, coordinates/geometry, provenance, and zero unresolved critical validation errors | Ensures common destinations can be found and resolve to the intended county/location |
| **Production-crossing coverage** | Every in-scope crossing in the approved county inventory is reconciled to production evidence; identifiers and geometry validate; duplicate/orphan/critical omission counts are zero or formally excepted | Prevents a county from being presented as ready while crossing intelligence is absent or ambiguous |
| **Runtime validation** | In a non-production or otherwise authorized validation environment, deterministic smoke cases load the exact certified artifact and supporting datasets; county boundary, representative address/community/destination/crossing cases, error handling, and telemetry expectations all pass | Demonstrates that static evidence can be consumed without authorizing production |
| **Regression testing** | The full approved suite passes against the control and candidate; there are no unexplained changes to already active coverage, protected boundaries, latency/error budgets, or neighboring-county behavior | Stops county expansion from degrading established behavior |
| **Consumer validation** | Approved test journeys for representative addresses, communities, destinations, crossings, county-edge cases, ambiguous names, empty results, and accessibility/content expectations meet a documented acceptance threshold; all severity-1/2 findings are closed | Confirms that technically valid coverage produces an understandable consumer outcome |
| **Operational readiness** | Named owner/on-call, dashboards and alerts, runbook, rollback trigger and procedure, support briefing, observation window, and incident authority are acknowledged | Ensures activation can be observed, supported, and reversed safely |

An exception is not a silent pass. It must identify scope, rationale, risk owner, compensating control, expiry date, and approving authority, and must appear in the production approval record.

## 4. Activation gates

Gates are sequential and fail closed. Each dossier uses `PASS`, `FAIL`, or `NOT RUN`; only `PASS` advances. Evidence must identify the county FIPS, artifact versions/checksums, validation version, execution time, executor, and reviewer.

### Gate 1 — Package integrity

- **Input:** the existing address package and sidecar identified by LP131.
- **Pass:** presence, identity, schema, checksum, and internal reconciliation checks all pass with no unexplained drift.
- **Fail action:** quarantine the county from activation and audit the mismatch. Do not rebuild under LP132.

### Gate 2 — Certification complete

- **Input:** Gate 1 evidence and the authoritative certification record for the same artifact identity.
- **Pass:** certification is current and PASS, with no unresolved blocking exception.
- **Fail action:** enter the certification-completion process in Section 6; keep the county inactive.

### Gate 3 — Community readiness

- **Input:** approved county community inventory and governed community evidence.
- **Pass:** required coverage and quality checks in Section 3 pass, including provenance and ambiguity review.
- **Fail action:** document precise missing or invalid communities and return them to a separately approved community-coverage milestone.

### Gate 4 — Destination readiness

- **Input:** approved destination scope and governed searchable-destination evidence.
- **Pass:** required coverage, geographic association, provenance, and critical-error checks pass.
- **Fail action:** record missing/invalid destinations; no activation or implicit waiver follows.

### Gate 5 — Crossing readiness

- **Input:** approved crossing scope and production-crossing evidence.
- **Pass:** coverage reconciliation, identity, geometry, duplicate/orphan, and critical-omission checks pass.
- **Fail action:** record the bounded discrepancy and retain inactive status.

### Gate 6 — Runtime validation

- **Input:** immutable identities from Gates 1–5 and approved non-production test cases.
- **Pass:** runtime, regression, consumer, and operational-readiness criteria all pass; results are compared with Wave 0 control thresholds.
- **Fail action:** stop progression, preserve evidence, execute no production change, and assign the failure to its owning domain.

### Gate 7 — Production approval

- **Input:** complete Gates 1–6 dossier, risk/exception register, proposed batch, change/rollback plan, observation plan, and accountable owners.
- **Pass:** designated technical, product/data, and operational approvers sign a time-bounded activation decision through the project's governed change process.
- **Fail or expiry:** county remains inactive and must be revalidated where evidence has aged or changed.

Gate 7 is a decision point for a future activation milestone, not an approval granted by LP132.

## 5. County prioritization framework

### Eligibility before ranking

Prioritization never substitutes for readiness. Build the queue as follows:

1. Snapshot the LP131 county row and subsequent governed gate evidence.
2. Exclude the Wave 0 control from new-activation ranking.
3. Place any Gate 1 failure in an integrity hold and any Gate 2 failure in the certification queue.
4. Group remaining inactive counties by readiness tier (Tier 2 before Tier 3 before Tier 4).
5. Score counties within a tier using the formula below. Do not use the score to skip Gates 3–7.

### Repeatable score

Each source is versioned once per planning cycle. Fractions are in `[0,1]`; unknown values score `0` rather than being estimated.

| Factor | Weight | Deterministic calculation |
| --- | ---: | --- |
| Population served | 30 | County population / largest county population in the same planning snapshot, using one approved statewide population release |
| Community completeness | 25 | Valid governed in-scope communities / total approved in-scope communities |
| Destination completeness | 15 | Valid governed in-scope destinations / total approved in-scope destinations |
| Crossing completeness | 15 | Valid governed in-scope production crossings / total approved in-scope crossings |
| Adjacent production coverage | 10 | Bordering active counties / total bordering Texas counties, using one approved adjacency map |
| Evidence recency | 5 | `1` if all gate evidence is within the approved freshness window; otherwise `0` |

`priority_score = 30P + 25C + 15D + 15X + 10A + 5R`

Order by: (1) readiness tier, ascending; (2) priority score, descending; (3) count of unresolved non-certification gaps, ascending; (4) zero-padded five-digit county FIPS, ascending. The FIPS rule is the final non-subjective tie-breaker. Publish factor inputs, source versions, arithmetic, exclusions, and queue output with every scoring run.

Population and adjacency can affect ordering only after their sources are formally approved; they do not alter the LP131 baseline. This framework favors service reach and contiguous operations while giving most non-population weight to the largest statewide gap: governed community readiness.

## 6. Certification completion strategy

The remaining 14 counties form a bounded remediation queue, not a manufacturing backlog.

1. **Freeze the cohort:** Capture the LP131 county/FIPS list, package and sidecar identities, certification result, rule-set version, and failure evidence.
2. **Classify without mutation:** Assign each blocker to a governed category (source/evidence deficiency, metadata/reconciliation issue, validation-rule failure, or tooling/environment defect). Record a single owner and reproduction command.
3. **Reproduce independently:** A reviewer reproduces the failure against the same immutable package. Integrity failures return to Gate 1; certification failures stay at Gate 2.
4. **Approve a bounded remedy:** A separate milestone proposes the smallest permissible correction, impact analysis, protected-boundary check, rollback method, and reviewer. LP132 neither makes nor pre-approves that correction.
5. **Recertify through the authority:** Run the established certification workflow against the resulting governed artifact, retaining before/after identities and machine-readable evidence. Never self-declare a block resolved.
6. **Review and reconcile:** Require independent review, rerun statewide count reconciliation, and confirm no certified county regressed.
7. **Update status by audit:** A new governed audit may move a county from blocked to certified. Certification alone does not satisfy Gates 3–7 or authorize activation.

Track weekly: open count, reproduced count, categorized count, remedy-approved count, recertification pass/fail count, median age, oldest blocker, and regressions. The target is 14 resolved and 254 certified, with zero certification regressions; progress must never be achieved by weakening certification rules or rebuilding packages outside an authorized scope.

## 7. Governed rollout sequence

This sequence describes future execution; it performs none.

1. **Internal validation:** Select only gate-eligible counties according to the published queue. Assemble immutable dossiers, execute Gates 1–6 outside production, compare to Wave 0, conduct independent review, and record a go/no-go recommendation.
2. **Controlled activation:** In a separately authorized production milestone, Gate 7 approvers choose the smallest operationally supportable batch, schedule a change window, confirm rollback readiness, and activate only named counties. No wave is activated wholesale.
3. **Observation period:** Hold the batch for a predefined interval and traffic/sample minimum. Compare availability, errors, latency, empty/ambiguous results, support signals, and consumer validation with predeclared thresholds and the control. Freeze expansion on a threshold breach; invoke rollback criteria where required.
4. **Expansion:** After an explicit observation sign-off, admit the next highest-ranked eligible batch. Recheck evidence freshness and repeat all applicable gates rather than inheriting the prior batch's approval.
5. **Statewide progression:** Recompute the queue on a fixed cadence, publish coverage and blocked/deferred reasons, preserve a stable control cohort, and continue until every county has a governed disposition.

Every batch has a unique change record, county/FIPS list, artifact identities, approvers, start/end time, observation result, incident links, rollback decision, and final disposition. Batch size and observation duration must be set by operational capacity and approved before Gate 7, not improvised during rollout.

## 8. Success metrics

Publish both counts and rates, statewide and by wave/tier. Metric definitions and denominators remain fixed within a reporting period.

| Indicator | Definition | Baseline / target direction |
| --- | --- | --- |
| Counties activated | Count with current governed production approval and verified production state | Start from the existing production county; increase only through future Gate 7 decisions |
| Population coverage | Sum of population in active counties / statewide population from the approved snapshot | Increase, with source version disclosed |
| Gate pass funnel | Counties passing each Gate 1–7 / counties evaluated at that gate | Increase; failures retain named reasons |
| Runtime validation rate | Counties passing current Gate 6 runtime checks / counties submitted to Gate 6 | Increase toward 100% without reducing test scope |
| Certification completion | Certified packages / 254 | LP131: 240/254; target 254/254 |
| Certification regressions | Previously certified artifacts that no longer pass the same/current governed rules | Target 0 |
| Supporting coverage | Counties passing community, destination, and crossing criteria, separately | Improve from LP131 gaps of 251 community and 226 destination/crossing counties |
| Regression status | Passed required regression assertions / assertions executed, plus open severity-1/2 defects | 100% passed and zero open severity-1/2 defects before approval |
| Consumer validation | Passed approved journeys / journeys executed, with failures by severity and scenario | Meet the predeclared Gate 6 threshold; zero severity-1/2 findings |
| Observation health | Batches meeting all error, latency, correctness, support, and rollback thresholds through the full window | 100% before expansion |
| Operational readiness | Eligible counties/batches with current owner, runbook, monitoring, support, and rollback attestations | 100% before Gate 7 |
| Time in state | Median and maximum days eligible, blocked, deferred, under observation, and awaiting approval | Reduce while retaining audit quality |

Report activation separately from readiness: a county passing Gates 1–6 is **approval-eligible**, not activated. Never count partial coverage or a scheduled change as production coverage.

## 9. Risk assessment

| Risk | Early signal | Impact | Mitigation / stop condition |
| --- | --- | --- | --- |
| Certification regression | Previously passing certificate fails, artifact identity drifts, or rule results change unexpectedly | Invalid artifact could progress or the queue could be unreliable | Pin identities/rules, re-run certification before approval, independently review, and freeze affected cohort plus dependent batches |
| Runtime regression | Control comparison, error rate, latency, load, or county-boundary cases breach threshold | Existing or candidate county behavior degrades | Full regression suite, canary-sized batches, dashboards, pretested rollback, and automatic expansion freeze |
| Community readiness gap | Missing, ambiguous, duplicate, or wrongly associated community records | Consumers cannot reliably locate valid places | Governed inventory, provenance and alias review, zero silent omissions, and Gate 3 fail-closed behavior |
| Destination/crossing incompleteness | Reconciliation gaps, invalid geometry, orphans, or unexpected empty results | Misleading claim of county readiness | Separate Gate 4/5 reconciliation, sampled consumer journeys, explicit exceptions, no inference from address readiness |
| Consumer confusion | Ambiguous labels, unexpected county results, rising empty-result/support feedback | Loss of trust despite technical correctness | Plain-language test journeys, ambiguity cases, support briefing, consumer telemetry, and pause thresholds |
| Operational unpreparedness | Missing owner, dashboard, alert, runbook, support plan, or rollback rehearsal | Slow detection/recovery and unmanaged incidents | Gate 6 operational checklist; Gate 7 rejects incomplete ownership or rollback evidence |
| Wave pressure / metric gaming | Counties advanced to meet dates; denominator/test scope changes; exceptions omitted | Gates lose integrity | Publish definitions and evidence, independent approval, immutable snapshots, and metrics showing failures/deferred states |
| Stale or inconsistent evidence | Old validation, mixed dataset versions, or FIPS/artifact mismatch | Approval does not describe deployed inputs | Freshness window, immutable manifest per dossier, revalidation on any input change |
| Adjacent-county spillover | Boundary cases return neighboring data or alter established coverage | Cross-county correctness regression | Approved adjacency authority, county-edge cases, control comparisons, and joint observation of neighboring counties |
| Batch too large | Signals cannot be attributed or support capacity is exceeded | Wider blast radius and ambiguous rollback | Small initial cohort, explicit batch cap, capacity review, one batch per observation window |

The risk register is reviewed before each Gate 7 decision. Any unresolved severity-1/2 correctness, integrity, security, privacy, or rollback-readiness issue is a no-go.

## 10. Final roadmap

### Current statewide position

- Statewide address manufacturing is complete: 254 packages and 254 sidecars exist.
- Certification stands at 240 complete and 14 blocked.
- Readiness remains concentrated: one Tier 1/runtime-ready county, two Tier 2, 25 Tier 3, and 226 Tier 4.
- Supporting coverage—not manufacturing—is the dominant constraint: 251 counties lack governed community coverage, and 226 lack destination or production-crossing coverage.

### Immediate priorities

1. Preserve the existing production county as Wave 0 and establish its control/observation evidence.
2. Freeze, reproduce, classify, and govern the 14-county certification queue without rebuilding packages.
3. Create reviewable Gate 1–6 dossiers for the two Tier 2 counties; this is validation, not activation.
4. Govern community coverage as the first and largest supporting-readiness program, followed by destination and crossing evidence.
5. Approve population, adjacency, scope, freshness, test, and operational authorities before publishing the first scored queue.

### Mid-term objectives

- Move eligible Tier 2 and then Tier 3 counties through non-production validation and explicit approval decisions in small observable batches.
- Reduce each gap count through audited evidence, reach 254/254 certification, and maintain zero regressions.
- Recompute a transparent priority queue on a fixed cadence, publish blocked/deferred reasons, and improve operational capacity based on observed batches.

### Long-term statewide activation vision

Progress Tier 4 and residual exception counties through the same gates until every Texas county has a current, reviewable disposition. Statewide completion means governed community, destination, crossing, certification, runtime, regression, consumer, operational, and approval evidence—not merely 254 manufactured packages. The end state is controlled use of the statewide infrastructure with measurable population coverage, stable consumer outcomes, reversible releases, and an enduring Audit First, Patch Second record.

## Non-authorization statement

LP132 creates no production approval and changes no county status. All counties retain their LP131 state until a later governed audit and, where applicable, a separately authorized activation milestone establishes otherwise. This document proposes no framework, package rebuild, manufacturing redesign, runtime change, deployment, Storage/Supabase/Edge Function change, address-search change, or protected-system modification.
