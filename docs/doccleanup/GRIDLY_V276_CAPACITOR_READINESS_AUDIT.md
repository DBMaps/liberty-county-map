# GRIDLY V276.0 — Capacitor Readiness Audit

## Executive finding

Gridly is ready to begin a separate Capacitor foundation phase. The current app is a static, single-page web application with a PWA foundation, relative local assets, and no native-only runtime requirement that blocks initial Capacitor packaging.

**Readiness score:** 86 / 100

**Safe to begin Capacitor phase:** Yes.

**Major blockers:** None for starting the Capacitor foundation phase.

**Important boundary:** This audit did not install Capacitor, add dependencies, modify `package.json`, create iOS/Android projects, modify workflows, add notifications, add counties, or add Capacitor runtime files.

## Files reviewed

- `index.html`
- `js/app.js`
- `css/styles.css`
- `manifest.json`
- `service-worker.js`

## 1. Current architecture audit

### Single-page suitability

Gridly is suitable for Capacitor packaging as a single-page app:

- `index.html` owns the app shell, route/report/alert/settings surfaces, manifest reference, icons, and script loading.
- `js/app.js` owns runtime behavior, data loading, local state, map rendering, Supabase integration, PWA install UX, and audit helpers.
- `css/styles.css` is local and does not import remote fonts or remote CSS.
- `manifest.json` uses relative scope/start URL and relative icon paths.
- `service-worker.js` caches same-origin shell assets and ignores cross-origin requests.

### Capacitor compatibility

Compatible for an initial native shell because:

- App assets are static and can be copied into a Capacitor `webDir` later.
- Runtime does not require server-side rendering.
- Core navigation is DOM/state driven rather than path-router dependent.
- Manifest and service worker are PWA-specific but do not block a WebView shell.
- External services are all HTTPS-based.

### Runtime assumptions

Current runtime assumes:

- Browser globals are available (`window`, `document`, `navigator`, `localStorage`, `sessionStorage`).
- Leaflet is loaded globally as `L` before `js/app.js` runs.
- Supabase JS is loaded globally as `window.supabase` before `initSupabase()`.
- Network access is available for map tiles, routing/geocoding, Supabase, and public data feeds.
- Geolocation is available through `navigator.geolocation` for current-location flows.
- Web Share may be available through `navigator.share`, but is optional.

These assumptions are generally compatible with Capacitor, with the caveat that production native packaging should move from browser/CDN globals toward bundled or vendored assets where practical.

## 2. External dependency audit

| Dependency | Current source | Capacitor status | Recommendation |
| --- | --- | --- | --- |
| Leaflet CSS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` | Risky | Vendor or bundle before production native packaging to avoid CDN startup dependency. |
| Leaflet JS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` | Risky | Vendor or bundle before production native packaging. |
| Supabase JS | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` | Risky | Vendor/bundle later; keep CDN only for web/PWA beta if acceptable. |
| Supabase project API | `https://nhwhkbkludzkuyxmkkcj.supabase.co` | Safe with network dependency | Review RLS/key policy and offline behavior before app-store release. |
| OpenStreetMap standard tiles | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Risky | Confirm tile usage policy for native app usage and add fallback/caching plan. |
| CARTO base/label tiles | `https://{s}.basemaps.cartocdn.com/...` | Risky | Confirm native usage terms and availability expectations. |
| Esri imagery tiles | `https://server.arcgisonline.com/...` | Risky | Confirm native usage terms and fallback behavior. |
| OSRM route/nearest APIs | `https://router.project-osrm.org` | Risky | Public demo routing service is not a production native dependency; plan a production routing provider/service. |
| Nominatim geocoding/reverse geocoding | `https://nominatim.openstreetmap.org` | Risky | Replace or validate against usage policy before native scale. |
| FRA / transportation.gov crossings | `https://data.transportation.gov/resource/m2f8-22s6.geojson...` | Safe | Prefer cached/static county extracts for reliability. |
| TxDOT DriveTexas optional feed | `https://api.drivetexas.org/api/conditions.geojson` | Safe when configured | Requires API key in local config and graceful unavailable state. |
| Zippopotam.us ZIP lookup | `https://api.zippopotam.us/us/{zip}` | Safe but non-critical | Keep fallback data path for offline/unavailable state. |
| Local images/icons/markers | `assets/...` | Safe | Include in Capacitor web output. |
| Local GeoJSON | `data/...` | Safe | Include in Capacitor web output. |
| Fonts | System stack only | Safe | No remote font packaging issue detected. |

## 3. Permission audit

| Permission/API | Current use | Capacitor concern |
| --- | --- | --- |
| Geolocation | Used through `navigator.geolocation.getCurrentPosition()` for current-location route/report flows. | Future Capacitor geolocation plugin should add iOS `NSLocationWhenInUseUsageDescription` and Android foreground location permissions. No background location is currently used. |
| Camera | Not used. | No current native camera permission needed. |
| Notifications | Preference/architecture UI exists, but no active push delivery and no `Notification.requestPermission()` flow was detected. | Future push notifications require explicit native plugin setup, consent copy, APNs/FCM, quiet-hour/targeting policy, and app-store privacy review. |
| Background location | Not used. | Do not add unless a separate product/privacy phase requires it. |
| Share | Optional Web Share API via `navigator.share`. | Capacitor Share plugin is optional later for consistent native sharing. |
| Network | Required for map tiles, routing/geocoding, Supabase, TxDOT, and public data feeds. | Native shells need standard network access; offline UX should be explicit. |

## 4. Storage audit

### Current storage surfaces

