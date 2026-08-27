# LP241 Device Compatibility and Accessibility Matrix

No row is certified by this audit. Record exact physical model, OS/browser version, installed/browser mode, orientation, text size, assistive technology, result, and evidence link.

| Platform | Representative form/viewport | Portrait | Landscape | Installed | Required checks |
|---|---|---:|---:|---:|---|
| iPhone Safari | small + standard + large phone | REQUIRED | REQUIRED | n/a | safe areas, address bar viewport, permission deny/allow, keyboard/sheet overlap, VoiceOver, text scaling |
| iPhone PWA | standard phone | REQUIRED | REQUIRED | REQUIRED | install/start scope, standalone safe areas, offline/update/recovery, share/deep return, VoiceOver |
| Android Chrome | small + standard + large phone | REQUIRED | REQUIRED | n/a | dynamic viewport, back behavior, permission timeout/deny, keyboard, TalkBack, touch targets |
| Android PWA | standard phone | REQUIRED | REQUIRED | REQUIRED | installability, offline/update/stale client recovery, TalkBack |
| iPad/tablet browser | tablet | REQUIRED | REQUIRED | optional | portrait balance, sheet width/focus, map obstruction, external keyboard |
| Edge desktop | desktop | n/a | REQUIRED | n/a | keyboard-only, zoom 200%, Windows screen reader smoke, hover independence |
| Chrome desktop | desktop | n/a | REQUIRED | optional | keyboard, focus, resize, storage/service worker, reduced motion |
| Safari desktop | desktop where practical | n/a | REQUIRED | n/a | keyboard/focus, storage/service worker, zoom, reduced motion |

## Accessibility protocol

1. Traverse landmarks/headings and every actionable control with keyboard/switch input; confirm accessible names and visible focus.
2. Open/close every sheet/modal; focus enters, remains logically contained, returns to invoker, and Escape/back behavior is predictable.
3. Validate forms: persistent labels, instructions/errors announced, disabled/loading/submitted states truthful, no color-only meaning.
4. Exercise map controls, marker/popup, Show me and report placement without hover or fine pointer.
5. Test 200% browser zoom and largest OS text: no hidden action, clipped critical copy, or keyboard overlap.
6. Enable reduced motion and high-contrast/dark preferences; record contrast risks rather than claiming compliance from inspection.
7. Screen-reader smoke: onboarding, area selection, KBYG, Alerts detail, search/result selection, route preview and report submit/failure.
8. Measure touch controls against platform usability; distinguish a blocked/unreliable action from polish.

## Static risk register

Dynamic viewport/safe-area behavior, fixed sheets plus software keyboard, map keyboard alternatives, focus restoration, screen-reader live announcements, service-worker update skew, and storage/geolocation permission variants all require devices. These are evidence gaps, not fabricated defects. A demonstrated inability to complete a core journey is a launch barrier; minor spacing or preference is not.
