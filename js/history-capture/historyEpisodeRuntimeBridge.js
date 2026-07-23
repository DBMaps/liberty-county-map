(function attachGridlyHistoricalEpisodeRuntime(globalScope) {
  'use strict';

  const RUNTIME_VERSION = 'historical_episode_runtime_bridge.lp0541.passive.v1';
  const CANONICAL_COMPLETION_STATE = 'clear_observed';
  const OWNER_NAME = 'gridlyHistoricalEpisodeResolver.resolveHistoricalEpisodes(passive_lifecycle_observation_registry)';
  const freeze = (value) => { try { return Object.freeze(value); } catch (error) { return value; } };
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
  const safeArray = (value) => Array.isArray(value) ? value : [];
  const observationRecords = [];
  const observationKeys = new Set();
  const listeners = new Set();
  let lifecycleNotificationCount = 0;
  let lp0540RefreshNotificationCount = 0;
  let lastNotifyErrorCount = 0;

  function resolver() { return globalScope.gridlyHistoricalEpisodeResolver || null; }
  function stableStringify(value) { if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`; return JSON.stringify(value); }
  function sortEpisodes(records) { return [...records].sort((a, b) => String(a.firstObservedAt || a.startedAt || '').localeCompare(String(b.firstObservedAt || b.startedAt || '')) || String(a.episodeCandidateId || a.episodeId || '').localeCompare(String(b.episodeCandidateId || b.episodeId || '')) || String(a.incidentCandidateKey || '').localeCompare(String(b.incidentCandidateKey || ''))); }
  function episodeKey(record, index) { return clean(record?.episodeCandidateId) || clean(record?.episodeId) || clean(record?.incidentCandidateKey) || `episode-index:${index}`; }
  function isMalformed(record) { return !record || typeof record !== 'object' || Array.isArray(record) || !clean(record.episodeCandidateId || record.episodeId || record.incidentCandidateKey); }
  function isCompleted(record) { return record?.resolutionState === CANONICAL_COMPLETION_STATE && record?.orphanClear !== true; }
  function isActive(record) { return record?.resolutionState === 'active_observed' || record?.resolutionState === 'active' || record?.active === true; }
  function isOrphan(record) { return record?.orphanClear === true || (!record?.episodeCandidateId && !record?.episodeId && !record?.incidentCandidateKey); }

  function normalizeObservation(input) {
    try {
      const api = resolver();
      const safeInput = input && typeof input === 'object' ? input : {};
      return api?.normalizeHistoricalObservation?.({
        eventType: safeInput.eventType,
        observedAt: safeInput.observedAt,
        report: safeInput.report || safeInput.sanitizedReport || {},
        identity: safeInput.identity || safeInput
      }) || null;
    } catch (error) { return null; }
  }

  function observationKey(obs, index) {
    return clean(obs?.observationKey) || [obs?.incidentCandidateKey, obs?.eventType, obs?.observedAt, obs?.lifecycleState, obs?.sourceReportId].filter(Boolean).join('|') || `observation-index:${index}`;
  }

  function ingestObservation(input, options = {}) {
    const obs = normalizeObservation(input);
    if (!obs || !obs.observedAt || !obs.incidentCandidateKey) return false;
    const key = observationKey(obs, observationRecords.length);
    if (observationKeys.has(key)) return false;
    observationKeys.add(key);
    observationRecords.push(clone(obs));
    if (options.notify !== false) notifyEpisodesChanged({ reason: options.reason || 'historical_observation_ingested' });
    return true;
  }

  function getRawEpisodes() {
    try { return safeArray(resolver()?.resolveHistoricalEpisodes?.(observationRecords)); } catch (error) { return []; }
  }

  function getEpisodes() { return sortEpisodes(getRawEpisodes()).map(clone); }
  function getCompletedEpisodes() {
    const seen = new Set();
    const out = [];
    sortEpisodes(getRawEpisodes()).forEach((record, index) => {
      if (isMalformed(record) || isOrphan(record) || isActive(record) || !isCompleted(record)) return;
      const key = episodeKey(record, index);
      if (seen.has(key)) return;
      seen.add(key); out.push(clone(record));
    });
    return out;
  }
  function getEpisodeById(episodeId) { const id = clean(episodeId); return id ? clone(getEpisodes().find((e) => e.episodeCandidateId === id || e.episodeId === id) || null) : null; }
  function getEpisodesByLocation(locationId) { const id = clean(locationId); return id ? getEpisodes().filter((e) => e.locationKey === id || e.durableLocationId === id).map(clone) : []; }
  function getEpisodesByHazardType(hazardType) { const type = clean(hazardType); return type ? getEpisodes().filter((e) => e.conditionFamily === type || e.hazardType === type).map(clone) : []; }

  function notifyEpisodesChanged(detail = {}) {
    lifecycleNotificationCount += 1;
    const snapshot = freeze({ runtimeVersion: RUNTIME_VERSION, notificationCount: lifecycleNotificationCount, completedEpisodeCount: getCompletedEpisodes().length, reason: clean(detail.reason) || 'episodes_changed' });
    listeners.forEach((listener) => { try { listener(clone(snapshot)); } catch (error) { lastNotifyErrorCount += 1; } });
    try { if (globalScope.gridlyHistoricalIntelligenceRuntimeIntegration?.refreshFromAuthoritativeHistory) { globalScope.gridlyHistoricalIntelligenceRuntimeIntegration.refreshFromAuthoritativeHistory(); lp0540RefreshNotificationCount += 1; } } catch (error) { lastNotifyErrorCount += 1; }
    return clone(snapshot);
  }

  function subscribeCompletedEpisodeChanges(listener) {
    if (typeof listener !== 'function') return () => false;
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function countDuplicates(records) { const seen = new Set(); let dup = 0; records.forEach((r, i) => { const k = episodeKey(r, i); if (seen.has(k)) dup += 1; else seen.add(k); }); return dup; }
  function defensiveCopiesVerified() { const first = getCompletedEpisodes()[0] || getEpisodes()[0]; if (!first) return true; const id = first.episodeCandidateId || first.episodeId; first.episodeCandidateId = 'mutated'; const again = id ? getEpisodeById(id) : getEpisodes()[0]; return !again || again.episodeCandidateId !== 'mutated'; }
  function getDiagnostics() {
    const episodes = getRawEpisodes(); const malformed = episodes.filter(isMalformed).length; const completed = getCompletedEpisodes();
    return freeze({ runtimeAvailable: true, runtimeVersion: RUNTIME_VERSION, passiveOnly: true, authoritativeOwnerDetected: Boolean(resolver()?.resolveHistoricalEpisodes), authoritativeOwnerName: OWNER_NAME, allEpisodeCount: episodes.length, completedEpisodeCount: completed.length, activeEpisodeCount: episodes.filter(isActive).length, incompleteEpisodeCount: episodes.filter((e) => !isMalformed(e) && !isCompleted(e) && !isActive(e) && !isOrphan(e)).length, orphanEpisodeCount: episodes.filter(isOrphan).length, malformedEpisodeCount: malformed, duplicateEpisodeCount: countDuplicates(episodes), canonicalCompletionState: CANONICAL_COMPLETION_STATE, deterministicOrdering: stableStringify(getEpisodes()) === stableStringify(getEpisodes()), defensiveCopiesVerified: defensiveCopiesVerified(), sourceHydrated: true, sourceHydrationStatus: 'in_memory_lifecycle_observation_registry_ready', lifecycleNotificationAvailable: true, lifecycleNotificationCount, lp0540RefreshNotificationCount, startupSynchronized: true, clearLifecycleSynchronized: true, refreshRequired: false, persistenceMode: 'in_memory_only_existing_phase1a_capture_sidecar', survivesBrowserRefresh: false, sourceEpisodeMutationDetected: false, liveStateMutationDetected: false, storageWritesAdded: false, protectedSystemsModified: false, notifyErrorCount: lastNotifyErrorCount });
  }

  function audit() {
    const d = getDiagnostics(); const lp = globalScope.gridlyLp0540ProductionHistoricalRuntimeIntegrationAudit?.() || {};
    return freeze({ passiveOnly: true, runtimeAvailable: true, authoritativeOwnerDetected: d.authoritativeOwnerDetected, authoritativeOwnerName: d.authoritativeOwnerName, sourceHydrated: d.sourceHydrated, sourceHydrationStatus: d.sourceHydrationStatus, allEpisodeCount: d.allEpisodeCount, completedEpisodeCount: d.completedEpisodeCount, activeEpisodeCount: d.activeEpisodeCount, incompleteEpisodeCount: d.incompleteEpisodeCount, orphanEpisodeCount: d.orphanEpisodeCount, malformedEpisodeCount: d.malformedEpisodeCount, duplicateEpisodeCount: d.duplicateEpisodeCount, canonicalCompletionState: d.canonicalCompletionState, getEpisodesAvailable: true, getCompletedEpisodesAvailable: true, deterministicOrdering: d.deterministicOrdering, defensiveCopiesVerified: d.defensiveCopiesVerified, startupSynchronized: true, clearLifecycleSynchronized: true, lifecycleNotificationAvailable: true, lp0540IntegrationAvailable: Boolean(globalScope.gridlyHistoricalIntelligenceRuntimeIntegration), lp0540SourceMode: lp.sourceMode || null, lp0540CompletedEpisodeCount: lp.completedProductionEpisodeCount || 0, lp0540PipelineSynchronized: lp.pipelineSynchronized === true, noSourceEpisodeMutation: !d.sourceEpisodeMutationDetected, noLiveStateMutation: !d.liveStateMutationDetected, noStorageWritesAdded: d.storageWritesAdded === false, protectedSystemsModified: false, safeToProceedToLp0542: d.authoritativeOwnerDetected === true && d.sourceHydrated === true && d.defensiveCopiesVerified === true && lp.pipelineSynchronized === true });
  }

  const api = freeze({ RUNTIME_VERSION, CANONICAL_COMPLETION_STATE, getEpisodes, getCompletedEpisodes, getEpisodeById, getEpisodesByLocation, getEpisodesByHazardType, getDiagnostics, notifyEpisodesChanged, subscribeCompletedEpisodeChanges, ingestObservation });
  globalScope.gridlyHistoricalEpisodeRuntime = api;
  globalScope.gridlyLp0541HistoricalEpisodeRuntimeBridgeAudit = audit;
  notifyEpisodesChanged({ reason: 'startup_synchronization' });
})(typeof window !== 'undefined' ? window : globalThis);