- `localStorage` is used for device/user/profile/settings/route/map style/welcome/feedback/review/smart alert preferences and other client state.
- `sessionStorage` is used for session-level prompt guarding.
- Supabase persists shared reports and live updates.
- County-aware helpers exist for active county metadata and future county-scoped keys.
- IndexedDB is not a current dependency.

### Capacitor concerns

- `localStorage` generally works inside Capacitor WebViews, but it should not be treated as the only long-term source of truth for critical data.
- Future native work should decide whether critical preferences, saved places, or offline queues move to Capacitor Preferences / SQLite / filesystem-backed storage.
- County-aware storage is prepared but should be migrated carefully so Liberty County beta users do not lose existing global keys.
- Supabase persistence is network-backed and should keep graceful degraded states for native offline usage.

## 5. Service worker audit

### Current behavior

`service-worker.js`:

- Caches the app shell (`./`, `index.html`, CSS, JS, manifest, icons, logo).
- Deletes older `gridly-pwa-shell-*` caches on activate.
- Handles same-origin navigations with an `index.html` fallback.
- Ignores cross-origin map/data/API requests.

### Recommendation

- **Web/PWA build:** Keep the service worker.
- **Initial Capacitor experiment:** It can remain during early audit/build validation, but monitor WebView cache/update behavior.
- **Production Capacitor build:** Consider gating registration or unregistering inside Capacitor if native update behavior conflicts with service worker caching.

No immediate service worker change is required for starting the Capacitor phase.

## 6. PWA compatibility audit

`window.gridlyPwaReadinessAudit?.()` and `window.gridlyPwaInstallUxAudit?.()` are compatible with a future Capacitor phase because they are audit/install-UX helpers and do not require native functionality.

Potential future consideration:

- Install UX should be hidden or neutralized inside a Capacitor shell because native app users should not see browser PWA install prompts.
- Service worker registration may need a runtime guard inside Capacitor if native update/caching tests show stale shell behavior.

No current PWA implementation creates a hard Capacitor conflict.

## 7. Native plugin audit

### Required for production native parity

1. **Capacitor Geolocation**
   - Required if current-location route/report behavior must work consistently in native shells.

### Optional for first native shell

1. **Capacitor Share**
   - Provides consistent native sharing for existing share actions.
2. **Capacitor Preferences**
   - Useful for hardened native persistence of settings/profile/saved places.
3. **Capacitor App**
   - Useful for lifecycle events, app state, and back-button handling.
4. **Capacitor Browser / App Launcher**
   - Useful if external links need explicit native handling.

### Future / separate product phase

1. **Push Notifications**
   - Only after targeting, consent, throttling, quiet hours, and APNs/FCM architecture are defined.
2. **Local Notifications**
   - Only if on-device reminders/alerts become a separate scoped feature.
3. **Background Geolocation**
   - Not recommended now; high privacy/store-review burden and not required by current runtime.
4. **Filesystem / SQLite**
   - Only if offline-first report queues or larger native caches become required.

## 8. Build readiness audit

### iOS build generation readiness

Ready to start after a separate Capacitor setup phase. Expected future work:

1. Add Capacitor dependencies and config.
2. Define `webDir` for this static app.
3. Add iOS project.
4. Add location usage description before geolocation plugin testing.
5. Validate safe-area, viewport, keyboard, and WebView caching behavior.

### Android build generation readiness

Ready to start after a separate Capacitor setup phase. Expected future work:

1. Add Capacitor dependencies and config.
2. Define `webDir` for this static app.
3. Add Android project.
4. Add foreground location permissions before geolocation plugin testing.
5. Validate hardware back behavior, viewport, network security, and WebView caching behavior.

### Blockers

No major blockers were found for beginning the Capacitor foundation phase.

## Audit helper

Added:

```js
window.gridlyCapacitorReadinessAudit?.()
```

Expected key result:

```js
window.gridlyCapacitorReadinessAudit?.().safeToBeginCapacitorPhase === true
```

Returned fields:

- `available`
- `pwaFoundationDetected`
- `manifestDetected`
- `serviceWorkerDetected`
- `externalDependenciesReviewed`
- `permissionInventoryComplete`
- `storageAuditComplete`
- `capacitorCompatible`
- `majorBlockers`
- `recommendedNextStep`
- `safeToBeginCapacitorPhase`

## Risks

1. CDN reliance for Leaflet and Supabase JS can cause blank/partial native startup if offline or blocked.
2. Public routing/geocoding/tile endpoints may not be suitable for scaled native distribution without provider review.
3. Service worker caching can conflict with native update expectations if not gated after native validation.
4. `localStorage` is acceptable for early packaging but should be revisited for critical native persistence.
5. Geolocation currently uses browser APIs; native plugin parity requires permission string and platform validation.

## Recommended implementation order

1. Create a separate Capacitor foundation branch/phase.
2. Add Capacitor packages and config only in that phase.
3. Define static web output / `webDir` without altering app behavior.
4. Generate iOS and Android shells.
5. Validate app launch, viewport, safe areas, service worker behavior, and asset loading.
6. Add Capacitor Geolocation and platform permission strings.
7. Test route/report current-location flows on device.
8. Decide whether to vendor Leaflet/Supabase and replace public demo routing/geocoding services.
9. Add optional Share/App/Preferences plugins if native QA justifies them.
10. Leave Push Notifications and Background Location for separate scoped product/privacy phases.

## Final recommendation

Merge this audit and proceed to the Capacitor foundation phase. The current app is ready for native shell experimentation, with no major blockers, as long as dependency vendoring, geolocation plugin setup, and service worker behavior are handled deliberately in later implementation phases.
