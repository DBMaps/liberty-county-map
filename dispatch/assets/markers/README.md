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

Display size follows the consumer's 64×64 CSS pixel convention, including the
transparent margins. Symbols/category colors stay unchanged in both themes.
Dispatch adds a static selection ring, small severity accent and resolved check.
Fixed crossing infrastructure uses sourced basemap points, never the train hazard
icon. No consumer classifier, popup copy, mutable state, animation, auth,
home/search or Route Watch code is imported. The consumer SVG directory describes
a staged alternative; current production PNG mappings are the authority here.
