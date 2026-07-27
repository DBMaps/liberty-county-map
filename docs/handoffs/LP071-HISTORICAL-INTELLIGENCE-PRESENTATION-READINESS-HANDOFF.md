# LP071 — Historical Intelligence Presentation Readiness Handoff

## 1. Executive Summary

LP071 proves that the exact seven-field LP070 presentation DTO can support a concise, accessible, driver-first Historical Intelligence experience. The deliverable is an isolated **Know Before You Go Historical Intelligence** prototype and certification, not a production feature. Historical context is subordinate to current alerts, quiet results leave no UI, and all activation flags remain disabled.

## 2. Presentation-readiness architecture

The governed architecture remains LP067 Pattern Intelligence → LP068 Narrative Generation → LP069 Primary Takeaway Selection → LP070 allowlisted DTO → LP071 inactive prototype → a separately authorized future activation milestone. LP071 imports only the LP070 boundary in its standalone certification and never imports private engine modules.

## 3. Prototype ownership

The only authorized future owner is the **Know Before You Go Historical Intelligence surface**. Community Pulse, Travel Brief, Destination Intelligence, Unified Evidence, Alerts, and Route Watch do not own this presentation. Awareness remains the product purpose; the presentation supplies context rather than route direction.

## 4. Exact DTO consumption contract

The renderer accepts an object only when its own enumerable keys, in contract order, are exactly `historicalTakeaway`, `narrativeType`, `subject`, `historicalWindow`, `liveConditionGuidance`, `quiet`, and `displayEligible`. An expanded, reordered, malformed, quiet, or ineligible object renders nothing. The renderer does not access LP067–LP069 records. Private ranking, confidence, relevance, scoring, suppression, identifier, debugging, activation, or implementation data is rejected rather than ignored.

## 5. Visual hierarchy

An eligible presentation reads in this order: **historical takeaway → subject/place → meaningful historical timing → live-condition guidance**. “Historical context” labels the observation without implying that it is current or guaranteed. There are no charts, percentages, counts, timelines, dashboards, or interactions. Historical windows render only when already supplied as concise consumer text; raw observation objects and machine-formatted timestamps are omitted, and LP071 derives no clock.

## 6. Quiet-by-omission behavior

When `quiet === true`, `displayEligible !== true`, or the exact contract/content validation fails, the renderer returns an empty string. It creates no card, row, heading, placeholder, empty state, filler, or assistive announcement. Quiet with a current alert likewise contributes no historical markup.

## 7. Current-alert precedence

Current alerts determine live conditions. The prototype places an active current alert first in DOM and visual order, uses a stronger alert treatment, and follows it with subdued historical context without repeating alert details. The approved `liveConditionGuidance` remains visible in eligible historical content. Historical wording neither predicts a future event nor supplies navigation, avoidance, detour, or route advice.

## 8. Accessibility requirements

The standalone page uses one page heading, scenario headings, then a labeled historical section heading in natural reading order. The card's accessible name comes from its consumer-facing takeaway; technical metadata is absent from visible and accessible text. There is no initial live region and no fabricated interaction. A future user-initiated state change may make one restrained polite announcement, but unchanged and quiet states must never announce. Layout is fluid at narrow portrait widths and 200% zoom, long content wraps, meaning does not depend on color, and the complete `prefers-reduced-motion: reduce` rule removes meaningful animation and transitions. Any future controls must be keyboard reachable, visibly focused, and at least 44 by 44 CSS pixels; LP071 intentionally has none.

## 9. Activation governance

LP071 freezes `productionIntegration: false`, `consumerVisible: false`, `activationAuthorized: false`, and `explicitOptInRequired: true`. It also names the rollback owner, authorized future owner, current-alert authority, and LP070 contract identifier. There is no query parameter, local-storage value, feature detection, registration, automatic initialization, hidden hook, or production feature flag. Only a future explicit activation milestone may change integration status.

## 10. Rollback ownership

After a future activation is authorized, the **Know Before You Go release owner** owns rollback at the presentation attachment point. Rollback removes the Historical Intelligence consumer presentation and its activation wiring only. It must not change LP067 discovery, LP068 wording, LP069 ranking, LP070 projection, current alerts, Community Pulse, Travel Brief, Destination Intelligence, Unified Evidence, or any protected runtime. LP071 defines this contract but implements no production rollback because nothing is activated.

## 11. Browser certification instructions

1. Run `npm run test:lp071` at the repository root.
2. Serve the repository, for example with `python3 -m http.server 4173`.
3. Open `http://localhost:4173/tests/lp071-browser-certification.html` in a supported browser.
4. Confirm all twelve checks visibly report **PASS** and the body has `data-certification="pass"`.
5. Inspect `window.__LP071_CERTIFICATION__` and confirm `passed === true`, the required scenario and governance fields exist, and all activation booleans remain inactive.
6. At 200% zoom and a 320 CSS-pixel viewport, confirm no horizontal page overflow.
7. In Network, confirm only the certification HTML, prototype CSS, LP070 boundary, and LP071 renderer load.

## 12. Protected-system confirmation

LP071 adds isolated files plus one package command. Production `index.html` and `js/app.js` are unchanged and do not reference LP067–LP071. Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase synchronization, Community Pulse, Travel Brief, Destination Intelligence, Unified Evidence, and LP067–LP070 behavior and contracts are unchanged. Regression certification must include LP061 through LP070.

## 13. Merge recommendation

**Recommend merge** when LP061–LP071 automated certifications and the standalone browser certification pass. Merge approves the isolated prototype, presentation-readiness findings, accessibility contract, and activation/rollback governance only. It does not approve production activation, consumer display, current-alert authority changes, production imports, or a feature flag.

## 14. Recommended next milestone

Create a separately reviewed Historical Intelligence activation-decision milestone. It should conduct assistive-technology and supported-browser validation, identify the production attachment point and reversible release mechanism, and obtain explicit product authorization before changing any activation flag. It must preserve the LP070 DTO and current-alert authority.

## Updated next-chat handoff

LP071 is an inactive, isolated presentation-readiness proof owned only by the future Know Before You Go Historical Intelligence surface. Begin with the exact LP070 seven-field DTO, strict expanded-field rejection, quiet-by-omission rendering, historical labeling, current-alert precedence, no derived clock, and all activation flags disabled. Do not import LP067–LP071 into production or create a production feature flag. The next milestone may evaluate explicit activation and reversible attachment, but must not activate incidentally and must re-certify all protected systems.
