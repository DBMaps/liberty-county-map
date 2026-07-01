# GRIDLY V856.1 — Startup Experience Audit

## Executive Summary

This audit reviews the current Gridly startup and first-use experience from initial page load through the point where the interface appears operational. This is a documentation-only milestone: no runtime behavior, rendering order, provider wiring, protected systems, feature flags, networking, or production UI code were changed.

The current experience is functionally rich but visually over-scheduled at startup. Multiple surfaces attempt to establish priority at the same time: brand chrome, desktop/mobile gates, a movement hero, the Awareness Brief, route-watch controls, mobile priority cards, the map command card, Community Pulse, alerts, and reporting affordances. The result is a startup that often feels technically active before it feels intentionally choreographed.

The strongest product direction is to make the Awareness Brief the perceived first destination, then reveal map and reporting controls as supporting context. Today, the map and operational controls frequently compete with the Awareness Brief, especially on mobile portrait where the user sees several “primary” concepts before understanding which one is the actual first-use anchor.

Recommended V856.2 implementation direction: introduce a startup choreography pass that preserves existing systems but sequences visual priority around: **Brand → Awareness Brief → Map context → Community Pulse → Report / Route / Alerts controls → Secondary intelligence cards**.

## Current Startup Timeline

### 1. Document shell and static chrome

The page starts with standard application metadata, mobile viewport constraints, Leaflet CSS, Gridly styles, manifest, app icons, and mobile web app tags. The first visible semantic surfaces are the desktop app header, mobile live brand header, landscape gate, desktop gate, hidden search shell, and the main premium layout.

Perceived effect:

- Gridly identity appears early.
- Several environment-specific wrappers are present before the user reaches the core product story.
- The startup feels like a command center being assembled rather than a focused “know before you go” moment.

### 2. Dashboard and hero area

The dashboard begins with a decorative movement intelligence hero that presents “Live Rail Pulse,” “Liberty County · Active Feed,” and a hard-coded “2 Crossings Active” style message before the Awareness Brief card. The Awareness Brief follows with “Checking Gridly,” “Building your town’s awareness briefing...,” and freshness/loading status lines.

Perceived effect:

- The decorative movement hero may be what appears first visually, not the Awareness Brief.
- The Awareness Brief exists in the right conceptual role but may not receive first visual priority.
- Users may initially understand the app as a live rail dashboard before they understand it as a local awareness brief.

### 3. Mobile-first quick cards

The mobile home cards include Awareness Brief, Fast Report, Community Map, Quick Actions, Community Impact, Movement Intelligence, and live operations status. These cards are useful but compete for priority when rendered together.

Perceived effect:

- The mobile Awareness Brief competes with Fast Report and Community Map immediately.
- Reporting appears very early, which is useful for active incidents but aggressive for quiet-state first use.
- Secondary intelligence cards can make the first viewport feel dense before the user has received a clear situation summary.

### 4. Map command section

The map section contains a route/destination command surface, live commute state, desktop Route Watch strip, map header, Community Pulse surface, toolbar/filter controls, and the map container. The map initializes in JavaScript after the DOM is hydrated and before crossing/report loads complete.

Perceived effect:

- The map becomes an important visual anchor as soon as it appears, but its supporting data arrives in later phases.
- Map controls and command panels create a strong operational impression before the startup narrative has settled.
- Community Pulse is structurally near the map but starts hidden, so it does not reliably participate in first meaningful paint.

### 5. JavaScript bootstrap

The main DOMContentLoaded bootstrap performs UI hydration, layout detection, health checks, default state setup, movement intelligence seeding, debug global setup, greeting initialization, map initialization, Supabase initialization, event binding, report-mode setup, route/settings loading, daily destination setup, mobile header updates, first-run setup, then sequentially awaits crossing loading, roadway dataset loading, and shared report loading. Desktop then renders Community Pulse and an intelligence preview, followed by the live refresh interval.

Perceived effect:

- The UI is visible while the data model is still moving through several phases.
- Loading copy changes across multiple components rather than feeling like one coordinated startup state.
- Sequential awaits can make the operational state feel like it snaps into place in steps rather than progressively becoming more trustworthy.

## UX Findings

### Startup loading sequence

The startup sequence is visually busy. There is no single perceived loading conductor. Static markup, mobile/desktop wrappers, hero content, map command UI, route controls, and report controls all exist before the app has completed its bootstrap path.

Finding:

- Gridly has enough loading and status signals, but they are distributed across too many surfaces.
- Users receive multiple startup promises: checking Gridly, building awareness, live rail pulse, route confidence, live commute state, route watch, active feed, and map intelligence.
- These promises are individually useful but collectively weaken perceived confidence.

### First meaningful paint

