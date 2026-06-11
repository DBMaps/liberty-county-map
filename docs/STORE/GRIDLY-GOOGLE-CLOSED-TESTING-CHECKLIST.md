# Gridly Google Closed Testing Checklist

## Objective

Define the planning checklist for preparing Gridly for Google Play closed testing after asset production, without changing app behavior or generating binary assets in V277.2.

## Play Console Setup

- [ ] Confirm active Google Play Developer account.
- [ ] Confirm correct organization, payments profile, and account roles.
- [ ] Confirm app signing strategy and Play App Signing status.
- [ ] Confirm developer contact details.
- [ ] Confirm support email and website/legal URLs are ready for listing use.

## App Creation

- [ ] Create or verify the Gridly app in Play Console.
- [ ] Confirm default language.
- [ ] Confirm app or game selection.
- [ ] Confirm free or paid selection.
- [ ] Enter draft metadata from `GRIDLY-METADATA-PACKAGE.md`.
- [ ] Add Privacy Policy URL when live.
- [ ] Complete app access, ads, content rating, target audience, news app, and government app declarations based on actual implementation.

## Closed Testing Track

- [ ] Create or select the closed testing track.
- [ ] Define release name and release notes.
- [ ] Upload Android build artifact when the build is ready.
- [ ] Resolve signing, SDK, permission, and policy warnings.
- [ ] Confirm countries/regions if required for testing.
- [ ] Keep production rollout disabled until closed testing is complete.

## Tester Groups

- [ ] Create tester group for internal stakeholders.
- [ ] Create tester group for external closed testers if needed.
- [ ] Add tester email list or Google Group.
- [ ] Prepare tester instructions with safety expectations.
- [ ] Include feedback channels and known limitations.
- [ ] Avoid promising turn-by-turn navigation or official incident verification.

## Release Preparation

- [ ] Confirm final package name and version code strategy.
- [ ] Confirm permissions match actual app behavior.
- [ ] Complete Data Safety form based on implementation review.
- [ ] Complete content rating questionnaire.
- [ ] Upload final Google store assets only after V277.3 asset creation.
- [ ] Verify screenshots, icon, and feature graphic pass Play Console validation.
- [ ] Review crash, ANR, pre-launch report, and device compatibility results.

## Production Readiness

- [ ] Closed testing feedback has been triaged.
- [ ] Blocking defects are fixed or explicitly deferred.
- [ ] Store listing copy is final.
- [ ] Legal URLs are live.
- [ ] Data Safety answers are approved.
- [ ] Content rating and target audience selections are approved.
- [ ] Production release notes are drafted.
- [ ] Rollout plan and rollback criteria are documented.

## Acceptance Criteria

- [ ] Play Console setup path is documented.
- [ ] App creation path is documented.
- [ ] Closed testing track setup is documented.
- [ ] Tester group plan is documented.
- [ ] Release preparation checklist is documented.
- [ ] Production readiness checklist is documented.
- [ ] No binary assets are created by V277.2.
