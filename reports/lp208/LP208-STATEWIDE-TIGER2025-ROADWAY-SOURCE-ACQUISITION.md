# LP208 — Statewide TIGER2025 Roadway Source Acquisition

## Decision

**BLOCKED_FOR_STATEWIDE_ROADWAY**

The frozen cohort contains 226 counties. 3 sources are certified at the recorded start and 223 require owner acquisition. This repository environment does not mount `C:\GitHub\Gridly-Source-Data\Census\TIGER2025\ROADS`; this is not evidence that owner files are globally missing. Run the owner command below, then commit its generated identity reports.

## Owner command

`powershell -NoProfile -ExecutionPolicy Bypass -File tools/lp208/Acquire-LP208StatewideTigerRoadways.ps1 -Mode Acquire`

The runner is sequential, validates or skips existing sources without overwrite, retries failed downloads at most three times with bounded backoff, and resumes county by county. It performs no manufacturing, upload, activation, or runtime mutation.

## Current accounting

- Existing valid at start: 3
- Acquisition required: 223
- Final valid in this evidence: 3
- Production roadway counties: 28 → 28
- Runtime manifest SHA-256: `56549d67569f2c74cd202a1e93a30f79591b119ef1fdf58c8d138ffdefaad7bd`
- Supabase writes / activations / packages manufactured: 0 / 0 / 0
