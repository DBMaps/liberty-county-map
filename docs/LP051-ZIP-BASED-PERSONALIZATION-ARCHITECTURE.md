# LP051 — ZIP-Based Personalization Architecture

## Audit findings

Gridly currently treats manual onboarding as a county-first, community-second selection. The welcome flow reads `#gridlyWelcomeCountySelect`, filters it against operational county runtime status, then repopulates the home-area selector from `GRIDLY_AWARENESS_AREA_DEFINITIONS`. A home-area change persists the selected awareness storage value through `saveGridlyHomeTownPreference`, and runtime consumers resolve that value through `getGridlySelectedAwarenessArea()`.

County selection is not the awareness owner. County selection is a setup filter and runtime package context. Awareness ownership remains the selected area object with `countyId`, label/storage value, coordinates, radius, and county-wide/fallback flags.

Awareness areas and communities are centralized in `GRIDLY_AWARENESS_AREA_DEFINITIONS`, augmented by operational county registry defaults and Houston regional awareness definitions. Existing presentation surfaces consume the selected awareness area label, so they already preserve consumer-facing community names such as Dayton, Liberty, Livingston, Houston regions, and other county/community labels.

## Architecture recommendation

Use a dedicated ZIP dataset as a resolver input layer:

```text
ZIP dataset record
  ↓
countyId / countyName
  ↓
existing awarenessAreaKey
  ↓
existing awareness area / community presentation
```

The ZIP dataset should own only address-independent personalization hints. It should not become an alert filter, route context, destination source, map-search source, or presentation label source.

Each ZIP record should include:

- `zip`: normalized five-digit ZIP.
- `countyId`: canonical Gridly county id.
- `countyName`: display/debug county name.
- `awarenessAreaKey`: key into the existing awareness-area registry.
- `communityName`: human-readable fallback/debug label.
- `resolutionConfidence`: data quality classification.
- Optional notes/source metadata for split ZIPs, PO boxes, and future authoritative imports.

Split ZIPs should be represented as explicit records with a future disambiguation policy rather than switch statements. The long-term dataset can add weights, ZIP type, USPS preferred city, county percentages, source version, and optional alternate awareness candidates.

## Runtime integration plan

LP051 introduces a passive resolver only. The safe insertion point is before `saveGridlyHomeTownPreference`: ZIP resolution should produce the same payload manual selection already produces, then the existing preference and awareness caches should do the rest.

Future UI flow:

1. User enters ZIP during onboarding or Settings.
2. ZIP resolver validates the input and looks up the dataset.
3. Resolver returns `{ countyId, awarenessArea, communityName, presentationLabel }`.
4. Existing manual-selection writer stores the awareness area's `storageValue` and county id.
5. Existing runtime systems continue reading `getGridlySelectedAwarenessArea()`.

## Migration strategy

1. Keep manual county/community setup fully available.
2. Add ZIP entry as an optional onboarding path only after dataset coverage and split-ZIP handling are certified.
3. Store the home ZIP as personalization metadata, but keep awareness storage based on existing `storageValue`/`awarenessAreaKey`.
4. Add Settings copy later as “Change Home ZIP,” while retaining legacy manual controls behind an advanced/edit fallback during migration.
5. Expand the dataset through generated JSON from authoritative/imported source data, not application switch statements.

## Regression analysis

Protected systems remain unchanged because ZIP resolution is not wired into routing, map search, report submission, alert generation, provider fetches, Supabase synchronization, hazard lifecycle, Route Watch, Travel Brief, Community Pulse, or Shared Reports.

Presentation remains unchanged because the resolver returns existing awareness areas. Consumers should see awareness labels such as Dayton or Liberty, not ZIP codes.

Route Intelligence remains independent. Address search, Use My Location, Tap Map, Saved Places, and Route Watch should continue using their current destination/location flows.

## Implementation recommendation

The LP051 foundation should merge if the passive resolver and audit pass. Do not launch ZIP-first UI until a broader ZIP dataset, split-ZIP policy, and mobile portrait onboarding copy are certified.
