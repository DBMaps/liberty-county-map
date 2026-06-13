# GRIDLY V301 — Route Watch Ownership Refactor Plan

## Why this plan exists

V301 exists because the product model and technical ownership model are no longer aligned. The current product reality is one destination-based Route Watch experience: the user selects a destination, receives a route, and expects monitoring, intelligence, alerts, and awareness surfaces to describe that route without learning separate ownership models.

This milestone is architecture, documentation, and audit-only. It does not merge code paths, change routing behavior, change Route Watch behavior, change Search Destination behavior, alter geometry scoring, alter alert relevance, or alter monitoring logic.

## V300 findings recap

V300 concluded that Route Watch has evolved into a destination-based experience at the product level while the implementation still preserves separate technical ownership paths. The product model is aligned around destinations, but technical ownership remains fragmented between Search Destination, Route Preview, Route Watch Activation, Route Relevance, Route Monitoring, and Geometry Retention.

The V300 default recommendation was to use V301 for a Route Watch ownership refactor plan before any production wiring. V301 therefore documents the future architecture without changing production behavior.

## Current ownership inventory

| Domain | Current owner | Desired owner | Migration risk |
| --- | --- | --- | --- |
| destination selection | Search Destination plus Saved Places selectors | Destination Intent | Medium |
| destination search | Search Destination | Destination Intent | Low |
| Home | Saved Places persistence, Search Destination surfacing, and Route Watch saved selector | Destination Intent with Saved Places as storage | Medium |
| Work | Saved Places persistence, Search Destination surfacing, and Route Watch saved selector | Destination Intent with Saved Places as storage | Medium |
| saved places | Saved Places persistence and Search Destination routing inputs | Destination Inputs owned by Destination Intent | Medium |
| searched destinations | Search Destination | Destination Intent | Low |
| route preview generation | Search Destination preview path and Route Watch saved-route path | Route Generation | High |
| route geometry retention | Destination preview state, saved route state, and audit-only geometry shadow state | Route Geometry Observation | High |
| route monitoring | Route Watch activation and monitoring state | Route Watch Monitoring | Medium |
| route relevance | Route Watch relevance helpers | Route Intelligence | Medium |
| route intelligence | Route relevance and destination intelligence are adjacent but separate | Route Intelligence | Medium |
| route recommendations | Destination and Route Watch surfaces can independently communicate route state | Awareness Surfaces reading Route Intelligence | Medium |
| alternate routes | Route generation/preview exploration without unified Route Watch ownership | Route Generation with Route Intelligence observation | Medium |
| Route Watch UI ownership | Route Watch surfaces and display/blocker audits | Awareness Surfaces reflecting destination route state | Medium |
| Route Watch activation ownership | Route Watch activation flow separate from destination selection | Route Watch Monitoring begins from generated destination route state | High |

## Future ownership model

The target ownership model is destination-based and staged:

1. **Destination Intent** owns user intent after the user selects Home, Work, a saved place, or a searched destination.
2. **Route Generation** owns producing the route from the selected destination intent.
3. **Route Watch Monitoring** owns monitoring the generated route state.
4. **Route Intelligence** owns evaluating incidents, relevance, recommendations, and route state.
5. **Awareness Surfaces** own presenting the route state without creating a second user-facing mental model.

Target flow:

```text
User selects destination
↓
Route generated
↓
Route Watch monitors route
↓
Route intelligence evaluates route
↓
Awareness surfaces reflect route state
```

This model does not require users to know whether a route began as Home, Work, a saved place, a searched destination, a preview, or a Route Watch activation. Those distinctions may remain implementation details until later approved work decides whether any code paths should converge.

## Ownership drift analysis

### Duplicated ownership

| Area | Current duplicated owners | Risk |
| --- | --- | --- |
| route preview generation | Search Destination and Route Watch | High |
| Home/Work route intent | Saved Places, Search Destination, and Route Watch activation | Medium |

### Fragmented ownership

