# Gridly statewide capability audit — 2026-08-16

## Executive summary and architecture

The repository has **254 operational county identities** and **1,859 canonical Census PLACEs**, but those identity/presentation layers outran transportation, containment and reporting activation. Complete PLACE identity does not imply complete county bounds, governed roads, crossings, report persistence or ZIP governance.

The decisive defect is a split geometry architecture: the governed statewide package contains 254 valid county geometries, while the runtime bounds prefilter contains only 28. Coordinate containment begins with that prefilter, so 226 counties—including McLennan—never become polygon candidates. This makes hazard placement fail before Supabase even though Waco identity/camera are correct.

## Baseline

- Branch at audit start: `work`; HEAD: `b5405d796b1fa3eb4dad0787f718c33133570126`.
- Pre-existing untracked build/dependency directories: `android/.gradle/`, `android/build/`, `node_modules/`.
- LP201.3 verify passed: 1,555 promoted cameras; LP201.3 tests 30/30; LP196 tests 13/13.
- Current registry: 254/254 operational, production-enabled and selectable counties.
- PLACE inventory: 1,859; cameras: 1,555 LP201.2 promotions, 4 LP197 retained, 300 governed unresolved/ineligible fallbacks.
- Crossing production manifest: 28 packages, 3,771 records, 28 PASS, zero blocked.
- Runtime package registry declares 254 Community and 28 Crossing packages. Road runtime manifest has 28 entries.

## Exact statewide capability results

### County geometry and containment

- Source: LP137 governed `assets/boundaries/texas-counties-boundaries.geojson`, SHA-256 `09b9bc52c53f983451bb55899a03109f4002a3bcb1b47e0fe69cc38ed804332c`.
- Runtime package: 254 records, SHA-256 `6c6eeb549bb5e03d79efbc4d421783c06988c81c0f728c79add32f8c219e3d49`.
- FIPS coverage 254; missing 0; structurally invalid 0; bounds derivable 254.
- Runtime bounds/fitBounds/containment candidates 28; missing from runtime bounds 226.

Thus the answer to “do we own accurate outlines for all counties?” is **yes, 254/254 in the governed package**. The answer to “can current runtime use every county for coordinate containment/fitBounds?” is **no, 28/254**.

### Roads

OpenStreetMap/basemap tiles visually show roads statewide but are not governed Gridly roadway data. The governed roadway runtime manifest covers 28 counties: 3 local, 24 external static, 1 Harris partition runtime; 226 have no claimed governed runtime. The repository cannot determine how many missing TIGER county road files exist in the owner-local source root because that root is not mounted.

### Railroad crossings

- Statewide governed FRA artifact: 16,101 records, 200 counties with positive records, 54 counties with authoritative zero records.
- Certified production: 28 counties / 3,771 records.
- Runtime configured: 28. Positive consumer-visible county inventory: 27; Tyler is configured/active but empty with zero certified records.
- Outside production: 226. All 226 can receive a deterministic candidate or explicit zero-applicability result today from the repository artifact using LP115; 0 require source acquisition for candidate manufacture. Production promotion/runtime activation still requires governance.
- Classification: 27 `SUPPORTED` positive, 1 `SUPPORTED_ACTIVE_EMPTY` (Tyler), 172 positive `SOURCE_ONLY`, 54 `SOURCE_ONLY_ZERO/NOT_APPLICABLE`, 0 `MISSING_SOURCE`.

### Hazard placement, reporting and Supabase

- Placement available through the current county resolver: 28 counties.
- Placement blocked: 226 counties, all by the missing runtime-bounds configuration.
- Client persistence code is generalized to county metadata, but live Supabase schema/RLS/deployment state is not provable from repository evidence. Consequently end-to-end persistence is live-certified for 0 counties by this audit; 28 can reach the client insert path and 226 cannot.
- Waco fails at `if (!countyScopedReportMetadata)` in `createSharedHazardReport()` after the bounds-only candidate resolver returns no county. This is a stale pre-statewide implementation defect, not a crossing requirement or an intentional reporting policy.
- McLennan/Waco cannot currently submit, persist, retrieve, render or enter Community Pulse through the normal flow because submission stops before insert. After the bounds repair, backend persistence/retrieval remains a separate protected-environment validation requirement.

