# Gridly V858 — First Run Experience Audit and Simplified Onboarding Specification

## Mission

**Know Before You Go**

Gridly remains:

1. **Awareness Platform First**
2. **Route Intelligence Second**

V858 is a documentation/design milestone only. It audits the current first-run experience and defines an implementation-ready simplified onboarding specification. No runtime behavior, alert generation, hazard lifecycle, Community Reports, Route Watch, Unified Intelligence, weather provider, Supabase, search providers, routing, runtime ownership, or rendering architecture is changed by this document.

## Protected Systems Statement

The recommended V858 implementation must not modify protected runtime systems. The onboarding layer may collect and persist user setup choices through existing preferences and settings paths, but must treat the following as unchanged consumers:

- Alert generation
- Hazard lifecycle
- Community Reports
- Route Watch
- Unified Intelligence
- Weather provider
- Supabase
- Search providers
- Routing
- Runtime ownership
- Rendering architecture
- Existing county-aware infrastructure
- Existing awareness-area architecture internally

## Guiding Principle

Ask for the minimum amount of information required to deliver value.

A first-time user should not need to understand awareness areas, counties, runtime configuration, community package loading, internal validation-only counties, or the difference between awareness-first and route-aware subsystems. Gridly should configure itself whenever possible.

---

# V858.1 — First Run Experience Audit

## Current first-run inventory

### 1. Splash and startup surfaces

The app currently has a strong startup direction from recent V856 work: the Awareness Brief should be the perceived first destination, and the map should support that brief rather than compete with it. However, first launch still includes several overlapping concepts before the user receives value:

- Mobile brand/header surfaces.
- Awareness Brief and home cards.
- Map and command surfaces.
- A first-run welcome overlay.
- A separate legacy beta welcome modal path.
- Location readiness diagnostics that deliberately avoid prompting at startup.
- Settings replay entry points.

This means the product direction is sound, but the first-run path is not yet simple enough.

### 2. Welcome overlay

The primary welcome overlay is a seven-step modal. It includes:

1. Product promise.
2. Personalization.
3. Community purpose.
4. County and home-area choice.
5. Daily route setup.
6. Community-reporting purpose.
7. Completion.

Strengths:

- The mission language is emotionally aligned: “Know Before You Go.”
- The user learns that Gridly is community-powered.
- The final state reinforces belonging to a local awareness network.
- The flow has clear Back, Skip, Next, and Finish controls.

Issues:

- Seven steps are too many before value.
- Theme, text size, and preferred name are not required to deliver first value.
- County selection asks users to reason about an implementation unit.
- Home-area selection uses internal product language.
- Daily route setup appears before the user has seen core awareness value.
- Community-reporting education appears twice: once in the opening value proposition and again as its own step.
- The stepper itself visually communicates a long setup commitment.
- “Skip” is available, but skipping may feel like abandoning setup rather than taking the fastest path to value.

### 3. Legacy beta welcome modal

There is also a legacy beta welcome path that stores a separate welcome-seen key and displays a simple “Welcome to Gridly Beta” modal. This creates first-run ambiguity because two welcome concepts exist: the modern multi-step onboarding overlay and a legacy beta modal. Even if conditions prevent both from appearing in normal production, the design surface remains fragmented and should be retired or formally subordinated during implementation.

### 4. ZIP code onboarding

The codebase contains legacy setup element references for ZIP, town, state, detected town, and setup completion. The current visible modern welcome overlay does not provide a ZIP-first path. ZIP code is a strong low-friction input because it is familiar, short, and usually enough to infer a home area and county, but it needs a deterministic resolver and a user-visible fallback when multiple areas are possible.

### 5. Place-name onboarding feasibility

Place-name onboarding is highly desirable long term because consumers think in terms of “Dayton,” “Cleveland,” “Conroe,” “my town,” or a nearby community rather than county/runtime boundaries. Existing awareness-area lookup functions already normalize aliases and match known area definitions. That makes place-name onboarding feasible as a local resolver for supported communities before introducing external search-provider dependencies.

The main risk is ambiguity:

