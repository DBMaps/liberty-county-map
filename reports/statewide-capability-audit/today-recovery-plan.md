# Same-day recovery plan

Feature development remains paused. No production registry, geometry, camera, crossing activation or backend policy change is part of this audit commit.

## Priority order

P0: reporting falsely appears statewide while 226 counties fail placement. P1: bounds/containment/county framing mismatch. P2: crossing package/runtime gap. P3: governed road completeness and ZIP governance. Remote persistence verification is P0 immediately after the client guard is repaired.

## Wave 0 — certify baseline (SMALL)

- **Goal:** freeze branch/HEAD, current registries and audit matrices.
- **Files/scripts:** this report directory; LP201.3 and LP196 verification scripts.
- **Inputs/counts:** 254 counties, 1,859 PLACEs, 28 crossing packages, 28 road runtimes.
- **Fail closed:** JSON counts/schema and clean diff limited to audit outputs.
- **Tests:** required baseline commands plus JSON validation.
- **Can complete today:** yes; completed by this audit.

## Wave 1 — statewide bounds/containment projection (MEDIUM, repository-completable)

- **Goal:** deterministically derive 254 runtime bounds from the governed 254 polygon package and make every valid county a containment candidate/map framing target.
- **Files/scripts:** `assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json`, `tools/build-gridly-authoritative-county-geometry.js`, `js/app.js` bounds/loader ownership, new non-writing tests.
- **Inputs/counts:** exactly 254 unique Texas FIPS, zero invalid geometry, existing governed hashes.
- **Fail closed:** missing/duplicate FIPS, invalid coordinate, degenerate bbox, source hash drift, county-name mismatch, or ambiguous polygon match blocks generation.
- **Tests:** deterministic geometry verifier, membership audit, all-254 point-on-surface resolution, all-254 fitBounds validity.
- **Runtime surfaces:** report placement, passive location, county framing, containment.
- **Can complete today:** code and deterministic tests yes, after owner authorizes production runtime change; no GIS extraction needed.

## Wave 2 — statewide hazard placement unblock (MEDIUM, repository + remote validation)

- **Goal:** prove non-crossing hazards do not depend on crossing/road packages and can reach insert in all 254 counties.
- **Exact path:** `openHazardPanel()` → Tap Map/GPS → `createSharedHazardReport()` → county resolver → payload.
- **Inputs/counts:** one safe interior test point per county; 254 dry-run payloads; zero writes.
- **Fail closed:** unknown county, outside polygon, multi-county ambiguity, missing Supabase client, or unsupported payload field.
- **Tests:** deterministic non-writing submit simulation; Waco control `4876000`/`48309`.
- **Runtime surfaces:** report CTA, confirmation error, optimistic hazards.
- **Can complete today:** client repair/tests yes after authorization; live persistence requires remote environment.

## Wave 3 — community report/Supabase certification (MEDIUM, remote/backend required)

- **Goal:** validate insert, RLS, retrieval, active-county filtering, awareness and Community Pulse for Waco plus statewide representative controls.
- **Inputs:** protected preview Supabase, disposable owner-authorized fixtures, anon/authenticated identities.
- **Expected:** Waco non-crossing row keeps `mclennan-tx`, retrieves on another client, renders once, expires/clears correctly.
- **Fail closed:** no production writes without owner authorization; delete/expire fixtures; capture policy/schema identity.
- **Can complete today:** only if protected remote credentials/environment and test-write authorization are available.

## Wave 4 — crossing source inventory/candidates (MEDIUM, repository-completable)

- **Goal:** run LP115 for the 226 counties not in production.
- **Input:** existing 16,101-record FRA statewide artifact (200 positive counties, 54 zero statewide).
- **Expected:** 226 deterministic candidate outcomes; no uploads/activation.
- **Fail closed:** duplicate crossing identity, county leakage, source hash drift, malformed geometry.
- **Can complete today:** candidate evidence yes. No new source extraction is required.

## Wave 5 — crossing production/certification/runtime (LARGE, governance required)

- **Goal:** promote positive candidates and governed zero-applicability certifications; update production manifest/runtime in controlled waves.
- **Expected final topology:** up to 200 positive county packages plus 54 explicit zero-applicability counties; current snapshot, not an invented 254-positive claim.
- **Fail closed:** owner authorization, deterministic package identity, PUBLIC_ROADWAY policy, manifest parity, runtime smoke test, rollback.
- **Can complete today:** candidate manufacture and review automation; all production promotions only if owner authorizes the write scope and certification evidence passes. This audit does not authorize it.

## Wave 6 — road inventory/candidates (LARGE, owner-local source required)

- **Goal:** inventory frozen TIGER road files for 226 missing runtime counties; extract candidates with LP118/LP116.
- **Expected counts:** exact available/source-missing split is owner-machine dependent and must be measured, not assumed.
- **Fail closed:** source vintage/hash, GDAL identity, boundary containment, line geometry, county leakage.
- **Can complete today:** inventory and any candidates whose frozen sources exist. Runtime integration is separate governance. Basemap roads already support basic visual navigation and must not be mislabeled governed data.

## Wave 7 — statewide consumer certification (LARGE)

- **Goal:** certify identity, search, camera, ZIP applicability, framing, reports, persistence, awareness, crossings and Route Watch by capability—not a vague operational flag.
- **Expected:** 254 county rows and 1,859 PLACE rows reconcile to runtime telemetry; remote checks recorded separately.
- **Can complete today:** deterministic local suite after Waves 1–2; full certification cannot complete without remote checks and ZIP/road owner evidence.

## Highest-priority next action

Authorize a narrowly scoped Wave 1/2 repository milestone: replace the 28-entry runtime bounds bottleneck with a deterministic projection of the already-governed 254-county geometry and add a zero-write 254-county hazard-placement test. Do not tie this repair to crossing activation.
