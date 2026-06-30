# GRIDLY V856.5E — Location Awareness Component Ownership Audit

## Executive Summary

V856.5E is an audit-only milestone. No JavaScript behavior, CSS, copy, providers, feature flags, protected systems, or runtime ownership paths were changed.

The visible mobile portrait Location Awareness surface is the static `index.html` mobile command card:

- DOM selector: `.map-card > .mobile-destination-command.is-awareness-panel:not([hidden]):not(.is-command-card-suppressed)`
- Key child selectors: `#mobileDestinationCommandTitle`, `#mobileDestinationCommandMeta`, `#mobileAwarenessPanelCrossings`
- Render/write owner: `syncMobileDestinationCommandCard()`

The `.gridly-v2-location-awareness-panel` surface is a separate, dynamically-created Portrait V2 panel owned by `ensureGridlyPortraitLocationAwarenessPanel()` and refreshed by `refreshGridlyPortraitLocationAwarenessPanel()`. In the current render path it is explicitly collapsed after syncing the mobile destination command card: `panel.hidden = true`, `panel.setAttribute("hidden", "")`, and `panel.dataset.bottomSurfaceOwner = "mobile-destination-command"`.

Therefore, the audit conclusion is:

1. The user-visible mobile portrait Location Awareness component is the mobile destination command card, not the dynamically-created `.gridly-v2-location-awareness-panel`.
2. V856.5B/C/D patched the shared quiet-state copy path and supporting write paths that feed `#mobileDestinationCommandMeta`, `#gridlyCommunityPulseSubline`, and the Portrait V2 Awareness Brief; they did not make the hidden `.gridly-v2-location-awareness-panel` visible.
3. The duplicate “Dayton Awareness” search result is caused by parallel DOM surfaces: one visible/active owner and one hidden/collapsed Portrait V2 panel, not by two simultaneously visible bottom cards.
4. V856.5F, if needed, should fix the visible `syncMobileDestinationCommandCard()` / `getGridlyMobileAwarenessPanelSummary()` ownership path and should not target CSS or the hidden `.gridly-v2-location-awareness-panel` unless the product decision is to transfer bottom-surface ownership back to that dynamic panel.

## Browser Evidence Summary

Live DOM validation from the V856.5 quiet-state investigation found:

- The corrected top Awareness Brief quiet copy exists in the live DOM.
- The corrected `#mobileDestinationCommandMeta` quiet copy exists in the live DOM.
- The corrected `#gridlyCommunityPulseSubline` quiet copy exists in the live DOM.
- The stale phrase `No active local issues reported in Dayton` had no live DOM occurrence.
- Searching the DOM for `Dayton Awareness` returned at least two elements:
  - `#mobileDestinationCommandTitle`
  - `.gridly-v2-location-awareness-title`

This evidence is consistent with duplicate or parallel Location Awareness surfaces. The code audit shows those surfaces are separate ownership paths, but the dynamic Portrait V2 panel is collapsed/hidden after it delegates bottom-surface ownership to the mobile destination command card.

## Required Search Coverage

Static searches were performed across `index.html`, `js/app.js`, and `css/styles.css` for:

- `gridly-v2-location-awareness-panel`
- `gridly-v2-location-awareness-title`
- `mobileDestinationCommandTitle`
- `mobileDestinationCommandMeta`
- `mobileAwarenessPanelCrossings`
- `mobile-destination-command`
- `Location Awareness`
- `Dayton Awareness`
- `crossings watched`
- `active hazards`
- `active crossing reports`

The searches show that the mobile destination command card is authored in `index.html`, styled extensively in portrait CSS, and updated by `syncMobileDestinationCommandCard()`. The V2 location-awareness panel is created at runtime, styled separately, refreshed by `refreshGridlyPortraitLocationAwarenessPanel()`, and then hidden in favor of the mobile destination command card.

## Location Awareness DOM Inventory

