# Gridly LP244.37 Android Launch-Candidate Certification

This record certifies the local Android release artifacts built for physical-device acceptance. It does not authorize or record a Google Play upload, store submission, publication, reporting activation, production database change, web deployment, Apple submission, or public launch. No password, private key, keystore, or secret credential is recorded here.

## 1. Source main SHA

`2f7e1948246852f1a047654f7cc56e2ad70a0714` — `Merge production compliance certification`.

The branch was created directly from a clean, current local `main` matching `origin/main`.

## 2. Branch

`LP244.37-final-android-launch-candidate`

## 3. Package ID

`com.gridlygo.gridly`

The Gradle application ID, namespace, packaged release manifest, release APK badging, and Capacitor application ID agree.

## 4. versionName

`1.0.0`

## 5. versionCode

`1`

Version code 1 is valid for the first intended Google Play upload because no Gridly build has been uploaded or submitted. No arbitrary version increment was made.

## 6. minSdk

`24`

## 7. targetSdk

`36` (compile SDK 36)

## 8. 18+ verification

**PASS.** Active launch-facing Privacy, Terms, Community Guidelines, public-site copies, bundled native legal HTML, and their contract tests consistently require users to be at least 18. No active launch-facing `16+`, `at least 16`, `age 16`, or `under 16` copy remains.

The remaining repository matches are historical legal/audit records or a map zoom threshold and are not launch-facing age statements.

## 9. UGC acceptance version

`gridly-ugc-2026-09-17-v2`

The runtime compliance gate, bundled Community Guidelines, public Terms and Guidelines, and automated contracts agree on this version.

## 10. Reporting production state

Read-only production verification at `2026-09-17T20:11:08.086818Z` returned:

| Field | Value |
|---|---:|
| `reporting_enabled` | `false` |
| Protocol version | 2 |
| Reports | 0 |
| Moderation complaints | 0 |
| Deletion requests | 0 |

The candidate was staged and built while reporting remained OFF. No production write was performed.
A final read-only recheck at `2026-09-17T20:28:43.067041Z` returned the same state and zero counts.

## 11. Signing identity

- Alias: `gridly`
- Subject: `CN=Gridly, OU=Mobile, O=DJ Burns Collective LLC, L=Dayton, ST=Texas, C=US`
- Algorithm: SHA384withRSA using a 4096-bit RSA key
- Validity: September 16, 2026 through February 1, 2054
- Signers: exactly one

The existing keystore and all signing secrets remained outside the repository. The release variant resolved the Gridly configuration, not the Android debug key. No signing material was copied, changed, generated, displayed, or committed.

## 12. Certificate SHA-256

```text
84:FB:65:B7:E3:65:38:DD:1F:B9:57:27:B8:9E:46:44:BB:0C:F5:1A:1B:B2:70:C2:54:26:9D:CD:FC:F7:C8:A3
```

Gradle `signingReport`, independent `keytool -printcert -jarfile`, and APK Signature Scheme verification agree.

## 13. Native staging result

The governed configured native workflow and Capacitor Android sync completed successfully:

| Measurement | Result |
|---|---:|
| Staged files | 946 |
| Staged bytes | 206,772,450 |
| POI shards | 86 |
| Stage digest | `sha256:88a84e09472326c63ba3e8458d1d888b036731d48115173e26c756c305863980` |

The stage includes the current consumer script manifest, service worker, Privacy Policy, Terms, Community Guidelines, LP244.33 UGC compliance runtime, reporting fail-closed guard, and exactly 86 governed POI shards. Five files under `assets/store` are intentionally packaged runtime branding sources referenced by the app: the production icon, two logos, and two splash images. Google Play listing-only assets such as the feature graphic are not runtime dependencies.

## 14. Regression results

All required pre-build gates passed with zero failures:

- Android fast: **56/56 pass**.
- Launch/legal/native aggregate covering LP244.33, LP244.34, LP244.36, startup manifest, native packaging, weather/KBYG, crossing popup, search/POI, and consumer/public-site consistency: **94/94 pass**.
- PostgreSQL 17 compliance, retention, reporting availability, and protocol-v2 regression group: **45/45 pass**.
- Final launch aggregate including the LP244.37 certification contract: **98/98 pass**.

The database group ran against a disposable loopback-only cluster, which was stopped and removed after the tests.

## 15. AAB path

`android/app/build/outputs/bundle/release/app-release.aab`

This ignored generated artifact remains local and is not committed.

## 16. AAB size

`85,492,395` bytes

The size is consistent with the governed 206,772,450-byte native stage and its packaged statewide crossing and POI datasets. No unexplained release-size increase was identified.

## 17. AAB SHA-256

```text
DEAEC38CF89F6BD1894322198681F040499C4030007E7ECDE4D56915A29D48B0
```

Build timestamp: `2026-09-17T20:17:21.4732966Z`.

## 18. Build environment

| Component | Version |
|---|---|
| Host | Windows 11, amd64 |
| Gradle | 8.14.4 |
| JDK | Eclipse Adoptium 21.0.12.1+1 LTS |
| Kotlin | 2.0.21 |
| Capacitor CLI/Core/Android | 8.3.4 |
| Node.js used by repository staging/tests | 24.17.0 |
| Android compile/target SDK | 36 |

The Gradle build completed successfully. Gradle reported deprecated features to address before a future Gradle 9 upgrade; this does not affect the current pinned Gradle 8.14.4 build.

## 19. Package audit

