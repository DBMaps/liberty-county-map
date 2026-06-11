# GRIDLY V275.0 — PWA Infrastructure Audit

## 1. Executive Summary

Gridly is partially prepared for a V275 PWA foundation because the app already has mobile viewport metadata, theme color metadata, Apple home-screen metadata, favicon links, and 180/192/512 square icon files. The project does **not** currently implement PWA installability because there is no manifest, no service worker, no service-worker registration, and no install-prompt handling.

The current architecture remains aligned with the mission order: **Awareness Platform First, Route Intelligence Second**. Nothing in this audit changes visible behavior, user workflows, counties, notification behavior, Capacitor packaging, or installability.

## 2. PWA Readiness Score

**Score: 42 / 100**

Rationale:

- +15: mobile viewport is present and suitable for full-screen mobile layout.
- +10: theme color is present.
- +10: Apple home-screen metadata is present.
- +7: 180, 192, and 512 square icon files already exist.
- 0: no manifest.
- 0: no service worker.
- 0: no service-worker registration.
- 0: no install-prompt handling.
- 0: no standalone mode handling.
- 0: no 1024x1024 app icon export.

## 3. Existing Assets Found

### Favicon and app icon assets

| File | Size | Finding |
| --- | ---: | --- |
| `assets/favicon-32.png` | 32x32 | Existing favicon candidate. |
| `assets/icon-180.png` | 180x180 | Existing Apple touch icon size. |
| `assets/icon-192.png` | 192x192 | Existing Android/PWA icon size. |
| `assets/icon-512.png` | 512x512 | Existing Android/PWA icon size. |

### Logo and brand assets

| File | Size | Finding |
| --- | ---: | --- |
| `assets/gridly-logo-primary.png` | 1536x1024 | Strong brand source, but not square; would need a square crop/export for app icon master. |
| `assets/gridly-header-compact.png` | 1572x1044 | Header artwork; not ideal as an app icon master. |
| `assets/gridly-header-ultra-compact.png` | 1552x747 | Header artwork; not square. |
| `assets/gridly-header-ultra-compact-fixed.png` | 786x297 | Header artwork; not square. |
| `assets/desktop-gate/gridly-desktop-beta-board.png` | 1536x1024 | Beta board artwork; not suitable as an app icon master. |
| `assets/desktop-gate/gridly-landscape-rotate-board.png` | 1659x948 | Landscape board artwork; not suitable as an app icon master. |

### Marker/icon assets

- `assets/markers/png/*.png` includes 256x256 hazard marker PNGs plus `rail-crossing.png` at 1024x1536.
- `assets/markers/svg/*.svg` includes 32x44 hazard marker SVGs and `GRIDLY-MARKER-SYSTEM-V1.svg` at 448x132.
- These marker assets are useful for in-app map semantics, but they are not recommended as the primary app icon master because the app icon should communicate the Gridly brand rather than a single report category.

### Can current assets support app icon generation?

| Target | Current support | Finding |
| --- | --- | --- |
| 1024x1024 | Partial | No square 1024 app icon exists. `gridly-logo-primary.png` has enough source resolution, but requires a square export/crop. |
| 512x512 | Yes | `assets/icon-512.png` exists. |
| 192x192 | Yes | `assets/icon-192.png` exists. |

**Artwork recommendation:** new artwork is not strictly required if the existing Gridly logo can be approved as the master source, but a dedicated square 1024x1024 icon export is required before production PWA packaging.

## 4. Existing Metadata Found

`index.html` currently contains:

- Viewport: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />`
- Theme color: `<meta name="theme-color" content="#071426">`
- Apple capable: `<meta name="apple-mobile-web-app-capable" content="yes">`
- Apple title: `<meta name="apple-mobile-web-app-title" content="Gridly">`
- Apple status bar: `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- Apple touch icon: `<link rel="apple-touch-icon" sizes="180x180" href="assets/icon-180.png">`
- PNG favicons/app icons: 32x32, 192x192, and 512x512 icon links.

`index.html` currently does **not** contain:

- `mobile-web-app-capable` meta tag.
- Manifest link.
- Apple startup image / splash screen references.

## 5. Existing PWA Support Found

Search findings:

- `manifest.json`: not present.
- `service-worker.js`: not present.
- `sw.js`: not present.
- `navigator.serviceWorker.register(...)`: not present.
- `beforeinstallprompt` listener: not present.
- Install prompt storage/handler: not present.
- Standalone mode detection via `display-mode: standalone` or `navigator.standalone`: not present.

The new audit-only helper is available as:

```js
window.gridlyPwaInfrastructureAudit?.()
```

It returns these required fields:

- `available`
- `manifestPresent`
- `serviceWorkerPresent`
- `installPromptSupportPresent`
- `themeColorPresent`
- `appleMetaPresent`
- `mobileMetaPresent`
- `iconCandidatesFound`
- `githubPagesCompatible`
- `capacitorCompatible`
- `recommendedNextStep`

