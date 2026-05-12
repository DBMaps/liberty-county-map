# GRIDLY Layout Mode Contracts

## Purpose
Gridly supports explicit environment-level interaction contracts so behavior can evolve safely without coupling desktop and mobile intent.

## Official layout modes
- `desktop`
- `portrait`
- `tactical-landscape`

`body[data-layout-mode]` is the canonical source of truth. A temporary compatibility attribute (`data-layout-mode-legacy`) may remain while older selectors migrate.

## UX identity contract
- **desktop**: Regional Movement Intelligence Center
- **portrait**: Daily Community Awareness Companion
- **tactical-landscape**: Tactical In-Motion Awareness Mode

## Behavioral examples
The same control can intentionally branch by mode:
- Nav tap in `desktop` can prioritize full command workflows.
- Nav tap in `portrait` can prioritize quick-summary and one-thumb flows.
- Nav tap in `tactical-landscape` can prioritize fast, low-friction in-motion actions.

## Implementation warning
Do not treat major interaction changes as CSS-only responsive work. Layout mode branching must be implemented in JavaScript behavior contracts (`getCurrentLayoutMode`, mode helpers, and authoritative layout sync).

## Control Ownership Rules

- Desktop controls must not own mobile interactions.
- Portrait controls must not own tactical-landscape behavior.
- Tactical controls must be compact/glanceable and mode-scoped.
- Shared helpers may exist, but visible controls should be mode-owned when behavior differs.

### Current owned control surfaces
- **Desktop only:** top command nav, left rail nav/actions, desktop report CTAs, desktop map legend/filter strip.
- **Portrait only:** mobile bottom nav (Today/Map/Report/Alerts/Routes), portrait report entry controls, portrait layer toggle trigger.
- **Tactical-landscape only:** tactical floating dock actions (Report/Route/Alerts/Area/Layers), tactical dock sheet surfaces.
- **Shared helper behavior only:** section routing, report/layer action helpers, geo-filter application, and modal open/close utilities.

## View Contract Ownership Matrix (V101 Audit)

| Surface / Control | desktop | portrait | tactical-landscape |
| --- | --- | --- | --- |
| `app-header` | owner | hidden | hidden |
| `mobile-live-brand` | hidden | owner | owner (compact) |
| desktop rail / command strips | owner | hidden | hidden |
| portrait bottom nav | hidden | owner | hidden |
| tactical floating dock | hidden | hidden | owner |
| mobile native surface layer | hidden | owner (intentional open only) | hidden by default (open only) |
| report/route/alerts/layers visible actions | desktop-owned entrypoints | portrait-owned entrypoints | tactical-owned dock entrypoints |
| map shell/frame/container | owner | owner | owner (must stay visible, no fallback hero replacement) |

## Shared Core vs Mode-Owned UX

Shared core remains shared across all modes: map initialization, Supabase/report sync, FRA crossings, Liberty County boundary, route/hazard scoring, saved places, Route Watch state, and layer engines.

Mode-owned UX:
- binders: `bindDesktopControls()`, `bindPortraitControls()`, `bindTacticalLandscapeControls()`.
- mode-owned route/alerts/report/layers entry controls use mode-specific ownership references (for example `desktopReportBtn`, `portraitRouteBtn`, `tacticalRouteBtn`) to prevent cross-mode collisions.
- visible interaction surfaces are bound once with per-mode data flags to prevent listener stacking during orientation/resize transitions.

## Known Compatibility Wrappers Added

- `isMobileLayoutMode()` compatibility wrapper retained at top-level so older call sites still work while layout-contract migration completes.
- `updateRouteWatchStartButtonState()` compatibility wrapper restored and mapped to `loadSavedRoute()` / `updateRouteWatchStartButtonLabel()` behavior so quick-panel route changes continue updating Route Watch CTA state.

## Future Codex Rules (Contract Guardrails)

- Do not add cross-mode buttons with shared IDs.
- Do not bind visible controls globally when behavior differs by mode.
- Do not rely on CSS-only responsive behavior for major interaction ownership.
- Keep protected core systems shared and mode-agnostic.
