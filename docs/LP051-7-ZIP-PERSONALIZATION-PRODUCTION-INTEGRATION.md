# LP051.7 ZIP Personalization Production Integration

## Executive conclusion
LP051.7 promotes the LP051.6 ZIP confirmation experience from isolated prototype behavior to the production home-awareness setup path. ZIP remains only the input method; the saved and displayed consumer identity remains the existing Gridly county, community, and awareness-area identity.

## Canonical home-personalization contract
The canonical record is stored at `gridlyHomePersonalizationV1` and uses schema `LP051.7.home-personalization.v1`:

```json
{
  "zip": "77535",
  "countyId": "liberty-tx",
  "countyName": "Liberty County",
  "communityKey": "dayton",
  "communityLabel": "Dayton",
  "awarenessAreaKey": "dayton",
  "consumerLabel": "Dayton",
  "resolutionStatus": "resolved",
  "resolutionMethod": "zip_confirmed",
  "sourceVersion": "LP051.7",
  "confirmedAt": "ISO-8601 timestamp",
  "schemaVersion": "LP051.7.home-personalization.v1"
}
```

Compatibility mirrors are limited to the existing setup authorities: `gridlySettingsV1.community`, `gridlyHomeTown`, and `gridlyUserProfileV1` awareness/home-town fields. Prototype flags, HUD ratios, candidate arrays, and source governance details are not stored.

## Existing setup architecture traced
LP051.7 reuses `saveGridlyHomeTownPreference`, `gridlySetActiveCountyContext`, `applyGridlyHomeTownAwarenessContext`, `setGridlyAwarenessView`, `syncGridlyAwarenessAreaSurfacesImmediately`, `renderGridlySettingsPanel`, and `markGridlyWelcomeSeen`. These are the existing manual setup, active awareness, map focus, Settings, and onboarding completion owners.

## Production apply path
`gridlyApplyConfirmedHomePersonalization` validates the selected existing county/community/awareness identities, captures previous storage, persists the canonical home record, applies compatibility setup values, updates active county/community/awareness context, focuses the map to the existing awareness area, refreshes awareness surfaces, renders Settings, and marks onboarding complete only after successful persistence and apply.

## First-run ZIP flow
The ZIP confirmation overlay now presents production copy and applies the selected area through the production apply function. Manual setup and Use My Location remain separate alternate paths.

## Settings ZIP management
Settings presents Home area, Home ZIP, Change home ZIP, and Choose community manually. Existing users without a canonical ZIP see Home ZIP as Not set and are not forced through onboarding.

## Existing user migration
Existing community setup remains valid. LP051.7 does not reverse-map communities into ZIP codes because multiple ZIPs can serve the same consumer area.

## Manual setup compatibility
Manual community setup still writes through `saveGridlyHomeTownPreference`; ZIP remains unset unless the user explicitly confirms a ZIP result.

## Storage ownership
Canonical ZIP personalization is owned by `gridlyHomePersonalizationV1`. Setup compatibility remains owned by existing Settings/profile/home-town storage. Route Intelligence storage is untouched.

## Transaction behavior
Critical identity or persistence failures roll back the canonical record, home-town key, settings, profile, and active county when practical. Onboarding is not completed on failed apply.

## Map-focus behavior
The map uses the existing community or awareness-area map identity via `setGridlyAwarenessView` or `gridlyFitMapToActiveCountyContext`; ZIP centroids are not introduced.

## Awareness-refresh behavior
Awareness surfaces refresh through `syncGridlyAwarenessAreaSurfacesImmediately` and existing render invalidation paths. LP051.7 does not duplicate provider logic.

## Startup restoration
Startup reads and validates `gridlyHomePersonalizationV1`; valid records restore the same county/community/awareness identity without a new onboarding prompt. Invalid stored records are ignored and reported by audit.

## Change ZIP
The Settings Change home ZIP action opens the ZIP confirmation flow. The previous setup remains active unless a new confirmed selection applies successfully. Cancel preserves prior setup.

## Reset behavior
Full setup reset should remove `gridlyHomePersonalizationV1` alongside existing setup reset keys. LP051.7 does not expand reset scope to Route Watch, saved places, or unrelated user data.

## Protected ZIP behavior
77084 remains ambiguous until explicit selection; 77201 remains PO Box not supported; 77210 remains unique ZIP not supported; 99999 remains unsupported; `abc` remains invalid and writes nothing.

## Harris/Houston behavior
Governed Houston records preserve regional identities such as Southeast Houston / Hobby rather than collapsing to a raw Houston or ZIP identity.

## Rural confirmation behavior
Rural confirmation-required ZIPs present valid existing Gridly candidates and require an explicit user choice.