- Some place names exist in multiple states or counties.
- Some community names may be colloquial or neighborhood-level.
- Some inputs may be outside current operational coverage.
- A place-name field can imply a general search capability if the app cannot resolve it locally.

Therefore, place name should be supported, but it should be framed as “ZIP or town” and resolved through known supported areas first.

### 6. Automatic awareness-area configuration

The current architecture already supports internal awareness-area resolution, county mapping, selected home-town persistence, active-county context, and map fitting. The first-run problem is not architectural capability; it is the amount of user-facing decision-making. The future onboarding should convert one consumer input into existing internal state:

- Consumer input: ZIP code or town/place.
- Internal output: county ID, awareness area, map anchor, startup zoom, and home-area preference.

The user should see “We’ll watch Dayton and nearby roads” rather than “County: Liberty County. Awareness: Dayton.”

### 7. County determination

County determination should be automatic and invisible. County remains important internally for package ownership, boundaries, runtime activation, report filtering, and map context. But county should only appear to the user if:

- The input is ambiguous.
- The user is outside supported coverage.
- The user later opens Settings and wants to adjust coverage.

County choice should not be the first-run primary decision.

### 8. Initial map state

The current runtime has a default Dayton anchor when no user location or home-town awareness anchor exists. This is a good fail-safe but not an ideal first-run experience for users outside the default area. The simplified onboarding should resolve an initial map state from the entered ZIP/place before the user sees the home screen. If resolution fails, the app should use the current safe default and clearly say coverage can be changed in Settings.

### 9. Home location setup

The current welcome flow asks for Home and Work during onboarding. That is too early. Home and Work support route intelligence, but Gridly is awareness-first. First run should not require route setup. The recommended path is:

- First run: set “home area” from ZIP/place.
- After the home screen is usable: offer “Add home/work later for route-aware tips.”
- Settings: keep saved places and route configuration as optional enhancements.

### 10. Empty states

The quiet state must feel valuable, not empty. First-run success should land on an Awareness Brief that explains:

- What Gridly is watching.
- Whether there are active reports nearby.
- When information was last checked.
- What the user can do next, such as report a road issue or add a route.

Avoid copy such as “No data” as the first reward. Prefer: “No active community reports near Dayton right now.”

### 11. Completion experience

The current final step says the user is part of the network and lists setup coverage, including routes. This overstates setup when Home/Work may not be configured. The new completion should be immediate and honest:

- “You’re ready.”
- “Watching Dayton and nearby roads.”
- “You can add a route later.”
- Primary action: “Go to Home.”

### 12. Permission timing

The current startup location-readiness path is correctly conservative: startup geolocation is deferred rather than automatically prompting. That direction should be preserved. Location permission should be optional and should be requested only after Gridly has explained the value and the user has a clear non-permission path.

### 13. Location permission wording

Existing permission wording is functional but not consumer-optimized. It should explain benefit, privacy expectation, and fallback:

- “Use my location to show what’s nearby.”
- “Gridly uses this only to center nearby awareness and route context.”
- “Not now” remains a complete path.

Avoid implying that location is required.

### 14. First-use guidance

Current first-run screens teach too many concepts. First-use guidance should be embedded in the home screen after setup:

- A small first-use card under the Awareness Brief.
- One primary next action: “Report something you see.”
- One secondary enhancement: “Add a route.”
- Dismissible, persistent, and not modal.

### 15. Settings implications

Settings should become the place for advanced configuration:

- Change watched area.
- Add home/work route places.
- Change theme/text size/name.
- Replay onboarding.
- Manage location permission education.

Settings can retain internal coverage selectors, but consumer labels should say “Watched Area” or “Where Gridly watches,” not “Awareness Area,” during first run.

### 16. PWA onboarding implications

PWA install prompts should not appear before the user receives value. The recommended sequence is:

1. First launch.
2. Enter ZIP/place.
3. Ready to Go.
4. Home screen value received.
5. Later, after engagement or return visit, suggest installation.

Install education should be a post-value enhancement, not a first-run decision.

## Decision audit

