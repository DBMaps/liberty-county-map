# Gridly San Jacinto Reset Report and Safe Revert Plan — V657

## Executive decision

Stop the current San Jacinto patch chain and do not continue V655/V656. The safest path is to preserve this report, reset the working branch to the last stable main baseline, and restart San Jacinto from a clean app-loadable baseline.

This report is documentation-only. It does not change geometry, boundaries, county flags, DriveTexas, Transportation Intelligence, runtime behavior, Supabase behavior, or feature code.

## 1. Last stable main baseline

### Identified baseline

The last known stable main update before the unstable visible-authority/freeze churn is:

- **Commit:** `04ad80b`
- **Subject:** `Replace San Jacinto boundary with authoritative geometry`
- **Scope:** San Jacinto boundary asset replacement only.
- **Stat:** one changed file: `assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson`.

### Why this is the recommended reset anchor

The unstable chain began after the authoritative boundary replacement and then moved into visible wording / authority patches, bootstrap helper exposure, submit-delay work, render/startup timer instrumentation, route-dock instrumentation, and load-isolation work. The boundary replacement itself is narrow and matches a proven San Jacinto artifact milestone, while the later chain caused local Gridly to become unreliable enough that DevTools could not consistently open.

If maintainers decide that PR merge commits are required as reset anchors, use the merge commit immediately before the V655/V656 patch chain that contains `04ad80b`; otherwise use `04ad80b` directly as the clean content baseline.

## 2. San Jacinto work that DID work

### Runtime onboarding

San Jacinto runtime onboarding existed and validated as a foundation-only county. The V639 manifest registered `san-jacinto-tx` as `registered-non-operational`, with awareness areas candidate/inventory-only and boundary foundation registered. The V640 validation confirmed `runtimeOnboarded: true` and `validationStatus: PASS`.

Evidence files:

- `assets/county-implementation/san-jacinto/manifests/san-jacinto-runtime-onboarding-v639.json`
- `assets/county-implementation/san-jacinto/validation/san-jacinto-runtime-validation-v640.json`

### Validation-only county status

San Jacinto remained validation-only. V650R.10 and V650R.11 both recorded `validationOnly: true`.

Evidence files:

- `assets/county-implementation/san-jacinto/validation/san-jacinto-road-geometry-runtime-wiring-v650r10.json`
- `assets/county-implementation/san-jacinto/validation/san-jacinto-browser-validation-rerun-v650r11.json`

### Production disabled / activation blocked

Multiple validation artifacts agree that San Jacinto was not production-enabled and that activation remained blocked:

- `productionEnabled: false`
- `productionActivationBlocked: true`
- `productionActivationApproved: false`
- `operational: false`
- `selectable: false`

Evidence files:

- `assets/county-implementation/san-jacinto/registry/san-jacinto-county-runtime-registry-v639.json`
- `assets/county-implementation/san-jacinto/validation/san-jacinto-runtime-validation-v640.json`
- `assets/county-implementation/san-jacinto/validation/san-jacinto-road-geometry-runtime-wiring-v650r10.json`

### Authoritative boundary replacement

The authoritative boundary replacement did work at the asset level. The V653 follow-up artifact records extraction from `tl_2025_us_county`, filtered to `STATEFP=48`, `COUNTYFP=407`, `GEOID=48407`, `NAMELSAD=San Jacinto County`, with `geometryChanged: true` and `validationStatus: PASS`.

Evidence file:

- `assets/county-implementation/san-jacinto/validation/san-jacinto-authoritative-boundary-extraction-v653.json`

### Boundary coordinate count / bbox

The authoritative boundary replacement recorded:

- `geometryType: Polygon`
- `coordinateCount: 431`
- `boundingBox: [-95.359156, 30.31945, -94.829719, 30.906719]`

Evidence file:

- `assets/county-implementation/san-jacinto/validation/san-jacinto-authoritative-boundary-extraction-v653.json`

### Road segment asset generation

The normalized San Jacinto road segment GeoJSON exists at:

- `assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson`

A local feature-count check on that asset returned **3906** features.

### Road asset runtime registration

V650R.10 changed San Jacinto roads from inventory-only shapefile reference to validation-only runtime availability:

- old roads: `inventory-only`
- new roads: `available`
- road segment path: `assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson`
- runtime availability: boundary, roads, and crossings available; awareness areas validation-only.

Evidence file:

- `assets/county-implementation/san-jacinto/validation/san-jacinto-road-geometry-runtime-wiring-v650r10.json`

### Road feature count 3906

