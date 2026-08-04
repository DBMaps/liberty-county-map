# LP130 — Texas Address Expansion Wave 4 Preflight

## Decision

**Hold owner manufacturing until the LP129 deterministic-rerun evidence is committed.** The LP129 candidate baseline otherwise reconciles successfully at 34 counties, including Burleson (48051), Trinity (48455), and Victoria (48469), with packages, sidecars, runtime certificates, certification reports, and inactive candidate reporting. The committed LP129 reconciliation explicitly records that a distinct owner rerun artifact is still pending. LP130 does not turn that known gap into a claimed success.

This is Phase 1 only: audit, cohort selection, documentation, evidence, and focused tests. No package was manufactured, uploaded, activated, or promoted, and no runtime behavior changed.

## Selected Wave 4 cohort

The cohort is ordered by official five-digit FIPS. Each county is absent from the committed 34-county address manifest and directly adjoins at least one represented county, so every addition grows the existing footprint without creating an island.

| County | FIPS | Adjacency rationale |
| --- | --- | --- |
| Angelina County | 48005 | Adjoins represented Trinity, Polk, Tyler, and Jasper Counties, extending the contiguous East Texas footprint. |
| Bastrop County | 48021 | Adjoins represented Lee and Fayette Counties, extending the connected Central Texas edge. |
| Bee County | 48025 | Adjoins represented Victoria County, extending the southern side of the Victoria-area footprint. |
| Bell County | 48027 | Adjoins represented Milam County, extending the contiguous Milam-area footprint westward. |
| Caldwell County | 48055 | Adjoins represented Fayette County, extending the connected Central Texas footprint. |

County names and FIPS identities are taken from the already-maintained Texas county registry. Selection did not repeat statewide address-source discovery and introduces no new address source.

## Baseline audit

Startup was verified on `LP130-—-Texas-Address-Expansion-Wave-4` at baseline `abb3f8555b9dfcbcf633fbf75f7c2b07eeb094fe`.

The focused LP129 validation confirms the following committed surfaces:

- the aggregate address manifest has exactly 34 unique county FIPS and 34 unique package filenames;
- Burleson, Trinity, and Victoria each have a gzip package and sidecar;
- all three gzip streams decompress, every non-empty JSONL line parses, and every record retains the governed county and FIPS identity;
- byte counts, record counts, SHA-256 values, sidecars, runtime certificates, certification reports, the manufacturing report, and the inactive candidate manifest reconcile;
- the production runtime manifest remains unchanged and the candidates remain inactive;
- the deterministic comparator exists and ignores timestamp/path-only metadata, but the committed LP129 evidence says `ownerRerunEvidencePresent: false`.

That last item is a pre-existing governance blocker. It is not a package-integrity failure, and it does not justify manufacturing LP129 again. The owner should run the existing comparator against the retained first run and a distinct rerun and commit its successful output before starting LP130.

## Exact owner PowerShell manufacturing command

After the LP129 rerun-evidence gate is closed, run only this five-county cohort from the application repository:

```powershell
Set-Location C:\GitHub\liberty-county-map

node tools/lp1051/manufacture-gridly-28-address-counties.mjs `
  --fips 48005,48021,48025,48027,48055 `
  --gdb "C:\GitHub\Gridly-Source-Data\Texas-Address-Points\Raw\Texas-2026.gdb" `
  --reports "reports/lp130-wave-4"
```

Run the cohort twice without overwriting the first run's governed evidence. Retain comparisons of package filename, bytes, JSONL contents, SHA-256, counts, manifests, sidecars, runtime certificates, and certification reports. Differences limited to `generatedAt`, report/certificate timestamps, or local paths are not deterministic failures.

## Owner output contract

The owner commit must contain exactly five address packages and sidecars, five runtime certificates, five LP104.6 certification reports, the selected-cohort manufacturing report, candidate manifest updates, aggregate address-manifest updates, and distinct deterministic-rerun evidence. It must not contain the source geodatabase, temporary extraction files, Storage or Supabase changes, production-runtime changes, or activation.

## Merge recommendation and next steps

This Phase 1 preflight may merge because it changes documentation, evidence, tests, and no runtime surface. **Do not begin Phase 2 manufacturing yet.** First commit successful LP129 deterministic comparison output using the already-provided comparator; do not remanufacture or replace the committed LP129 candidates. Then execute the exact LP130 command twice, commit only the governed candidate outputs, and return them for the Phase 3 Codex audit. Production promotion remains a separate, explicitly authorized milestone.
