# Gridly native provider / origin certification preparation

> Repository audit at baseline `61ecdd29482bab0d1e2941046e28215b2cec9343`. This is certification preparation, not physical-device evidence, a deployment authorization, or a provider-security change.

## 1. Executive verdict

**B — NATIVE PROVIDER CONTRACTS REQUIRE BOUNDED CONFIG TOOLING.** The bounded gap is closed by reusing LP183.1's exact, additive ArcGIS/DriveTexas public-client overlay validator in native staging and attesting the final configured bytes. The bundle can now be installed for physical certification. ArcGIS, DriveTexas, NWS, remote map/search/routing services, and CDN delivery are not certified until device tests complete. No credential may be made unrestricted.

## 2. Native origin model

The tracked Capacitor configuration and both generated platform copies set `webDir` to `www`, omit `server`, and therefore contain no `server.url`. The expected values below follow the generated Capacitor 8 configuration; the helper must measure the actual values because repository files do not prove device WebView behavior.

| Platform | Expected document origin | Expected scheme | Expected host | Remote or bundled | `server.url` | Certainty | Runtime measurement required? |
|---|---|---|---|---|---|---|---|
| Android WebView | `https://localhost` | `https:` | `localhost` | bundled `www` | No | configuration expectation | Yes |
| iOS WKWebView | `capacitor://localhost` | `capacitor:` | `localhost` | bundled `www` | No | configuration expectation | Yes |

## 3. Provider matrix

| Provider | Current contract | Native expectation / exact classification | Config change required? | Code change required? | Runtime test? | Risk | PASS condition |
|---|---|---|---|---|---|---|---|
| ArcGIS Static Basemap Tiles | `static-map-tiles-api.arcgis.com/.../static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/{z}/{y}/{x}`; public-client token in the `token` query parameter; repository instruction requires `premium:user:staticbasemaptiles` and referrer enforcement | **E — UNKNOWN — PHYSICAL RUNTIME TEST REQUIRED.** Repository authority does not prove that the existing web-referrer restriction accepts either local scheme or what Referer each WebView sends. Do not add an origin until measured and provider-supported. | Unknown pending measurement/owner provider-console verification | No | Yes | High | imagery and labels load on both devices; authorization succeeds; key remains restricted; no unrestricted workaround |
| DriveTexas / TxDOT | `https://api.drivetexas.org/api/conditions.geojson?key={api_key}`; URL-encoded query key; hierarchy is `GRIDLY_CONFIG.driveTexas.apiKey`, `GRIDLY_CONFIG.txdot.apiKey`, `GRIDLY_TXDOT_API_KEY`; fetch/CORS required | **C — PROVIDER TERMS / CREDENTIAL MODEL REQUIRES OWNER VERIFICATION.** Repository authority explicitly leaves browser credential, rate, attribution, cache/retention and terms approval unresolved. | Owner verification; allowlist change only if provider requires and supports it | No | Yes | High | connector configured; data or governed truthful unavailable state; no CORS/auth failure; key absent from logs |
| Supabase | Tracked HTTPS project URL and public client key; browser SDK creates a public client; reports use REST/read-write paths under deployed RLS; no service role | **A — SHOULD WORK WITHOUT ORIGIN CHANGE.** No sign-in, anonymous identity creation, OAuth redirect, magic-link callback, or Site URL dependency is present in the Community Report lifecycle. Deployed RLS and real read/write remain device tests; realtime is not a required report path evidenced here. | No expected; deployed RLS must already authorize lifecycle | No | Yes | Medium | client initializes; production read/write/refresh succeeds under RLS; no service-role material in package |
| NWS | HTTPS `api.weather.gov` fetch of selected Texas/area alert authority, fail-closed presentation | **UNKNOWN — RUNTIME TEST.** Repository code cannot establish CORS behavior for Capacitor origins or device User-Agent/contact acceptance. | No expected | No | Yes | Medium | selected-area request succeeds or truthful failure appears; no CORS block; area identity remains selected area |
| Leaflet library | CSS and JS exclusively from `unpkg.com`; Supabase SDK exclusively from jsDelivr | **RUNTIME TEST REQUIRED.** Network/CDN availability is a launch dependency. Local packaging would improve resilience, but it is not changed during this audit because map/provider network access is itself required and no measured device failure exists. | No | No current change | Yes | Medium | both resources load and app starts on cold device launch |
| OSM standard tiles | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, Leaflet attribution present | **RUNTIME TEST REQUIRED.** CORS/origin and public-service usage capacity require device/owner policy validation. | Possibly operational policy, not credential config | No | Yes | Medium | tiles load, attribution remains visible, no origin/CORS failure |
| Nominatim search/reverse | Direct HTTPS remote fallback; repository already labels it risky at scale | **RUNTIME TEST REQUIRED.** | Owner usage-policy/capacity validation | No | Yes | Medium | bounded request succeeds without origin rejection and complies with established usage policy |
| OSRM routing/nearest | Direct `router.project-osrm.org` HTTPS public demo calls | **RUNTIME TEST REQUIRED.** | Owner capacity/usage-policy validation | No | Yes | Medium | route and nearest calls succeed without CORS/origin rejection and remain within established policy |
| POI runtime-v2 | Relative bundled manifest and gzip shards only | **READY; origin risk LOW / NONE.** Native verifier requires manifest, exactly 86 shards and both legal notices. | No | No | Yes (functional) | Low | bundled manifest/shards load; populated and legitimate-zero searches both work |
| Crossings | Relative bundled `Crossing-Packages` authority; local static provider plus existing shared Community Report integration | **READY.** Local package paths are compatible; shared report portion inherits Supabase runtime test. | No | No | Yes (integration) | Low/medium | governed crossing data, marker popup/context and shared-report integration work |

