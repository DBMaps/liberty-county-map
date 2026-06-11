# GRIDLY V276.4C — Text-Only Android Capacitor Shell Completeness Recovery

## What failed

GitHub Actions advanced to running Capacitor validation under Node 22, but `npx cap doctor` still failed because the Android shell was incomplete:

- `android/gradlew` was missing.
- `android/app/src/main/assets` was missing.

The repository already had the baseline Android project files from the V276.1 Capacitor foundation, including Gradle project files, `AndroidManifest.xml`, resources, and the Capacitor bridge activity. The missing generated wrapper/assets pieces prevented Capacitor from recognizing the Android project as a complete sync target.

## What was added

This text-only recovery keeps the minimum Android shell pieces required by Capacitor validation while avoiding binary files in git:

- Added the Gradle wrapper launcher scripts:
  - `android/gradlew`
  - `android/gradlew.bat`
- Kept the Gradle wrapper metadata:
  - `android/gradle/wrapper/gradle-wrapper.properties`
- Intentionally did not commit the Gradle wrapper bootstrap jar:
  - `android/gradle/wrapper/gradle-wrapper.jar`
- Added the Android asset directory placeholder:
  - `android/app/src/main/assets/.gitkeep`

No application behavior, PWA behavior, county data, notifications, plugins, or feature code was changed. The Capacitor validation workflow now restores the wrapper jar during CI before Android validation, because Codex PR creation fails on committed binary files.

## Why these files are required

Capacitor expects the Android platform directory to look like a generated Android project, not only a partial collection of Gradle files.

- `android/gradlew` lets Capacitor and CI invoke the Android Gradle project from the platform directory without relying on a globally installed Gradle binary.
- `android/gradle/wrapper/gradle-wrapper.properties` pins the Gradle distribution used by the wrapper so CI and local validation run the same Gradle version.
- `android/gradle/wrapper/gradle-wrapper.jar` is the wrapper bootstrap used by the `gradlew` scripts, but it is intentionally not committed in this recovery because Codex PR creation fails on binary files.
- GitHub Actions should generate or restore `android/gradle/wrapper/gradle-wrapper.jar` before Android validation. If needed, the workflow should install or use system Gradle to generate wrapper artifacts during CI rather than storing the binary in git.
- `android/app/src/main/assets` is the native Android assets location Capacitor sync uses when preparing bundled web assets for the Android app.

## What GitHub Actions should verify next

After this patch is merged, rerun the Capacitor validation workflow and confirm it first restores the text-only wrapper jar artifact during CI, then reaches the intended validation commands:

```bash
npm install
npx cap doctor
npx cap sync android
```

The rerun should no longer fail on the missing Android Gradle wrapper or missing Android assets directory checks. It should also create `android/gradle/wrapper/gradle-wrapper.jar` inside the CI workspace before Capacitor validation without committing that binary file to git. If a later failure appears, it should be treated as the next validation stage rather than the V276.4C text-only shell-completeness recovery issue.
