# Repair 007 owner-acceptance recovery checkpoint

**Certification status:** PASS  
**Owner-accepted:** 2026-08-20  
**Trusted recovery branch:** `recovery-integrated-gridly`  
**Repair 007 implementation commit:** `451ceabc5f5090d5b7969099c8396715294fb858`  
**Certification checkout before this checkpoint:** branch `work`, HEAD `563b6e4e16f7388cabd39403bc8c11b44152d055`

## Defect, cause, and repair

The original defect was excessive crossing presentation work during a Dallas-to-Baytown community transition: the browser recorded 12 render calls and 11 filter calls. The root cause was duplicate ownership of the community camera transition. The settings-selection path repeated county-context and semantic-camera work already owned by the canonical home-town save/application path.

Repair 007 removed the duplicate county/camera dispatch from settings community selection and retained the canonical save/application path as the single transition owner. Settings display synchronization remains independent. No additional optimization or camera-settlement guard is part of this acceptance.

## Owner-browser performance acceptance

| Dallas → Baytown | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Render calls | 12 | 4 | 66.7% |
| Filter calls | 11 | 4 | 63.6% |
| Semantic skips | 0 | 0 | — |

The observed result is accepted as approximately 67% fewer render passes and 64% fewer filter passes.

## Final Baytown state and count semantics

The certified final state is:

- selected community: `Baytown`
- canonical key: `place-4806128`
- active county: `harris-tx`
- governed Harris crossing inventory: **1,159**
- Baytown awareness-qualified crossings: **70**
- settled zoom: **13**
- current-viewport renderable crossings: **49**
- Leaflet crossing markers: **49**
- DOM crossing markers: **49**

The accepted contract is therefore:

> 1,159 governed → 70 Baytown awareness-qualified → 49 current-viewport renderable at the observed settled zoom-13 viewport → 49 Leaflet → 49 DOM.

The former assumption that all 70 awareness-qualified crossings must become 70 Leaflet and DOM markers is explicitly rejected. Exact viewport marker count is camera/bounds dependent. The invariant is parity between the final policy-visible set and Leaflet/DOM publication.

## Follow-up RCA: why 49 is policy-correct

At zoom 13, the production medium-zoom crossing policy is `allowMarkers: true`, `useViewport: true`, and `markerLimit: 80`. The 21 other Baytown awareness-qualified crossings fall outside the final Leaflet viewport. They were not lost through crossing classification, reportability, public-roadway qualification, FRA identity/deduplication, decluttering, the hard cap, stable-ID handling, marker reconciliation, stale render signatures, crossing-layer ownership, or DOM publication. The **49 / 49 / 49** policy-visible, Leaflet, and DOM parity proves there is no downstream presentation loss.

## Protected systems and geometry identity

Repair 007 does not change crossing visibility policy, the zoom-13 medium-zoom viewport contract, Harris inventory, Baytown awareness qualification, crossing source or qualification governance, camera-settlement behavior, or the recovery foundation.

The certified geometry remains `assets/location-resolution/gridly-authoritative-county-geometry-v1.json`, with exact identity:

- bytes: **47,911,048**
- SHA-256: **`891652f2e63459451ef10e0b723bcf90378dc22a275945978cd73aa8d8e40316`**

## Repository-controlled verification

The Repair 007 targeted verification passed on the certification checkout:

```text
node --test \
  tests/recovery-repair-006-crossing-performance.test.mjs \
  tests/county-runtime/v904r8HierarchicalAwarenessCanonicalFlow.test.js

6 tests passed; 0 failed
```

Geometry verification passed using repository bytes and SHA-256 checks (`stat -c '%s'` and `sha256sum`) with the exact certified values above. This checkpoint is documentary only; it makes no production-code, policy, inventory, qualification, or geometry change.
