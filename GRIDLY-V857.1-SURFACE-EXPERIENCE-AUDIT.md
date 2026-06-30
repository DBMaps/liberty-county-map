# GRIDLY V857.1 — Surface Experience Audit

## Executive Summary

V857.1 is an audit-only milestone for every major user-facing Gridly surface outside the certified Home Screen. No CSS, JavaScript, runtime, provider, feature-flag, networking, reporting, Route Watch, Supabase, hazard lifecycle, alert-generation, DriveTexas, Weather Provider, Cross Provider Evaluation, Community Reports, or Unified Intelligence behavior was changed.

The audit finds that Gridly now has a strong Home Screen language: calm dark-premium framing, a single primary awareness read, restrained supporting copy, compact segmented controls, icon-led bottom navigation, and an intentionally quiet reassurance layer. However, several non-home surfaces still carry earlier product eras: operations-command language, fallback sheet copy, legacy modals, dense settings sections, raw `X` close controls, and inconsistent button/spacing systems.

Overall verdict: **the surface system is directionally aligned but not yet fully unified with GRIDLY HOME SCREEN BASELINE V1.** The strongest surfaces are those already rendered through the Portrait V2 shell and bottom-sheet pattern. The weakest surfaces are legacy desktop/mobile panels and modals that remain functionally capable but visually heavier, more technical, and less premium than the locked Home Screen.

## Audit Scope and Evidence

### Surfaces reviewed

- Search destination overlay
- Alerts / operational feed
- Smart Alerts preferences
- Reporting drawer
- Portrait V2 report flow
- Route Watch strip, route setup, and route detail pane
- Community Pulse panels
- Settings modal and Portrait V2 settings sheet
- Bottom sheets and mobile native surface layer
- Modal dialogs
- Overlay panels
- Map controls and layer controls
- Empty states
- Loading states
- Confirmation dialogs
- Success messages
- Error / fallback messages
- Onboarding/welcome overlay as a related non-home modal surface

### Validation performed

- Documentation review against V856.9 Home Screen Lock Certification.
- Static markup review of `index.html` for all user-facing surface shells.
- Static style review of `css/styles.css`, with focus on Portrait V2, legacy modal, sheet, control, close-button, and mobile portrait rules.
- Static runtime review of `js/app.js`, with focus on Portrait V2 sheet templates, alerts/report/route/settings surface builders, feedback and confirmation plumbing, fallback states, and close/open behavior.
- Browser availability review by starting a local static server at `http://127.0.0.1:4173/index.html`.
- Screenshot review was limited to repository assets and static browser availability because no browser automation package was installed in the environment.
- Mobile portrait review was performed through code and CSS inspection of the portrait shell, mobile containment rules, fixed top/bottom surfaces, and mobile-first sheet templates.

## Home Screen Baseline V1 Reference Standard

The V856.9 lock establishes these qualities as the reference for all future surfaces:

1. Awareness Brief owns the first read.
2. Filter controls remain functional without competing.
3. The map remains the dominant working surface.
4. Location context stays supporting and quiet.
5. Navigation remains persistent but visually contained.
6. Trust language is reassurance, not metadata noise.
7. Each surface should have one responsibility.
8. Decorative indicators and divider-heavy structures should not be reintroduced without a clear comprehension need.

For V857.1, the core question is whether each non-home surface feels like it inherits that calm, premium, mobile-portrait-first language.

## Surface Inventory

