# LP051.6 — Guarded ZIP Confirmation UX Prototype

## Executive conclusion

LP051.6 adds a guarded, non-production ZIP confirmation prototype for owner testing. ZIP remains only the input method; the consumer experience presents familiar Gridly community and awareness-area labels such as Dayton, Liberty, Southeast Houston / Hobby, Baytown, and rural candidate choices rather than ZIP codes or internal keys.

The prototype is isolated from production onboarding, Settings, active awareness state, map focus, provider refresh, Route Intelligence, Supabase, saved places, and setup storage. Confirming inside the prototype creates only `window.__gridlyLp0516PrototypeResult` with `prototypeOnly: true` and `saved: false`.

## Prototype guard

The guard is `GRIDLY_LP0516_ZIP_CONFIRMATION_PROTOTYPE_ENABLED = false`, also exposed as `window.GRIDLY_ZIP_CONFIRMATION_PROTOTYPE_ENABLED`. It is disabled by default and is not used as the normal first-run path.

## Launch method

Owner testing command:

```js
window.gridlyOpenLp0516ZipConfirmationPrototype?.()
```

Close command:

```js
window.gridlyCloseLp0516ZipConfirmationPrototype?.()
```

Reset command:

```js
window.gridlyResetLp0516ZipConfirmationPrototype?.()
```

## Consumer flow

1. Enter ZIP.
2. Review familiar Gridly community or awareness-area results.
3. Explicitly confirm the community or choose from a short candidate list.
4. Reach a prototype-only ready screen.
5. Preview, cancel, or choose manually without saving production setup.

## Resolved flow

Resolved and governed resolver results show:

- `We found your area`
- consumer label as the main identity
- county label
- supporting copy: `Gridly will use [label] for local awareness.`
- actions: Confirm, Choose manually, Back

Internal county IDs, community keys, awareness keys, resolver status names, source metadata, confidence classes, and HUD ratio fields are not presented.

## Confirmation-required flow

For `requires_confirmation`, the prototype shows:

- `Which area feels most like home?`
- short copy explaining that ZIP codes can cover more than one community
- a deterministic, de-duplicated, short list of consumer labels
- actions: Continue, Choose manually, Back

The prototype does not silently choose a default.

## Ambiguous flow

For `ambiguous`, including protected ZIP `77084`, the prototype shows:

- `Your ZIP covers more than one Gridly area`
- candidate options where available
- actions: Choose an area, Choose manually, Back

No recommendation is made for Katy, Houston, west Harris, Fort Bend, Waller, or any other candidate.

## Unsupported flow

For valid unsupported ZIPs such as `99999`, the prototype shows:

- `Gridly isn’t available for this ZIP yet`
- Southeast Texas coverage copy
- actions: Choose manually, Try another ZIP, Close

No setup state changes.

## Invalid flow

Malformed input such as `abc` stays on the ZIP entry screen and displays:

`Enter a five-digit ZIP code.`

The input is not unexpectedly cleared.

## PO Box-only flow

Protected ZIP `77201` preserves `po_box_not_supported` behavior and shows:

- `This ZIP can’t identify a home area`
- PO Box residential-address explanation
- actions: Try another ZIP, Choose manually, Close

## Unique ZIP flow

Protected ZIP `77210` preserves `unique_zip_not_supported` behavior and shows:

- `This ZIP can’t identify a home area`
- organization/location ZIP explanation
- actions: Try another ZIP, Choose manually, Close

## Houston/Harris UX

Houston/Harris presentation uses existing simplified consumer regions. The test scenario `77075` presents `Southeast Houston / Hobby`. The protected ambiguous scenario `77084` remains ambiguous and can present short candidate choices without collapsing the result to generic Houston or exposing internal prefixes.

## Rural UX

Rural confirmation-required testing uses `75834` with a short candidate list. Copy states that ZIP codes can cover more than one community and asks users to choose the area Gridly should watch. The prototype does not treat county-only evidence as automatic town certainty.

## Manual fallback

`Choose manually` is present at unresolved or uncertain stages. In prototype testing, it closes the prototype and records a prototype-only manual fallback result rather than mutating production setup.

## Prototype isolation

