# Gridly Dispatch — local visual certification

October 6, 2026. COMPLETE / LOCAL VISUAL CERTIFIED.

## Baseline

The attached workspace initially had detached consumer HEAD
`9c28c0020aa6ae57882328cf88f6bef40c80359e` and no Dispatch code. Implementation
uses the existing committed Dispatch lineage at
`79519c2068fdb084ed023b45e6b0926fa36608d7`
(`RESPONDER-PHASE29-dispatch-durable-report-contract`) on new local branch
`codex/dispatch-visual-shell`. The separate original Dispatch worktree was not
edited. No AGENTS.md was found in the implementation tree.

Existing architecture: framework-free repository with isolated Dispatch server
modules under `tools/responder/phase29/worker`, SQL/read/review contracts and
Node test suites. No Dispatch browser application or browser login endpoint.
New UI is isolated under `dispatch/`; consumer source is unchanged relative to
the Dispatch implementation baseline.

## Results

- 13 focused browser/isolation tests pass in installed Microsoft Edge using the
  repository-pinned Playwright 1.54.2. Initial Chromium launch was unavailable;
  no package or browser installation was performed.
- 120 existing tests pass across Phase 29 durable contract, invitation delivery,
  Worker hosting, readiness and Resend production-configuration suites. These
  are local/static/injected-runtime checks; no live provider request is made.
- Real production auth and database integration are not certified by this UI
  work. Database runtime suites were not rerun; no SQL or DB-facing source changed.
- Login labels, no signup, authorized-access copy, fail-closed submission,
  password clearing, recovery/verification messaging and no credential request.
- Shell/navigation, organization/unit context, scoped reports, review queue,
  all local filters, detail open/close, keyboard Enter/Escape, modal containment
  and focus restoration.
- Text-and-color severity/status, intentional empty states, static skeletons,
  sanitized retryable error and distinct authorization refusal.
- Two separately authorized synthetic memberships; no Fire/EMS access, no
  cross-unit record leakage, filter reset on unit changes.
- Loopback plus explicit server demo gate; remote-origin query refusal;
  fixture endpoint absent without demo; Host refusal; GET/HEAD only; exact file
  allowlist; no external browser request or operational mutation; no browser
  storage; exact brand-asset hash parity.

## Visual review

Twenty PNGs are generated locally, excluded from Git, with filenames
`{width}x{height}-{login|board|empty|detail|detail-authority}.png`.
Viewports: 1440×900, 1920×1080, 1280×720, plus tablet 1024×768.
Screenshots use actual viewport bounds, not enlarged full-page captures.

Visual inspection drove larger operational text, a wider unit filter, a more
compact location panel, short-height spacing and sticky unit/navigation context.
Both Police rows and the review item are visible at 1280×720. Secondary context
and detail sections may require vertical scrolling. Tablet stacks secondary
panels below the primary list. No horizontal document or table overflow at the
four certified sizes. Phone layout is a fallback, not authoritative certification.

The design uses the unchanged Gridly mark, dark navy navigation, neutral canvas,
restrained teal accents, semantic labeled badges, compact bordered panels and
no decorative charts, map clutter or motion. No claim of a formal accessibility
audit is made; keyboard/focus/semantic behavior was browser-tested.

## Governance and delivery

No production deployment, push, invitation test, onboarding, publication,
consumer change, database write, security-setting change, Resend/Hyperdrive/DNS
change or protected temp-file access. The shell's user and data are explicitly
synthetic. Sign-in is fail-closed pending the absent browser auth integration.

Production needs a separately reviewed static asset route/origin for the root/UI
paths while preserving `/health` and `/api/resend/webhook`, plus dedicated
Dispatch browser authentication and authorized read integration. Existing
Worker transport is unchanged. Detailed run commands and boundaries are in
`dispatch/README.md`.
