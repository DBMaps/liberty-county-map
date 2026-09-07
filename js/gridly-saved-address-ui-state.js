(function installGridlySavedAddressUiStateContract(global) {
  "use strict";

  const MODES = Object.freeze({
    DEFAULT_ADDRESS_ENTRY: "DEFAULT_ADDRESS_ENTRY",
    AWAITING_MAP_SELECTION: "AWAITING_MAP_SELECTION",
    AWAITING_MAP_CONFIRMATION: "AWAITING_MAP_CONFIRMATION",
    CONFIRMED: "CONFIRMED",
    CANCELED: "CANCELED"
  });

  const clone = (value) => {
    if (value == null) return null;
    return JSON.parse(JSON.stringify(value));
  };

  function createState(overrides = {}) {
    return Object.freeze({
      mode: MODES.DEFAULT_ADDRESS_ENTRY,
      slot: null,
      pendingAddress: "",
      currentAnchor: null,
      oldSavedPlace: null,
      confirmedCoordinates: null,
      reason: "initial",
      ...overrides
    });
  }

  function offer(state, { slot = "custom", pendingAddress = "", currentAnchor = null, oldSavedPlace = null } = {}) {
    if (!currentAnchor || !Number.isFinite(Number(currentAnchor.lat)) || !Number.isFinite(Number(currentAnchor.lng))) {
      return createState({ reason: "fallback_unavailable" });
    }
    return createState({
      mode: MODES.AWAITING_MAP_SELECTION,
      slot,
      pendingAddress: String(pendingAddress || "").trim(),
      currentAnchor: Object.freeze({ lat: Number(currentAnchor.lat), lng: Number(currentAnchor.lng) }),
      oldSavedPlace: clone(oldSavedPlace),
      reason: "fallback_offered"
    });
  }

  function beginMapConfirmation(state) {
    if (state?.mode !== MODES.AWAITING_MAP_SELECTION) return state;
    return createState({ ...state, mode: MODES.AWAITING_MAP_CONFIRMATION, reason: "map_selection_started" });
  }

  function confirm(state, coordinates) {
    if (state?.mode !== MODES.AWAITING_MAP_CONFIRMATION) return state;
    if (!coordinates || !Number.isFinite(Number(coordinates.lat)) || !Number.isFinite(Number(coordinates.lng))) return state;
    return createState({
      ...state,
      mode: MODES.CONFIRMED,
      confirmedCoordinates: Object.freeze({ lat: Number(coordinates.lat), lng: Number(coordinates.lng) }),
      reason: "map_selection_confirmed"
    });
  }

  function cancel(state, reason = "canceled") {
    return createState({ ...state, mode: MODES.CANCELED, confirmedCoordinates: null, reason });
  }

  function restart(reason = "restarted") {
    return createState({ reason });
  }

  function isFallbackActive(state) {
    return state?.mode === MODES.AWAITING_MAP_SELECTION || state?.mode === MODES.AWAITING_MAP_CONFIRMATION;
  }

  function presentation(state) {
    const mode = state?.mode || MODES.DEFAULT_ADDRESS_ENTRY;
    const selecting = mode === MODES.AWAITING_MAP_SELECTION;
    const confirming = mode === MODES.AWAITING_MAP_CONFIRMATION;
    const slotLabel = state?.slot === "home" ? "Home" : state?.slot === "work" ? "Work" : "Location";
    return Object.freeze({
      mode,
      fallbackControlVisible: selecting,
      confirmControlVisible: confirming,
      defaultSaveControlVisible: !selecting && !confirming,
      actionLabel: selecting ? "Choose Location on Map" : confirming ? `Set ${slotLabel} Here` : "",
      pendingAddress: state?.pendingAddress || "",
      currentAnchor: state?.currentAnchor || null
    });
  }

  function auditUiState(state, actual = {}) {
    const expected = presentation(state);
    const fallbackControlVisible = actual.fallbackControlVisible === true;
    const confirmControlVisible = actual.confirmControlVisible === true;
    const fallbackOffered = actual.fallbackOffered === true;
    const confirmed = actual.confirmed === true;
    return Object.freeze({
      ...expected,
      fallbackControlVisible,
      confirmControlVisible,
      defaultSaveControlVisible: actual.defaultSaveControlVisible === true,
      consumerUsable: !fallbackOffered || confirmed || fallbackControlVisible || confirmControlVisible
    });
  }

  global.GRIDLY_SAVED_ADDRESS_UI_STATE_CONTRACT = Object.freeze({
    MODES,
    createState,
    offer,
    beginMapConfirmation,
    confirm,
    cancel,
    restart,
    isFallbackActive,
    presentation,
    auditUiState
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
