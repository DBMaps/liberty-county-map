# Gridly V275.1 PWA Foundation Implementation

## Text-only recovery

This recovery recreates the V275.1 PWA Foundation without adding, copying, modifying, or committing PNG files. Existing production icons are referenced directly from their current repository locations so the PR remains text-only.

## What was added

V275.1 adds a conservative PWA foundation for Gridly while keeping the product visually and behaviorally unchanged. The implementation supports installability readiness, basic shell caching, safe standalone detection, and a browser-callable readiness audit.

No notifications, background location, offline reporting, offline Route Watch, background sync, Capacitor runtime, county expansion, workflow changes, architecture rewrites, or new frameworks were added.

## Manifest details

A root-level `manifest.json` was added for GitHub Pages-compatible PWA discovery.

Manifest values:

- `name`: `Gridly`
- `short_name`: `Gridly`
- `description`: `Know Before You Go`
- `display`: `standalone`
- `start_url`: `./`
- `scope`: `./`
- `background_color`: `#050505`
- `theme_color`: `#071426`
- Icons:
  - `./assets/icon-192.png`
  - `./assets/icon-512.png`
  - `./assets/icon-512.png` with `purpose: maskable`

The manifest background color follows the production app background, while the existing production theme color from `index.html` remains the source of truth for the manifest `theme_color`.

## PWA icon foundation

A new `assets/icons/` folder establishes a text-only planning and inventory location for current PWA usage and future native packaging.

Current manifest icons reuse existing Gridly production assets in place:

- `assets/icon-192.png` is referenced directly for the 192x192 icon.
- `assets/icon-512.png` is referenced directly for the 512x512 and maskable placeholder icons.

No `assets/icons/icon-192.png`, `assets/icons/icon-512.png`, or other binary icon files were added.

Supporting notes are documented in:

- `assets/icons/README.md`
- `assets/icons/app-icon-inventory.json`

Future brand-approved exports can add a 1024x1024 source icon in a later binary-safe phase without changing the app workflow.

## Service worker scope

A root-level `service-worker.js` was added and registered with scope `./`.

The service worker is intentionally small. It supports:

- PWA installability requirements.
- Basic same-origin shell caching.
- Navigation fallback to cached `index.html` only when the network request fails.
- Network-first refresh for explicitly listed shell assets.

The service worker does not cache or intercept cross-origin Supabase, Leaflet CDN, jsDelivr, TxDOT/FRA, or other external network calls. It also does not add background sync, notifications, offline reports, offline Route Watch, or background location.

## GitHub Pages considerations

All new PWA paths are relative and GitHub Pages safe:

- Manifest link: `manifest.json`
- Service worker registration: `./service-worker.js`
- Service worker scope: `./`
- Manifest start URL: `./`
- Manifest scope: `./`
- Manifest icon paths: `./assets/icon-192.png` and `./assets/icon-512.png`

No absolute root paths were introduced for PWA assets.

## Installability notes

Gridly now listens for `beforeinstallprompt`, stores the event, and records readiness state on `window.gridlyPwaInstallReadinessState`.

This phase deliberately does not auto-prompt users and does not add any install button, banner, toast, modal, or other user-facing install UI.

## Standalone detection

`window.gridlyIsStandaloneMode()` was added as a safe helper. It checks:

- iOS Safari `navigator.standalone`
- CSS display mode via `(display-mode: standalone)`

The helper does not alter visual behavior.

## Readiness audit

`window.gridlyPwaReadinessAudit?.()` returns:

- `available`
- `manifestDetected`
- `serviceWorkerDetected`
- `serviceWorkerRegistered`
- `installPromptSupportReady`
- `themeColorPresent`
- `appleMetaPresent`
- `mobileMetaPresent`
- `iconSetDetected`
- `standaloneSupported`
- `githubPagesCompatible`
- `safeForCapacitorPhase`

The target value for this phase is:

```js
window.gridlyPwaReadinessAudit?.().safeForCapacitorPhase === true
```

`serviceWorkerRegistered` becomes true after the browser successfully completes registration. `installPromptSupportReady` becomes true only after a supported browser emits `beforeinstallprompt`.

## Known limitations

- No offline reporting is available.
- No offline Route Watch is available.
- No background sync is available.
- No notification delivery is available.
- No background location behavior is available.
- The maskable icon entry references the existing `assets/icon-512.png` production icon until a dedicated maskable safe-zone export is approved.
- Install prompt UI is intentionally not exposed in this phase.

## Future Capacitor transition notes

This foundation keeps the web app aligned for a later Capacitor phase by preserving relative paths, standalone-ready metadata, app icon inventory, and a simple service worker boundary. A future native transition should still perform platform-specific icon generation, splash screen setup, permission review, store listing preparation, and native QA.