## 6. Installability Risks

### Android Chrome

Current blockers:

1. No web app manifest.
2. No manifest link in `index.html`.
3. No service worker.
4. No service-worker registration.
5. No install-prompt handling.
6. No 1024x1024 master app icon export.

Existing positives:

1. Theme color exists.
2. 192x192 and 512x512 icon files exist.
3. Asset paths are relative and favorable for GitHub Pages.

### iOS Safari

Current blockers:

1. No manifest and no standalone display configuration.
2. No Apple startup images / splash screen references.
3. No 1024x1024 master icon export for native/PWA asset generation.
4. No standalone mode detection for home-screen launch polish.

Existing positives:

1. Apple mobile web app capable metadata exists.
2. Apple title exists.
3. Apple status bar style exists.
4. Apple touch icon exists at 180x180.
5. `viewport-fit=cover` is already included in the viewport tag.

## 7. GitHub Pages Risks

Existing compatibility positives:

- CSS path is relative: `css/styles.css?v=128`.
- JavaScript path is relative: `js/app.js?v=1710`.
- Icon paths are relative: `assets/...`.
- Data paths are relative in the current static-file architecture.

Risks for V275 implementation:

1. A future manifest must avoid root-only assumptions. Use a GitHub Pages-safe `start_url` and `scope` strategy.
2. A future service worker must be registered from a path whose scope matches the deployed app path.
3. Future cache entries should avoid root-absolute URLs unless deployment is guaranteed at domain root.
4. Query-string cache-busting on CSS/JS should be included deliberately in any cache strategy.

## 8. Capacitor Risks

Current architecture is compatible with Capacitor in principle because it is a static HTML/CSS/JS app with relative local assets.

Potential blockers or follow-up checks:

1. Leaflet CSS/JS currently load from a CDN, so native packaging should either require network availability or vendor those assets locally before offline expectations are introduced.
2. Live map tiles, route intelligence, Supabase, and TxDOT feeds require network access and native network permissions.
3. Geolocation paths need native permission validation during Capacitor packaging.
4. PWA service-worker code should not be assumed to provide native offline behavior inside Capacitor without separate validation.

## 9. Missing Requirements

Required before PWA installability:

1. `manifest.json`.
2. Manifest link in `index.html`.
3. Service worker file.
4. Service-worker registration code.
5. Install prompt listener / handler.
6. Standalone mode detection.
7. 1024x1024 square app icon master export.
8. `mobile-web-app-capable` meta tag, if the team wants explicit Chromium mobile metadata in addition to the manifest.
9. Optional iOS splash/startup images if the team wants a polished iOS home-screen launch.

## 10. Exact Files That Would Need Creation

For implementation later, not in this audit:

1. `manifest.json`
2. `service-worker.js` or `sw.js`
3. `assets/icon-1024.png`
4. Optional maskable icon exports, for example `assets/icon-maskable-192.png` and `assets/icon-maskable-512.png`
5. Optional iOS startup image assets under `assets/`

## 11. Exact Files That Would Need Modification

For implementation later, not in this audit:

1. `index.html` — add manifest link, mobile meta, optional splash references, and service-worker registration script reference if registration is not placed in `js/app.js`.
2. `js/app.js` — add install prompt handling, standalone mode detection, and/or service-worker registration if the implementation chooses this location.
3. `README.md` or a deployment doc — document GitHub Pages PWA deployment assumptions.

This audit modified only:

1. `js/app.js` — added the audit-only helper.
2. `docs/audits/GRIDLY_V275_PWA_INFRASTRUCTURE_AUDIT.md` — captured this audit report.

## 12. Recommended V275 Implementation Order

1. Approve app icon master source.
2. Export `assets/icon-1024.png` and any required maskable icons.
3. Create `manifest.json` with GitHub Pages-safe `start_url`, `scope`, `display`, `theme_color`, `background_color`, and icons.
4. Add manifest and mobile metadata to `index.html`.
5. Create service worker with conservative static asset caching.
6. Register service worker after load with safe failure handling.
7. Add install prompt handling without changing primary user workflows.
8. Add standalone mode detection for polish only.
9. Validate Android Chrome installability.
10. Validate iOS Safari Add to Home Screen behavior.
11. Re-run `window.gridlyPwaInfrastructureAudit?.()` and update readiness score.

## Audit Helper Expected Result Today

Expected current return shape includes:

```js
{
  available: true,
  manifestPresent: false,
  serviceWorkerPresent: false,
  installPromptSupportPresent: false,
  themeColorPresent: true,
  appleMetaPresent: true,
  mobileMetaPresent: false,
  iconCandidatesFound: true,
  githubPagesCompatible: true,
  capacitorCompatible: true,
  recommendedNextStep: "Create the V275 PWA foundation in order: manifest, square icon exports, GitHub Pages-safe service worker, registration, then install UX validation."
}
```
