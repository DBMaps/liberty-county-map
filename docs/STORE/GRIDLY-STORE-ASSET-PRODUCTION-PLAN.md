# Gridly Store Asset Production Plan

## Executive Summary

V277.2 prepares Gridly for production store asset creation without generating binary assets, screenshots, artwork, icons, PDFs, ZIPs, or app behavior changes.

The current foundation is ready for asset production planning:

- V275 PWA Foundation is complete.
- V276 Capacitor Foundation is complete.
- V277 App Store Readiness Audit is complete.
- V277.1 App Distribution Asset Package is complete.
- Legal drafts, store copy drafts, branding strategy, and screenshot planning already exist.

This plan turns those inputs into a production roadmap so future asset creation can happen predictably in V277.3 — Asset Creation & Capture. Gridly positioning remains: **Awareness Platform First, Route Intelligence Second**, with **Mobile Portrait Primary** asset capture.

## Asset Inventory

### Existing Planning Inputs

| Input | Source | Current Status | Production Use |
| --- | --- | --- | --- |
| Store description drafts | `docs/STORE/GRIDLY-APP-STORE-DESCRIPTION.md` | Drafted | Metadata source of truth for store copy. |
| Screenshot plan | `docs/STORE/GRIDLY-SCREENSHOT-PLAN.md` | Drafted | Scenario and ordering source for capture workflow. |
| App icon strategy | `docs/BRANDING/GRIDLY-APP-ICON-STRATEGY.md` | Drafted | Icon production direction and constraints. |
| Splash screen strategy | `docs/BRANDING/GRIDLY-SPLASH-SCREEN-STRATEGY.md` | Drafted | Native launch visual direction. |
| Privacy policy | `docs/LEGAL/GRIDLY-PRIVACY-POLICY.md` | Drafted | Store privacy policy URL content source. |
| Terms of use | `docs/LEGAL/GRIDLY-TERMS-OF-USE.md` | Drafted | Store terms URL content source. |
| Reporting disclaimer | `docs/LEGAL/GRIDLY-COMMUNITY-REPORTING-DISCLAIMER.md` | Drafted | Safety and community-reporting language source. |

### Placeholder Folder Inventory

The following folder structure is prepared for future production exports and contains only text placeholders where needed:

- `assets/store/apple/`
- `assets/store/google/`
- `assets/store/screenshots/`
- `assets/store/icons/`
- `assets/store/branding/`

No binary assets are created by V277.2.

## Required Assets

### Apple App Store

- 1024 × 1024 App Store app icon, produced later from an editable master source.
- iPhone screenshots for required device classes in App Store Connect.
- iPad screenshots only if the app is submitted with iPad support.
- App name, subtitle/tagline, promotional text if used, short and long description metadata.
- Keywords within Apple limits.
- Category and age-rating answers.
- Privacy Policy URL.
- Terms URL or support URL placement as appropriate.

### Google Play

- 512 × 512 high-resolution app icon.
- 1024 × 500 feature graphic.
- Phone screenshots.
- Tablet screenshots only if tablet distribution is intentionally supported.
- Short description.
- Full description.
- Data Safety form answers.
- Privacy Policy URL.
- Category, tags, contact details, and content-rating answers.

## Optional Assets

Optional assets should be produced only after required assets are accepted:

- Platform-specific device-frame screenshot variants.
- Localized screenshots and descriptions.
- Promotional graphics for launch announcements.
- Press-kit copy and brand boilerplate.
- Additional tablet captures if tablet support becomes a launch target.
- Alternative store screenshots for A/B testing after production launch.

## Production Workflow

1. **Confirm scope**
   - Keep V277.3 focused on asset creation and capture.
   - Do not introduce product behavior changes to improve screenshots.
   - Preserve current Awareness Platform First positioning.

2. **Lock copy inputs**
   - Review `GRIDLY-METADATA-PACKAGE.md`.
   - Confirm app name, tagline, categories, keywords, and descriptions.
   - Confirm final legal URLs before store submission.

3. **Prepare design source files outside V277.2**
   - Create editable master icon and branding source files in the design tool of record.
   - Export platform-specific icon files only in the asset creation milestone.
   - Verify the icon does not imply turn-by-turn navigation, official emergency support, or government operation.

4. **Prepare capture environment**
   - Use stable mobile portrait viewports.
   - Use realistic non-sensitive sample data.
   - Clear personal information, private addresses, phone numbers, license plates, and exact private locations.
   - Ensure status bars, safe areas, map attribution, and bottom UI are clean.

5. **Capture screenshot set**
   - Follow `GRIDLY-SCREENSHOT-CAPTURE-WORKFLOW.md`.
   - Capture Apple and Google variants separately if dimensions or device classes differ.
   - Do not overstate certainty, official verification, live emergency support, or routing guarantees.

6. **Review and package**
   - Compare every asset against Apple and Google checklists.
   - Confirm naming, dimensions, visual consistency, and final captions.
   - Store generated binary assets only in the planned folder structure during the future asset creation milestone.

7. **Submission dry run**
   - Upload assets into draft App Store Connect and Play Console listings.
   - Resolve validation errors before launch-track release work.
   - Record final accepted dimensions and file names for handoff.

## Acceptance Criteria

V277.2 is complete when:

- Store asset production plan exists.
- Apple asset checklist exists.
- Google Play asset checklist exists.
- Screenshot capture workflow exists.
- Asset folder structure documentation exists.
- Metadata package exists.
- TestFlight launch checklist exists.
- Google Closed Testing checklist exists.
- `window.gridlyStoreAssetProductionAudit?.()` is registered and returns V277.2 readiness information.
- Only documentation, folder placeholders, and lightweight audit-helper code are added.
- No PNG, JPG, JPEG, WEBP, ICO, PDF, ZIP, screenshots, artwork, icons, or other binary assets are generated.
- No app, PWA, Capacitor, Route Watch, reporting, awareness, Supabase, or routing behavior changes are introduced.

## Submission Readiness Checklist

- [ ] Apple icon source and final export are approved.
- [ ] Google icon and feature graphic exports are approved.
- [ ] Required Apple screenshots are captured, reviewed, and accepted.
- [ ] Required Google screenshots are captured, reviewed, and accepted.
- [ ] Metadata copy is approved for Apple and Google.
- [ ] Privacy Policy URL is live and reachable.
- [ ] Terms URL is live and reachable or otherwise represented in store metadata.
- [ ] Data Safety and privacy answers are reviewed against the actual app implementation.
- [ ] Apple category and keywords are finalized.
- [ ] Google category, tags, and contact details are finalized.
- [ ] TestFlight internal testing checklist is complete.
- [ ] Google closed testing checklist is complete.
- [ ] Store validation errors are resolved before production submission.
