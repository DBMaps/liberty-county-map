# Gridly Splash Screen Strategy

## Recommended Launch Experience

**Gridly**

**Know Before You Go**

## Objective

Define the desired launch-screen direction for Gridly before producing final Apple, Android, and PWA assets. This document is strategy only and does not generate image assets.

## Launch Screen Goals

The launch experience should:

- Confirm that the user opened Gridly.
- Reinforce the awareness-first product philosophy.
- Feel fast, calm, and stable.
- Avoid implying turn-by-turn navigation, emergency response, or official government authority.
- Avoid adding new product behavior, loading flows, permissions, or animations during V277.1.

## Branding Goals

The splash screen should introduce Gridly as a trusted local awareness tool. Recommended content:

- Primary wordmark: `Gridly`.
- Supporting line: `Know Before You Go`.
- Optional simplified app mark once the icon strategy is finalized.
- Brand-consistent background color.
- High contrast for readability.

The splash should feel lightweight and utility-focused rather than promotional or visually busy.

## Apple Considerations

Apple launch screens should be simple, static, and fast. For iOS production:

- Use a launch screen that closely matches the first visible app state.
- Avoid complex animation in the launch screen.
- Keep text minimal and readable.
- Support all required iPhone sizes and safe areas.
- Do not include loading claims that may be inaccurate.

Before asset production, verify the current Apple Human Interface Guidelines and Xcode launch-screen requirements.

## Android Considerations

For Android production:

- Align with Android splash-screen behavior and adaptive icon expectations.
- Use the finalized app icon or simplified mark when available.
- Ensure readable appearance in light and dark system contexts.
- Avoid overly detailed imagery that scales poorly.
- Keep the launch experience consistent with the installed app identity.

Before production, verify current Android launch-screen and Play Console guidance.

## Capacitor Considerations

Gridly's Capacitor foundation is already established. V277.1 should not change Capacitor behavior. For V277.2 production planning:

- Generate assets using the existing Capacitor project structure.
- Avoid adding new plugins unless a future milestone explicitly approves them.
- Keep splash configuration aligned across iOS and Android.
- Confirm that any generated assets do not alter PWA behavior.
- Validate native launch screens during TestFlight and closed-testing preparation.

## Recommendations

- Produce splash assets after the app icon strategy is approved.
- Use `Gridly` and `Know Before You Go` as the core launch-message pair.
- Keep the experience static, brief, and brand-consistent.
- Treat splash production as part of V277.2 — Store Asset Production.