Dedicated state lives in `window.__gridlyLp0516PrototypeState` and may track open state, step, ZIP input, resolver result, candidate options, selected candidate, prototype result, write attempts, and before/after state snapshots.

Prototype results live in `window.__gridlyLp0516PrototypeResult` and include `prototypeOnly: true` and `saved: false`.

## Storage protection

The prototype does not write to localStorage setup keys, session setup keys, onboarding completion keys, active county/community/awareness storage, saved places, Route Watch storage, Supabase, or analytics. The audit reports `productionSetupWrites: 0` and `productionStorageWrites: 0`.

## State protection

The audit reports zero active awareness mutations, zero map focus mutations, zero provider refreshes, and `routeIntelligenceTouched: false`.

## Accessibility

The prototype uses dialog semantics, an accessible ZIP input label, aria-live validation messaging, keyboard-operable buttons, focus management for the ZIP input, visible focus outlines, and mobile-sized touch targets.

## Mobile portrait design

The UI is a focused bottom sheet sized for mobile portrait with one headline, short supporting copy, generous spacing, large touch targets, a clear primary action, and no long technical document.

## Test ZIP scenarios

| Scenario | ZIP | Expected result |
| --- | --- | --- |
| Resolved | `77535` | Dayton resolved screen |
| Governed/Houston | `77075` | Southeast Houston / Hobby resolved screen |
| Requires confirmation | `75834` | Candidate selection screen |
| Ambiguous | `77084` | Ambiguous candidate screen, no silent default |
| PO Box-only | `77201` | PO Box unsupported home-area screen |
| Unique ZIP | `77210` | Unique ZIP unsupported home-area screen |
| Invalid | `abc` | Inline five-digit ZIP validation |
| Unsupported | `99999` | Not available yet screen |
| Rural | `75834` | Rural candidate confirmation copy |

## Audit contract

Run:

```js
window.gridlyLp0516ZipConfirmationPrototypeAudit?.()
```

The audit reports prototype availability, guard state, current step, resolver availability, all flow availability, candidate presentation checks, metadata leak checks, ZIP identity leak checks, production write totals, active mutation totals, protected ZIP results, Houston/rural results, accessibility findings, certification blockers, `safeForGuardedUserTesting`, and `safeForProductionActivation`.

## Certification status

`prototypeCertificationStatus` is `guarded_test_candidate` when the audit has no blockers. `safeForProductionActivation remains false` for LP051.6.

## Known limitations

- This is not production setup activation.
- Candidate lists for confirmation-required prototype scenarios are intentionally short and owner-test oriented.
- The prototype confirms UX comprehension and isolation, not automatic ZIP resolution expansion.

## Owner testing steps

1. Open Gridly in a local development browser.
2. Run `window.gridlyOpenLp0516ZipConfirmationPrototype?.()`.
3. Test each ZIP in the table above.
4. Use Back, Close, and Choose manually from each unresolved path.
5. Run `window.gridlyLp0516ZipConfirmationPrototypeAudit?.()`.
6. Confirm production write and mutation totals remain zero.
7. Close with `window.gridlyCloseLp0516ZipConfirmationPrototype?.()`.
8. Reset with `window.gridlyResetLp0516ZipConfirmationPrototype?.()` if needed.

## Production activation blockers

- Do not enable the guard by default.
- Do not replace production onboarding.
- Do not write confirmed prototype selections to setup storage.
- Do not silently resolve ambiguous ZIPs.
- Do not show ZIP codes as the main awareness identity.
- Do not expose internal keys, source metadata, or resolver classification names.
- Do not set `safeForProductionActivation` to true during LP051.6.

## Recommended next milestone

LP051.7 should run owner-observed mobile portrait sessions, refine candidate copy if needed, and decide whether a separate guarded production experiment is warranted. The recommended next branch is `lp051.7-owner-zip-confirmation-testing`.

## LP051.6R2 Gridly Theme Alignment and ZIP Input Visibility Repair

### Root cause

The LP051.6 guarded prototype focus repair correctly made `#gridly-lp0516-zip-input` active, enabled, writable, and numeric-keyboard friendly, but the presentation layer still used a standalone bright-white prototype sheet and inherited input text colors. In Gridly's current dark/glass appearance, that made typed ZIP text, placeholder copy, candidate choices, validation, and confirmation screens feel disconnected from the app and risked unreadable foreground/background combinations.

