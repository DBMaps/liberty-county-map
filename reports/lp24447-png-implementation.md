# LP244.47 exact approved PNG implementation

Semantic correction LP244.47A: the original generic Roadway Incident → Travel Advisory mapping was incorrect and is superseded by reports/lp24447a-semantic-correction.md. Earlier runtime evidence describes the pre-correction pass.

Starting branch: LP244.47-marker-system-unification
Starting HEAD: f8c9892274943ecabf6652e6e20e393cc8e4d8c7

## Sources and byte preservation
Windows Downloads was resolved from USERPROFILE. Both supplied packages were present as ZIP archives, with no corresponding extracted directory. Sources:
- C:/Users/gulfi/Downloads/gridly-approved-marker-assets-2026-09-21.zip
- C:/Users/gulfi/Downloads/gridly-approved-navigation-markers-2026-09-21.zip

28 hazard/reference files are in assets/markers/approved/. Three navigation files are in assets/markers/approved/navigation/. Every PNG was copied directly from its archive entry without conversion, resizing, recompression, or artwork changes. The SHA-256 source manifest records archive entries and native dimensions. Reduced Visibility #6 came from the hazard ZIP root entry 06-reduced-visibility.png; the other hazard images were in the nested package directory.

## Runtime audit
js/gridlyMarkerRegistry.js is the shared approved manifest. js/app.js reuses its existing community/unified, official DriveTexas, crossing, and advisory marker factories. The seven winter types have distinct approved PNGs. Existing source badges remain separate from artwork. Unknown hazards use 16-other-hazard.png. Official/community provenance and closure authority are unchanged.

All 30 rejected LP244.47 unified SVG files and their SVG generation/validation tools were removed. No active app or registry references to assets/markers/unified, assets/markers/svg, or assets/markers/png remain. Historical reports and historical preview scripts retain prior-phase evidence and are not current runtime entry points. Older pre-LP244.47 source art was left untouched.

Hazard display boxes remain 64x64 CSS pixels, object-fit contain, tip anchors near the bottom, with the existing selected scale of 1.1. Owner PNG backgrounds/borders are preserved and extra artwork filters are suppressed. Native image dimensions are audited per file, including non-square sources.

Current location and trip start/destination use an independent navigation path, cache, class and 48x48 display box. Current location is centered; trip tips are bottom anchored. Search destination uses the same approved trip-destination image. Route geometry, ownership, interactions and Route Watch logic are unchanged.

Cache query versions were updated for the four touched JS/CSS resources. The service worker does not precache marker artwork or these scripts. No service worker or native staging changes were needed.

## Consolidations
- Legacy impassable is still stored/normalized as ROAD_IMPASSABLE; consumer wording and visual resolve to Road Appears Blocked / #12. Its separate picker option is removed. Official advisory authority rules remain unchanged.
- Fallen Tree retains raw input and resolves to Debris in Road / #11.
- Generic Roadway Incident has no standalone visual definition; it resolves to Other Hazard / #16. Explicit Travel Advisory input resolves to Travel Advisory / #28. Known specific conditions retain precedence over a generic incident category.
- Reported Crossing Delay / #23, Blocked Crossing / #24 and neutral Crossing Location / #25 remain distinct. Navigation carries no hazard severity or authority semantics.

## Local certification and review
Focused command: node --test tests/lp24447-marker-system.test.cjs tests/lp24446-hazard-normalization.test.cjs
Result: 46 passed, 0 failed (24 marker contract tests + 22 normalization tests).
Broader result: 74 passed, 0 failed. Exact output is in lp24447-png-broader-tests.txt.

Generate review board: node tools/lp24447-png/review-board.cjs
Open .artifacts/lp24447-approved-png-review/index.html directly in a browser. Sections show all 28 hazard/reference images, all 3 navigation images, and consolidation proofs. Buttons select normal map size, 128px, or 256px inspection using CSS only. All images reference canonical runtime files.

Runtime harness: node tools/lp24447-png/preview.mjs (requires read-only public basemap tile access). Uses disposable browser storage, synthetic Dayton-area fixtures, local library dependencies and blocked/stubbed backend requests. No report is submitted. Screenshots and preview-evidence.json are local ignored artifacts. Synthetic fixtures can coexist with duplicate/grouped markers produced by the existing renderer; no grouping behavior was changed for the preview.

No backend writes, reporting activation, production state change, native staging, launch-candidate rebuild, push, merge or deployment occurred. Remaining gate is owner visual testing on the supplied review board and eventual devices; owner visual approval is not implied by automated certification.

Browser validation: all 28 hazard/reference entries across 16 mobile batches (320, 360, 390, 440 px); three map contexts; 64px normal and 70.4px selected size; all three 48px navigation icons; 15 primary picker selections and 5 subtype selections. Zero uncaught browser errors. Full evidence: lp24447-png-runtime-evidence.json.
