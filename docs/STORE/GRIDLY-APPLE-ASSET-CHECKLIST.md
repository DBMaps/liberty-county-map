# Gridly Apple Asset Checklist

## Objective

Prepare Apple App Store asset requirements for Gridly without creating binary assets in V277.2.

Gridly should be presented as an awareness platform first and route-intelligence tool second. Apple assets must not imply turn-by-turn navigation, emergency dispatch, government operation, or official incident verification.

## Required Apple Assets

| Asset | Requirement | Dimensions / Limits | V277.2 Status |
| --- | --- | --- | --- |
| App Icon | Final App Store icon upload. No transparency and no rounded corners baked into artwork. | 1024 × 1024 px. | Planned only. |
| iPhone Screenshots | Required for iPhone listing device classes selected in App Store Connect. | Common portrait classes include 1290 × 2796 px, 1179 × 2556 px, 1242 × 2688 px, 1284 × 2778 px, and 1242 × 2208 px depending on current App Store Connect requirements. Verify at upload time. | Workflow documented. |
| iPad Screenshots | Required only if iPad support is included. | Common portrait class includes 2048 × 2732 px for 12.9-inch iPad. Verify at upload time. | Conditional. |
| App Store Metadata | App name, subtitle, promotional text if used, description, support URL, marketing URL if used, copyright, category, age rating, and review notes. | Apple limits vary by field; confirm in App Store Connect before final entry. | Draft package created. |
| Privacy Policy URL | Public URL for Gridly privacy policy. | URL must be live and accessible before submission. | Draft content exists; production URL pending. |
| Terms URL | Public URL or support/legal placement for Gridly terms. | URL should be live and accessible before submission if used. | Draft content exists; production URL pending. |
| App Category | Primary category and optional secondary category. | Recommended candidates: Navigation or Travel; secondary candidates: Utilities or Lifestyle. | Needs final selection. |
| Keywords | Apple keyword field. | Apple keyword field is commonly 100 characters; final copy must be compressed and validated in App Store Connect. | Draft keyword pool exists. |

## iPhone Screenshot Set

Recommended final screenshot order:

1. Awareness Brief.
2. Train Blocking Crossing.
3. Road Hazard Alert.
4. Route Watch.
5. Community Reporting.
6. Community Pulse.
7. Destination Search.
8. Settings.

Each screenshot should use mobile portrait framing, readable captions, and realistic non-sensitive sample data.

## iPad Applicability Decision

Before final Apple packaging, confirm whether the native iOS build supports iPad distribution.

- If iPad support is enabled, produce iPad screenshots matching current App Store Connect requirements.
- If iPad support is not part of the launch target, document that iPad screenshots are not applicable.
- Do not create tablet screenshots solely for V277.2.

## Copy and Metadata Inputs

Use `docs/STORE/GRIDLY-METADATA-PACKAGE.md` as the package-level source for:

- App name.
- Tagline / subtitle candidate.
- Short description / promotional text candidate.
- Long description.
- Keywords.
- Categories.
- Marketing summary.

## Acceptance Criteria

- [ ] 1024 × 1024 icon is produced in a future asset milestone and approved.
- [ ] Required iPhone screenshots are captured in a future asset milestone and approved.
- [ ] iPad support decision is documented.
- [ ] Apple metadata is entered and reviewed in App Store Connect.
- [ ] Privacy Policy URL is live.
- [ ] Terms URL or legal support placement is live.
- [ ] Category, keywords, age rating, and review notes are finalized.
- [ ] No Apple binary assets are created by V277.2.
