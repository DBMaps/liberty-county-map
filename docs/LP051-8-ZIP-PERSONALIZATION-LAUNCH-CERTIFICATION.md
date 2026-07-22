# LP051.8 — ZIP Personalization Launch Certification

## Executive conclusion

LP051.8 adds the final passive launch-certification audit for Gridly's ZIP-based home personalization lifecycle. The audit is exposed as:

```js
window.gridlyLp0518ZipPersonalizationLaunchCertificationAudit?.()
```

The audit is intentionally honest: it reports `partial` until required browser scenarios are observed and the owner acknowledges completion by setting `window.__gridlyLp0518ManualBrowserCertificationPassed = true` in the validated browser session. The manual flag means only “the owner completed the required browser checklist”; it does not flip failed fields to pass, ignore visible failures, bypass missing scenario evidence, force `launch_candidate`, or force `safeForLaunch: true`.

## Certified architecture

Runtime ownership remains unchanged from LP051.7:

- ZIP entry and candidate confirmation: guarded ZIP confirmation bottom-sheet flow.
- ZIP resolver: `gridlyResolveHomeZipAwareness()` and the governed ZIP awareness index.
- Production apply function: `gridlyApplyConfirmedHomePersonalization()`.
- Canonical storage: `gridlyHomePersonalizationV1`.
- Compatibility storage: existing settings/profile/home-town storage written through the setup compatibility path.
- Active county/community/awareness state: existing active-county and selected-awareness owners.
- Map focus: existing awareness identity focus functions.
- Awareness refresh: existing awareness refresh owner.
- Settings rendering: `buildSettingsSurfaceHtml()` rendered into `#gridlyPortraitV2SheetBody`.
- Startup restoration: `gridlyRestoreHomePersonalizationOnStartup()`.
- Change-ZIP and cancel behavior: no persistent mutation before final apply.
- Manual fallback and reset behavior: existing manual setup and reset owners remain authoritative.

## Canonical record contract

The canonical Home record remains `gridlyHomePersonalizationV1` with schema `LP051.7.home-personalization.v1`. The expected resolved Dayton record contains ZIP `77535`, county `liberty-tx`, community `dayton`, awareness area `dayton`, consumer label `Dayton`, and a confirmed ZIP resolution method. Compatibility storage must agree with this canonical Home but is not the authority.

## Home versus Current View contract

Home versus Current View contract:

- Home is persistent and saved in `gridlyHomePersonalizationV1` when ZIP confirmation is authoritative.
- Home may also be set by explicit manual Home setup when that existing setup path is used.
- Current View controls the temporary awareness scope.
- Current View may be the saved Home, another community, a nearby area, or the entire county.
- Browsing or switching Current View must not rewrite Home merely because the user is viewing a different area.

This contract must be visible in Settings, consistent in storage, reflected in runtime state, respected by map focus, preserved by startup restoration, and maintained during Change home ZIP and county-wide viewing.

## First-run result

Static/runtime certification verifies the apply function, canonical schema, Settings visibility contract, onboarding-completion reporting, bounded write counters, active-state update counters, map-focus instrumentation, and awareness-refresh instrumentation. Browser proof is still required for the full first-run sequence: clean storage, reload, complete onboarding, enter ZIP `77535`, confirm Dayton, apply, observe success, and enter Gridly.

## Startup restoration result

Startup restoration is available through `gridlyRestoreHomePersonalizationOnStartup()`. The LP051.8 audit reports `startupRestorationPass` when no invalid canonical record is detected and validates that a valid record can be read safely. Browser proof must verify that onboarding does not repeat and Dayton appears without stale previous-area output after reload.

## Existing-user migration result

Existing users without `gridlyHomePersonalizationV1` remain safe. The audit reports migration findings with Home ZIP as `Not set` when no canonical ZIP exists. No ZIP is invented, and no reverse mapping is performed for manual setup users.

## Change-ZIP result

The existing Change home ZIP action remains visible in the production Settings surface. Apply certification requires browser proof that the newly confirmed identity replaces the canonical record, updates active county/community/awareness state, moves the map, updates Settings, restores on startup, and removes stale prior-area state.

## Cancel result

Cancel safety is certified by the no-write-before-final-apply contract. The LP051.8 audit reports `cancelPreservesPreviousHome`; browser proof must verify that navigating to a result and canceling before final apply preserves the previous canonical Home, active state, Settings content, and map focus.

## County-wide viewing result

County-wide Current View remains allowed. Selecting Liberty County as Current View must expand the map and awareness context without rewriting the saved Dayton / `77535` Home record. Switching Current View back to Dayton must resynchronize the temporary awareness scope with the saved Home identity.

## Manual setup result

Manual setup remains available through Choose community manually and the existing county/community selectors. Manual setup does not require a ZIP and must show Home ZIP as `Not set` when no canonical ZIP record exists. LP051.8 does not invent ZIPs for manual users.

