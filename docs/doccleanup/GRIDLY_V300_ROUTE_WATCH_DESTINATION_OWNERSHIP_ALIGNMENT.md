# GRIDLY V300 — Route Watch Destination Ownership Alignment

## Why this audit exists

V300 exists because real-device testing showed the product experience has moved beyond the older question of whether Route Watch can activate. Users now reach Home, Work, saved places, and searched places through **Search Destination**, initiate routing from that workflow, and receive OSRM-backed destination geometry. The remaining question is ownership: whether the product has effectively made Route Watch a destination-based experience while the implementation still treats destination routes and Route Watch routes as separate paths.

This is an audit/documentation pass only. It does not change production behavior, routing behavior, geometry scoring, UI, alerts, reporting, Supabase, notification, desktop, PWA, store-readiness, or marker behavior.

## Historical evolution of Route Watch

- Earlier Route Watch work treated Home/Work and saved selectors as a distinct saved-route monitoring workflow.
- V297 identified that destination route geometry could exist separately from Route Watch geometry observation.
- V298 reframed readiness around whether Route Watch was active, whether endpoints were present, and whether route geometry was retained/rendered.
- V299 corrected false activation failures so idle, closed, and no-route states are not mistaken for broken Route Watch activation.

The accumulated effect is that Route Watch is no longer best understood solely as a standalone saved-commute widget. It is now adjacent to, and frequently reached through, destination routing.

## Destination-search evolution

Search Destination now surfaces the same kinds of places that users expect to route to:

- Home
- Work
- saved places/favorites
- searched destinations such as Marshall's or Walmart

From the user's perspective, selecting any of these is a destination routing action. Route preview and monitoring are follow-on states of that action, not separate mental models.

## Current product behavior

The current user-facing ownership model is:

**B) One destination-based Route Watch experience.**

The user sees a destination-first flow:

1. Choose a destination through Search Destination.
2. Generate a route preview.
3. View route details or Route Watch-style monitoring/readiness.
4. Manage Home, Work, and saved places as destination inputs.

The user does not receive a clear product-level distinction that Home/Work/saved destination routing is one system while searched destination routing is another system.

## Current technical behavior

The implementation still preserves separate ownership paths:

| Area | Current owner |
| --- | --- |
| Destination route ownership | Search Destination owns route request/preview for searched destinations and surfaced saved places. |
| Route Watch ownership | Route Watch owns activation state, saved-place selector monitoring, route relevance, and monitoring copy. |
| Route preview ownership | Fragmented: destination route preview and saved Route Watch route preview can use separate layers/state. |
| Geometry ownership | Shared OSRM route-fetch capability exists, but destination and Route Watch geometry retention/rendering remain separate. |
| Relevance ownership | Route Watch owns relevance/monitoring; destination preview does not own production relevance scoring. |
| Route monitoring ownership | Route Watch owns monitoring once active. |
| Saved place ownership | Saved Places owns persistence; Search Destination surfaces saved places as routable destinations. |

## Ownership drift findings

V300 finds ownership drift between product behavior and implementation behavior:

- Product behavior presents one destination-based routing workflow.
- Implementation behavior still classifies destination routes and saved Route Watch routes as separate ownership paths.
- Destination routing can successfully create OSRM geometry without necessarily being considered Route Watch geometry by older Route Watch audits.
- Route Watch still has a separate activation flow in code, even when the user arrived by selecting a destination from Search Destination.

## User-experience findings

### Does selecting Home from Search Destination create a Route Watch route, destination route, both, or neither?

It creates a **destination route** in the product workflow. If Route Watch is also activated against the same saved-place selection, the runtime can represent **both**, but the user's first action is destination routing.

### Does selecting Work from Search Destination create a Route Watch route, destination route, both, or neither?

It creates a **destination route** in the product workflow. If Route Watch is also activated against the same saved-place selection, the runtime can represent **both**.

### Does selecting Marshall's from Search Destination create a Route Watch route, destination route, both, or neither?

It creates a **destination route**. If Marshall's is also saved and selected through Route Watch activation, the code may later represent **both**, but Search Destination itself creates the destination route.

### Does selecting Walmart from Search Destination create a Route Watch route, destination route, both, or neither?

It creates a **destination route**. Current testing showed Walmart-style destination routes can generate OSRM geometry through destination routing.

### Does Route Watch currently have a separate activation flow?

Yes. The code still exposes Route Watch activation and saved-place selector state separately from destination preview state.

### Does the user perceive a distinction?

Generally no. The user perceives one destination-based route experience, with Route Watch as monitoring/readiness around that route.

### Does the code perceive a distinction?

Yes. Destination route preview, Route Watch activation, relevance observation, and route-monitoring state are still technically distinct.

## Architecture findings

The architecture is fragmented but understandable:

- Destination Search owns route creation/preview intent.
- Route Watch owns route monitoring/relevance intent.
- Geometry fetch capability is shared enough that both flows can produce route geometry.
- Geometry retention/rendering and audit classification remain split.
- Saved Places is an input model, not the user-facing owner of routing.

This means Route Watch has effectively evolved into a destination-based experience at the product level, but the implementation has not fully aligned around that ownership model.

## Risks of preserving incorrect ownership assumptions

If the code continues assuming destination routes and Route Watch routes are separate user-facing systems, Gridly risks:

- false audit failures when destination geometry exists but Route Watch observation does not see it;
- duplicated or conflicting route-preview ownership;
- confusing future work that patches Route Watch activation when the real issue is ownership classification;
- under-observing destination route geometry in audit-only shadow tooling;
- optimizing the legacy saved-route model instead of the current product model;
- making V301 geometry observation choices based on implementation history rather than user reality.

## Audit helper

V300 adds:

```js
window.gridlyRouteWatchDestinationOwnershipAudit?.()
```

The helper returns a read-only payload with:

- `available: true`
- `auditOnly: true`
- `productionBehaviorChanged: false`
- product and technical ownership models
- destination-search and Route Watch ownership flags
- Home, Work, saved-place, and searched-destination classifications
- geometry, route-preview, and relevance ownership summaries
- explicit answers for Home, Work, Marshall's, and Walmart
- `safeForProductionWiring: false`

## V301 recommendation options

### A) Geometry Observation Alignment

Use this only if the next runtime evidence proves destination routing and Route Watch are already technically converged enough that the main gap is audit-only observation coverage.

### B) Route Watch Ownership Refactor

**Recommended for V301.** Ownership drift exists: the product is destination-based, but the implementation remains fragmented across destination preview, Route Watch activation, monitoring, and relevance observation. V301 should align technical ownership around the destination-based Route Watch model without changing production geometry scoring.

### C) Preserve Separation

Not recommended as the default. Preserving separation would only be beneficial if product explicitly reintroduces a user-visible distinction between one-off destination routing and Route Watch monitoring.

### D) Additional Audit

Not required as the default. Evidence is sufficient to identify drift. Additional audit should only be used if real-device output contradicts the V300 helper.

## Final conclusion

Route Watch has evolved into a destination-based experience in the current product. The user experience should be treated as authoritative. V301 should favor a Route Watch ownership refactor that aligns technical ownership with destination-based routing while keeping geometry scoring and production wiring unchanged until separately approved.
