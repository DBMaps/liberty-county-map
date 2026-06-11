# Gridly Store Asset Manifest — V277.3

## Purpose

This folder documents expected production store assets for future manual creation and integration. It is a manifest and readiness area only.

**Do not place unfinished, fake, AI-generated, or placeholder binary artwork in this folder.**

## Expected Ownership

| Area | Owner | Responsibility |
| --- | --- | --- |
| App icon master | Design / brand owner | Create and approve the editable master source. |
| Store screenshots | Product / release owner | Capture real app states from a production candidate build. |
| Store captions | Product / marketing owner | Review captions for awareness-first positioning and platform compliance. |
| Legal URLs | Legal / product owner | Publish and verify Privacy Policy, Terms, and support URLs. |
| Asset validation | Release owner | Confirm filenames, dimensions, locations, quantity, and store upload readiness. |

## Expected Destination Folders

| Asset Type | Destination Folder |
| --- | --- |
| Apple icons | `assets/store/apple/icons/` |
| Apple iPhone screenshots | `assets/store/apple/screenshots/iphone/` |
| Apple iPad screenshots, if applicable | `assets/store/apple/screenshots/ipad/` |
| Apple app previews, if applicable | `assets/store/apple/previews/` |
| Google icons | `assets/store/google/icons/` |
| Google feature graphic | `assets/store/google/graphics/` |
| Google phone screenshots | `assets/store/google/screenshots/phone/` |
| Google tablet screenshots, if applicable | `assets/store/google/screenshots/tablet-7/` and `assets/store/google/screenshots/tablet-10/` |
| Shared brand source references | `assets/store/branding/` only after approval for repository storage. |
| Shared screenshot working notes | `assets/store/manifest/` as Markdown or JSON manifests only. |

## Expected Filenames

Final filenames should follow `docs/STORE/GRIDLY-ASSET-NAMING-STANDARD.md`. Initial expected production filenames are:

### Icons

- `gridly-apple-app-store-icon-v277-3.png`
- `gridly-google-play-icon-v277-3.png`
- `gridly-android-adaptive-icon-foreground-v277-3.png`
- `gridly-android-adaptive-icon-background-v277-3.png`

### Apple iPhone Screenshots

- `gridly-apple-iphone-01-awareness-brief-v277-3.png`
- `gridly-apple-iphone-02-train-blocking-crossing-v277-3.png`
- `gridly-apple-iphone-03-road-hazard-v277-3.png`
- `gridly-apple-iphone-04-community-reporting-v277-3.png`
- `gridly-apple-iphone-05-route-watch-v277-3.png`
- `gridly-apple-iphone-06-community-pulse-v277-3.png`
- `gridly-apple-iphone-07-destination-search-v277-3.png`
- `gridly-apple-iphone-08-settings-v277-3.png`

### Google Phone Screenshots

- `gridly-google-phone-01-awareness-brief-v277-3.png`
- `gridly-google-phone-02-train-blocking-crossing-v277-3.png`
- `gridly-google-phone-03-road-hazard-v277-3.png`
- `gridly-google-phone-04-community-reporting-v277-3.png`
- `gridly-google-phone-05-route-watch-v277-3.png`
- `gridly-google-phone-06-community-pulse-v277-3.png`
- `gridly-google-phone-07-destination-search-v277-3.png`
- `gridly-google-phone-08-settings-v277-3.png`

### Google Feature Graphic

- `gridly-google-feature-graphic-v277-3.png`

## Expected Dimensions

Dimensions must be verified against current App Store Connect and Play Console requirements at upload time. Planned baseline dimensions are:

| Asset | Planned Dimension / Constraint |
| --- | --- |
| Apple App Store icon | 1024 × 1024 px. |
| Google Play high-resolution icon | 512 × 512 px. |
| Google feature graphic | 1024 × 500 px. |
| Apple iPhone screenshots | Use the App Store Connect-required device classes selected for launch; common portrait sizes include 1290 × 2796 px, 1179 × 2556 px, 1242 × 2688 px, 1284 × 2778 px, and 1242 × 2208 px. |
| Apple iPad screenshots | Conditional; use the current required iPad classes only if iPad distribution is enabled. |
| Google phone screenshots | Must satisfy Play Console screenshot dimension and aspect-ratio rules at upload time. |
| Google tablet screenshots | Conditional; use current Play Console requirements only if tablet screenshots are included. |

## Manifest Update Rules

When production assets are created in a future milestone:

1. Add only approved final exports to the destination folders.
2. Record exact filename, dimensions, file size, owner, creation date, review status, and store acceptance status in a future machine-readable manifest.
3. Do not commit source files unless the repository is the approved storage location.
4. Do not use fake screenshots or generated placeholder imagery.
5. Re-run the future validation script before V277.4 asset integration audit.