| Surface | Current Pattern | Baseline Alignment | Key Audit Finding |
| --- | --- | ---: | --- |
| Search destination overlay | Floating card with label, input, clear, and close | Medium | Clear task model, but close treatment and plain field composition feel older than the Home Screen. |
| Alerts / operational feed | Desktop side panel plus Portrait V2 alerts sheet | Medium | V2 sheet is closer to baseline; legacy “Rail Pulse,” “Trending Now,” and “Impact Score” feel command-center-heavy. |
| Smart Alerts modal | Legacy premium preferences modal | Medium-Low | Useful, but “Gridly Premium” and checkbox grid feel denser and more product-tiered than the calm Home Screen. |
| Reporting drawer | Details-based report center and manual advanced reporting | Low-Medium | Community Reports remain primary, but the old drawer and advanced controls feel implementation-oriented. |
| Portrait V2 report flow | Bottom sheet with hazard picker and two placement CTAs | High | Best non-home expression of the new language, though hazard density and subtype copy need polish. |
| Route Watch strip | Desktop map strip with many controls and metrics | Medium-Low | Functionally rich but visually dense; Route Intelligence should remain second, not dominate. |
| Route setup / Manage Places modal | Legacy modal with saved-place cards and nested source steps | Medium | Good consumer concepts, but modal weight and multiple nested actions reduce premium calm. |
| Route details pane | Overlay dialog with context, severity, reasons, and actions | Medium-High | Strong explanation surface; needs closer close/action consistency. |
| Community Pulse | Lightweight map-adjacent pulse card | High | Strong relationship to Awareness Platform First when visible; should remain supporting. |
| Settings legacy modal | Large modal with accordion sections | Medium | Consumer sections are improved, but density, scroll depth, and mixed button styles lag baseline. |
| Portrait V2 settings sheet | Bottom sheet with list experience | Medium-High | More aligned than legacy modal; may still be too tall and form-heavy for portrait. |
| Bottom sheets | Portrait V2 sheet, mobile native sheet, report/route/detail overlays | Medium-High | Directionally right, but multiple implementations create inconsistent spacing, headers, and close controls. |
| Modal dialogs | Settings, Smart Alerts, Route Setup, Welcome | Medium | Strong functional coverage; inconsistent visual eras and close behavior. |
| Overlay panels | Destination impact, welcome overlay, search, surface layer | Medium | Good containment, but not yet one unified overlay design system. |
| Map controls | Control rail, scope segments, desktop toolbar, layers sheet | Medium-High | Portrait controls align well; desktop toolbar is denser and more technical. |
| Empty states | Alerts, saved places, quiet map, no favorites, no active route | Medium | Mostly understandable but inconsistent tone: some reassuring, some placeholder-like. |
| Loading states | Checking/scanning/loading copy across report, route, crossings, sync | Medium | Clear but varies from premium reassurance to raw status text. |
| Confirmation dialogs / boxes | Report confirmation, smart alerts confirmation, participation ack | Medium | Purpose is sound; presentation varies by legacy/new surface. |
| Success messages | Report mirror, settings save, feedback acknowledgement | Medium | Messages are present and helpful, but should be standardized around calm acknowledgement. |
| Error/fallback messages | Fallback mode, unavailable, precondition helper text | Medium-Low | Safe but sometimes reads like internal contingency rather than consumer guidance. |
| Welcome/onboarding overlay | Full setup wizard | Medium-High | Strong product philosophy; high visual mass but generally aligned with awareness-first onboarding. |

## Consistency Findings

### What is consistent

- The product now consistently privileges community awareness, live local context, and “know before you go” framing.
- Primary and secondary button classes are broadly reused across surfaces.
- Portrait V2 surfaces share a recognizable shell: fixed topbar, awareness card, segmented controls, control rail, bottom dock, and modal sheet.
- Settings and route surfaces increasingly use consumer concepts such as My Area, My Routes, Saved Places, Preferences, and About & Support.
- Empty/quiet states generally avoid implying failure; most explain that Gridly is checking, monitoring, or waiting for reports.

### What is inconsistent

