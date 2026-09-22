# LP244.44 — Native push and consent plan

Contract `LP24444.v1`, design only. Native server push is MUST HAVE; no installed plugin, credential, entitlement, native configuration, build or production activation in this phase. LP244.43 verified Capacitor 8.3.4 foundations but no native push registration pipeline. [Backend ownership](LP24444-NOTIFICATION-BACKEND-CONTRACT.md), [typed targets](LP24444-NOTIFICATION-DEEP-LINK-CONTRACT.md) and [physical gates](LP24444-PHYSICAL-DEVICE-ACCEPTANCE.md) are required together.

## NATIVE-01 — Provider boundary

Freeze Android FCM and iOS direct APNs behind server interface `send(platform,environment,registration,notification,ttl,collapseKey)` returning ACCEPTED, PERMANENT_REJECTION, TRANSIENT_REJECTION or UNKNOWN with bounded provider code/message ID. Registration and message representation are adapter-versioned; pin SDK versions compatible with the existing Capacitor major during LP244.49. Server secrets stay in a managed secret store with least privileges, rotation and environment separation. No extra commercial notification broker is required; no Web Push/PWA dependency. Cost and workload are reviewed in the [dependency register](../../reports/lp24444-external-dependency-register.json).

Use Capacitor Push Notifications or a reviewed equivalent native integration. Standard plugin callbacks must be checked against exact installed versions; token refresh, early tap buffering and secure native storage may need small native bridges where plugin API alone cannot satisfy the contract. This plan does not assume a browser storage shim can safely hold ownership secrets. Registration probe is a foreground setup notification with a one-use nonce; no dependency on a silently executing background WebView. Suppress normal unsolicited permission prompts during app boot.

Server ingestion/evaluation continues when app is suspended. An alert+bounded data envelope provides OS presentation and tap data; a data-only message that requires permanent JavaScript execution is not the launch design. Provider acceptance is not delivery/display/read assurance. Force-stop, Focus/battery policy, offline devices and OS suppression must not be represented as guaranteed delivery. Static route alert copy never carries fresh progress.

## ANDROID-01 — Future implementation checklist

1. Register correctly scoped app/package in an owner-controlled Firebase project, separate test/production configurations, confirm signing/environment association. Keep server service-account credentials private; review client configuration exposure as configuration rather than embedding server credentials.
2. Add approved Capacitor-compatible native push integration; configure Android project/Gradle resources and app lifecycle callbacks in the future native branch. Existing min API24 and target36 are evidence, not a promise that any new dependency preserves API24. Verify dependency compatibility and keep minimum support unless separately approved.
3. Android13/API33+ POST_NOTIFICATIONS runtime permission follows explicit value/Continue action. Earlier OS versions still require truthful app/channel notification status; don't label absence of a runtime prompt as affirmative user consent.
4. Create two stable channels, Important awareness and Routine updates, with appropriate importance; neither bypasses DND or requests emergency privileges. Explain that users can silence channels independently and existing channel settings persist. Match server priority to the right channel. No separate channel per condition/place.
5. Register token, perform ownership probe and credential-authenticated binding, handle refresh callbacks/startup/resume reconciliation, invalid tokens and reinstall. Store secret in Keystore-backed encrypted storage; no ordinary localStorage token/secret logs.
6. Foreground receipt goes through native/app dedupe and displays one in-app alert when app is visibly active; suppress a second foreground system banner when supported/configured. Background notification is presented by OS/provider path, then tap enters typed resolver. Test that native auto-display and JS handling never generate two notifications.
7. Cold/warm action buffering, activity launch behavior, deep-link restoration, channel status, local suppression and secure deletion are integration work. No arbitrary URL intents.
8. New Android launch candidate APK/AAB is required after native changes, with pinned commit/config/signing metadata and physical tests. Existing candidate builds cannot certify new push code. No build occurs in LP244.44.

