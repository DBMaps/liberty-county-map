# LP133 — Texas Statewide Certification Resolution

## Authority, scope, and decision rule

LP133 is the authoritative **audit-only** resolution plan for the 14 counties that LP130 and LP131 leave certification-blocked. LP130 remains authoritative for 254 intact packages, 254 sidecars, 254 unique county identities, and zero integrity failures; LP131 remains authoritative for the `240 PASS / 14 FAIL` certification baseline; LP132 remains authoritative for activation governance. LP133 changes none of those artifacts or statuses and grants no activation approval.

The classification is deterministic:

1. Freeze the 14 rows whose LP131 `address.certificationStatus` is `FAIL`.
2. Read each row's cited LP130 certification report.
3. Require all integrity counters to be zero and `packageLoadCount` to equal one. If not, classify `PACKAGE_CONTENT` or `PACKAGE_METADATA` according to the failed counter.
4. When integrity passes and the only failures arise from the certifier's self-selected exact sample, certifier-derived aliases, or its wall-clock load threshold, classify `CERTIFICATION_LOGIC`. The certifier constructs those tests from the same immutable package it indexed; a failed self-round-trip is certification-contract evidence, not proof that package bytes are defective.
5. No audited report contains an authoritative-source contradiction, missing-source assertion, metadata mismatch, content-integrity error, approved exception, or unexplained failure. Therefore none meets `SOURCE_LIMITATION`, `AUTHORITATIVE_SOURCE_CONFLICT`, `PACKAGE_METADATA`, `PACKAGE_CONTENT`, `EXPECTED_EXCEPTION`, or `UNRESOLVED`.

The exact-sample tool defect is bounded: eligibility is tested by parsing the concatenation of house and road (`parseStreet(`${record.h} ${record.r}`)`), so a source house value containing an internal space can be admitted even though the parser subsequently moves its suffix into the road. Reproduction against the available immutable packages identified Bell values `100306 A` and `100306 B`, and Brewster value `14073 1/2`, exactly reconciling their `2` and `1` misses. The alias defect is also bounded: `supportedAliases` accepts any canonical string beginning `CR`, `FM`, `SH`, or `US`, while canonical expansion itself requires a numbered-road prefix. Thus ordinary names such as Bandera's `Cr Moore Road` and `Us Marshal Road` are incorrectly treated as numbered-road alias evidence. These are expected source spellings exposing overly broad audit eligibility, not package defects. For counties whose package bytes are not present in this checkout, LP133 does not speculate about row spellings; the same deterministic failure-stage rule is supported by the committed report counters.

Dallas additionally exceeded the fixed 5,000 ms wall-clock threshold (`6,535.563 ms`) while its 1,028,372 records passed every integrity counter and all 3,000 exact samples. A one-run elapsed-time threshold without a governed host profile, repeated trials, or size-normalized criterion is an environment-sensitive certification rule. It is not evidence of defective package content. Dallas must retain a performance gate, but that gate must be refined rather than waived.

## Statewide totals

| Outcome | Count | Percent of 254 |
| --- | ---: | ---: |
| Certified (`PASS`) | 240 | 94.49% |
| Certification-blocked (`FAIL`) | 14 | 5.51% |
| Total reconciled | 254 | 100.00% |

Percentages use `count / 254 × 100`, rounded to two decimals. “Projected” results below are conditional planning estimates, not status changes.

## County resolution register

All rows have current status `FAIL`, failure stage **Gate 2 — certification**, primary classification `CERTIFICATION_LOGIC`, package rebuild **No**, certification-tooling refinement **Yes**, source-data issue **No**, and expected/acceptable blocker **No**. Source values are expected inputs, but continued certification failure is not an acceptable exception. “Ready after correction” means estimated certification readiness after the named tool correction, deterministic recertification of the same immutable artifact, and independent review; it does not mean activation readiness.

