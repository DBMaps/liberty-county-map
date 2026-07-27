# LP072 — Historical Intelligence Activation Decision and Reversible Attachment Handoff

## 1. Executive Summary

Historical Intelligence is technically presentation-ready, and LP072 prepares an isolated, reversible production attachment architecture. It does **not** authorize or perform consumer activation. Production initialization, UI, current alerts, and protected decision surfaces remain unchanged. The governing principle is: Historical Intelligence supplies context; current alerts remain authoritative for live conditions; Gridly interprets; the driver decides.

## 2. Activation decision

The formal decision is `productionIntegrationPrepared: true`, `consumerVisible: false`, `activationAuthorized: false`, `explicitOptInRequired: true`, `reversibleAttachmentReady: true`, and `rollbackReady: true`. The machine-readable record is the controller's frozen `ACTIVATION_DECISION`. It identifies **Current alerts determine live conditions**, `LP070.historical-intelligence-activation-boundary.v1` as the only DTO contract, and `LP071.historical-intelligence-presentation.v1` as the only renderer contract.

Activation requires a separate, explicit milestone plus product-owner authorization. No URL parameter, browser storage, keyboard shortcut, environment mode, feature detection, fallback, or production feature flag can authorize it. Rollback must be immediate and cannot alter Historical Intelligence engine data or any live-condition system.

## 3. Reversible attachment architecture

The approved path is LP067 Pattern Intelligence → LP068 Narrative Generation → LP069 Primary Takeaway Selection → LP070 seven-field DTO → **LP072 reversible attachment controller** → LP071 renderer → future explicit consumer activation. The controller is an inactive UMD module with no production import. It validates authorization and input before rendering, obtains one complete LP071 markup string, and only then creates and inserts one controller-owned wrapper. A failed gate or render creates no partial markup.

## 4. Authorized host ownership

The only owner is **Know Before You Go Historical Intelligence surface**, represented by token `know-before-you-go-historical-intelligence` and selector `[data-gridly-owner="know-before-you-go-historical-intelligence"]`. Ownership does not transfer to Community Pulse, Travel Brief, Destination Intelligence, Unified Evidence, Alerts, or Route Watch.

Within that host, live current-condition content stays first. The controller inserts Historical Intelligence immediately before `[data-lp072-supporting-detail]`, or as the host's final child when no lower-priority detail marker exists. The Know Before You Go release owner owns lifecycle and detach; the controller owns refresh. A missing host fails closed with `missing-host` and no fallback DOM.

## 5. Authorization gate

Every attachment simulation must explicitly provide all of the following: LP067, LP068, and LP069 prerequisite recognition; exact LP070 contract recognition; exact LP071 renderer recognition; `activationAuthorized === true`; `consumerVisible === true`; `productionIntegration === true`; matching owner and ownership token; an existing authorized host; an exact valid allowlisted DTO; and the unchanged current-alert authority statement. Any missing or mismatched condition fails closed. LP072's production decision deliberately keeps authorization and visibility false.

## 6. DTO and renderer contracts

The controller accepts exactly seven own enumerable DTO fields, in LP070 order: `historicalTakeaway`, `narrativeType`, `subject`, `historicalWindow`, `liveConditionGuidance`, `quiet`, and `displayEligible`. Expanded/private input is rejected, not stripped. Eligible guidance must remain “Check current alerts for live conditions.” The controller never reads LP067–LP069 records. It accepts only the LP071 API shape bound to the LP070 contract and calls only its `exactContract` and `render` methods.

## 7. Current-alert precedence

Attachment only inserts a new subordinate sibling; it never edits, removes, moves, or clones existing current-alert nodes. The isolated certification covers selected history with and without an alert, and quiet/invalid input alongside an alert. Current alerts remain first and receive the stronger alert treatment. Historical content does not repeat alert content and continues to point users to current alerts for live conditions.

## 8. Quiet and invalid behavior

A quiet DTO returns `quiet-dto` and creates nothing. If selected history is already attached, quiet input performs a complete safe detach before returning. Invalid input returns `invalid-dto`, changes nothing, and cannot corrupt an existing valid attachment. There is no placeholder, heading, empty region, hidden consumer copy, or assistive announcement.

## 9. Rollback contract