| Current decision | Required for first value? | Keep in first run? | V858 recommendation |
|---|---:|---:|---|
| Read welcome promise | Yes | Yes | Keep as one short screen. |
| Choose theme | No | No | Move to Settings. |
| Choose text size | No, unless accessibility requested | No | Use existing default; keep Settings access. |
| Enter preferred name | No | No | Move to Settings. |
| Read community-purpose screen | Partially | No | Fold into welcome copy. |
| Choose county | No | No | Infer from ZIP/place. |
| Choose home area | Yes, but not by this term | Yes, simplified | Ask for ZIP or town/place. |
| Set Home | No | No | Offer later. |
| Set Work | No | No | Offer later. |
| Read community-reporting screen | No | No | Teach after home screen. |
| Enable location permission | No | Optional | Ask only after area is configured or from Home. |
| Finish setup | Yes | Yes | Replace with “Go to Home.” |
| PWA install | No | No | Defer until after value. |

## Audit conclusion

Gridly already has the right mission and enough internal infrastructure to support a dramatically simpler first run. The current experience asks users to make product, geography, route, and personalization decisions before they understand the value. V858 should reduce first run to one required decision: **Where should Gridly watch first?**

---

# V858.2 — Simplified Onboarding Specification

## Target flow

```text
Welcome
  ↓
Location Entry: ZIP code or place name
  ↓
Automatic watched-area configuration
  ↓
Optional location permission
  ↓
Ready to Go
  ↓
Home screen / Awareness Brief
```

## Consumer-language model

| Internal term | First-run consumer language |
|---|---|
| Awareness Area | Watched area / where Gridly watches |
| County runtime | Local coverage |
| Community package | Local reports and road information |
| Route Watch | Route-aware tips / your regular drive |
| Unified Intelligence | Added context / official and community context |
| Active county | Local area |
| Startup configuration | Getting Gridly ready |

## Recommended screens

### Screen 1 — Welcome

Purpose: communicate value and ask one next action.

Recommended copy:

- Headline: **Know what’s happening before you go.**
- Body: **Gridly watches local road hazards, blocked crossings, and community reports near the places you care about.**
- Primary action: **Set my area**
- Secondary action: **Explore first**

Rules:

- No progress dots longer than three steps.
- No county terminology.
- No route setup.
- No theme/name/text-size setup.
- Mobile portrait first.

### Screen 2 — Location Entry

Purpose: collect the minimum geography needed to configure value.

Recommended input:

- Label: **Where should Gridly watch first?**
- Placeholder: **ZIP code or town name**
- Helper: **Enter a ZIP code or nearby town. You can change this later.**
- Primary action: **Continue**
- Secondary action: **Use default area**

Validation states:

1. Exact ZIP match.
2. Exact supported place match.
3. Alias match.
4. Ambiguous match requiring a short picker.
5. Unsupported area with fallback.

### Screen 3 — Automatic configuration confirmation

Purpose: show that Gridly configured itself.

Recommended copy for successful resolution:

- Headline: **Ready for Dayton.**
- Body: **Gridly will watch nearby roads, crossings, and community reports around Dayton.**
- Fine print: **Coverage can be changed in Settings.**
- Primary action: **Continue**

If the resolved area is county-wide:

- Headline: **Ready for Liberty County.**
- Body: **Gridly will start with county-wide awareness and nearby community reports.**

If ambiguous:

- Headline: **Which area do you mean?**
- Options: consumer place labels with state/county only as clarifying metadata.
- Primary action after selection: **Use this area**

If unsupported:

- Headline: **Gridly isn’t fully set up there yet.**
- Body: **You can still explore current supported coverage.**
- Primary action: **Use current coverage**
- Secondary action: **Try another ZIP or town**

### Screen 4 — Optional location permission

Purpose: offer a value-enhancing permission after setup.

Recommended copy:

- Headline: **Show what’s near you?**
- Body: **Allow location to center nearby reports and road conditions when you open Gridly.**
- Privacy support: **You can still use Gridly without this, and you can change it later.**
- Primary action: **Use my location**
- Secondary action: **Not now**

Rules:

