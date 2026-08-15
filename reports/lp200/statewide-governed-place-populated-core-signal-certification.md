# LP200 — Statewide governed PLACE populated-core signal certification

## Final classification

**NOT_READY_OWNER_GOVERNED_INPUT_REQUIRED**

No populated-core candidate was emitted or activated. The checkout contains 59 identity-valid address packages and is missing 195 of the 254 manifest-governed packages. Raw PLACE polygons required for deterministic intersection and containment are also absent.

## Governed evidence and coverage

The governed manifest declares 12,142,647 records for all 254 counties, but package presence alone is not treated as PLACE coverage. All **1,859 PLACEs / 2,058 memberships** are classified `ADDRESS_SIGNAL_UNAVAILABLE` until the complete hashed inputs and polygons coexist. Complete 0 (0%); partial 0; sparse 0; zero 0; unavailable 1,859 (100%). The JSON report contains a row for every PLACE and exact provenance paths.

The source license manifest permits storage while redistribution/derivative governance remains unresolved; therefore certification also fails closed on authorization. Road density is not governed statewide. ZIP/community and crossing evidence are support-only and are not substituted for populated core.

## Algorithms, grids, and resilience

The required projected methods (mean, robust median, fixed grid, adaptive grid, occupied-cell centroid, connected cluster) and 250/500/1,000/2,000 m resolutions are specified but **not evaluated** after the input gate failed. EPSG:3083 is required. Multi-county evidence must aggregate once by PLACE GEOID. Outlier resilience and containment cannot be certified without all packages and raw polygons.

## Calibration and controls

The four exact LP197 cameras remain calibration truth. LP199 baseline is mean 4,855.401 m, total 19,421.605 m, maximum 10,562.890 m. There are no candidate metrics. Dallas, Fort Worth, Austin, El Paso, Amarillo; the five known-bad controls; and the small-place cohort are retained in the JSON owner matrix with null candidates. Numerical or visual success is not claimed.

## Corpus Christi

The LP196 visible-picker parity finding remains explicit and separate. No search repair is included.

## Safe fallback and runtime

Documented future hierarchy: OWNER_APPROVED_OVERRIDE -> CERTIFIED_POPULATED_CORE (none) -> EXISTING_CANONICAL_PLACE_CAMERA; documentation only, runtime unchanged. No runtime surface is changed.

## Exact owner rerun (PowerShell)

```powershell
Set-Location C:\GitHub\liberty-county-map
git restore --source de3ce54ade60583e4c61e0378b8175d7a91e44c6 -- data/generated/lp104/txgio-addresses reports/lp130-statewide-addresses evidence/lp130
npm run build:lp200
npm run verify:lp200
npm run test:lp200
```

The build validates package byte counts and SHA-256 identities against `data/generated/lp104/txgio-addresses/manifest.json`; arbitrary path-only inputs are rejected.
