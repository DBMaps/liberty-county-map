# Gridly Asset Folder Structure

## Objective

Define the recommended repository structure for future store asset production without creating generated artwork, screenshots, icons, PDFs, ZIPs, or other binary assets in V277.2.

## Recommended Structure

```text
assets/store/
assets/store/apple/
assets/store/google/
assets/store/screenshots/
assets/store/icons/
assets/store/branding/
```

## Folder Responsibilities

### `assets/store/`

Top-level container for future store-distribution assets. Keep this folder limited to approved production exports, placeholder files, and asset documentation.

### `assets/store/apple/`

Future Apple-specific assets, such as App Store Connect icon export references, Apple screenshot exports, and Apple-specific review packaging notes.

### `assets/store/google/`

Future Google Play-specific assets, such as Play icon exports, feature graphics, Play screenshot exports, and Play Console packaging notes.

### `assets/store/screenshots/`

Shared screenshot staging area for source captures and reviewed store screenshot sets before platform-specific export organization.

### `assets/store/icons/`

Shared app icon production area for future master exports, platform-specific derivatives, and icon validation notes.

### `assets/store/branding/`

Shared brand asset area for future store listing visuals, approved color references, spacing notes, and reusable marketing-layout source references.

## Placeholder Policy

- `.gitkeep` files may be used to preserve empty folder structure.
- `.gitkeep` files are text placeholders only.
- Do not place generated binary assets in these folders during V277.2.
- Do not create PNG, JPG, JPEG, WEBP, ICO, PDF, ZIP, generated screenshots, generated artwork, or generated icons in V277.2.

## Future Production Naming Guidance

When binary assets are eventually produced in a later milestone, use explicit names that describe platform, scenario, dimensions, and status.

Examples for future use only:

- `apple-iphone-awareness-brief-1290x2796-final.png`
- `google-phone-route-watch-1080x1920-final.png`
- `google-feature-graphic-1024x500-final.png`
- `app-icon-play-512x512-final.png`
- `app-icon-apple-1024x1024-final.png`

These examples are naming guidance only; V277.2 does not create those files.

## Acceptance Criteria

- [ ] Folder structure is documented.
- [ ] Text-only placeholders preserve empty directories where needed.
- [ ] Future platform responsibilities are clear.
- [ ] Binary asset production remains deferred to V277.3 or later.
