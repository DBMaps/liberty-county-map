# Gridly Beta What's New Strategy

## Purpose

This document standardizes release communication for Gridly beta testers. Each release note should help a consumer understand what changed, what remains limited, and what to try next.

## Version Numbering Guidance

Use a clear milestone number for internal tracking and a simple beta label for tester communication.

- Internal milestone example: `V901`
- Public beta URL label example: `beta-clean-4`
- Release note heading example: `Gridly Beta Update — V901`

## Release Naming

Release names should be short and outcome-focused:

- `Beta Infrastructure & Distribution`
- `Beta Presentation Refinement`
- `Beta Rollout Control`

Avoid technical-only names that do not help testers understand the release.

## Major vs Minor Updates

### Major Beta Update

Use for releases that materially change tester experience, onboarding, installation, communication, or core beta readiness.

### Minor Beta Update

Use for focused clarifications, documentation additions, small copy updates, or non-runtime support improvements.

### Patch Update

Use for narrow fixes with limited tester-facing impact.

## Suggested What's New Format

```markdown
# What's New in Gridly Beta [Version]

## Highlights
- One to three plain-language improvements.

## What Changed
- Clear consumer-facing changes.

## Known Issues
- Current limitations testers should understand.

## Resolved Issues
- Problems fixed since the previous beta note.

## Coming Soon
- Near-term improvements without overpromising.

## How to Send Feedback
- Simple feedback instructions.
```

## Known Issues Section

Known issues should be honest, specific, and calm. Each item should explain the tester impact and any available workaround.

## Resolved Issues Section

Resolved issues should describe the user-visible problem that improved. Avoid implementation details unless they are necessary for tester confidence.

## Coming Soon Section

Coming soon should describe direction, not guarantees. Use phrases such as:

- `Planned next`
- `Being evaluated`
- `Expected in a future beta`

Avoid dates unless the release owner has approved them.

## Writing Standards

- Use plain consumer language.
- Keep sentences short.
- Explain why the change matters.
- Avoid internal acronyms unless defined.
- Avoid promising safety outcomes.
- Avoid implying official-source authority.
- Keep the mission visible: **Know Before You Go**.

## Consumer Language

Prefer:

- `Easier to install`
- `Clearer beta instructions`
- `More helpful support guidance`
- `Known limitations are easier to find`

Avoid:

- `Refactored`
- `Patched lifecycle`
- `Runtime mutation`
- `Provider synchronization`

## Length Recommendations

- Highlights: 3 bullets or fewer
- What Changed: 3 to 6 bullets
- Known Issues: 3 to 6 bullets
- Resolved Issues: 3 to 6 bullets
- Coming Soon: 1 to 3 bullets
- Total length: ideally under one mobile screen plus one short scroll
