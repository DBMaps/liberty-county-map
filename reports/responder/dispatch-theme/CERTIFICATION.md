# Gridly Dispatch dual-theme visual certification

October 6, 2026 — COMPLETE / DUAL-THEME VISUAL CERTIFIED.

Branch: `codex/dispatch-visual-shell`. Starting HEAD:
`2a8ab2f2f795688a3490b4a4d6dd9f12d0822a1d`.

## Implementation

External pre-render `theme.js`, semantic palette in `themes.css`, and shared
component geometry in `styles.css`. System, Light and Dark are the only selectable
modes. System defaults to the OS color scheme and follows runtime changes;
explicit preferences ignore OS changes. The Dispatch-specific local storage key
contains only a validated theme string. Missing/invalid values fall back to
System; denied storage degrades to an in-memory preference.

Both login and shell expose a native labeled selector. Theme application changes
root appearance attributes and selected control values, without re-rendering the
board, closing drawers, changing routes or issuing backend requests. Future map
adapters have a documented resolved-theme attribute/event and shared popup/control
tokens. No map implementation is introduced.

## Automated results

38 UI tests PASS: 25 theme tests plus 13 existing visual-shell tests.
120 existing Dispatch regression tests PASS across durable contract, invitation
delivery, Worker hosting, readiness and Resend configuration. A sandbox filesystem
restriction initially blocked the Worker suite's esbuild dependency; the same
local suite passed with appropriate filesystem access. No production calls.

Coverage includes default and runtime System behavior; explicit overrides;
reload persistence; corrupt and unavailable storage; cross-tab synchronization;
early application before body creation; login/shell keyboard selector, focus and
selected option; unchanged filters, unit, route, record HTML and panel bounds;
drawer persistence/focus restoration; no new requests or operational storage;
fixture gates; CSP; no signup regression; consumer isolation.

Computed color checks pass WCAG AA 4.5:1 for the tested primary, secondary,
placeholder, accent, warning, navigation, demo and seven semantic status text
pairs in both themes. Focus rings pass 3:1 on the tested panel, input, app and
sidebar surfaces. Light placeholder contrast was corrected from 4.34:1 during
certification. These targeted checks are not a claim of a complete WCAG audit.

## Screenshot review

49 source PNGs are local and ignored by Git:

- Both themes at 1440×900, 1920×1080, 1280×720 and 1024×768: login, populated
  board, empty board, detail header and detail authority (40 images).
- Both themes at 1440×900: loading, network error, authorization error and login
  error/focus (8 images).
- System selected with an emulated dark OS (1 image).

All images were inspected using 13 local contact sheets, with full-size checks
of dark login, short desktop board and scrolled authority details. Both themes
retain compact geometry, readable status text, timestamps, active unit and
navigation, defined panel layers and restrained badge treatment. Dark surfaces
contain no unintended white blocks. Native focus rings remain visible. Document
and table horizontal overflow checks pass at all four sizes. Short desktop and
tablet views continue to use vertical scrolling where necessary.

Test runtime: installed Microsoft Edge through repository-pinned Playwright
1.54.2. Logs and screenshots are ignored; only this report and ignore rules are
committed. Existing screenshots from the initial visual-shell phase remain local.

## Boundaries

Appearance only. Auth remains fail-closed in this local preview. No edits to
consumer source/storage, DB schema, production identities/invitations, auth rules,
Resend, webhook contracts, Hyperdrive, credentials, publication, onboarding, DNS
or the protected temp file. No deployment, push or invitation test. The local
server asset allowlist now includes the two theme files; production routing and
CSP are unchanged. Existing production hosting/auth handoff requirements remain.

## Owner review

From the repository root, run `node tools/dispatch-ui/serve.mjs --demo`.

- Login: http://127.0.0.1:4178/ — choose Theme → Dark.
- Populated board: http://127.0.0.1:4178/?demo=1 — choose Theme → Dark.
- Choose Theme → Light on either page for light review.
- Choose Theme → System on either page to follow the OS/browser preference.

The selected mode persists between these pages and subsequent visits.
