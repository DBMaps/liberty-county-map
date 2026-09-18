# Public product image sharpness correction

Starting state: clean LP244.42A-public-image-sharpness at 329e2e3d7b30b06d12821de6f9e0131a4fcc566c. This is the dedicated branch present when the original source files were provided.

## Sources and exports

The three owner-provided Desktop PNG originals each measure 1320 × 2868 pixels on disk. The 943 × 2048 conversation previews are resized displays, not the source files. Crops were generated directly from originals at one source pixel per output pixel. No upscaling, resampling, sharpening, fabricated data, or screenshot-text editing was performed.

| Public asset | Original source | Crop x,y,w,h | Output dimensions |
|---|---|---|---|
| public-site/assets/gridly-hero.png | C:/Users/gulfi/OneDrive/Desktop/Hero.png | Entire source, byte-identical | 1320 × 2868 |
| public-site/assets/gridly-local-detail.png | C:/Users/gulfi/OneDrive/Desktop/Hero.png | 0,644,1320,1974 | 1320 × 1974 |
| public-site/assets/gridly-search-detail.png | C:/Users/gulfi/OneDrive/Desktop/search.png | 0,438,1320,2180 | 1320 × 2180 |
| public-site/assets/gridly-review-detail.png | C:/Users/gulfi/OneDrive/Desktop/kbyg.png | 30,548,1260,820 | 1260 × 820 |

The new authoritative source includes Dayton City Park in Search and “Monitoring nearby conditions” in the Travel Brief. Both are original source pixels, not site-copy changes. The Dayton identity and quiet-state product story remain intact.

Homepage modifications are limited to image intrinsic width/height attributes. CSS, copy, typography, spacing, wordmark, Texas SVG, sections, and site runtime are unchanged. The image aspect ratios follow the genuine crops, with no stretching or clipping.

## Validation

| Viewport | Hero natural/rendered | Search natural/rendered | Review natural/rendered |
|---|---|---|---|
| 430 | 1320×2868 / 264×574 | 1320×2180 / 342×565 | 1260×820 / 342×223 |
| 1440 | 1320×2868 / 314×682 | 1320×2180 / 373×617 | 1260×820 / 373×243 |

All three corrected featured assets have at least 3.38 source pixels per CSS pixel at both required widths. Visual inspection confirms readable genuine text, clean fit, and preserved composition. No horizontal overflow, failed assets, browser errors, or external requests. Ten additional legal/support viewport checks passed.

All 58 applicable public-site tests passed, including a new regression for minimum image dimensions. Existing image hash expectations were updated to the authoritative exports. git diff --check passed.

Evidence: .artifacts/lp24442-astra-sharpness-fix/mobile-430.png and desktop-1440.png. The same directory contains prepare.mjs, capture.mjs, imagery-provenance.json with source/output SHA-256 hashes, and validation.json with natural/rendered dimensions.

No push, merge, or deployment performed during this pass.

Verdict: A. READY FOR OWNER VISUAL REVIEW
