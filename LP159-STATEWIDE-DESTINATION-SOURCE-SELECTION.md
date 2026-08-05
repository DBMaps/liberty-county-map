# LP159 — Statewide Destination Source Selection & Integration Plan

LP159 is an audit-first, patch-second planning milestone for selecting the long-term authoritative destination data strategy for statewide Texas destination search. It does not deploy destination data, activate runtime behavior, replace LP158, modify protected infrastructure, or introduce frameworks.

## Deliverables

- `data/lp159/destination-source-selection.json`
- `reports/lp159/category-coverage-matrix.json`
- `reports/lp159/licensing-assessment.json`
- `reports/lp159/refresh-strategy.json`
- `reports/lp159/destination-quality-assessment.json`
- `reports/lp159/integration-plan.json`
- `reports/lp159/final-destination-source-recommendation.json`

## Selected statewide strategy

Gridly should use a governed hybrid source strategy:

1. **Approved primary source:** Overture Maps Places for statewide consumer POI search breadth, brand/category coverage, stable IDs, open licensing, and monthly refresh planning.
2. **Approved authoritative supplements:** Texas Open Data, TNRIS/TxGIO, TxDOT open GIS, and TWDB GIS for government, transportation, natural-recreation, water, dam, and infrastructure context where the responsible agency publishes a suitable layer.
3. **Conditionally approved enrichment:** Foursquare OS Places, OpenStreetMap, federal provider/HIFLD successor layers, EPA FRS, and SafeGraph may be used only after source-specific licensing, provenance, duplicate, sensitivity, and quality gates pass.
4. **Rejected for durable registry storage:** Google Places API is not selected for the statewide destination registry because service-specific terms constrain storage/caching and non-Google-map usage in ways that do not match Gridly's offline governed registry needs.

## Launch-readiness classification

| Source | Classification | Justification |
| --- | --- | --- |
| Overture Maps Places | Approved | Open statewide/global places source with documented monthly release practice, permissive licensing, source attribution, and broad consumer POI categories. |
| Texas Open Data / TNRIS / TxDOT / TWDB | Approved | Authoritative public-sector supplements for government, transportation, water, recreation, and infrastructure layers; each layer still needs metadata capture before ingest. |
| Foursquare OS Places | Conditionally Approved | Broad open POI enrichment source, but Gridly must preserve NOTICE/attribution, map categories, and de-duplicate before exposure. |
| OpenStreetMap POIs | Conditionally Approved | Useful community corroboration and rural gap discovery source, but ODbL obligations require isolation or legal review before blended database use. |
| Federal provider/HIFLD successor layers and EPA FRS | Conditionally Approved | Useful for public safety and critical infrastructure context, but HIFLD Open discontinuity, layer-specific rights, and sensitivity require manual review. |
| SafeGraph Places / Geometry | Conditionally Approved | Potential commercial fallback for completeness, closures, and building precision only if contract rights explicitly allow storage, search, routing, offline use, and notifications. |
| Google Places API | Rejected | Not suitable as a durable statewide registry source because Places terms limit stored coordinates and restrict use with non-Google maps. |

## Governance gates before any future ingest

- Record source URL, license URL, release identifier, retrieval time, checksum, and category mapping.
- Confirm commercial use, storage, search indexing, offline use, refresh, redistribution/display, and attribution rights.
- Preserve provenance per record and per field.
- Enforce Texas county containment against the authoritative 254-county geometry baseline.
- Run duplicate, alias, brand consistency, closure/suppression, and coordinate sanity checks.
- Require manual review for public-safety and critical-infrastructure records before notification context.
- Keep ODbL, commercial, and sensitive government layers isolated unless a future legal/architecture milestone approves blending.

## Result

LP159 selects a legally governed, evidence-based destination source strategy for comprehensive Texas destination search and context planning. It remains planning-only; no runtime, deployment, activation, protected infrastructure, or LP158 registry replacement is authorized.
