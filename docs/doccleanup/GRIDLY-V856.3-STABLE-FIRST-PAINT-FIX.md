# Gridly V856.3 — Stable First Paint Fix

## Root cause findings

V856.2 improved the startup choreography after the stylesheet was available, but it did not fully protect the first browser paint. The remaining flash was caused by a timing gap before the external presentation CSS and animation rules could hide or sequence the major surfaces.

Findings:

- **Initial DOM was visible before choreography became authoritative.** The V856.2 rules lived only in `css/styles.css`, so the browser could parse and begin painting the HTML shell before those rules finished loading and before JavaScript could coordinate a stable reveal.
- **Map competition remained possible.** The map and command center were animated later, but the underlying map/card DOM could still occupy a large visible area during the earliest refresh frames if the external CSS path was delayed or cached inconsistently.
- **CSS cache bump mismatch existed.** `index.html` referenced `css/styles.css?v=130`, while `service-worker.js` precached `./css/styles.css?v=129`. That mismatch could allow the service worker shell list to keep an older presentation CSS URL available offline and made verification of the active startup CSS less reliable.
- **No duplicate active stylesheet path was found.** The application uses `css/styles.css`; no active `styles.css` root reference was found in the HTML startup path.
- **Service worker behavior needed a version bump.** The service worker is network-first for matching shell assets, but its shell URL list and cache name must move with presentation CSS revisions so repeat users receive the new first-paint rules.
- **Browser refresh/BFCache was not explicitly handled.** A restored page could skip the normal cold-start visual sequence; V856.3 releases the pre-paint guard on `pageshow` when the page is restored from BFCache.

## What V856.2 changed

V856.2 added presentation-only startup choreography in the main stylesheet: a launch veil, staged reveal animations for chrome, Awareness Brief, map surfaces, secondary surfaces, support cards, and a map readiness veil. It also respected `prefers-reduced-motion` by disabling the animation sequence.

## Why V856.2 was not visually sufficient

The V856.2 guard was not in the earliest HTML/CSS path. Because the veil and hidden/reveal states were delivered by the external stylesheet, a refresh could still expose partially assembled DOM before the stylesheet was applied. The map area also remained visually prominent enough during startup to compete with the Awareness Brief on slower or cached refreshes.

## What V856.3 changed

V856.3 adds a true pre-paint startup guard directly in `index.html` before the external stylesheet reference:

1. The `<html>` element starts with `gridly-prepaint-lock`.
2. A tiny inline critical CSS block provides a dark Gridly launch state and hides major UI surfaces before the external stylesheet is needed.
3. The `<body>` starts with `gridly-startup-guard` so the external CSS can keep surfaces hidden until release.
4. A tiny inline bootstrap script releases the lock after `DOMContentLoaded`, two animation frames, and a short settle delay, then adds `gridly-first-paint-ready`.
5. The external V856.3 CSS scopes reveal animations to `body.gridly-first-paint-ready`, so the Awareness Brief becomes the first meaningful visible content and the map is veiled until later in the sequence.
6. The map frame receives a startup/readiness veil so large empty map space no longer competes during startup.
7. Reduced-motion users receive a stable, non-animated reveal after the pre-paint guard is released.

## Cache/service worker review

- `index.html` now references `css/styles.css?v=131`.
- `service-worker.js` now precaches `./css/styles.css?v=131`.
- The service worker cache name was bumped from `gridly-pwa-shell-v278-1b` to `gridly-pwa-shell-v279-v856-3`.
- The app script URL was bumped to `js/app.js?v=1714` in both `index.html` and the service worker shell list to keep the app shell revision coherent.
- No active duplicate root `styles.css` reference was found in the startup path.

## Mobile portrait validation notes

V856.3 specifically hides mobile chrome, mobile home cards, the mobile bottom nav, and map/command surfaces during the pre-paint lock. In mobile portrait, the launch state should be the first visible state, followed by the Awareness Brief/home content, with map surfaces delayed and veiled instead of showing a large unfinished map space.

## Regression review

Protected systems were not changed:

- Community Reports behavior was not modified.
- Unified Intelligence behavior was not modified.
- DriveTexas behavior was not modified.
- Weather Provider behavior was not modified.
- Cross Provider Evaluation behavior was not modified.
- Reporting behavior was not modified.
- Route Watch behavior was not modified.
- Supabase behavior was not modified.
- Hazard lifecycle, provider polling, runtime data loading, and feature flags were not modified.

Changes are limited to startup presentation CSS/HTML, cache version references, and documentation.

## Exact testing steps

1. Run `git diff --check`.
2. Confirm `index.html` references `css/styles.css?v=131`.
3. Confirm `service-worker.js` precaches `./css/styles.css?v=131` and uses cache `gridly-pwa-shell-v279-v856-3`.
4. Start a local static server from the repository root, for example `python3 -m http.server 4173`.
5. Open `http://127.0.0.1:4173/` in a desktop browser.
6. Hard refresh repeatedly with DevTools open and verify no unfinished assembled UI appears before the launch/brief state.
7. In DevTools responsive mode, set a mobile portrait viewport such as 390×844 and hard refresh repeatedly.
8. Verify the Awareness Brief is the first meaningful content after the launch guard.
9. Verify the map does not show a large empty surface or visually compete during startup.
10. Enable reduced motion in the browser/OS emulation and verify the interface becomes stable without staged animation.
11. If a service worker is already installed, use DevTools Application → Service Workers → Update/Unregister or hard refresh with cache disabled once, then verify the new cache name appears.

## Merge recommendation

Merge recommended after desktop and mobile portrait hard-refresh validation. The change is presentation-only, addresses the V856.2 first-paint timing gap, and includes the required cache/service-worker bump so repeat users receive the corrected startup CSS.