- Do not request browser permission on screen load.
- Request only after tapping “Use my location.”
- Do not block completion if denied.
- If permission is unavailable or denied, continue to Ready to Go using the configured watched area.

### Screen 5 — Ready to Go

Purpose: confirm value and transition to Home.

Recommended copy:

- Headline: **You’re ready to go.**
- Body: **Gridly is watching Dayton and nearby roads.**
- Optional enhancement line: **Add home and work later for route-aware tips.**
- Primary action: **Go to Home**

Success requirements:

- The user should reach this state after one required input.
- The configured watched area must be persisted through existing preference paths.
- The home screen should open with the Awareness Brief as the first meaningful read.

## ZIP Code-first evaluation

### Strengths

- Very low typing effort on mobile.
- Familiar to users.
- Easier to validate locally with a deterministic table.
- Usually maps cleanly to a community/county.
- Less ambiguity than free-form place names.
- Does not require search-provider changes.

### Weaknesses

- ZIP boundaries do not always match community boundaries.
- Some ZIPs span multiple jurisdictions.
- Users may know a town better than a ZIP.
- ZIP-only onboarding can feel impersonal or bureaucratic.

### Best use

ZIP should be the fastest supported input and the safest MVP foundation.

## Place Name-first evaluation

### Strengths

- Matches how people think and speak.
- Avoids making county the consumer-facing concept.
- Supports “Dayton,” “Conroe,” “Cleveland,” and future community expansion naturally.
- Better long-term consumer experience.

### Weaknesses

- Ambiguity is higher.
- Requires alias design and disambiguation UI.
- Can imply broad search support if not framed carefully.
- External place search should not be introduced during the protected milestone.

### Best use

Place name should be supported in the same input field, resolved first against internal supported-area aliases.

## Recommended long-term approach

Use a **single “ZIP code or town name” input** with ZIP handling as the most deterministic path and place-name support as the consumer-friendly path.

Rationale:

- It asks one question.
- It minimizes setup time.
- It keeps county and awareness-area architecture internal.
- It works with local resolver data first.
- It leaves room for future official geocoding/search-provider enhancement without requiring it now.
- It best preserves “Awareness Platform First, Route Intelligence Second.”

## Internal resolver contract

The implementation should add a thin onboarding resolver that returns a configuration object, without changing protected systems:

```js
{
  status: "matched" | "ambiguous" | "unsupported" | "invalid",
  inputType: "zip" | "place" | "alias" | "default",
  consumerLabel: "Dayton",
  supportingLabel: "Liberty County, TX",
  countyId: "liberty-tx",
  awarenessAreaStorageValue: "Dayton",
  awarenessAreaKey: "dayton",
  mapAnchor: { lat: 30.0466, lng: -94.8852 },
  startupZoom: 12,
  fallback: false,
  options: []
}
```

The resolver may read existing awareness definitions and a small ZIP/place mapping table. It must not call runtime providers, mutate reports, change routing, or alter protected rendering architecture.

---

# V858.3 — Permission Strategy

## Permission principle

Location permission is an enhancement, not a gate.

Gridly can provide first value from a ZIP/place-derived watched area. Browser location should only be requested when the user understands why it helps.

## When location should be requested

Request location only after one of these user actions:

1. The user taps **Use my location** during optional onboarding.
2. The user taps a current-location control on the map.
3. The user starts a feature that clearly needs current position, such as route origin from current location.
4. The user opens Settings and explicitly enables location support.

Do not request location:

- On app startup.
- On welcome screen load.
- Before ZIP/place configuration.
- As a prerequisite to viewing the Awareness Brief.
- As part of PWA install education.

## Why location should be requested

Consumer benefit:

- Center nearby reports.
- Highlight road issues around the user.
- Improve route-aware tips if the user later adds route context.

Internal benefit:

- Establish a current-location map anchor.
- Improve nearest-context display.
- Support optional route-origin refreshes.

## Recommended wording

### Onboarding prompt screen

**Show what’s near you?**

Allow location to center nearby reports and road conditions when you open Gridly. You can still use Gridly without this, and you can change it later.

Buttons:

