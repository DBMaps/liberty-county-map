# Gridly App Icon Strategy

## Objective

Define a durable app icon strategy for Gridly before App Store and Google Play asset production. This document establishes requirements and recommendations only; it does not generate artwork.

## Brand Positioning

Gridly should visually communicate:

- Awareness Platform First.
- Route Intelligence Second.
- Local confidence without implying turn-by-turn navigation.
- Calm, trustworthy, utility-first decision support.

The icon should avoid visual language that suggests a full navigation replacement, directional guidance, emergency dispatch, or official government status.

## Master Icon Requirements

Create one master source asset that can be exported into Apple, Android, and PWA sizes. The master icon should:

- Be produced as a high-resolution editable source file.
- Use a square canvas.
- Avoid text or tiny details that fail at small sizes.
- Preserve readability on light and dark device backgrounds.
- Remain recognizable at notification-size and home-screen-size scales.
- Use brand colors consistently with Gridly's existing visual tone.

## 1024x1024 Source Asset

The primary source export should be a **1024x1024 PNG** suitable for App Store Connect upload and downstream resizing. Keep an editable master file, such as SVG, Figma, Sketch, or another design-source format, so future exports can be generated without quality loss.

Recommended production package:

- `icon-master` editable source file.
- `icon-1024.png` app-store source export.
- Platform-specific resized exports.
- Documentation noting colors, spacing, and safe-area rules.

## Apple Requirements

For Apple distribution, prepare an app icon set that follows current App Store and iOS requirements:

- 1024x1024 App Store icon.
- No transparency in the final App Store icon export.
- No rounded corners baked into the artwork; Apple applies masks.
- No screenshots, photographs with unreadable detail, or excessive text.
- Strong legibility at small sizes.

Before submission, verify the latest Apple Human Interface Guidelines and App Store Connect upload requirements.

## Android Requirements

For Android distribution, prepare adaptive icon assets in addition to standard launcher exports:

- Foreground layer.
- Background layer.
- Safe-zone-aware composition for adaptive masking.
- Play Console high-resolution icon export.
- Consistent appearance across common launcher masks.

Avoid placing critical details near the edges because Android launchers may crop or mask icons differently.

## PWA Requirements

For the Progressive Web App package, preserve existing PWA behavior while preparing consistent icon exports for web manifest use. Recommended PWA exports include:

- 192x192 PNG.
- 512x512 PNG.
- Maskable icon variant if supported by the existing manifest strategy.
- Monochrome or simplified variants only if needed later.

Do not change existing PWA install behavior as part of V277.1.

## Simplicity Requirements

The icon should be simple enough to understand in one glance. Recommended constraints:

- One primary symbol or composition.
- Minimal line work.
- No long wordmarks.
- No detailed maps.
- No complex trains, roads, or signs that become unclear at small sizes.
- No directional arrow treatment that implies turn-by-turn navigation.

## Readability Requirements

The icon must remain readable at:

- App Store and Play Store listing sizes.
- Home screen sizes.
- Search results.
- Settings lists.
- Small launcher previews.

Test the icon at 1024, 512, 192, 180, 120, 87, 80, 60, 40, and 29 pixel previews before final approval.

## Recommendations

Recommended creative direction:

- Use a bold, abstract awareness mark rather than a map-pin-only or route-arrow-only symbol.
- Consider a subtle grid, signal, crossing, or alert motif that supports local awareness without overpromising navigation.
- Keep contrast high and shapes broad.
- Validate against both Apple and Android masks before production.
- Produce the icon as part of V277.2 — Store Asset Production.