## 4. Configuration delivery status

**BOUNDED TOOLING GAP CLOSED.** `tools/native-web.mjs` accepts only an external owner-local JSON overlay via `--runtime-config-file`, delegates exact schema validation and additive composition to LP183.1, never prints values, does not copy the input, and requires a report outside `www`. The permitted schema is exactly:

```json
{
  "arcgisStaticBasemapApiKey": "<restricted-public-client-key>",
  "driveTexas": { "apiKey": "<restricted-public-client-key>" }
}
```

The existing validator preserves the POI `ENABLED` gate and county geometry, writes both provider families without replacement, and rejects missing/unknown properties. Supabase remains the tracked public-client configuration. `js/gridly.local.js` is neither used nor staged.

The identity report contains the candidate Git SHA; sorted final path list; each final file's byte length and SHA-256; deterministic bundle digest; and final runtime-config path, bytes and SHA-256. It contains classifications, not credential values. Pre-composition identity is not accepted by configured verification.

## 5. Diagnostic status

Run `await window.gridlyNativeProviderOriginAudit?.()` in the device WebView console. It returns only:

- Capacitor platform;
- document href, origin, protocol and hostname;
- user agent and referrer;
- ArcGIS configuration present boolean;
- DriveTexas configuration present boolean and selected family (`driveTexas`, `txdot`, `legacy global`, `none`);
- Supabase client initialized boolean;
- NWS reachability (`reachable`, HTTP status class, or `unreachable`);
- POI manifest presence status;
- Liberty crossing package presence status.

It never returns keys, authorization headers, endpoints containing configured keys, or Supabase key material. Its NWS probe is read-only. Existing `gridlySupabaseSubmitHealthAudit` remains the bounded report-lifecycle diagnostic; invocation with `{submit:true}` performs a real production test write and must only be used deliberately.

## 6. Static test results and evidence limit

Repository checks must cover native identity/config, additive overlay validation, secret-safe reports, the helper field contract, 86 POI shards, legal notices, crossing packages, foreground-only location permissions, and native platform configuration. No physical provider is marked PASS by these checks.

## 7. Android owner test plan (Windows / Android Studio)

From PowerShell, use a clean `main` checkout and keep the owner file ignored/local:

```powershell
git switch main
git pull --ff-only origin main
npm ci
New-Item -ItemType Directory -Force owner-local, .artifacts | Out-Null
notepad owner-local/native-provider-config.json
npm run build:native-web:configured
npm run verify:native-web:configured
npm run build:native-assets
npx cap sync android
npx cap open android
```

In Android Studio select a physical phone with USB debugging enabled, choose the `app` debug configuration, then **Run**. No release signing is needed. Open Chrome `chrome://inspect`, inspect Gridly, and run:

```js
await window.gridlyNativeProviderOriginAudit?.()
```

Capture the returned object and Network rows with query values redacted. Then manually check, in order: Standard tiles/attribution; Satellite imagery and labels; DriveTexas refresh and truthful unavailable handling; NWS for the selected area; Community Report read plus one deliberate write/refresh lifecycle; populated and zero-result POI searches; crossing markers/popups/shared-report context; location permission Allow while using and Deny. Record PASS/FAIL against the matrix, never a key value.

An optional command-line debug build/install after sync is:

```powershell
cd android
.\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
cd ..
```

## 8. iOS owner test plan (Mac / Xcode)

From Terminal, use the same externally held restricted public-client values:

```bash
git switch main
git pull --ff-only origin main
npm ci
mkdir -p owner-local .artifacts
${EDITOR:-nano} owner-local/native-provider-config.json
npm run build:native-web:configured
npm run verify:native-web:configured
npm run build:native-assets
npx cap sync ios
npx cap open ios
```

In Xcode select the App target, Signing & Capabilities, and the owner's development Team; retain bundle identifier `com.gridlygo.gridly`. Select a connected physical iPhone and **Run**—do not Archive or upload. In Safari enable the Develop menu, select the iPhone/Gridly WebView, and run:

```js
await window.gridlyNativeProviderOriginAudit?.()
```

Capture only safe fields and redacted Network results. Manually test location Allow While Using and Deny; Standard tiles/attribution; Satellite imagery/labels; DriveTexas; selected-area NWS; Supabase report read and one deliberate write/refresh; populated/zero POI results; and crossing marker/popup/shared-report context. Record platform-specific PASS/FAIL against the matrix.

## 9. True blockers before phone install

None in tracked code. The owner must possess restricted public-client ArcGIS and DriveTexas values and place them in the external/ignored overlay to exercise those providers, plus have Android SDK/phone or macOS/Xcode/iPhone tooling. Provider allowlist/policy uncertainty blocks provider certification, not debug installation.

## 10. Merge recommendation

**MERGE RECOMMENDED.** The changes close the bounded native configuration/identity gap and add a read-only, value-safe console diagnostic without changing consumer behavior or provider security.

## 11. Exact next action

**BUILD AND INSTALL GRIDLY ON PHYSICAL ANDROID PHONE.** Android is first because the existing Android Studio/ADB debug path provides the quickest WebView-origin, Referer, CORS and provider-network evidence without signing or store work.
