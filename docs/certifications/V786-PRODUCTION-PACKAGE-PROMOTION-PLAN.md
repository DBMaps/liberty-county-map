# V786 — Production Package Promotion Plan

## Scope

V786 is a documentation and planning milestone only. It defines the standard promotion process for moving a county from manufactured assets to a consumer-available production county. It does not enable counties, register counties, modify runtime behavior, alter production or community packages, update manifests, change application JavaScript/HTML/CSS, move or copy package files, or alter protected systems.

## Standard Promotion Pipeline

Source Data  
↓  
Community Package  
↓  
Crossing Package  
↓  
Production Package  
↓  
Production Certification  
↓  
Production Manifest  
↓  
Application Repository  
↓  
Runtime Registration  
↓  
Search Integration  
↓  
Awareness Enablement  
↓  
Consumer Available

### Stage 1 — Source Data

- **Purpose:** Establish authoritative county boundary, road, crossing, and supporting source inputs before any county package work proceeds.
- **Inputs:** County boundary source, transportation/road source, crossing source candidates, source metadata, provenance notes, and validation assumptions.
- **Outputs:** Source data inventory, accepted source references, known limitations, and go/no-go decision for package manufacturing.
- **Verification:** Confirm source files or references exist, provenance is documented, boundaries and roads are suitable for the county scope, and no unresolved source-blocking gaps remain.
- **Exit Criteria:** Authoritative or accepted source material is documented and sufficient to manufacture a community package.

### Stage 2 — Community Package

- **Purpose:** Convert accepted source data into the repository's community-package format without making the county consumer available.
- **Inputs:** Source data inventory, county identity metadata, normalized roads, normalized boundaries, and community package specification.
- **Outputs:** Community county package assets and package-level evidence that the county has entered the manufactured pipeline.
- **Verification:** Confirm package structure, county naming, boundary/road presence, basic schema conformance, and repository inventory visibility.
- **Exit Criteria:** Community package exists, is internally consistent, and is ready to feed crossing package generation.

### Stage 3 — Crossing Package

- **Purpose:** Produce the manufactured crossing package used to evaluate and prepare crossing data for production promotion.
- **Inputs:** Community package, road network, boundary geometry, crossing extraction rules, and crossing package specification.
- **Outputs:** County crossing package, crossing inventory, crossing metadata, and validation notes.
- **Verification:** Confirm crossing package existence, schema conformance, expected county association, boundary containment, road association, and absence of fatal validation errors.
- **Exit Criteria:** Crossing package exists and is suitable for production-package build review.

### Stage 4 — Production Package

- **Purpose:** Build the consumer-grade production crossing package for a county without yet exposing it through runtime registration or application availability.
- **Inputs:** Validated crossing package, production crossing package standard, county metadata, and any required production transformation rules.
- **Outputs:** Production package assets, production crossing inventory, package version metadata, and package build evidence.
- **Verification:** Confirm production package presence, package schema, crossing count, county identifier alignment, production-only metadata, and compatibility with production crossing runtime expectations.
- **Exit Criteria:** Production package is complete, reviewable, and ready for formal certification.

### Stage 5 — Production Certification

- **Purpose:** Certify that the production package is complete and safe to advance to production manifest consideration.
- **Inputs:** Production package, package build evidence, validation logs, protected-system impact assessment, and promotion checklist state.
- **Outputs:** Certification document, structured evidence record, pass/fail decision, and known caveats.
- **Verification:** Confirm all required checks passed or were explicitly documented as blocked, protected systems remain unchanged unless separately authorized, and certification evidence is reproducible.
- **Exit Criteria:** Certification is complete and explicitly authorizes advancement to production manifest update planning.

### Stage 6 — Production Manifest

- **Purpose:** Register the certified production package in the production package manifest so the application repository can install or reference it in a controlled way.
- **Inputs:** Certification output, production package identity, package version, crossing count, package path, and manifest update authorization.
- **Outputs:** Manifest entry and manifest validation evidence.
- **Verification:** Confirm the manifest entry matches the certified package, no unrelated manifest entries changed, and manifest validation succeeds.
- **Exit Criteria:** Production manifest contains the county package entry and the entry is validated.

