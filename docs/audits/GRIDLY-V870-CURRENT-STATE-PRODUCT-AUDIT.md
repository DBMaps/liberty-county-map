# GRIDLY V870 — Current State Product Audit

Date: 2026-07-01  
Scope: Mobile portrait product audit after V865, V867, V868, V869, V869R, and V869S.  
Branch type: Audit-only. No runtime behavior, CSS, JavaScript logic, Supabase, reporting, Route Watch, weather validation, crossing logic, hazard lifecycle, or alert generation changes were made.

## 1. Executive Summary

Gridly’s current mobile portrait experience is materially stronger than the pre-V865 baseline. The product now has a clear canonical awareness owner, a more stable map control rail, a simpler expanded Brief, guarded weather visibility, explicit hazard/report location separation, and a stale first-paint neutralization path.

The current state is **close to beta-ready but not fully certified from this terminal-only audit**. Static inventory and available Node-based checks show the requested helper surfaces are present and recent protections are wired. However, the most important product claims in this audit are visual and runtime claims: clipping, stacked sheets, phone readability, map dominance, post-report delay, and stale first paint can only be closed with browser/phone execution of the helper block and manual portrait validation.

**Recommendation:** merge this audit branch as documentation-only if the report is desired in the repository. Do not treat this audit as final beta certification until the browser/phone checklist below is completed and captured.

## 2. Current Product State

### Mobile Portrait Home Screen

The home screen architecture appears to be organized around a top awareness/brief command region, a filter strip, the map canvas, map controls, a location context card, and the bottom dock. This is the correct product hierarchy for Gridly: quick awareness first, map still central, actions reachable from the bottom.

Current product read:

- **Balanced command region:** The simplified Brief reduces repeated quiet-state copy and avoids turning the home screen into a text dashboard.
- **Map remains visible by design:** The spatial ownership audits explicitly check that the map remains visible in both collapsed and expanded Brief states.
- **Risk remains:** terminal-only review cannot prove phone-specific clipping, Safari viewport behavior, or touch target comfort.

### Awareness Header

The Awareness Header is now the canonical owner of “where Gridly is watching.” That is the right mental model. It should state the monitored awareness area and avoid borrowing report-submission language.

Product state: **working well, with phone verification required** for long-area wrapping and active hazard headlines.

### Expanded Gridly Brief

The Brief is now intentionally lean. It focuses on a single travel/status read and contextual support instead of repeating every quiet signal.

Product state: **balanced**, not too minimal and not too heavy. It is appropriate for a consumer mobile home surface. The remaining product question is not whether to add bulk; it is how to represent multiple active conditions without making the Brief feel like an alerts sheet.

### Weather Behavior

Weather is now treated as optional and locality-gated. That is the correct trust posture: show weather when verified for the awareness area; hide it rather than showing possibly wrong-area weather.

Product state: **trustworthy by policy**, pending live runtime verification that weather appears only when locality matches and remains hidden when unverified.

### Map Controls

The control rail is explicitly audited for visibility, reachability, no overlap with the filter strip, and containment inside the map. This is a strong structural foundation.

Product state: **stable by instrumentation**, pending phone validation for thumb reach and actual discoverability.

### Filter Strip

The filter strip appears to occupy its own vertical band and is protected from overlap by the Brief and map controls. It remains an important mode switch, but must not visually compete with the Brief.

Product state: **structurally sound**, pending visual check for cramped labels on narrow phones.

### Location Context Card

The Location Context card should represent the current awareness area, not the hazard location and not the report submission location. The V869 location audit models that distinction.

Product state: **clear in the current model**, pending manual confirmation on active hazard and post-report states.

### Bottom Dock

The dock remains the primary action launcher. Smoke instrumentation includes dock bindings for Report, Alerts, Settings, and related surfaces.

Product state: **functionally instrumented**, pending manual validation that all dock sheets are readable and stack predictably.

### Report Hazard Flow

The audit found no product-code changes in this branch and did not exercise live submission. The known risk area is performance/delay after submission: if report submission triggers broad refresh, marker rebuild, alerts refresh, weather refresh, and route recalculation synchronously, a phone user can perceive a hang.

Product state: **needs phone timing validation** after report submit.

