(function attachHistoryCaptureFlags(globalScope) {
  'use strict';

  const DEFAULT_FLAGS = Object.freeze({
    captureEnabled: true,
    writesEnabled: true,
    productionHooksInstalled: true,
    historicalReadsExposed: false,
    uiExposed: false,
    passiveEvidenceCollectionMode: true
  });

  function cloneDefaultFlags() {
    return {
      captureEnabled: DEFAULT_FLAGS.captureEnabled,
      writesEnabled: DEFAULT_FLAGS.writesEnabled,
      productionHooksInstalled: DEFAULT_FLAGS.productionHooksInstalled,
      historicalReadsExposed: DEFAULT_FLAGS.historicalReadsExposed,
      uiExposed: DEFAULT_FLAGS.uiExposed,
      passiveEvidenceCollectionMode: DEFAULT_FLAGS.passiveEvidenceCollectionMode
    };
  }

  const canaryFlags = {
    active: false
  };

  function getHistoryCaptureFlags() {
    return {
      ...cloneDefaultFlags(),
      canaryMode: canaryFlags.active === true
    };
  }

  function enableHistoricalCanaryFlags() {
    canaryFlags.active = true;
    return getHistoryCaptureFlags();
  }

  function disableHistoricalCanaryWriter() {
    canaryFlags.active = false;
    return getHistoryCaptureFlags();
  }

  function disableHistoricalCanaryFlags() {
    canaryFlags.active = false;
    return getHistoryCaptureFlags();
  }

  const api = Object.freeze({
    DEFAULT_FLAGS,
    disableHistoricalCanaryFlags,
    disableHistoricalCanaryWriter,
    enableHistoricalCanaryFlags,
    getHistoryCaptureFlags
  });

  globalScope.gridlyPassiveHistoryCaptureFlags = api;
})(typeof window !== 'undefined' ? window : globalThis);