[Android notification permission](https://developer.android.com/develop/ui/views/notifications/notification-permission) and [Capacitor push interface](https://capacitorjs.com/docs/apis/push-notifications) guide implementation; validate the exact installed major/version before use.

## IOS-01 — Future implementation checklist

Windows-preparable work: shared target parser/context adapter/settings copy, APNs server adapter design and fixtures, enrollment/security tests, lifecycle fixtures, candidate acceptance scripts and disclosure draft checklist. Windows cannot certify signed iPhone entitlements, APNs registration or background presentation.

macOS/Xcode/Apple-owner work: provision correct bundle ID/team/profile; enable Push Notifications capability and resulting aps-environment entitlement; register for APNs and bridge registration success/failure to approved Capacitor/native plugin; supply private APNs authentication key/team/key IDs to server secret store; separate sandbox and production topics/endpoints. Configure UNUserNotificationCenter delegate safely with existing Capacitor delegate integration, authorized foreground presentation and action handling. Avoid conflicting delegates/listeners. Current basic delegate proxy is not an APNs integration.

Request standard alert/badge/sound permission only after explanation/Continue; no Critical Alerts entitlement. Launch requires no continuous background location and no reliance on silent background notifications to run routing/JavaScript. Do not add background modes merely to pretend push is guaranteed. If a future SDK requires a background mode for a documented feature, review that requirement separately; standard visible remote alerts and taps are the launch path. Apple background update scheduling is constrained and is not a dependable ongoing computation channel. [Apple background notification constraints](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app).

Choose foreground delegate presentation so an active in-app alert is shown once, not duplicated by a system banner. Standard OS background presentation and tap must work without JS having remained alive. APNs registration callbacks are reconciled each launch/resume; do not presume token length, identity permanence or that reinstall changes every token. Store ownership in Keychain ThisDeviceOnly with app-container reinstall marker to avoid inheriting orphan subscriptions. Remove obsolete raw tokens on authoritative invalidation.

Produce a newly signed iOS candidate on macOS/Xcode with provisioning/candidate metadata and test actual physical iPhone APNs receipt, foreground/background/terminated tap, rotation/reinstall, consent, route/winter alert and portrait safe areas. Simulator results alone cannot satisfy launch.

## UX-01 — Consent and settings must precede delivery

First launch never immediately prompts for notification permission. User chooses Enable alerts from a meaningful Home/trip surface or Settings. Show “Get alerts about important conditions near home or during a trip.” Explain selected Home, static trip corridor while suspended, best-effort delivery, category choices and how to turn off/delete. Around Me is explicitly while-app-open. Continue invokes OS permission; Not now leaves master off and all subscription delivery disabled. Already authorized OS status still requires Gridly consent.

Keep four independent facts visible: OS permission/channel status, Gridly master setting, context choices and content choices. Also show registration Pending/Ready/Failed/Unavailable truthfully; OS permission alone does not equal ready server delivery. Denied status offers an explicit Open system settings action without repeated prompts. After returning/resuming, query status and reconcile server preferences; OS-disabled state immediately suppresses local surfaces and requests remote suspension, acknowledging that an offline server cannot instantly learn the change.

| Control | Launch default / meaning |
|---|---|
| Master Notifications | OFF until explicit consent and permission/verified registration; no silent enable from stored placeholder booleans |
| Home Area | ON after explicit setup confirmation, canonical saved locality shown; requires valid supported Home |
| Route Watch | ON after explicit setup confirmation as an allowed context; each trip still separately activated |
| Around Me | Informational “While app is open”; no background push switch; ordinary foreground awareness remains available without notification permission |
| Severe Weather | ON once setup accepted; official qualifying alerts, no manufactured road condition |
| Significant Road / Hazard Alerts | ON once accepted; includes qualified community hazards with attribution |
| Community Updates | OFF; additional lower-impact observations |
| Routine Updates | OFF; if enabled, bounded batch/max-per-day plus content preferences |
| Quiet Hours | Available at launch, OFF by default; user chooses local start/end and IANA timezone |
| Allow important alerts during quiet hours | OFF; explicitly app-level HIGH_AWARENESS exception only, no OS Focus/DND bypass |

Quiet hours must be implemented before enabling real Home/route delivery, even though LP244.52 performs full integration certification. No default clock interval is silently selected: start/end must both be explicit when enabled; equal times rejected, cross-midnight supported. Use saved IANA timezone and server UTC to evaluate local wall-clock interval, start-inclusive/end-exclusive. Spring gap starts at first valid time after the skipped boundary; repeated fall-back times both obey the interval. Device detects timezone change on resume and explicitly synchronizes the displayed current timezone; while offline server retains last confirmed zone, visibly pending. Quiet defer must not extend event/watch/provider TTL; discard stale items. Routine daily quota uses the stored zone/local date, with server protection against preference toggles resetting quota. Lower-priority updates never use high bypass.

Master off or context/content disable cancels affected pending matches on confirmed server update and locally suppresses immediately. Other eligible context matches may remain only if still consented. Settings with an unsynchronized change says Pending; no false “all alerts stopped” while offline. Delete Notifications Data invokes credential-authorized revocation/purge and clears local state only after acknowledgment or explicit informed local-only erase. Home/report data outside this installation subsystem remain separately governed and clearly described.

LP244.49 owns minimum complete consent, settings/quiet-hour primitives, permission state machine and deletion controls; LP244.50 cannot send with placeholder Settings. LP244.52 strengthens/accessibility-tests integrated states rather than deferring essential user control. A route can provide local awareness without push consent, but must say “Trip alerts off” and cannot create an active server push subscription implicitly.