- **Use my location**
- **Not now**

### Browser permission rationale before native prompt

**Gridly uses your location to show nearby road reports.**

We’ll keep watching your selected area if you choose not to allow it.

Buttons:

- **Continue**
- **Not now**

### Denied state

**Location is off.**

Gridly will keep watching Dayton and nearby roads. You can turn location on later from your browser or device settings.

### Unavailable state

**Location isn’t available here.**

Gridly will use your selected area instead.

## Fallback behavior when denied

If denied:

1. Do not show an error-style failure.
2. Persist the ZIP/place-derived watched area.
3. Continue to Ready to Go.
4. Use selected watched-area map anchor.
5. Keep current-location controls available but non-blocking.
6. In Settings, show a calm status: “Location off — using watched area.”

## Permission audit conclusion

The existing startup location-readiness posture is directionally correct because it defers automatic prompting. V858 should preserve that posture and make the optional permission request consumer-facing, gesture-driven, and clearly non-required.

---

# V858.4 — User Journey

## Install or first open

1. User opens Gridly from web, shared link, or installed PWA.
2. Gridly performs existing startup work without changing protected runtime systems.
3. First-run state is detected from the existing welcome-seen preference or a future onboarding-version key.
4. If first run is needed, the simplified onboarding overlay opens.

## Welcome

1. User sees the Gridly promise: “Know what’s happening before you go.”
2. User taps **Set my area**.
3. User can tap **Explore first**, which uses the current default area and lands on Home with a small reminder to set an area.

## ZIP/place entry

1. User enters `77535`, `Dayton`, `Conroe`, or another supported place.
2. On Continue, Gridly resolves input locally.
3. If exact: continue automatically.
4. If ambiguous: user chooses from short options.
5. If unsupported: user can try again or use current supported coverage.

## Automatic configuration

1. Gridly saves the resolved watched area through existing preference paths.
2. Gridly resolves county internally.
3. Gridly prepares the existing map/awareness anchor from the selected area.
4. User sees a short confirmation using consumer labels.

## Optional location permission

1. User sees why location helps.
2. If user taps **Use my location**, native browser permission is requested.
3. If granted, Gridly uses current location for nearby awareness where existing systems support it.
4. If denied/unavailable/skipped, Gridly continues with watched-area fallback.

## Ready to Go

1. User sees “You’re ready to go.”
2. User taps **Go to Home**.
3. Onboarding is marked complete.
4. Home screen opens.

## First Home screen

1. Awareness Brief is the first meaningful read.
2. Copy reflects the configured watched area.
3. Quiet state is affirmative, not empty.
4. First-use guidance appears as a small non-modal card.
5. Route setup, reporting, settings, and PWA install remain available but not forced.

## Return visit

1. App opens directly to Home.
2. Watched area persists.
3. Optional setup prompts do not reappear unless user chooses Replay Setup or a versioned migration requires a one-time update.

---

# V858.5 — Implementation Plan

## Phase 0 — Certification of this specification

- Review this V858 document against protected-system constraints.
- Confirm the approved copy set.
- Confirm whether “ZIP code or town name” is accepted as the first-run input.
- Confirm supported initial ZIP/place mapping scope.
- Confirm that location permission remains optional and gesture-driven.

Exit criteria:

- Product owner approves the simplified flow.
- No code changes required for certification.

## Phase 1 — Resolver design without runtime activation

Create a small, testable onboarding resolver module or isolated function that maps ZIP/place input to existing awareness-area preferences.

Allowed:

- Static ZIP/place mapping for currently supported coverage.
- Alias table for known towns and supported local names.
- Unit tests for exact, alias, ambiguous, unsupported, and default cases.

Not allowed:

- Search-provider changes.
- Runtime provider calls.
- Routing changes.
- Supabase reads/writes.
- Report lifecycle changes.
- Alert generation changes.

Exit criteria:

- Resolver returns implementation-ready config object.
- Tests prove county ID and awareness-area values are inferred correctly.

## Phase 2 — Simplified onboarding UI behind a non-runtime flag

Build the new overlay as a presentation/setup layer only.

