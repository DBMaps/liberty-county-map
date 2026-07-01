# GRIDLY V706 — Directional Awareness Persistence Audit

## Executive Summary

Directional awareness does render. The writer is the V704 Directional Awareness Layer, which writes `US 90 Westbound` and `Traffic impacts reported near Dayton.` directly into the top Awareness Brief DOM nodes after the document is ready.

Directional awareness then disappears because the normal portrait awareness refresh path reclaims the same DOM nodes. After active incident / community awareness hydration, `refreshPortraitV2LocalizedIntelligence()` writes the shared active-awareness model into `#gridlyV2TopStatusPrimary` and `#gridlyV2TopStatusSecondary`, replacing the directional text with incident-aware copy such as `Disabled Vehicle on US 90 at Waco Street` and `Awaiting additional reports...`.

Final determination: **A and C**. Directional awareness renders successfully and is later overwritten. It also competes for the same Awareness Brief surface against the established Awareness Brief ownership chain and loses because the directional layer has no retained ownership arbitration hook, no refresh-loop participation, and no priority path after active awareness hydration. This is an integration/ownership defect for persistence expectations, not evidence that directional content failed to generate.

## Observed Behavior

| Phase | Visible copy | Owner / writer | Evidence |
| --- | --- | --- | --- |
| Initial directional render | `US 90 Westbound` / `Traffic impacts reported near Dayton.` | `gridlyDirectionalAwarenessLayer.renderTopAwareness()` via `gridlyApplyDirectionalAwarenessCards()` | Directional card seed and direct `textContent` writes in `js/gridlyDirectionalAwarenessLayer.js`. |
| Later hydrated render | Active incident wording such as `Disabled Vehicle on US 90 at Waco Street` / `Awaiting additional reports...` | `refreshPortraitV2LocalizedIntelligence()` | Portrait refresh builds a shared localized intelligence snapshot, then writes Awareness Brief primary and secondary fields to the same top-status DOM nodes. |
| Final audit state | `candidateCount: 164`, `visibleDirectionalCards: 0`, `userVisible: false`, `candidateVisibilityMismatch: true` | Directional candidates still exist; final DOM no longer contains directional tokens | V705-style visibility audit reads `document.body.innerText` and reports no visible `Northbound/Southbound/Eastbound/Westbound` text. |

## Ownership Trace

### Directional Awareness Layer

The directional layer contains a fixed card set. The first card is the exact observed text:

- Header: `US 90 Westbound`
- Body: `Traffic impacts reported near Dayton.`

The layer creates an awareness state only when the directional consumer is service-available, safe for consumer phase, county-contained, fail-closed clean, and backed by strong candidates. When eligible, `renderTopAwareness()` writes the first directional card into the same top Awareness Brief elements used by the rest of the portrait app:

- `#gridlyV2TopStatusPrimary`
- `#gridlyV2TopStatusSecondary`

It sets `data-gridly-directional-awareness="true"` on both nodes and stores rendered cards on `window.gridlyDirectionalAwarenessRenderedCards`, but it does not register with the app's top-panel ownership trace and does not participate in later refresh arbitration.

### Awareness Brief Rendering

The static markup defines the top status card as the Awareness Brief surface. Its primary and secondary copy live in:

- `#gridlyV2TopStatusPrimary`
- `#gridlyV2TopStatusSecondary`

The documented static writers for those same nodes are:

1. Initial `index.html` fallback text.
2. `refreshPortraitV2LocalizedIntelligence()` localized-intelligence text assignment.

The ownership audit classifies `refreshPortraitV2LocalizedIntelligence()` as the Awareness Brief localized-intelligence writer and, when matching active awareness, as `route intelligence / lightweight active awareness` in the current owner inference.

### Top Awareness Rendering

The top Awareness Brief write path uses `setGridlyTopPanelTextIfChanged()`. That helper normalizes copy, writes `textContent`, records background-loop write counts, and records ownership trace entries for recognized top-status targets. Because `refreshPortraitV2LocalizedIntelligence()` calls this helper for both top-status nodes, its writes become the final tracked owner after hydration.

### Active Incident Rendering

Active incident / active awareness text is composed through `buildGridlyAwarenessBriefCopy()` and the portrait shared localized intelligence snapshot. When active counts are present, Awareness Brief primary copy is built from narrative promotion and location-first top-awareness logic. The shared active-state path can then select a location-specific incident headline, including road-hazard style text such as a disabled vehicle on US 90.

The later active-state model also constructs evidence ownership through `buildGridlyActiveStateEvidenceOwnershipSnapshot()`. That model assigns Awareness Brief ownership to `what_happened` and `why_gridly_elevated_it`, while Community Pulse owns `where_it_is_happening`.

### Community Pulse Rendering

Community Pulse has its own surface and sync function. `syncGridlyCommunityPulseCopyFromModel()` writes to `#gridlyCommunityPulseHeadline`, `#gridlyCommunityPulseSubline`, and `#gridlyCommunityPulseHistoricalContext`; it does not write the Awareness Brief top-status nodes. During portrait refresh it is synchronized from the same active-state model, so it is a sibling consumer of the hydrated awareness state rather than the direct overwriter of `US 90 Westbound`.

### Awareness Refresh Cycles

Relevant refresh triggers include:

- Initial bootstrap calls `renderGridlyCommunityPulse({ reason: "initial_bootstrap" })`.
- Alert/location sync calls `refreshPortraitV2LocalizedIntelligence()` and then may render Community Pulse.
- User-location refresh calls both Community Pulse and portrait localized intelligence.
- Portrait refresh orchestration calls `refreshPortraitV2LocalizedIntelligence()`, `renderGridlyCommunityPulse()`, and `updateDailyHabitStatus()`.
- Unified incident rendering calls Community Pulse after incident render.
- Route intelligence update calls Community Pulse.

