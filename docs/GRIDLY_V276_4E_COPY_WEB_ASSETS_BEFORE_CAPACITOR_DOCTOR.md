# GRIDLY V276.4E — Copy Web Assets Before Capacitor Doctor

## Failure message

GitHub Actions Capacitor Validation reached the Android public assets directory, then failed during `npx cap doctor` with:

```text
Error: index.html file is missing in /home/runner/work/liberty-county-map/liberty-county-map/android/app/src/main/assets/public
```

## Why CI must populate Android public assets before doctor/sync

Capacitor validates the configured web output directory during `npx cap doctor`. In this project, the Android assets destination is `android/app/src/main/assets/public`. The directory may exist in the repository as a placeholder, but CI starts from a clean checkout and does not have a generated or synchronized web bundle in that Android location until the workflow creates it.

The validation workflow therefore refreshes `android/app/src/main/assets/public` immediately before running `npx cap doctor`, ensuring the required `index.html` and supporting web shell files are available for both doctor validation and the following `npx cap sync android` step.

## What is copied

The workflow copies the root Gridly web shell into `android/app/src/main/assets/public` in CI:

- `index.html`
- `manifest.json`
- `service-worker.js`
- `css/`
- `js/`
- `assets/`

The copy step removes the previous CI-generated Android public assets directory first, recreates it, then copies the required files and directories from the repository root.

## Why copied assets are not committed

The Android public assets directory is generated output for Capacitor validation/sync. Committing copied web assets there would duplicate the root web app, increase review noise, and risk drift between the source web shell and the Android copy. Keeping the copy CI-only preserves a single source of truth while still giving Capacitor the files it expects during validation.
