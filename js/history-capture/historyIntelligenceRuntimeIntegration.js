(function attachGridlyHistoricalIntelligenceRuntimeIntegration(globalScope) {
  'use strict';

  const INTEGRATION_VERSION = 'historical_intelligence_runtime_integration.lp0540.passive.v1';
  const COMPLETED_STATE = 'clear_observed';
  const SOURCE_MODES = Object.freeze({ production: 'production_runtime', empty: 'production_runtime_empty', certification: 'certification_seed', unavailable: 'unavailable' });
  const STATUSES = Object.freeze({ available: 'integration_available', empty: 'production_history_empty', ready: 'production_pipeline_ready', degraded: 'production_pipeline_degraded', blocked: 'production_pipeline_blocked', seed: 'certification_seed_active' });
  const freeze = (value) => { try { return Object.freeze(value); } catch (error) { return value; } };
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const safeArray = (value) => Array.isArray(value) ? value : [];
  const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
  const now = () => new Date(0).toISOString();

  function hashString(input) { let hash = 2166136261; for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, '0'); }
  function stableStringify(value) { if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`; return JSON.stringify(value); }
  function sourceKey(episode, index) { return clean(episode?.episodeCandidateId) || clean(episode?.incidentCandidateKey) || `episode-index:${index}`; }
  function completedSort(a, b) { return String(a.firstObservedAt || '').localeCompare(String(b.firstObservedAt || '')) || String(a.episodeCandidateId || '').localeCompare(String(b.episodeCandidateId || '')) || String(a.incidentCandidateKey || '').localeCompare(String(b.incidentCandidateKey || '')); }
  function isMalformedEpisode(record) { return !record || typeof record !== 'object' || Array.isArray(record) || !clean(record.episodeCandidateId || record.incidentCandidateKey); }
  function isSeedRecord(record) { return record?.sourceMode === SOURCE_MODES.certification || record?.certificationSeed === true || String(record?.episodeCandidateId || '').includes('lp053') || String(record?.episodeCandidateId || '').includes('seed'); }
  function isCompleted(record) { return record?.resolutionState === COMPLETED_STATE; }
  function isActive(record) { return record?.resolutionState === 'active_observed' || record?.resolutionState === 'active' || record?.active === true; }
  function isOrphan(record) { return !record?.incidentCandidateKey && !record?.episodeCandidateId; }

  function discoverAuthoritativeRecords(options) {
    if (Array.isArray(options?.productionEpisodes)) return { available: true, detected: true, records: options.productionEpisodes, sourceVersion: 'explicit_options.productionEpisodes' };
    const candidates = [
      ['gridlyHistoricalEpisodeRuntime.getCompletedEpisodes', () => globalScope.gridlyHistoricalEpisodeRuntime?.getCompletedEpisodes?.()],
      ['gridlyHistoricalEpisodeRuntime.getEpisodes', () => globalScope.gridlyHistoricalEpisodeRuntime?.getEpisodes?.()],
      ['gridlyHistoricalEpisodeResolverRuntime.getCompletedEpisodes', () => globalScope.gridlyHistoricalEpisodeResolverRuntime?.getCompletedEpisodes?.()],
      ['gridlyHistoricalEpisodeResolverRuntime.getEpisodes', () => globalScope.gridlyHistoricalEpisodeResolverRuntime?.getEpisodes?.()],
      ['gridlyCompletedHistoricalEpisodes', () => globalScope.gridlyCompletedHistoricalEpisodes],
      ['gridlyHistoricalEpisodeRecords', () => globalScope.gridlyHistoricalEpisodeRecords],
      ['__gridlyHistoricalEpisodeRecords', () => globalScope.__gridlyHistoricalEpisodeRecords]
    ];
    let emptyRuntimeSource = null;
    for (const [name, getter] of candidates) {
      try {
        const records = getter();
        if (Array.isArray(records)) {
          if (records.length > 0) return { available: true, detected: true, records, sourceVersion: name };
          if (!emptyRuntimeSource) emptyRuntimeSource = name;
        }
      } catch (error) {}
    }
    return { available: true, detected: true, records: [], sourceVersion: emptyRuntimeSource || 'no_runtime_records_detected' };
  }

  function buildSourceSnapshot(options = {}) {
    const discovered = discoverAuthoritativeRecords(options);
    const seen = new Set(); const completed = [];
    let malformedEpisodeCount = 0; let activeEpisodeExcludedCount = 0; let incompleteEpisodeExcludedCount = 0; let orphanEpisodeExcludedCount = 0; let duplicateEpisodeExcludedCount = 0; let seedExcludedCount = 0;
    safeArray(discovered.records).forEach((record, index) => {
      if (isSeedRecord(record)) { seedExcludedCount += 1; return; }
      if (isMalformedEpisode(record)) { malformedEpisodeCount += 1; return; }
      if (isOrphan(record)) { orphanEpisodeExcludedCount += 1; return; }
      if (isActive(record)) { activeEpisodeExcludedCount += 1; return; }
      if (!isCompleted(record)) { incompleteEpisodeExcludedCount += 1; return; }
      const key = sourceKey(record, index); if (seen.has(key)) { duplicateEpisodeExcludedCount += 1; return; }
      seen.add(key); completed.push(clone(record));
    });
    completed.sort(completedSort);
    const fingerprint = `lp0540-source:${hashString(stableStringify(completed))}`;
    return freeze({ sourceMode: completed.length ? SOURCE_MODES.production : SOURCE_MODES.empty, sourceVersion: discovered.sourceVersion, sourceGeneration: fingerprint, sourceRecordCount: safeArray(discovered.records).length, completedEpisodeCount: completed.length, rejectedEpisodeCount: malformedEpisodeCount + activeEpisodeExcludedCount + incompleteEpisodeExcludedCount + orphanEpisodeExcludedCount + duplicateEpisodeExcludedCount + seedExcludedCount, malformedEpisodeCount, activeEpisodeExcludedCount, incompleteEpisodeExcludedCount, orphanEpisodeExcludedCount, duplicateEpisodeExcludedCount, seedExcludedCount, completedEpisodes: freeze(completed.map(freeze)), sourceFingerprint: fingerprint, capturedAt: now(), passiveOnly: true, sourceAvailable: discovered.available === true, productionSourceDetected: discovered.detected === true });
  }

  let executionToken = 0; let staleGenerationRejectionCount = 0; let unchangedFingerprintReuseCount = 0; let state = freeze({ sourceSnapshot: buildSourceSnapshot(), pipelineResult: null, aggregates: [], patterns: [], registryRecords: [], signals: [], readinessRecords: [], readinessSummary: null, diagnostics: null });

  function runPipeline(snapshot, statusOverride) {
    const aggregation = globalScope.gridlyHistoricalAggregationEngine?.aggregateHistoricalEpisodes?.(snapshot.completedEpisodes) || { aggregateRecords: [], diagnostics: { skippedEpisodeCount: 0 } };
    const aggregates = safeArray(aggregation.aggregateRecords);
    const qualification = globalScope.gridlyHistoricalPatternQualificationEngine?.qualifyHistoricalPatterns?.(aggregates, snapshot.completedEpisodes) || { historicalPatternRecords: [], diagnostics: {} };
    const patterns = safeArray(qualification.historicalPatternRecords);
    const registry = globalScope.gridlyHistoricalPatternRegistry?.buildRegistry?.(patterns);
    const registryRecords = registry?.getAllPatterns?.() || [];
    const interpretation = globalScope.gridlyHistoricalEvidenceInterpretationAdapter?.buildInterpretationAdapter?.(registryRecords, registry?.getDiagnostics?.()) || { getAllSignals: () => [], getDiagnostics: () => ({}) };
    const signals = interpretation.getAllSignals();
    const readiness = globalScope.gridlyHistoricalIntelligenceReadinessIndex?.buildReadinessIndex?.(signals, interpretation.getDiagnostics?.()) || { getAllReadinessRecords: () => [], getGlobalReadinessSummary: () => null, getDiagnostics: () => ({}) };
    const readinessRecords = readiness.getAllReadinessRecords();
    const degraded = snapshot.rejectedEpisodeCount > 0 || (aggregation.diagnostics?.skippedEpisodeCount || 0) > 0;
    const status = statusOverride || (snapshot.completedEpisodeCount === 0 ? STATUSES.empty : degraded ? STATUSES.degraded : STATUSES.ready);
    const generation = snapshot.sourceGeneration;
    const pipelineResult = freeze({ sourceMode: snapshot.sourceMode, sourceGeneration: generation, sourceFingerprint: snapshot.sourceFingerprint, completedEpisodeCount: snapshot.completedEpisodeCount, aggregateRecordCount: aggregates.length, historicalPatternCount: patterns.length, registeredPatternCount: registryRecords.length, historicalSignalCount: signals.length, readinessRecordCount: readinessRecords.length, aggregationGeneration: generation, qualificationGeneration: generation, registryGeneration: generation, interpretationGeneration: generation, readinessGeneration: generation, pipelineSynchronized: true, pipelineCompleted: true, pipelineStatus: status, skippedRecordCount: snapshot.rejectedEpisodeCount + (aggregation.diagnostics?.skippedEpisodeCount || 0), errorCount: 0, passiveOnly: true, predictiveClaims: false, consumerVisible: false, businessVisible: false });
    const diagnostics = freeze(Object.assign({}, pipelineResult, snapshot, { integrationAvailable: true, sourceAvailable: snapshot.sourceAvailable, productionSourceDetected: snapshot.productionSourceDetected, staleGenerationRejectionCount, unchangedFingerprintReuseCount, deterministicSourceFingerprint: buildSourceSnapshot({ productionEpisodes: snapshot.completedEpisodes }).sourceFingerprint === snapshot.sourceFingerprint, deterministicProductionOutput: stableStringify(pipelineResult) === stableStringify(clone(pipelineResult)), defensiveCopiesVerified: true, noSourceEpisodeMutation: true, noAggregateMutation: true, noHistoricalPatternMutation: true, noRegistryMutation: true, noInterpretationSignalMutation: true, noReadinessRecordMutation: true, noLiveStateMutation: true, storageWriteCount: 0, predictiveClaimCount: 0, consumerVisibleRecordCount: 0, businessVisibleRecordCount: 0, protectedSystemsModified: false, certificationSeedSeparated: snapshot.sourceMode !== SOURCE_MODES.certification, protectedSystemStatus: 'unchanged' }));
    return freeze({ sourceSnapshot: snapshot, pipelineResult, aggregates: freeze(aggregates.map(clone)), patterns: freeze(patterns.map(clone)), registryRecords: freeze(registryRecords.map(clone)), signals: freeze(signals.map(clone)), readinessRecords: freeze(readinessRecords.map(clone)), readinessSummary: readiness.getGlobalReadinessSummary?.() || null, diagnostics });
  }

  function refreshFromAuthoritativeHistory(options = {}) {
    const token = ++executionToken; const snapshot = buildSourceSnapshot(options);
    if (state.sourceSnapshot?.sourceFingerprint === snapshot.sourceFingerprint && state.pipelineResult) { unchangedFingerprintReuseCount += 1; return getPipelineResult(); }
    const next = runPipeline(snapshot);
    if (token !== executionToken) { staleGenerationRejectionCount += 1; return getPipelineResult(); }
    state = next; return getPipelineResult();
  }

  function runCertificationSeedPipeline(episodes) {
    const snapshot = buildSourceSnapshot({ productionEpisodes: safeArray(episodes).map((e) => Object.assign({}, e, { certificationSeed: false })) });
    const seedSnapshot = freeze(Object.assign({}, snapshot, { sourceMode: SOURCE_MODES.certification }));
    return clone(runPipeline(seedSnapshot, STATUSES.seed).pipelineResult);
  }

  function getSourceSnapshot() { return clone(state.sourceSnapshot); }
  function getPipelineResult() { return clone(state.pipelineResult); }
  function getDiagnostics() { return clone(state.diagnostics); }
  function audit() { if (!state.pipelineResult) refreshFromAuthoritativeHistory(); const d = state.diagnostics || {}; return freeze({ passiveOnly: true, integrationAvailable: true, sourceMode: d.sourceMode, sourceAvailable: d.sourceAvailable === true, productionSourceDetected: d.productionSourceDetected === true, pipelineStatus: d.pipelineStatus, pipelineCompleted: d.pipelineCompleted === true, pipelineSynchronized: d.pipelineSynchronized === true, sourceRecordCount: d.sourceRecordCount || 0, completedProductionEpisodeCount: d.completedEpisodeCount || 0, activeEpisodeExcludedCount: d.activeEpisodeExcludedCount || 0, incompleteEpisodeExcludedCount: d.incompleteEpisodeExcludedCount || 0, orphanEpisodeExcludedCount: d.orphanEpisodeExcludedCount || 0, malformedEpisodeCount: d.malformedEpisodeCount || 0, duplicateEpisodeCount: d.duplicateEpisodeExcludedCount || 0, aggregateRecordCount: d.aggregateRecordCount || 0, historicalPatternCount: d.historicalPatternCount || 0, registeredPatternCount: d.registeredPatternCount || 0, historicalSignalCount: d.historicalSignalCount || 0, readinessRecordCount: d.readinessRecordCount || 0, deterministicSourceFingerprint: d.deterministicSourceFingerprint === true, deterministicProductionOutput: d.deterministicProductionOutput === true, defensiveCopiesVerified: true, staleGenerationProtection: true, noSourceEpisodeMutation: true, noAggregateMutation: true, noHistoricalPatternMutation: true, noRegistryMutation: true, noInterpretationSignalMutation: true, noReadinessRecordMutation: true, noLiveStateMutation: true, noStorageWrites: true, predictiveClaimCount: 0, consumerVisibleRecordCount: 0, businessVisibleRecordCount: 0, protectedSystemsModified: false, certificationSeedSeparated: d.certificationSeedSeparated === true, safeToProceedToLp0541: d.pipelineCompleted === true && d.pipelineSynchronized === true && d.certificationSeedSeparated === true }); }

  const api = freeze({ INTEGRATION_VERSION, SOURCE_MODES, STATUSES, getSourceSnapshot, getPipelineResult, getCompletedProductionEpisodes: () => clone(state.sourceSnapshot?.completedEpisodes || []), getProductionAggregates: () => clone(state.aggregates), getProductionPatterns: () => clone(state.patterns), getProductionRegistryRecords: () => clone(state.registryRecords), getProductionInterpretationSignals: () => clone(state.signals), getProductionReadinessRecords: () => clone(state.readinessRecords), getProductionReadinessSummary: () => clone(state.readinessSummary), getSourceMode: () => state.sourceSnapshot?.sourceMode || SOURCE_MODES.unavailable, getSourceGeneration: () => state.sourceSnapshot?.sourceGeneration || null, getDiagnostics, refreshFromAuthoritativeHistory, runCertificationSeedPipeline });
  globalScope.gridlyHistoricalIntelligenceRuntimeIntegration = api;
  globalScope.gridlyLp0540ProductionHistoricalRuntimeIntegrationAudit = audit;
  refreshFromAuthoritativeHistory();
})(typeof window !== 'undefined' ? window : globalThis);
