# Gridly native packaging contract

Gridly's permanent application identifier is `com.gridlygo.gridly`. Store versioning is independent of the npm package version:

| Variable | Initial store candidate | Increment rule |
| --- | --- | --- |
| `APP_MARKETING_VERSION` | `1.0.0` | Change for a user-visible release. |
| `IOS_BUILD_NUMBER` | `1` | Increase for every uploaded build of a marketing version. |
| `ANDROID_VERSION_NAME` | `1.0.0` | Keep aligned with the marketing version. |
| `ANDROID_VERSION_CODE` | `1` | Increase for every uploaded Android artifact; never reuse. |

## Shared web bundle

Run `npm run build:native-web`, `npm run verify:native-web`, and `npm run build:native-assets`. Both platforms consume the resulting `www/`; the build deletes the old stage first. The verifier checks required runtime families, legal notices, exactly 86 runtime-v2 POI shards, prohibited local files, and byte/path identity against an independent clean repeat. Native raster outputs are deterministically copied from the pre-existing approved `assets/store/icons/gridly-icon-master-1024.png` and `assets/store/branding/Splash/gridly-splash-portrait.png` masters and are intentionally ignored by Git.

## Android (Windows or other Android development host)

```powershell
npm ci
npm run build:native-web
npm run verify:native-web
npm run build:native-assets
npx cap sync android
cd android
# This repository intentionally omits the binary Gradle wrapper JAR. Use the
# official local Gradle 8.14.4 distribution pinned by wrapper properties.
gradle clean assembleDebug
# Later, after supplying signing inputs outside source control:
gradle bundleRelease
```

The debug APK is under `android/app/build/outputs/apk/debug/`. A release AAB is under `android/app/build/outputs/bundle/release/`. No keystore, alias, or password belongs in this repository.

The tracked wrapper scripts and `gradle-wrapper.properties` do not make
`.\gradlew.bat` executable by themselves because the binary
`android/gradle/wrapper/gradle-wrapper.jar` is deliberately not committed. CI
restores that JAR deterministically by running the pinned Gradle 8.14.4
`wrapper` task in a temporary project. Owner builds should use the existing
official local Gradle 8.14.4 binary distribution as shown above; they must not
download or commit an ad hoc wrapper JAR.

## iOS (owner Mac required)

```bash
npm ci
npm run build:native-web
npm run verify:native-web
npm run build:native-assets
npx cap sync ios
# Capacitor 8 generated this project with Swift Package Manager; no pod install is needed.
# If a later plugin introduces a Podfile, run: (cd ios/App && pod install)
npx cap open ios
# CLI simulator structure/build check:
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator build
# Later archive preparation only (do not upload):
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release -destination 'generic/platform=iOS' archive -archivePath "$PWD/build/Gridly.xcarchive"
```

Select the owner-controlled Apple team and signing profile in Xcode before a device build/archive. The catalogs reuse the repository's existing Gridly web icon/logo assets so the shells build without fabricated artwork; the owner must confirm or replace them with final store artwork before submission.

## Native provider/origin certification plan

Do not relax provider restrictions or log credentials. During the next milestone, inspect (without values): Capacitor platform, runtime/document origin, request/referrer environment, presence of ArcGIS and DriveTexas configuration, Supabase initialization, NWS reachability, and local POI/crossing asset availability. The existing browser and provider audit harnesses should be reused for these observations. This preparation does not certify any native origin or provider policy.
