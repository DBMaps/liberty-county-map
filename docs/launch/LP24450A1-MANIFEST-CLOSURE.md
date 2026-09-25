# LP244.50A1 — Consumer manifest closure

## Contract RCA recorded before repair

1. `consumer-script-manifest.json` is the ordered browser startup, dynamic runtime and opt-in diagnostic boundary (`gridly.consumerScripts.v1`).
2. `tools/native-web.mjs:readConsumerScriptManifest` requires exact equality with every external script loaded by `index.html`, including order and query strings; this is not merely a list of optional native dependencies.
3. `js/gridly-map-visibility.js` exports `GridlyMapVisibility.bounds/install`. Production `app.js` uses it for portrait popup bounds and map imagery availability. The production HTML loads it immediately before app.js, with no platform exclusion.
4. No intentional exclusion was found. Commit `28de13f7` added the script and HTML reference but did not change the manifest. The evidence indicates a missed manifest update, not an exception to the contract.
5. Native `stage()` validates this manifest before staging and copies `nativePackagedScriptPaths(manifest)`. `verify()` independently checks exact staged JavaScript membership and referenced assets.
6. The first divergence is 80 HTML startup entries versus 79 manifest entries. The current tool fails closed before staging; if that guard were bypassed, the allowlisted copy would omit the script. No claim is made that an already installed device was inspected or missing it.
7. This manifest has no required per-script digest/version/count metadata. Preserve the existing URL version `?v=lp24448f2`. No service-worker revision is required for this manifest-only correction; its shell cache list is a different boundary.
8. Repository inspection found a maintained JSON source consumed by validators/staging, and no owning generator that writes it. A one-entry edit in existing order is appropriate.
9. The authoritative non-staging validation entry point is `readConsumerScriptManifest()` exported by `tools/native-web.mjs`; invoking the CLI directly without `--verify` would stage assets and is deliberately not used. The existing marker suite exercises the same validator.
10. The same error was reproduced at the unchanged certified HEAD before this edit. LP244.50A changes neither HTML nor this manifest.

Android and iOS both use Capacitor `webDir: "www"` (root and both shell configurations agree). The manifest-driven web stage is platform-neutral. This closure does not run staging, Capacitor sync, Xcode, Gradle, APK/AAB or a final candidate build.

The original LP244.50A provider changes must remain byte-identical through this closure. Its prior live proof is retained, not rerun: Dallas 692 source features, 45 current-context records, 23 eligible and 23 automatically rendered markers; 11 settled context captures passed, including Austin/Williamson and failure/recovery. Actual geolocation and physical Android/iPhone acceptance remain device work.

## Closure and certification

**PASS — READY FOR PHYSICAL ANDROID.** Merge recommendation: **YES**. Next step: **PHYSICAL ANDROID ACCEPTANCE**, followed by physical iPhone acceptance. Neither device is certified by this repository-only closure.

The only new production/configuration change in LP244.50A1 is one startup entry, `js/gridly-map-visibility.js?v=lp24448f2`, immediately before `js/app.js?v=lp24448-awareness`. No source behavior, native tooling, HTML, service worker, digest, schema or asset version was changed.

The preserved LP244.50A changes fix the Alerts quiet heading by consulting existing complete source coverage, and invoke the existing official-marker renderer in the existing coalesced provider refresh. Both remain PASS. The expanded tests cover incomplete and recovered coverage, positive/empty transitions, marker identity reuse, clearing and coalescing. Legacy marker tests retain their corrected governed-identity/approved-PNG expectations.

| Gate / exact command | Pass | Fail |
|---|---:|---:|
| `node --test tools/lp24450/alerts-heading-regression.test.cjs` | 6 | 0 |
| `node --test tests/lp24450a-alerts-heading.test.cjs tests/lp24450a-marker-reconciliation.test.cjs` | 16 | 0 |
| `node tools/lp24450a/contracts.mjs` | 68 | 0 |
| `node tools/lp24450a/regressions.mjs` | 178 | 0 |

The last suite includes the formerly failing native startup inventory test; no tests were skipped. These counts overlap and should not be added as unique tests. The runners accept `GRIDLY_CERTIFICATION_OUT=reports/lp24450a1` so this closure writes new evidence without overwriting LP244.50A reports. The contracts runner now propagates its test process exit status, as the regression runner already did.

Independent validation, with no build/stage side effects:

```powershell
node --input-type=module -e "import {readConsumerScriptManifest,nativePackagedScriptPaths} from './tools/native-web.mjs'; const m=await readConsumerScriptManifest(); console.log(JSON.stringify({pass:true,startupScripts:m.startupScripts.length,mapVisibilityIncluded:nativePackagedScriptPaths(m).includes('js/gridly-map-visibility.js'),stagingPerformed:false}));"
```

Result: PASS, 80 ordered startup scripts, map-visibility included, no staging. Syntax and whitespace checks pass. The original LP244.50A live results are unchanged; this closure does not manufacture or claim a new live count.

## Local commit boundary

Branch: `LP244.50A-live-provider-launch-blocker-repair`. Starting HEAD: `2e4ec7d84d6fd7c79a1d0b09deae9d6641be872e`.

One authorized local commit, message `Close live provider and native manifest launch blockers`, includes exactly:

- `consumer-script-manifest.json`
- `js/app.js`
- `js/gridlyOfficialProviderActivation.js`
- `tests/lp045-1-official-marker-live-runtime-repair.test.js`
- `tests/lp045-2-official-marker-construction-repair.test.js`
- `tests/lp24450a-alerts-heading.test.cjs`
- `tests/lp24450a-marker-reconciliation.test.cjs`
- `tools/lp24450a/contracts.mjs`
- `tools/lp24450a/regressions.mjs`
- `docs/launch/LP24450A1-MANIFEST-CLOSURE.md`

LP244.49/LP244.50 documents, reports and tools remain untracked. The prior LP244.50A report, runtime captures and one-off audit helpers also remain untracked. New LP244.50A1 runtime evidence remains under `reports/lp24450a1/` and one-off orchestration under `tools/lp24450a1/`; neither is committed. The exhaustive remaining file list, hashes, final commit identity and status are recorded in `reports/lp24450a1/final-state.json` after commit. Local provider configuration and all old captured evidence are excluded and preserved. No push, merge, native build or reporting activation is authorized or performed.
