# LP209 — Statewide Roadway Missing-Cohort Manufacturing and Certification

## Decision

**BLOCKED_FOR_STATEWIDE_ROADWAY**

The owner reports that the statewide manufacturing wave completed: 226 LP118 checkpoints are `GENERATED`, and all 226 LP116 checkpoints certify `PASS`, including the repaired Anderson retry. This container does not mount those owner files, so their per-county identities have not yet been ingested. Determinism and downstream compatibility remain genuinely unexecuted here; publication is not authorized.

## Architecture

LP209 binds each frozen LP206 missing-county identity to its certified LP208 U.S. Census Bureau TIGER/Line 2025 All Roads ZIP identity. The owner runner verifies that ZIP byte count and SHA-256, passes the source through the existing LP118 extraction and county-ownership implementation with `assets/boundaries/texas-counties-boundaries.geojson`, then passes the inactive extracted candidate through the existing LP116 deterministic partition and certification implementation. Outputs and checkpoints remain under `owner-local/lp209-roadway-manufacturing`.

The PowerShell wrapper defaults to `WhatIf`. `Build` proceeds sequentially county by county; `Resume` asks LP118 and LP116 to preserve identity-valid checkpoints; `Verify` is read-only. Every mode fails closed on governed cohort, source, boundary, protected-runtime, or GDAL identity disagreement.

## Current accounting

| Measure | Result |
|---|---:|
| Texas county identities | 254 |
| Protected runtime roadway counties | 28 |
| Frozen manufacturing plan | 226 |
| LP208 identities bound | 226 |
| Source identity mismatches | 0 |
| Missing governed source identities | 0 |
| Protected overlap | 0 |
| LP118 successful owner results (authoritative owner result) | 226 |
| LP116 PASS owner results (authoritative owner result) | 226 |
| Pending manufacturing | 0 |
| Failures | 0 |
| Supabase writes | 0 |
| Runtime activations | 0 |
| Production package modifications | 0 |

Runtime manifest SHA-256 before/after is `56549d67569f2c74cd202a1e93a30f79591b119ef1fdf58c8d138ffdefaad7bd`; county count remains 28 → 28.

The owner reports 463 candidate GeoJSON files totaling 3,661,035,248 bytes. Per-county checkpoint identities, deterministic reruns, and downstream candidate compatibility remain pending ingestion/execution rather than being fabricated.

## Owner execution

```powershell
# Read-only preflight; the default mode is also WhatIf.
powershell -NoProfile -ExecutionPolicy Bypass -File tools/lp209/Build-LP209StatewideRoadwayCandidates.ps1 -Mode WhatIf

# Explicit, candidate-only owner execution.
powershell -NoProfile -ExecutionPolicy Bypass -File tools/lp209/Build-LP209StatewideRoadwayCandidates.ps1 -Mode Build

# Resume incomplete counties without restarting valid completed work.
powershell -NoProfile -ExecutionPolicy Bypass -File tools/lp209/Build-LP209StatewideRoadwayCandidates.ps1 -Mode Resume
```

The owner must commit the resulting compact evidence only after all 226 candidates, representative deterministic reruns, and downstream compatibility controls pass. Source ZIPs, extracted shapefile members, and candidate package binaries remain uncommitted.

### Final certification only (next command)

This command reads the completed workspace, reruns only the 11 governed controls into a separate workspace, executes isolated compatibility checks for Dallas, Bexar, El Paso, Grayson, and Lee, and writes the four compact reports. It never publishes or activates candidates.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/lp209/Verify-LP209StatewideRoadwayCandidates.ps1
```

## Safety boundary

LP209 does not edit `data/roadway-runtime-manifest.json`, existing roadway packages, Harris partitions, consumer behavior, or remote storage. Candidate manufacture is not runtime activation and does not authorize the subsequent publication milestone.
