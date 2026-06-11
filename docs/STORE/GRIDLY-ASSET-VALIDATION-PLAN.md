# Gridly Asset Validation Plan — V277.3

## Objective

Define how future production store assets will be validated before V277.4 asset integration audit and store upload. V277.3 defines the plan only and does not perform final asset validation because production assets are not present yet.

## Validation Scope

Future validation must cover:

- Correct dimensions.
- Correct filenames.
- Correct location.
- Correct quantity.
- Store readiness.
- No fake screenshots.
- No AI-generated placeholder images.
- Awareness-first and route-intelligence-second messaging.

## Inputs

Future validation should use:

- `docs/STORE/GRIDLY-ASSET-INVENTORY.md`
- `docs/STORE/GRIDLY-ASSET-CREATION-CHECKLIST.md`
- `docs/STORE/GRIDLY-ASSET-NAMING-STANDARD.md`
- `docs/STORE/GRIDLY-APP-SCREENSHOT-CAPTIONS.md`
- `assets/store/manifest/README.md`
- Current App Store Connect requirements at upload time.
- Current Play Console requirements at upload time.
- Final legal URLs and privacy/data-safety answers.

## Check 1 — Correct Dimensions

For every final binary asset in a future milestone:

1. Read actual image dimensions from the file metadata.
2. Compare each asset against the expected platform requirement.
3. Flag any asset with incorrect width, height, aspect ratio, transparency, or platform-incompatible format.
4. Record accepted dimensions in the future final manifest.

Expected baseline examples:

- Apple App Store icon: 1024 × 1024 px.
- Google Play icon: 512 × 512 px.
- Google feature graphic: 1024 × 500 px.
- Screenshots: platform-specific dimensions selected for launch and verified at upload time.

## Check 2 — Correct Filenames

For every final asset:

1. Confirm the filename matches `docs/STORE/GRIDLY-ASSET-NAMING-STANDARD.md`.
2. Confirm lowercase kebab-case.
3. Confirm the correct platform prefix.
4. Confirm screenshot sequence number and scenario slug.
5. Confirm the version segment.
6. Reject ambiguous names such as `final.png`, `screenshot1.png`, or `copy-of-icon.png`.

## Check 3 — Correct Location

For every final asset:

1. Confirm Apple listing assets are under `assets/store/apple/`.
2. Confirm Google listing assets are under `assets/store/google/`.
3. Confirm manifest records remain under `assets/store/manifest/`.
4. Confirm native resource exports are integrated only during the appropriate native package milestone.
5. Confirm raw capture dumps and source design files are not mixed into final upload folders.

## Check 4 — Correct Quantity

Future validation should confirm at minimum:

- One accepted Apple App Store icon.
- One accepted Google Play icon.
- One accepted Google feature graphic.
- Eight accepted Apple iPhone screenshots, unless the launch plan changes and is documented.
- Eight accepted Google phone screenshots, unless the launch plan changes and is documented.
- Conditional iPad and tablet screenshots only when those platforms are included.
- Published legal URLs and required store metadata records.

## Check 5 — Store Readiness

Before store upload:

1. Upload assets into draft App Store Connect and Play Console records when available.
2. Record platform validation warnings and errors.
3. Resolve rejected dimensions, file formats, transparency issues, copy issues, or policy issues.
4. Confirm captions and copy do not overstate official verification, emergency support, safety guarantees, routing guarantees, or government affiliation.
5. Confirm screenshots are real captures from Gridly and not fake composites.
6. Confirm no AI-generated placeholder imagery is included.

## Future Automation Recommendation

V277.4 may add a small validation script that reads a machine-readable manifest, inspects asset dimensions, checks filenames and locations, and returns a pass/fail summary. The script should be introduced only after final assets exist or when the integration audit requires automated checks.

## V277.3 Non-Validation Statement

Production asset validation is intentionally not performed in V277.3 because production assets are not present. This milestone prepares the validation plan, manifest documentation, naming standard, and audit helper so manual asset creation can proceed without uncertainty.