### Surface A — Mobile Destination Command Card / Visible Location Awareness Owner

| Field | Finding |
| --- | --- |
| DOM selector | `.map-card > .mobile-destination-command`; awareness mode adds `.is-awareness-panel`, `.awareness`, `.owner-awareness`, `.gridly-awareness-owner` |
| Key child selectors | `#mobileAwarenessPanelKicker`, `#mobileDestinationCommandTitle`, `#mobileDestinationCommandMeta`, `#mobileAwarenessPanelCrossings`, `#mobileAwarenessPanelIssues`, `#mobileDestinationCommandImpact`, `#mobileDestinationCommandBtn` |
| Parent/container | `section.command-center#mapSection > section.map-card` |
| Authored location | Static HTML in `index.html` |
| Initial visibility | Authored with `hidden`, `aria-hidden="true"`, and `.is-command-card-suppressed`; runtime controls visibility |
| Mobile portrait visibility | Visible when `getGridlyMobileCommandCardVisibilityState()` returns `visible: true` and awareness mode is active; hidden during popup/session suppression or route/destination ownership states |
| Text nodes rendered in awareness mode | Kicker from `getGridlyLocationAwarenessCardKicker(...)`; title from `awarenessSummary.panelTitle`; meta/status from `awarenessSummary.status`; crossings line from `awarenessSummary.crossingsLine`; issues line cleared/hidden; impact line cleared; button text `Search` |
| Render/write function | `syncMobileDestinationCommandCard()` |
| Source model | `getGridlyMobileAwarenessPanelSummary()` with optional `communityAwarenessSummary` passed through from localized intelligence refresh |
| Classification | Current visible bottom Location Awareness owner in mobile portrait |
| Quiet-state participation | Yes. It writes the quiet-state title/status/crossings values seen in `#mobileDestinationCommandTitle`, `#mobileDestinationCommandMeta`, and `#mobileAwarenessPanelCrossings` |
| Existing tests/audits | Covered indirectly by static ownership/audit helpers and V227/V737 audit state reads; no dedicated browser automation is required for V856.5E |

### Surface B — Dynamic Portrait V2 Location Awareness Panel / Hidden Parallel Surface

| Field | Finding |
| --- | --- |
| DOM selector | `#gridlyPortraitLocationAwarenessPanel.gridly-v2-location-awareness-panel[aria-label="Location Awareness"]` |
| Nodes inside `.gridly-v2-location-awareness-panel` | `.gridly-v2-location-awareness-kicker[data-v2-location-awareness="kicker"]`; `.gridly-v2-location-awareness-title[data-v2-location-awareness="title"]`; `.gridly-v2-location-awareness-status[data-v2-location-awareness="status"]`; `.gridly-v2-location-awareness-meta[data-v2-location-awareness="meta"]`; `.gridly-v2-location-awareness-route[data-v2-location-awareness="routeAction"]` |
| Parent/container | Inserted into `#gridlyPortraitBottomRegion` before `.gridly-v2-bottom-dock`, or appended to `#gridlyPortraitV2`/bottom region fallback |
| Authored location | Runtime-created in `ensureGridlyPortraitLocationAwarenessPanel()` |
| Initial/runtime visibility | The CSS would display this fixed panel when not hidden, but the refresh path explicitly sets it hidden |
| Mobile portrait visibility | Hidden/collapsed in the audited path because `refreshGridlyPortraitLocationAwarenessPanel()` sets `panel.hidden = true` and `hidden` attribute after syncing the command card |
| Text nodes rendered | Kicker defaults to `LOCATION AWARENESS • SELECTED AREA`; title defaults to `Selected Area Awareness`; status defaults to `Your area is clear right now`; meta defaults to `No active community reports need attention.`; route action text defaults to `Route` but remains hidden |
| Render/write function | Created by `ensureGridlyPortraitLocationAwarenessPanel()`; refreshed by `refreshGridlyPortraitLocationAwarenessPanel()`; county title/kicker also updated by `updateCountyOwnedStaticRuntimeLabels()` |
| Source model | Reuses `getGridlyMobileAwarenessPanelSummary()` and quiet support copy, then delegates/syncs visible ownership to `syncMobileDestinationCommandCard()` |
| Classification | Hidden parallel/legacy-current bridge surface; not the visible mobile portrait owner in the current path |
| Quiet-state participation | Yes as a model/write participant, but not as a visible surface because it is collapsed for the command card |
| Existing tests/audits | County runtime ownership tests reference `#gridlyPortraitLocationAwarenessPanel`; V227/V737 audit helpers read the location panel and command-card states |

