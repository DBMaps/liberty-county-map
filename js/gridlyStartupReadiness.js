(function initGridlyStartupReadiness(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GRIDLY_STARTUP_READINESS = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGridlyStartupReadiness() {
  "use strict";

  function startSecondary(work, onReady, onUnavailable) {
    let result;
    try {
      result = typeof work === "function" ? work() : work;
    } catch (error) {
      result = Promise.reject(error);
    }
    const readiness = Promise.resolve(result);
    readiness.then(
      (value) => { if (typeof onReady === "function") onReady(value); },
      (error) => { if (typeof onUnavailable === "function") onUnavailable(error); }
    );
    // Returning, rather than awaiting, the governed dependency is the contract:
    // callers may observe readiness without putting it on the core shell path.
    return readiness;
  }

  return { startSecondary };
});