### Alerts Sheet

Alert card consumer and hazard popup helpers exist. Location truth wiring appears designed to present hazard location in alert surfaces and keep report location as metadata.

Product state: **promising but not terminal-certified** for sheet readability or stacking.

### Historical Intelligence Sheet

No runtime behavior was modified. This audit did not certify live historical sheet content. Product risk is mostly sheet density/readability and whether historical intelligence is clearly secondary to current hazards.

Product state: **requires phone validation**.

### Settings Sheet

Smoke instrumentation inventories settings selectors and binding state. Product risk is modal/sheet stacking with other dock surfaces.

Product state: **requires manual open/close and stacking validation**.

### Route Preview / Route Details

This audit did not modify Route Watch or route logic. Product risk remains that route details can visually compete with the map/Brief or inherit stale/wrong-area text if opened during an awareness-area transition.

Product state: **requires route scenario validation**.

## 3. What Is Working Well

1. **Canonical awareness ownership is clear.** Awareness area is treated as the owner for the header, filter, location context, and search context.
2. **The Brief is simpler and more consumer-friendly.** It avoids excessive repeated quiet-state statements and keeps the main status readable.
3. **Weather trust posture is conservative.** Unverified weather should be hidden instead of shown with uncertain locality.
4. **Map control rail has structural checks.** The control rail is checked for visibility, reachability, map containment, and overlap avoidance.
5. **Location truth model is stronger.** Hazard location, awareness area, and report location are modeled as separate concepts.
6. **Stale first paint has a neutral fallback.** Wrong-area or stale route text can be neutralized to “Monitoring nearby conditions” / “Checking current conditions.”
7. **Audit-helper coverage is broad.** The requested helper names are present in the runtime source, though most require a browser session to execute meaningfully.

## 4. Remaining Issues

### Product Issues

- **Multiple active conditions need a consumer rule.** The Brief should not list everything, but it should acknowledge when more than one material condition exists.
- **Post-report perceived delay is still a beta risk.** This requires timing on a physical or emulated phone after a fresh report submission.
- **Sheet stacking needs explicit product validation.** Alerts, Settings, Historical Intelligence, Report Hazard, and Route Details should never stack ambiguously.
- **Weather hidden state needs user-friendly absence.** If weather is hidden due to unverified locality, the product should avoid making the absence feel like a bug.
- **Historical Intelligence hierarchy needs confirmation.** Historical intelligence should feel secondary, not equal to current active hazards.

### Validation Issues

- Most requested helpers are browser globals, not terminal commands. They cannot provide real DOM geometry, touch, sheet, or map evidence from Node alone.
- Terminal static checks can confirm helper presence but cannot close visual hierarchy, clipping, or phone viewport claims.

## 5. Merge Blockers

No merge blocker was found for this documentation-only audit branch.

Because no product code was changed, the branch can merge as an audit artifact if the team accepts that browser/phone evidence remains outstanding.

## 6. Beta Blockers

The following should be considered **beta blockers until validated**:

1. **Phone visual certification:** no clipping in the Awareness Header, expanded Brief, filter strip, Location Context card, bottom dock, and sheets on narrow portrait devices.
2. **Post-report performance:** report submission must not create a noticeable delay, frozen controls, duplicate markers, or stale first paint.
3. **Sheet stacking:** only one primary sheet/modal should own focus at a time; back/close behavior must be predictable.
4. **Multi-condition active state:** the Brief must acknowledge multiple active material conditions without becoming an alert list.
5. **Stale/wrong-area runtime proof:** awareness-area switching and first load must show no stale Dayton/Liberty/Cleveland leaks outside the canonical area.

## 7. Visual Findings

### Visual Hierarchy

The intended hierarchy is correct:

1. Awareness Header: “where Gridly is watching.”
2. Gridly Brief: “what matters right now.”
3. Filter Strip: “scope/mode.”
4. Map: primary exploration surface.
5. Map controls: map manipulation.
6. Location Context card: current awareness area and local context.
7. Bottom dock: actions.

### Clipping and Spacing

Static source review shows instrumentation checking full-width Brief behavior, panel containment, filter-strip positioning, map-control overlap, and location-context/dock overlap. That is the right coverage. Actual clipping must still be validated on phone widths.

