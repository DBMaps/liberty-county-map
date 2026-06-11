# Gridly Asset Inventory — V277.3

## Objective

This inventory defines every expected production store asset for Gridly before manual artwork creation, screenshot capture, export, and store upload. V277.3 prepares the repository and validation framework only.

**V277.3 does not create artwork, screenshots, icons, logos, splash graphics, marketing graphics, or placeholder binary assets.**

Gridly must continue to be positioned as an **Awareness Platform First** and **Route Intelligence Second** product. Assets must not imply turn-by-turn navigation, emergency dispatch, government operation, official incident verification, or guaranteed road safety.

## Asset Status Legend

| Status | Meaning |
| --- | --- |
| Required | Needed before the relevant production store submission. |
| Conditional | Needed only if the related platform, device class, locale, or campaign is in scope. |
| Optional | Useful after core launch assets are complete. |
| Future | Deferred until a later product, brand, localization, or marketing milestone. |
| Not Created | V277.3 intentionally creates no binary asset. |

## Apple Assets

| Asset | Required | Expected Use | Expected Location | V277.3 Status |
| --- | --- | --- | --- | --- |
| App Store icon | Required | App Store Connect app listing and release package. | `assets/store/apple/icons/` | Not Created |
| iPhone screenshots | Required | App Store Connect iPhone listing screenshots. | `assets/store/apple/screenshots/iphone/` | Not Created |
| iPad screenshots | Conditional | App Store Connect iPad listing screenshots if iPad distribution is enabled. | `assets/store/apple/screenshots/ipad/` | Not Created |
| App preview videos | Optional | App Store listing video previews if production marketing chooses to add them. | `assets/store/apple/previews/` | Not Created |
| Promotional text copy | Required | App Store Connect metadata entry. | `docs/STORE/GRIDLY-METADATA-PACKAGE.md` | Existing draft source |
| Subtitle / tagline copy | Required | App Store Connect metadata entry. | `docs/STORE/GRIDLY-METADATA-PACKAGE.md` | Existing draft source |
| Keywords | Required | App Store Connect keyword field. | `docs/STORE/GRIDLY-METADATA-PACKAGE.md` | Existing draft source |
| Support URL | Required | App Store Connect support metadata. | Legal / support publishing system | Pending production URL |
| Privacy Policy URL | Required | App Store Connect privacy metadata. | Legal publishing system | Pending production URL |
| Terms URL or legal placement | Conditional | App Store Connect/support legal reference if used. | Legal publishing system | Pending production URL |

## Google Assets

| Asset | Required | Expected Use | Expected Location | V277.3 Status |
| --- | --- | --- | --- | --- |
| High-resolution Play icon | Required | Google Play listing icon. | `assets/store/google/icons/` | Not Created |
| Feature graphic | Required | Google Play store listing feature graphic. | `assets/store/google/graphics/` | Not Created |
| Phone screenshots | Required | Google Play phone listing screenshots. | `assets/store/google/screenshots/phone/` | Not Created |
| Seven-inch tablet screenshots | Conditional | Google Play tablet listing if tablet support is marketed. | `assets/store/google/screenshots/tablet-7/` | Not Created |
| Ten-inch tablet screenshots | Conditional | Google Play tablet listing if tablet support is marketed. | `assets/store/google/screenshots/tablet-10/` | Not Created |
| Promo video | Optional | Google Play listing video if production marketing chooses to add it. | External video URL / campaign system | Not Created |
| Short description | Required | Google Play metadata entry. | `docs/STORE/GRIDLY-METADATA-PACKAGE.md` | Existing draft source |
| Full description | Required | Google Play metadata entry. | `docs/STORE/GRIDLY-METADATA-PACKAGE.md` | Existing draft source |
| Privacy Policy URL | Required | Play Console policy metadata. | Legal publishing system | Pending production URL |
| Data Safety answers | Required | Play Console Data Safety form. | Release checklist / policy records | Pending final review |

## Icons

| Asset | Required | Expected Dimensions | Expected Location | Notes |
| --- | --- | --- | --- | --- |
| App icon master source | Required | Editable source, square artboard, high resolution. | Design tool of record, referenced from `assets/store/manifest/README.md` when approved. | Do not store unfinished source art in V277.3. |
| Apple App Store icon | Required | 1024 × 1024 px. | `assets/store/apple/icons/` | No transparency and no rounded corners baked into final artwork. |
| Apple app icon export set | Required for native package completeness | Current Xcode asset catalog sizes as generated from approved master. | Native iOS project asset catalog during future integration. | Validate against current Xcode/App Store Connect requirements at integration time. |
| Google Play high-resolution icon | Required | 512 × 512 px. | `assets/store/google/icons/` | Validate current Play Console format requirements at upload time. |
| Android launcher icon export set | Required for native package completeness | Current Android adaptive/legacy icon outputs from approved master. | Native Android resource folders during future integration. | Validate foreground/background layers and launcher appearance later. |
| PWA icons | Existing app behavior | Existing manifest icon sizes. | Existing PWA asset locations. | Do not modify in V277.3. |

