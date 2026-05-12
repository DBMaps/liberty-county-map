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
