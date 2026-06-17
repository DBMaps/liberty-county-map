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

  const canaryFlags = {
    active: false,
    captureEnabled: false,
    writesEnabled: false
  };

  function getHistoryCaptureFlags() {
    return {
      ...cloneDefaultFlags(),
      captureEnabled: canaryFlags.captureEnabled === true,
      writesEnabled: canaryFlags.writesEnabled === true,
      canaryMode: canaryFlags.active === true
    };
  }

  function enableHistoricalCanaryFlags() {
    canaryFlags.active = true;
    canaryFlags.captureEnabled = true;
    canaryFlags.writesEnabled = true;
    return getHistoryCaptureFlags();
  }

  function disableHistoricalCanaryWriter() {
    canaryFlags.writesEnabled = false;
    if (canaryFlags.captureEnabled !== true) canaryFlags.active = false;
    return getHistoryCaptureFlags();
  }

  function disableHistoricalCanaryFlags() {
    canaryFlags.writesEnabled = false;
    canaryFlags.captureEnabled = false;
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