### Surface C — Community Pulse Subline / Supporting Quiet-State Surface

| Field | Finding |
| --- | --- |
| DOM selector | `#gridlyCommunityPulseSubline` |
| Parent/container | Community Pulse card in `index.html` |
| Mobile portrait visibility | Supporting surface; visibility depends on the Community Pulse card layout, not bottom Location Awareness ownership |
| Text nodes rendered | Quiet/active subline from Community Pulse/localized intelligence write paths |
| Render/write function | Community Pulse render paths around `gridlyCommunityPulseAuditState` and DOM writes to `#gridlyCommunityPulseSubline` |
| Classification | Supporting quiet-state surface, not the bottom Location Awareness component |
| Quiet-state participation | Yes. V856.5D specifically documented this as a supporting quiet-state copy owner |
| Existing tests/audits | Covered by V856.5D documentation and language-consistency/audit helpers that read `#gridlyCommunityPulseSubline` |

## Visibility / Ownership Findings

### Which component is actually visible to the user?

The visible mobile portrait Location Awareness component is the mobile destination command card (`.map-card > .mobile-destination-command`) when runtime marks it as awareness mode. It contains `#mobileDestinationCommandTitle`, `#mobileDestinationCommandMeta`, and `#mobileAwarenessPanelCrossings`.

The dynamic `.gridly-v2-location-awareness-panel` is created and can receive updated copy, which explains why DOM searches find `.gridly-v2-location-awareness-title`. However, `refreshGridlyPortraitLocationAwarenessPanel()` explicitly hides that panel and marks the bottom-surface owner as `mobile-destination-command`.

### Which component was patched in V856.5B/C/D?

Based on the prior milestone docs and current code paths:

- V856.5B/C targeted the Portrait V2 Awareness Brief quiet-state copy and final render ownership.
- V856.5D targeted supporting quiet-state surfaces, including `#mobileDestinationCommandMeta` and `#gridlyCommunityPulseSubline`.
- The visible bottom Location Awareness card receives copy through `syncMobileDestinationCommandCard()` and `getGridlyMobileAwarenessPanelSummary()`.
- The hidden `.gridly-v2-location-awareness-panel` receives related quiet support copy, but then collapses in favor of the command card.

## Duplicate Surface Findings

The duplicate `Dayton Awareness` evidence is real, but the surfaces are not equivalent:

1. `#mobileDestinationCommandTitle` is inside the visible mobile destination command card and is the current user-facing bottom Location Awareness title.
2. `.gridly-v2-location-awareness-title` is inside `#gridlyPortraitLocationAwarenessPanel`, a dynamically-created Portrait V2 panel that is hidden in the current path.

This is best classified as **parallel surfaces with explicit current ownership delegated to the mobile destination command card**, rather than two visible duplicate panels. The hidden panel is not dead code because it still participates in model reuse, county label synchronization, audit visibility checks, and route-action scaffolding.

## Render Path Findings

### Visible command-card render path