| Area | Fragments | Risk |
| --- | --- | --- |
| route geometry lifecycle | fetch, preview render, Route Watch retention, shadow observation | High |
| route state communication | destination panel, Route Watch UI, awareness surfaces | Medium |

### Orphan ownership

| Area | Why orphaned | Risk |
| --- | --- | --- |
| destination route geometry as Route Watch observation | Generated destination geometry is not yet the authoritative Route Watch geometry owner | High |
| searched destination monitoring handoff | Search Destination can create route intent before Route Watch monitoring owns it | Medium |

### Legacy ownership

- Route Watch activation still reflects the earlier saved-route/saved-place model.
- Home and Work still carry Saved Places ownership history even when surfaced as destination routing choices.
- Geometry observation still distinguishes destination-route geometry from saved Route Watch geometry.

### Ownership ambiguity

- A destination route can be product-equivalent to a Route Watch route while still technically classified as a destination preview.
- A saved place can be an input, a destination, and a monitoring target.
- Awareness surfaces can read route state without being the owner of route generation or monitoring.

## Migration risks

The plan is safe because it is documentation and audit-only. Future implementation would need stricter controls because the high-risk boundaries are route preview generation, route geometry retention, and Route Watch activation ownership.

Risk summary:

- **Low risk:** destination search and searched-destination ownership naming.
- **Medium risk:** Home, Work, saved places, route monitoring, route relevance, route intelligence, recommendations, alternates, and UI ownership.
- **High risk:** route preview generation, route geometry retention, and Route Watch activation ownership.

## Phased alignment plan

### Phase 1 — Ownership alignment

Document and name the future owner boundaries:

- Destination Intent
- Route Generation
- Route Watch Monitoring
- Route Intelligence
- Awareness Surfaces

No production implementation.

### Phase 2 — Observation alignment

Align audits so destination-created route state can be observed as part of the destination-based Route Watch model. This should remain audit-only and must not change routing, alerts, geometry scoring, or monitoring.

### Phase 3 — Monitoring alignment

Design the handoff from generated destination route state into Route Watch monitoring. This phase should define ownership and data contracts only unless a later milestone explicitly approves implementation.

### Phase 4 — Geometry observation alignment

Design audit-only geometry observation that follows the destination route lifecycle. This should reduce false ownership failures without changing geometry scoring or production geometry retention.

### Phase 5 — Future production consideration

Only after enough audit evidence exists, consider whether any production wiring should be proposed. That future work must be separate, explicit, and reversible.

## What should NOT change

V301 must not change:

- production behavior;
- UI behavior;
- routing behavior;
- Route Watch behavior;
- Search Destination behavior;
- geometry scoring;
- alert relevance;
- monitoring logic;
- alert, popup, marker, reporting, Supabase, awareness, notification, desktop, PWA, store, or directional-display behavior.

## Audit helper

V301 adds a read-only audit helper:

```js
window.gridlyRouteWatchOwnershipRefactorAudit?.()
```

The helper returns ownership inventory, drift mapping, migration risk, the future ownership model, and the recommended phased refactor sequence with `safeForProductionWiring: false`.

## V302 recommendation options

### A) Ownership Alignment Architecture

Recommended default. This is the smallest architecture step that reduces ownership drift without changing production behavior. It should formalize data contracts and owner names around Destination Intent, Route Generation, Route Watch Monitoring, Route Intelligence, and Awareness Surfaces.

### B) Geometry Observation Alignment

Useful after ownership names are stable. This should remain audit-only and avoid geometry scoring or routing changes.

### C) Monitoring Alignment

Useful after ownership and observation contracts are clear. This should not be first because monitoring handoff has higher production-behavior risk.

### D) No further action

Not recommended unless the team intentionally accepts continued technical ownership drift.

## Recommendation for V302

Choose **A) Ownership Alignment Architecture**. It is the smallest next architecture step that reduces ownership drift while preserving the V301 constraint of no production behavior changes.
