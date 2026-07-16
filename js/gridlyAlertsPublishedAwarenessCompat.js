/* Gridly Alerts published-awareness compatibility helpers. */
(function installGridlyAlertsPublishedAwarenessCompat(globalScope) {
  "use strict";

  if (typeof globalScope.cleanDisplayValue !== "function") {
    globalScope.cleanDisplayValue = function cleanDisplayValue(value) {
      return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    };
  }
})(window);
