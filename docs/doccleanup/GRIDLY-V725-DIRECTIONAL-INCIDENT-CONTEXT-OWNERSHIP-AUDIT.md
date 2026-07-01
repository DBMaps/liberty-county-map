# GRIDLY V725 — Directional Incident Context Ownership Audit

## Scope

V725 is an audit-only ownership review. It does not redesign, rebuild, activate, render, or wire directional intelligence. The audit confirms whether the V695–V704 directional stack can be reused later as incident context enrichment, while preserving the existing Awareness Brief ownership model.

## Existing directional stack inventory

The V695–V704 directional stack is still present and already divided into the intended layers:

| Layer | File | Existing responsibility | V725 finding |
| --- | --- | --- | --- |
| Runtime candidate prototype | `js/gridlyDirectionalRuntimeCandidatePrototype.js` | Holds protected-system constants, authoritative evidence metadata, candidate/review-bucket accounting, and runtime audit helpers. | Present. Do not rebuild candidate generation. |
| Service layer | `js/gridlyDirectionalServiceLayer.js` | Reads runtime candidate/containment/runtime audit state, verifies containment and bearing protections, and exposes service snapshots. | Present. Do not rebuild service normalization or protections. |
| Consumer layer | `js/gridlyDirectionalServiceConsumer.js` | Reads service audit/snapshot state, validates consumer-safe conditions, and exposes consumer snapshots. | Present. Do not rebuild consumer gating. |
| Awareness layer | `js/gridlyDirectionalAwarenessLayer.js` | Builds directional awareness card text and currently contains the DOM-writing path for top-status nodes. | Present, but must not own Awareness Brief top-status DOM in the incident-context path. |

## Runtime asset inventory

V719 runtime-ready directional assets already exist and should be reused rather than regenerated:

| Corridor | Runtime asset | activationEnabled | userFacingRenderingEnabled | Candidate count | V725 disposition |
| --- | --- | ---: | ---: | ---: | --- |
| US 90 | `assets/directional-intelligence/runtime/v719-us90-directional-runtime.json` | true | false | 81 | Reuse for future incident-context enrichment only; no V725 rendering. |
| TX 146 | `assets/directional-intelligence/runtime/v719-tx146-directional-runtime.json` | true | false | 36 | Reuse for future incident-context enrichment only; no V725 rendering. |
| FM 1960 | `assets/directional-intelligence/runtime/v719-fm1960-directional-runtime.json` | false | false | 0 | Remains fail-closed; do not display directional context. |

## No-rebuild determination

V725 confirms that no candidate generation, service layer, consumer layer, or corridor extraction should be rebuilt. The smallest safe future path is to consume the existing directional runtime/service/consumer outputs as a read-only incident-context input, then let existing incident wording builders decide whether and how to include a validated full-word direction in incident labels.

The existing corridor extraction and runtime assets already provide the source material needed for US 90 and TX 146. Rebuilding any V695–V704 layer would duplicate validated work and increase ownership risk without solving the V706 root cause.

## V706 ownership root cause confirmed

V706 identified that directional wording was written early to these Awareness Brief nodes:

- `#gridlyV2TopStatusPrimary`
- `#gridlyV2TopStatusSecondary`

The established Awareness Brief refresh path, `refreshPortraitV2LocalizedIntelligence()`, later owns and overwrites those nodes. V725 therefore confirms that directional context must not own, write, race, or rehydrate those top-status nodes.

## Current incident wording construction points

V725 identifies the exact existing wording surfaces that should be treated as future integration points, without modifying runtime behavior now:

1. **Incident labels / localized labels**
   - `buildLocalizedIncidentLabel()` delegates road incidents through `buildRoadHazardDisplay()` and uses rail/crossing location helpers for crossing disruptions.
   - Future enrichment should occur before or inside the road-hazard location/label model, not as a separate Awareness Brief DOM writer.

