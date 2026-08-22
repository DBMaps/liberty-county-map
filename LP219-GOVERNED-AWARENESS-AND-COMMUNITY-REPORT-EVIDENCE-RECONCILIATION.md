# LP219 — Governed Awareness and Community-Report Evidence Reconciliation

## 1. Purpose and scope
LP219 establishes a read-only, inspectable evidence authority shared by Location Context, Community Pulse, Alerts, KBYG, map markers, and popups. It does not make broad consumer presentation repairs. `window.gridlyGovernedAwarenessAudit()` returns a bounded snapshot rather than provider payloads.

## 2. Governed evidence types
The contract distinguishes `official_roadway`, `generated_road_incident`, `active_hazard`, `community_report`, and `consumer_only_projection`. Community subtypes remain distinct: blocked crossing, rail-crossing issue, disabled vehicle, flooded road, and closed road. Stale/cleared evidence remains visible to the audit but is ineligible. A consumer-only projection cannot become authority without an identity.

## 3. Evidence identity contract
The stable key is `sourceKind:governedId`, preferring provider record ID, report ID, incident ID, crossing-report ID, record ID, then source ID. Only when no governed ID exists may subtype + coordinates + observation time form a fallback. Identity-less projections fail closed. Duplicate projections retain the first governed row and appear in `duplicateEvidenceIds`.

## 4. Location Context count contract
`governedEligibleEvidenceCount` is the number of unique, current, geographically eligible records whose policy explicitly enables Location Context. It is never derived from Alerts rows, KBYG rows, DOM markers, or `max()` of consumers. `displayedActiveIssueCount` and `locationContextCountAgreement` expose divergence.

## 5. Community Pulse contract
Community Pulse uses the same unique/current/geographic gate, restricted by its explicit policy. `communityPulseEvidenceIds` exposes its exact universe. Wording remains Family L and is not repaired.

## 6. Alerts contract
Each row says whether Alerts is eligible, published, and why omitted. Official records, hazards, and generated incidents are eligible. Existing runtime/product ownership does not define community-report Alerts publication, so those cells are `PRODUCT_CONTRACT_UNDEFINED`, not fabricated failures.

## 7. KBYG Community contract
Generated incidents and hazards are eligible for KBYG Community. Community-report subtype ownership is not defined consistently by existing runtime evidence and therefore remains `PRODUCT_CONTRACT_UNDEFINED`.

## 8. KBYG Official Roadways contract
Official roadway records are eligible; community reports are not. A missing eligible official record is `PROPAGATION_FAILURE`. This keeps Family K separable.

## 9. Map and popup contract
All supported community report, official, hazard, and generated-incident evidence is map/popup eligible. Map publication proves a projection exists, not eligibility for Alerts or KBYG. IDs are reconciled back to governed evidence.

## 10. Pecos two-report evidence
The deterministic two-report reconstruction identifies `community_report:pecos-blocked` and `community_report:pecos-disabled`. Both are map eligible. Blocked crossing is Location Context/Community Pulse eligible; disabled vehicle is map/popup-only under the existing active-awareness behavior. Therefore two markers and one active issue is deterministic. Alerts and KBYG Community intent remain undefined, explaining their omission without calling it a propagation failure.

## 11. Cienegas Terrace blocked-crossing evidence
The blocked-crossing record is map, popup, Location Context, and Community Pulse eligible. Initial map=yes, Location Context=1 is coherent; absent Alerts/KBYG is contract-undefined rather than automatically defective.

## 12. Cienegas Terrace later four-active-issue evidence
The retained owner observation does not include the three additional source IDs/payloads. Deterministic reconstruction therefore fails closed: one identified governed item versus displayed four, classification **G** (count unexplained by available evidence) and potentially **I** (asynchronous arrival). The audit will identify all four in a live replay if present; it never invents the missing three or assumes they are reports.

## 13. Val Verde generated-incident cohort
Laughlin AFB, Cienegas Terrace, Amistad, and Box Canyon generated incidents are real governed evidence, separately typed from reports. They remain Location Context/Community Pulse evidence. When current and geographically eligible but absent from Alerts/KBYG Community, classification is **E — propagation failure (Family M)**, not unsupported Family G.

## 14. McAllen report cohort
Rail-crossing issue and flooded-road report are separately identified and both count eligible/map eligible. Alerts and KBYG Community publication intent remains **J — product contract undefined**. Subtype-dependent observed publication is exposed, not normalized by guesswork.

## 15. Del Rio report cohort
Blocked crossing and closed-road are independently count/map eligible. The observed crossing KBYG publication is recorded as actual publication; it does not silently define a universal policy. Empty Alerts and closed-road KBYG remain **J** pending ownership decision.

