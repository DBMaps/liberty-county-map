# GRIDLY V883R — Briefing Duplicate Condition Suppression

## Problem
Know Before You Go could render the same active road-closure condition as two Today bullets when one alert had a strong corridor/location phrase and another had a weaker partial phrase.

Sample before:
- Road Closed on US 90 2 miles west of Dayton
- Road Closed on 2 miles west of Dayton
- Traffic Backup on TX 321 5 miles west of Kenefick

## Scope
This is presentation-only narrative cleanup at the final briefing-line assembly layer. It does not change source alert, report, hazard, lifecycle, count, or map data.

## What changed
- Added conservative duplicate/near-duplicate suppression for Know Before You Go briefing condition lines.
- The suppression key considers condition family, canonical corridor when present, normalized location phrase, and awareness area.
- When two briefing lines describe the same condition/location, the stronger user-facing line is preferred.

Sample after:
- Road Closed on US 90 2 miles west of Dayton
- Traffic Backup on TX 321 5 miles west of Kenefick

## What did not change
- Alerts can still list multiple active alerts.
- Active alert counts remain unchanged.
- Community report counts remain unchanged.
- Community Pulse ownership and broad language remain unchanged.
- Location Context ownership remains unchanged.
- Map markers remain unchanged.
- Supabase writes remain unchanged.
- Hazard lifecycle and alert generation remain unchanged.
- Route Watch, Weather, Search, and Reporting remain unchanged.

## Protected systems
- Community Pulse ownership
- Alerts ownership
- Location Context ownership
- Map markers
- Active alert counts
- Community report counts
- Supabase writes
- Hazard lifecycle
- Alert generation
- Reporting
- Route Watch
- Weather
- Search

## Validation checklist
- [x] Duplicate road-closure Today lines collapse to the stronger road-name version.
- [x] Road closure and traffic backup remain separate.
- [x] Standalone “Also.” remains suppressed.
- [x] V883 travel guidance fallback remains available.
- [x] Browser audit helper added: `window.gridlyBriefingDuplicateSuppressionAudit?.()`.