- There are at least three surface generations active at once: legacy details/drawer panels, legacy modals, and Portrait V2 sheets.
- Close controls are inconsistent: raw `X` text appears in several places, while some buttons use shared `gridly-surface-close` styling and others do not.
- Surface headers vary between “Commute Command,” “Report Center,” “Live Reporting,” “Gridly Premium,” “Daily Route,” “Settings,” and “Mobile Surface.” The baseline wants simpler, clearer consumer language.
- Some surfaces still sound operational or internal: “Operational Feed,” “Movement Command Map,” “Monitoring OFF,” “Preview Only,” “fallback mode,” and “manual / advanced reporting.”
- Button hierarchy is sometimes overpopulated, especially Route Watch and Manage Places.
- Bottom sheets are directionally right, but the sheet ecosystem is not yet a single productized component.

## Strongest Surfaces

### 1. Portrait V2 report flow

The report flow best reflects the Home Screen baseline because it is mobile portrait-first, sheet-based, task-focused, and keeps Community Reports primary. The hazard picker is immediately understandable and the placement actions are limited to the two most direct paths: current location or tap map.

**Why it works:**

- One clear job: report a hazard.
- Community Reports remain the primary contribution mechanism.
- Uses the same bottom-sheet language as the locked Home Screen navigation environment.
- Primary/secondary action model is understandable.

**Remaining gap:** hazard choices can become visually dense, and “Other Hazard” subtype copy needs character cleanup and premium polish.

### 2. Community Pulse panel

Community Pulse is appropriately subordinate to the Awareness Brief. It summarizes local activity without becoming a competing dashboard.

**Why it works:**

- Supports Awareness Platform First.
- Uses short headline/subline structure.
- Does not overload the map.
- Feels like a lightweight interpretation layer rather than a feature panel.

**Remaining gap:** it should inherit exact Home Screen spacing and quiet-state language once V857.2 begins implementation.

### 3. Destination impact / route details pane

The destination impact pane is a strong explanatory surface because it answers “why am I seeing this?” with context, severity, confidence, reasons, and route actions.

**Why it works:**

- Route Intelligence is supporting rather than primary.
- The pane explains route state in consumer terms.
- Action grouping is clear enough to support completion.

**Remaining gap:** close/action styling and button order should be harmonized with Portrait V2 sheet conventions.

### 4. Portrait V2 map controls

The compact control rail and scope segmented control are close to the baseline: useful, contained, and visually subordinate to the awareness card and map.

**Why it works:**

- Icon controls stay compact.
- Scope segments are understandable and mobile-first.
- Map remains the working surface.

**Remaining gap:** layer controls and legacy desktop map toolbar should share naming and hierarchy.

## Weakest Surfaces

### 1. Legacy reporting drawer and manual advanced reporting

The reporting drawer is functionally complete, but visually and linguistically older. It mixes “Report Center,” “Live Reporting,” “Fast flow,” confirmation text, share card, quick clear, Report Mode, and advanced manual controls in one surface.

**Why it misses baseline:**

- Too many jobs in one area.
- Advanced controls expose implementation complexity.
- Details/summary drawer pattern feels less premium than the Home Screen.
- The primary community report path competes with share, clear, manual search, and reload controls.

### 2. Route Watch desktop strip

Route Watch is important, but its desktop strip has many controls and metrics at once: start, destination, start watch, show full route, stop, clear, manage places, freshness, monitoring, reports, recommendation, and setup hint.

**Why it misses baseline:**

- Route Intelligence risks becoming primary instead of second.
- Density and metric language feel operational.
- Several secondary actions have equal visual weight.
- Mobile portrait simplicity is not mirrored on desktop.

### 3. Legacy settings modal

Settings has improved consumer sections, but it remains a large modal with nested details, inputs, toggles, selects, install, about, setup replay, feedback, and support content.

**Why it misses baseline:**

- Too much density for one modal.
- Multiple accordions and form controls create a utility-admin feel.
- The modal feels more like account preferences than a premium mobile surface.
- It competes with the newer Portrait V2 settings sheet.

### 4. Smart Alerts modal

The Smart Alerts modal is clear enough but feels visually and verbally like a legacy upsell/preferences screen.

**Why it misses baseline:**

- “Gridly Premium” label introduces product-tier language that can distract from awareness.
- Checkbox grid is practical but not visually aligned with the calm card hierarchy.
- Notification-development disclaimer is necessary but heavy.

