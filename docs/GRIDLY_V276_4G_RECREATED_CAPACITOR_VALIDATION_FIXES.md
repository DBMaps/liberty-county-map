# Gridly V276.4G — Recreated Capacitor Validation Fixes

## Why this clean PR was created

GitHub Actions continued reporting the stale Capacitor validation error:

```text
"." is not a valid value for webDir
```

This clean PR re-applies the last two Capacitor validation fixes together from the current branch state so the validation workflow, root Capacitor config, Android snapshot, and iOS snapshot all agree on the same generated web output directory.

## What was re-applied

### 1. GitHub Actions asset copy fix

The Capacitor validation workflow now prepares the web assets that Capacitor expects during CI before running Capacitor commands:

- Removes any previous generated `www` output and Android public web asset mirror.
- Creates a fresh `www` directory.
- Copies Gridly web entry files into `www`.
- Copies Gridly web folders into `www`.
- Mirrors `www` into `android/app/src/main/assets/public` for the Android Capacitor project.
- Runs `npx cap doctor` after the generated web output exists.
- Ignores only the expected Linux CI Xcode warning.
- Runs `npx cap sync android` after doctor validation.
- Validates the root, Android, and iOS Capacitor config snapshots.

### 2. Capacitor `webDir` fix

All Capacitor config snapshots use:

```json
"webDir": "www"
```

The aligned files are:

- `capacitor.config.json`
- `android/capacitor.config.json`
- `ios/App/App/capacitor.config.json`

## Why `webDir` must be `www`

Capacitor requires `webDir` to point to a real web output directory, not the repository root. The value `.` is rejected by Capacitor validation, which is why GitHub Actions reported:

```text
"." is not a valid value for webDir
```

Using `www` gives Capacitor a dedicated generated output directory while keeping Gridly's source web files in their existing source locations.

## Why `www` is generated only in CI

Gridly's runnable web source remains in the repository root and source folders such as `css`, `js`, `assets`, and `data`. The `www` directory is a generated Capacitor packaging artifact created during validation and sync.

Keeping `www` generated-only prevents duplicated source assets, avoids stale committed copies, and keeps pull requests focused on source and configuration changes rather than generated output.

## What GitHub Actions should validate

The Capacitor validation workflow should verify that:

1. Node dependencies install successfully.
2. A fresh `www` directory is created during CI.
3. Gridly web files are copied into `www`.
4. `www` is mirrored into `android/app/src/main/assets/public` before Android sync.
5. `npx cap doctor` runs after the generated web output exists.
6. Only the expected Linux Xcode warning is ignored.
7. `npx cap sync android` runs successfully.
8. `js/app.js` passes JavaScript syntax validation.
9. `service-worker.js` passes syntax validation when present.
10. `capacitor.config.json`, `android/capacitor.config.json`, and `ios/App/App/capacitor.config.json` all use `webDir: "www"` and remain aligned.
11. `manifest.json` remains valid JSON with the required PWA fields.

## Generated artifact policy

The following generated artifacts should not be committed:

- `www/`
- Copied files under `android/app/src/main/assets/public/`, except the placeholder `.gitkeep`

The placeholder keeps the Android public assets directory present in the repository while allowing CI to populate it with generated web assets.