## Protected ZIP results

Protected ZIP expectations:

- `77084`: ambiguous; no silent default; candidate choice required; cancel preserves prior Home.
- `77201`: PO Box-only unsupported; no setup writes; residential ZIP/manual fallback available.
- `77210`: unique ZIP unsupported; no setup writes; residential ZIP/manual fallback available.
- `99999`: unsupported; no setup writes; manual fallback available.
- `abc`: invalid; no setup writes; no active-state mutation.

The audit reports protected ZIP findings and write-detection fields for unsupported, PO Box-only, unique, and invalid ZIPs.

## Requires-confirmation result

ZIP `75834` is treated as a confirmation-required rural multi-community scenario. Function availability is not proof. The required browser proof is that `75834` presents multiple relevant existing candidates, silently selects no default, requires explicit selection, applies only the selected identity, and preserves previous Home on cancel. Until tested, the audit reports `requiresConfirmationEvidenceStatus: "unobserved"`, `requiresConfirmationPass: null`, pending evidence, and `safeForLaunch: false`.

## Houston result

ZIP `77075` must resolve to the governed consumer-friendly region `Southeast Houston / Hobby` in Harris County. Generic Houston labels or internal Harris/Houston keys must not appear in the consumer surface.

## Rural result

Rural multi-community ZIPs must not imply false certainty. Candidate options should remain short and relevant, explicit selection is required, and unselected alternatives must not be stored.

## Map result

Applied scenarios must use existing community/awareness map identity. ZIP centroids are not permanent map identities. Focus should be requested once per successful apply, complete successfully, avoid stale previous-area focus, use county context for county-wide Current View, and return to the saved Home identity when requested.

## Awareness result

Awareness Brief, Current Conditions, Community Pulse, Travel Brief, alert filtering, crossing context, and official intelligence context must reflect the active Current View. Home remains separately visible in Settings and does not need to be repeated as ZIP text on every awareness surface.

## Settings result

The visible production Settings renderer is `buildSettingsSurfaceHtml()` inside `#gridlyPortraitV2SheetBody`. The required visible Dayton setup text is: HOME AREA, Dayton, Liberty County, HOME ZIP, 77535, Change home ZIP, CURRENT VIEW, Dayton or Liberty County, Change Area, and Choose community manually. Hidden legacy markup does not satisfy LP051.8. Settings is not required to remain open permanently: a closed Settings panel is `settingsEvidenceStatus: "unobserved"` and creates pending evidence, while an open Settings panel missing required controls is `settingsEvidenceStatus: "fail"` and blocks launch. Passing Settings evidence must be earned while the runtime DOM is observable, for example with `window.gridlyLp0518RecordBrowserEvidence?.("settingsVisiblePass")` after opening Settings and verifying the required text.

## Storage consistency

The certification inventory compares `gridlyHomePersonalizationV1`, `gridlySettingsV1`, `gridlyHomeTown`, and `gridlyUserProfileV1`. Canonical Home is authoritative. Compatibility mirrors must agree. Prototype flags, candidate arrays, HUD ratios, and source metadata must not leak into production storage. Invalid stored records fail safely.

## Reset result

Full setup reset should clear `gridlyHomePersonalizationV1` only when existing reset rules intend a full setup reset. Compatibility setup values reset consistently, onboarding can restart cleanly afterward, and unrelated saved places or Route Watch data remain governed by existing reset scope.

## Refresh/performance result

Successful apply should write the canonical record once, block duplicate taps, bound active-state updates, avoid unnecessary map focus repetition, bound provider refreshes, avoid startup reapply loops, avoid Settings rerender loops, avoid selected-awareness hot loops, and stop repeated storage writes after idle.

## Mobile portrait result

Mobile portrait uses the same pass/fail/unobserved evidence model. CSS presence alone is not proof. Until the owner verifies a usable 390 × 844 layout, readable entry/result/Settings screens, unclipped required actions, keyboard-safe ZIP entry, and clear Home versus Current View language, the audit reports `mobilePortraitEvidenceStatus: "unobserved"`, `mobilePortraitPass: null`, pending evidence, and `safeForLaunch: false`. Mobile portrait is the primary experience. Required manual viewports include 390 × 844 and one narrower phone viewport. Review ZIP entry, resolved result, confirmation lists, ambiguous list, protected ZIP states, applying/success states, Settings Home card, Settings Current View card, Change ZIP flow, manual fallback, and county-wide Current View for Gridly dark/glass styling, readable text, clear button hierarchy, unclipped controls, keyboard safety, clean bottom-sheet close, and understandable Home versus Current View separation.

## Accessibility result

Scoped checks cover ZIP input label, aria-live validation, focus management, dialog semantics, keyboard-operable actions, visible focus state, selected candidate state, readable contrast, mobile touch targets, Change home ZIP button semantics, and manual-fallback button semantics.