Allowed:

- Replace the visible first-run sequence behind a guarded onboarding version.
- Use existing preference writers for home area/watched area.
- Use existing welcome-seen/versioned storage.
- Keep Settings replay.

Not allowed:

- Modifying render architecture.
- Modifying protected runtime systems.
- Changing map marker rendering or incident rendering.

Exit criteria:

- New flow has no more than one required input.
- Mobile portrait layout passes visual review.
- Skip/default path lands safely on Home.

## Phase 3 — Permission prompt integration

Add optional location prompt screen using existing geolocation request helpers or a thin wrapper that records the request source.

Allowed:

- User-gesture-only location request.
- Calm denied/unavailable copy.
- Existing fallback to watched area.

Not allowed:

- Startup auto-prompt.
- Blocking Home on location failure.
- Background location.

Exit criteria:

- Denied permission still completes onboarding.
- Granted permission updates only existing location-aware context.
- Startup audit confirms no automatic geolocation prompt.

## Phase 4 — Home handoff and first-use guidance

Add a post-onboarding first-use card on Home.

Allowed:

- Dismissible guidance copy.
- One reporting action and one route-enhancement action.
- Settings link for changing watched area.

Not allowed:

- New runtime ownership.
- Changes to reporting lifecycle.
- Changes to Route Watch behavior.

Exit criteria:

- Awareness Brief remains first visual priority.
- First-use card does not compete with the brief.
- Quiet-state copy is consumer-friendly.

## Phase 5 — Legacy cleanup after certification

After the new flow is certified:

- Retire or suppress the legacy beta welcome modal path.
- Migrate old welcome-seen keys carefully.
- Keep a versioned onboarding key for future migrations.
- Keep Settings replay available.

Exit criteria:

- Only one first-run entry point remains.
- Existing users are not forced through setup unnecessarily.
- New users receive the simplified flow.

## Non-runtime test plan for implementation phases

Future implementation should include tests for:

- First-run overlay appears only when onboarding is incomplete.
- Welcome screen has one primary action.
- ZIP exact match resolves to expected watched area.
- Place exact match resolves to expected watched area.
- Ambiguous input shows disambiguation.
- Unsupported input offers supported fallback.
- County is inferred internally and not required as a first-run choice.
- Location permission is not requested until user gesture.
- Denied permission continues to Ready to Go.
- Settings can replay setup.
- Home screen receives selected watched-area label.

---

# Recommended final V858 design decision

Approve a **single-input, ZIP-or-town onboarding flow**.

The strongest long-term approach is not ZIP-only and not place-only. It is one consumer-friendly field that accepts both:

> **Where should Gridly watch first?**  
> **ZIP code or town name**

This minimizes decisions, preserves internal county/awareness architecture, avoids protected runtime changes, supports mobile portrait, and directly serves the mission: **Know Before You Go**.

# Quick Summary

- Current first run is mission-aligned but too long.
- The seven-step overlay should be reduced to one required input.
- County and awareness-area concepts should become internal implementation details.
- ZIP code should be the deterministic MVP path.
- Place name should be supported through local aliases and known supported areas.
- Location permission should be optional, gesture-driven, and never required.
- Home/Work route setup should move out of first run.
- PWA install prompts should wait until after the user receives value.

# Merge Recommendation

**Merge recommended as a documentation/design milestone.**

This document changes no runtime behavior and provides an implementation-ready specification for a future certified onboarding implementation. Future code work should proceed only after the V858 flow, copy, resolver scope, and permission strategy are reviewed and locked.

# Exact Review Steps

1. Read **V858.1** and confirm the audit accurately reflects current onboarding friction.
2. Read **V858.2** and approve or revise the single “ZIP code or town name” input.
3. Confirm whether first-run consumer language should use **Watched Area** instead of **Awareness Area**.
4. Review **V858.3** and confirm location permission remains optional and gesture-driven.
5. Walk through **V858.4** as a mobile portrait user from first open to Home.
6. Review **V858.5** and confirm each phase avoids protected runtime systems.
7. Certify the final copy set before any production code is written.