| County | FIPS | Exact misses | Alias misses | Load evidence | Exact failure classification and supporting evidence | Required least-invasive corrective action | Estimated readiness after correction |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| Bandera | 48019 | 0/3,000 | 38/5,493 | 122.106 ms | Alias eligibility/normalization contract: integrity `0/0/0`, one load; ordinary `Cr`/`Us` names enter numbered-road alias testing. | Require a numbered suffix in alias eligibility; recertify existing bytes. | PASS expected; no other recorded blocker. |
| Bell | 48027 | 2/3,000 | 0/8,361 | 1,161.934 ms | Exact-sample eligibility/parser contract: integrity `0/0/0`, one load; the two internal-space house values reproduce both misses. | Validate the house field independently; exclude or explicitly support non-representable house grammar; recertify existing bytes. | PASS expected; no other recorded blocker. |
| Brewster | 48043 | 1/3,000 | 0/2,727 | 51.849 ms | Exact-sample eligibility/parser contract: integrity `0/0/0`, one load; internal-space fractional house value reproduces the one miss. | Same exact-sample refinement as Bell; recertify existing bytes. | PASS expected; no other recorded blocker. |
| Cameron | 48061 | 0/3,000 | 232/9,000 | 1,215.068 ms | Alias eligibility/normalization contract; integrity `0/0/0`, one load, exact test complete. | Apply numbered-road alias eligibility and recertify existing bytes. | PASS expected; no other recorded blocker. |
| Cherokee | 48073 | 0/3,000 | 8/8,220 | 182.814 ms | Alias eligibility/normalization contract; integrity `0/0/0`, one load, exact test complete. | Apply numbered-road alias eligibility and recertify existing bytes. | PASS expected; no other recorded blocker. |
| Dallas | 48113 | 0/3,000 | 10/1,116 | 6,535.563 ms; fixed limit 5,000 ms | Alias eligibility plus environment-sensitive performance rule; 1,028,372 records, integrity `0/0/0`, one load, exact test complete. | Refine alias eligibility; define governed benchmark host, warm/cold mode and repeated percentile or a size-aware budget; recertify without weakening performance protection. | PASS expected if governed performance criterion passes; otherwise performance remains the sole blocker. |
| Denton | 48121 | 0/3,000 | 18/1,188 | 2,802.752 ms | Alias eligibility/normalization contract; integrity `0/0/0`, one load, exact test complete. | Apply numbered-road alias eligibility and recertify existing bytes. | PASS expected; no other recorded blocker. |
| Ector | 48135 | 1/3,000 | 0/9,000 | 401.103 ms | Exact-sample eligibility/parser contract; integrity `0/0/0`, one load. | Apply independent house-field eligibility/support rule and recertify existing bytes. | PASS expected; no other recorded blocker. |
| Hudspeth | 48229 | 1/3,000 | 3/9,000 | 26.702 ms | Combined exact-sample and alias eligibility contracts; integrity `0/0/0`, one load. | Apply both bounded eligibility refinements; recertify existing bytes. | PASS expected; no other recorded blocker. |
| Midland | 48329 | 19/3,000 | 0/9,000 | 521.796 ms | Exact-sample eligibility/parser contract; integrity `0/0/0`, one load. | Apply independent house-field eligibility/support rule and recertify existing bytes. | PASS expected; no other recorded blocker. |
| Presidio | 48377 | 0/3,000 | 2/3,411 | 28.076 ms | Alias eligibility/normalization contract; integrity `0/0/0`, one load, exact test complete. | Apply numbered-road alias eligibility and recertify existing bytes. | PASS expected; no other recorded blocker. |
| Rusk | 48401 | 0/3,000 | 8/9,000 | 154.234 ms | Alias eligibility/normalization contract; integrity `0/0/0`, one load, exact test complete. | Apply numbered-road alias eligibility and recertify existing bytes. | PASS expected; no other recorded blocker. |
| Somervell | 48425 | 1/3,000 | 0/9,000 | 28.007 ms | Exact-sample eligibility/parser contract; integrity `0/0/0`, one load. | Apply independent house-field eligibility/support rule and recertify existing bytes. | PASS expected; no other recorded blocker. |
| Taylor | 48441 | 97/3,000 | 777/9,000 | 459.712 ms | Combined exact-sample and alias eligibility contracts; integrity `0/0/0`, one load. | Apply both bounded eligibility refinements; recertify existing bytes and review the larger miss cohort before declaring PASS. | PASS expected only after the larger cohort deterministically reconciles; otherwise retain its named test as blocker. |

