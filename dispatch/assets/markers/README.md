# Gridly marker parity

These PNGs are unchanged copies of first-party Gridly assets from
`assets/markers/png/`, reused under the owner's explicit request. No new
third-party icon library or licensing dependency is introduced.

The mappings and pointer ratios isolate the production contracts in `js/app.js`
(`GRIDLY_PRODUCTION_MARKER_CATEGORY_ASSETS` and
`GRIDLY_PRODUCTION_MARKER_TIP_ANCHOR_RATIOS`):

| Dispatch demo category | Existing Gridly asset | Pointer y / height |
|---|---|---|
| flooding | water-over-road.png | 204/256 |
| rail_blockage_delay | train-front.png | 205/256 |
| signal_outage | traffic-signal-issue.png | 194/256 |
| debris | debris-in-road.png | 200/256 |

Dispatch displays the unchanged PNG canvas at 80×80 CSS pixels (previously
64×64), retaining its transparent margins and pointer anchor ratios. A 48×48
pixel theme-aware backing has a 2px contrast border. Selection adds a static
3px outline with 4px offset; severity is a secondary 1–2px accent and small dot.
Resolved markers use 70% opacity and a check; selected resolved markers regain
full opacity. Symbols/category colors stay unchanged in both themes.
Fixed crossing infrastructure uses sourced basemap points, never the train hazard
icon. No consumer classifier, popup copy, mutable state, animation, auth,
home/search or Route Watch code is imported. The consumer SVG directory describes
a staged alternative; current production PNG mappings are the authority here.
