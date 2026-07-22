# LP051.5 — Source-Backed ZIP Candidate Governance

## Executive summary

LP051.5 reviews the 566 LP051.4 source-backed ZIP candidates and adds a separate governance layer at `data/generated/gridly-zip-candidate-governance-v1.json`. ZIP remains only an input method: consumer-facing results continue to use existing Gridly community and awareness-area labels, and unsafe candidates remain ambiguous or require confirmation.

The milestone does not enable onboarding ZIP entry, Settings ZIP entry, setup persistence, Route Intelligence, map focus, alerts, weather, DriveTexas, or any other protected runtime system.

## Candidate inventory

| Inventory class | Count | LP051.5 policy |
| --- | ---: | --- |
| single_county_source_backed | 441 | Existing governed runtime records may resolve; otherwise county-only evidence requires confirmation. |
| dominant_county_candidate | 78 | Dominance is recorded, but county dominance alone is not community evidence. |
| split_supported_counties | 34 | Classified as ambiguous unless an existing protected/governed record already documents behavior. |
| split_supported_and_unsupported | 13 | Requires confirmation; Gridly does not silently assume the supported county. |
| insufficient_county_evidence | 0 | No LP051.4 launch-region candidate used this class. |

## Governance methodology

LP051.5 combines the generated candidate inventory with existing runtime governance. Generated evidence is not edited. Each candidate receives one of the approved governance decisions. Automatic consumer assignment is allowed only for records already backed by existing Gridly identities in the runtime dataset.

## Safe automatic resolution policy

Automatic resolution requires strong source evidence, stable county ownership, strong community evidence, an existing Gridly identity, and no conflicting supported community. LP051.5 therefore certifies only existing governed runtime assignments and leaves county-only candidates in `requires_confirmation`.

## Split ZIP policy

The 34 supported-county split ZIP candidates are not silently resolved. Their consumer implication is that ZIP alone cannot identify which supported county/community the user belongs to. Future setup behavior should ask for confirmation or continue to manual community selection.

The 13 supported/unsupported overlap ZIPs are also not silently assigned to the supported county. They require confirmation unless later evidence proves the user-facing community.

## Dominant county policy

All 78 dominant-county candidates were reviewed. Their dominant HUD ratio is useful evidence, but LP051.5 treats it as county evidence only. Dominant county candidates remain `requires_confirmation` unless the ZIP was already governed in the existing runtime dataset.

## Rural policy

Rural counties including Liberty, Polk, Walker, Hardin, Tyler, Newton, and Jasper contain ZIPs that can cover multiple towns, broad rural geography, or multiple awareness areas. LP051.5 does not pretend ZIP alone knows the user's town; these candidates require confirmation unless already governed.

## Harris/Houston policy

LP051.5 preserves the existing simplified Houston model. It does not collapse Houston into one region and does not invent neighborhoods. Existing governed examples remain Downtown / Midtown, North Houston / Greenspoint, Southeast Houston / Hobby, Baytown, and protected Katy ambiguity for 77084. Other Harris candidates remain in review/confirmation posture until region-level evidence is governed.

## 77084 review

77084 remains ambiguous. LP051.5 documents it as protected because west Harris/Katy postal context cannot safely produce one automatic consumer setup result from ZIP alone.

## PO Box policy

77201 remains `po_box_not_supported`. PO Box-only ZIPs do not provide a safe home-awareness assignment without explicit future governance.

## Unique ZIP policy

77210 remains `unique_zip_not_supported`. Unique ZIPs are not considered safe home-awareness input unless a later milestone documents residential/institutional suitability.

## Governance totals

| Decision | Count |
| --- | ---: |
| resolved | 4 |
| resolved_by_governance | 29 |
| covered_by_shared_zip | 0 |
| requires_confirmation | 497 |
| ambiguous | 35 |
| unsupported | 2 |
| not_zip_addressable | 0 |
| internal_only | 0 |

## Coverage totals

- candidateCount: `566`
- reviewedCandidateCount: `566`
- unknownCountyIdCount: `0`
- unknownCommunityCount: `0`
- unknownAwarenessAreaCount: `0`
- candidateIdentityErrorCount: `0`
- coverageCertificationStatus: `partial`
- mergeReadyForUiIntegration: `false`

## Remaining review inventory

497 candidates intentionally remain `requires_confirmation`. These include county-only source-backed ZIPs, all non-governed dominant county candidates, Harris/Houston candidates without governed region identity, rural multi-community candidates, and supported/unsupported overlap candidates.

## UI readiness recommendation

LP051.5 is not UI-ready. The governance layer is complete enough for audited runtime awareness and guarded future setup design, but `mergeReadyForUiIntegration` remains `false` because many candidates intentionally require confirmation.

## Browser testing

1. Load the app without changing setup.
2. Run `window.gridlyLp0515ZipCandidateGovernanceAudit?.()`.
3. Confirm `candidateCount` and `reviewedCandidateCount` are both `566`.
4. Confirm `coverageCertificationStatus` is `partial` and `mergeReadyForUiIntegration` is `false`.
5. Confirm protected ZIP behavior for 77084, 77201, and 77210 remains unchanged through `window.gridlyResolveHomeZipAwareness(...)`.

## Recommended next branch

LP051.6 should design a guarded confirmation UX prototype that still presents communities and awareness areas, not ZIP codes, and should keep manual setup as the active production path.
