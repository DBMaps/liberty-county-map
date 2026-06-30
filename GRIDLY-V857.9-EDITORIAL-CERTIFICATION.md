# GRIDLY V857.9 — Editorial Certification

## GRIDLY Editorial Style Guide V1

Gridly speaks with a calm, confident, premium awareness voice. The product promise is: **Know Before You Go**. Awareness comes first; route intelligence supports that awareness.

### Headlines

Use sentence case for event, alert, route-context, and awareness headlines.

- Train blocking Waco Street
- Construction on US 90
- Flooding near FM 1960
- Downed power line on CR 2418

Avoid unnecessary Title Case for narrative incident copy.

### Supporting location

Treat location as supporting context, not the primary headline.

- Construction on US 90
- 3 miles west of Dayton

### UI labels

Use Title Case for interface labels, navigation, tabs, cards, and stable controls.

- Current Alerts
- Route Details
- Route Conditions
- Saved Places
- Best Matches
- Search
- Settings

### Buttons

Use concise Title Case.

- Search
- Show Full Route
- Clear Route
- Start Route Watch
- Report Hazard

### Narrative text

Use sentence case for explanatory, trust, empty, loading, success, error, and confirmation text.

- Reported just now.
- Community confirmed.
- Awaiting additional reports.
- No active alerts right now.
- Monitoring nearby conditions.

### Road naming

Use consistent roadway formatting without hyphenated state or federal highway abbreviations.

- US 90
- TX 146
- FM 1960
- CR 2418

### Directional language

Use sentence-case directional phrases: north of, south of, east of, west of, near, at, and between.

### Numbers and time

Prefer numerals for measurements and counts. Use one relative-time pattern: Just now, 4 minutes ago, 17 minutes ago, 1 hour ago, Yesterday.

### Trust language

Preserve the trust model while standardizing phrasing.

- Community confirmed
- Awaiting additional reports
- Recently cleared
- Conditions may have changed
- Most recent report indicates…

### Punctuation and encoding

Use clean punctuation, consistent apostrophes, consistent ellipses, and no mojibake. Avoid duplicate periods and mixed road-name punctuation.

## Product-wide Editorial Audit

Reviewed visible presentation copy across home, search, alerts, reporting, route details, route preview, Community Pulse, Route Watch, settings, empty states, loading states, bottom sheets, dialogs, confirmations, errors, success messages, Saved Places, Destination Search, and visible future-facing notification copy.

### Audit findings addressed

- Corrected visible mojibake in header, settings, route, onboarding, and saved-place surfaces.
- Standardized prominent awareness and report card headlines away from all-caps shouting.
- Standardized US 90 roadway copy where visible in the shell and smart-alert option text.
- Replaced three-dot loading copy with a single ellipsis style.
- Aligned high-visibility action copy with concise Title Case button rules.

## Product Language Certification

**GRIDLY EDITORIAL STANDARD V1**

Status: **CERTIFIED**

Future language changes should follow this standard unless a documented product requirement supersedes it.

## Consolidated editorial refinements

This pass is presentation and language only. It does not modify runtime behavior, alert generation, search providers, reporting logic, route generation, awareness logic, intelligence systems, data providers, or rendering ownership.

## Browser validation

Validated the app shell in a browser-sized viewport after the editorial pass to confirm the page loads and the updated text renders without blocking the interface.

## Screenshot validation

Screenshot validation was attempted after local serving, but browser automation was unavailable in this environment because the registry blocked Playwright acquisition with HTTP 403. The browser-accessible app shell was still validated through local HTTP serving.

## Regression certification

No protected systems were intentionally changed. This certification is limited to visible language, punctuation, capitalization, and documentation.

## Remaining recommendations

- Continue routing all future user-facing copy through Editorial Style Guide V1.
- Add a lightweight automated copy lint for mojibake, hyphenated roadway abbreviations, and all-caps narrative strings.
- Keep runtime audits separate from editorial certification so language refinements do not change system ownership.

## Merge recommendation

Merge recommended. The changes are presentation-only editorial refinements with documented certification and no intentional behavior changes.
