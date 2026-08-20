# Cohort V2 Chester / Anahuac RCA

## Chester Alerts result

The V2 assertion evaluated, in order, `publishedAlertsCount === activeAlertsCount`
and then `(activeAlertsCount > 0 || Boolean(alertsSurface.emptyReason))`. Chester's
first comparison was `0 === 0` (`true`); the positive-count branch was `0 > 0`
(`false`); and `alertsSurface.emptyReason` was absent (`undefined`, therefore
`false`). The first false pass-condition operand was consequently
`Boolean(alertsSurface.emptyReason)`. The production snapshot did publish the
equivalent current quiet explanation as `nearbySummary`, but V2 did not consume
it.

| Assertion | Expected | Chester actual | Source function | Production owner | Result |
| --- | --- | --- | --- | --- | --- |
| Published Alerts count | Exact surface count | `0` | harness `counts` | `getAlertsSurfaceSnapshot` | Pass |
| Active rows count | `0` while the Alerts sheet is closed/lazy | `0` | harness DOM snapshot | Alerts sheet renderer | Pass |
| Active Alerts count | Equal published count | `0` | `getAlertsSurfaceSnapshot` | canonical active-community records and area filter | Pass |
| Explicit empty reason | Nonempty current-context reason | `emptyReason` absent; `nearbySummary = "No active local issues reported."` | `getAlertsSurfaceSnapshot` | unified localized commute intelligence | **Fail in V2** |
| Selected/current canonical community | PLACE `4814584`, `tyler-tx` | PLACE `4814584`, `tyler-tx` | `gridlyActiveCountyRuntimeAudit` | active county/community runtime | Pass |
| Alerts presentation community owner | Current PLACE/county | Not published as a V2 Alerts operand; snapshot was taken after current context convergence | harness `snapshot` / `getAlertsSurfaceSnapshot` | active county/community runtime | Incomplete V2 contract |
| Nearby-summary owner | Current snapshot | `No active local issues reported.` | `buildUnifiedLocalizedCommuteIntelligence` | localized commute intelligence | Pass |
| Route-impact-summary owner | Community-safe current snapshot copy | `Route into Liberty moving normally` | `buildUnifiedLocalizedCommuteIntelligence` | static quiet fallback | **Production defect** |
| Top-status owner | Community-safe current snapshot copy | `US 90 moving normally` | `buildUnifiedLocalizedCommuteIntelligence` | static quiet fallback | **Production defect** |
| Readiness-summary owner | Device preference, not community | `Alert preferences are off — turn on to receive commute alerts` | `getAlertsSurfaceSnapshot` | smart-alert preferences | Pass |
| Stale prior-community identity | None | No Fredericksburg/Gillespie identity or retained alert IDs | harness `compareStale` | transition audit | Pass |
| Rendered Alerts DOM expectation | Closed/lazy sheet requires zero attached rows; an open sheet requires exact publication/DOM parity | `0`, closed | harness DOM snapshot | Alerts sheet renderer | Pass |

The Liberty and US 90 strings are not retained Fredericksburg state and are not
audit-only observations. They are literal production quiet fallbacks constructed
on every empty localized-intelligence build. Their source classification is **C,
static/default copy**. Because these names are community-specific rather than a
documented statewide/global route contract, showing them for Chester is a
production presentation defect with statewide exposure for any zero-incident
community. This RCA intentionally does not repair that production owner.

V3 repairs only the audit contract: it records the Alerts presentation owner from
the already-converged canonical PLACE/county context, accepts `nearbySummary` as
the explicit zero reason, and treats zero Alerts DOM rows as correct for a closed,
lazy sheet. An open sheet still requires exact publication/DOM parity. Thus a
healthy zero can pass only when its owner is the current row; a stale owner fails.

## Anahuac resolution result

Anahuac is present in production as awareness area `{ key: "anahuac", label:
"Anahuac", storageValue: "Anahuac", countyId: "chambers-tx" }`. The Chambers
governed community registry supplies `{ placeGeoid: "4803144", displayName:
"Anahuac", canonicalIdentity: "PLACE_GEOID", countyMemberships: ["48071"] }`.
It is a single-county PLACE and its expected operational county is correct.

`resolveGridlyAwarenessAreaQuery("Anahuac")` finds one operational awareness
area and returns `RESOLVED_OPERATIONAL`, but its returned area's legacy definition
does not carry `placeGeoid` or `communityId`. The production resolver attempts to
find the governed community using those missing identity fields, so the returned
result has no PLACE GEOID. V2 then rejected the otherwise valid production result
when it compared that absent field to `4803144`. This is an audit-harness identity
bridge defect, not evidence of an absent production registry or unhealthy Anahuac
runtime.

V3 deterministically bridges every cohort row through existing statewide evidence:
expected PLACE GEOID plus governed county membership selects exactly one governed
community and exactly one production awareness/storage area. It rejects wrong
GEOID, wrong governed county, missing identities, and duplicate identities. For a
governed multi-county PLACE it validates the complete memberships and retains the
canonical multi-county selection command. There is no Anahuac or per-city mapping.

## Checkpoint and scope

The checkpoint namespace is now `GRIDLY_STATEWIDE_COHORT_AUDIT_V3`. It cannot
accept the V2 checkpoint whose `completedSequence = 2`, so the owner starts the V3
audit deterministically and row 2 cannot be mistaken for a certified result. The
first selection blocker still stops execution. No production file was changed and
the owner cohort was not run.
