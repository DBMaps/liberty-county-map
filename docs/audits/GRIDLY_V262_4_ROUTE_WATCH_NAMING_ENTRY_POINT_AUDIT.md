# GRIDLY V262.4 — Route Watch Naming / Entry-Point Audit

V262.4 is audit-only. It adds `window.gridlyRouteWatchNamingEntryPointAudit?.()` to evaluate the current Route Watch naming and entry-point model from a first-time tester perspective.

## Scope

- No UI changes.
- No button changes.
- No navigation changes.
- No routing changes.
- No Route Watch behavior changes.
- No Destination Search changes.
- No Saved Places changes.

## Current Audit Reading

The current product language uses **Route Watch** for the monitoring surface, while the primary mobile/portrait entry point still presents **Route**. That combination partially communicates monitoring through “Watch,” but still leaves a route-creation or active-route-management expectation through “Route.”

## Product Assessment

- **Destination Search should remain the routing owner.**
- **Route Watch should remain the monitoring owner.**
- A first-time tester with an active `Current Location → Walmart` route may still ask whether Route Watch manages that active route or monitors saved/future trips.
- The current entry-point model is not yet consumer-friendly enough to pass without explanation because “Route” competes with the monitoring intent.

## Recommendation

Keep this as an audit-only checkpoint. Future UI-specific work should make the entry point and nearby copy reinforce: **Destination Search = Routing; Route Watch = Monitoring**.
