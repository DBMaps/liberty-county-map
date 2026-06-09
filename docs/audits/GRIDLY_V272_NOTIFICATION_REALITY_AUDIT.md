# GRIDLY V272 — Notification Reality Audit

Date: 2026-06-09  
Branch: `feature/v272-notification-reality-audit`  
Scope: audit only. No notification, Route Watch, reporting, alerts, awareness, desktop gate, landscape gate, marker, Supabase, lifecycle, or onboarding behavior was changed.

## Executive answer

If a user turns on notifications today, Gridly stores the preference locally and, in a few UI locations, updates local status text or an in-app banner. Gridly does **not** ask the browser for notification permission, does **not** register a service worker, does **not** subscribe to PushManager, and does **not** call the browser Notification API. Notification-related settings are therefore preferences / intent capture and diagnostics, not a delivery system.

## 1. Notification systems inventory

| System / surface | Exists today | Stored where | Actual behavior |
|---|---:|---|---|
| Settings → Alerts & Notifications toggles | Yes | `localStorage` key `gridlySettingsV1`, under `notifications` | Four booleans are saved and reloaded. The UI explicitly says storage only / no delivery. |
| Portrait V2 Settings → Alerts & Notifications toggles | Yes | Same `gridlySettingsV1` key | Same four booleans are saved via V2 `data-v2-settings-field` controls. The portrait copy says no notification delivery is enabled. |
| Premium Smart Alerts modal | Yes | `localStorage` key `gridlySmartAlertsV1`; first-open marker `gridlySmartAlertsDrawerSeenV1` | Saves four Smart Alert booleans, derives an `enabled` flag, updates modal heading, confirmation text, and may display an in-app banner when current in-memory report data matches selected categories. |
| Notification architecture audit helper | Yes | Reads `gridlySettingsV1` and current runtime data | Builds diagnostic-only candidate collections for route, rail, hazard, and community notification types. It returns `deliveryEnabled: false`, `runtimeLoopsAdded: false`, and `schedulerAdded: false`. |
| Browser notifications | No | None | No `Notification.requestPermission`, `new Notification`, or `showNotification` usage found. |
| Push notifications | No | None | No service worker file, service worker registration, PushManager subscription, or push event handler found. |
| Scheduled / background notification delivery | No | None | No notification scheduler or runtime delivery loop is enabled. |

## 2. Existing notification settings

### `gridlySettingsV1` notification preferences

Default settings are:

- `notifications.routeAlerts`: `true`
- `notifications.railAlerts`: `true`
- `notifications.hazardAlerts`: `true`
- `notifications.communityAlerts`: `false`

The Settings UI exposes these as:

- Route Watch Alerts
- Rail Crossing Alerts
- Road Hazard Alerts
- Community Activity Alerts

### `gridlySmartAlertsV1` Smart Alert preferences

Default Smart Alert settings are:

- `enabled`: `false`
- `nearbyBlocked`: `false`
- `routeDelay`: `false`
- `us90Clear`: `false`
- `needsConfirm`: `false`

The Smart Alerts modal exposes these as:

- Nearby blocked crossings
- Saved route delay warnings
- US-90 clear notices
- Reports that need confirmation

`enabled` is derived on save as the OR of the four Smart Alert checkboxes.

## 3. Where settings are stored

- Main notification preferences are stored locally in `localStorage` under `gridlySettingsV1`.
- Smart Alert preferences are stored locally in `localStorage` under `gridlySmartAlertsV1`.
- Smart Alerts also write `gridlySmartAlertsDrawerSeenV1` when the modal/preferences are first loaded.
- These are client-local browser storage keys. No Supabase, server, push-subscription, or external messaging storage was found for notifications.

## 4. Actual working notification behavior

### Settings notification toggles

When a user toggles one of the four Settings notification preferences:

1. The checkbox state is collected from the UI.
2. The normalized settings object is written to `localStorage` key `gridlySettingsV1`.
3. Display preferences may be applied as part of the shared settings save routine, but no notification side effect is triggered.
4. Status text says settings were saved locally / on this device.

No browser notification, push notification, scheduled job, background loop, or Route Watch delivery action is started.

### Smart Alerts modal

When a user saves Smart Alerts:

