# Gridly Dispatch visual application

Local visual build, October 6, 2026. Vanilla HTML, CSS and browser ES modules;
no framework migration, build dependency, consumer code import or Worker change.
The Gridly asset is an unchanged copy of
`assets/store/branding/Logos/gridly-logo-horizontal.png`.

## View locally

From the repository root:

```powershell
node tools/dispatch-ui/serve.mjs --demo
```

- Login: http://127.0.0.1:4178/
- Board: http://127.0.0.1:4178/?demo=1
- Empty: http://127.0.0.1:4178/?demo=1&state=empty
- Verification messaging: http://127.0.0.1:4178/?auth=verification

Use Preview state for populated, empty, loading, network error and authorization
error. Use the acting-unit selector for independently scoped Police and Public
Works demo memberships. Open a report title or review item for the detail drawer.
Escape or Close restores focus to the invoking control. Reports, Review Queue,
Activity and Organization provide separate local views.

Run without `--demo` to inspect the fail-closed login-only surface. The server
binds only to 127.0.0.1, rejects other Host names, exposes an exact asset allowlist,
rejects writes and denies fixture files unless explicitly enabled. The browser
also requires a loopback origin and the server capability response; a `demo=1`
query on a remote host cannot activate the shell. Port override:
`$env:DISPATCH_UI_PORT='4179'`.

## Data and authorization boundary

The shell represents an authenticated product layout in a **local visual session**;
it is not a real authenticated session. `auth.mjs` refuses sign-in because the
existing delivery Worker has no browser login/session endpoint. The form neither
reads nor transmits credentials; the password field is cleared after submission.
Recovery sends no email. Verification messaging cannot grant AAL2. There are no
signup, approval, publication, invitation or operational write controls.

Fixtures live only in `demo/fixtures.mjs`, use DEMO IDs and a fixed October 6
08:30 CDT snapshot, and are never persisted. Counts and relative ages refer to
that snapshot. Only explicitly listed synthetic memberships enable a unit in the
selector. Fire and EMS are organizational context, not accessible memberships.
Reviewed fixture state grants no live reviewer eligibility. Minimum two trained
reviewers per unit, author separation, exact subtype/risk/scope/unit authority,
live authorization and stale-revision rejection are explained in the detail view.

`app.mjs` owns view state and interaction; `components.mjs` owns reusable icons,
branding, badges, records, queue items and state panels; `styles.css` owns design
tokens and responsive layouts. The native dialog supplies modal focus containment.
No map provider is loaded. The reserved location panel uses no fabricated map.

## Certification

Use the repository's pinned Playwright dependency (`npm ci` when not installed).
This machine has Edge available; its cached Playwright Chromium is incomplete:

```powershell
$env:DISPATCH_BROWSER_CHANNEL='msedge'
node --test tests/dispatch-visual-shell.test.mjs
```

Without the override, the test uses Playwright Chromium. Screenshots and logs go
to `reports/responder/dispatch-visual/` and are ignored. Tests capture login,
populated board, empty board, detail header and scrolled authority/publication at
1440×900, 1920×1080, 1280×720 and 1024×768. Desktop/tablet document and table
horizontal overflow are checked. Short workstations and tablets allow vertical
scroll; desktop/tablet navigation and acting-unit context remain sticky.

## Production handoff — not deployed

The approved Worker currently routes only `/health` and `/api/resend/webhook`.
There is no approved static UI delivery configuration in this baseline. Before
deployment, review a separate static asset origin/route for the root and UI assets
at `dispatch.gridlygo.com`, preserving both existing exact Worker routes. Do not
replace that Worker with this local server. Exclude `demo/`, preview capability,
local server and certification artifacts from any future production package.

The browser also needs an approved dedicated Dispatch authentication integration:
real session validation, MFA/AAL2 verification and recovery, live authorized unit
memberships, session expiry/sign-out and authorized read projections. Do not reuse
consumer auth or the historical disposable auth harness. Production empty data
must come from a successful authorized read, never an auth failure interpreted as
zero records. This visual phase intentionally does not introduce those contracts.

Publication stays off; onboarding remains blocked. No production identities,
invitations, DB schemas, credentials, transport configuration or DNS were changed.

## Theme system

Use the labeled **Theme** selector on login or in the top bar: **System**, **Light**,
**Dark**. System is the default. Explicit selections persist as one validated
string in `localStorage.gridlyDispatchTheme`; this key is Dispatch-specific and
contains no identity or operational data. Missing/corrupt values resolve to
System. If storage is unavailable, the selection still works for the current
page. Tabs on this origin synchronize preferences through the storage event.

`theme.js` is a small external blocking script before CSS and the body. It applies
`data-theme="light|dark"` and `data-theme-preference="system|light|dark"` to the root
before rendering, without weakening the CSP. It listens to `prefers-color-scheme`
changes only for System. Explicit Light/Dark choices override the OS. A theme
change does not reload or rerender views, modify fixtures, or initiate requests.

`themes.css` owns all light/dark palette values as semantic variables. Components
reference these variables through `styles.css`; geometry is shared by both
themes. Native inputs use the resolved `color-scheme`. Focus, placeholder, status,
hover, selected-row, disabled and drawer surfaces are theme-aware. Reduced-motion
preferences disable transitions/animation, though the UI introduces no motion.

Future map integration should read `document.documentElement.dataset.theme` on
initialization and listen for `gridlydispatch:themechange` on `window`, whose
`detail` contains `{preference, resolved}`. Use `resolved` to select the reviewed
light/dark basemap style, keeping the camera, layers, filters and records intact.
Controls/popups should consume `--bg-panel-raised`, `--bg-input`, `--text-primary`,
`--text-secondary`, `--border-strong` and `--focus-ring`. No map provider, tiles or
map network requests are added by this phase.

Dual-theme certification:

```powershell
$env:DISPATCH_BROWSER_CHANNEL='msedge'
node --test tests/dispatch-theme.test.mjs tests/dispatch-visual-shell.test.mjs
```

New evidence lives in `reports/responder/dispatch-theme/`. The same login and board
URLs support every mode: choose Dark for both dark previews, Light for the light
preview, or System to follow the OS. A browser refresh is needed once to load this
new application version; subsequent theme switches are immediate.