**PASS.** The AAB contains 1,368 entries and the release manifest/package audit confirmed:

- application ID `com.gridlygo.gridly`, label `Gridly`, min SDK 24, target SDK 36, version 1.0.0 (1);
- only Internet, network-state, foreground coarse/fine location, and the AndroidX signature-level receiver permission;
- no Advertising ID, background location, storage, camera, microphone, notification, contacts, billing, health, or financial permission;
- no `.env`, keystore, private-key, source-map, test directory, owner-local file, or audit-helper startup artifact;
- no Supabase service-role JWT or actual secret-bearing marker;
- current consumer runtime, legal HTML, UGC compliance JS, service worker, native bridge, 86 JSON POI shards, and 86 native POI shards;
- `GridlyGeolocationPlugin` and the Capacitor bridge in release DEX;
- localhost strings limited to fail-closed development guards and URL construction, `file://` limited to Capacitor's local-file bridge, and one packaged POI named “Localhost”; none is a production network dependency; and
- opt-in diagnostic code remains governed and is not an audit helper loaded as a startup dependency.

The AAB JAR signature verified successfully. JDK verification also emitted informational self-signed-chain, no-timestamp, and JarFile/JarInputStream compatibility warnings typical of this Android bundle packaging. Independent certificate extraction and the separately built APK's Android v2 signing-block verification both confirmed the intended single signer.

## 20. Installable test artifact

The established Gradle workflow produced a signed release APK from the same synchronized source inputs:

| Field | Value |
|---|---|
| Path | `android/app/build/outputs/apk/release/app-release.apk` |
| Size | 85,965,377 bytes |
| SHA-256 | `7CAB5C12DECB316D8A147182F009392D6CE372342DC7E0CF3EB689C2B2D28B85` |
| Build timestamp | `2026-09-17T20:23:27.7545629Z` |
| APK signature | v2 verified, exactly one signer, expected Gridly certificate |

This APK is only for physical-device acceptance. It does not replace the Play AAB and is not committed.

## 21. Store declaration alignment

The candidate aligns with the supplied current Google Play declaration authority:

| Declaration | Candidate alignment |
|---|---|
| Paid app | No subscription or in-app billing flow; Play upfront pricing remains console-owned |
| Production availability | Intended United States only; legal copy states initial U.S. availability with Texas-focused coverage |
| Audience | 18 and over only; minors restricted |
| Ads / Advertising ID | No ads SDK or Advertising ID permission |
| Government app | No government claim; explicit non-government safety language |
| Financial features | None present |
| Health features | None present |
| Privacy | `https://gridlygo.com/privacy` |
| Terms | `https://gridlygo.com/terms` |
| Community Guidelines | `https://gridlygo.com/community-guidelines` |
| Support | `https://gridlygo.com/support` |
| Delete data | `https://gridlygo.com/delete-data` |

The Play Console was not opened or changed during this mission.

## 22. Physical-device acceptance status

**PENDING — NOT YET CERTIFIED.** No real Android device was required or tested during this local build mission. Use Mobile Portrait as the authoritative acceptance orientation and exercise this exact signed APK with the following checklist:

1. Cold launch and clean first-run state.
2. Welcome/onboarding sequence, images, text, paging, skip/finish, and relaunch behavior.
3. Foreground location permission: not-yet-asked, allow approximate, allow precise, deny, deny permanently, and recovery paths.
4. **Use My Location** success, failure, pending, pause/resume, and duplicate-tap behavior.
5. Dayton, Dallas, and Austin destination searches and clear/reset behavior.
6. KBYG, current weather, official Alerts, and truthful quiet states.
7. Railroad crossings, selection, map interaction, and portrait popup containment at both screen edges.
8. Nearby Places categories, radius controls, results, selection, and back navigation.
9. Report-category UI with reporting disabled; verify no report or pending operation is created.
10. UGC Terms acceptance, required checkbox, cancellation, re-entry, and `gridly-ugc-2026-09-17-v2` persistence.
11. Community Guidelines and all bundled legal links.
12. Privacy, Terms, Support, and delete-data URL access.
13. Keyboard opening/dismissal, portrait reflow, focused controls, and no obscured primary action.
14. Android system back, in-app navigation/back, sheet/dialog dismissal, and no accidental exit loops.
15. Clear/reset of location, search, filters, nearby results, and report UI state.
16. General visual-regression sweep: typography, icons, splash, logos, map, cards, dialogs, safe areas, and touch targets.

Record the device model, Android version/API, APK SHA-256, tester, date/time, result for every step, screenshots for failures, and final owner disposition before physical acceptance may be certified.

## 23. Known limitations

- Physical-device acceptance remains pending.
- Reporting remains deliberately disabled, so submission success cannot and must not be certified.
- No Google Play processing, device-catalog, pre-launch report, or review outcome exists because the AAB was not uploaded.
- Gradle 8.14.4 reports deprecation warnings for a future Gradle 9 upgrade.
- The AAB is large because it deliberately packages governed statewide crossing data and 86 POI shards for bounded native availability.

## 24. Launch state

- Google Play was not uploaded, submitted, or released.
- Apple App Store was not submitted or released.
- Reporting remains OFF.
- Production compliance remains certified.
- The 18+ posture remains authoritative.
- Public launch did not occur.
- No web runtime, production database change, pricing change, merge, Dispatch implementation, or store-console mutation occurred.

## 25. Final verdict

**A. ANDROID LAUNCH CANDIDATE BUILT AND READY FOR PHYSICAL ACCEPTANCE**
