# LP070 — Historical Intelligence Activation Boundary Handoff

## 1. Executive Summary

LP070 establishes the inactive, presentation-safe contract between the LP067–LP069 internal Historical Intelligence pipeline and a future consumer experience. The boundary copies only seven allowlisted properties into a frozen DTO, replaces every ineligible or quiet engine result with an explicit quiet DTO, accepts rather than derives the awareness context's local-time authority, and keeps current alerts authoritative for live conditions.

LP070 does **not** render, register with production, import the historical engines into production, or enable a consumer surface. `productionIntegration` and `consumerVisible` remain `false` in boundary activation governance.

## 2. Activation Boundary Architecture

The governed future flow is LP067 pattern intelligence → LP068 narrative generation → LP069 narrative ranking → LP070 projection → allowlisted presentation DTO → explicitly enabled future consumer owner. LP070 is a projection and validation boundary, not an engine adapter: internal ranking results enter the boundary, while only approved DTO fields leave it.

Activation is opt-in and requires passing LP067, LP068, LP069, and LP070 plus a separately approved future presentation milestone. Importing the module, passing certification, or receiving an eligible DTO does not constitute activation. No automatic discovery or registration mechanism is provided.

## 3. DTO Specification

Every DTO has exactly these fields in this order:

| Field | Selected result | Quiet result |
| --- | --- | --- |
| `historicalTakeaway` | Unchanged approved LP068 narrative | `null` |
| `narrativeType` | Approved narrative family | `null` |
| `subject` | Consumer-readable place/subject | `null` |
| `historicalWindow` | Frozen first/last observation timestamps | `null` |
| `liveConditionGuidance` | `Check current alerts for live conditions.` | `null` |
| `quiet` | `false` | `true` |
| `displayEligible` | `true` | `false` |

No ranking metadata, confidence category or calculation, candidate score, duplicate suppression, relevance calculation/reason, identifier, debug field, activation flag, or implementation metadata crosses the DTO boundary. `displayEligible` means only that the DTO passed content projection; it does not bypass activation governance.

## 4. Ownership Contract

The exclusive intended owner is a **future Know Before You Go awareness surface**, consistent with Awareness Platform First and Route Intelligence Second. Existing Community Pulse, Travel Brief, Destination Intelligence, and Unified Evidence surfaces do not acquire ownership through LP070.

The future owner must:

- request the DTO only after explicit milestone activation;
- render at most one eligible takeaway, or render no container for a quiet DTO;
- leave wording and live-condition guidance unchanged;
- offer historical context rather than prediction, navigation, routing, or alert replacement;
- avoid interactions that imply a current condition; and
- never inspect or depend on LP067–LP069 result shapes or metadata.

## 5. Quiet-State Contract

Any unselected, malformed, unapproved, or integration-inconsistent input returns the same frozen quiet DTO. Quiet means no takeaway, type, subject, window, or guidance, with `quiet: true` and `displayEligible: false`. A future owner must omit the historical container entirely. It must not add filler copy, empty-state copy, placeholder narratives, loading-shaped historical claims, or announcements.

## 6. Local-Time Authority

The awareness context that initiates evaluation is authoritative for local time. It supplies an ISO `now` instant and numeric `utcOffsetMinutes`. LP067 and LP069 already consume those values for historical evaluation; LP070 validates and forwards that pair unchanged and performs no date, timezone, daylight-saving, county, device-locale, or browser-clock calculation.

Future presentation code must pass the same authority object used for evaluation. It must not derive a second clock, infer a timezone from subject text, or recalculate eligibility. If either authority value is missing or invalid, evaluation must remain quiet.

## 7. Accessibility Requirements

When a future milestone activates rendering, the owning surface must meet all of the following:

- **Screen-reader wording:** expose the takeaway and live guidance as authored, with a concise contextual label such as “Historical context”; do not announce hidden metadata or expand abbreviations differently from visible wording.
- **Heading hierarchy:** place “Historical context” at the next valid heading level beneath the owning awareness surface; never introduce a second page-level heading.
- **Announcements:** do not announce quiet results. On refresh, use no live announcement when the DTO is unchanged; when user-initiated context changes produce a newly eligible DTO, use a single polite, non-interrupting announcement. Never use assertive alerts for historical context.
- **Focus order:** historical context follows current live conditions and must not steal or programmatically move focus. Any future interactive control follows the takeaway in DOM and visual order.
- **Reduced motion:** the content must remain complete with `prefers-reduced-motion: reduce`; activation, refresh, or dismissal cannot depend on animation, and no auto-scrolling or motion-only status cue is permitted.

These are future rendering requirements only. LP070 makes no production UI or styling change.

## 8. Browser Certification Instructions

1. Run `npm run test:lp070` from the repository root.
2. Serve the repository with `python3 -m http.server 4173`.
3. Open `http://localhost:4173/tests/lp070-browser-certification.html` in a current supported browser.
4. Confirm all ten checks report **PASS** and `<body data-certification="pass">` is present.
5. Inspect `window.__LP070_CERTIFICATION__`; confirm `passed === true`, `dto.displayEligible === true`, `quiet.quiet === true`, and both activation flags are false.
6. In Network, confirm only the standalone document and LP070 boundary module load. Production `app.js`, LP067–LP069, providers, Supabase synchronization, and protected presentation modules must not load.
7. Run `npm run test:lp067`, `npm run test:lp068`, and `npm run test:lp069` as prerequisite regressions.

## 9. Merge Recommendation

**Recommend merge** after LP067–LP070 automated certifications and one supported-browser LP070 certification pass. The change is additive, frozen, allowlist-based, quiet by default, and absent from production runtime. Merge does not authorize consumer activation.

## 10. Recommended Next Milestone

Create a separate, explicitly approved presentation-readiness milestone for the future Know Before You Go awareness surface. It should provide representative user and assistive-technology prototypes, validate current-alert precedence, decide opt-in configuration and rollback ownership, and re-certify protected production systems. It must not activate until product approval explicitly changes both activation flags through a separately reviewed integration.

## Updated Next-Chat Handoff

Begin with LP067–LP069 as private internal engines and LP070 as their only approved presentation projection. Preserve the exact seven-field DTO, quiet-by-omission behavior, awareness-context time authority, current-alert precedence, and inactive flags. Do not import any historical module into `index.html` or `js/app.js`. The next work must be a separately authorized presentation milestone—not incidental wiring—and must certify accessibility, explicit opt-in, rollback, protected surfaces, and one-or-zero rendering before activation is considered.