## Error handling
Invalid identity and persistence failures block setup completion and expose a retry/manual fallback. Map-focus failure after persistence is reported diagnostically while preserving saved setup.


## LP051.7R1 root cause
The first LP051.7 Settings work was present in the legacy `#settingsModal` markup and helper refresh path, but the production browser-visible owner for portrait mobile Settings is the Portrait V2 Settings renderer in `buildSettingsSurfaceHtml()` inside `#gridlyPortraitV2SheetBody`. That renderer rebuilt the visible Settings body with only the legacy Awareness Area / Change Area card, so the legacy Home ZIP nodes were dormant whenever Portrait V2 Settings was open.

## Actual visible Settings renderer repaired
LP051.7R1 repairs the production-visible Portrait V2 Settings renderer, not a hidden legacy surface. The Awareness section now renders a visible Home card sourced from `gridlyHomePersonalizationV1` when valid, followed by a distinct Current view card that keeps the existing awareness selector controls.

## Home versus Current View distinction
Home is persistent personalization: it displays the saved consumer community label, county name, and ZIP from the canonical record. Current View is the temporary awareness view: it can remain Dayton, switch to Liberty County, or switch to another available community without rewriting the canonical Home ZIP record merely because the user is viewing a different area. Communities remain the consumer experience; ZIP remains only the input method.

## Visible Home ZIP management
When a canonical record exists, Settings shows Home area, the consumer label such as Dayton, the county name such as Liberty County, Home ZIP, ZIP 77535, and Change home ZIP. For existing/manual users without a valid canonical ZIP, Settings shows the existing community/county safely, Home ZIP as Not set, and Add home ZIP. Change/Add home ZIP opens the ZIP confirmation flow and preserves the old setup until a new selection is explicitly confirmed.

## Legacy Change Area preservation
The existing Awareness Area selector remains available as Current view with Change Area. Choose community manually opens the same manual awareness/community chooser and does not fabricate or erase ZIP data.

## County-wide viewing preservation
County-wide viewing remains available through the existing manual awareness chooser and county/community selector. Selecting a county-wide Current view must not overwrite the persistent Home record saved at `gridlyHomePersonalizationV1`.

## Existing-user Not set behavior
If the canonical record is missing or invalid, Settings does not crash and does not expose internal keys. It falls back to the existing manual awareness display and shows Home ZIP as Not set while the audit records invalid stored records.

## Exact browser validation steps
1. Open the app in a fresh browser profile.
2. Use the production ZIP confirmation flow to enter `77535` and confirm Dayton.
3. Open Settings from the Portrait V2 bottom dock.
4. Confirm the visible Settings text includes `Home area`, `Dayton`, `Liberty County`, `Home ZIP`, `77535`, `Change home ZIP`, `Choose community manually`, and `Change Area`.
5. Run `window.gridlyLp0517ZipPersonalizationProductionIntegrationAudit?.()` and confirm `visibleSettingsSurfaceDetected`, `homeAreaVisible`, `homeZipVisible`, `savedZipVisibleInSettings`, `changeHomeZipVisible`, `manualHomeFallbackVisible`, `legacyChangeAreaPreserved`, `homeAndCurrentViewDistinct`, `settingsCanonicalRecordRendered`, and `settingsZipManagementPass` are all `true`.
6. Use Change Area to switch Current view to Liberty County and confirm `JSON.parse(localStorage.gridlyHomePersonalizationV1).consumerLabel` remains `Dayton` and `.zip` remains `77535`.
7. Use Change home ZIP, cancel, and confirm the same saved Home values remain visible.

## Audit contract
`window.gridlyLp0517ZipPersonalizationProductionIntegrationAudit?.()` reports production availability, canonical record validity, writes, state transitions, refreshes, map focus operations, Settings, startup, protected ZIP results, certification blockers, certification status, and safe-for-production status.

## Test scenarios
Required scenarios cover 77535, 77075, 75834, 77084, 77201, 77210, `abc`, 99999, existing user without ZIP, Change ZIP cancel, Change ZIP confirm, startup restoration, manual fallback, and Route Intelligence independence.

## Production certification status
Runtime audit may report `production_candidate` when no blockers are detected. It does not report `certified`; launch certification is reserved for a later milestone.

## Known limitations
Browser validation is still required for visual mobile portrait behavior, provider refresh timing, and real map movement on device.

## Launch-readiness recommendation
Merge as a production candidate only after browser testing confirms map, Settings, awareness surfaces, startup restoration, protected ZIP behavior, and Route Intelligence independence.

## Recommended next milestone
LP051.8 should perform full launch certification with device/browser evidence and reset-flow hardening.
