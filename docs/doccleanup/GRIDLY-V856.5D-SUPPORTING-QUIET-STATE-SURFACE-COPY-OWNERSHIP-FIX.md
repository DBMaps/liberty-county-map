# GRIDLY V856.5D — Supporting Quiet-State Surface Copy Ownership Fix

## Root Cause

The top Awareness Brief already used the V856.5 quiet-state copy model from `getGridlyQuietAwarenessBriefCopy()`, but supporting surfaces still rebuilt their own quiet copy in separate render paths.

The stale ownership paths were:

- `normalizeGridlyMobileAwarenessPanelSummary()` rebuilt `mobileDestinationCommandMeta` as area-specific fallback text and rebuilt `mobileAwarenessPanelCrossings` as a technical count string.
- `buildGridlyActiveStateEvidenceOwnershipSnapshot()` owned the Community Pulse quiet subline with an older nearby/local-issues phrase.
- Location Awareness summary helpers and the portrait Location Awareness panel could reuse stale awareness summary crossing/count fallback text when quiet.

## Affected DOM Owners

- `mobileDestinationCommandMeta`
- `mobileAwarenessPanelCrossings`
- `gridlyCommunityPulseSubline`
- Portrait `Location Awareness` panel status/meta nodes
- Community Pulse model sync path via active-state evidence ownership and awareness summary display

## Stale Copy Paths Found

Removed user-visible quiet fallback ownership for:

- `No active local issues reported in <area>`
- `No active local issues reported nearby.`
- `0 active hazards`
- `0 active crossing reports`
- older Location Awareness quiet summary fallbacks that said local/countywide issues were reported clear without using the V856.5 model

## Files Changed

- `js/app.js`
  - Added a shared support-surface quiet copy helper that derives from the canonical V856.5 Awareness Brief quiet model.
  - Updated mobile destination/awareness quiet copy to use calm consumer language and keep crossing counts secondary.
  - Updated Community Pulse quiet ownership to use the V856.5 quiet subline.
  - Updated Location Awareness quiet meta/status fallbacks to avoid technical zero-count strings.

## Protected-System Confirmation

This is a presentation-copy ownership fix only.

No provider, networking, Supabase, report, Route Watch, hazard lifecycle, alert generation, DriveTexas, Weather Provider, Cross Provider Evaluation, Unified Intelligence, or feature-flag behavior was modified.

## Exact Validation Steps

Programmatic validation:

```bash
node --check js/app.js
node tests/unified-intelligence-awareness-brief-prototype.test.js
node tests/county-runtime/v666LocationAwarenessCountAlignment.test.js
git diff --check
```

Manual browser console validation after hard refresh and after waiting at least 10 seconds:

```js
[
  "gridlyV2TopStatusPrimary",
  "gridlyV2TopStatusSecondary",
  "gridlyV2TopStatusTrust",
  "mobileDestinationCommandMeta",
  "mobileAwarenessPanelCrossings",
  "gridlyCommunityPulseSubline"
].map(id => ({
  id,
  text: document.getElementById(id)?.textContent?.trim() || null
}))
```

Also run:

```js
[...document.querySelectorAll("*")]
  .filter(el => /No active local issues|No active local issues reported nearby|0 active hazards|0 active crossing reports/.test(el.textContent || ""))
  .map(el => ({
    tag: el.tagName,
    id: el.id,
    className: el.className,
    text: el.textContent.trim().slice(0, 200)
  }))
```

Expected result: no user-visible support surface depends on stale quiet-state phrases.

## Merge Recommendation

Merge after the required automated checks pass and browser validation confirms the top Awareness Brief remains unchanged while supporting quiet-state surfaces no longer show stale local-issues or zero-count technical copy.