1. `syncMobileDestinationCommandCard()` builds or receives `awarenessSummary` via `getGridlyMobileAwarenessPanelSummary()`.
2. It evaluates `getGridlyMobileCommandCardVisibilityState(awarenessSummary)`.
3. It toggles the card's `hidden`, `aria-hidden`, `.is-command-card-suppressed`, `.is-awareness-panel`, and `.is-destination-panel` state.
4. In awareness mode, it writes:
   - `#mobileAwarenessPanelKicker`
   - `#mobileDestinationCommandTitle`
   - `#mobileDestinationCommandMeta`
   - `#mobileAwarenessPanelCrossings`
   - `#mobileAwarenessPanelIssues`
   - `#mobileDestinationCommandImpact`
   - `#mobileDestinationCommandBtn`

### Hidden V2 panel render path

1. `ensureGridlyPortraitLocationAwarenessPanel()` creates `#gridlyPortraitLocationAwarenessPanel` if missing.
2. It injects the `.gridly-v2-location-awareness-*` child nodes.
3. `refreshGridlyPortraitLocationAwarenessPanel()` computes quiet/active copy from the shared awareness summary and quiet copy helpers.
4. It calls `syncMobileDestinationCommandCard({ communityAwarenessSummary: sharedSummary })`.
5. It updates hidden panel dataset/status/meta values.
6. It explicitly hides the V2 panel and records `collapsedForCommandCard: true`.

## Quiet-State Participation Findings

- `#mobileDestinationCommandMeta` participates directly in quiet-state copy because `syncMobileDestinationCommandCard()` writes `awarenessSummary.status` into it during awareness mode.
- `#mobileAwarenessPanelCrossings` participates as the supporting metric/evidence line because the same function writes `awarenessSummary.crossingsLine` into it and unhides it in awareness mode.
- `.gridly-v2-location-awareness-status` and `.gridly-v2-location-awareness-meta` participate in the hidden panel's model writes, but the panel is not visible in the current path.
- `#gridlyCommunityPulseSubline` participates as a separate supporting surface, not as the Location Awareness bottom card.
- The stale phrase issue is not explained by currently visible duplicate bottom panels. If stale copy is visible to users after V856.5D, the most likely cause is a late or separate write into the visible command-card summary path, not the hidden V2 panel.

## Risk Assessment

| Risk | Level | Rationale |
| --- | --- | --- |
| Fixing the hidden `.gridly-v2-location-awareness-panel` only | High | Would not address the visible mobile portrait bottom card because the visible owner is the command card. |
| CSS-only fix | High | Visibility is runtime-owned; the dynamic panel is explicitly hidden after refresh. |
| Copy-only fix in one fallback | Medium | Multiple write paths can feed `getGridlyMobileAwarenessPanelSummary()` and the command-card status line. |
| Removing the hidden V2 panel | Medium/High | It still supports audits, county label sync, route-action scaffolding, and ownership transition evidence. |
| Narrowly auditing/fixing `syncMobileDestinationCommandCard()` input model | Low | This is the visible render owner and is the correct V856.5F scope if stale visible copy persists. |
| Protected-system regression | Low if V856.5F remains presentation/render-ownership only | No provider, reporting, Supabase, hazard lifecycle, Route Watch, DriveTexas, Weather, alert generation, or Unified Intelligence changes are required. |

## Recommended V856.5F Fix Scope

If V856.5F is authorized, keep it narrow:

1. Target the visible owner path:
   - `getGridlyMobileAwarenessPanelSummary()`
   - `getGridlyMobileCommandCardVisibilityState()` only if visibility classification is wrong
   - `syncMobileDestinationCommandCard()`
2. Verify all late writers to `#mobileDestinationCommandTitle`, `#mobileDestinationCommandMeta`, and `#mobileAwarenessPanelCrossings` use the canonical V856.5 quiet-state model.
3. Do not change CSS unless the product decision is to switch visible ownership from `.mobile-destination-command` back to `.gridly-v2-location-awareness-panel`.
4. Do not change provider data, report lifecycle, Route Watch behavior, Supabase, DriveTexas, Weather, Cross Provider Evaluation, Unified Intelligence behavior, alert generation, or hazard lifecycle.
5. Add or update a static audit/test only if needed to assert that the visible command card, not the hidden V2 panel, owns the mobile portrait bottom Location Awareness copy.

