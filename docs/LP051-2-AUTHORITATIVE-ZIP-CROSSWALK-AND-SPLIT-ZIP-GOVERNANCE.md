# LP051.2 — Authoritative ZIP Crosswalk & Split-ZIP Governance

## Executive conclusion

LP051.2 keeps ZIP personalization passive and **does not** recommend visible onboarding or Settings integration. The runtime now exposes the authoritative `window.gridlyLp0512ZipCrosswalkGovernanceAudit?.()` helper, an LP051.2 resolver contract, target inventory classifications, explicit split-ZIP handling, and explicit ZIP-type unsupported outcomes.

## Source authority

The source used is repository-local runtime authority: live Gridly county and awareness registries in `js/app.js`, the existing ZIP fallback lookup, the governed LP051/LP051.1 representative records, and explicit LP051.2 governance overrides for split ZIP and ZIP-type behavior.

No complete USPS/HUD/Census ZIP crosswalk source was present locally after inspecting repository ZIP references, runtime county implementation assets, the LP051/LP051.1 documentation, the existing ZIP fallback lookup, and existing runtime registries.

## Source limitations and ZIP versus ZCTA distinction

The dataset is not direct USPS geography. It does not silently equate USPS ZIP codes with Census ZCTAs. The contract remains: **USPS ZIP input → Gridly consumer awareness assignment**.

## Generated crosswalk architecture

The implemented pipeline is deterministic:

1. Read live selectable county and awareness-area registries.
2. Preserve governed LP051/LP051.1 ZIP records.
3. Add explicit LP051.2 ZIP-type governance samples.
4. Generate a target inventory and coverage certification at runtime.
5. Keep unresolved targets classified instead of forced.

## Dataset schema and runtime integration

Resolver results include `resolved`, `status`, `zip`, `zipType`, `countyId`, `countyName`, `communityKey`, `communityLabel`, `awarenessAreaKey`, `consumerLabel`, `resolutionMethod`, `authority`, `confidence`, `candidates`, `reason`, `presentationChanged`, and `routeIntelligenceTouched` where applicable. `presentationChanged` and `routeIntelligenceTouched` remain false.

## County coverage

All 28 selectable operational counties remain represented. The audit reports missing counties separately and must block certification if any selectable county is absent.

## Community and awareness-area coverage

The audit classifies targets as `directly_zip_resolvable`, `requires_disambiguation`, `not_zip_addressable`, or `internal_or_fallback`. Countywide, fallback, and `Other` identities are not counted as consumer ZIP coverage gaps. Remaining community and awareness-area gaps are reported as uncovered eligible targets, keeping certification partial.

## Eligibility classifications

- `directly_zip_resolvable`: ZIP resolves safely to a Gridly consumer awareness identity.
- `resolved_by_governance`: reviewed governed assignment.
- `requires_disambiguation`: ZIP alone is insufficient.
- `not_zip_addressable`: valid Gridly target, but no safe ZIP-only ownership exists in the available authority.
- `internal_or_fallback`: countywide, fallback, duplicate, or internal identity not requiring direct ZIP ownership.

## Split-ZIP governance policy

Split ZIPs do not resolve silently. If multiple plausible Gridly outcomes exist, the resolver returns `ambiguous` with candidates for future disambiguation.

## PO Box-only policy

PO Box-only ZIPs return `po_box_not_supported` unless a future governance override proves a safe consumer locality assignment.

## Unique ZIP policy

Unique ZIPs return `unique_zip_not_supported` unless a future governance override proves residential or institutional setup suitability.

## Harris/Houston governance

Harris County preserves the existing simplified Houston regional model and distinct Harris communities. The runtime audit reports Houston governance results without collapsing all Houston ZIPs into a generic Houston identity.

## 77084 decision

77084 remains explicitly ambiguous. ZIP alone must not choose Katy, Houston, Harris, Fort Bend, Waller, or another plausible Gridly identity without approved governance and stronger source evidence.

## Invalid and unsupported behavior

Invalid ZIP input returns `invalid`. Unknown ZIPs return `unsupported`. PO Box-only and unique examples return controlled non-resolved statuses. None of these results mutates setup or Route Intelligence.

## Maintenance and regeneration steps

1. Update authoritative ZIP/ZCTA or USPS/HUD source files when available.
2. Re-run static/runtime tests.
3. Verify `window.gridlyLp0512ZipCrosswalkGovernanceAudit?.()` in a browser.
4. Confirm all unknown identity and conflict counts are zero.
5. Keep UI integration disabled until the audit reaches at least `ui_candidate` under honest coverage rules.

## Known limitations

A complete local ZIP authority source is not available in this repository. LP051.2 therefore preserves governed records, classifies remaining targets honestly, and keeps certification partial.

## UI integration readiness

`mergeReadyForUiIntegration` remains false. Manual county/community setup remains the active path.

## Recommended next milestone

LP051.3 should import an authoritative ZIP type/county/community source package, add source-versioned generation artifacts, and expand governed split-ZIP candidates before any UI exposure.