2. **Road-hazard display wording**
   - `buildRoadHazardDisplay()` builds road-hazard titles and subtitles from the shared road lookup, nearest known location, area, coordinates, status, and age.
   - This is the narrowest future place to add validated direction to an incident phrase such as `Disabled Vehicle on US 90 Westbound at Waco Street`, provided a later milestone authorizes user-facing rendering.

3. **Alert cards**
   - Alert card wording is assembled through `getAlertsSurfaceSnapshot()`, `buildSpecificAlertTitle()`, `buildAlertTitle()`, `buildGridlyAlertCardConsumerModel()`, and `buildAlertsSurfaceHtml()`.
   - Future alert-card directional context should flow through the same incident model fields used by these functions, not through top-status DOM mutation.

4. **Hazard popups**
   - `buildGridlyHazardPopupConsumerModel()` uses `resolveGridlyHazardPopupRoadLabel()` to produce popup location lines, and `buildUnifiedIncidentPopup()` renders those model fields.
   - Future directional enrichment should be incident-context data consumed by the popup model, not a separate popup rewrite.

5. **Crossing popups**
   - `buildPopup(crossing, report)` builds crossing popup content for crossing infrastructure/active rail reports, while unified crossing popup rendering uses `buildGridlyCrossingPopupConsumerModel()` inside `buildUnifiedIncidentPopup()`.
   - Crossing popups are not the primary target for road-corridor directional incident context; they should remain unchanged unless a later crossing-specific milestone authorizes a separate rail/crossing wording change.

## Smallest safe ownership path

The smallest safe path for a future authorized milestone is:

1. Keep V695–V704 candidate, service, consumer, and runtime asset layers intact.
2. Treat directional intelligence as an incident-context enrichment source only.
3. Add a read-only resolver that receives an incident's corridor/location evidence and returns a validated context object only when all gates pass, for example:
   - `corridor: "US 90"`
   - `direction: "Westbound"`
   - `source: "directional-service-consumer"`
   - `userFacingRenderingEnabled: false` until explicitly authorized
4. Feed that context into existing incident wording builders (`buildRoadHazardDisplay()`, `buildLocalizedIncidentLabel()`, alert-card model builders, and popup model builders) only after a later milestone authorizes rendering.
5. Never write directly to `#gridlyV2TopStatusPrimary` or `#gridlyV2TopStatusSecondary` from directional code.
6. Leave `refreshPortraitV2LocalizedIntelligence()` as the owner of Awareness Brief top-status text.

## Guardrails confirmed

- FM 1960 remains fail-closed and must not display directional context.
- `userFacingRenderingEnabled` remains false unless explicitly authorized in a later milestone.
- No V725 change enables directional rendering.
- No V725 change adds user-facing directional text.
- No V725 change modifies Awareness Brief ownership.
- No V725 change modifies alerts, popups, Route Watch, destination search, DriveTexas, Transportation Intelligence, Supabase, or historical systems.

## Protected systems status

The protected-system posture remains unchanged:

| System flag | Required value | V725 status |
| --- | --- | --- |
| `historicalReadsEnabled` | false | Unchanged |
| `historyUiEnabled` | false | Unchanged |
| `DriveTexasPaused` | true | Unchanged |
| `TransportationIntelligenceEnabled` | false | Unchanged |
| `TransportationIntelligenceDisplay` | false | Unchanged |
| `TransportationIntelligenceActivation` | false | Unchanged |

## Final determination

Yes. The existing directional stack can be reused for incident-context enrichment without duplicating V695–V704 work. The safe path is not to rebuild directional intelligence and not to write competing Awareness Brief DOM text. Directional information should persist as incident context only, eventually enriching existing incident wording builders after a separate authorization milestone, while `refreshPortraitV2LocalizedIntelligence()` remains the owner of `#gridlyV2TopStatusPrimary` and `#gridlyV2TopStatusSecondary`.
