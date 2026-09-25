# LP244.48F1 functional and interaction-state closure

Audit and verification: 23 September 2026. Local changes only.

| Item | Result |
|---|---|
| A. Branch | `LP244.48-destination-quick-check-around-me` |
| B. Starting HEAD | `8613ccaad8ef00d9c2ab6ea02697aba0356a0ca1`; branch, HEAD and clean worktree verified before edits. |
| C. Final HEAD | The commit containing this report; exact SHA supplied in the completion response. |
| D. Commit | One local commit, `Close startup and interaction-state defects`. No push. |
| E. Executive finding | Five bounded defects repaired: nullable saved slots, Alerts disclosure/scroll loss, hidden Around Me feedback, per-incident freshness, and aggregate activity wording. Rail audited separately; no rail patch. |
| F. null.lat RCA | `getSavedPlacesState()` represents absent Home/Work slots as `null`. Revalidation ownership passes these to `needsLegacyRevalidation`. Its default argument only handles `undefined`, so reading `place.lat` threw for `null`. |
| G. Startup repair | Reject null/non-object/array inputs before reading coordinates. Existing coordinate validation and legacy revalidation remain authoritative. |
| H. Profile proof | Empty, Home-only, Work-only, full, and malformed partial profiles start without exceptions. Locality, Search and Home/Work management render. Verified saved fields remain semantically identical; saved-profile storage is not rewritten. Unit coverage also proves valid legacy entries still attempt revalidation and failed validation cannot become route eligible. |
| I. Disclosure RCA | LP236 replaces the sheet DOM. Capture originally replaced all remembered open-key sets, including when a transient provider-status render contained no disclosures. That absence erased the user's choices. A late/cached writer could also insert older disclosure markup. Repeated focus of the close button and temporary shorter content lost scroll position. |
| J. Disclosure repair/proof | Capture updates only keys actually mounted; missing keys retain their choices. Capture/restore at the final writer boundary uses existing stable source/type/roadway keys. Detached toggle events are ignored. Three actual background cycles preserve Community Reports, child disclosures, count/location and body scroll at 120px. Manual close remains closed after refresh; Show Me focuses the map and minimizes the sheet. |
| K. Around Me RCA | Existing messages use `info`; the portrait acknowledgement mirrored only `success`, while the legacy confirmation was hidden. |
| L. Visible feedback | The existing portrait acknowledgement also accepts explicitly sourced Around Me messages. Acquisition, success, denial, stale fix, timeout, generic error and expiry are visible. One acknowledgement with `aria-live="polite"`; success explains the two-minute lifetime and unchanged Home. No new panel or CSS. Foreground callbacks are injected for deterministic browser acceptance; this does not certify device permission UI or GPS hardware. |
| M. Freshness RCA | The governed Alerts projection supplied `minutesText: "now"` or reused a generic label; LP236 preferred it over canonical freshness. The shared formatter also preferred cached numeric age and omitted normalized top-level `submittedAt`. |
| N. Freshness repair/proof | Both community projection paths use the shared popup formatter; community cards use canonical freshness. Real timestamps, including `submittedAt`, take precedence over cached age, with numeric-only fallback preserved. Fixture cards retain approximately 0/5/12-minute ages and advance naturally through refresh. A production-shaped `created_at` row normalizes to the same seven-minute Alerts/popup result. Clock-controlled tests cover timestamp advancement, nested records and update timestamps. |
| O. Trust finding | The existing story rule emits “Several recent signals” for three distinct records. KBYG translated this to “Strong supporting evidence,” conflating area activity with corroboration. |
| P. Copy repair | That single mapping now says “Multiple recent signals.” No confidence algorithm, scores, badges or incident trust changes. “Awaiting additional reports” remains intact. |
| Q. Rail reproduction | Two governed crossings, FRA-762785P/Winfree and FRA-762786W/Main: blocked → cleared → delay. With both inside the viewport and eight-second settle intervals, canonical state, popup, Alerts and marker progress correctly to `heavy` / `rail_delay`, “Reported Crossing Delay,” and `23-reported-crossing-delay.png`. A fresh FRA-762784H delay also has the correct canonical type, popup and Alerts; no rendered marker was available for that private crossing. |
| R. Rail classification | Persistent blocked asset was not reproduced in the controlled, settled, in-viewport sequences. Short transitions and offscreen marker handles produced misleading/stale observations. A separate shared presentation issue is confirmed: grouped `rail_delay` still has a generic “Train blocking crossing…” title. The inspected KBYG community projection includes blocked but not delay, although the awareness story detects recent evidence. This needs a separate consumer/lifecycle audit. |
| S. Rail patch | No. No speculative marker or lifecycle change in this commit. |
| T. Changed files | Listed below. |
| U. Three-hazard parity | Exactly three active hazards and three unique logical hazard markers; Location Context, Community Pulse, KBYG and Alerts each report three. Rechecked across refresh and all four widths. Passive crossing infrastructure is not counted as an extra hazard. |
| V. Locations | Flood: Cook Street and Church Street. Debris: Winfree Street and Flowers Street. Power line: Hope Street and Nancy Street. All three are checked from mounted Alerts cards. |
| W. Refresh | Three `alerts_open_background_refresh` cycles, each followed by an additional 16-second interval spanning scheduled updates. No disabling of refresh, stale-DOM freezing or duplicated cards. |
| X. Temporary contexts | Search Dayton → SEARCH → Return Home → HOME. Fresh Around Me → AROUND_ME; expiry feedback and explicit Return Home work. Denial/stale/timeout/error leave the area unchanged. |
| Y. Home persistence | Five persisted Home/settings/profile keys compared byte-for-byte after every injected location outcome and after Route Watch protection. Verified Home/Work semantics also checked in startup cases. |
| Z. Route Watch | Active Route Watch rejects a new Around Me request and a late foreground fix; Search cannot replace temporary ownership. |
| AA. Focused tests | Expanded protected selection: 220/221 pass. The sole failure is the pre-existing LP065 literal-copy assertion, reproduced using starting-commit app source. Direct closure/disclosure suite: 63/63 pass. Winter marker suite: 7/7 pass. |
| AB. Broader tests | `npm run test:lp2445:acceptance`: 201/203 pass. The bare-place source-order assertion and old `aria-label="Use my location"` assertion both reproduce at the starting commit. All preceding protected-system batches pass. These failures are disclosed, not silently treated as a green suite. |
| AC. Browser widths | Final browser acceptance PASS. Headless Edge, 320/360/390/440 × 844; 390 authoritative. Twenty location outcomes checked, plus acquisition and expiry. Screenshots support the functional evidence; 320px acknowledgement wraps within the viewport. |
| AD. Backend writes | Browser routing aborts external requests and every non-read HTTP request; websocket connections are closed in the final harness. Blocked POST attempts are only the read-only reporting-status RPC and geocoder. No report insert/update/delete, production data write, native build or deployment. Local fixture reports use the existing test-only harness. |
| AE. Marker integrity | All 31 approved PNGs, recursively including the three context markers, have SHA-256 hashes identical to the pre-edit capture. |
| AF. Errors/warnings | Zero browser page exceptions. The final run's only warning category is “Service Worker registration blocked by Playwright” (six isolated contexts). Earlier runs also recorded blocked realtime connection warnings; the final harness explicitly closes websockets. External services are deliberately unavailable; this does not certify live-provider health. |
| AG. Deferred | LP244.48F2: rail grouped-title / KBYG delay-consumer audit, private-crossing marker eligibility, and device-level geolocation checks. LP244.48G: marker appearance/size, Saved Places layout, KBYG density, Alerts contrast, popup colors, typography, spacing and route appearance. Historical test expectation maintenance is separate. |
| AH. Recommendation | Accept this bounded functional closure locally. Keep the rail presentation discrepancy and historical test failures visible; resolve rail consumer parity before claiming whole-app functional closure. Visual polish remains a later milestone. |
| AI. Git status | Final status verified after the local commit and reported in the completion response. |

