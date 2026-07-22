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