The generated road-segment asset contains **3906** features. This matches the source TIGER metadata record and local GeoJSON feature counting.

Evidence files:

- `assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson`
- `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shp.iso.xml`

### Road candidate lookup success at validated coordinate `30.5848, -95.1296`

A local static lookup against `san-jacinto-county-road-segments.geojson` at `30.5848, -95.1296` found nearby road candidates. This proves the road asset has spatially relevant candidates near the validated Coldspring/San Jacinto coordinate when queried directly.

Candidate names present near the coordinate included the requested names:

- Key Ln
- Bar Park Loop
- Ave B
- Magnolia St
- Lazy Ln
- Church St
- State Hwy 150
- State Hwy 156
- FM 1514

### Marker / awareness / alert visibility when active incident existed

The V648 hardening artifact established the intended San Jacinto visibility pipeline and audit fields for `markerVisible`, `alertVisible`, and `awarenessVisible`. Later browser/audit observations indicated that active San Jacinto incident visibility could appear in visible surfaces when an active incident existed, but the wording and location-authority source were not correct or stable enough to treat V655/V656 as safe.

Evidence file:

- `assets/county-implementation/san-jacinto/validation/san-jacinto-boundary-ownership-hardening-v648.json`

## 3. San Jacinto work that DID NOT work

### Visible wording still fell back to Coldspring

San Jacinto visible wording remained able to fall back to the community label `Coldspring` instead of a resolved road name. V650R.12 explicitly observed a browser-visible model with `observedTitle: Crash / Wreck on Coldspring` and described how explicit community fields could win before road resolver output.

Evidence file:

- `assets/county-implementation/san-jacinto/validation/san-jacinto-road-resolution-validation-v650r12.json`

### `authoritativeDisplayLocationSource = incident.communityFallback`

Recent runtime audit observations captured the visible-display authority source as `incident.communityFallback`. This means the unified visible-location authority patches did not reliably promote the San Jacinto road candidate result into the final user-facing location label.

### `roadCandidateCount = 0` despite `coordinateStatus = available` and `roadAssetStatus = available`

Recent audit observations also showed `roadCandidateCount = 0` while both coordinates and the road asset were available. This contradicted the static asset lookup, which found nearby candidates at the validated coordinate. Treat this as a runtime wiring/state/order bug, not as evidence that the road asset is empty.

### Location Awareness card still rendered quiet / no recent reports while `visibleLocationCardActiveCount = 1`

Recent browser/audit observations showed the Location Awareness card still rendering quiet/no-recent-report text even though `visibleLocationCardActiveCount = 1`. This means the visible card state and user-facing text were not reconciled.

### Report submit delay / Supabase `county_id` schema mismatch observation

The V656 submit-delay patch was aimed at report-submit delay behavior, but this should not be carried forward directly. The observed Supabase `county_id` schema mismatch / insert behavior needs a clean-baseline diagnosis before another patch is applied.

### Possible stale `reportSubmitCounty` Liberty ownership observation

Recent observations suggested stale or unexpected Liberty ownership in `reportSubmitCounty`. This could indicate active-county fallback, stale local state, or report submission ownership not being recomputed from the intended San Jacinto validation context. It was not proven safe.

### Route panel not opening was not fully diagnosed

Route panel non-opening was observed during the unstable chain. Route dock click instrumentation was added for debugging, but the cause was not fully diagnosed and should not be carried forward unless it is needed on the clean baseline.

### Local main-thread freeze made browser validation unreliable

The local app became frozen enough that DevTools console could not reliably open. That invalidates browser validation confidence for the late V655/V656/freeze-debug chain. Any browser result collected after the freeze started should be treated as suspect until the app loads normally from a stable baseline.

## 4. Recent unstable changes to avoid carrying forward

Do not carry forward these late-chain changes automatically:

- V655 unified authority patches:
  - `c8cc3f2` — `Unify incident display location authority`
  - `ee2314b` — `Fix V655 authoritative resolver bootstrap crash`
  - `36fed02` — `Fix San Jacinto visible authority audit`
  - `703b6ca` — `Force San Jacinto road candidate authority`
- V656 submit-delay patch if not already part of the chosen clean baseline:
  - `c039f27` — `Fix San Jacinto report submit delay`
- Startup/render timer instrumentation:
  - `894a069` — `Fix startup render timer freeze`
  - `c436856` — `Fix timer audit debug guard`
- Route dock click instrumentation, if present only for debugging.
- Load-isolation instrumentation if only needed for debugging:
  - `f085b95` — `Add Gridly load isolation check`