### Visual theme alignment

LP051.6R2 keeps the prototype isolated and default-off while aligning its overlay and portrait sheet with Gridly's existing visual rules: `var(--card)`, `var(--border)`, `var(--text)`, `var(--muted)`, `var(--accent)`, `var(--blue)`, `var(--shadow)`, Gridly dark/glass surfaces, subtle borders, 28px top sheet radius, and mobile portrait bottom-sheet spacing. The repair applies to ZIP entry, resolved result, requires-confirmation, ambiguous, unsupported, invalid, PO Box-only, unique ZIP, and final confirmation screens.

### ZIP input text visibility repair

`#gridly-lp0516-zip-input` now has explicit dark-compatible `color`, `background`, `border-color`, `caret-color`, `-webkit-text-fill-color`, `opacity`, placeholder color, selection colors, autofill colors, disabled-state color protection, and a clear focus border/outline. The repair intentionally does not rely on inherited input text color.

### Button hierarchy

Primary actions use the existing Gridly accent-gradient treatment for Continue, Confirm, Preview selection, and the primary unavailable/manual path. Secondary actions use subdued outlined glass controls for Choose manually, Back, and Try another ZIP. Close and Cancel use a quieter tertiary treatment so not every action appears equal.

### Candidate and validation contrast

Candidate options use readable dark/glass controls with explicit text color. Selected candidates receive a distinct accent border, subtle accent fill, and inset highlight while continuing to show consumer-facing community labels only. Inline validation uses the consumer-friendly message `Enter a five-digit ZIP code.` in the Gridly warning token, remains associated to the ZIP field through `aria-describedby`, and reserves a small line height to avoid excessive layout shift.

### Mobile portrait result

The prototype remains a bottom-aligned mobile portrait sheet with `width:min(100%,430px)`, safe-area bottom padding, scrollable max height, visible actions, and usable candidate lists. The repaired sheet no longer appears as a generic bright white web form.

### Audit additions

`window.gridlyLp0516ZipConfirmationPrototypeAudit?.()` now reports:

- `themeAlignmentPass`
- `inputTextVisibilityPass`
- `inputCaretVisibilityPass`
- `placeholderVisibilityPass`
- `buttonHierarchyPass`
- `candidateContrastPass`
- `validationContrastPass`
- `visualIntegrationPass`
- `lightSurfaceLeakDetected`
- `unreadableTextDetected`

Expected LP051.6R2 values are `true` for the pass fields, `false` for leak/unreadable flags, and `safeForProductionActivation: false`.

### Exact browser visual testing steps

1. Open Gridly in a mobile portrait viewport, preferably 390 × 844.
2. Confirm production ZIP setup is not visible by default.
3. In DevTools Console, run `window.gridlyOpenLp0516ZipConfirmationPrototype?.()`.
4. Verify the bottom sheet uses Gridly dark/glass styling, not a bright white standalone sheet.
5. Click the ZIP input and type `77535`; verify typed text, caret, placeholder behavior, selected text, and focus border remain readable.
6. Clear the input, type `abc`, and press Continue; verify `Enter a five-digit ZIP code.` is readable and remains associated with the field.
7. Enter `75834`; verify multiple candidate options are readable, selectable, and show a distinct selected state.
8. Continue through confirmation and verify the final prototype confirmation uses the same dark/glass theme.
9. Reset and test `77084`, `77201`, `77210`, and `99999`; verify ambiguous, PO Box-only, unique ZIP, and unsupported screens use the same styling and readable action hierarchy.
10. Run `window.gridlyLp0516ZipConfirmationPrototypeAudit?.()` and verify the LP051.6R2 visual pass fields match the expected values while `safeForProductionActivation` remains `false`.
11. Confirm localStorage/sessionStorage setup keys and production onboarding remain unchanged.

## LP051.6R3 Preview Selection Action Completion

### Root cause

The ready screen rendered an active **Preview selection** button with `data-action="preview"`, and event delegation recognized that action, but the preview branch only refreshed `window.__gridlyLp0516PrototypeResult`. It did not transition to a new prototype step or rerender the sheet, so the action produced no visible response even though the result object could be updated internally.

