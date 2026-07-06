# GRIDLY BETA ISSUE TRIAGE GUIDE

## Status

V900

## Purpose

This guide defines beta issue priorities so Gridly can respond quickly to trust and core workflow problems while avoiding unnecessary churn.

## Priority Levels

### P0 Launch Blocker

Definition: an issue that makes controlled beta unsafe, misleading, inaccessible for normal use, or likely to damage trust.

Examples:

- Broken reporting submission.
- Incorrect location placement that could mislead users.
- Broken onboarding that blocks first use.
- Broken install flow across multiple expected devices.
- Wording that makes users believe Gridly is official emergency information.

### P1 Major Trust Or Core Workflow Issue

Definition: an issue that does not require immediate shutdown but materially affects trust, comprehension, installation, reporting, or core awareness.

Examples:

- Several testers cannot understand whether a report is current.
- A common browser has a repeated install or open issue.
- A report category appears confusing enough to cause bad submissions.
- A visible trust disclaimer is missing or unclear in a key flow.

### P2 Standard Beta Issue

Definition: a normal beta defect that should be fixed but does not block a controlled cohort.

Examples:

- A layout issue on one device that does not hide critical information.
- A confusing label that has a workaround.
- A performance concern that is noticeable but not blocking.

### P3 Improvement / Polish

Definition: a refinement that improves the experience but does not affect safety, trust, or core workflow.

Examples:

- Minor copy tightening.
- Visual spacing improvements.
- Optional onboarding wording improvements.

### P4 Future Roadmap

Definition: a useful idea that should not distract from beta stability.

Examples:

- New report types.
- Advanced notifications.
- Major regional intelligence ideas.
- Feature requests outside the current beta mission.

## Protected-System Caution

Protected systems should not be modified casually during beta. Reporting logic, alert generation, hazard lifecycle, awareness filtering, Route Watch, search, weather provider, community intelligence, installation runtime, onboarding completion persistence, crossing runtime, Supabase logic, and directional intelligence require explicit scope and careful audit before any change.

## Decision Rules

- Treat incorrect location placement, broken reporting, broken onboarding, and broken install flow seriously.
- Prioritize bugs that affect trust, safety language, reporting, installation, or location correctness.
- Cosmetic polish should not block controlled beta unless it damages trust.
- Suggestions are not automatically issues.
- Repeated confusion from multiple testers is a product signal.

## Escalation Rules

- Escalate P0 immediately and pause expansion.
- Escalate P1 during the next beta review or sooner if the pattern grows.
- Group P2/P3 items for planned beta polish.
- Move P4 items to future roadmap notes.

## Merge Guidance

- Merge documentation and process updates when static review passes.
- Merge runtime fixes only when the issue is clearly scoped, tested, and does not create protected-system side effects.
- Prefer the smallest safe change.
- Keep audit-first, patch-second discipline.

## When To Pause Beta Expansion

Pause expansion when:

- Any P0 is open.
- A P1 affects a large part of the current cohort.
- Feedback cannot be tracked reliably.
- Testers are misunderstanding Gridly as official emergency information.
- Protected systems require investigation.

## When To Continue Beta Expansion

Continue controlled expansion when:

- No P0 issues are open.
- P1 issues are resolved, accepted, or clearly bounded.
- Feedback is organized and response time is reasonable.
- Testers understand the mission and limitations.
- Liberty / Dayton confidence remains strong.
