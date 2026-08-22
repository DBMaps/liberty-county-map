# LP221 — Val Verde County Community Runtime Investigation

## Decision and scope

LP221 remains **owner-browser acceptance required**. This audit did not treat the later Cienegas Terrace replay as proof for Box Canyon and did not change production selection, presentation, crossing filtering, hazard propagation, or lifecycle policy. The only production-code change is a read-only integrated audit adapter, `window.gridlyValVerdeCommunityRuntimeAudit?.()`, which composes the existing authorities.

## Authoritative inventory

Gridly's governed community registry assigns every audited place to Census county FIPS `48465` (`val-verde-tx`). The canonical keys are `place-<GEOID>` and their governed type is shown below.

| Community | PLACE GEOID / key | Governed type | LP201 presentation `(lat, lon)` |
|---|---|---|---|
| Amistad | `4803096` / `place-4803096` | `CENSUS_DESIGNATED_PLACE` | `29.5244929, -101.15305` |
| Box Canyon | `4809656` / `place-4809656` | `CENSUS_DESIGNATED_PLACE` | `29.5335121, -101.15861` |
| Cienegas Terrace | `4814927` / `place-4814927` | `CENSUS_DESIGNATED_PLACE` | `29.3674511, -100.9437068` |
| Laughlin AFB | `4841704` / `place-4841704` | `CENSUS_DESIGNATED_PLACE` | `29.358463, -100.7768832` |
| Del Rio | `4819792` / `place-4819792` | `INCORPORATED_PLACE` | `29.357515, -100.8987707` |

The governed Val Verde crossing manifest points to the county production GeoJSON and declares 47 records; the file contains exactly 47 features.

## Audit boundary and first-losing-stage helper

For the currently selected community, the helper reports:

1. canonical label/key/type/GEOID, selected-area identity, active county, governed-awareness county, crossing-source county, transition generation, and stable state;
2. the LP201 coordinate and authority, awareness anchor, actual Leaflet center, distance to center, and recent semantic-camera writers;
3. runtime crossing inventory, watched count, in-bounds public-roadway count, viewport eligibility, Leaflet/rendered and DOM counts, skip reasons, and viewport authority;
4. governed count, Location Context count, LP219.4 Alerts and KBYG lineages, and stale/duplicate/inactive-history IDs; and
5. transition generation and stale county-request suppressions.

The first-loss classification is ordered at identity, county convergence, presentation, crossing render lifecycle, Alerts, then KBYG. The helper does not manufacture an alternative projection. A null first loss means only that the currently observable instrumentation did not find a loss; it is not browser acceptance.

## Findings by community

| Community | Authoritative identity/presentation | Current automated conclusion | Owner-browser work |
|---|---|---|---|
| Box Canyon | PASS | `INSUFFICIENT_OWNER_EVIDENCE`: the historical movement defect is not reproduced by static/unit evidence. The new helper can now identify the first divergent authority and late camera writer. No coordinate or camera repair is justified before the transition is replayed in the real browser. | Select Box Canyon from Del Rio and Cienegas Terrace; capture helper output after convergence and again after settling. |
| Cienegas Terrace | PASS | `REPAIRED_BY_PRIOR_STATEWIDE_WORK` for the historical generic active-hazard Alerts/KBYG drop, as protected by LP219.4. `EXPECTED_BY_CURRENT_PRODUCT_CONTRACT` for watched count differing from visible markers. The reported 19-watched replay remains owner evidence, not proof for other places. | Reconfirm 19 watched, then separately record in-bounds/eligible/rendered/DOM counts. |
| Laughlin AFB | PASS | `INSUFFICIENT_OWNER_EVIDENCE`: no current live transition or viewport capture was supplied. No defect was invented. | Capture all five contracts at settled state. |
| Amistad | PASS | `INSUFFICIENT_OWNER_EVIDENCE`: no current live transition or viewport capture was supplied. No defect was invented. | Capture all five contracts at settled state. |
| Del Rio | PASS | Automated identity/county control and transition endpoint. `INSUFFICIENT_OWNER_EVIDENCE` for live map/DOM acceptance. | Capture initial and final Del Rio snapshots around the required transition chain. |