### Readability

The Brief wording is more readable than earlier heavy variants. The highest remaining readability risk is dense sheet content, not the home Brief.

### Consumer Wording

Current direction is consumer-friendly: “Monitoring nearby conditions,” “Checking current conditions,” and hazard-location phrasing are clearer than raw system terms. Continue avoiding internal words such as canonical, lifecycle, normalized, stale, or source in visible UI.

## 8. Functional Findings

### Helper Inventory and Terminal Status

| Helper / Check | Source status | Terminal status | Browser/phone status required |
|---|---:|---|---|
| `gridlyCanonicalAwarenessPresentationAudit` | Present in `js/app.js` | Browser global; not directly runnable in Node | Yes |
| `gridlyPortraitSpatialOwnershipAudit` | Present in `js/app.js` | Browser DOM geometry helper; not directly runnable in Node | Yes |
| `gridlyBriefSimplificationAudit` | Present in `js/app.js` | Browser DOM/runtime helper; not directly runnable in Node | Yes |
| `gridlyLocationTruthAudit` | Present in `js/app.js`; static test passed | `node tests/county-runtime/v869LocationTruthAudit.test.js` passed | Yes |
| `gridlyStaleFirstPaintGuardAudit` | Present in `js/app.js` | Browser/runtime state helper; V737 script failed due missing expected root audit document | Yes |
| `gridlyBriefInteractionAudit` | Present in `js/app.js` | Browser DOM interaction helper; not directly runnable in Node | Yes |
| `gridlyUiSmokeTest` | Present in `js/app.js` | Browser DOM/surface helper; not directly runnable in Node | Yes |
| `gridlyAlertCardConsumerAudit` | Present in `js/app.js` | Browser/runtime helper; not directly runnable in Node | Yes |
| `gridlyHazardPopupAudit` | Present in `js/app.js` | Browser/runtime helper; not directly runnable in Node | Yes |
| `gridlyClearedHazardPersistenceAudit` | Present in `js/app.js` | Related validation script failed because expected PASS note was not found | Yes |
| `gridlyCrossingPipelineAudit` | Present in `js/app.js` | Browser/runtime state helper; not directly runnable in Node | Yes |

### Terminal Checks Run

- `node tests/county-runtime/v867ControlRailStability.test.js` — passed.
- `node tests/county-runtime/v869LocationTruthAudit.test.js` — passed.
- `node tests/county-runtime/v862_11UnderpassCrossingEligibilityFilter.test.js` — completed in the chained command without an emitted failure before the next command ran.
- `node tests/unified-intelligence-awareness-brief-prototype.test.js` — passed with “V853 unified intelligence Awareness Brief prototype audit passed.”
- `node scripts/v729-liberty-cleared-incident-count-reconciliation-validation.mjs` — failed because the expected implementation note text `LIBERTY CLEARED INCIDENT COUNT RECONCILIATION PASS` was not found.
- `node scripts/v737-liberty-stale-first-paint-and-refresh-budget-audit-validation.mjs` — failed because it expected `GRIDLY-V737-LIBERTY-STALE-FIRST-PAINT-AND-REFRESH-BUDGET-AUDIT.md` at the repository root, but that file was not present there.

## 9. Performance Findings

The primary performance risk is **delay after report submission**. This audit did not submit a live report and did not change reporting. The likely user-visible risks to measure are:

- submit button remains busy too long;
- the map freezes while markers or alerts rebuild;
- the Brief briefly shows stale/wrong-area content during refresh;
- the report appears in one surface before another, causing trust confusion;
- weather or route refresh runs in the same perceived critical path.

Recommended threshold for beta: after tapping Submit, the user should see immediate acknowledgement within 300 ms, an optimistic or confirmed visible state within 1 second when possible, and no more than 2 seconds of perceived blocked UI under normal network conditions.

## 10. Trust / Location Findings

Location truth is one of the strongest parts of the current state.

- **Awareness area:** belongs to the header, filter context, Location Context card, and search context.
- **Hazard location:** belongs to hazard headlines, alert cards, alert sheet content, popups, marker popups, and route impact summaries.
- **Report location:** belongs to submission metadata and confirmation/evidence language, not the primary hazard headline.

