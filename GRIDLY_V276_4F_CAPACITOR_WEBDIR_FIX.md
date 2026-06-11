# GRIDLY V276.4F — Capacitor webDir Fix

## Why `"."` failed

Capacitor 8 rejects root-directory web asset targets such as `"."`, `"./"`, `".."`, and empty strings during `npx cap doctor` validation. Gridly previously used `"webDir": "."` so the existing static web app root could be copied directly, but that value is not accepted by the Capacitor CLI even when the root contains a valid `index.html`.

## New webDir choice

Gridly now uses:

```json
"webDir": "www"
```

`www` is Capacitor's default web asset directory when no framework-specific build output is configured. It is a dedicated output directory instead of the repository root, which keeps Capacitor validation aligned with the CLI's expected project shape.

## Why `www` is compatible with Gridly

Gridly is currently a static web application with root-level runtime assets:

- `index.html`
- `manifest.json`
- `service-worker.js`
- `css/`
- `js/`
- `assets/`
- `data/`

The GitHub Actions Capacitor validation workflow now stages those existing assets into `www/` before running Capacitor commands. It also mirrors that staged bundle into Android's `assets/public/` directory before `npx cap doctor`, because Android doctor validation expects a native project web asset snapshot with `index.html` to already exist. This preserves the current browser app source layout and avoids changing Gridly runtime behavior, reporting, Route Watch, Awareness, plugins, notifications, counties, or application architecture.

## Impact on future Capacitor packaging

Future native packaging should treat `www/` as the generated Capacitor web output directory. Before running `npx cap sync`, the current Gridly static web assets should be copied or built into `www/` so Android and iOS receive the same packaged web bundle.

This change also makes the native project snapshots consistent with the root Capacitor config:

- `capacitor.config.json`
- `android/capacitor.config.json`
- `ios/App/App/capacitor.config.json`

## Why Xcode is not a Linux CI blocker

The validation workflow runs on `ubuntu-latest`. Xcode is only available on macOS runners, so Capacitor may report that Xcode is not installed when iOS tooling is inspected from Linux. That message is expected in this workflow and is not the blocking failure.

The blocking issue was the invalid root `webDir` value. Linux CI should validate the shared Capacitor configuration and Android sync path, while full iOS sync/build validation should remain a future macOS workflow concern.