### Completed Preview selection behavior

Pressing **Preview selection** now performs a prototype-only completion path:

1. keeps the selected consumer community as the experience label;
2. updates only `window.__gridlyLp0516PrototypeResult` and in-memory prototype state;
3. records `confirmationMethod: "prototype_preview"`, `previewed: true`, and `saved: false`;
4. transitions from `ready` to `preview_complete`;
5. renders a dedicated completion screen.

### Preview-complete screen

The preview-complete screen shows:

- `Selection preview ready`
- the selected community label, for example `Dayton`
- the county label, for example `Liberty County`
- `Gridly would use Dayton for local awareness.`
- `This is a prototype preview. Your current Gridly setup has not changed.`

Available actions are **Done**, **Try another ZIP**, and **Choose manually**.

### Prototype result contract

The result remains prototype-only and resembles:

```js
window.__gridlyLp0516PrototypeResult = {
  zip: "77535",
  countyId: "liberty-tx",
  countyName: "Liberty County",
  communityKey: "dayton",
  communityLabel: "Dayton",
  awarenessAreaKey: "dayton",
  consumerLabel: "Dayton",
  resolutionStatus: "resolved",
  confirmationMethod: "prototype_preview",
  prototypeOnly: true,
  previewed: true,
  saved: false
}
```

No production setup storage keys are used.

### Done behavior

**Done** closes the prototype cleanly and preserves `window.__gridlyLp0516PrototypeResult` for owner inspection. It does not save setup, complete onboarding, change the active county/community/awareness area, move the map, refresh providers, or touch Route Intelligence.

### Try Another ZIP behavior

**Try another ZIP** returns to ZIP entry and clears only prototype ZIP resolver, candidate, selected-candidate, and preview-result state. Production state remains unchanged.

### Zero-write guarantees

LP051.6R3 preserves the LP051.6 zero-write guarantees:

- `productionSetupWrites: 0`
- `productionStorageWrites: 0`
- `activeAwarenessMutations: 0`
- `mapFocusMutations: 0`
- `providerRefreshes: 0`
- `routeIntelligenceTouched: false`
- `safeForProductionActivation remains false`

### Audit fields

`window.gridlyLp0516ZipConfirmationPrototypeAudit?.()` includes Preview selection action-completion fields:

- `previewActionAvailable`
- `previewActionCompleted`
- `previewCompleteFlowAvailable`
- `prototypeResultPreviewed`
- `prototypeResultSaved`
- `previewActionProductionWrites`
- `previewActionStateMutations`
- `previewActionPass`

After pressing **Preview selection**, expected values are:

```js
{
  previewActionAvailable: true,
  previewActionCompleted: true,
  previewCompleteFlowAvailable: true,
  prototypeResultPreviewed: true,
  prototypeResultSaved: false,
  previewActionProductionWrites: 0,
  previewActionStateMutations: 0,
  previewActionPass: true,
  safeForProductionActivation: false
}
```

### Exact browser test steps

1. Open the app in a browser.
2. Open DevTools Console.
3. Run `window.gridlyOpenLp0516ZipConfirmationPrototype?.()`.
4. Enter `77535`.
5. Press **Continue**.
6. Confirm `Dayton`.
7. Verify the ready screen shows **Preview selection**.
8. Press **Preview selection**.
9. Verify the screen title is `Selection preview ready` and the community copy shows `Dayton` and `Liberty County`.
10. Run `window.__gridlyLp0516PrototypeState.step` and verify it returns `"preview_complete"`.
11. Run `window.__gridlyLp0516PrototypeResult` and verify `previewed: true`, `saved: false`, and `confirmationMethod: "prototype_preview"`.
12. Run `window.gridlyLp0516ZipConfirmationPrototypeAudit?.()` and verify `previewActionPass: true`, zero production writes/mutations, and `safeForProductionActivation: false`.
13. Press **Done** and verify the prototype closes while `window.__gridlyLp0516PrototypeResult` remains available.
14. Reopen the prototype, repeat through preview complete, press **Try another ZIP**, and verify only prototype entry/resolver/candidate/selection state resets.
15. Reopen and press **Choose manually** to verify the existing safe manual fallback remains isolated and non-mutating.
