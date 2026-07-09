# Gridly Weather Evidence Promotion V1

## Mission

V912 promotes meaningful weather into the Gridly Awareness Story and Evidence Experience when it helps answer: **What do I need to know before I leave?** Weather is evidence for awareness, not a standalone weather destination.

## Weather philosophy

Gridly remains Awareness Platform First and Route Intelligence Second. Weather supports the single awareness story only when it can materially affect local travel. Community context remains primary; transportation and rail context remain supporting signals; weather contributes as another evidence source.

## Promotion rules

Weather can influence the Situation, Recommendation, and Evidence when normalized weather information indicates meaningful travel impact, including:

- Heavy rain or downpours.
- Flooding potential, high water, or standing water.
- Dense fog or poor visibility.
- Strong winds or damaging gusts.
- Thunderstorms.
- Extreme heat.
- Freezing conditions, ice, sleet, or winter storm conditions.

When promoted, the Story Engine keeps one coherent story and blends weather with active community or travel reports instead of creating a separate weather story.

## Suppression rules

Weather remains hidden when it does not materially affect awareness. Conditions such as sunny weather, partly cloudy weather, pleasant temperatures, and normal humidity should not create a weather story or evidence section by themselves.

## Story examples

- Heavy rain: `Heavy rain may slow travel.` Recommendation: `Drive with caution.`
- Dense fog: `Dense fog may reduce visibility.` Recommendation: `Allow extra travel time.`
- Strong wind: `Strong winds may affect travel.` Recommendation: `Drive with extra caution.`
- Flooding potential: `Flooding potential may affect local roads.` Recommendation: `Avoid flooded roads and check your route before leaving.`
- Blended story: `Several conditions may affect travel.` Recommendation: `Check your route before leaving and allow extra travel time.`

## Evidence examples

Weather evidence appears only when weather contributes to awareness:

- `Weather` — `Heavy rain may affect local travel.`
- `Weather` — `Visibility may be reduced.`
- `Weather` — `Wind conditions may affect travel.`
- `Weather` — `Freezing conditions may affect local travel.`

## Consumer wording

Approved language is plain and travel-focused:

- `Heavy rain may slow travel.`
- `Dense fog may reduce visibility.`
- `Strong winds may affect travel.`
- `Travel conditions may deteriorate.`
- `Drive with caution.`
- `Allow extra travel time.`

Do not expose provider names, API names, weather codes, payload terminology, connector details, or engineering language in consumer surfaces.


## Audit state model

`window.gridlyWeatherEvidencePromotionAudit?.()` reports two separate concepts so quiet live conditions do not look like an active weather story.

### Current State

Current-state fields describe what is visible in the live Story Engine story and the Evidence Experience at the time the audit runs:

- `currentWeatherPromotedToStory`: whether the current Story Engine story includes weather evidence.
- `currentWeatherPromotedToEvidence`: whether the current Evidence Experience model includes a Weather section.
- `currentWeatherSuppressed`: whether weather is absent from both current surfaces.
- `currentWeatherEvidence`: the current Story Engine weather evidence object, or `null` when weather is suppressed.

For current quiet weather or no current weather impact, the expected audit shape is:

```js
{
  currentWeatherPromotedToStory: false,
  currentWeatherPromotedToEvidence: false,
  currentWeatherSuppressed: true,
  currentWeatherEvidence: null
}
```

### Capability Self-Test

Capability fields are fixture-based self-tests that confirm the V912 promotion and suppression rules still work without saying that weather is currently visible:

```js
{
  capabilityWeatherPromotionPass: true,
  capabilityWeatherEvidencePass: true,
  capabilityWeatherSuppressionPass: true
}
```

Legacy audit fields `weatherPromotedToStory`, `weatherPromotedToEvidence`, and `weatherSuppressedWhenIrrelevant` are retained as capability self-test aliases for compatibility. The `legacyFieldsRepresentCapabilitySelfTest` flag marks that they do not describe the current visible weather state.

## Future opportunities

- Tune thresholds by county and season after beta observation.
- Blend meaningful weather with route timing when Route Watch requests it.
- Add visibility and wind values to normalized weather only if they remain consumer-safe and non-provider-specific.
- Expand copy variants for localized bridge, low-water crossing, and school commute scenarios.

## Testing checklist

- Run `node --check js/app.js`.
- Run relevant Story Engine tests.
- Run relevant Evidence Experience tests.
- Run relevant weather evidence tests.
- Run `git diff --cached --check` before commit.
- Browser validation: hard refresh, confirm quiet weather is hidden, meaningful weather contributes to Situation, Recommendation, and Evidence.
- Run `window.gridlyWeatherEvidencePromotionAudit?.()` and confirm `safeForBeta: true`, current weather fields match the live Story Engine evidence, and capability fields pass.
- Verify prior audits remain `safeForBeta: true`: `window.gridlyEvidenceExperienceAudit?.()`, `window.gridlyStoryEngineAudit?.()`, and `window.gridlyCommunityCoverageCompletionAudit?.()`.

## Merge placeholder

Ready to merge when V912 audit, relevant Story Engine tests, relevant Evidence Experience tests, relevant weather tests, syntax checks, and protected-system review are green.
