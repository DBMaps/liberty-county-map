# GRIDLY V249.0 — Settings List Experience Audit

## Mission

Audit only. Determine whether the current Settings experience can become a compact, expandable, mobile-first list without redesigning the UI, moving controls, changing behavior, writing settings, or touching protected systems.

## Audit Helper

Added read-only runtime helper:

```js
window.gridlySettingsListExperienceAudit?.()
```

The helper returns the required V249.0 contract, including:

- `available: true`
- `auditVersion: "V249.0"`
- `settingsDetected`
- `totalSettingsItems`
- `sections`
- `frequentlyUsedItems`
- `setupOnlyItems`
- `operationalItems`
- `groupingRecommendations`
- `clutterFindings`
- `expandableListReady`
- protected-system flags set to `false`
- `canProceedToV249_1`

The helper also includes `settingsPanelAuditSnapshot` when `window.gridlySettingsPanelAudit?.()` is available.

## Current Settings Inventory

The current Settings surface contains 14 primary user-facing settings items/actions: 3 Route & Places items, 4 Notification items, 4 Display/Profile items, and 3 About/Support items.

### Route Watch Settings

Immediately visible today:

- `HOME`
   - Saved/not-saved value.
   - Meta text such as Route Watch enablement context.
   - Local-only note.
   - `Edit Home` action.
- `WORK`
   - Saved/not-saved value.
   - Meta text such as Route Watch enablement context.
   - Local-only note.
   - `Edit Work` action.
- `Saved Places`
   - `Manage Saved Places` action.
   - Dynamic saved-place rows are supported by the current hidden list.

Recommended collapsed visibility:

- Home saved/not-saved state.
- Work saved/not-saved state.
- Saved Places count/manage summary.

Recommended expanded-only content:

- Full address/meta text.
- Local-only notes.
- Edit Home.
- Edit Work.
- Manage Saved Places.
- Saved-place rows when present.

### Notification Preferences

Immediately visible today:

- `Route Watch Alerts` toggle.
- `Rail Crossing Alerts` toggle.
- `Road Hazard Alerts` toggle.
- `Community Activity Alerts` toggle.
- Storage-only explanatory copy.

Recommended collapsed visibility:

- Notification Preferences row.
- Count of enabled stored preferences.
- Storage-only qualifier, because notification delivery is not enabled.

Recommended expanded-only content:

- All four toggles.
- Full explanatory copy.

### Display Preferences

Immediately visible today:

- `Preferred Name` input.
- `Map Style` select.
- `Theme` select.
- `Text Size` select.
- Explanatory local-save/preference notes.

Recommended collapsed visibility:

- Map Style current value.
- Text Size current value.
- Theme current value only if space allows.
- Preferred Name set/not-set state only if grouped under Profile.

Recommended expanded-only content:

- Preferred Name input and privacy note.
- Theme select.
- Full explanatory copy.
- Select controls for Map Style and Text Size.

### About Gridly

Immediately visible today:

- `About Gridly` version/build information.
- `Replay Setup` button.
- `Send Feedback` button.
- Feedback placeholder/status copy.

The helper counts the actionable About row as three primary settings items: About/build, Replay Setup, and Send Feedback. Status copy is treated as support text, not a standalone settings item.

Recommended collapsed visibility:

- About Gridly version/build summary.

Recommended expanded-only content:

- Replay Setup.
- Send Feedback placeholder.
- Feedback status copy.

### Not Detected In Current Settings

The audit did not find the following as current Settings controls:

- Awareness Area control.
- Location permission control.
- Report settings.
- Route logic tuning.
- Testing tools.
- Supabase sync controls.

These should not be invented or migrated as part of V249.0.

## Portrait Usability Assessment

### Visible Settings Load

The current Settings experience exposes a tall stack of cards, toggles, selects, buttons, explanatory text, and support copy. On portrait mobile, the first screen is dominated by Route Watch cards before lower-priority settings become reachable.

### Frequently Used Items

- Home saved/not-saved state.
- Work saved/not-saved state.
- Saved Places management/count.

### Operational Items

- Home and Work route anchors.
- Saved Places management.
- Route/Rail/Hazard/Community stored alert preferences.
- Map Style.
- Text Size.