The first meaningful product paint should be “What should I know before I go?” Current structure can make the first meaningful paint feel like “A complex live mobility dashboard is loading.”

Finding:

- The Awareness Brief is present, but not always visually dominant.
- Decorative movement/map motifs can precede actionable context.
- Status wording is generally appropriate, but the hierarchy does not consistently imply that Awareness Brief owns the startup narrative.

### Awareness Brief prominence

The Awareness Brief should be the highest-priority startup surface. It should behave like the product’s opening sentence. Today it is one important card among several important cards.

Finding:

- Desktop: the Awareness Brief follows a prominent movement hero, creating an ordering conflict.
- Mobile: the Awareness Brief card is first among mobile cards, but Fast Report and Community Map immediately compete for primary action status.
- The Awareness Brief could absorb or visually reference nearby pulse/weather/context signals without becoming a large command module.

### Map initialization

The map initializes early in the bootstrap process and then receives data overlays after crossings, roadway datasets, and reports load. This is technically reasonable, but the perceived experience can feel like the map is “empty” or “waiting” unless the supporting copy is choreographed.

Finding:

- The map is visually powerful enough to pull attention before live/report context is ready.
- The map toolbar and filters can feel active before the user has a reason to manipulate them.
- The best perceived startup order is not “map first”; it is “brief first, map confirms.”

### Progressive reveal opportunities

Several surfaces would benefit from delayed emphasis rather than delayed existence.

Best candidates for progressive reveal:

1. Awareness Brief headline and status.
2. Map frame and minimal trust note.
3. Community Pulse once reports are loaded or quiet-state confidence is known.
4. Reporting shortcuts after the user sees the current state.
5. Secondary cards after operational stability.

Important distinction:

- V856.2 should avoid changing runtime loading or provider order unless separately authorized.
- The opportunity is primarily visual choreography, loading language, and prioritization.

### Quiet-state experience

Quiet state currently has useful copy such as community quiet / checking reports / no live corridor data yet. However, quiet state can feel like an absence rather than a successful result.

Finding:

- “Community quiet” should feel like a clear outcome, not a placeholder.
- Empty secondary cards should not dominate first view.
- The quiet state should summarize: area watched, freshness, what sources were checked, and what to do next.

### Active-state experience

Active state benefits from the existing map, alerts, report controls, and community pulse architecture. The risk is that multiple surfaces may all claim urgency at once.

Finding:

- Active incident startup should elevate the Awareness Brief headline first, then map/location detail second, then reporting/confirmation controls third.
- Fast Report is valuable during active state but should not outrank the initial situational assessment.
- Community Pulse should explain strength/freshness of signal rather than compete as another alert headline.

### Empty-state handling

Current empty states are functional but uneven. Examples include loading/quiet text for crossings, reports, Community Pulse, corridor data, and route setup.

Finding:

- Empty states should be grouped into intentional categories: still loading, no activity found, setup needed, unavailable, and action recommended.
- Startup should avoid showing multiple unrelated empty states simultaneously.
- Secondary empty states should be muted until the Awareness Brief has resolved.

### Mobile portrait experience

Mobile portrait contains the strongest first-use challenge. The mobile shell includes a live brand header, premium header, Awareness Brief, Fast Report, Community Map, quick actions, Community Impact, Movement Intelligence, status bar, live command, daily panel, floating docks, sticky report controls, bottom nav, and native surface layer.

Finding:

- Mobile has too many first-screen claimants.
- The map-first and card-first concepts coexist, which can feel like two product directions at once.
- The Awareness Brief should own the first mobile decision moment, with map/reporting tools becoming available but less visually loud.

### Perceived loading quality

The product has strong status copy but lacks a single perceived loading rhythm. Some surfaces show explicit loading copy, some show default operational copy, some are hidden until later, and some are decorative.

Finding:

- Loading quality would improve if startup used consistent phases: Checking area, loading crossings/map context, reviewing community reports, ready.
- Placeholder language should read as intentional progress, not system uncertainty.
- Avoid abrupt changes from “checking” to fully operational without a brief “ready” confidence cue.

## Friction Points

1. **Awareness Brief is not guaranteed to be the first perceived product surface.**  
   The decorative movement hero and map command surfaces can outrank it visually.

2. **Too many primary actions are visible early.**  
   Report, route, alerts, map, live feed, and settings all appear before the user understands the current situation.

3. **Map can feel disconnected from Awareness Brief.**  
   The map supports awareness, but it is introduced as a command map with many controls rather than as the visual proof of the brief.

4. **Community Pulse is structurally important but temporally late/hidden.**  
   It does not consistently help the first-use narrative even though it could explain confidence and signal quality.

5. **Quiet-state language is partly successful but not fully celebratory.**  
   “No data yet” and “building signal” states can feel unfinished instead of reassuring.

