(function installGridlyAwarenessResolutionTurnCache() {
  "use strict";

  const original = window.resolveGridlyAwarenessArea;
  if (typeof original !== "function" || original.__gridlyTurnCached === true) return;

  const state = {
    installed: true,
    builds: 0,
    turnCacheHits: 0,
    reentrantBypasses: 0,
    clears: 0,
    cacheEntries: 0
  };

  const cache = new Map();
  let resolving = false;
  let clearScheduled = false;

  function stableKey(args) {
    return Array.from(args).map((value) => {
      if (value == null) return "";
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return `${typeof value}:${String(value)}`;
      }
      if (typeof value === "object") {
        return `object:${String(value.key || value.id || value.storageValue || value.label || value.name || "")}`;
      }
      return `${typeof value}:${String(value)}`;
    }).join("|");
  }

  function scheduleClear() {
    if (clearScheduled) return;
    clearScheduled = true;
    setTimeout(() => {
      cache.clear();
      state.cacheEntries = 0;
      state.clears += 1;
      clearScheduled = false;
    }, 0);
  }

  function resolveGridlyAwarenessAreaTurnCached() {
    const key = stableKey(arguments);
    if (cache.has(key)) {
      state.turnCacheHits += 1;
      return cache.get(key);
    }

    if (resolving) {
      state.reentrantBypasses += 1;
      return null;
    }

    resolving = true;
    try {
      const result = original.apply(this, arguments);
      cache.set(key, result);
      state.builds += 1;
      state.cacheEntries = cache.size;
      scheduleClear();
      return result;
    } finally {
      resolving = false;
    }
  }

  resolveGridlyAwarenessAreaTurnCached.__gridlyTurnCached = true;
  resolveGridlyAwarenessAreaTurnCached.__gridlyOriginal = original;
  window.resolveGridlyAwarenessArea = resolveGridlyAwarenessAreaTurnCached;

  window.gridlyAwarenessResolutionTurnCacheAudit = function () {
    return {
      available: true,
      ...state
    };
  };
})();