## Audit output

The LP051.8 audit reports pass/fail/unobserved evidence fields including `settingsEvidenceStatus`, `mobilePortraitEvidenceStatus`, `requiresConfirmationEvidenceStatus`, `changeZipApplyEvidenceStatus`, `changeZipCancelEvidenceStatus`, `homeCurrentViewEvidenceStatus`, `certificationEvidencePending`, `certificationPendingCount`, `manualProofCannotOverrideFailures`, and `launchGateIntegrityPass`. The LP051.8 audit reports all required top-level booleans and details arrays: canonical-record findings, active-state findings, map findings, awareness findings, Settings findings, startup findings, migration findings, change-ZIP findings, cancel findings, protected ZIP findings, write findings, refresh findings, stale-state findings, visual findings, accessibility findings, certification blockers, and representative test results.

## Certification blockers

Blockers include invalid canonical records, active-state disagreement after normal startup, map mismatch, Settings mismatch, startup restoration failure, county-wide Current View overwriting Home, cancel mutating previous Home, ambiguous silent default, protected ZIP setup writes, stale prior-area output, refresh loops or duplicate provider work, Route Intelligence mutation, protected-system regressions, and critical mobile or accessibility failures.

## Launch status

LP051.8 separates proven failures from missing evidence. `certificationBlockers` contains proven failures. `certificationEvidencePending` contains required browser scenarios or other requirements that are not yet observed. `certificationBlockerCount` and `certificationPendingCount` are reported separately.

Corrected launch-status truth table:

| Blockers | Pending evidence | Browser proof complete | launchCertificationStatus | safeForLaunch |
| --- | --- | --- | --- | --- |
| > 0 | any | any | `blocked` | `false` |
| 0 | > 0 | any | `partial` | `false` |
| 0 | 0 | `true` | `launch_candidate` | `true` |

`launchCertificationStatus` values are `blocked`, `partial`, `launch_candidate`, and `certified`. LP051.8 does not use `certified` unless final real-device launch certification is explicitly completed. `safeForLaunch` may be true only for `launch_candidate` with every mandatory requirement passing and no pending evidence.

## Merge recommendation

Merge recommendation: merge as the launch-certification harness and documentation if static checks pass and no narrow runtime blocker is discovered. Treat the result as `partial` until browser/mobile evidence is collected.

## Exact browser testing steps

1. Clear setup state and reload.
2. Complete onboarding through the ZIP-first setup path.
3. Enter `77535`, confirm Dayton, apply, observe success, and enter Gridly.
4. Open Settings and verify the visible `#gridlyPortraitV2SheetBody` text for Home area, Home ZIP, Current View, Change home ZIP, Change Area, and Choose community manually.
5. Run `window.gridlyLp0518ZipPersonalizationLaunchCertificationAudit?.()` and review blockers.
6. Reload and verify startup restoration to Dayton.
7. Create existing manual setup without `gridlyHomePersonalizationV1` and verify Home ZIP is `Not set` with no invented ZIP.
8. From Dayton / `77535`, open Change home ZIP, navigate to another result, cancel, and verify Dayton remains saved and active.
9. Repeat Change home ZIP and apply a different valid governed area; verify storage, map, awareness, Settings, and startup agree.
10. Switch Current View to Liberty County; verify Home remains Dayton / `77535`; switch back to Dayton.
11. Run protected ZIP checks for `77084`, `77201`, `77210`, `99999`, and `abc`, comparing write counters before and after each attempt.
12. Run requires-confirmation ZIP `75834` and verify explicit selected identity is the only stored identity.
13. Run governed Houston ZIP `77075` and verify `Southeast Houston / Hobby` in Harris County.
14. Validate map and awareness surfaces after each apply/restore.
15. Validate mobile portrait at 390 × 844 and a narrower viewport.
16. Validate scoped accessibility basics.
17. Record earned evidence as each browser scenario is inspected, for example `window.gridlyLp0518RecordBrowserEvidence?.("settingsVisiblePass")` while Settings is open, then record `mobilePortraitPass`, `requiresConfirmationPass`, `changeZipApplyPass`, `changeZipCancelPass`, `countyWideHomeSeparationPass`, `visualIntegrationPass`, and `accessibilityBasicsPass` only after those checks pass.
18. Only after every browser scenario passes, set `window.__gridlyLp0518ManualBrowserCertificationPassed = true` and rerun the audit. Confirm `launch_candidate` and `safeForLaunch: true` only when `certificationBlockerCount === 0`, `certificationPendingCount === 0`, and every mandatory field is true.

## Post-LP051 recommendation

Recommended next milestone: final real-device launch rehearsal and release checklist execution, using the LP051.8 audit as the evidence collector and preserving Route Intelligence independence.