1. Gridly reads the four Smart Alert checkboxes.
2. Gridly sets `enabled` to true if any of the four boxes are checked.
3. Gridly writes the Smart Alert preferences to `localStorage` key `gridlySmartAlertsV1`.
4. Gridly updates the modal heading to `Premium Smart Alerts: On` or `Premium Smart Alerts: Off`.
5. Gridly may evaluate current in-memory reports and show text in the modal banner if matches exist.
6. Gridly shows local confirmation text with the save time.

The Smart Alerts banner is local UI only. It is not a browser notification and is not delivered out-of-app.

### Diagnostic notification architecture helper

The `gridlyNotificationArchitectureAudit` helper can identify candidate notification-worthy events from route, rail, hazard, and community data. However, the helper marks itself diagnostic-only and explicitly reports delivery and scheduling disabled.

## 5. Browser permission behavior

- Notification permission is not requested.
- The Notifications permission API is not queried.
- The only browser permissions usage found is geolocation-related (`navigator.permissions.query({ name: "geolocation" })`) and geolocation request flows. That is outside notification permission behavior.

## 6. APIs currently used

### Notification APIs

No browser notification APIs are currently called:

- No `Notification.requestPermission(...)`
- No `Notification.permission`
- No `new Notification(...)`
- No `ServiceWorkerRegistration.showNotification(...)`
- No `PushManager` / `pushManager.subscribe(...)`
- No push event listener

### Related non-notification APIs

- `localStorage` is used to persist notification preferences.
- `navigator.permissions.query({ name: "geolocation" })` is used for location diagnostics / current-location flows, not notifications.

## 7. Route Watch notification support

Route Watch notification support is **not delivered today**.

What exists:

- A `Route Watch Alerts` toggle exists in Settings and Portrait V2 Settings.
- The diagnostic notification architecture can generate route candidate records such as route delay, route blocked, better alternate route, and commute condition changed.

What does not exist:

- No user-visible delivered Route Watch notification.
- No browser permission request.
- No browser Notification API call.
- No push subscription.
- No scheduler / background loop.

## 8. Awareness notification support

Awareness notification support is **not delivered today**.

What exists:

- Awareness and alert surfaces exist in the product as in-app UI.
- Notification-adjacent toggles exist for Rail Crossing Alerts, Road Hazard Alerts, and Community Activity Alerts.
- The diagnostic notification architecture can generate rail, hazard, and community candidate records from current runtime data.

What does not exist:

- No browser notifications for Awareness Briefs, rails, road hazards, or community activity.
- No push notifications.
- No out-of-app delivery.
- No scheduled notification loop.

## 9. Informational-only / intent-only settings

The following settings are informational-only / stored intent today:

- Route Watch Alerts
- Rail Crossing Alerts
- Road Hazard Alerts
- Community Activity Alerts
- Smart Alert categories in the Premium Smart Alerts modal

The main Settings UI explicitly states that Gridly will not schedule or deliver notifications from these toggles. The portrait Settings UI similarly states that no notification delivery is enabled.

## 10. Dormant / partially implemented notification systems

The notification architecture helper is the main dormant / partial system. It contains notification candidate classification logic, freshness windows, route-distance checks, duplicate suppression, and per-type eligibility. It is useful audit scaffolding, but it is explicitly diagnostic-only and not connected to delivery.

Smart Alerts are partially functional as an in-app preference and banner system, but the name and modal copy can imply notification delivery even though the implementation only saves local preferences and updates in-app UI.

## 11. Notification UI surfaces that imply functionality which does not exist

Potential expectation gaps:

- `Alerts & Notifications` sounds like delivery, but the implementation is preference storage only.
- `Route Watch Alerts`, `Rail Crossing Alerts`, `Road Hazard Alerts`, and `Community Activity Alerts` sound like active alert delivery, but they only persist local booleans.
- `Premium Smart Alerts: On` sounds like a working alerting product, but it only turns on local preference state and possible in-app banner messaging.
- `Saved route delay warnings`, `US-90 clear notices`, and similar Smart Alert labels sound deliverable, but no notification delivery exists.

Mitigating copy already exists in Settings / Portrait V2 Settings, where the UI states storage-only / no delivery.

## 12. Features that appear functional but are not

