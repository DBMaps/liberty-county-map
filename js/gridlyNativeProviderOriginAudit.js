(function (globalScope) {
  "use strict";

  const exists = async (path) => {
    try {
      const response = await fetch(path, { method: "GET", cache: "no-store" });
      return response.ok ? "present" : `http_${response.status}`;
    } catch {
      return "unreachable";
    }
  };

  globalScope.gridlyNativeProviderOriginAudit = async function gridlyNativeProviderOriginAudit() {
    const config = globalScope.GRIDLY_CONFIG || {};
    const runtime = globalScope.GRIDLY_RUNTIME_CONFIG || {};
    const driveTexasFamily = typeof config.driveTexas?.apiKey === "string" && config.driveTexas.apiKey.trim()
      ? "driveTexas"
      : typeof config.txdot?.apiKey === "string" && config.txdot.apiKey.trim()
        ? "txdot"
        : typeof globalScope.GRIDLY_TXDOT_API_KEY === "string" && globalScope.GRIDLY_TXDOT_API_KEY.trim()
          ? "legacy global"
          : "none";
    let nwsEndpointReachability = "unreachable";
    try {
      const response = await fetch("https://api.weather.gov/alerts/active?area=TX", { headers: { Accept: "application/geo+json" } });
      nwsEndpointReachability = response.ok ? "reachable" : `http_${response.status}`;
    } catch {}
    const capacitorPlatform = globalScope.Capacitor?.getPlatform?.() || "web-or-unavailable";
    const computedRootFontSize = globalScope.getComputedStyle(document.documentElement).fontSize;
    const computedRootFontSizePx = Number.parseFloat(computedRootFontSize);
    const nativeTypographyAuthority = capacitorPlatform === "android"
      ? "android_webview_text_zoom_100"
      : "not_android_native";
    const result = Object.freeze({
      capacitorPlatform,
      documentLocationHref: document.location.href,
      documentLocationOrigin: document.location.origin,
      documentLocationProtocol: document.location.protocol,
      documentLocationHostname: document.location.hostname,
      navigatorUserAgent: navigator.userAgent,
      documentReferrer: document.referrer,
      viewportWidth: globalScope.innerWidth,
      computedRootFontSize,
      nativeTypographyAuthority,
      nativeTypographyStatus: capacitorPlatform !== "android"
        ? "not_applicable"
        : Math.abs(computedRootFontSizePx - 16) <= 0.1
          ? "normalized_standard"
          : "governed_gridly_preference_or_physical_review_required",
      arcgisConfigPresent: typeof runtime.arcgisStaticBasemapApiKey === "string" && Boolean(runtime.arcgisStaticBasemapApiKey.trim()),
      driveTexasConfigPresent: driveTexasFamily !== "none",
      driveTexasConfigFamily: driveTexasFamily,
      supabaseClientInitialized: Boolean(globalScope[Symbol.for("gridly.runtime.supabaseClient")]),
      nwsEndpointReachability,
      poiManifestPresence: await exists("poi/lp24111-d5-standalone-2026-08-28/runtime-v2/manifest.json"),
      crossingPackagePresence: await exists("Crossing-Packages/liberty/liberty-crossings-curated.geojson")
    });
    console.info("gridlyNativeProviderOriginAudit", result);
    return result;
  };
})(window);
