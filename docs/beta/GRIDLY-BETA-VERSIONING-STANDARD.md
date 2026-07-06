# Gridly Beta Versioning Standard

## Purpose

This document defines the naming and numbering standards used to distribute, document, certify, and retire Gridly beta releases.

## Version Naming

Use two labels for each beta package:

- **Milestone version:** internal release identity, such as `V901`.
- **Distribution version:** beta URL/cache label, such as `beta-clean-4`.

Tester-facing communication should include both when helpful.

## Branch Naming

Branch names should include the milestone and purpose:

- `V901-Beta-Infrastructure-Distribution`
- `V900-Beta-Rollout-Control`

Use hyphenated title-style names that are easy to read in release history.

## Beta URL Strategy

Current beta URL:

<https://dbmaps.github.io/liberty-county-map/?v=beta-clean-4>

Guidance:

- Keep the URL stable during a tester cohort unless a new build is intentionally released.
- Use the query version to identify the distributed beta build.
- Do not reuse a retired query version for a materially different release.
- Include the exact URL in tester invites, landing-page copy, and release notes.

## Release Numbering

- Use `V###` milestone numbering for release packages.
- Increment the milestone for each certified package.
- Use suffixes only for narrowly scoped revisions when needed, such as `V901R1`.

## Documentation Numbering

Documentation should reference the milestone it supports when milestone-specific. General beta documents may use stable names and include milestone context inside the document.

## Audit Numbering

Audit documents should include the milestone and purpose in the filename:

- `GRIDLY-V901-BETA-INFRASTRUCTURE-CERTIFICATION.md`

## Certification Numbering

Certification documents should use the same milestone number as the package being certified. A certification should state what it certifies and what it does not certify.

## Recommended Release Cadence

Recommended cadence for controlled beta:

- Bundle tester-facing documentation and support updates into milestone packages.
- Avoid frequent beta URL churn during active testing windows.
- Use minor or patch updates only when they reduce confusion or unblock validation.
- Retire old builds after testers have migrated to the current beta URL.

## How Testers Identify Versions

Testers should identify their beta version by:

1. The exact beta URL they opened.
2. The release note or invite version.
3. The date and time they accessed the beta.
4. Device and browser details when reporting issues.

## How to Retire Old Beta Builds

1. Confirm the replacement beta URL and version label.
2. Update invite copy, support documentation, and release notes.
3. Tell testers to remove old home-screen shortcuts if needed.
4. Stop sharing the old URL.
5. Keep a record of the retired version in release notes or certification history.
6. Monitor feedback for testers who are still using the retired version.
