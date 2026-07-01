# V857.3 Alerts Experience Audit

## Mission

V857.3 refines the Alerts experience as a presentation-only milestone. The locked Home Screen Baseline V1 and Search Baseline V1 remain the visual standards: calm hierarchy, premium portrait spacing, restrained accent use, and consumer language that helps people understand what changed before they go.

## Protected Systems Certification

This milestone does not modify alert generation, hazard lifecycle, Community Reports, Unified Intelligence, Search, route generation, Route Watch, Awareness, Weather, Supabase, data providers, filtering logic, rendering ownership, or runtime architecture. The implementation is limited to Alert surface copy, card hierarchy, and CSS presentation.

## Experience Audit

| Area | Finding | Refinement Direction |
| --- | --- | --- |
| Alerts panel | Alerts were visually close to the product system but competed with operational labels and dense card treatments. | Tightened the panel toward a single question: “What changed?” |
| Empty state | Empty copy was accurate but led with system language. | Reframed as calm, consumer-facing monitoring language. |
| Active alerts | The title needed stronger ownership over chips and metadata. | Strengthened alert title hierarchy and made metadata supporting. |
| Cleared alerts | Recently cleared information was useful but visually similar to active issues. | Preserved lifecycle visibility while softening cleared styling. |
| Alert cards | Cards had mixed inline styling and repeated dense shadows. | Added a consolidated premium card treatment using existing classes. |
| Typography | Chips and labels sometimes overpowered titles. | Reduced chip dominance and improved title/subtitle rhythm. |
| Iconography | Alerts use restrained chip language rather than new decorative icons. | No new icons introduced; typography carries the message. |
| Grouping | Corridor groups are retained. | Grouping presentation is quieter and easier to scan. |
| Freshness | Freshness exists but needed a softer supporting role. | Freshness is styled as secondary metadata, not a competing badge. |
| Trust and confidence | Existing trust model is retained. | Presentation now supports confidence through clarity without new logic. |
| Community confirmation | Community language remains visible through existing summaries/counts. | Visual hierarchy gives confirmations supporting placement. |
| Loading/error states | No runtime state changes were introduced. | Existing behavior preserved; presentation rules apply when rows render. |
| Scrolling | Alert list already scrolls in constrained panels. | Added smoother containment and portrait-safe overscroll behavior. |
| Portrait spacing | Portrait alert rows needed more breathing room and better bottom-sheet readability. | Added mobile-specific spacing, title wrapping, and card rhythm. |
| Bottom sheet behavior | Existing sheet behavior remains owned by current runtime. | Presentation only; no behavior changes. |

## Recommendations Implemented

1. Make alert titles the strongest element in each card.
2. Reduce severity-chip visual dominance.
3. Present freshness as supporting metadata.
4. Replace operational copy with consumer-facing language where safe.
5. Preserve all existing data sources, counts, grouping, filtering, and click actions.
6. Align alert cards with the Home/Search baseline card language: calm borders, soft surfaces, restrained shadow, and clear spacing.

## Remaining Recommendations

- In a future authorized behavior milestone, evaluate whether alert detail buttons should open a dedicated explanation state instead of reusing current route/action hooks.
- In a future copy-only milestone, review all historical/generated alert summaries for duplicate road/location phrasing at the source model boundary.
- Continue validating active, cleared, and empty states with real community report fixtures before broader release.

## Regression Certification

V857.3 is safe to merge as a presentation refinement because it does not change protected logic or alert eligibility. Existing alert generation, filtering, routing, reporting, intelligence systems, lifecycle state, and rendering ownership remain intact.