### Setup-Only / Rare Items

- Preferred Name.
- Theme.
- Replay Setup.
- Send Feedback placeholder.
- About/build metadata.

## Grouping Recommendations

### Route & Places

Collapsed row should show:

- Home state.
- Work state.
- Saved Places count.

Expanded detail should show:

- Full Home/Work meta.
- Local-only notes.
- Edit/manage actions.

### Alerts & Notifications

Collapsed row should show:

- Enabled stored preference count.
- Storage-only language.

Expanded detail should show:

- Route Watch Alerts.
- Rail Crossing Alerts.
- Road Hazard Alerts.
- Community Activity Alerts.

### Map & Display

Collapsed row should show:

- Map Style current value.
- Text Size current value.

Expanded detail should show:

- Map Style select.
- Theme select.
- Text Size select.
- Related explanatory notes.

### Profile & Awareness

Collapsed row should show:

- Preferred Name set/not-set state, if retained here.

Expanded detail should show:

- Preferred Name input.
- Privacy/local-only note.

Awareness Area is not currently present in Settings.

### Support & About

Collapsed row should show:

- Version/build summary.

Expanded detail should show:

- Replay Setup.
- Send Feedback placeholder.
- Feedback status.

### Data & Testing

No current Settings controls were detected for testing tools, Supabase sync, or data utilities.

## Clutter Findings

1. Route Watch uses large place cards for Home, Work, and Saved Places, creating a tall first section on portrait.
2. Home and Work repeat label, value, meta copy, local-only note, and an edit button.
3. Notification Preferences exposes four toggles plus copy despite no notification delivery being enabled.
4. Display Preferences mixes setup-only personalization with operational map/text density controls.
5. About Gridly exposes rare/support actions at the same visual level as operational settings.
6. Send Feedback is currently a placeholder acknowledgement, making it low-value as always-visible content.
7. Saved Places already has a hidden dynamic list, which supports expandable-list readiness.
8. No current Awareness Area, Location, Report Settings, Testing Tools, or Supabase controls were detected in Settings.

## Expandable-List Readiness

`expandableListReady: true`

The current Settings controls can support a collapsed-row + expanded-detail model without behavior changes:

- Cards can become summarized rows.
- Toggles can remain existing inputs inside expanded detail.
- Selects and input fields can remain unchanged inside expanded detail.
- About/support actions can move into an expanded support section.
- Existing hidden saved-place rows can remain expanded-only.

## Recommended Immediate vs Expanded Content

### Immediately Visible

- Home saved/not-saved state.
- Work saved/not-saved state.
- Saved Places count/manage summary.
- Notification preferences enabled count with storage-only language.
- Map Style current value.
- Text Size current value.
- Version/build summary.

### Hidden Until Expanded

- Full Home/Work meta and local-only notes.
- Edit Home / Edit Work / Manage Saved Places buttons.
- All notification toggles.
- Preferred Name input and privacy note.
- Theme select and explanatory copy.
- Replay Setup.
- Send Feedback placeholder and status.

## Protected Systems Review

V249.0 is audit-only. No changes were made to:

- Route Watch.
- Route logic.
- Awareness filtering.
- Hazard lifecycle.
- Crossing reporting.
- Supabase sync.
- Popup consumer models.
- User location awareness dot.

The helper returns:

- `protectedSystemsModified: false`
- `routeLogicModified: false`
- `awarenessFilteringModified: false`
- `supabaseModified: false`

## Recommendations for V249.1

Proceed to V249.1 only if the implementation remains behavior-preserving:

1. Build Settings as compact expandable rows.
2. Keep Route & Places first because it carries Route Watch readiness.
3. Keep only state summaries visible while collapsed.
4. Put action buttons and explanatory copy inside expanded detail.
5. Keep notification copy explicit that preferences are storage-only unless delivery is implemented separately.
6. Do not add new Awareness, Location, Testing, Supabase, or route-logic controls during the list conversion.
7. Preserve existing input IDs/data attributes or adapt bindings without changing storage semantics.

## Merge Recommendation

Merge recommended for V249.0 audit helper and documentation. This branch does not redesign Settings and only exposes read-only inventory/readiness data for the next implementation decision.
