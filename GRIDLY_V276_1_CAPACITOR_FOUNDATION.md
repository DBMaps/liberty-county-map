# GRIDLY V276.1 — Capacitor Foundation

## Objective

V276.1 creates the minimum Capacitor foundation needed for future iOS and Android packaging while preserving Gridly's existing web/PWA behavior.

Gridly remains:

1. Awareness Platform First
2. Route Intelligence Second

No reporting, Route Watch, Awareness, Community Pulse, Supabase, notification, background location, county, PWA behavior, or visual workflow changes are included in this phase.

## Packages Installed

The project now declares Capacitor packages in `package.json`:

- `@capacitor/core` — runtime foundation.
- `@capacitor/cli` — local Capacitor CLI.
- `@capacitor/ios` — required Capacitor iOS platform package for the generated shell.
- `@capacitor/android` — required Capacitor Android platform package for the generated shell.

No optional native plugins were added.

## Capacitor Version

Capacitor version selected for this foundation: `8.3.4`.

This version is pinned across core, CLI, iOS, and Android package declarations so future native setup uses a single Capacitor line.

## Capacitor Config Values

Configuration file: `capacitor.config.json`

```json
{
  "appId": "com.gridly.app",
  "appName": "Gridly",
  "webDir": ".",
  "bundledWebRuntime": false
}
```

### Assumptions

- Gridly currently ships as a static web application from the repository root, so `webDir` is set to `.`.
- Future build tooling may replace `webDir` with a dedicated output directory if Gridly later introduces a build step.
- `bundledWebRuntime` is explicitly retained as `false` because the phase request required it.

## iOS Shell Status

Status: present.

The `ios/App` shell has been added with the baseline Capacitor app identity values only.

This phase does not customize iOS build settings, add push notifications, add native logic, add optional plugins, or alter web behavior.

## Android Shell Status

Status: present.

The `android` shell has been added with the baseline Capacitor app identity values only.

This phase does not add optional plugins, push notifications, background services, background location, native logic, or workflow changes.

## Service Worker Review

Current handling remains unchanged.

- `index.html` continues to load the existing PWA manifest.
- `js/app.js` continues to register the existing service worker path.
- `service-worker.js` continues to cache the current Gridly shell URLs and serve navigation fallback when offline.

Recommendation only: if future Capacitor WebView testing shows stale shell delivery or conflicts with native update expectations, add Capacitor-only service worker gating in a later phase. Do not implement that gating in V276.1.

## Audit Helper

V276.1 adds:

```js
window.gridlyCapacitorFoundationAudit?.()
```

Expected result:

```js
window.gridlyCapacitorFoundationAudit?.().safeForNativePackaging === true
```

The helper reports:

- `available`
- `capacitorConfigured`
- `iosShellPresent`
- `androidShellPresent`
- `appIdConfigured`
- `appNameConfigured`
- `webDirConfigured`
- `pwaFoundationDetected`
- `safeForNativePackaging`
- `majorBlockers`

## Known Limitations

- Shells are foundation-only and are not App Store or Play Store ready.
- Native icons, splash screens, signing, provisioning, bundle versioning, release build types, and store metadata remain future work.
- No native geolocation plugin is configured yet; current browser geolocation behavior remains unchanged.
- No notification or background location capability is configured.
- External map, routing, geocoding, and Supabase dependencies still require network availability and native policy review before production app-store packaging.
- The current service worker is intentionally unchanged and should be retested inside Capacitor WebViews before release packaging.

## Future Plugin Plan

Future plugin work should be separated into explicit phases and only added after web behavior baselines are validated:

1. App lifecycle plugin, if needed for foreground/background state awareness.
2. Device/platform metadata plugin, if needed for diagnostics.
3. Geolocation plugin, if native permission prompts are required.
4. Push notifications only after notification product scope, permissions copy, backend delivery, and unsubscribe behavior are approved.
5. Background location only if a future product phase explicitly approves it.

## Future TestFlight Path

1. Install dependencies from the pinned Capacitor package set.
2. Run Capacitor config validation.
3. Run `npx cap sync ios`.
4. Open `ios/App` in Xcode.
5. Configure signing, bundle versioning, app icons, launch assets, and required privacy strings.
6. Test the shell on simulator and physical iPhone.
7. Validate service worker behavior in the iOS WebView.
8. Archive and upload to App Store Connect.
9. Distribute through TestFlight to internal testers first.

## Future Google Closed Testing Path

1. Install dependencies from the pinned Capacitor package set.
2. Run Capacitor config validation.
3. Run `npx cap sync android`.
4. Open `android` in Android Studio.
5. Configure signing, version code/name, app icons, adaptive icons, and release build settings.
6. Test the shell on emulator and physical Android device.
7. Validate service worker behavior in the Android WebView.
8. Build an Android App Bundle.
9. Upload to Google Play Console and start a Closed Testing track.
