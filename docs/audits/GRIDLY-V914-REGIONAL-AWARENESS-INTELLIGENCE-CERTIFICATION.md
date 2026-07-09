# Gridly V914 — Regional Awareness Intelligence Certification

## Executive summary

V914 certifies that Gridly Awareness Intelligence remains consistent across the full 28-county operational region after V913. This is an audit-only milestone: it verifies the existing pipeline of Community → Weather → Transportation → Rail → Story Engine → Evidence Experience → Know Before You Go without adding providers, panels, navigation, or runtime architecture.

The certification adds `window.gridlyRegionalAwarenessIntelligenceCertificationAudit?.()` as a browser-console helper. The helper validates capability and consistency rather than requiring live weather, transportation, or rail events to be active at the moment of testing.

## Scope

- Regional coverage across the 28 operational counties.
- Community-aware county and configured community counts from the V908 completion baseline.
- Story Engine field presence and consumer-safe language.
- Evidence Experience availability and category support.
- Community, Weather, Transportation, and Rail evidence capability checks.
- Multi-evidence, confidence, fail-closed, and mobile portrait certification checks.

## Non-goals

- No new providers.
- No new UI, dashboard, panel, or navigation path.
- No redesign of the runtime architecture.
- No changes to data ingestion or provider activation.
- No expansion of evidence categories beyond the current Community, Weather, Transportation, and Rail model.

## Protected systems confirmation

V914 is read-only certification work. The following protected systems are intentionally unchanged:

- Shared Reports
- Route Watch
- Awareness Filtering
- Hazard Lifecycle
- Alert Generation
- Supabase Sync
- Production Crossing Runtime

The audit returns `protectedSystemsUnchanged: true` and includes a protected-system confirmation object so testers can verify this milestone did not alter those systems.

## Current regional baseline

The regional baseline is inherited from the V908 community coverage completion audit. V914 expects:

- `operationalCountyCount: 28`
- `communityAwareCountyCount: 28`
- configured communities greater than the county count
- V908 safe-for-beta status still passing

This verifies that Awareness Intelligence can start from a consistent community baseline throughout the regional footprint.

## Story Engine certification

The V914 audit confirms the Story Engine is available and still communicates:

- Situation
- Summary
- Recommendation
- Confidence
- Evidence

The check uses current runtime story output plus deterministic capability scenarios so certification is not dependent on a live incident being active.

## Evidence Experience certification

The audit confirms that the Evidence Experience remains connected to Story Engine evidence and that the confidence section is available. It validates consumer-safe wording across generated evidence models and does not require a new surface.

## Community evidence certification

Community evidence is certified with a deterministic community report scenario. The audit verifies that community evidence is available and can appear in the Evidence Experience when meaningful.

## Weather evidence certification

Weather evidence is certified through capability scenarios:

- clear or pleasant weather is safely suppressed
- heavy rain is promoted to story and evidence
- current live weather state is reported separately as capability/current/promoted/suppressed

Quiet live weather does not fail V914.

## Transportation evidence certification

Transportation evidence is certified through capability scenarios:

- routine maintenance and low-value notices are safely suppressed
- a road closure with detour is promoted to story and evidence
- current live transportation state is reported separately as capability/current/promoted/suppressed

Unavailable or quiet live transportation data does not fail V914.

## Rail/crossing evidence certification

Rail evidence is certified with a deterministic crossing-blocked scenario. The audit verifies that rail evidence can participate when meaningful and that absent rail evidence remains safely suppressed.

## Cross-county consistency review

The audit compares operational county count, community-aware county count, configured community count, and V908 completion status. V914 passes regional consistency only when all 28 operational counties remain community-aware.

## Multi-evidence scenario review

The audit builds a deterministic multi-evidence scenario containing community, weather, transportation, and rail signals. Certification passes only when the Story Engine identifies multiple simultaneous conditions and the Evidence Experience includes the expected evidence categories.

## Consumer language review

V914 validates user-facing story and evidence text for consumer language. The audit requires provider names and technical implementation terms to be suppressed.

Forbidden user-facing terms include:

- NOAA
- TxDOT
- FRA
- Supabase
- database
- provider
- API
- normalized
- payload
- schema

## Confidence behavior review

The certification verifies confidence language in both active multi-evidence and quiet/fail-closed scenarios. Confidence must remain understandable to consumers and supported by the evidence model.

## Fail-closed behavior review

V914 confirms that missing or unavailable provider data does not break Know Before You Go. A no-provider-data scenario must still produce a usable quiet story with community evidence and suppressed weather, transportation, and rail evidence.

## Mobile portrait review

V914 does not add layout, panels, dashboards, or navigation. The audit preserves mobile portrait behavior by relying on existing portrait readiness checks when available and otherwise treating the certification as layout-neutral.

## Risks / observations

- Live weather, transportation, and rail data may be quiet during certification; V914 distinguishes capability from current live evidence.
- The helper is intentionally conservative about forbidden terms, so future story or evidence wording should avoid provider names and implementation language.
- V914 depends on V908 regional coverage remaining safe for beta.

## Final recommendation

Run:

```js
window.gridlyRegionalAwarenessIntelligenceCertificationAudit?.()
```

Expected merge posture: proceed if the helper reports `available: true`, `version: "V914"`, `safeForBeta: true`, `protectedSystemsUnchanged: true`, `consumerLanguagePass: true`, `providerNamesSuppressed: true`, `technicalTermsSuppressed: true`, and `failClosedBehaviorPass: true`.