### 5. Error/fallback states

Fallback states are safe, but some copy exposes internal state: “fallback mode,” “reopen later,” “not exposed yet,” “missing,” or setup-precondition fragments.

**Why it misses baseline:**

- Consumer trust depends on calm explanation, not implementation disclosure.
- Error copy should preserve premium confidence even when capabilities are unavailable.

## Consumer Language Review

### Aligned language

- “Your area is clear right now”
- “Monitoring nearby conditions”
- “Know Before You Go”
- “Community awareness”
- “No active alerts right now”
- “Save Home for Destination Search and Route Watch”
- “Location is used only when requested”
- “Every report helps someone know before they go”

### Language that needs refinement

| Current wording | Issue | Recommended direction |
| --- | --- | --- |
| “Commute Command” | Too operational/militarized | “Alerts” or “Local Alerts” |
| “Movement Command Map” | Command-center tone | “Live Map” or “Community Map” |
| “Operational Feed” | Internal/ops language | “Live Alerts” or “Local Updates” |
| “Manual / advanced reporting” | Implementation-oriented | “Find a crossing manually” or hide behind “More options” |
| “Monitoring OFF” | System status tone | “Route Watch not started” |
| “Preview Only” | Internal state | “Route preview” |
| “fallback mode” | Internal failure state | “This panel is temporarily unavailable. Try again in a moment.” |
| “Gridly Premium” | Tier language may compete with trust | “Smart Alerts” or “Alert Preferences” |
| “Use Current Map Center for This Place” | Technical map concept | “Use this map location” |
| “Reload Live Reports” | System action | “Check reports again” |

## Visual Hierarchy Review

### Strengths

- Portrait V2 top stack is clearly hierarchical: awareness card, filters, map, controls, dock.
- Community Pulse and location context are appropriately quieter than the Awareness Brief.
- Primary/secondary buttons generally communicate action weight.
- The destination impact pane has a reasonable heading, context block, reason list, and action footer.

### Gaps

- Legacy panels often give multiple elements equal emphasis.
- Settings and Route Watch use dense card grids and accordion blocks that reduce first-glance clarity.
- Some helper notes and disclaimers are visually as present as task-driving copy.
- Report drawer mixes primary reporting, confirmation, sharing, clearing, and advanced reporting in one hierarchy.
- The Home Screen’s quiet trust-line treatment has not yet propagated to all status/helper text.

## Interaction Review

### Strong interactions

- Bottom dock opens primary portrait surfaces predictably.
- Portrait V2 sheet containment suppresses duplicate legacy surfaces when active.
- Route details pane provides a reasonable close/done/action model.
- Report flow narrows choices before placement.
- Settings uses expandable sections to reduce initial detail exposure.

### Interaction risks

- Multiple ways to reach the same surface can reveal different UI generations.
- Close buttons and backdrop behavior vary by surface.
- Report flow has legacy drawer, mobile mode card, Portrait V2 sheet, and native surface pathways.
- Route Watch actions can feel reversible/ambiguous: Show Full Route, Stop Watch, Clear Route, Manage Places, Start Route Watch.
- Error/fallback flows do not always direct the user to the next best action.

## Mobile Portrait Review

### What works

- Portrait V2 is the correct direction for the Surface Experience Program.
- Bottom dock actions are limited and understandable.
- The map control rail is compact and thumb-accessible.
- V2 sheets reserve dock clearance and are designed for contained scrolling.
- Report, Alerts, History, and Settings are reachable from a consistent dock.

### What needs work

- Some V2 sheet content is still too form/list dense for small screens.
- Legacy surfaces can still appear in mobile pathways and feel visually unrelated to the Home Screen.
- Settings may require too much vertical scrolling and nested interaction.
- Route setup and saved places have too many steps/choices without enough progressive disclosure.
- Close affordance should become a consistent icon or labeled control, not raw `X` text.