This separation should remain protected. Do not let “reported near me” become the main hazard location if a better road/hazard location is available.

## 11. Weather Findings

Weather behavior is trustworthy if the locality gate is working at runtime.

Recommended product rule:

- Show weather only when it matches the canonical awareness area.
- Hide weather when unverified.
- Do not show generic weather unavailable/error language in the Brief unless the user explicitly opens a weather-specific surface.
- Do not let weather outrank active road, flood, crossing, closure, crash, or route-impact conditions.

Current audit answer: weather is **trusted when shown and safer when hidden**.

## 12. Multi-Condition Briefing Findings

The Brief should support multiple active conditions, but not as a full list.

Recommended rule:

- Show the **highest-impact active condition** as the primary Brief message.
- Add a short secondary phrase when more material conditions exist, for example: “2 other issues nearby.”
- Keep the full list in Alerts or the expanded details surface.
- Weather should only join the multi-condition summary when verified and material, such as severe weather, flood watch, or dangerous heat—not ordinary conditions.

Direct answer: **yes, multiple active conditions should appear in the Brief, but only as an acknowledgement/count or compact secondary summary.**

## 13. Recommended Next Branch

Recommended next implementation branch:

**V871 — Mobile Portrait Runtime Certification and Multi-Condition Brief Polish**

Proposed scope:

1. Run and capture the browser helper block on mobile portrait.
2. Certify sheet stacking and phone readability.
3. Add or refine compact multi-condition summary behavior if product leadership approves implementation.
4. Measure report-submission perceived latency.
5. Preserve all protected systems: reporting, Route Watch, weather validation, crossing logic, hazard lifecycle, and alert generation unless explicitly scoped.

## 14. Exact Browser / Phone Testing Checklist

Use a real phone when possible. If not, use Chrome DevTools mobile emulation and then repeat on at least one physical iPhone or Android device before beta.

### Setup

1. Open the app fresh in mobile portrait.
2. Use a narrow viewport first, such as 390 × 844.
3. Hard refresh / clear app storage for first-load tests.
4. Open DevTools Console.

### Required Helper Block

Run this exact block and save the full output:

```js
({
  canonical: window.gridlyCanonicalAwarenessPresentationAudit?.(),
  spatial: window.gridlyPortraitSpatialOwnershipAudit?.(),
  briefSimplification: window.gridlyBriefSimplificationAudit?.(),
  locationTruth: window.gridlyLocationTruthAudit?.(),
  staleFirstPaint: window.gridlyStaleFirstPaintGuardAudit?.(),
  briefInteraction: window.gridlyBriefInteractionAudit?.(),
  uiSmoke: window.gridlyUiSmokeTest?.(),
  alertCards: window.gridlyAlertCardConsumerAudit?.(),
  hazardPopup: window.gridlyHazardPopupAudit?.(),
  clearedPersistence: window.gridlyClearedHazardPersistenceAudit?.(),
  crossingPipeline: window.gridlyCrossingPipelineAudit?.()
})
```

### Home Screen Visual Checks

1. Confirm the Awareness Header is readable and not clipped.
2. Confirm the collapsed Brief handle is full width and easy to tap.
3. Expand the Brief and confirm it expands inline, not as a modal/drawer.
4. Confirm the expanded Brief does not cover the filter strip.
5. Confirm the map remains visible after expanding the Brief.
6. Confirm no horizontal scroll appears.
7. Confirm filter pills are readable and do not wrap awkwardly.
8. Confirm map controls are visible, stable, reachable, and not overlapping the filter strip or Location Context card.
9. Confirm Location Context card does not overlap the bottom dock.
10. Rotate to landscape and back to portrait; confirm layout recovers.

### Weather Checks

1. Test an awareness area with verified weather.
2. Confirm weather appears only when matched to the awareness area.
3. Test or simulate unverified weather locality.
4. Confirm weather hides cleanly without scary error copy.
5. Confirm active hazards outrank normal weather.

### Location Truth Checks

1. Set awareness area to Dayton, Liberty, then Cleveland.
2. For each area, run the helper block.
3. Confirm the header and Location Context card use the awareness area.
4. Open an active hazard and confirm the hazard headline uses the hazard road/place.
5. Confirm report-submission metadata does not replace the hazard location.
6. Confirm no stale labels from the previous area remain after switching.