6. **Mobile portrait stacks competing concepts.**  
   Awareness, fast reporting, map preview, quick actions, community trust, corridor intelligence, and live command all compete for immediate interpretation.

7. **Transitions feel like state replacement rather than choreography.**  
   Existing text updates are useful, but they do not always feel like a designed sequence.

## Opportunities

### Make the Awareness Brief the startup anchor

- Treat Awareness Brief as the opening card on both desktop and mobile.
- Use it to answer: “Is anything happening near me right now?”
- Let route, report, map, and pulse surfaces support that answer rather than compete with it.

### Reframe the map as confirmation, not the opening act

- Present map as “where this is happening” after the brief establishes “what is happening.”
- Keep map controls available but visually secondary during first startup.
- Use trust note and Community Pulse to bridge the brief to the map.

### Use Community Pulse as confidence context

- In quiet state: “No active community reports in the selected area; last scan/freshness context.”
- In active state: “Community signal strength, confirmations, recent clears, and report freshness.”
- Avoid turning Community Pulse into a second alert headline.

### Stage reporting controls by intent

- Quiet state: reporting should be present but not urgent.
- Active state: reporting/confirmation can become more prominent after the active brief appears.
- First-run state: reporting should feel like “help the network” after the user understands the network.

### Reduce simultaneous empty states

- Secondary cards should not lead with “No live corridor data yet” during first use unless the user is already exploring that surface.
- Empty-state copy should be subordinate to the primary brief outcome.

## Startup Choreography Recommendation

Recommended ideal startup choreography for V856.2:

### Phase 0 — Brand shell

Goal: confirm the app loaded and the watched area.

Perceived content:

- Gridly logo / Liberty County Beta.
- Minimal watched-area cue.
- Avoid exposing multiple command controls as the first emotional impression.

### Phase 1 — Awareness Brief loading

Goal: make the primary promise clear.

Perceived content:

- “Checking Gridly” or equivalent.
- Area being checked.
- Short status line: reports, crossings, freshness.
- No competing hero metric should outrank this phase.

### Phase 2 — Awareness Brief resolved

Goal: tell the user the current situation.

Quiet state:

- “Community quiet” with confidence/freshness.
- Explain what was checked.
- Offer calm next actions: view map, report something, set route.

Active state:

- Most relevant active issue.
- Where it is happening.
- How fresh/confirmed it is.
- Primary next action: view map/route impact.

### Phase 3 — Map confirms the brief

Goal: show spatial context after the summary.

Perceived content:

- Map appears as evidence for the brief.
- Controls remain visually available but not dominant.
- Toolbar/filter density should not overshadow the map’s explanatory role.

### Phase 4 — Community Pulse and secondary intelligence

Goal: explain confidence and broader activity.

Perceived content:

- Community Pulse shows signal/freshness/confidence.
- Route Watch, report controls, alerts, and secondary cards become increasingly actionable.

### Phase 5 — Stable operational state

Goal: full app ready.

Perceived content:

- All expected controls visible.
- Reports, alerts, route watch, settings, and secondary panels available.
- Loading language replaced with stable confidence language.

## Quiet-State Review

Quiet state should be one of Gridly’s best product moments. The absence of incidents is valuable information.

### Current strengths

- The mobile Awareness Brief already has “COMMUNITY QUIET” language.
- Report freshness and crossing baseline loading language exists.
- Community trust language supports the idea that quiet state depends on shared reports.

### Current weaknesses

- Quiet state competes with “Report Hazard Fast,” “Movement Intelligence,” “No live corridor data yet,” and map controls.
- Some quiet/empty language feels like pending setup rather than a completed scan.
- The user may not know whether quiet means “nothing found,” “still loading,” or “not enough signal.”

### Recommended quiet-state design intent

Quiet state should communicate:

1. Area being watched.
2. Last freshness check.
3. No active community issues found.
4. Crossings/map context loaded or still loading.
5. Calm next action: “Check route” or “Report if you see something.”

## Active-State Review

Active state should prioritize clarity and reduce alarm competition.

### Current strengths

- The app has rich active-state surfaces: map markers, alerts, report flows, route watch, Community Pulse, and mobile action controls.
- Existing copy supports location, freshness, and route impact concepts.
- Fast reporting and clearing actions are useful when an active condition exists.

### Current weaknesses

- Multiple surfaces can present urgency simultaneously.
- Fast Report can visually compete with the incident summary.
- Community Pulse could be mistaken for another alert instead of confidence context.

### Recommended active-state design intent

Active state should communicate:

1. Primary active issue.
2. Exact or approximate area.
3. Freshness and confidence.
4. Route/map impact.
5. Confirm/report/clear actions.
6. Secondary community context.

## Weather Context Recommendation

This milestone does not implement weather UI. Future Current Weather Context should live **inside or immediately adjacent to the Awareness Brief**, not as an independent top-level card during startup.

