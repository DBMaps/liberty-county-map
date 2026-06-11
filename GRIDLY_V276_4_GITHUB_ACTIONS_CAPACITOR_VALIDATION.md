# GRIDLY V276.4 — GitHub Actions Capacitor Validation

## Why GitHub Actions is needed

The Codex runner cannot currently complete npm-based Capacitor validation because npm registry access is blocked by a registry `403` response in that environment. GitHub Actions runs the validation inside GitHub-hosted infrastructure, where the repository can perform `npm install` and execute Capacitor commands as part of pull request and manual validation.

This keeps the validation out of the app runtime and avoids changing app behavior, source logic, features, notifications, plugins, or county data.

## What the workflow validates

The `.github/workflows/capacitor-validation.yml` workflow validates the Capacitor foundation by running these checks on `ubuntu-latest`:

1. Checks out the repository.
2. Sets up Node.js.
3. Runs `npm install` to verify npm dependencies can be installed.
4. Runs `npx cap doctor` to inspect the Capacitor project setup.
5. Runs `npx cap sync android` to verify Android Capacitor sync succeeds.
6. Runs `node --check js/app.js` to verify app JavaScript syntax.
7. Runs `node --check service-worker.js` when `service-worker.js` exists.
8. Parses and validates `capacitor.config.json`.
9. Parses and validates `manifest.json`.

## Why Android is validated first

Android validation is the correct first mobile platform check for this Linux workflow because Android Capacitor sync can run on `ubuntu-latest`. It provides a practical foundation check that npm dependencies install correctly, Capacitor CLI can inspect the project, and the Android native project can be synchronized from the web app assets and configuration.

## Why iOS validation is deferred to a macOS runner

This workflow intentionally does not run iOS sync on Linux. iOS validation usually requires a macOS runner with Apple tooling such as Xcode and CocoaPods. A future dedicated macOS workflow should validate iOS once the project is ready for that platform-specific CI path.

## How to run the workflow manually from GitHub

1. Open the repository on GitHub.
2. Select the **Actions** tab.
3. In the left sidebar, choose **Capacitor Validation**.
4. Select **Run workflow**.
5. Choose the branch to validate.
6. Click **Run workflow** to start the validation job.
7. Open the workflow run to view each step and its logs.

## What pass/fail means

### Pass

A passing workflow means GitHub Actions was able to install npm dependencies, run Capacitor doctor, sync the Android Capacitor project, verify JavaScript syntax for the app and service worker, and parse the key Capacitor/PWA configuration files.

### Fail

A failing workflow means one or more foundation checks did not complete successfully. The failed step identifies the area to inspect, such as npm dependency installation, Capacitor project health, Android sync, JavaScript syntax, or JSON configuration validity.

A failure does not automatically mean app behavior changed. It means the Capacitor validation path needs investigation before merging or before relying on that branch for mobile packaging work.
