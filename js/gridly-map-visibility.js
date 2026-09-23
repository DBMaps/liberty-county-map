/* LP244.48F2: presentation only; never selects an awareness/camera owner. */
(function (global) {
  "use strict";
  function bounds(map, { includeNotice = true } = {}) {
    const rect = map.getContainer().getBoundingClientRect();
    const viewport = global.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const right = left + (viewport?.width || global.innerWidth);
    const bottom = top + (viewport?.height || global.innerHeight);
    const visible = selector => [...document.querySelectorAll(selector)].map(node => {
      const style = getComputedStyle(node), r = node.getBoundingClientRect();
      return !node.hidden && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && r.width > 0 && r.height > 0 && r.bottom > top && r.top < bottom ? r : null;
    }).filter(Boolean);
    const tops = visible("#gridlyPortraitV2 .gridly-v2-topbar, #gridlyPortraitV2 .gridly-v2-status-pill, #gridlyBriefFoundationHandle, #gridlyBriefInteractionPanel, #gridlyPortraitV2 .gridly-v2-segments");
    const bottoms = visible("#mobileDestinationCommandPanel, #gridlyPortraitBottomRegion");
    // The passive notice needs only a 2px clearance; reserve the larger 8px
    // touch gap for controls. This keeps two-line locations visible at 500px.
    if (includeNotice) bottoms.push(...visible("#gridlyMapBackgroundStatus").map(r => ({ top: r.top + 6 })));
    const controls = visible("#gridlyPortraitV2 .gridly-v2-control-rail");
    return {
      left: Math.max(rect.left, left) + 8,
      right: Math.min(rect.right, right, ...controls.map(r => r.left)) - 8,
      top: Math.max(rect.top, top, ...tops.map(r => r.bottom)) + 8,
      bottom: Math.min(rect.bottom, bottom, ...bottoms.map(r => r.top)) - 8
    };
  }

  function install(map, layers) {
    const portrait = () => document.body?.dataset.layoutMode === "portrait";
    const notice = document.createElement("div");
    notice.id = "gridlyMapBackgroundStatus";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.hidden = true;
    notice.textContent = "Map imagery unavailable";
    map.getContainer().appendChild(notice);
    const states = new Map(layers.map(layer => [layer, { errors: 0, loaded: 0 }]));
    function positionNotice() {
      const r = map.getContainer().getBoundingClientRect();
      const b = bounds(map, { includeNotice: false });
      notice.style.left = `${b.left - r.left}px`;
      notice.style.bottom = `${Math.max(0, r.bottom - b.bottom)}px`;
      notice.style.maxWidth = `${Math.max(100, b.right - b.left)}px`;
    }
    function refreshNotice() {
      const active = layers.filter(layer => map.hasLayer(layer));
      const wasHidden = notice.hidden;
      notice.hidden = !active.some(layer => {
        const state = states.get(layer);
        return state.errors > 0 && state.loaded === 0;
      });
      if (!notice.hidden && wasHidden) positionNotice();
    }
    for (const layer of layers) {
      layer.on("loading", () => { states.set(layer, { errors: 0, loaded: 0 }); });
      layer.on("tileerror", () => { states.get(layer).errors++; refreshNotice(); });
      layer.on("tileload", () => { states.get(layer).loaded++; refreshNotice(); });
      layer.on("load", refreshNotice);
    }
    let frame = null, settleTimer = null;
    function fit(popup) {
      if (!popup || !portrait() || map._popup !== popup || !popup.isOpen()) return;
      // Finish this popup's initial Leaflet auto-pan before replacing its
      // rectangular padding with measured UI bounds. Do not stop other cameras.
      if (popup.options.autoPan && map._panAnim?._inProgress) map.stop();
      const b = bounds(map), element = popup.getElement();
      if (!element || b.right <= b.left || b.bottom <= b.top) return;
      // Retain Leaflet's popup and scroll its content if the keyboard/viewport
      // leaves less height. Auto-pan stays owned by Leaflet and the crossing path.
      popup.options.maxWidth = Math.max(80, b.right - b.left - 24);
      popup.options.minWidth = Math.min(120, popup.options.maxWidth);
      popup.options.maxHeight = Math.max(24, b.bottom - b.top - 20);
      element.style.setProperty("--gridly-popup-content-width", `${popup.options.maxWidth}px`);
      element.style.setProperty("--gridly-popup-content-height", `${popup.options.maxHeight}px`);
      const autoPan = popup.options.autoPan;
      popup.options.autoPan = false;
      popup.update();
      popup.options.autoPan = autoPan;
      const r = element.getBoundingClientRect();
      const dx = r.left < b.left ? r.left - b.left : Math.max(0, r.right - b.right);
      const dy = r.top < b.top ? r.top - b.top : Math.max(0, r.bottom - b.bottom);
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) map.panBy([Math.round(dx), Math.round(dy)], { animate: false });
    }
    function schedule() {
      cancelAnimationFrame(frame);
      const popup = map._popup;
      if (popup) frame = requestAnimationFrame(() => fit(popup));
    }
    // Leaflet has laid out the popup before this event. Correct it in the same
    // turn so touch browsers cannot paint it behind the fixed shell first.
    map.on("popupopen", event => {
      const popup = event?.popup || map._popup;
      fit(popup); schedule();
      clearTimeout(settleTimer);
      // Popups can finish their opening pan after popupopen. One
      // bounded settling check preserves their anchor without a move listener.
      settleTimer = setTimeout(() => fit(popup), 420);
    });
    map.on("popupclose", () => { cancelAnimationFrame(frame); clearTimeout(settleTimer); });
    map.on("resize", () => { positionNotice(); schedule(); });
    map.on("baselayerchange", refreshNotice);
    map.on("layeradd layerremove", event => { if (states.has(event.layer)) refreshNotice(); });
    global.visualViewport?.addEventListener("resize", () => { positionNotice(); schedule(); });
    // Bounds can change when the bottom context reacts to a popup opening.
    map.on("popupopen popupclose", positionNotice);
    return { bounds: () => bounds(map), fit, refreshNotice };
  }
  global.GridlyMapVisibility = { bounds, install };
})(typeof window !== "undefined" ? window : globalThis);