## 16. Pearsall positive flooding control
DriveTexas `Flooding on FM 140` is `official_roadway:flooding` and full-stack eligible for Location Context, Community Pulse, Alerts, KBYG Official Roadways, map, and popup. LP219 changes no DriveTexas authority.

## 17. Rankin grouping control
Three governed records remain three Location Context issues even when KBYG renders two grouped rows. Consumer text-row count never controls evidence count.

## 18. Official subtype matrix
| Subtype | Map/popup | Location | Pulse | Alerts | KBYG Community | KBYG Official |
|---|---:|---:|---:|---:|---:|---:|
| Flooding | yes | yes | yes | yes | no | yes |
| Lane Closure | yes | yes | yes | yes | no | yes |
| Road Closure | yes | yes | yes | yes | no | yes |
| Bridge Restriction | yes | yes | yes | yes | no | yes |
| Travel Advisory | yes | yes | yes | yes | no | yes |
| Debris/related incident | yes | yes | yes | yes | no | yes |

## 19. Community-report subtype matrix
`undefined` means `PRODUCT_CONTRACT_UNDEFINED`.
| Subtype | Map/popup | Location | Pulse | Alerts | KBYG Community | KBYG Official |
|---|---:|---:|---:|---:|---:|---:|
| Blocked crossing | yes | yes | yes | undefined | undefined | no |
| Disabled vehicle | yes | no | no | undefined | undefined | no |
| Flooded road | yes | yes | yes | undefined | undefined | no |
| Closed road | yes | yes | yes | undefined | undefined | no |
| Rail crossing issue | yes | yes | yes | undefined | undefined | no |

## 20. Async convergence findings
Snapshots carry transition, evidence, and provider-refresh generations plus ordered timestamp/reason events. A snapshot from an older evidence generation is rejected and cannot overwrite the newer snapshot. Live events are bounded to 40 entries. Instrumentation does not optimize recomputation.

## 21. Exact root causes and category mapping
1. Multiple arrays/DOM projections previously lacked one inspectable identity/eligibility ledger (cross-surface opacity).
2. Pecos is subtype policy divergence, not count loss: blocked crossing counts; disabled vehicle does not.
3. Generated incidents omitted downstream are **E/M**.
4. Missing community consumers are **J** until product ownership is defined.
5. Floydada Travel Advisory is present eligible evidence with a KBYG **E/K** omission.
6. Unreconstructable Cienegas 4 is **G**, with **I** possible only if timestamps demonstrate asynchronous arrival.
7. Stale (**B**) and duplicate (**H**) records are retained for diagnosis but excluded from count.

## 22. G/M/community-report/K separation
G means counted evidence is unexplained; M means identified generated evidence fails eligible consumers; community-report propagation retains subtype/product-policy status; K is an identified official subtype omission. Similar empty panels do not merge these families.

## 23. Production changes
Production code changed only to load the governed-awareness engine and expose the read-only audit adapter. No downstream publishing, presentation, source ownership, or count UI was changed.

## 24. Tests
`npm run test:lp219` covers stable identity, dedupe, stale exclusion, generation ordering, five community subtypes, Pecos, Cienegas, generated incidents, Pearsall, Floydada, Rankin grouping, quiet state, map independence, fail-closed projections, and absence of town/county special cases. Required protected regressions are run separately and reported with exact results.

## 25. Protected closed families
Families C, J, and I remain protected. LP201/202/202.1/202.2/196/213/214/216/217/217.1/217.2/218/218.1/218.2/218.3 authority is unchanged, including membership, geometry, counties, crossings, and watched-count ownership.

## 26–31. Deferred work
- **Family A:** literal Alerts markup sanitization.
- **Family K:** Floydada Travel Advisory KBYG repair; evidence remains visible and eligible.
- **Family L:** Community Pulse one/several wording.
- **Floydada source validity:** current FRA/governed crossing validity review.
- **Multi-county UX:** operational-context clarity; authority unchanged.
- **Performance:** preserve recorded rAF 277–673 ms, click up to 1206 ms, timeout 113 ms, inputs 187–214 ms, and forced reflow 35–38 ms. No optimization performed.

## 32. Remaining owner-browser acceptance
No browser PASS is claimed. For Pecos, Cienegas Terrace, another Val Verde identity, McAllen/equivalent, Del Rio/equivalent, Pearsall, Rankin, and a quiet control: reach stable UI, run `window.gridlyGovernedAwarenessAudit()`, and retain governed count, source/current breakdowns, Location/Pulse IDs, consumer/map IDs, omissions, generations, events, and stable state. Cienegas must be captured initially and after later arrivals; a four count passes only when four IDs are present.