## Historical-finding classification

| Historical finding | Classification | Evidence/result |
|---|---|---|
| Box Canyon map/community convergence or movement | `INSUFFICIENT_OWNER_EVIDENCE` | Current governed identity and LP201 presentation are internally consistent. No real-browser replay was performed, so neither “fixed” nor “broken” is asserted. The helper exposes map distance and later camera writers needed to prove the first divergence. |
| Cienegas Terrace had valid crossings but `0 crossings watched` | `INSUFFICIENT_OWNER_EVIDENCE` for the old zero; `EXPECTED_BY_CURRENT_PRODUCT_CONTRACT` for watched/visible inequality | LP220 proves watched, viewport eligibility, and marker visibility are independent. Current browser acceptance must retest rather than extrapolate from the later 19-watched observation. |
| Governed/generated incident reached upstream awareness but not Alerts/KBYG | `REPAIRED_BY_PRIOR_STATEWIDE_WORK` for the generic LP219.4 boundary | LP219.4 tests protect governed eligibility through final Alerts data/DOM and KBYG final authority/Travel Brief. Any new helper first loss is a distinct current defect, not permission to duplicate propagation logic. |
| Missing single-command Val Verde first-loss trace | `AUDIT_INSTRUMENTATION_DEFECT` — repaired in LP221 | The integrated helper now composes identity, map, crossing, LP219.3/LP219.4, and stale-state truth. |
| Blocked-crossing visibility policy | `DEFERRED_PRODUCT_POLICY` | Not changed. |
| Crossing watched count differs from marker count | `EXPECTED_BY_CURRENT_PRODUCT_CONTRACT` | Location Context geographic ownership and live Leaflet viewport rendering are intentionally separate contracts. |

## Root causes and repairs

The only proven current root cause was an **instrumentation boundary**: no integrated Val Verde helper exposed the first losing stage across the five contracts. LP221 repairs that narrow defect by composing existing runtime audits. No behavioral root cause was proven and no production behavior was repaired. In particular, LP221 did not alter LP201 coordinates, camera ownership, viewport bounds, blocked-crossing policy, or LP219.4 publication.

If the Box Canyon replay shows a late camera writer, that writer is a separate, evidence-led follow-up. If Alerts and KBYG fail at different stages, they must be split into separate milestones rather than bundled here.

## Transition acceptance procedure

In a production-equivalent browser, perform `Del Rio → Cienegas Terrace → Box Canyon → Del Rio`. After each selection has settled, save `window.gridlyValVerdeCommunityRuntimeAudit?.()` and verify:

- identity, active county, governed county, and crossing source all converge to `val-verde-tx`;
- generation advances and no prior selected identity/county/evidence remains authoritative;
- the map center converges to the canonical presentation transaction, with any later writer identified;
- watched count is evaluated independently of viewport/in-bounds/eligible/rendered/DOM marker counts;
- quiet state is consistently zero/quiet across governed authority and consumers;
- active generic evidence reaches Location Context, Alerts, and Travel Brief;
- cleared, stale-generation, duplicate, old-area, and foreign-county evidence is rejected.

## Protected controls and deferrals

- Eastland LP220 viewport filtering remains unchanged.
- Sulphur Springs LP219.4 active-hazard Alerts/KBYG propagation remains unchanged.
- Pecos LP219.4 mixed-evidence behavior remains unchanged.
- LP219.3 lifecycle/count authority remains unchanged.
- DriveTexas, Weather/NWS, Supabase/report persistence, Route Watch, and performance were not changed.
- Performance remains separately unresolved. Record warnings during owner replay, but do not optimize them under LP221.

## Completion status

Automated inventory, contract, and protected regression checks can establish code-level safety. They cannot establish final Leaflet movement, visible DOM state, device timing, or owner acceptance. **Owner browser acceptance is still required; this document does not claim it.**
