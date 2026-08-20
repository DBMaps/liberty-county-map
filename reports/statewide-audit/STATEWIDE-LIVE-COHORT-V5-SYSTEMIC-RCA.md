# Statewide live cohort V5 systemic RCA

## Scope and evidence boundary

The owner cohort is stopped after sequence 9. Rows 10–14 were not run. This
investigation did not resume the cohort and did not change production, the V5
harness, or the protected geometry.

The V5 checkpoint is stored only in browser `sessionStorage` under
`GRIDLY_STATEWIDE_COHORT_AUDIT_V5`. It is not a repository artifact. The prompt
contains the summarized observations, but not the checkpoint payload. Therefore
values such as record IDs, marker coordinates, map bounds, timestamps, revisions,
and Baytown's `observedContext` cannot truthfully be reconstructed. They are
reported as **NOT CAPTURED IN PROVIDED EVIDENCE**, rather than inferred.

## A. DriveTexas TIMEOUT

### Ownership trace

The production connector's `areaLifecycleAudit()` exposes area counts, successful
fetch time, fetch error, fetch generations, selected/current area identities, and
retention. The consumer publisher reads that lifecycle together with connector
and provider runtime health and publishes the governed source envelope.

V5 does not capture the connector lifecycle or connector/provider runtime audit.
It reads only `gridlyGetDriveTexasConsumerSourceStatusEnvelope()`. Its
`driveTexasState()` recognizes `HEALTHY_WITH_DATA`; recognizes `HEALTHY_EMPTY`
only with acquisition proof; maps retained, unavailable, and failed states; and
returns `null` for every other value. `settlement()` then requires that result to
be in its terminal set. At the bound, `waitForSettlement()` calls
`snapshot(row, true)`, and `driveTexasState(envelope, true)` unconditionally
returns `TIMEOUT`, even if the final envelope carries a useful unrecognized raw
status. Thus `TIMEOUT` is a harness-generated bound result, not an envelope value.

