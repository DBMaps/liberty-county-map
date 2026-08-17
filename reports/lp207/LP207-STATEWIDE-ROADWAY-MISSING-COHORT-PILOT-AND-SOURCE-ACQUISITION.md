# LP207 — Statewide Roadway Missing-Cohort Pilot and Source Acquisition

## Decision

**BLOCKED_FOR_STATEWIDE_ROADWAY**

The governed acquisition mechanism is implemented and fail-closed. The pilot is not certified: this execution environment does not contain the three owner-controlled TIGER ZIPs and does not provide GDAL. LP207 therefore does not claim pilot success or statewide readiness.

## Governed source contract

New missing-cohort roadways use **U.S. Census Bureau, TIGER/Line 2025 All Roads** at `https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_<FIPS>_roads.zip`. Exact ZIP bytes receive a Gridly-observed SHA-256. Existing 28 roadway counties remain grandfathered without migration or rebuild. This is an intentional source-generation boundary, not a fallback or a claim that TIGER and OSM classifications are equivalent.

Road names preserve `FULLNAME` as supplied. Empty names remain unnamed; no names, aliases, or casing transformations are fabricated. `MTFCC` and `RTTYP` remain TIGER-native classifications.

## Safety conservation

- Production roadway counties before: 28
- Production roadway counties after: 28
- Supabase roadway writes: 0
- Runtime activations: 0
- Existing governed roadway packages modified: 0
- Pilot counties activated: 0
- Pilot packages published: 0

## Pilot

Lee (48287), Milam (48331), and Robertson (48395) are confirmed members of the frozen LP206 cohort. Their source and manufacturing results are explicitly `NOT_RUN/BLOCKED`, not synthetic passes. Supply the three ZIPs through `GRIDLY_TIGER2025_ROADS_ROOT` and install GDAL before rerunning the pilot.

## Statewide plan

The plan contains 226 deterministic, non-executed entries: 0 locally valid and 226 requiring acquisition in this environment. Dallas (48113) is the recommended later scale control. No all-226 apply mode exists in LP207.
