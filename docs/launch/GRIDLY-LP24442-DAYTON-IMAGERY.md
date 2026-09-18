# Authoritative Dayton product imagery

Starting branch: LP244.42-final-design-system-consistency.
Starting HEAD: 2831cc86b809f606bd9eb660be195b34a6b17a20.

This pass supersedes the previous mixed Dallas-search/Dayton-context imagery. The owner identifies the three supplied captures as genuine, fully loaded Gridly UI from http://127.0.0.1:5500. No app state was injected or recaptured in this pass.

## Sources and uses

Sources are in C:/Users/gulfi/AppData/Local/Temp/ and are also preserved as source-1.png, source-2.png, source-3.png in .artifacts/lp24442-astra-dayton-final/.

| Attachment | Public use | Crop (x, y, width, height) |
|---|---|---|
| codex-clipboard-dc209488-3c09-4db9-ad0e-cdbb254313cf.png | gridly-hero.png: Dayton map, quiet Community Pulse, Location Context Dayton | Full source, byte-identical, 244 × 531 |
| Same image 1 | gridly-local-detail.png: Know What Matters map and Dayton location context | 4, 130, 237, 348 |
| codex-clipboard-d5518d7a-6568-4d70-938a-c918f7aea756.png | gridly-review-detail.png: expanded Travel Brief, quiet-state local intelligence and community information | 9, 113, 229, 163 |
| codex-clipboard-c04b988a-af93-49b3-8af7-7e9945b0f789.png | gridly-search-detail.png: Dayton query, Liberty County community result, City Hall, Police Department, High School | 8, 94, 239, 384 |

Only rectangular crops, browser scaling, and the existing site framing are used. No UI/text retouching or invented data. Review focuses on the Travel Brief; its Dayton identity derives from the owner's full capture and is stated in the caption. Source resolution is retained without synthetic enhancement. Source and output SHA-256 hashes are recorded in imagery-provenance.json; committed regression tests protect the public asset hashes.

## Place-identity sweep

All public-site text occurrences are in index.html:

- Hero alt: Dayton map and Location Context Dayton (two Dayton occurrences); valid selected-community identity.
- Hero caption: Actual Gridly interface · Dayton, Texas; valid.
- Know What Matters alt: Location Context Dayton; valid.
- Know What Matters caption: Dayton map and local awareness context; valid.
- Search alt: query for Dayton and Dayton, Liberty County result (two Dayton occurrences, one Liberty County); valid search identity.
- Search caption: Dayton search example; valid.
- Review alt: Dayton example; valid source attribution.
- Review caption: Dayton Travel Brief; valid source attribution.

Raster occurrences: hero and map detail each preserve the Dayton map label and Location Context Dayton. Search preserves the Dayton query, Dayton community result / Liberty County, and Dayton City Hall, Dayton Police Department, Dayton High School with their Dayton addresses. Review crop has no city label; its source includes Dayton location context. All are coherent genuine Dayton evidence. No featured Dallas or “Nearby places around Dayton” mixed-state content remains. No city references required legal changes.

## Protection and validation

Approved layout, CSS, typography, grid, upright device, Texas geography, company/trust, footer and capability/journey copy are unchanged. Image intrinsic dimensions and descriptive captions/alt text were updated. Community Awareness remains a launch capability, age remains “For adults 18 and over,” and store distribution remains coming soon. No unavailable/limited/beta/debug state is introduced. No Go image is fabricated.

All 57 public-site tests passed across LP24434, LP24438, LP24439, LP24440, LP24440a, LP24441, LP24442. The new focused regression checks Dayton identity, absence of Dallas, Search/Review captions, and PNG dimensions. Existing tests protect legal links, final-product copy, static behavior, and no tracking. git diff --check passed.

Seven required screenshots exist and were visually reviewed: mobile-375.png, mobile-390.png, mobile-430.png, desktop-1024.png, desktop-1280.png, desktop-1440.png, desktop-1920.png in .artifacts/lp24442-astra-dayton-final/. All have no horizontal overflow, broken images, browser errors, failed HTTP responses, or external requests. Product starts at the same mobile position; Dayton identity and focused crops remain readable. Desktop section/step alignment and image proportions are preserved. Ten additional legal/support viewport checks passed. Capture details are in validation.json.

No app/backend/native/operational changes, push, merge, or deployment.

Verdict: A. READY FOR OWNER FINAL VISUAL REVIEW
