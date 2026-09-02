# Local Android acceptance harness

This harness replaces the former prepare/sync/build/install/relaunch/manual-inspection loop with two repeatable local commands. It uses only repository tooling, the local Android SDK, one local emulator or physical device, the installed debug APK, ADB, and the debug WebView's local Chrome DevTools Protocol endpoint. No cloud device account is used.

## Prerequisites

- Node dependencies installed (`npm ci`).
- JDK 21. The owner's known installation is `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`; set `JAVA_HOME` rather than editing repository files.
- Android SDK. Set `ANDROID_HOME`/`ANDROID_SDK_ROOT`; the owner's known installation is `C:\Users\gulfi\AppData\Local\Android\Sdk`. The scripts resolve `adb` from `PATH` (or the optional `ADB` environment variable) and never hard-code a username.
- Exactly one authorized emulator or physical device for device smoke.
- `com.gridlygo.gridly` already installed from a debug APK. Ordinary reruns deliberately do not prepare, sync, build, or reinstall.

## Commands

```powershell
npm run verify:android:fast
npm run test:android:acceptance
npm run verify:android:device
```

The fast command is device-free and normally completes in seconds. The device command normally completes in 20–45 seconds after the emulator/device is ready. It reports device/package identity, cold-launches the installed package, forwards only its debug WebView CDP socket, searches Dallas, exercises foreground location when permission was already granted, and checks scoped logcat/process health. Emulator location is set to Dayton (`30.0466, -94.8852`). A physical device is never sent an emulator command.

The device harness is installed-package-only and accepts no command-line options. It never prepares or syncs native assets, invokes Gradle, builds an APK, or installs an APK. When a new APK is required, use the governed workflow: `npm run prepare:native`, `npx cap sync android`, the JDK 21 compile and lint checks, the Gradle APK build, and ADB installation. Then rerun `npm run verify:android:device` without options.

Results are written to ignored `.artifacts/android-acceptance/latest.json` and `.md`. Missing, extra, offline, or unauthorized devices fail preflight explicitly. A not-yet-granted location permission is opened but not granted by automation; that assertion is an explicit `SKIP` so the owner can evaluate the real permission prompt.

## Deliberately bounded manual step

Live Flooding submission is not automated. The current production submission has no acceptance-only deterministic identity and safe targeted delete authority available to this local harness. Automating it could create a real community report or clear an unrelated report. Complete submission, marker/count, KBYG, Alerts propagation, and targeted clear therefore remain one bounded manual lifecycle. No production behavior or security boundary was added merely to make cleanup possible.

The debug WebView is locally inspectable because Android's debuggable APK/WebView exposes `webview_devtools_remote_<pid>`; a release/non-debuggable installation is expected to fail with an actionable CDP preflight error rather than a false pass.
