# GRIDLY V303 — Active Route Context Implementation Plan

## Why V303 Exists

V303 defines the smallest production-safe implementation step for aligning Route Watch with the read-only Active Route Context model established in V302.

The goal is not to change routing, Route Watch behavior, UI, geometry scoring, alerts, Supabase, awareness, or directional display. The goal is to identify the safest first implementation step that lets Route Watch, route intelligence, route recommendations, monitoring diagnostics, and future geometry observation reference a shared route-context description instead of independently inferring route state.

## V300–V302 Recap

### V300 — Route Watch Destination Ownership Alignment

V300 established that the product experience is destination-based:

- Home, Work, saved places, and searched destinations all participate in the same user route workflow.
- Destination Search can create a current route.
- Route Watch remains the monitoring/readiness experience for saved or recurring trips.
- The user-facing model is one destination-based routing workflow, even though the implementation keeps separate technical paths.

### V301 — Route Watch Ownership Refactor Plan

V301 established that ownership drift exists between product reality and technical ownership:

- Destination intent, route generation, Route Watch monitoring, route intelligence, recommendations, and geometry observation infer or own route state differently.
- Route Watch activation and destination route creation remain technically separate.
- Refactoring should be staged because production ownership changes could affect routing, monitoring, relevance, and UI.

### V302 — Route Watch Ownership Alignment Architecture

V302 established a read-only Active Route Context architecture that can represent:

- no route
- searched destination route
- saved destination route
- Home route
- Work route
- Route Watch monitored route
- cleared route

V302 intentionally did not introduce a shared production route owner. It documented an observable context model that can be read by audits and future diagnostic consumers without changing production behavior.

## Active Route Context Consumer Inventory

| Consumer | Current source of truth | Future source of truth | Migration risk |
| --- | --- | --- | --- |
| Route Watch | Route Watch activation flags, selected saved-place controls, route preview layers, active route labels, route relevance helpers, and Route Watch monitoring state. | `getActiveRouteContext()` for read-only route identity/context; Route Watch keeps activation, monitoring lifecycle, and relevance ownership. | Medium |
| Route Watch Debug | Ad hoc debug reads from Route Watch flags, DOM controls, route preview layers, route labels, and last route attempt fields. | `getActiveRouteContext()` snapshot plus existing debug-only Route Watch diagnostics. | Low |
| Functional Readiness | Functional readiness audit reads Route Watch flags, destination preview state, saved places, OSRM state, route layers, and V296 audit state independently. | `getActiveRouteContext()` for shared route-state classification while retaining readiness-specific checks. | Low |
| Geometry Runtime Shadow Audit | V296 geometry shadow candidates and Route Watch geometry/relevance runtime fields. | `getActiveRouteContext()` for candidate route classification before future audit-only geometry observation. | Medium |
| Destination Ownership Audit | Destination preview state, saved places, Route Watch activation, shared geometry helpers, and separate layer detection. | `getActiveRouteContext()` for route context classification and ownership boundary checks. | Low |
| Route Intelligence | Destination route intelligence and Route Watch relevance helpers infer active route paths separately. | `getActiveRouteContext()` to identify active route context before reading geometry, travel-time, or relevance state. | Medium |
| Route Recommendations | Awareness and route recommendation copy infer route state from destination preview, Route Watch monitoring, and recommendation-specific status. | `getActiveRouteContext()` for route context only; recommendation rules remain separate. | Medium |
| Alternate Route Logic | Route generation/preview exploration state without a shared active-route owner. | `getActiveRouteContext()` for baseline active route identity before alternate route candidates are compared. | Medium |
| Route Monitoring | Route Watch activation state, selected route, labels, durations, hazard assessment, and relevance helpers. | `getActiveRouteContext()` for monitored route identity while Route Watch keeps lifecycle ownership. | Medium-high |
| Future geometry observation | Not yet production-wired; audit-only geometry observation is Route Watch-specific. | `getActiveRouteContext()` route identity and geometry availability before audit-only observation. | Medium |

## First Implementation Candidate

### Option A — Introduce a shared read-only getter

```js
getActiveRouteContext()
```

This getter would return the existing V302-style Active Route Context snapshot. It would not mutate route state, subscribe consumers, generate routes, activate Route Watch, score geometry, influence alerts, or render UI.

### Option B — Publish a shared runtime snapshot

A shared runtime snapshot would centralize route state, but it introduces lifecycle risk because consumers must understand refresh timing, cache invalidation, and subscription behavior. That is more implementation surface than V303 needs.

### Option C — Publish route ownership state only

Publishing ownership state only is too narrow. Future consumers need route context type, source, destination type, geometry availability, monitoring activity, route preview availability, and ownership notes.

