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
