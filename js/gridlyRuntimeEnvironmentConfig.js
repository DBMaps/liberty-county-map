(function () {
  "use strict";

  // Protected artifact composition replaces this file. The tracked browser
  // runtime always retains the governed same-origin geometry transport.
  window.GRIDLY_RUNTIME_CONFIG = Object.freeze({
    // Fail closed: only the exact string "ENABLED" activates production POI.
    poiBrowserProvider: Object.freeze({ enabled: "DISABLED" }),
    authoritativeCountyGeometry: Object.freeze({
      mode: "LOCAL_CANONICAL",
      url: "assets/location-resolution/gridly-authoritative-county-geometry-v1.json",
      expectedBytes: 47911048,
      expectedSha256: "891652f2e63459451ef10e0b723bcf90378dc22a275945978cd73aa8d8e40316",
      expectedCountyCount: 254
    })
  });
})();