## Recommended Implementation

Recommendation: **Option A — introduce a shared read-only getter: `getActiveRouteContext()`**.

This is the smallest production-safe implementation step because it centralizes route-state reads without changing any production writer or behavior path.

The first implementation should:

1. Wrap the V302 Active Route Context snapshot builder.
2. Return a plain object.
3. Be read-only by convention and implementation.
4. Avoid subscriptions.
5. Avoid caching unless explicitly needed later.
6. Avoid changing any existing consumer in the first provider-only phase.
7. Return `safeForProductionWiring: false` until consumers are migrated and validated separately.

## Safety Analysis

### What changes

Only internal state access planning changes:

- A future provider would expose one shared read-only route context getter.
- Consumers could migrate from scattered route-state inference to a common descriptive snapshot.
- Debug and audit consumers would have a shared vocabulary for route context.

### What does not change

V303 and the recommended V304 provider step must not change:

- route generation
- Route Watch behavior
- destination routing
- route recommendations
- alternate route selection
- geometry scoring
- alert relevance
- alert rendering
- UI
- Supabase schema or persistence
- awareness behavior
- directional display
- route monitoring lifecycle
- Route Watch activation/deactivation

## Migration Phases

### Phase 1 — Shared route context provider

Create `getActiveRouteContext()` as a read-only wrapper around the V302 context snapshot. Do not switch consumers yet.

Safety rule: provider-only, no behavior wiring.

### Phase 2 — Debug consumers

Point Route Watch debug and developer helpers at the getter for display-only labels and route-state diagnostics.

Safety rule: debug output may change, but production behavior must not.

### Phase 3 — Audit consumers

Move Functional Readiness and Destination Ownership Audit classification reads to the getter while preserving their existing validation checks.

Safety rule: audit classification can become less duplicated, but audit pass/fail standards and production behavior must remain unchanged.

### Phase 4 — Monitoring consumers

Let Route Watch monitoring diagnostics read the getter for route identity only.

Safety rule: Route Watch activation, lifecycle, relevance, alerts, and route monitoring decisions must remain owned by existing Route Watch code until a later explicitly approved migration.

### Phase 5 — Future geometry observation consumers

Use the getter to classify audit-only geometry observation candidates before any production scoring or alert relevance work is considered.

Safety rule: geometry observation remains audit-only. No production scoring or relevance changes.

## Implementation Risk

Overall risk for the recommended first implementation step is **low** because the provider-only step is read-only and does not wire production consumers.

Risk increases in later phases:

- Debug migration risk is low.
- Audit migration risk is low to medium because duplicated classification must be preserved during validation.
- Monitoring migration risk is medium-high because descriptive context must not become Route Watch activation authority.
- Future geometry observation risk is medium because route identity and geometry availability must not influence production scoring or alerts.

## Benefits

- Reduces duplicated route-state inference.
- Gives Route Watch, audits, intelligence, recommendations, and future geometry observation a shared vocabulary.
- Preserves current production behavior while preparing a safer migration path.
- Makes ownership boundaries explicit before implementation touches monitoring or geometry.
- Provides a concrete V304 implementation target.

## Blockers and Guardrails

The provider must not be used as:

- a production writer
- a Route Watch activation source
- a destination routing trigger
- a route generation trigger
- a recommendation trigger
- a geometry scoring trigger
- an alert relevance trigger
- a UI rendering subscription source
- a Supabase persistence source

Consumer migrations should be separate from provider creation.

## What Remains Unchanged

V303 is planning-only, and V304 should keep the first implementation provider-only. The following must remain unchanged:

- route generation
- Route Watch behavior
- destination routing
- route recommendations
- alternate route logic
- route monitoring lifecycle
- geometry scoring
- alerts
- UI
- Supabase
- awareness
- directional display

## Architecture Helper

V303 adds a planning helper:

```js
window.gridlyActiveRouteContextImplementationPlan?.()
```

The helper returns:

```js
{
  available: true,
  planningOnly: true,
  productionBehaviorChanged: false,
  recommendedImplementation,
  currentConsumers,
  futureConsumers,
  migrationSequence,
  implementationRisk,
  benefits,
  blockers,
  safeForProductionWiring: false
}
```

This helper is diagnostic and planning-only. It does not implement the provider and does not change production behavior.

## V304 Recommendation

Recommendation: **A) Implement shared Active Route Context provider**.

Reason: implementation risk is low if V304 is limited to a read-only provider-only step with no consumer migration and `safeForProductionWiring: false`.

V304 should not implement audit migration, monitoring migration, geometry observation migration, or production Route Watch alignment in the same change.
