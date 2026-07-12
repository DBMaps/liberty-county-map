# Gridly L001 Beta Closure Audit

## Public Entry Page

The previous public entry was the full Gridly application shell in `index.html`, including app layout, map surfaces, navigation, controls, Leaflet CSS/JS, Supabase JS, package/runtime scripts, and `js/app.js`.

The current public entry is a standalone beta-closure page. It does not include the former app shell, map container, report surfaces, Alerts, Search, Settings, Route Watch, or install/download call to action.

## Application Script Suppression

`index.html` no longer references `js/app.js`. It also no longer references Leaflet, Supabase, crossing runtime scripts, county package loaders, report hydration, awareness runtime, map runtime, or application startup scripts.

## Service-worker Behavior

The former service worker used `gridly-pwa-shell-v929-startup-diagnostics` and precached the application shell, stylesheet, `js/app.js`, startup diagnostics, service scripts, manifest, icons, and brand assets.

The current service worker uses `gridly-beta-closure-v1`, precaches only the closure entry, manifest, selected icons, and the Gridly logo, and claims clients after activation.

## Cache Cleanup

Activation deletes recognized old Gridly application shell caches matching `gridly-pwa-shell-*` and older closure caches matching `gridly-beta-closure-*` except the current closure cache. The closure page also runs bounded cache cleanup for the same recognized cache names. It does not clear unrelated browser storage.

## PWA-installed User Behavior

The manifest still starts at `./`, so installed PWA users open the public root. While online, navigation is network-first with `cache: "no-store"`, causing the closure page to replace the old app shell as the active public entry. If the closure service worker has already installed and the network is unavailable, the cached closure page is the fallback.

## Backend Data Preservation

No Supabase migrations, backend schemas, tables, records, storage objects, or report-writing logic were changed. No backend data deletion was added.

## Public Beta Access Status

The public GitHub Pages URL exposes only the closure page from the root entry. No active beta archive page was created.

## Desktop/Landscape Gates

The closure page is readable on desktop and landscape displays, but neither desktop nor landscape can access the Gridly application from the public entry because the application shell and startup scripts are absent.

## Safe Launch-transition Status

The public beta is closed, old recognized Gridly app-shell caches are targeted for removal, the application does not initialize from the public URL, and protected runtime systems are preserved for future launch work in source history.
