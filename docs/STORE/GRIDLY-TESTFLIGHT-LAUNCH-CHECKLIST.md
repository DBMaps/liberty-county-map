# Gridly TestFlight Launch Checklist

## Objective

Define the planning checklist for preparing Gridly for TestFlight after asset production, without changing app behavior or generating binary assets in V277.2.

## Apple Developer Setup

- [ ] Confirm active Apple Developer Program membership.
- [ ] Confirm the correct team owns the Gridly app record.
- [ ] Confirm account roles for build upload, App Store Connect metadata, agreements, and TestFlight management.
- [ ] Confirm certificates, identifiers, and provisioning profiles are available or managed by Xcode automatic signing.
- [ ] Confirm compliance contacts and support contacts are current.

## App Store Connect Setup

- [ ] Create or verify the Gridly app record.
- [ ] Confirm SKU and primary language.
- [ ] Confirm app name availability and final display name.
- [ ] Enter draft metadata from `GRIDLY-METADATA-PACKAGE.md`.
- [ ] Add Privacy Policy URL when live.
- [ ] Add support URL and terms/legal URL placement when live.
- [ ] Confirm category, age rating, content rights, and export compliance answers.
- [ ] Upload final store assets only after V277.3 asset creation.

## Bundle ID Verification

- [ ] Confirm iOS bundle identifier matches the Capacitor configuration and Apple Developer identifier.
- [ ] Confirm app capabilities match actual implementation.
- [ ] Confirm no unexpected background modes, notification entitlements, or location modes are enabled.
- [ ] Confirm version and build number strategy.
- [ ] Confirm display name and bundle metadata are consistent with store copy.

## Build Upload

- [ ] Run production build checks.
- [ ] Archive the iOS app in Xcode or the approved build pipeline.
- [ ] Validate the archive before upload.
- [ ] Upload to App Store Connect.
- [ ] Wait for processing to complete.
- [ ] Resolve missing compliance, signing, or metadata warnings.

## TestFlight Configuration

- [ ] Select the processed build for TestFlight.
- [ ] Add build notes that describe awareness-first testing goals.
- [ ] Add test information for sign-in, location expectations, reporting workflow, and safety disclaimers.
- [ ] Confirm feedback collection expectations.
- [ ] Configure internal tester groups.
- [ ] Configure external tester group only after internal smoke testing passes.

## Internal Testing

- [ ] Install through TestFlight on representative iPhone devices.
- [ ] Verify launch, portrait layout, PWA-origin behavior, and Capacitor shell behavior.
- [ ] Verify awareness brief, crossing reports, road hazards, community reporting, Route Watch, Community Pulse, destination search, and settings.
- [ ] Verify legal and safety language is accessible where expected.
- [ ] Verify no store asset or screenshot staging files affect runtime behavior.
- [ ] Record issues before external testing.

## External Testing

- [ ] Prepare external tester instructions.
- [ ] Submit build for TestFlight beta review if required.
- [ ] Limit tester expectations to awareness and route-intelligence validation.
- [ ] Collect feedback about clarity, trust, mobile portrait usability, and report language.
- [ ] Triage issues before production submission.

## Acceptance Criteria

- [ ] Apple Developer setup is complete.
- [ ] App Store Connect setup is complete.
- [ ] Bundle ID is verified.
- [ ] Build upload process is documented and repeatable.
- [ ] Internal testing checklist is complete.
- [ ] External testing checklist is ready.
- [ ] No binary assets are created by V277.2.
