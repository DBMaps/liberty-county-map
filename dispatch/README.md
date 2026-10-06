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
