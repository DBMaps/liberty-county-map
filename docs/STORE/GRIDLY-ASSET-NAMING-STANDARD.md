# Gridly Asset Naming Standard — V277.3

## Objective

Define consistent naming and organization rules for future Gridly production store assets. This standard prevents upload confusion, duplicate exports, and platform-specific rework.

## General Naming Convention

Use lowercase kebab-case filenames:

```text
gridly-{platform}-{asset-or-device}-{sequence-if-needed}-{scenario-or-role}-{version}.{extension}
```

Rules:

- Prefix every store asset with `gridly`.
- Use `apple`, `google`, `android`, `ios`, or `shared` as the platform segment.
- Use two-digit screenshot sequence numbers, such as `01` through `08`.
- Use descriptive scenario names that match the screenshot plan.
- Use the milestone version segment, such as `v277-3`, for draft production batches.
- Use only lowercase letters, numbers, and hyphens.
- Do not use spaces, underscores, parentheses, date-only names, device owner names, or ambiguous names like `final-final.png`.
- Keep file extensions lowercase.

## Icons

### Icon Filename Pattern

```text
gridly-{platform}-{icon-role}-{version}.png
```

Examples:

- `gridly-apple-app-store-icon-v277-3.png`
- `gridly-google-play-icon-v277-3.png`
- `gridly-android-adaptive-icon-foreground-v277-3.png`
- `gridly-android-adaptive-icon-background-v277-3.png`
- `gridly-ios-app-icon-export-set-v277-3.zip` only if a future milestone explicitly allows archive storage.

### Icon Organization

- Apple store icon exports: `assets/store/apple/icons/`
- Google Play icon exports: `assets/store/google/icons/`
- Android native icon layers: native Android resource folders during the integration milestone.
- iOS native app icon exports: iOS asset catalog during the integration milestone.
- Master editable source: design tool of record unless repository storage is explicitly approved.

## Screenshots

### Screenshot Filename Pattern

```text
gridly-{platform}-{device-class}-{sequence}-{scenario}-{version}.png
```

Scenario slugs:

1. `awareness-brief`
2. `train-blocking-crossing`
3. `road-hazard`
4. `community-reporting`
5. `route-watch`
6. `community-pulse`
7. `destination-search`
8. `settings`

Examples:

- `gridly-apple-iphone-01-awareness-brief-v277-3.png`
- `gridly-apple-iphone-02-train-blocking-crossing-v277-3.png`
- `gridly-google-phone-05-route-watch-v277-3.png`
- `gridly-google-phone-08-settings-v277-3.png`

### Screenshot Organization

- Apple iPhone screenshots: `assets/store/apple/screenshots/iphone/`
- Apple iPad screenshots, if applicable: `assets/store/apple/screenshots/ipad/`
- Google phone screenshots: `assets/store/google/screenshots/phone/`
- Google tablet screenshots, if applicable: `assets/store/google/screenshots/tablet-7/` and `assets/store/google/screenshots/tablet-10/`

## Apple Assets

Apple assets should use the `gridly-apple-` prefix for App Store listing exports and `gridly-ios-` only for native iOS package resources.

Apple examples:

- `gridly-apple-app-store-icon-v277-3.png`
- `gridly-apple-iphone-01-awareness-brief-v277-3.png`
- `gridly-apple-ipad-01-awareness-brief-v277-3.png`
- `gridly-ios-app-icon-export-set-v277-3` for a future integration folder, if applicable.

## Google Assets

Google Play listing assets should use the `gridly-google-` prefix. Native Android resources should use `gridly-android-` only when the file is destined for Android app resources rather than Play Console upload.

Google examples:

- `gridly-google-play-icon-v277-3.png`
- `gridly-google-feature-graphic-v277-3.png`
- `gridly-google-phone-01-awareness-brief-v277-3.png`
- `gridly-android-adaptive-icon-foreground-v277-3.png`

## Versioning Convention

Use milestone versions in filenames during production batches:

- V277.3 batch naming: `v277-3`
- Future V277.4 integration verification naming: keep the accepted V277.3 filenames unless assets are re-exported.
- Revisions before store acceptance: append `-r2`, `-r3`, etc. before the extension only if multiple reviewed exports must coexist.
- Accepted assets: do not rename after store acceptance unless platform upload requires a change.

Examples:

- `gridly-google-feature-graphic-v277-3-r2.png`
- `gridly-apple-iphone-03-road-hazard-v277-3-r2.png`

## File Organization Convention

```text
assets/store/
  apple/
    icons/
    screenshots/
      iphone/
      ipad/
    previews/
  google/
    icons/
    graphics/
    screenshots/
      phone/
      tablet-7/
      tablet-10/
  branding/
  icons/
  manifest/
```

Organization rules:

- Keep platform upload assets in platform-specific folders.
- Keep documentation and manifests in `assets/store/manifest/`.
- Do not mix Apple and Google exports in shared folders.
- Do not place raw capture dumps in production folders.
- Do not commit binary placeholders or fake screenshots.
- Keep source design files outside the repository unless the owner explicitly approves repository storage.
