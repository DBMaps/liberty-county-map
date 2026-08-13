# LP190.4 final statewide runtime activation

## Determination

**APPLY was not executed.** The guarded executor audited the LP190.3 reconciliation, then failed closed because the eleven LP190.2 `governedTargetPath` payloads are ignored, owner-local files and are absent from this checkout. LP190.4 must re-hash those exact payload bytes before WHATIF or APPLY can authorize activation.

Runtime therefore remains **243 operational / 11 restricted**. No production, crossing, resolver, or protected-system surface was changed.

## Exact owner PowerShell execution block

Run from the repository root only after restoring all eleven governed LP190.2 target payloads:

```powershell
$ErrorActionPreference = 'Stop'
npm run verify:lp1902
npm run verify:lp1903
node scripts/lp1904-final-statewide-runtime-activation-guarded.mjs --whatif --json
node scripts/lp1904-final-statewide-runtime-activation-guarded.mjs --apply --json
npm run verify:lp1904
npm run test:lp1904
npm run test:lp1896
git status --short
```

## Post-activation consumer smoke plan

1. Enter Dallas ZIP **75201**. Confirm Dallas County resolution, a Dallas community/area confirmation, and active Dallas context instead of “Gridly isn’t available for this ZIP yet”.
2. Enter Liberty ZIP **77575**. Confirm existing Liberty County/Liberty awareness area and active context remain unchanged; confirm Liberty still exposes its certified **115** crossings.
3. Select a smaller final-11 ZIP/community from the restored governed owner payload evidence before running the smoke. This checkout cannot safely derive that value because the governing payload bytes are the missing inputs; do not guess it.
4. During all cases, inspect startup logs for boundary-warning fan-out and confirm none occurs. Confirm coordinate county resolution uses polygon containment, with bounds only as a candidate prefilter.

## Classification

`OWNER_EXECUTION_REQUIRED_MISSING_GOVERNED_INPUTS_FAIL_CLOSED`
