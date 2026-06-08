# GRIDLY V262.3 — Route Watch Separation Plan

## Quick Summary

V262.3 is audit/planning only. It recommends **Model B**: Destination Search owns current destination routing, while Route Watch owns saved-trip monitoring. No UI labels, placements, routing behavior, Route Watch behavior, saved places, hazards, alerts, crossings, Directional Intelligence, Trust Resolution, Supabase, or feedback systems are changed in this version.

## Files Reviewed

- `index.html` — reviewed current Route Watch and route-related surface labels, buttons, and bottom/shell entry points.
- `js/app.js` — reviewed V262.1 context-aware route surface audit, V262.2 Route Watch ownership audit, destination route preview ownership, Route Watch monitoring controls, and route quick-panel ownership checks.
- `docs/audits/GRIDLY_V261_BETA_READINESS_REVIEW_AUDIT.md` — reviewed beta-readiness framing for first-time tester expectations and protected beta systems.

## Future Ownership Model

### Destination Search Owner

Destination Search should own current destination routing:

- Current Location → Walmart.
- Current Location → Home, Work, or Favorite.
- Current route preview.
- Current Route Details.
- Show full route.
- Clear current route.

### Route Watch Owner

Route Watch should own monitoring:

- Saved or recurring start → destination trips.
- Home → Work monitoring.
- Monitoring on/off state.
- Route readiness.
- Delay/change awareness.
- Pre-departure Know Before You Go trip checks.

### Route Button Current Purpose

The current Route button carries mixed historical ownership. Depending on context, it can feel like current-route details, Route Watch setup, or route creation.

### Route Button Future Purpose

The future bottom-dock route/watch surface should promise monitoring first. Current destination routing should remain with Destination Search, while Current Route Details should act as the bridge when a destination route is already active.

## Product Questions

1. **If Destination Search owns routing, what should Route Watch own?**  
   Route Watch should own saved-trip monitoring, readiness, delays, changes, and monitoring on/off state.

2. **Should Route Watch remain a bottom-dock item?**  
   Yes. Monitoring is a frequent Know Before You Go action and should remain easy to reach.

3. **Should Route become Watch?**  
   Not as the preferred plan. “Watch” is concise but too abstract for first-time testers unless paired with explanatory copy.

4. **Should Route become Route Watch?**  
   Yes, this is the clearest label if a later UI version approves a rename.

5. **Should Route Watch move into Manage Places?**  
   No. Manage Places should own saved-place editing, not active trip monitoring.

6. **Should active route details remain under Route?**  
   Not as primary ownership. Active route details should belong to Destination Search / Current Route Details, with secondary access to Route Watch monitoring.

7. **What would a first-time Dayton tester expect?**  
   A first-time Dayton tester would expect Destination Search to handle Current Location → Walmart and Route Watch to monitor saved trips such as Home → Work.

## Option Comparison

### Option A — Rename Route → Route Watch

Bottom Dock: Report · Route Watch · Alerts · History · Settings

**Pros**

- Most explicit monitoring product name.
- Preserves bottom-dock discoverability.
- Matches existing Route Watch terminology.
- Better separates monitoring from Destination Search routing.

**Cons**

- Longer dock label.
- Still contains the word “Route,” so supporting copy must emphasize monitoring.

### Option B — Rename Route → Watch

Bottom Dock: Report · Watch · Alerts · History · Settings

**Pros**

- Shortest label.
- Strong monitoring signal.
- Reduces “create another route” expectation.

**Cons**

- Too abstract by itself.
- First-time testers may not understand that Watch means trip/route monitoring.
- Requires explanatory copy elsewhere.

### Option C — Move Route Watch into Manage Places

**Pros**

- Groups Home/Work/Favorites dependencies with saved-place management.
- Reduces bottom-dock route ownership ambiguity.

**Cons**

- Hides a time-sensitive monitoring feature.
- Makes monitoring feel like settings/place administration.
- Weakens the Awareness Platform First mission.

### Option D — Routes Umbrella

Routes owns Destination Routing, Route Watch, Saved Routes, and Current Route.

**Pros**

- Scales to a future route information architecture.
- Could eventually support saved routes and current-route history.

**Cons**

- Too large for V262.3.
- Recreates mixed ownership risk.
- Conflicts with the current pause on Directional Intelligence.

### Option E — Recommended Alternative

Keep the monitoring entry in the bottom dock, use **Route Watch** as the explicit future product name, and keep current routing owned by Destination Search / Current Route Details.

**Pros**

- Cleanly separates user jobs.
- Keeps monitoring easy to reach.
- Minimizes risk because behavior does not change in this planning version.
- Gives first-time testers a clearer expectation.

**Cons**

- Requires a later UI implementation to rename/clarify the dock entry.
- Needs careful cross-link copy between Current Route Details and Route Watch setup.

## Recommended Separation Plan

1. Keep V262.3 audit-only.
2. Adopt Model B as the product direction.
3. Plan a later UI version where the bottom-dock Route entry becomes monitoring-first, preferably **Route Watch**.
4. Keep Destination Search as the owner for current route creation and details.
5. Keep Manage Places focused on editing saved places.
6. Use Current Route Details as the safe bridge to Route Watch monitoring when a current route is active.
7. Do not resume Directional Intelligence as part of this separation.
8. Keep Trust Resolution draft-only.

## First-Time Tester Analysis

### Scenario 1 — Current Location → Walmart Active

The Route button should not feel like it creates another route. The clearest expectation is: open Current Route Details first, then offer Route Watch only as a secondary monitoring/manage action.

### Scenario 2 — No Route Active, User Wants Home → Work Monitoring

The user should go to the bottom-dock monitoring entry, ideally Route Watch, select saved Home → Work, and start monitoring.

### Scenario 3 — Home, Work, and Favorites Saved

The clearest ownership model is:

- Manage Places edits saved places.
- Destination Search routes to one saved place now.
- Route Watch monitors a saved trip over time.

## Merge Recommendation

Merge V262.3 as audit-only instrumentation and planning documentation. Do not implement UI separation, rename buttons, move surfaces, or change behavior until a follow-up UI-specific version is approved.

## Exact Testing Steps

1. Open the app in a browser.
2. Run `window.gridlyRouteWatchOwnershipAudit?.()` and confirm V262.2 still returns the existing ownership audit.
3. Run `window.gridlyRouteWatchSeparationAudit?.()`.
4. Confirm the returned object includes `available: true` and `version: "V262.3"`.
5. Confirm `destinationRoutingOwner` describes Destination Search current routing ownership.
6. Confirm `routeWatchOwner` describes monitoring ownership.
7. Confirm `ownershipSeparationRecommended` is `true` when routing and monitoring ownership are both detectable.
8. Confirm `routeButtonFuturePurpose` is monitoring-first and does not claim UI changes were implemented.
9. Confirm `consumerFriendlyPass` and `firstTimeTesterClarityImproved` are true for the plan.
10. Confirm no labels, buttons, layout, routing behavior, Route Watch behavior, saved places, alerts, hazards, crossings, feedback, Supabase, Directional Intelligence, or Trust Resolution behavior changed.
