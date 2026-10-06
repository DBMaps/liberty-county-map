# Final Dispatch map polish certification

Date: 2026-10-06. Branch: codex/dispatch-visual-shell.
Approved starting head: 86633d7e0e76d2775d4e1567da19fa18528198ce.
Scope: local demo map appearance, label priority, sourced orientation landmarks.

## Implementation

Unchanged Gridly PNG bytes use an 80×80 CSS-pixel canvas, up from 64×64,
with unchanged pointer ratios. A theme-aware 48×48 backing has a 2px border.
Selection is a static 3px outline with 4px offset. Severity remains supplemental
through a 1–2px accent and small dot. Resolved incidents keep the category art
and check at 70% opacity; selecting them restores full opacity.

Road label priority: I/US, TX/SH, FM/RM, important city roads, local roads,
county roads. County names are suppressed below zoom 16, limited to three at
16 and five at 17, and use quiet text rather than highway shields. Major road
shields remain readable. Collision placement measures text and reserves the full
incident canvas plus seven pixels before placing any context label. Town text
may shift locally; source geometry and incident positions do not change.

Nine landmarks: one police station, two fire stations, five schools, one park.
Emergency/civic categories are eligible at zoom 13+, schools/parks at 15+;
maximum two labels below 15 and four at 15+. Muted 10px labels include small
category symbols, never hazard pins, severity badges or interactive actions.
Visibility depends on collision and viewport, so not every feature appears.

Source: the existing bounded OSM context response acquired 2026-10-06,
https://api.openstreetmap.org/api/0.6/map.json?bbox=-94.915,30.03,-94.865,30.065.
Raw SHA256: bfd18dcbaa6d9c241f13b2219f663ea63a8ccd908fb318f1ecb35574c0d4010e.
The offline prepare-landmarks.mjs derivative retains original node locations or
explicitly identified footprint-bounds centers. These are not verified entrances
or operational facility locations. ODbL attribution and downloadable derivative
are visible. Contributor identities, contacts and addresses are removed.

Excluded: commercial/retail/restaurant/fuel POIs, residential addresses, unnamed
features, and both ambiguous Colbert Elementary School names. No hospital, EMS
or municipal feature was available in this extract; none was invented.

Validated demo unit URLs support police/works. Public login remains fail-closed.
A Dispatch-local Canvas subclass ignores pending redraws after renderer removal,
including the crossing renderer, fixing a view-change cleanup race. Leaflet
vendor files and the consumer map are untouched.

## Verification and evidence

Command (installed Edge, pinned Playwright):

```powershell
$env:DISPATCH_BROWSER_CHANNEL='msedge'
node --test tests/dispatch-map-polish.test.mjs tests/dispatch-operational-map.test.mjs tests/dispatch-map.test.mjs tests/dispatch-theme.test.mjs tests/dispatch-visual-shell.test.mjs
```

Final result: 88/88 UI checks pass, zero failures, recorded in ui-tests.log. The existing 120 regressions pass in
regression-tests.log. The 15 new checks include marker dimensions and keyboard
selection, resolved state, road ordering, county zoom behavior, landmark source
and collision priority, offline asset gating/failure recovery, and eight full
viewport/theme comparisons against the approved starting head.

Viewports: 1440×900, 1920×1080, 1280×720, 1024×768; light and dark.
Full Board PNG equality passes at each combination. Split/Map panel, list row,
filter, topbar, sidebar and footer rectangles match the approved starting head.
Earlier Board baselines and existing theme/System, filters, persistence, drawer,
focus, reduced-motion and data-failure checks remain included.

102 final screenshots are local beside this report (ignored, not committed):

- 8 Board screenshots.
- 16 approved before Split/Map screenshots.
- 32 Police/Works Split/Map screenshots.
- 32 selected flooding/rail/signal screenshots.
- 8 resolved-debris screenshots.
- 2 broad/close county hierarchy screenshots.
- 4 dark/light landmark context/close screenshots.

Six additional inspect-* PNGs are exploratory, not certification outputs.
Normal-scale review covers category recognition and selected rings in both
themes, subdued resolved debris, wide highway hierarchy, close county context,
and restrained fire-station/park labels. Popups and the established layout are
preserved. The older operational label test now allows either Main or Winfree
at initial fit, because reserving incident space can suppress the other; it
still requires the locality at fit or one zoom out, rail and FM 1960 context.
Pan tests wait for Leaflet's pan-animation class to be removed, avoiding fixed
timing assumptions under parallel browser load. No CSP relaxation is required.

## Production and governance

No new external production provider, API key, paid service, tile request or CSP
exception. Landmark derivation is offline; no new network acquisition this task.
Coverage is finite and unverified, not an official emergency-facility directory.
Production still needs approved geographic coverage/freshness, coordinate and
facility validation, hosting/auth/read integration and separate rollout approval.

No changes to consumer source, Supabase/schema/auth, Resend, Hyperdrive, secrets,
publication, onboarding, email, DNS or supabase/.temp/cli-latest. No push, deploy,
participant onboarding or controlled invitation delivery. Owner visual review
of the local preview is the next step.
