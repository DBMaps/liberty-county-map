# Gridly Google Play Asset Checklist

## Objective

Prepare Google Play asset requirements for Gridly without creating binary assets in V277.2.

Google Play assets should communicate Gridly as a community-powered local awareness app. Do not imply turn-by-turn navigation, official emergency support, background tracking guarantees, or government verification.

## Required Google Play Assets

| Asset | Requirement | Dimensions / Limits | V277.2 Status |
| --- | --- | --- | --- |
| App Icon | High-resolution Play Store icon. | 512 × 512 px. PNG or JPEG in final production; no asset generated in V277.2. | Planned only. |
| Feature Graphic | Required store listing feature graphic. | 1024 × 500 px. PNG or JPEG in final production; no asset generated in V277.2. | Planned only. |
| Screenshots | Phone screenshots for store listing. | Minimum dimension commonly 320 px; maximum dimension commonly 3840 px; max aspect ratio commonly 2:1. Verify current Play Console requirements before upload. | Workflow documented. |
| Data Safety Form | Privacy and data handling disclosures in Play Console. | Must match actual app behavior, permissions, collection, sharing, and security practices. | Checklist only. |
| Privacy Policy URL | Public URL for Gridly privacy policy. | URL must be live and accessible before submission. | Draft content exists; production URL pending. |
| App Description | Short and full descriptions. | Short description commonly up to 80 characters; full description commonly up to 4,000 characters. Verify at entry time. | Draft package created. |

## Screenshot Set

Recommended final screenshot order:

1. Awareness Brief.
2. Train Blocking Crossing.
3. Road Hazard Alert.
4. Route Watch.
5. Community Reporting.
6. Community Pulse.
7. Destination Search.
8. Settings.

Use the same core scenarios as Apple while adapting dimensions, margins, and device framing for Google Play upload requirements.

## Data Safety Review Inputs

Before completing the Data Safety form, verify implementation details for:

- Location usage and whether location data is collected, processed, stored, or shared.
- Community reports and whether user-generated report data is collected.
- Diagnostics, analytics, crash data, or feedback data.
- Account requirements, if any.
- Data deletion and retention expectations.
- Security practices for data in transit.
- Third-party services and SDKs included in the build.

The Data Safety form must reflect actual production behavior, not marketing intent.

## Metadata Inputs

Use `docs/STORE/GRIDLY-METADATA-PACKAGE.md` for:

- App name.
- Short description.
- Full description.
- Category candidates.
- Keyword and tag concepts.
- Marketing summary.

## Acceptance Criteria

- [ ] 512 × 512 Play icon is produced in a future asset milestone and approved.
- [ ] 1024 × 500 feature graphic is produced in a future asset milestone and approved.
- [ ] Required phone screenshots are captured in a future asset milestone and approved.
- [ ] Tablet screenshot decision is documented if tablet distribution is pursued.
- [ ] Data Safety answers are reviewed against actual implementation.
- [ ] Privacy Policy URL is live.
- [ ] Short and full descriptions are finalized in Play Console.
- [ ] Category, tags, contact details, and content rating are finalized.
- [ ] No Google Play binary assets are created by V277.2.
