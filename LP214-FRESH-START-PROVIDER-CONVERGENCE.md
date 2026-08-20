# LP214 fresh-start provider convergence

The failed Austin-first InPrivate control is classified as `LOCAL_OWNER_CONFIGURATION_BOOTSTRAP_DEPENDENCY`. Canonical focus succeeded; the first failed stage was configuration resolution. The private context did not contain the `gridlyLocal` local-storage opt-in, so `js/gridly.local.js` was intentionally not loaded and DriveTexas correctly reported `SOURCE_FAILED_NO_RETAINED_DATA`. Production can inject tracked or externally managed configuration independently; no secret is persisted by this bootstrap.

The previous `liberty-county` identity is the application bootstrap default declared before canonical selection, not evidence of browser persistence. It is allowed only as transition history and must be replaced by the selected canonical identity before current-area publication. `sameSummaryReference: false` and Location Context `CERTIFICATION_INDETERMINATE` are downstream, truthful consequences of unavailable provider evidence; neither is forced to pass.

Startup now explicitly waits for configuration bootstrap completion before activation. A later `gridly:configuration-ready` signal reuses the connector refresh lifecycle, without polling or arbitrary delay. Activation, configuration, connection, fetch success, and normalized-data availability remain separate states.

## Safe owner diagnostic

Run this read-only block after selecting the community. It never reads or prints an API-key value:

```js
(() => {
  const activation = window.gridlyOfficialProviderActivation?.audit?.() || {};
  const connector = window.gridlyDriveTexasConnectorRuntimeAudit?.() || {};
  const source = window.gridlyGetDriveTexasConsumerSourceStatusEnvelope?.() || {};
  const authority = window.gridlyGetDriveTexasAuthoritySnapshot?.() || {};
  const shared = window.gridlySharedActiveIssueContract?.audit?.() || window.gridlySharedActiveIssueContractAudit?.() || {};
  const selected = window.getGridlySelectedAwarenessArea?.() || {};
  console.table({ canonicalKey: selected.canonicalKey || selected.key || null, apiKeyConfigured: connector.apiKeyConfigured === true, configurationSource: connector.configurationSource || "none", providerRegistered: Boolean(window.gridlyDriveTexasProvider), providerActivated: connector.providerActivated === true, providerConnected: connector.connected === true, connectorPolling: connector.automaticPolling === true, initialFetchAttempted: connector.initialFetchAttempted === true, lastSuccessfulAt: connector.lastSuccessfulAt || null, statewideRecordCount: connector.retainedRecordCount ?? 0, geographicEvaluationState: authority.authority?.geographicEvaluationState || source.geographicEvaluationState || null, sourceStatus: source.sourceStatus || null, authorityInputCount: authority.authority?.inputCount ?? null, authorityEligibleCount: authority.authority?.eligibleCount ?? null, countConverged: source.countConverged ?? null, sameSummaryReference: shared.sameSummaryReference ?? null, locationContextCertification: shared.locationContextCertification || null, previousAreaIdentity: shared.previousAreaIdentity || null, activationStage: activation.stages?.providerActivation?.reason || null });
})();
```

## Owner InPrivate retest

1. Open a new InPrivate window at the local application URL with `?gridlyLocal=true` (the query contains no secret).
2. Confirm only that `apiKeyConfigured` is `true` and `configurationSource` names an approved source; never print the value.
3. Select Austin first and wait for `initialFetchAttempted: true` and a governed final source state.
4. Accept either `HEALTHY_WITH_DATA` or `HEALTHY_EMPTY`; do not accept `SOURCE_FAILED_NO_RETAINED_DATA`.
5. Confirm the canonical key, available geographic evaluation, count convergence, shared summary reference, and Location Context certification with the diagnostic above.

This repository certifies the shared state machine procedurally for all 1,859 communities. It does not claim 1,859 live network executions. LP214 DriveTexas remains open until the owner reruns this genuine configured InPrivate control successfully; Weather/NWS and LP215 must not begin.