### PLACE, search, camera and ZIP

- Canonical identity/search/memberships: 1,859/1,859; memberships 2,058; multi-county PLACEs 163 and remain multi-membership.
- Camera authority: 1,555 promoted, 4 retained LP197, 300 governed fallback; all 1,859 have a presentation coordinate, but fallback quality remains explicitly non-promoted.
- Hazard placement across every membership: 283 PLACEs; blocked across every membership: 1,575; partial across memberships: 1.
- ZIP v2 is explicitly partial and not merge-ready. A conservative exact-label join finds only 30 canonical PLACE names with an automatically resolved governed ZIP row. This is evidence of coverage, not a claim that all ZIPs for those PLACEs are complete; GEOID-keyed statewide ZIP-to-PLACE authority is unavailable.

## Governed support definitions

- **IDENTITY_SUPPORTED:** county identity + canonical PLACE identity + all memberships + search + governed camera.
- **AWARENESS_SUPPORTED:** identity plus runtime bounds, polygon containment, hazard placement, live-certified persistence/retrieval, hazard visibility and awareness filters.
- **CROSSING_SUPPORTED:** governed positive source or explicit zero applicability plus certification, runtime activation and correct consumer visibility.
- **FULLY_SUPPORTED:** identity + awareness + crossing + governed road runtime where required + ZIP applicability decision + map presentation + remote backend certification.

Counts under that strict definition: 254 identity-supported; 28 locally awareness-reachable but remote-unverified; 28 crossing-runtime-supported (27 positive and one active-empty); **0 fully supported**; 254 partial.

## Statewide gap table

| Capability | Available | Partial | Missing/blocked | Primary blocker | Same-day path |
|---|---:|---:|---:|---|---|
| County geometry | 254 | 0 | 0 | — | Already complete |
| Runtime bounds/containment | 28 | 0 | 226 | Stale 28-entry registry | Derive from governed 254 package |
| PLACE identity/search | 1,859 | 0 | 0 | — | Already complete |
| PLACE cameras | 1,559 promoted/retained | 300 fallback | 0 | Missing eligible named-place evidence | No camera work authorized |
| Governed roads | 28 | 0 | 226 | Owner TIGER source/runtime integration | Inventory owner root, LP118/LP116 |
| Crossing source | 200 positive | 54 zero | 0 | — | Existing FRA source |
| Crossing packages/runtime | 28 | 226 | 0 source-missing | Manufacturing/governance | LP115 candidates today |
| Hazard placement | 28 | 0 | 226 | Bounds prefilter | Wave 1/2 repository repair |
| Community reporting | 28 reach insert | 0 | 226 | Same guard | Then remote validate |
| Awareness | 28 local-reachable | 226 identity-only | 0 identity-missing | Bounds/crossings/remote proof | Waves 1–3/5 |
| ZIP | 30 exact-name PLACE joins | broader county evidence | statewide GEOID mapping absent | Governance | Owner mapping/policy |
| Remote persistence | 0 live-certified | 28 client-reachable | 226 placement-blocked | Protected backend evidence | Protected preview checks |

## What can and cannot complete today

Repository-completable today after authorization: derive/certify 254 runtime bounds; add zero-write all-county placement simulation; unblock generalized client placement; manufacture 226 crossing candidate/zero-applicability outcomes. Owner-local work today: inventory frozen TIGER roads and extract those present. Remote work: Supabase schema/RLS/insert/retrieval/cross-device verification. Product-policy decisions: ZIP applicability, whether zero-FRA counties count as crossing-supported, road data requirement for “full,” and crossing promotion authorization. Genuinely unavailable here: exact owner-local road-source count and current protected backend state.

## Decision

**STATEWIDE CAPABILITY INVENTORY COMPLETE — READY FOR OWNER RECOVERY EXECUTION**

## Audit check limitations discovered

The current deterministic geometry verifier failed on the current statewide package with `anderson-tx boundary source is missing a five-digit Texas FIPS identity`; the runtime membership audit failed because a legacy path argument is undefined. These are stale-tooling findings, not evidence of absent polygon data: direct package validation found 254 unique FIPS and zero structurally invalid geometries. Wave 1 must reconcile the verifier schema before any geometry rebuild or production change.
