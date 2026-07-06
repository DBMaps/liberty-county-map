# GRIDLY V895 — Brand Identity & Action System

## Current color inventory

- Deep navy / obsidian surfaces: `--gridly-bg-deep`, `--gridly-surface`, `--gridly-surface-strong`, `--obsidian`, and graphite tokens.
- Gridly turquoise: `--gridly-cyan` (`#00f5f0`) and related cyan route/live tokens.
- Legacy green appeared in several action-oriented rules, including the previous late-file `.primary-btn` override and mobile/report shortcuts.
- Semantic colors remain available for meaning: success green, warning amber, and critical red.

## Updated action hierarchy

- **Primary actions** use Gridly turquoise via `--gridly-action-primary`.
  - Continue, Finish, Report, Save, Install, and confirm-style calls to action inherit the unified `.primary-btn` treatment.
- **Secondary actions** use a subdued deep-navy outlined treatment via `--gridly-action-secondary-bg` and `--gridly-action-secondary-border`.
  - Skip, Cancel, Back, Later, Close, navigation pills, filters, and utility actions remain visually quieter.
- **Pressed, hover, disabled, radius, shadow, and typography** are standardized in the V895 CSS override block.

## Semantic color usage

- **Success green** is reserved for positive status or resolved state: cleared markers, cleared alert items, success confirmation, and save-success text.
- **Warning amber** is reserved for caution/delay state: delayed alert and route-warning badges.
- **Critical red** is reserved for hazards, blocking states, and error confirmation.

## Screens reviewed

- First Run Experience / walkthrough controls.
- Awareness Brief and home action surfaces.
- Alerts and alert preferences.
- Reporting and report confirmation.
- Settings and install/feedback actions.
- Route Watch and saved-place dialogs.
- Search shell and results.
- Dialogs, bottom sheets, popups, success screens, and empty-state style patterns.

## Changes made

- Added final CSS action-system tokens and overrides for primary and secondary controls.
- Reassigned CTA overrides that previously presented as green/red/purple actions to the brand turquoise primary action where the action is a major CTA.
- Preserved green, amber, and red only for semantic status, warning, and critical/hazard states.
- Added `window.gridlyBrandIdentityAudit?.()` to report V895 visual-identity readiness without changing app workflows.

## Accessibility considerations

- Primary action text uses dark ink on bright turquoise for strong contrast.
- Secondary actions use light text on deep navy with visible borders.
- Hover and focus-visible states increase contrast through border and background changes.
- Disabled buttons reduce opacity and shadow without changing behavior.
- Existing button sizes are preserved or raised to at least a comfortable touch target where the V895 rule applies.

## Remaining observations

- This is a presentation-only milestone; no reporting, alerts, hazard lifecycle, community pulse, route watch, Supabase, first-run behavior, or install runtime behavior was changed.
- Final visual verification should be completed on desktop hover-capable browsers plus at least one iOS and one Android device because the application has multiple responsive presentation layers.