Rollback removes the single owned wrapper and cleans the controller's resource registries for listeners, observers, and timers. The implementation currently creates none, and therefore retains no dormant event or asynchronous behavior. It changes no host attribute and preserves host child-node identities, content, ordering, focus, and unrelated state. It leaves no wrapper, heading, placeholder, hidden content, accessible node, or stale DTO. It works without reload in the certification harness, including after the attached node or host disappears.

Rollback does not clear historical data or alter current alerts, Supabase, reports, awareness selection, Route Watch, Community Pulse, Travel Brief, Destination Intelligence, or Unified Evidence.

## 10. Idempotency behavior

Identical repeated attachment returns `already-attached` without rendering a duplicate. Repeated detach returns a safe unchanged `detached`. Attach → detach → attach produces one wrapper each time. Quiet after selected removes the attachment; selected after quiet attaches once; invalid after selected preserves the existing attachment. Host absence, including disappearance during an isolated simulation, is handled without an uncaught exception.

## 11. Accessibility lifecycle

Inactive initialization has no markup and no announcement. Attached markup retains LP071's labeled historical section, natural heading hierarchy, consumer-only accessible text, and current-alert-first reading order. Attachment never calls focus; detach removes only the owned subtree and does not disturb focus elsewhere. Quiet and invalid DTOs create no accessible content. The isolated stylesheet preserves a color-independent authority label, fluid zoom/mobile layout, and a `prefers-reduced-motion: reduce` override. No live region is introduced.

## 12. Failure handling

The controller catches boundary failures and returns deterministic frozen status objects. Defined codes include `unauthorized`, `activation-disabled`, `invalid-dto`, `quiet-dto`, `missing-host`, `owner-mismatch`, `renderer-unavailable`, `dto-contract-mismatch`, `current-alert-authority-mismatch`, `already-attached`, `detached`, and `rollback-complete`. Prerequisite failures are unauthorized with a structured reason. Failures do not throw into the application, mutate the host, or leave partial output.

## 13. Browser certification instructions

1. Run `npm run test:lp072` from the repository root.
2. Serve the repository, for example with `python3 -m http.server 4173`.
3. Open `http://localhost:4173/tests/lp072-browser-certification.html`.
4. Confirm all sixteen checks show **PASS** and `document.body.dataset.certification === "pass"`.
5. Inspect `window.__LP072_CERTIFICATION__` and confirm `passed === true` plus all required decision, scenario, rollback, accessibility, and isolation properties.
6. Review the narrow portrait scenario at 320 CSS pixels and the whole page at 200% zoom.
7. In Network, confirm the page loads only its HTML, isolated LP072 CSS, LP070 boundary, LP071 renderer, and LP072 controller.

## 14. Protected-system confirmation

LP072 changes only the isolated controller, test and certification assets, this handoff, and the package command. It does not modify production `index.html`, `js/app.js`, the service worker, manifest, production boot or initialization, LP067–LP071 modules, Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase synchronization, Community Pulse, Travel Brief, Destination Intelligence, or Unified Evidence. No feature flag or hidden production host exists.

## 15. Merge recommendation

**Recommend merge** after LP061–LP072 regression certifications and the standalone browser review pass. Merge approves only the activation decision record, inactive controller, authorized attachment architecture, rollback readiness, and certification findings. It does not approve consumer activation, consumer visibility, production initialization/imports, automatic activation, a production feature flag, or any change to current-alert authority.

## 16. Recommended next milestone

Create a separately authorized LP073 activation-approval milestone only if the product owner chooses to proceed. It should perform supported-browser and assistive-technology validation, define controlled release monitoring, explicitly authorize consumer visibility and production integration, and retain an immediate rollback control. Until that approval, all LP072 activation state stays false and the module remains isolated.

## Updated next-chat handoff

LP072 has prepared and certified one fail-closed, reversible attachment point without activating it. Start any follow-up from the frozen activation decision and the exact authorized owner/token. Preserve the LP070 seven-field boundary, use only LP071 rendering, keep current alerts first and authoritative, and do not add production imports, flags, hidden markup, or implicit enablement. A future milestone must obtain explicit product-owner authorization before changing both consumer visibility and production integration, and must retain no-reload rollback.