### Recommended placement

Best placement: a compact context row within the Awareness Brief after the primary status headline and before secondary actions.

Suggested design-only structure:

- Awareness headline: “Community quiet” or active issue.
- Brief detail: what/where/freshness.
- **Weather context row:** “Weather nearby: light rain / reduced visibility / clear conditions.”
- Supporting action row: View map, Start Route Watch, Report.

### Why this placement works

- Weather is context, not the primary product event.
- It can explain road risk without becoming a competing alert.
- It naturally supports both quiet and active states.
- It avoids creating another startup surface.

### Interaction guidance

- Quiet state: weather should only appear if it changes interpretation of local mobility conditions.
- Active state: weather can qualify route caution, visibility, flooding likelihood, or report interpretation.
- Do not show weather as a separate “provider card” during startup unless a future milestone intentionally expands the Awareness Brief into a context stack.

## Mobile-First Assessment

### What appears first

On mobile, brand/status chrome and mobile-specific headers appear before or alongside the dashboard. The mobile Awareness Brief card is positioned early, but it is immediately surrounded by Fast Report, Community Map, Quick Actions, Community Impact, Movement Intelligence, live status, and floating controls.

### What appears last

Operational stability appears after map initialization and sequential data loading. Community Pulse and intelligence preview rendering are conditional and desktop-focused during initial bootstrap, so mobile may feel like it has many controls before it has a fully resolved confidence story.

### Large empty spaces

Potential empty-space perception occurs in:

- Map frame before tiles/markers feel complete.
- Corridor intelligence card when no corridor data is available.
- Community/alerts areas when there are no active reports.
- Route setup/Route Watch areas before destinations are saved.

### Abrupt or unfinished transitions

Potential abruptness occurs when:

- Loading copy changes independently across cards.
- The map becomes available before its context feels ready.
- Hidden/conditional surfaces appear after data load without a visible narrative bridge.
- Quiet-state cards remain visually equal to active control cards.

### Mobile recommendation

V856.2 should make mobile startup feel like a guided stack:

1. Watched area / brand.
2. Awareness Brief.
3. Map preview / route context.
4. Community Pulse confidence.
5. Report and route actions.
6. Secondary cards.

The current bottom navigation and floating action controls can remain available, but first-screen visual emphasis should not imply that all actions are equally urgent.

## Risk Assessment

### Product risks if unchanged

- Users may perceive Gridly as complicated before they perceive it as useful.
- Quiet state may look like missing data rather than successful awareness.
- Active state may create competing urgency rather than clear next action.
- Mobile users may struggle to identify the intended first step.

### Implementation risks for V856.2

- Changing visual order could accidentally alter protected runtime assumptions if done by moving logic rather than presentation.
- Hiding or delaying controls too aggressively could reduce perceived capability.
- Over-centering the Awareness Brief could bury fast reporting for users arriving during an active event.
- Weather context could become a competing provider surface if not constrained to brief-level context.

### Guardrails

V856.2 should preserve:

- Community Reports behavior.
- Unified Intelligence behavior.
- DriveTexas provider behavior.
- Weather provider behavior.
- Cross Provider Evaluation behavior.
- Runtime loading order unless separately authorized.
- Existing feature flags.
- Protected systems.

Recommended implementation style:

- Prefer CSS/markup choreography and copy refinement.
- Avoid provider, fetch, alert, report, or intelligence mutations.
- Add no new network dependencies.
- Keep audit-only findings as the source of truth for acceptance criteria.

## Recommended Next Implementation Milestone

### V856.2 — Startup Choreography and Awareness Brief Priority Pass

Objective:

Implement a visual-only startup choreography pass that makes the Awareness Brief the primary startup surface while preserving existing runtime behavior and protected systems.

Recommended scope:

1. Establish Awareness Brief as first visual priority on desktop and mobile.
2. Reduce decorative hero competition during initial startup.
3. Rebalance mobile first viewport around Awareness Brief → map → Community Pulse → actions.
4. Clarify quiet-state copy so “no activity” feels like a successful scan.
5. Make Community Pulse read as confidence context, not a competing alert.
6. Define a non-implemented placeholder design contract for future Current Weather Context inside the Awareness Brief.
7. Preserve all runtime data loading, providers, reports, intelligence, feature flags, and protected systems.

Acceptance criteria for V856.2:

- The first perceived product message is the Awareness Brief.
- Quiet state feels complete and reassuring.
- Active state has one dominant incident summary before secondary controls.
- Map appears as supporting spatial proof, not a competing command surface.
- Community Pulse appears in a natural supporting role.
- Reporting remains available without visually overpowering startup.
- No production behavior, provider, report, intelligence, or protected-system change is introduced without separate authorization.
