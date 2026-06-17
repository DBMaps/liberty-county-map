(function attachHistoryCaptureFlags(globalScope) {
  'use strict';

  const DEFAULT_FLAGS = Object.freeze({
    captureEnabled: false,
    writesEnabled: false,
    productionHooksInstalled: false,
    historicalReadsExposed: false,
    uiExposed: false
  });

  function cloneDefaultFlags() {
    return {
      captureEnabled: DEFAULT_FLAGS.captureEnabled,
      writesEnabled: DEFAULT_FLAGS.writesEnabled,
      productionHooksInstalled: DEFAULT_FLAGS.productionHooksInstalled,
      historicalReadsExposed: DEFAULT_FLAGS.historicalReadsExposed,
      uiExposed: DEFAULT_FLAGS.uiExposed
    };
  }

  function getHistoryCaptureFlags() {
    return cloneDefaultFlags();
  }

  const api = Object.freeze({
    DEFAULT_FLAGS,
    getHistoryCaptureFlags
  });

  globalScope.gridlyPassiveHistoryCaptureFlags = api;
})(typeof window !== 'undefined' ? window : globalThis);