- Browser notifications: not functional.
- Push notifications: not functional.
- Out-of-app Route Watch notifications: not functional.
- Out-of-app Awareness / rail / hazard / community notifications: not functional.
- Scheduled notification delivery: not functional.
- Quiet hours, throttling, notification consent flow, targeting, push-token storage, and delivery telemetry: not present.

## 13. Features that are fully functional

Within the current limited scope, these pieces are functional:

- Main Settings notification preference persistence in `gridlySettingsV1`.
- Portrait V2 Settings notification preference persistence in `gridlySettingsV1`.
- Smart Alerts preference persistence in `gridlySmartAlertsV1`.
- Smart Alerts local heading/confirmation updates.
- Smart Alerts local in-app banner evaluation from currently loaded report data.
- Diagnostic-only notification candidate audit helper.

## 14. Gaps between user expectations and current implementation

| User expectation | Current implementation | Gap |
|---|---|---|
| Turning on notifications means the browser will ask for permission. | No notification permission request exists. | Consent flow absent. |
| Turning on Route Watch Alerts means the user will be alerted when a route changes. | Preference is saved; diagnostic candidates may exist; no delivery. | Route Watch delivery absent. |
| Turning on Smart Alerts means Gridly will notify the user. | Preference is saved and modal/banner text may update in-app. | Out-of-app notification absent. |
| Alerts continue while the app is closed. | No service worker or push subscription. | Background delivery absent. |
| Notification preferences apply across devices/accounts. | Preferences are local `localStorage` only. | Account/server sync absent. |
| Notifications respect throttling/quiet hours. | No delivery layer or policy layer exists. | Notification policy absent. |

## 15. Beta-readiness recommendation

Do **not** present notifications as beta-ready. Current notification behavior is beta-safe only if positioned as local preference storage / future notification intent.

Recommended beta classification:

- Settings persistence: beta-ready as local preferences.
- Smart Alerts local banner: beta-ready only as in-app contextual messaging if copy avoids implying delivery.
- Browser notifications: not beta-ready.
- Push notifications: not beta-ready.
- Route Watch notifications: not beta-ready.
- Awareness notifications: not beta-ready.

Before beta users see notification language, keep or strengthen the existing storage-only copy and avoid marketing `Premium Smart Alerts` as delivery until a consent, delivery, targeting, quiet-hours, throttling, and lifecycle plan exists.

## 16. Direct answer: "If a user turns on notifications today, what exactly happens?"

- In Settings / Portrait V2 Settings, Gridly saves the selected notification booleans to local browser storage under `gridlySettingsV1` and shows local saved status. Nothing is delivered.
- In Premium Smart Alerts, Gridly saves selected categories to local browser storage under `gridlySmartAlertsV1`, updates `Premium Smart Alerts: On`, may show a local in-app banner if currently loaded data matches, and shows a saved confirmation. Nothing is delivered.
- The browser is not asked for notification permission.
- No browser notification appears.
- No push notification is sent.
- No service worker or scheduler is started.
- No Supabase/server notification record or push token is created.

## 17. Audit commands used

```bash
git branch --show-current
git status --short
rg --files -g '!node_modules' -g '!dist' -g '!build'
rg -n "Notification|notification|notify|push|Push|serviceWorker|ServiceWorker|showNotification|requestPermission|PushManager|Notification\.permission|Notification\(" js/app.js index.html -S
rg -n "navigator\.serviceWorker|serviceWorker|ServiceWorker|Notification\.|new Notification|showNotification|PushManager|pushManager|requestPermission|PushSubscription|PushEvent|self\.addEventListener\(['\"]push|registration\.showNotification|permissions\.query\(|navigator\.permissions|PermissionStatus" . -S -g '!node_modules' -g '!dist' -g '!build'
rg -n "SMART_ALERTS_STORAGE_KEY|GRIDLY_SETTINGS_STORAGE_KEY|settingsRouteAlertsToggle|settingsRailAlertsToggle|settingsHazardAlertsToggle|settingsCommunityAlertsToggle|smartAlertNearbyBlocked|gridlyNotificationArchitectureAudit" js/app.js index.html -S
node --check js/app.js
node --check js/gridlyTxdotService.js
```

## 18. `git status --short` at audit handoff

Before committing this audit document, the working tree status was:

```text
?? docs/audits/GRIDLY_V272_NOTIFICATION_REALITY_AUDIT.md
```