### Report Hazard Flow

1. Open Report Hazard from the bottom dock.
2. Confirm the sheet is readable and the close/back behavior is obvious.
3. Submit a test report in the allowed test environment.
4. Measure time from Submit tap to visible acknowledgement.
5. Confirm the UI remains responsive during submission.
6. Confirm the new report appears consistently in relevant surfaces.
7. Confirm no duplicate marker appears.
8. Confirm the map does not jump unexpectedly unless intended.
9. Run the helper block again immediately after submission.

### Alerts Sheet

1. Open Alerts from the bottom dock.
2. Confirm cards are readable on phone.
3. Confirm hazard locations are clear.
4. Confirm cleared hazards do not appear as active.
5. Confirm closing Alerts returns to the same home/map state.
6. Confirm opening Alerts while Brief is expanded does not create confusing stacking.

### Historical Intelligence Sheet

1. Open Historical Intelligence.
2. Confirm it is visually secondary to current active hazard surfaces.
3. Confirm no stale current-condition wording appears in historical content.
4. Confirm it closes predictably.

### Settings Sheet

1. Open Settings.
2. Confirm it is readable and not clipped by the bottom dock or safe area.
3. Change awareness area if supported in the sheet.
4. Confirm all surfaces update to the same canonical area.
5. Close Settings and verify map/control stability.

### Route Preview / Route Details

1. Start a route preview.
2. Confirm route preview does not hide the map entirely.
3. Open route details.
4. Confirm route details are readable and close predictably.
5. Switch awareness area during or after route preview if supported.
6. Confirm no stale route text appears in the Brief.

### Multi-Condition Checks

1. Create or simulate two active conditions in the same awareness area.
2. Confirm the Brief names the highest-impact condition.
3. Confirm the Brief acknowledges additional active conditions compactly.
4. Confirm Alerts contains the full list.
5. Confirm weather appears only if verified and material.

### Stale First Paint Checks

1. Clear storage and load with the default awareness area.
2. Quickly switch awareness area.
3. Reload.
4. Confirm the first visible text is neutral or correct for the selected area.
5. Confirm no previous-area hazard or route appears during first paint.
6. Run `window.gridlyStaleFirstPaintGuardAudit?.()` and save output.

## 15. Final Recommendation

**Merge recommendation for this audit branch:** merge as documentation-only.

**Product recommendation:** do not declare beta complete until V871 captures browser/phone evidence for the required helpers, sheet stacking, post-report latency, multi-condition Brief behavior, and stale first-paint correctness.

## Direct Answers to Important Product Questions

1. **Is the current Brief too minimal, too heavy, or balanced?**  
   Balanced. It is appropriately concise for a mobile home surface.

2. **Should multiple active conditions appear in the Brief?**  
   Yes, but compactly. Show the top condition plus a count or short secondary phrase; keep the full list in Alerts.

3. **Is the weather behavior still trustworthy?**  
   Yes, if runtime locality gating is working. Hiding unverified weather is the correct trust behavior.

4. **Are hazard location and report location clearly separated?**  
   Yes in the model and helper design. Manual confirmation is still required on active cards, popups, and post-submit surfaces.

5. **Is the map still the primary experience?**  
   Yes by design. The audit helpers explicitly protect map visibility, but phone validation must confirm the lived experience.

6. **Are map controls discoverable and stable?**  
   Structurally yes. Discoverability and thumb reach still need phone validation.

7. **Are sheets readable on phone?**  
   Not certified by terminal audit. This remains a required browser/phone validation item.

8. **Is any stale or wrong-area content still possible?**  
   The guard reduces the risk, but runtime validation is still required. Wrong-area content is still possible if a surface bypasses canonical context or stale-first-paint guarding.

9. **Are there any remaining beta blockers?**  
   Yes: phone visual certification, post-report latency, sheet stacking, multi-condition presentation, and runtime stale/wrong-area proof.

10. **What should the next implementation branch be?**  
    V871 — Mobile Portrait Runtime Certification and Multi-Condition Brief Polish.
