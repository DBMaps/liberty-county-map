# V839 Live Connector Design Readiness

## Milestone Purpose

V839 certifies whether Gridly is ready to design and implement future live connectors for DriveTexas and Weather. This is a design/readiness milestone only: it does not implement live connectors, perform runtime networking, activate providers, activate Unified Intelligence, merge official records, or render official provider records.

Gridly remains **Awareness Platform First** and **Route Intelligence Second**. Future live connectors must strengthen awareness with official transportation and weather evidence while preserving existing consumer systems.

## DriveTexas Connector Readiness

- DriveTexas provider foundation exists and remains dormant.
- DriveTexas official source evaluation exists.
- DriveTexas endpoint validation exists for the official DriveTexas road conditions GeoJSON feed.
- Future DriveTexas connector implementation must keep the provider fail-closed, preserve source tracing, suppress raw payloads from consumer UI, and spatially filter statewide records before normalization.
- V839 does not activate DriveTexas and does not fetch DriveTexas data.

## Weather Connector Readiness

- Weather provider foundation exists and remains dormant.
- Weather official source evaluation exists.
- Weather endpoint validation exists for NWS active alerts API and Atom/CAP-compatible alert paths.
- Future Weather connector implementation must honor NWS cache metadata, include source tracing, suppress raw payloads from consumer UI, and spatially filter alerts by Gridly coverage before normalization.
- V839 does not activate Weather and does not fetch Weather data.

## Shared Connector Rules

Future live connector milestones must satisfy these rules before any runtime activation:

1. Timeout policy: 8000 ms connector timeout.
2. Retry policy: a defined bounded retry policy with jittered backoff for transient failures only.
3. Fail-closed behavior: emit no official records when endpoint, schema, credentials, cache freshness, policy, or spatial validation fails.
4. Raw payload suppression: never expose raw provider payloads to consumer UI.
5. Source tracing: retain provider, endpoint family, source id, source timestamp when present, and retrieval timestamp.
6. Spatial filtering: filter official provider records to Gridly coverage areas before downstream normalization or display eligibility.
7. No consumer rendering during connector implementation milestones unless a later milestone explicitly authorizes rendering.

## Browser Audit

V839 exposes:

```js
window.gridlyLiveConnectorDesignReadinessAudit?.()
```

The audit only inspects existing audit helpers:

- `window.gridlyOfficialProviderSourceAudit?.()`
- `window.gridlyDriveTexasConnectorEndpointAudit?.()`
- `window.gridlyWeatherConnectorEndpointAudit?.()`
- `window.gridlyDriveTexasProviderAudit?.()`
- `window.gridlyWeatherProviderAudit?.()`
- `window.gridlyUnifiedIntelligenceAudit?.()`
- `window.gridlyIntelligenceActivationReadinessAudit?.()`

The audit confirms official source certification, DriveTexas endpoint validation, Weather endpoint validation, dormant providers, dormant Unified Intelligence, no runtime networking, no activation, and no consumer rendering. `designReady` is true only when all prerequisite audits pass.

## Sequencing Recommendation

Recommended live connector sequence:

1. DriveTexas live connector implementation.
2. Weather live connector implementation.
3. Live provider validation.

DriveTexas should go first because it has API-key and statewide spatial-filtering risks that should be resolved before expanding official evidence. Weather should follow with cache-aware NWS alert handling. Live provider validation should remain separate so activation and rendering decisions are evaluated only after both connectors prove fail-closed behavior.

## Operational Risks

- DriveTexas credential provisioning and usage policy review may block activation.
- DriveTexas statewide records require strict spatial filtering to prevent out-of-area evidence from influencing local awareness.
- NWS alert cache metadata and geometry/zone handling require careful implementation to avoid over-polling or over-promoting watches/advisories.
- Schema drift must fail closed for both providers.
- Official records must not bypass Gridly trust, hazard lifecycle, alerts, community reports, Route Watch, Supabase synchronization, notifications, or consumer UI governance.

## Implementation Non-Goals

V839 explicitly does not:

- implement a DriveTexas connector;
- implement a Weather connector;
- call network APIs;
- store API keys;
- activate providers;
- activate Unified Intelligence;
- merge official records;
- render official records;
- modify Alerts, Awareness Brief, Community Pulse, Route Watch, map markers, Trust, Supabase, notifications, reporting, crossing runtime, hazard lifecycle, or background location.

## Design Readiness Certification

Gridly is design-ready for live connector implementation when the V839 audit returns `designReady: true`. Runtime networking, provider activation, Unified Intelligence activation, implementation, official record merging, and consumer rendering remain disallowed until explicit future milestones authorize them.