## Screenshots

Core production screenshot scenarios:

| Screenshot | Required | Apple Destination | Google Destination | V277.3 Status |
| --- | --- | --- | --- | --- |
| Awareness Brief | Required | `assets/store/apple/screenshots/iphone/` | `assets/store/google/screenshots/phone/` | Not Created |
| Train Blocking Crossing | Required | `assets/store/apple/screenshots/iphone/` | `assets/store/google/screenshots/phone/` | Not Created |
| Road Hazard | Required | `assets/store/apple/screenshots/iphone/` | `assets/store/google/screenshots/phone/` | Not Created |
| Community Reporting | Required | `assets/store/apple/screenshots/iphone/` | `assets/store/google/screenshots/phone/` | Not Created |
| Route Watch | Required | `assets/store/apple/screenshots/iphone/` | `assets/store/google/screenshots/phone/` | Not Created |
| Community Pulse | Required | `assets/store/apple/screenshots/iphone/` | `assets/store/google/screenshots/phone/` | Not Created |
| Destination Search | Required | `assets/store/apple/screenshots/iphone/` | `assets/store/google/screenshots/phone/` | Not Created |
| Settings | Required | `assets/store/apple/screenshots/iphone/` | `assets/store/google/screenshots/phone/` | Not Created |

Capture rules:

- Use real app UI states from the production candidate build.
- Use realistic but non-sensitive sample data.
- Do not fake reports, fabricate screenshots, or use AI-generated UI captures.
- Do not change app behavior to make screenshots easier.
- Ensure captions and imagery preserve awareness-first positioning.

## Store Listing Assets

| Asset | Required | Source / Destination | Status |
| --- | --- | --- | --- |
| App name | Required | `docs/STORE/GRIDLY-METADATA-PACKAGE.md` | Drafted |
| Subtitle / short tagline | Required | `docs/STORE/GRIDLY-METADATA-PACKAGE.md` | Drafted |
| Short description | Required for Google | `docs/STORE/GRIDLY-METADATA-PACKAGE.md` | Drafted |
| Full description | Required | `docs/STORE/GRIDLY-METADATA-PACKAGE.md` | Drafted |
| Keywords | Required for Apple | `docs/STORE/GRIDLY-METADATA-PACKAGE.md` | Drafted |
| Category recommendations | Required | `docs/STORE/GRIDLY-METADATA-PACKAGE.md` and platform checklists | Drafted |
| Screenshot captions | Required for production review | `docs/STORE/GRIDLY-APP-SCREENSHOT-CAPTIONS.md` | Prepared by V277.3 |
| Feature graphic caption / concept notes | Required for Google production design | `assets/store/manifest/README.md` and future design brief | Planned |

## Legal Assets

| Asset | Required | Owner | Status |
| --- | --- | --- | --- |
| Privacy Policy | Required | Legal/product owner | Draft exists; production URL pending. |
| Terms of Use | Required / strongly recommended | Legal/product owner | Draft exists; production URL pending. |
| Support contact / support URL | Required | Product operations | Pending production publication. |
| Data Safety records | Required for Google | Product/legal owner | Pending final review against implementation. |
| Apple privacy nutrition label answers | Required for Apple | Product/legal owner | Pending final review against implementation. |
| Copyright holder | Required | Product owner | Pending final store metadata confirmation. |

## Required

Required before production submission:

- Approved app icon master.
- Apple App Store icon export.
- Google Play high-resolution icon export.
- Android launcher icon export set.
- Apple required iPhone screenshot set.
- Google required phone screenshot set.
- Google feature graphic.
- Final App Store metadata.
- Final Google Play metadata.
- Published Privacy Policy URL.
- Published Terms or approved legal placement.
- Final platform privacy/data-safety answers.

## Optional

Optional after required assets are complete:

- App preview videos.
- Google Play promo video.
- Device-frame screenshot variants.
- Localized screenshots and captions.
- Campaign-specific promotional graphics.
- Press-kit artwork and launch announcement graphics.
- A/B test screenshot variants after launch.

## Future Assets

Future asset categories may include:

- County-specific store screenshots after multi-county expansion.
- Seasonal or campaign-specific listing graphics.
- Localized metadata and imagery for additional regions.
- Tablet-specific creative if tablet distribution becomes a product priority.
- Press, partner, and community launch kits.

These assets must be introduced through future milestones with the same no-fake-assets rule unless the milestone explicitly authorizes production artwork creation.