`0/0/0` denotes duplicate identities / outside-county records / invalid records. Each row's evidence authority is its matching `reports/lp130-statewide-addresses/batch-*/certification/<county>-<fips>.certification.json`; the LP131 row points to that exact path and immutable SHA-256 identity.

## Failure classifications

| Primary category | Count |
| --- | ---: |
| CERTIFICATION_LOGIC | 14 |
| SOURCE_LIMITATION | 0 |
| AUTHORITATIVE_SOURCE_CONFLICT | 0 |
| PACKAGE_METADATA | 0 |
| PACKAGE_CONTENT | 0 |
| EXPECTED_EXCEPTION | 0 |
| UNRESOLVED | 0 |
| **Total** | **14** |

Each county occurs once and only once in the primary-category total. Secondary observed checks do not create additional primary classifications.

## Recommended actions

| Corrective action cohort | Counties | Count |
| --- | --- | ---: |
| Numbered-road alias eligibility refinement only | Bandera, Cameron, Cherokee, Denton, Presidio, Rusk | 6 |
| Exact house/sample eligibility refinement only | Bell, Brewster, Ector, Midland, Somervell | 5 |
| Both eligibility refinements | Hudspeth, Taylor | 2 |
| Alias refinement plus governed performance benchmark | Dallas | 1 |
| **Total** |  | **14** |

### Rebuild disposition

| Disposition | Counties | Count |
| --- | --- | ---: |
| Rebuild required | None | 0 |
| No rebuild | All 14 counties in the register | 14 |
| Certification refinement only | All 14 counties in the register | 14 |

No metadata correction, regeneration, or source replacement is justified by the evidence. A future recertification report is not a package rebuild.

## Conclusions and governed next step

- **Current statewide certification:** `240 / 254 = 94.49%`.
- **Projected after recommended corrections:** `254 / 254 = 100.00%`, conditional on all 14 immutable packages passing the refined certifier and independent review. This is a forecast, not a declaration that any status changed.
- **Remaining blockers:** exact-sample eligibility for seven counties (including the two combined cases), alias eligibility for nine counties (including Dallas and two combined cases), and a governed performance result for Dallas. Taylor's relatively large cohorts and Dallas performance carry the greatest residual uncertainty.
- **Readiness impact:** the plan can remove Gate 2 blockers without disturbing LP130 manufacturing integrity. It does not close LP131 community, destination, crossing, runtime, operational, or approval gates and therefore does not make a county activation-ready.
- **Risks:** over-broad exclusion could hide valid failures; alias refinement could accidentally weaken numbered-road coverage; performance results may vary by host/cache; source encodings may expose additional grammar after resampling; and a projected pass could be mistaken for certification or activation. Controls are narrow predicates, retained negative tests, immutable SHA verification, repeatable benchmark conditions, before/after reports, independent review, and statewide reconciliation.
- **Recommended next milestone:** LP134 should be a separately authorized, certification-tooling-only patch. It should add controlled regressions for internal-space house values and nonnumeric `CR/FM/SH/US` names, define Dallas benchmark governance, rerun all 14 against unchanged SHA-256 identities, publish before/after evidence, and reconcile `254 = PASS + FAIL`. It must stop if any content or metadata defect is newly proven and must not activate, deploy, upload, or rebuild.

## Audit verification and non-authorization

The LP133 review verified the 14-member FIPS set against LP131, one primary category per county, `240 + 14 = 254`, corrective-action counts `6 + 5 + 2 + 1 = 14`, zero rebuild recommendations, and consistency between each row and its LP130 report. Repository diff review is the control for the non-goals: LP133 adds this report only and changes no runtime, package, sidecar, deployment, Storage, Supabase, Edge Function, protected-system, or activation artifact.

LP133 authorizes no correction and changes no certification status. Until a governed recertification produces PASS, all 14 counties remain certification-blocked and inactive under LP132.
