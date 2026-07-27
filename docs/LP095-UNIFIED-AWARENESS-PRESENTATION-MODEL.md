# LP095 — Unified Awareness Presentation Model

## Executive summary

LP095 establishes one cognitive rhythm for Gridly awareness: **what happened, where, what the driver should know, why the information is trustworthy, and how recent it is**. The review was deliberately presentation-only. It found that the broad awareness surfaces already use strong consumer-first hierarchy; the smallest useful correction was to align official, community-hazard, and crossing popups, where guidance, trust, and freshness were not always presented in the same order.

## Product principle

Gridly is an awareness platform first and route intelligence second. Awareness surfaces should feel related without becoming visually identical. Consumer understanding takes priority over strict templating: use the five questions when the available evidence supports them, omit unsupported detail, and never manufacture content to fill a slot.

## The five-question awareness model

1. **What happened?** Lead with the primary condition, never a provider or internal identifier.
2. **Where?** Keep the strongest consumer location directly beside the condition.
3. **What should I know?** Give calm, actionable travel guidance in consumer language.
4. **Why should I trust this?** Name evidence plainly, such as `Official Source · DriveTexas`, `Community reports`, or `Community confirmed`.
5. **How recent is it?** Conclude with freshness so time context completes rather than interrupts the story.

## Surfaces reviewed

| Surface | Review result |
| --- | --- |
| Official hazard popup | Changed: guidance now precedes trust; freshness remains last. |
| Community hazard popup | Changed: added concise guidance and separated trust from concluding freshness. |
| Crossing popup | Changed: added state-aware guidance and separated trust from concluding freshness. |
| Alerts sheet | Intentionally unchanged; current cards already lead with condition and location, with evidence secondary. |
| Destination Intelligence | Intentionally unchanged; destination/route impact presentation already leads with the travel takeaway and destination context. |
| Historical Intelligence | Intentionally unchanged; the inactive presentation already leads with its subject and useful takeaway and clearly labels historical context. |
| Route Watch | Intentionally unchanged; current status, route ownership, guidance, and freshness are already consumer-oriented. |
| Travel Brief | Intentionally unchanged; its current condition-first briefing rhythm is stronger than forcing popup markup onto the brief. |
| Community Pulse | Intentionally unchanged; no Pulse logic or presentation-model churn was justified. |

## Surfaces changed

Only popup presentation markup and popup consumer copy changed. No selection, generation, lifecycle, provider, reporting, routing, or historical code path changed.

### Official hazard popup

The existing official popup contained all five answers, but placed provider trust before the driver's guidance. Guidance now appears before `Official Source · DriveTexas`; freshness still concludes the popup.

### Community hazard popup

The previous source line combined provenance and freshness (`Community report · Driver shared · Updated …`) before the trust line. The popup now presents a short travel takeaway, calm `Community reports` evidence, the existing trust statement, and a dedicated final freshness line.

### Crossing popup

The crossing popup now uses state-aware guidance: active crossings advise expecting a delay and using caution; recently cleared crossings advise normal travel while staying alert; crossings without a report invite checking current alerts. Evidence and freshness are separate, with freshness last.

## Before/after examples

### Official hazard

**Before**

1. Flooding reported
2. On SH 99
3. Roadway impact description
4. Official Source · DriveTexas
5. Expect slower travel and use caution
6. Updated 9 minutes ago

**After**

1. Flooding reported
2. On SH 99
3. Roadway impact description and driver guidance
4. Official Source · DriveTexas
5. Updated 9 minutes ago

This removes the trust-label interruption before the driver's takeaway while preserving attribution and freshness.

### Community hazard

**Before**

1. Crash reported
2. Near FM 1960
3. Community report · Driver shared · Updated 3 minutes ago
4. Community report

**After**

1. Crash reported
2. Near FM 1960
3. Expect slower travel and use caution.
4. Community reports / existing community trust statement
5. Updated 3 minutes ago

This makes the travel implication explicit and lets freshness conclude the story.

### Crossing

**Before**

1. Train blocking crossing
2. Alabama Street Crossing
3. Community report · Driver shared · Reported 3 minutes ago
4. Community confirmed

**After**

1. Train blocking crossing
2. Alabama Street Crossing
3. Expect a delay and use caution.
4. Community reports / Community confirmed
5. Reported 3 minutes ago

This gives drivers the takeaway before evidence and prevents freshness from interrupting trust context.

## Why each presentation change improves understanding

- **Guidance follows location:** drivers learn the condition and its place before deciding what it means for travel.
- **Trust remains calm:** source language explains evidence without scores, reputation, badges, or database terms.
- **Freshness concludes:** the final line qualifies everything above it without splitting the story.
- **Source families converge:** official and community popups now follow the same mental sequence while retaining their distinct evidence labels.

## Consistency review

The changed popup variants follow condition → location → guidance → trust → freshness. Existing destination, history, Route Watch, Travel Brief, Alerts, and Community Pulse presentations were not rewritten because they already communicate their purpose clearly or because forcing popup structure would reduce clarity. No new visual system, container, navigation pattern, or brand treatment was introduced.

## Protected systems confirmation

LP095 does not modify Community Pulse logic, Travel Brief logic, reporting, Route Watch logic, Destination Intelligence logic, Historical Intelligence logic or implementation, learning orchestration, knowledge retrieval, narrative generation or ranking, unified evidence, alert generation, awareness filtering, hazard lifecycle, Supabase synchronization, official provider integrations, county selection, ZIP mapping, service workers, or PWA behavior. The passive audit is read-only and reports presentation certification only.

## Historical Intelligence confirmation

Historical Intelligence remains inactive. Its implementation, activation boundary, activation state, retrieval, narrative, ranking, and presentation-governance modules were not modified. The existing historical sheet was reviewed as a presentation surface only and intentionally left unchanged.

## LP095.1 — Official popup spacing refinement

Mobile browser review found that the official DriveTexas popup had excess vertical separation between its location, guidance, source attribution, and freshness. LP095.1 removes the shared flex gap for the official popup only, then applies deliberate spacing of 2px above the description, 3px above the optional guidance label, 1px above guidance text, 4px above `Official Source · DriveTexas`, and 1px above freshness. This keeps the lower section readable while making it feel like one continuous awareness story.

Wording, presentation order, width, typography, marker and popup behavior, provider data, and provider integration are unchanged. Community and crossing popup styles are also unchanged. The refined popup was reviewed at 390 × 844, 360 × 800, and 320 × 700 with no clipping, overlap, obstructed close control, or awkward wrapping. Browser certification via `window.gridlyLp095UnifiedPresentationAudit?.()` passed, including the LP095.1 read-only `officialPopupSpacingRefined: true` result; protected systems remained unchanged and Historical Intelligence remained inactive.

## Future guidance for new awareness surfaces

1. Draft the five answers in plain text before designing layout.
2. Lead with a condition a driver can understand without knowing the provider.
3. Use the strongest available human-readable location; never invent specificity.
4. State a useful driver takeaway only when supported by the condition.
5. Describe evidence with a calm source phrase rather than a score or badge.
6. Put freshness last and distinguish `Reported`, `Updated`, `Observed`, and `Current conditions` accurately.
7. Treat the sequence as a comprehension guide, not a mandatory visual template.
8. If an existing presentation is clearer, preserve it and document why.
