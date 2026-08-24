# LP231 Canonical PLACE Geometry Authority Recovery Audit

## Decision

**E. `INSUFFICIENT_EVIDENCE`.** Gridly contains the certified 1,859 PLACE identities and 2,058 governed memberships, but not the polygon artifact from which those records were manufactured. The intended Census TIGER/Line 2025 Texas PLACE archive is `Gridly-Source-Data/Census/TIGER2025/PLACE/original/tl_2025_48_place.zip`; committed provenance records that its bytes, size, hash, feature count, classification validation, and geometry validation were not preserved. LP231 downloaded nothing.

The deterministic certification is `reports/lp231/canonical-place-geometry-authority-certification.json`. It inventories the absent source reference, certified identity-only CSV, and unrelated OSM point audit. It reports 0/1,859 polygon matches because there are zero candidate polygon features—not because canonical identities are absent. Validity, multipolygon, holes, bytes, parse, memory, and point-in-polygon measurements remain `null`, never invented.

## Provenance, runtime gap, and controls

The intended authority is United States Census Bureau TIGER/Line 2025, Texas PLACE, expected NAD83/EPSG:4269, with stable `GEOID`. The existing governed builder projects PLACE and county layers to EPSG:3083, uses positive-area polygon intersection, promotes polygons to multi, and does not simplify. This was a build-only owner/source-workspace pipeline. Its original archive and derived polygon layer are neither tracked nor present. Runtime therefore has `NOT_COMMITTED`, `IGNORED_OWNER_LOCAL_OR_EXTERNAL_WORKSPACE`, `BUILD_ONLY`, `NO_BROWSER_LOADER`, and `NO_CANONICAL_GEOMETRY_INDEX` gaps.

Katy resolves once to `place-4838476` and retains Fort Bend, Harris, and Waller memberships. Corpus Christi, Austin, Abilene, and Midland each resolve as one canonical identity; Sulphur Springs, Liberty, Fredericksburg, and Pecos resolve as single-county controls. None can pass polygon/intersection controls without geometry. LP231 does not treat Katy's counties as its polygon and cannot spatially test the 175/1,159/46 inventories.

## Packaging assessment

| Option | Impact and risk |
|---|---|
| Statewide raw geometry | Unknown until recovery; largest parse/memory/startup cost, revisioned PWA caching, and launch risk. |
| Per-community geometry | Bounded fetch, but 1,859 cache objects and substantial offline complexity. |
| Per-county fragments | Bounded payload, but fragment reconstruction and multi-county duplication risk. |
| Offline crossing stable ID → PLACE GEOID | **Recommended for LP230 after certification:** likely smallest, no browser geometry parsing, canonical deduplication. |
| Bounds/index plus exact polygons | Useful only for a later general attribution requirement; still ships polygons. |

Raw performance cannot be measured without bytes. A derived membership supports near-constant-time lookup, no startup index build, static caching, and deterministic invalidation keyed by geometry and crossing hashes. Exact size and offline build cost must be measured after recovery. DriveTexas, weather, and local hazards retain existing authorities.

## Recovery and proposed LP232

LP230 **must not resume**. Owner review should locate the exact archive and immutable derived manifests. LP232 may: verify source hash/vintage/public contents; rerun the existing projected-area pipeline without silent repair; reconcile every geometry by GEOID to 1,859 identities and all 163 multi-county identities; validate geometry, holes, multipolygons, and controls; derive crossing stable-ID membership offline with unmatched/boundary diagnostics; and revision/cache only that compact artifact. Shipping polygons and production eligibility changes remain out of scope.

No production crossing, DriveTexas, weather, local-hazard, Alerts, KBYG, active-county, membership, map, or governance behavior changed. No blind county union, radius substitution, timer, polling, or unrelated change was introduced. Do not merge until owner review.
