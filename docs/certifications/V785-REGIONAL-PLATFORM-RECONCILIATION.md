# V785 — Regional Platform Reconciliation Audit

## Scope

V785 is an audit/documentation milestone only. It does not modify runtime behavior, production packages, community packages, manifests, JavaScript, HTML, CSS, enabled counties, file placement, or package contents. Repository contents are the source of truth.

## Pipeline Matrix

| County | Community | Crossing | Production | Certified | Application | Runtime | Search | Awareness | Consumer | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Liberty | Yes | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes | Operational |
| Montgomery | Yes | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes | Operational |
| San Jacinto | Yes | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes | Operational |
| Chambers | Yes | Yes | Yes | No | Yes | No | No | No | No | Installed but Not Enabled |
| Jefferson | Yes | Yes | No | No | Yes | No | No | No | No | Installed but Not Enabled |
| Hardin | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Polk | Yes | Yes | No | No | Yes | No | No | No | No | Installed but Not Enabled |
| Walker | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Harris | Yes | Yes | No | No | Yes | No | No | No | No | Installed but Not Enabled |
| Orange | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Jasper | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Newton | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Tyler | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Galveston | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Brazoria | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Fort Bend | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Waller | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Austin | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Washington | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Brazos | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Grimes | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Wharton | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Colorado | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Fayette | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Lavaca | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Jackson | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Matagorda | Yes | Yes | No | No | No | No | No | No | No | Manufactured |
| Calhoun | Yes | Yes | No | No | No | No | No | No | No | Manufactured |

## Pipeline Break Analysis

- Manufactured but not production-packaged: 24 counties — Jefferson, Hardin, Polk, Walker, Harris, Orange, Jasper, Newton, Tyler, Galveston, Brazoria, Fort Bend, Waller, Austin, Washington, Brazos, Grimes, Wharton, Colorado, Fayette, Lavaca, Jackson, Matagorda, Calhoun.
- Certified and present in the production crossing manifest but not runtime registered: Chambers.
- Application assets present but not runtime registered: Chambers, Harris, Jefferson, Polk.
- Runtime registered but not consumer accessible: none observed.

## Reconciliation Summary

- Total counties: 28
- Community packages: 28
- Crossing packages: 28
- Production packages: 4
- Certified packages: 0
- Production manifest entries: 4
- Application-installed packages/assets: 7
- Runtime-enabled counties: 3
- Consumer-enabled counties: 3
- Pipeline discrepancies: production crossing manifest contains 4 counties while runtime registration contains 3 counties; 24 crossing-manufactured counties have no production package; 4 counties have application implementation/runtime assets without runtime registration.

## Protected System Verification

The audit changed only this document and its evidence JSON. Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase Synchronization, Production Crossing Runtime, Community Package Pipeline, and Developer Toolkit remain unchanged.

## Evidence

See `docs/certifications/evidence/V785-regional-platform-reconciliation.json`.