## Exact Testing Steps

1. Run static selector search:
   ```bash
   rg -n "gridly-v2-location-awareness-panel|gridly-v2-location-awareness-title|mobileDestinationCommandTitle|mobileDestinationCommandMeta|mobileAwarenessPanelCrossings|mobile-destination-command|Location Awareness|Dayton Awareness|crossings watched|active hazards|active crossing reports" index.html js/app.js css/styles.css
   ```
2. Inspect the visible command-card authoring and render function:
   ```bash
   sed -n '400,416p' index.html
   sed -n '27541,27620p' js/app.js
   ```
3. Inspect the dynamic hidden panel creation and collapse path:
   ```bash
   sed -n '80842,81057p' js/app.js
   ```
4. Inspect portrait CSS visibility rules for both surfaces:
   ```bash
   sed -n '12598,12670p' css/styles.css
   sed -n '13643,13643p' css/styles.css
   sed -n '19889,19902p' css/styles.css
   ```
5. Run whitespace validation:
   ```bash
   git diff --check
   ```
6. Optional browser console validation after serving locally:
   ```js
   [...document.querySelectorAll('.gridly-v2-location-awareness-panel *')].map((node) => ({
     selector: node.id ? `#${node.id}` : `.${[...node.classList].join('.')}`,
     hidden: node.hidden,
     text: node.textContent.trim()
   }))
   ```
   ```js
   ['mobileDestinationCommandTitle', 'mobileDestinationCommandMeta', 'mobileAwarenessPanelCrossings'].map((id) => {
     const node = document.getElementById(id);
     const card = node?.closest('.mobile-destination-command');
     return { id, text: node?.textContent.trim(), cardHidden: card?.hidden, cardClass: card?.className };
   })
   ```
   ```js
   [...document.querySelectorAll('body *')]
     .filter((node) => /Dayton Awareness/i.test(node.textContent || ''))
     .map((node) => ({ id: node.id, className: node.className, hidden: node.hidden, text: node.textContent.trim().slice(0, 120) }));
   ```
   ```js
   document.body.innerText.includes('No active local issues reported in Dayton')
   ```

## Merge Recommendation

Merge recommended for V856.5E as documentation-only audit evidence.

This milestone clarifies component ownership without changing runtime behavior. The correct V856.5F implementation target, if stale visible copy is still observed, is the visible mobile destination command card render path and its shared awareness summary model. The hidden `.gridly-v2-location-awareness-panel` should be treated as a parallel/collapsed ownership bridge unless V856.5F explicitly decides to change visible bottom-surface ownership.

## Quick Summary

- Visible mobile portrait Location Awareness = `.map-card > .mobile-destination-command` in awareness mode.
- Hidden parallel Location Awareness = `#gridlyPortraitLocationAwarenessPanel.gridly-v2-location-awareness-panel`.
- `#mobileDestinationCommandTitle` and `.gridly-v2-location-awareness-title` can both contain `Dayton Awareness`, but only the command-card title is the current visible bottom-surface owner.
- V856.5F should target `syncMobileDestinationCommandCard()` and `getGridlyMobileAwarenessPanelSummary()` if a visible stale-copy issue remains.

## Root Cause Hypothesis

The stale-copy investigation likely crossed two different Location Awareness surfaces. Prior fixes corrected canonical quiet-state copy and supporting paths, and live DOM validation confirmed the stale phrase was gone. The duplicate `Dayton Awareness` finding is explained by a visible command-card title plus a hidden dynamic V2 panel title. If users still see stale Location Awareness copy, the root cause is more likely a late write or alternate summary feeding the visible command card than a visible duplicate `.gridly-v2-location-awareness-panel`.