- Bootstrap helper exposure changes that were not merged into the last stable baseline:
  - `b9ace0b` — `Fix app bootstrap audit helper exposure`
  - `53e31d6` — `Fix gridly UI smoke test bootstrap`
- Load-stability restoration patches from the unstable debug chain unless maintainers explicitly identify one as the stable baseline:
  - `19baef7` — `Restore stable Gridly startup load`

## 5. Recommended restart strategy

1. Preserve this report artifact.
2. Create a reset branch from the current branch if needed.
3. Reset the working branch to the last stable main baseline (`04ad80b`, unless maintainers choose the equivalent pre-V655 merge commit).
4. Do not delete San Jacinto source assets unless explicitly instructed.
5. Reapply only proven San Jacinto assets / registry / boundary / road runtime work if they are not already present on the selected stable main baseline.
6. Do not reapply V655 wording patches directly.
7. First validate that the local app loads without main-thread freeze.
8. Validate Liberty behavior.
9. Validate Montgomery behavior.
10. Validate San Jacinto runtime onboarding, validation-only status, boundary registration, road asset registration, and candidate lookup.
11. Only then fix visible wording with one small patch against the stable baseline.

## Task B — safest rollback steps

These commands are the recommended exact sequence. Replace `<reset-branch>` only if your branch naming convention requires a different name.

```bash
# 1. Confirm current branch and preserve context.
git status --short --branch
git branch --show-current
git log --oneline --decorate -25

# 2. Preserve this report artifact outside the repo before destructive reset.
cp GRIDLY-SAN-JACINTO-RESET-REPORT-AND-SAFE-REVERT-PLAN-V657.md /tmp/GRIDLY-SAN-JACINTO-RESET-REPORT-AND-SAFE-REVERT-PLAN-V657.md

# 3. Create a safety branch at the current unstable state.
git switch -c san-jacinto-reset-safety-$(date +%Y%m%d-%H%M%S)

# 4. Return to the branch that should be reset.
git switch work

# 5. Reset to the recommended stable baseline.
git reset --hard 04ad80b

# 6. Restore the report artifact after reset.
cp /tmp/GRIDLY-SAN-JACINTO-RESET-REPORT-AND-SAFE-REVERT-PLAN-V657.md GRIDLY-SAN-JACINTO-RESET-REPORT-AND-SAFE-REVERT-PLAN-V657.md

# 7. Confirm core app shell files are at stable-baseline content.
git diff --name-status 04ad80b -- index.html js/app.js service-worker.js

# 8. Validate syntax and patch hygiene.
node --check js/app.js
git diff --check

# 9. Review changed/untracked files before committing only the report.
git status --short
```

If maintainers require a revert commit instead of a hard reset, use a clean branch and revert the unstable range from after `04ad80b` through current HEAD, then restore this report and run the same checks. The hard reset is simpler and safer for stopping patch churn if no later commits must be preserved.

## Files to keep vs discard

### Keep / preserve

Keep these if they exist on the stable baseline or are intentionally reapplied after reset:

- `GRIDLY-SAN-JACINTO-RESET-REPORT-AND-SAFE-REVERT-PLAN-V657.md`
- `assets/county-implementation/san-jacinto/manifests/san-jacinto-runtime-onboarding-v639.json`
- `assets/county-implementation/san-jacinto/registry/san-jacinto-county-runtime-registry-v639.json`
- `assets/county-implementation/san-jacinto/validation/san-jacinto-runtime-validation-v640.json`
- `assets/county-implementation/san-jacinto/validation/san-jacinto-road-geometry-runtime-wiring-v650r10.json`
- `assets/county-implementation/san-jacinto/validation/san-jacinto-authoritative-boundary-extraction-v653.json`
- `assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson`
- `assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary-authoritative.geojson`
- `assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson`
- `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.*`
- `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-rail-crossings.geojson`
- `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-crossing-review-overrides.json`

### Discard / do not carry forward automatically

Discard or leave behind unless reintroduced by a small, separately validated patch:

- V655 unified authority code changes.
- V656 report-submit delay code changes.
- Startup/render timer debug instrumentation.
- Route dock click debug instrumentation.
- Load-isolation debug instrumentation.
- Bootstrap helper exposure changes not present in the stable baseline.
- Any local workaround that attempts to force San Jacinto visible wording without first proving app-load stability.

## Merge recommendation

Merge this documentation/report only. Do not merge additional San Jacinto feature fixes, V655/V656 continuations, geometry edits, boundary edits, county-flag changes, DriveTexas changes, Transportation Intelligence changes, or route/debug instrumentation as part of this reset report.
