# GRIDLY V275.2 — PWA Install Gridly UX

## What was added

V275.2 adds a small, controlled **Install Gridly** entry point inside **Settings / About & Support**.

The entry point includes:

- Title: **Install Gridly**
- Description: **Add Gridly to your phone’s home screen for quick access.**
- Android/Chromium install button when a captured `beforeinstallprompt` event is available
- iOS Safari instruction copy when the browser is likely iOS Safari
- Runtime visibility handling so unsupported browsers do not see an inert install action
- `window.gridlyPwaInstallUxAudit?.()` for focused install UX verification

This is a user-facing install entry point only. It does not add notifications, background sync, offline reporting, offline Route Watch, Capacitor, county expansion, or workflow changes.

## Why auto-prompting is avoided

Gridly intentionally does **not** call `prompt()` on page load or when Settings opens.

Install prompting is kept conservative because:

- Install prompts should be user-initiated.
- Automatic prompts can interrupt drivers or commuters trying to quickly check conditions.
- Browsers may suppress abusive or unexpected install prompts.
- The PWA foundation should remain compatible with the later Capacitor phase without introducing web-only engagement assumptions.

Gridly captures `beforeinstallprompt`, calls `event.preventDefault()`, stores the event, and waits for the user to tap **Install**.

## Android / Chrome install behavior

On browsers that provide `beforeinstallprompt`:

1. Gridly captures the event.
2. Gridly prevents the browser from auto-showing the prompt.
3. The **Install Gridly** row becomes eligible inside Settings / About & Support.
4. The browser prompt is triggered only when the user taps **Install**.
5. If `userChoice` is available, Gridly records the outcome in `window.gridlyPwaInstallReadinessState`.
6. After the prompt attempt, Gridly clears the stored prompt event and refreshes the install UX state.

## iOS Safari install behavior

iOS Safari does not use `beforeinstallprompt` in the same way as Android/Chromium browsers.

When Gridly detects likely iOS Safari and the app is not already standalone, the install area shows the instruction:

> Tap Share, then Add to Home Screen.

Gridly does not try to force installation on iOS Safari and does not show a button that triggers a no-op prompt.

## Standalone behavior

When Gridly is already running in standalone mode:

- Gridly detects standalone mode using display-mode and iOS `navigator.standalone` checks.
- The install area shows **Installed** rather than offering a dead install button.
- The install prompt button is hidden/disabled so no inert action is presented.

## Known limitations

- Browser install-prompt eligibility is controlled by the browser and may depend on HTTPS, manifest validity, service worker state, user engagement, and prior dismissals.
- Some desktop browsers may not expose `beforeinstallprompt` immediately or at all.
- iOS Safari installation remains manual through the Share sheet.
- If a user dismisses the Android/Chromium prompt, the browser may not provide another prompt event during the same session.

## Future Capacitor notes

This patch is safe for a later Capacitor phase because it:

- Does not introduce Capacitor dependencies.
- Does not change core app workflows.
- Does not add notification, background sync, or offline workflow behavior.
- Keeps install UX isolated to Settings / About & Support.
- Exposes audit state through `window.gridlyPwaInstallUxAudit?.()` so native-packaging readiness can be checked separately from web install-prompt behavior.