## Design Consistency Matrix

Scoring: 5 = strongly matches Home Screen Baseline V1, 3 = partially aligned, 1 = misaligned.

| Surface | Visual | Type | Spacing | Language | Hierarchy | Buttons | Icons | Close | Animation | Flow | Mobile | Baseline Relationship | Priority |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Search | 3 | 3 | 3 | 4 | 4 | 3 | 2 | 2 | 3 | 4 | 4 | 3 | Medium |
| Alerts legacy panel | 3 | 3 | 3 | 2 | 3 | 3 | 2 | 2 | 3 | 3 | 2 | 2 | High |
| Alerts V2 sheet | 4 | 4 | 4 | 3 | 4 | 4 | 3 | 3 | 4 | 4 | 4 | 4 | Medium |
| Smart Alerts | 3 | 3 | 3 | 3 | 3 | 4 | 2 | 3 | 3 | 4 | 3 | 3 | Medium |
| Reporting drawer | 2 | 3 | 2 | 3 | 2 | 3 | 2 | 2 | 2 | 3 | 2 | 2 | High |
| Report V2 flow | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 5 | 4 | High |
| Route Watch strip | 3 | 3 | 2 | 2 | 2 | 3 | 2 | N/A | 3 | 3 | 2 | 2 | High |
| Manage Places modal | 3 | 3 | 3 | 4 | 3 | 4 | 2 | 3 | 3 | 3 | 3 | 3 | Medium |
| Route details pane | 4 | 4 | 4 | 4 | 4 | 4 | 2 | 3 | 4 | 4 | 4 | 4 | Medium |
| Community Pulse | 4 | 4 | 4 | 4 | 4 | 3 | 2 | N/A | 4 | 4 | 4 | 5 | Low |
| Settings legacy modal | 3 | 3 | 3 | 4 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | Medium |
| Settings V2 sheet | 4 | 4 | 3 | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 4 | 4 | Medium |
| Bottom sheets overall | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 4 | 4 | High |
| Modal dialogs overall | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | Medium |
| Overlay panels overall | 3 | 4 | 3 | 4 | 4 | 3 | 2 | 3 | 4 | 4 | 4 | 4 | Medium |
| Map controls | 4 | 4 | 4 | 3 | 4 | 4 | 4 | N/A | 4 | 4 | 5 | 4 | Medium |
| Empty states | 3 | 3 | 3 | 3 | 3 | 3 | 2 | N/A | 3 | 3 | 3 | 3 | High |
| Loading states | 3 | 3 | 3 | 3 | 3 | N/A | 2 | N/A | 3 | 3 | 3 | 3 | Medium |
| Confirmations | 3 | 3 | 3 | 4 | 3 | 3 | 2 | N/A | 3 | 4 | 3 | 3 | Medium |
| Success messages | 3 | 3 | 3 | 4 | 3 | 3 | 2 | N/A | 3 | 4 | 3 | 3 | Medium |
| Error messages | 2 | 3 | 3 | 2 | 3 | 3 | 2 | N/A | 3 | 3 | 3 | 2 | High |
| Welcome overlay | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 4 | 4 | Low |

## Recommended Refinement Order

1. **Unify close controls and sheet headers.** Establish one close treatment for V2 sheets, legacy modals, destination panes, search, and mobile native surfaces.
2. **Productize bottom sheets as the canonical non-home surface.** Route Report, Alerts, Settings, Layers, and Route details through one sheet language where possible.
3. **Rewrite operational language.** Replace command-center and fallback language with consumer awareness language.
4. **Simplify reporting outside the Home Screen.** Preserve Community Reports as primary while moving advanced reporting behind calmer progressive disclosure.
5. **Reduce Route Watch density.** Preserve Route Intelligence Second by making status and next action primary, with technical metrics secondary.
6. **Normalize empty/loading/success/error states.** Create a small state-language system that matches Home Screen reassurance.
7. **Align Settings.** Prefer the V2 settings sheet language; reduce legacy modal density and make key user tasks first.
8. **Align Search.** Make destination search feel like a premium bottom/overlay surface with consistent close/action styling.
9. **Polish Map controls.** Keep portrait controls; simplify desktop toolbar language and ensure layer labels align with settings map-style labels.
10. **Validate with mobile portrait screenshots.** Future implementation should compare every surface to the locked Home Screen at 390 × 844 and 430 × 932.