The overwrite trigger is the first post-directional portrait localized-intelligence refresh that computes active awareness / incident copy and calls `setGridlyTopPanelTextIfChanged()` on the top-status nodes.

## Initial Owner

**Initial owner:** V704 Directional Awareness Layer.

**Write source:** `gridlyApplyDirectionalAwarenessCards()` → `renderTopAwareness(awarenessState)`.

**Target elements:** `#gridlyV2TopStatusPrimary` and `#gridlyV2TopStatusSecondary`.

**Directional render detected:** `true`.

**Directional render timestamp/order:** after script execution when `document.readyState !== "loading"`, or on `DOMContentLoaded`; then again on `setTimeout(..., 0)`. This places the directional write after initial markup and before later app refresh/hydration writes.

## Final Owner

**Final owner:** Portrait V2 Awareness Brief localized intelligence, using the shared active-awareness / active-incident model.

**Final writer:** `refreshPortraitV2LocalizedIntelligence()`.

**Final ownership decision:** active-state evidence ownership gives Awareness Brief the `what_happened` and `why_gridly_elevated_it` slots. Community Pulse owns `where_it_is_happening`. Directional Awareness has no final ownership slot in this chain.

**Final awareness owner:** `awareness_brief_localized_intelligence` / `shared_active_awareness` when active incident hydration is present.

## Overwrite Trigger

**Overwrite detected:** `true`.

**Overwrite source:** `refreshPortraitV2LocalizedIntelligence()` writing `textModel.awarenessPrimary` and `textModel.awarenessSecondary` through `setGridlyTopPanelTextIfChanged()`.

**Mechanism:** both the directional layer and portrait localized-intelligence layer write the same DOM nodes. Directional writes direct `textContent`; portrait refresh writes through the top-panel helper and ownership trace. The later portrait write replaces the earlier directional text.

## Refresh Trigger

The specific triggering event can vary by runtime path, but the traced refresh loop shows several authorized paths that can occur after the directional layer runs:

- Alert-location synchronization.
- Scoped pulse / portrait awareness refresh.
- User-location refresh.
- Main portrait refresh orchestration.
- Unified incident rendering.
- Route intelligence update.

Any of these that causes `refreshPortraitV2LocalizedIntelligence()` with hydrated active-awareness state can displace the directional text.

## Awareness Brief Ownership Chain

1. **Initial DOM fallback** — `index.html` owns the first static fallback copy before JavaScript refresh.
2. **Directional temporary writer** — V704 Directional Awareness Layer writes `US 90 Westbound` if the directional consumer state passes its gates.
3. **Shared active-awareness model** — Community Pulse / active awareness / localized intelligence produce the active incident model.
4. **Active-state evidence ownership** — `buildGridlyActiveStateEvidenceOwnershipSnapshot()` assigns Awareness Brief to `what_happened` and `why_gridly_elevated_it`; Community Pulse owns `where_it_is_happening`.
5. **Portrait localized-intelligence DOM writer** — `refreshPortraitV2LocalizedIntelligence()` writes the final Awareness Brief primary/secondary text and becomes the final traced owner.

## Root Cause

Directional awareness is implemented as a one-time/early direct DOM write into the Awareness Brief top-status elements. It is not integrated into the established Awareness Brief ownership model, active-state evidence ownership, top-panel arbitration, or refresh-loop priority system.

Therefore, once incident intelligence hydrates and the portrait localized-intelligence refresh runs, the established Awareness Brief owner overwrites directional text. The directional audit still sees `candidateCount: 164` because candidate generation and eligibility remain true, but `visibleDirectionalCards: 0` because the final DOM no longer contains any directional tokens.

## Final Determination

- **A) Render successfully then get overwritten:** **Yes.**
- **B) Render as placeholder content until incident intelligence becomes available:** **No as an explicit product mechanism.** The code does not label directional awareness as a placeholder, but its early direct DOM write behaves like temporary pre-hydration content because later authoritative refreshes reclaim the surface.
- **C) Compete with another awareness owner and lose ownership arbitration:** **Yes.** It competes for the same DOM nodes and loses to the established Awareness Brief localized-intelligence owner. The loss is implicit DOM-last-writer-wins behavior, not a formal directional arbitration decision.

## Required Evidence

| Evidence item | Value |
| --- | --- |
| Directional render detected | `true` |
| Directional render timestamp/order | DOMContentLoaded / immediate ready-state path, plus zero-delay timeout retry, before later portrait refreshes. |
| Overwrite detected | `true` |
| Overwrite source | `refreshPortraitV2LocalizedIntelligence()` top-status writes. |
| Final awareness owner | Awareness Brief localized intelligence / shared active awareness. |
| Directional ownership retained | `false` |
| Directional ownership displaced | `true` |
| Candidate generation retained | `true` (`candidateCount: 164`) |
| Final DOM directional visibility retained | `false` (`visibleDirectionalCards: 0`, `userVisible: false`) |

## Protected Systems Verification

Verified unchanged by this audit package:

```json
{
  "historicalReadsEnabled": false,
  "historyUiEnabled": false,
  "DriveTexasPaused": true,
  "TransportationIntelligenceEnabled": false,
  "TransportationIntelligenceDisplay": false,
  "TransportationIntelligenceActivation": false
}
```

## Recommendations

No runtime behavior changes are made in V706. For a future implementation milestone, decide explicitly whether directional awareness is allowed to own the Awareness Brief after hydration. If persistence is desired, add a formal ownership slot or arbitration rule instead of relying on direct DOM writes. If persistence is not desired, document directional awareness as a pre-hydration/diagnostic writer and update the audit language so `candidateVisibilityMismatch` is expected when active incident ownership takes over.