### Stage 7 — Application Repository

- **Purpose:** Install or expose the production package assets within the application repository without automatically enabling runtime consumers.
- **Inputs:** Manifested production package, application package placement standard, repository integration instructions, and installation authorization.
- **Outputs:** Application-side package assets or references and installation evidence.
- **Verification:** Confirm only authorized application package files changed, paths match runtime expectations, and no runtime registration/search/awareness toggles were enabled prematurely.
- **Exit Criteria:** Application repository contains the county's production package assets in the expected location.

### Stage 8 — Runtime Registration

- **Purpose:** Register the county with runtime county registries so production crossing runtime can resolve the county when explicitly enabled.
- **Inputs:** Application-installed package, county runtime identifier, registry update authorization, and rollback plan.
- **Outputs:** Runtime registration entry and runtime validation evidence.
- **Verification:** Confirm county appears in runtime registry, existing counties remain registered, production crossing runtime loads the package, and no unrelated runtime behavior changes occur.
- **Exit Criteria:** Runtime registration is complete and runtime validation passes.

### Stage 9 — Search Integration

- **Purpose:** Make the registered county discoverable through county-aware search paths.
- **Inputs:** Runtime-registered county, search configuration authorization, county labels/aliases, and search validation cases.
- **Outputs:** Search enablement configuration and search validation evidence.
- **Verification:** Confirm county search queries resolve as expected, existing county search behavior remains unchanged, and disabled counties remain hidden.
- **Exit Criteria:** Search integration validates for the county and regression checks pass for existing counties.

### Stage 10 — Awareness Enablement

- **Purpose:** Enable county-aware filtering, incident context, and awareness presentation after runtime and search integration are validated.
- **Inputs:** Runtime-registered county, search-enabled county, awareness configuration authorization, and filtering validation scenarios.
- **Outputs:** Awareness enablement configuration and filtering validation evidence.
- **Verification:** Confirm awareness filtering includes the county only when intended, existing awareness behavior remains unchanged, and hazard/report flows do not regress.
- **Exit Criteria:** Awareness validation passes and county behavior is ready for consumer validation.

### Stage 11 — Consumer Available

- **Purpose:** Confirm the county is fully available to consumers after package, runtime, search, awareness, and readiness checks pass.
- **Inputs:** Completed promotion checklist, readiness evidence, runtime validation, search validation, awareness validation, and rollback notes.
- **Outputs:** Consumer availability decision, validation summary, and release/merge recommendation.
- **Verification:** Confirm the county is visible, searchable, filterable, operational in production crossing runtime, and does not regress protected systems.
- **Exit Criteria:** Consumer validation completes and the county is declared available.

## Promotion Checklist

A county may advance only when the current item and all previous items are complete and evidenced:

1. Source data accepted and provenance documented.
2. Community package exists.
3. Community package structure and schema validated.
4. Crossing package exists.
5. Crossing package validation completed.
6. Production package built.
7. Production package validation completed.
8. Production certification completed.
9. Certification evidence recorded.
10. Production manifest update authorized.
11. Manifest updated and validated.
12. Application package installation authorized.
13. Application package installed or referenced.
14. Runtime registration authorized.
15. Runtime registration completed.
16. Production crossing runtime validation passed.
17. Search integration authorized.
18. Search enabled and validated.
19. Awareness enablement authorized.
20. Awareness enabled and validated.
21. Protected-system regression review completed.
22. Production readiness validated.
23. Consumer validation completed.
24. Rollback/disablement path documented.
25. Consumer availability decision recorded.

## Promotion Gates