Changed files:

- `js/app.js`: the five bounded interaction/presentation repairs described above.
- `js/gridly-saved-address-integrity.js`: nullable-slot guard.
- `tests/lp24448f1-functional-closure.test.cjs`: behavioral regression coverage.
- `tests/lp236-alerts-information-architecture.test.mjs`: existing mock now supplies the actual DOM `open` property because capture reads both open and closed disclosures.
- `tests/lp24446b-winter-markers.test.cjs`: bounds protected-function comparisons by their declaration indentation. The previous extractor compared roughly 154 KB after a nested function, accidentally including the unrelated sheet writer. Protected function bodies remain unchanged.
- `tools/lp24448f1/verify-browser.cjs`: repeatable isolated browser acceptance and network-write blocking.
- `docs/launch/LP24448F1-FUNCTIONAL-CLOSURE.md`: this report.

Verification commands:

```powershell
node --test tests/lp24448f1-functional-closure.test.cjs tests/lp236-alerts-information-architecture.test.mjs
node --test tests/lp24446b-winter-markers.test.cjs
$focusedFiles = (rg --files tests | Where-Object { $_ -match 'lp24448f1|lp24448a|lp24445|lp24446|lp24447|lp236-alerts|lp2402|lp065-decision|lp2445-saved-address|lp2447-saved-place|lp2449-travel' })
node --test $focusedFiles
npm run test:lp2445:acceptance
node tools/lp24448f1/verify-browser.cjs
node --check js/app.js
node --check js/gridly-saved-address-integrity.js
git diff --check
```

Local supporting evidence lives in ignored `.artifacts/lp24448f1/`: `profiles-before.json`, `profiles-after.json`, `disclosure-writer-trace.json`, `browser.json`, `rail-controlled.json`, `markers-before.json`, test logs, starting-source comparison, and `around-me-{320,360,390,440}.png`. No evidence is uploaded or published.

The browser fixture setup waits for governed county road geometry before injecting reports. An earlier too-early injection fell back to nearby crossing labels; that test setup did not satisfy the protected road-identity baseline. Timestamp comparisons use stable card/report identity and allow a one-minute rounding/render interval; they compare mounted card text with current popup freshness, not cached snapshot labels.