**First false condition:** `settlement(...).driveReady === false`, because the
pre-bound `driveTexasState(envelope, false)` was `null` (the envelope's raw health
was absent or not one of V5's recognized terminal states). The saved V5 result
discarded the raw envelope and lifecycle, so the exact raw field/value cannot be
distinguished now.

### Requested field reconciliation

The same evidence boundary applies to Addison and Cape Royale unless stated.

| Field | Production value | Harness value | Source function | Timestamp/revision |
|---|---|---|---|---|
| connector connected | NOT CAPTURED IN PROVIDED EVIDENCE | not captured | `gridlyDriveTexasConnectorRuntimeAudit()` | not captured |
| networking available | NOT CAPTURED IN PROVIDED EVIDENCE | not captured | connector runtime audit | not captured |
| provider activated | NOT CAPTURED IN PROVIDED EVIDENCE | not captured | connector/provider runtime audit | not captured |
| request attempted | NOT CAPTURED IN PROVIDED EVIDENCE | not captured | connector/provider runtime audit | not captured |
| request success | NOT CAPTURED IN PROVIDED EVIDENCE | not captured | connector runtime/lifecycle | `lastSuccessfulFetchTimestamp` not captured |
| last request status | NOT CAPTURED IN PROVIDED EVIDENCE | not captured | connector/provider runtime audit | not captured |
| lifecycle current-area count | Addison 8; Cape Royale 1 (owner summary) | IDs length: 8 / 1 | `areaLifecycleAudit()` / envelope records | not captured |
| consumer envelope count | Addison 8; Cape Royale 1 | reported 8 / 1 | `gridlyGetDriveTexasConsumerSourceStatusEnvelope()` | not captured |
| envelope connected | NOT CAPTURED IN PROVIDED EVIDENCE | discarded | consumer envelope | not captured |
| envelope fetchFailed | NOT CAPTURED IN PROVIDED EVIDENCE | discarded | consumer envelope | not captured |
| envelope healthyEmpty | false by nonzero count, but acquisition ownership remains unproved | not retained | consumer envelope | not captured |
| envelope raw health/status | NOT CAPTURED IN PROVIDED EVIDENCE | `null` before bound; forced `TIMEOUT` at bound | consumer envelope / `driveTexasState()` | not captured |
| publication revision | NOT CAPTURED IN PROVIDED EVIDENCE | discarded | consumer publisher audit/envelope | not captured |
| Official Roadway source count | Addison 8; Cape Royale 1 | 8 / 1 | marker publication audit | not captured |

The 8→8→8 and 1→1→1 parity proves consumer convergence at one observation, but
does not prove those records belong to the current request: V5 omitted request
sequence/generation, successful-fetch time, selected/current identity parity, and
retained-data flags from its saved result. It would be unsafe to promote either
row to healthy-with-data.

**Classification: HARNESS_DEFECT.** This classifies the asserted V5 `TIMEOUT`,
not production health. V5 both loses the evidence needed to classify the source
and overwrites the terminal observation with a synthetic status. Whether the live
source was healthy, retained, or still pending remains **UNKNOWN**.

## B. Cape Royale Show on map and stale ownership

### Manual protocol

`gridlyStatewideCohortContinue()` is the only handshake. It does not require an
action-dispatch token, captured situation/marker identity, focus lifecycle event,
camera completion event, or popup completion event. Pressing Continue without
using Show on map produces the same sampling path as completing the action. The
manual evidence contains only confirmation time, action label, and the derived
pass boolean.

Consequently, none of action dispatch, exact target selection,
`focusGridlyAlertIncident()` execution, camera action, or popup action is proven.
The observed unchanged viewport and closed popup are compatible with no action,
an incomplete asynchronous action, or a failed action. They cannot attribute a
production defect. The existing-marker set equality proves only that the marker
identity set did not change; it does not prove which marker was targeted.

### Requested evidence

| Evidence | Value |
|---|---|
| consumerSituationId | NOT CAPTURED IN PROVIDED EVIDENCE |
| captured marker identity | NOT CAPTURED IN PROVIDED EVIDENCE |
| marker coordinates before | NOT CAPTURED IN PROVIDED EVIDENCE |
| viewport before / after | NOT CAPTURED IN PROVIDED EVIDENCE |
| center before / after | NOT CAPTURED IN PROVIDED EVIDENCE |
| zoom before / after | NOT CAPTURED IN PROVIDED EVIDENCE |
| popup before / after | before not captured; after false |
| active county before / after | unchanged; exact values absent from checkpoint evidence |
| awareness key before / after | unchanged; exact values absent from checkpoint evidence |
| canonical PLACE before / after | expected 4812600; actual values not captured by manual evidence |

**Show-on-map classification: OWNER_ACTION_NOT_PROVEN**, caused by a conclusive
audit-harness handshake defect. A production conclusion is prohibited.

### Stale ownership

V5's stale check is independent of the Show-on-map action. It compares all eight
predicates at the row snapshot, before the manual action. The prompt supplies only
the aggregate stale FAIL and the manual-action context booleans; it does not
include `staleState.checks`. Therefore the exact first false stale predicate is
**NOT CAPTURED IN PROVIDED EVIDENCE**. It cannot be inferred from
`activeCountyUnchanged` or `awarenessAreaUnchanged`, because those are desirable
within-row Show-on-map invariants, whereas stale checks compare Cape Royale to
the preceding Aldine row.

**Stale classification: HARNESS_DEFECT.** The failure may describe real retained
identity, but V5 does not preserve the prior/current identity operands needed for
attribution, and `compareStale()` requires every predecessor ID class to be
disjoint without recording which failed in the summarized evidence. Production
status remains unknown.

## C. Baytown multi-county transition

Baytown's cohort contract is PLACE `4806128`, Chambers operational county
`chambers-tx`, with governed memberships `48071` and `48201`.

The bridge is designed to resolve exactly one governed Baytown identity and one
Chambers production target. However, `gridlySaveCanonicalMultiCountyPlaceHome()`
persists a deliberately county-neutral canonical record (`countyId: null`) and
dispatches semantic camera/surface synchronization. It never sets the requested
operational county. The canonical multi-county validator likewise constructs an
area with `countyId: null`. Thus this command can persist Baytown PLACE identity
while leaving the previous operational county untouched; it cannot satisfy the
V5 Chambers operand.

The checkpoint would contain the exact convergence operands, but it was not
provided. The statically proven operands are:

| Operand | Value |
|---|---|
| expectedPlaceGeoid | `4806128` |
| expectedCountyId | `chambers-tx` |
| bridgeResolvedPlaceGeoid | expected `4806128`; actual checkpoint value unavailable |
| bridgeResolvedCountyId | expected `chambers-tx`; actual checkpoint value unavailable |
| bridgeProductionKey/storage/shape | NOT CAPTURED IN PROVIDED EVIDENCE |
| governed memberships | `48071`, `48201` |
| selected runtime key/storage/county/place | NOT CAPTURED IN PROVIDED EVIDENCE |
| activeCountyId | NOT CAPTURED IN PROVIDED EVIDENCE |

The first statically proven unsatisfiable convergence operand is
`ACTIVE_COUNTY_MATCHES_EXPECTED`: the selected production command has no operation
that can establish Chambers. `SELECTED_RUNTIME_COUNTY_MATCHES_EXPECTED` may appear
first in V5's ordered checks and may also be false because canonical Baytown is
county-neutral; the missing checkpoint prevents claiming its actual runtime
value. The actual post-selection PLACE and county are therefore **NOT CAPTURED IN
PROVIDED EVIDENCE**. Static code proves contract (A)—canonical identity can be
saved while operational county does not converge—but not the precise county that
remained live.

**Classification: PRODUCTION_DEFECT.** The highest-level production multi-county
selection command cannot preserve the explicitly selected operational membership.
Per scope, no production repair is implemented.

## Decisions and required output

```text
DRIVETEXAS TIMEOUT FIRST FALSE CONDITION = settlement.driveReady (pre-bound driveTexasState was null; raw envelope status was not preserved)
ADDISON 8→8→8 CURRENT-REQUEST OWNERSHIP PROVEN = NO
CAPE ROYALE 1→1→1 CURRENT-REQUEST OWNERSHIP PROVEN = NO
DRIVETEXAS TIMEOUT CLASSIFICATION = HARNESS_DEFECT (underlying live source state UNKNOWN)
CAPE ROYALE MANUAL ACTION DISPATCH PROVEN = NO
CAPE ROYALE EXACT MARKER TARGET PROVEN = NO
CAPE ROYALE CAMERA ACTION PROVEN = NO
CAPE ROYALE POPUP ACTION PROVEN = NO
CAPE ROYALE SHOW-ON-MAP CLASSIFICATION = OWNER_ACTION_NOT_PROVEN
CAPE ROYALE STALE FIRST FALSE CONDITION = NOT CAPTURED IN PROVIDED EVIDENCE
CAPE ROYALE STALE CLASSIFICATION = HARNESS_DEFECT (underlying production state UNKNOWN)
BAYTOWN EXPECTED PLACE = 4806128
BAYTOWN EXPECTED COUNTY = chambers-tx
BAYTOWN FIRST FALSE CONVERGENCE OPERAND = SELECTED_RUNTIME_COUNTY_MATCHES_EXPECTED may be first by check order; ACTIVE_COUNTY_MATCHES_EXPECTED is the first statically proven unsatisfiable operand
BAYTOWN ACTUAL POST-SELECTION PLACE = NOT CAPTURED IN PROVIDED EVIDENCE
BAYTOWN ACTUAL POST-SELECTION COUNTY = NOT CAPTURED IN PROVIDED EVIDENCE
BAYTOWN MULTI-COUNTY CLASSIFICATION = PRODUCTION_DEFECT
AUDIT-HARNESS REPAIR REQUIRED = YES
PRODUCTION REPAIR PROVEN = YES (Baytown operational-county contract only; not implemented)
PRODUCTION FILES CHANGED = NO
RCA FILES CREATED = reports/statewide-audit/STATEWIDE-LIVE-COHORT-V5-SYSTEMIC-RCA.md
GEOMETRY INTEGRITY = PASS
READY FOR NEXT DECISION = YES
```

## V6 evidence-preservation strategy

Do not mutate the V5 checkpoint or promote its outcomes. Export and retain it as
immutable owner evidence. V6 should import each row as evidence components with
assertion version, source revision/request generation, capture time, and
dependencies. Preserve parity and identity evidence whose dependencies did not
change. Invalidate and rerun only: DriveTexas terminal-health/current-request
ownership assertions; Show-on-map interaction assertions; stale assertions whose
failed operand was not preserved; and Baytown selection/downstream assertions.
Require an action token emitted by the exact alert control and a completion token
from the focus lifecycle before Continue becomes enabled. Capture raw envelope,
connector lifecycle, runtime audits, request generation, publication revision,
all stale operands, and all selection operands in every result, including timeout
results.