| Gate | Advancement | Mandatory Verification | Exit Requirement |
|---|---|---|---|
| G1 | Source Data → Community Package | Source provenance, boundary scope, road suitability, and source limitations are documented. | Source data is accepted for manufacturing. |
| G2 | Community Package → Crossing Package | Community package exists, has expected county identity, and passes structure/schema review. | Community package is eligible for crossing generation. |
| G3 | Crossing Package → Production Package | Crossing package exists, passes county association and geometry/road checks, and has no fatal validation issues. | Crossing package is eligible for production build. |
| G4 | Production Package → Production Certification | Production package exists, package metadata and crossing inventory match expectations, and validation evidence is present. | Production package is eligible for certification. |
| G5 | Production Certification → Production Manifest | Certification is complete, evidence is recorded, and promotion risk is accepted. | Manifest update may be planned. |
| G6 | Production Manifest → Application Repository | Manifest entry is authorized, matches certified package metadata, and validates without unrelated manifest changes. | Application package installation may be planned. |
| G7 | Application Repository → Runtime Registration | Application assets exist in expected locations and no runtime/search/awareness enablement has occurred prematurely. | Runtime registration may be planned. |
| G8 | Runtime Registration → Search Integration | Runtime registry includes the county, production crossing runtime validates, and existing registered counties are unaffected. | Search integration may be planned. |
| G9 | Search Integration → Awareness Enablement | Search resolves the county correctly and existing county search behavior remains unchanged. | Awareness enablement may be planned. |
| G10 | Awareness Enablement → Consumer Available | Awareness filtering validates, protected systems regressions are clear, and consumer scenarios pass. | County may be declared consumer available. |

No gate may be skipped. A county that lacks evidence for a prior stage must return to the earliest incomplete stage before promotion continues.

## Chambers Case Study

Chambers is used only as a case study. This plan does not enable Chambers, register Chambers, update search, update awareness, change manifests, or modify packages.

- **Current observed stage:** Application repository installed but not enabled.
- **Completed observed stages:** Community package exists, crossing package exists, production package exists, production manifest entry exists, and application repository contains package assets.
- **Remaining stages:** Production certification evidence, runtime registration, production crossing runtime validation, search integration, awareness enablement, production readiness validation, consumer validation, and consumer availability decision.
- **Promotion readiness:** Chambers appears to be the nearest candidate for a future controlled promotion because it is already production-packaged, manifested, and application-installed. It is not consumer ready until certification, runtime, search, awareness, and consumer validation gates are completed under a separate authorized milestone.
- **Promotion action in V786:** None. Chambers remains not runtime registered, not search enabled, not awareness enabled, and not consumer available.

## Recommended County Enablement Order

This sequencing is advisory only and does not modify counties:

1. **Chambers** — closest to promotion based on observed production package, manifest presence, and application installation; requires certification and enablement gates before consumer availability.
2. **Jefferson** — application assets are present, but production package/manifest/certification are incomplete; resolve road dataset and production packaging before enablement.
3. **Polk** — application assets are present and community/crossing manufacturing exists; requires production package, certification, manifest, runtime, search, and awareness work.
4. **Harris** — application assets are present, but scale/risk is likely higher; defer until smaller installed-but-not-enabled counties validate the process.
5. **Hardin, Walker, Orange, Jasper, Newton, Tyler** — nearby manufactured counties with community and crossing packages; promote one at a time after installed-but-not-enabled counties are reconciled.
6. **Galveston, Brazoria, Fort Bend, Waller** — regional expansion group requiring production packaging and all later gates.
7. **Austin, Washington, Brazos, Grimes** — manufactured inland expansion group requiring production packaging and all later gates.
8. **Wharton, Colorado, Fayette, Lavaca, Jackson, Matagorda, Calhoun** — remaining manufactured expansion group requiring production packaging and all later gates.

## Protected System Verification

V786 is documentation-only. The following protected systems are explicitly unchanged by this milestone:

- Shared Reports — unchanged.
- Route Watch — unchanged.
- Awareness Filtering — unchanged.
- Hazard Lifecycle — unchanged.
- Alert Generation — unchanged.
- Supabase Synchronization — unchanged.
- Production Crossing Runtime — unchanged.
- Community Package Pipeline — unchanged.
- Developer Toolkit — unchanged.

## Testing Results

| Check | Command | Result | Observation |
|---|---|---|---|
| JSON validation | `python -m json.tool docs/certifications/evidence/V786-production-package-promotion-plan.json` | PASS | Evidence JSON parsed successfully. |
| PowerShell availability | `command -v pwsh` | BLOCKED | PowerShell is unavailable in this environment; toolkit execution could not be performed. |

## Evidence

Structured evidence: `docs/certifications/evidence/V786-production-package-promotion-plan.json`.