## Risk Assessment

| Risk | Level | Notes | Mitigation |
| --- | --- | --- | --- |
| Protected systems accidentally changed | Low in V857.1 | Documentation only. | Keep V857.2 presentation/copy-only unless separately authorized. |
| Community Reports losing primacy | Medium | Reporting has several competing actions. | Make report contribution the first path; keep share/advanced/clear secondary. |
| Route Intelligence becoming primary | Medium | Route Watch strip is dense and action-heavy. | Reduce Route Watch hierarchy to status + one next action. |
| Multiple UI generations confusing users | High | Legacy panels, modals, and V2 sheets coexist. | Define one canonical surface model before broad implementation. |
| Error/fallback copy reducing trust | Medium | Some states expose internal fallback. | Replace with calm consumer guidance. |
| Mobile portrait crowding | High | Settings, route setup, and report advanced flows can exceed comfortable density. | Use progressive disclosure, bottom-sheet limits, and first-action hierarchy. |
| Over-polishing without preserving utility | Medium | Premium calm should not hide safety-critical actions. | Keep report, alerts, and route actions visible but ordered. |

## Recommended V857.2 Scope

V857.2 should be a **presentation and consumer-language alignment milestone** focused on the highest-leverage inconsistencies. It should not modify providers, networking, Supabase, hazard lifecycle, alert generation, reporting data contracts, Route Watch logic, Community Reports logic, Unified Intelligence logic, DriveTexas, Weather Provider, or Cross Provider Evaluation.

Recommended V857.2 scope:

1. Define the shared non-home surface standard:
   - sheet header,
   - close button,
   - title/subtitle language,
   - primary/secondary action order,
   - empty/loading/success/error tone.
2. Apply that standard first to:
   - Portrait V2 report sheet,
   - Alerts V2 sheet,
   - Settings V2 sheet,
   - Route details pane,
   - Search overlay.
3. Rewrite high-risk labels:
   - Commute Command,
   - Operational Feed,
   - Movement Command Map,
   - Manual / advanced reporting,
   - fallback mode,
   - Monitoring OFF / Preview Only.
4. Keep Community Pulse and the Home Screen untouched except for ensuring language compatibility if needed.
5. Produce before/after mobile portrait screenshots for each changed surface.
6. Re-run V857.1 matrix as the V857.2 acceptance audit.

## Merge Recommendation

**Merge recommended for V857.1.** This is documentation only, establishes the surface inventory, identifies strongest and weakest areas, and creates a clear V857.2 implementation roadmap without touching protected systems or runtime behavior.

## Exact Testing Steps

1. Review repository status:
   `git status --short`
2. Start a local static server:
   `python3 -m http.server 4173`
3. Open the app where browser tooling is available:
   `http://127.0.0.1:4173/index.html`
4. Review Home Screen baseline documentation:
   `cat GRIDLY-V856.9-HOME-SCREEN-LOCK-CERTIFICATION.md`
5. Review user-facing surface markup:
   `sed -n '1,1560p' index.html`
6. Review Portrait V2 surface templates and sheet wiring:
   `sed -n '84280,85360p' js/app.js`
7. Review portrait and sheet styles:
   `sed -n '13620,14630p' css/styles.css`
8. Review Home Screen lock style refinements:
   `sed -n '21370,21580p' css/styles.css`
9. Run JavaScript syntax validation:
   `node --check js/app.js`
10. Confirm documentation-only diff:
   `git diff -- GRIDLY-V857.1-SURFACE-EXPERIENCE-AUDIT.md`
