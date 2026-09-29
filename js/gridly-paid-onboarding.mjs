// UI/preferences only. Store authority and protected startup stay in the coordinator.
const COMPLETE='gridlyBetaFirstRunWalkthroughCompleteV894C';
const PROFILE='gridlyUserProfileV1', PENDING='gridlyPaidSetupPreferenceV1';
const legacy=['gridlyWelcomeSeenV1','gridlyWelcomeSeenV126A','gridlyWelcomeSeen','gridlyOnboardingComplete','gridlySetupComplete','gridlyFirstRunComplete','gridlyV858SetupComplete','gridlyV859WelcomeComplete'];
const get=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const put=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
export function onboardingComplete() {
  if(get(COMPLETE)==='yes')return true;
  try{return JSON.parse(get(PROFILE)||'null')?.setupComplete===true;}catch{return false;}
}
export async function createPaidOnboarding({onComplete}) {
  const response=await fetch('assets/onboarding/paid-onboarding-model.json');
  if(!response.ok)throw Error('onboarding_unavailable');
  const model=await response.json();
  const GRIDLY_DEFAULT_COUNTY_ID='liberty-tx';
  const GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID=model.geoids;
  const GRIDLY_COUNTY_REGISTRY=model.registry,GRIDLY_AWARENESS_AREA_DEFINITIONS=model.areas;
  const GRIDLY_AWARENESS_AREA_BY_KEY=Object.fromEntries(model.areas.map(area=>[area.key,area]));
  const GRIDLY_LP051_ZIP_AWARENESS_INDEX=model.zip,GRIDLY_V858_FIRST_RUN_ZIP_TO_AREA=model.zipFallback;
  const GRIDLY_LP035_HOUSTON_REGION_MODEL=model.houston,GRIDLY_LP035_HOUSTON_REGION_LABEL_ALIASES=model.houstonAliases;
  const GRIDLY_V872_FIRST_RUN_NEAREST_AREA_MAX_DISTANCE=0.85;
  const gridlyV872FirstRunInteractionAuditState = {
  inputEvents: 0,
  continueEvents: 0,
  locationAttempts: 0,
  locationSuccesses: 0,
  locationFallbacks: 0,
  lastLocationOutcome: null,
  lastManualOutcome: null,
  lastPointerDownTarget: null,
  lastPointerUpTarget: null,
  lastClickTarget: null,
  lastActionAttempted: null,
  handlersAttached: false,
  useLocationHandlersAttached: false,
  continueHandlersAttached: false,
  delegatedHandlersAttached: false
};
  const overlay=document.getElementById('gridlyWelcomeOnboarding');
  const original=overlay.cloneNode(true);original.inert=false;
  const els={gridlyWelcomeOnboarding:overlay};
  let closed=false, completionTimer, pendingPosition;
  const recordGridlyGeolocationRequest=()=>{};
  const setGridlyUserLocation=position=>{pendingPosition=position;};
  const markComplete=()=>{
    put(COMPLETE,'yes');
    for(const key of legacy) {try{localStorage.removeItem(key);}catch{}try{sessionStorage.removeItem(key);}catch{}}
  };
  function closeGridlyWelcomeOnboarding({persist=true}={}) {
    if(closed)return false;
    closed=true;if(persist)markComplete();
    clearTimeout(completionTimer);overlay.__gridlyWalkthroughOrientationCleanup?.();
    document.body.classList.remove('modal-open','gridly-welcome-open','gridly-v858-first-run-open');
    // Drop pre-access listeners so the unchanged app can later replay its tour.
    overlay.replaceWith(original);onComplete();return true;
  }
  function completeGridlyV858FirstRunSetup(area,options={}) {
    if(!area||closed)return false;
    // Only public watch-area preference identity, not receipts or entitlement.
    put(PENDING,JSON.stringify({areaKey:area.key,zipCode:options.zipCode||'',source:options.source||'v858_first_run'}));
    showGridlyV859FirstRunCompletionMoment(area);markComplete();
    completionTimer=setTimeout(()=>closeGridlyWelcomeOnboarding({persist:true}),1600);
    return true;
  }
  const applyRuntimeSetup=({complete,setLocation})=>{
    let intent;try{intent=JSON.parse(get(PENDING)||'null');}catch{return;}
    const area=GRIDLY_AWARENESS_AREA_BY_KEY[intent?.areaKey];
    if(!area || typeof intent?.zipCode!=='string' || !/^(?:\d{5})?$/.test(intent.zipCode))return;
    if(pendingPosition)setLocation(pendingPosition,{source:'v858_first_run'});
    if(complete(area,{zipCode:intent.zipCode,source:'v858_first_run'})) {try{localStorage.removeItem(PENDING);}catch{}}
  };
  function open() {
    renderGridlyV858FirstRunExperience(overlay);
    overlay.hidden=false;overlay.inert=false;overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open','gridly-welcome-open','gridly-v858-first-run-open');
    overlay.__gridlySyncWalkthroughOrientationGate?.();
    requestAnimationFrame(()=>overlay.querySelector(overlay.dataset.gridlyWalkthroughOrientationGated==='true'
      ?'[data-gridly-walkthrough-orientation-gate]':'#gridlyV858UseLocationBtn, button:not([hidden]):not(:disabled)')?.focus?.({preventScroll:true}));
  }
  /* ACCEPTED_FUNCTIONS_START */
function renderGridlyV858FirstRunExperience(overlay) {
  if (!overlay) return;
  if (overlay.classList.contains("gridly-v859-completion-visible")) {
    overlay.classList.remove("gridly-v859-completion-visible");
    delete overlay.dataset.gridlyV858FirstRun;
  }
  if (overlay.dataset.gridlyV858FirstRun === "1") return;
  overlay.__gridlyWalkthroughOrientationCleanup?.();
  overlay.dataset.gridlyV858FirstRun = "1";
  overlay.innerHTML = `
    <div class="gridly-welcome-backdrop" id="gridlyWelcomeBackdrop"></div>
    <section class="gridly-welcome-sheet gridly-v858-first-run-sheet" role="dialog" aria-modal="true" aria-labelledby="gridlyV858FirstRunTitle" aria-describedby="gridlyV858FirstRunCopy">
      <div class="gridly-v858-first-run-card">
        <section class="gridly-v950-orientation-gate" data-gridly-walkthrough-orientation-gate role="status" aria-live="polite" aria-labelledby="gridlyV950OrientationTitle" aria-describedby="gridlyV950OrientationCopy" tabindex="-1" hidden>
          <div class="gridly-v950-rotate-symbol" aria-hidden="true"><span></span></div>
          <p class="gridly-v950-orientation-brand">Gridly Quick Tour</p>
          <h2 id="gridlyV950OrientationTitle">Rotate your phone</h2>
          <p id="gridlyV950OrientationCopy">Gridly’s quick tour is designed for portrait viewing.</p>
        </section>
        <div class="gridly-v894c3-tour-scroll gridly-v950-onboarding-pager" data-gridly-quick-tour-scroll data-gridly-quick-tour-scroll-enabled="true" data-gridly-quick-tour-no-clipping="true" tabindex="0" role="region" aria-label="Quick Tour cards and setup">
          <div class="gridly-v894c2-tour-cards gridly-v950-page-track" id="gridlyV894C2TourCards" data-gridly-beta-first-run-walkthrough data-gridly-quick-tour data-gridly-visual-quick-tour data-gridly-onboarding-page-track>
            <article class="gridly-v894c2-tour-card gridly-v896-visual-tour-card gridly-v950-tour-page gridly-v950-welcome-page" data-gridly-tour-card="welcome" data-gridly-onboarding-page="welcome"><div class="gridly-v950-welcome-logo"><img src="assets/store/icons/gridly-icon-master-1024.png" alt="" loading="eager" decoding="async" /></div><div class="gridly-v950-page-copy"><h2 id="gridlyV858FirstRunTitle">Welcome to Gridly</h2><p class="gridly-v858-first-run-tagline">Know Before You Go.</p><p id="gridlyV858FirstRunCopy">Local conditions, official signals, and community reports in one awareness-first view.</p></div></article>
            <article class="gridly-v894c2-tour-card gridly-v896-visual-tour-card gridly-v950-tour-page gridly-v950-feature-page" data-gridly-tour-card="awareness" data-gridly-visual-tour-card="awareness" data-gridly-approved-slide="kbyg" data-gridly-onboarding-page="awareness"><div class="gridly-v950-page-copy"><h3>Know Before You Go</h3><p>Current conditions before you leave.</p></div><div class="gridly-v896-shot-frame"><img src="assets/walkthrough/gridly-walkthrough-kbyg.png" alt="Illustration of Gridly's travel brief and current conditions experience" loading="lazy" decoding="async" data-gridly-onboarding-image="awareness" /></div></article>
            <article class="gridly-v894c2-tour-card gridly-v896-visual-tour-card gridly-v950-tour-page gridly-v950-feature-page" data-gridly-tour-card="map" data-gridly-visual-tour-card="map" data-gridly-approved-slide="nearby" data-gridly-onboarding-page="map"><div class="gridly-v950-page-copy"><h3>See what's happening nearby</h3><p>Nearby reports and roadway conditions.</p></div><div class="gridly-v896-shot-frame"><img src="assets/walkthrough/gridly-walkthrough-nearby.png" alt="Illustration of Gridly's nearby map and local roadway context" loading="lazy" decoding="async" data-gridly-onboarding-image="map" /></div></article>
            <article class="gridly-v894c2-tour-card gridly-v896-visual-tour-card gridly-v950-tour-page gridly-v950-feature-page" data-gridly-tour-card="alerts" data-gridly-visual-tour-card="alerts" data-gridly-approved-slide="alerts" data-gridly-onboarding-page="alerts"><div class="gridly-v950-page-copy"><h3>Stay informed with important updates</h3><p>Important changes when conditions shift.</p></div><div class="gridly-v896-shot-frame"><img src="assets/walkthrough/gridly-walkthrough-alerts.png" alt="Illustration of Gridly's important condition and community alerts" loading="lazy" decoding="async" data-gridly-onboarding-image="alerts" /></div></article>
            <article class="gridly-v894c2-tour-card gridly-v896-visual-tour-card gridly-v950-tour-page gridly-v950-feature-page" data-gridly-tour-card="report" data-gridly-visual-tour-card="report" data-gridly-approved-slide="report" data-gridly-onboarding-page="report"><div class="gridly-v950-page-copy"><h3>Your report helps everyone nearby</h3><p>Share what you see when it is safe.</p></div><div class="gridly-v896-shot-frame"><img src="assets/walkthrough/gridly-walkthrough-report.png" alt="Illustration of Gridly's community hazard reporting choices" loading="lazy" decoding="async" data-gridly-onboarding-image="report" /></div></article>
            <article class="gridly-v894c2-tour-card gridly-v896-visual-tour-card gridly-v950-tour-page gridly-v950-feature-page" data-gridly-tour-card="settings" data-gridly-visual-tour-card="settings" data-gridly-approved-slide="settings" data-gridly-onboarding-page="settings"><div class="gridly-v950-page-copy"><h3>Make Gridly yours</h3><p>Choose your area and preferences.</p></div><div class="gridly-v896-shot-frame"><img src="assets/walkthrough/gridly-walkthrough-settings.png" alt="Illustration of Gridly's awareness area and personalization settings" loading="lazy" decoding="async" data-gridly-onboarding-image="settings" /></div></article>
            <article class="gridly-v894c2-tour-card gridly-v896-visual-tour-card gridly-v950-tour-page gridly-v950-setup-page" data-gridly-tour-card="setup" data-gridly-onboarding-page="setup"><div class="gridly-v950-page-copy"><h3>Set your awareness area</h3><p>Use your location or enter a ZIP code or town</p></div>
          <div class="gridly-v858-location-panel">
            <button class="primary-btn" type="button" id="gridlyV858UseLocationBtn">Use My Location</button>
            <p class="gridly-v858-location-note">Location is optional. Choose a watch area now, or finish and set it later.</p>
            <div class="gridly-v858-location-divider" aria-hidden="true">or</div>
            <form id="gridlyV858ManualLocationForm" class="gridly-v858-manual-location">
              <label for="gridlyV858LocationInput">Where do you want Gridly to watch?</label>
              <input id="gridlyV858LocationInput" type="text" inputmode="search" autocomplete="postal-code" placeholder="77535 or Dayton" />
              <button class="secondary-btn" type="submit">Continue</button>
            </form>
          </div></article>
          </div>
          <div class="gridly-v950-page-indicators" id="gridlyV950PageIndicators" aria-label="Quick Tour page progress"></div>
          <div class="gridly-v894c2-tour-actions gridly-v950-page-actions" aria-label="Quick Tour navigation">
            <a class="primary-btn gridly-v894c2-start-link" href="#gridlyV894C2TourCards" data-gridly-start-tour-state="tour-cards-visible" aria-disabled="true" aria-label="Quick Tour cards are visible below">Tour Below</a>
            <button class="secondary-btn compact-btn gridly-v894c2-skip-btn" type="button" id="gridlyV894CFirstRunSkipBtn" data-gridly-first-run-skip aria-label="Skip walkthrough">Skip</button>
            <button class="secondary-btn compact-btn" type="button" id="gridlyV950BackBtn">Back</button>
            <button class="primary-btn gridly-v950-next-btn" type="button" id="gridlyV950NextBtn">Next</button>
            <button class="primary-btn gridly-v894c2-finish-btn" type="button" id="gridlyV894C2FirstRunFinishBtn" data-gridly-first-run-finish>Finish</button>
          </div>
          <p class="gridly-v858-first-run-status" id="gridlyV858FirstRunStatus" role="status" aria-live="polite"></p>
        </div>
      </div>
    </section>`;

  const pageTrack = overlay.querySelector("[data-gridly-onboarding-page-track]");
  const onboardingPager = overlay.querySelector("[data-gridly-quick-tour-scroll]");
  const orientationGate = overlay.querySelector("[data-gridly-walkthrough-orientation-gate]");
  const onboardingDialog = overlay.querySelector(".gridly-v858-first-run-sheet");
  const pages = Array.from(overlay.querySelectorAll("[data-gridly-onboarding-page]"));
  const indicators = overlay.querySelector("#gridlyV950PageIndicators");
  const backButton = overlay.querySelector("#gridlyV950BackBtn");
  const nextButton = overlay.querySelector("#gridlyV950NextBtn");
  const finishButton = overlay.querySelector("#gridlyV894C2FirstRunFinishBtn");
  let activePageIndex = 0;
  let orientationGateActive = false;
  let preGateFocus = null;
  const isNativeApp = () => Boolean(
    window.Capacitor?.isNativePlatform?.()
    || ["android", "ios"].includes(String(window.Capacitor?.getPlatform?.() || "").toLowerCase())
  );
  const isMobileWalkthroughDevice = () => isNativeApp()
    || window.matchMedia?.("(hover: none) and (pointer: coarse) and (max-width: 1100px)")?.matches === true;
  const syncWalkthroughOrientationGate = () => {
    const isLandscape = window.matchMedia?.("(orientation: landscape)")?.matches
      ?? (window.innerWidth > window.innerHeight);
    const shouldGate = !overlay.hidden && isLandscape && isMobileWalkthroughDevice();
    if (shouldGate === orientationGateActive) return;
    orientationGateActive = shouldGate;
    overlay.dataset.gridlyWalkthroughOrientationGated = shouldGate ? "true" : "false";
    orientationGate.hidden = !shouldGate;
    orientationGate.setAttribute("aria-hidden", shouldGate ? "false" : "true");
    onboardingPager.inert = shouldGate;
    onboardingPager.setAttribute("aria-hidden", shouldGate ? "true" : "false");
    onboardingDialog.setAttribute("aria-labelledby", shouldGate ? "gridlyV950OrientationTitle" : "gridlyV858FirstRunTitle");
    onboardingDialog.setAttribute("aria-describedby", shouldGate ? "gridlyV950OrientationCopy" : "gridlyV858FirstRunCopy");
    if (shouldGate) {
      preGateFocus = overlay.contains(document.activeElement) ? document.activeElement : null;
      orientationGate.focus({ preventScroll: true });
    } else if (!overlay.hidden) {
      (preGateFocus?.isConnected ? preGateFocus : pages[activePageIndex])?.focus?.({ preventScroll: true });
      preGateFocus = null;
    }
  };
  const orientationMedia = window.matchMedia?.("(orientation: landscape)");
  const mobileMedia = window.matchMedia?.("(hover: none) and (pointer: coarse) and (max-width: 1100px)");
  orientationMedia?.addEventListener?.("change", syncWalkthroughOrientationGate);
  mobileMedia?.addEventListener?.("change", syncWalkthroughOrientationGate);
  window.addEventListener("resize", syncWalkthroughOrientationGate, { passive: true });
  overlay.__gridlyWalkthroughOrientationCleanup = () => {
    orientationMedia?.removeEventListener?.("change", syncWalkthroughOrientationGate);
    mobileMedia?.removeEventListener?.("change", syncWalkthroughOrientationGate);
    window.removeEventListener("resize", syncWalkthroughOrientationGate);
  };
  const setActiveOnboardingPage = (index, { scroll = true } = {}) => {
    if (!pages.length) return;
    activePageIndex = Math.max(0, Math.min(index, pages.length - 1));
    pages.forEach((page, pageIndex) => {
      const isActive = pageIndex === activePageIndex;
      page.dataset.gridlyOnboardingPageActive = isActive ? "true" : "false";
      page.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
    if (indicators) {
      indicators.innerHTML = pages.map((_, pageIndex) => `<button type="button" class="gridly-v950-page-dot${pageIndex === activePageIndex ? " is-active" : ""}" data-gridly-page-dot="${pageIndex}" aria-label="Go to Quick Tour page ${pageIndex + 1}" aria-current="${pageIndex === activePageIndex ? "step" : "false"}"></button>`).join("");
    }
    if (backButton) backButton.disabled = activePageIndex === 0;
    if (nextButton) nextButton.hidden = activePageIndex === pages.length - 1;
    if (finishButton) finishButton.hidden = activePageIndex !== pages.length - 1;
    pageTrack?.style?.setProperty("--gridly-v950-page-index", String(activePageIndex));
    if (scroll) pages[activePageIndex]?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "center" });
  };
  backButton?.addEventListener("click", () => setActiveOnboardingPage(activePageIndex - 1));
  nextButton?.addEventListener("click", () => setActiveOnboardingPage(activePageIndex + 1));
  indicators?.addEventListener("click", (event) => {
    const dot = event.target?.closest?.("[data-gridly-page-dot]");
    if (!dot) return;
    setActiveOnboardingPage(Number(dot.dataset.gridlyPageDot || 0));
  });
  let onboardingPagerScrollTimer = 0;
  pageTrack?.addEventListener("scroll", () => {
    window.clearTimeout?.(onboardingPagerScrollTimer);
    onboardingPagerScrollTimer = window.setTimeout(() => {
      const width = pageTrack.clientWidth || 1;
      setActiveOnboardingPage(Math.round(pageTrack.scrollLeft / width), { scroll: false });
    }, 80);
  }, { passive: true });
  setActiveOnboardingPage(0, { scroll: false });
  overlay.__gridlySyncWalkthroughOrientationGate = syncWalkthroughOrientationGate;
  const status = overlay.querySelector("#gridlyV858FirstRunStatus");
  const input = overlay.querySelector("#gridlyV858LocationInput");
  const showFallback = (message = "No problem. Location is optional — enter a ZIP code or town name to get started.") => {
    gridlyV872FirstRunInteractionAuditState.locationFallbacks += 1;
    gridlyV872FirstRunInteractionAuditState.lastLocationOutcome = "fallback";
    if (status) status.textContent = message;
    input?.focus?.({ preventScroll: true });
  };
  const submitManualLocation = () => {
    gridlyV872FirstRunInteractionAuditState.continueEvents += 1;
    const requested = String(input?.value || "").trim();
    const area = resolveGridlyV858FirstRunLocation(requested);
    if (!area) {
      gridlyV872FirstRunInteractionAuditState.lastManualOutcome = "unsupported";
      if (status) status.textContent = "Try a nearby ZIP code or town name, like 77535 or Dayton.";
      input?.focus?.({ preventScroll: true });
      return false;
    }
    gridlyV872FirstRunInteractionAuditState.lastManualOutcome = "success";
    return completeGridlyV858FirstRunSetup(area, { source: "v858_first_run_manual", zipCode: requested.match(/^\d{5}$/) ? requested : "" });
  };
  input?.addEventListener("input", () => {
    gridlyV872FirstRunInteractionAuditState.inputEvents += 1;
    gridlyV872FirstRunInteractionAuditState.lastManualOutcome = "typing";
    if (status && /Try a nearby ZIP code|No problem\./i.test(status.textContent || "")) status.textContent = "";
  });
  const skipWalkthroughButton = overlay.querySelector("#gridlyV894CFirstRunSkipBtn");
  skipWalkthroughButton?.addEventListener("click", () => closeGridlyWelcomeOnboarding({ persist: true, source: "v894c2_skip" }));
  const finishWalkthroughButton = overlay.querySelector("#gridlyV894C2FirstRunFinishBtn");
  finishWalkthroughButton?.addEventListener("click", () => closeGridlyWelcomeOnboarding({ persist: true, source: "v894c2_finish" }));
  const useLocationButton = overlay.querySelector("#gridlyV858UseLocationBtn");
  const requestFirstRunLocation = () => {
    window.__gridlyV858LocationRequestUserGesture = true;
    gridlyV872FirstRunInteractionAuditState.locationAttempts += 1;
    if (!navigator.geolocation) return showFallback("Location is not available here. Enter a ZIP code or town name to choose your watch area.");
    if (status) status.textContent = "Checking your area… Location helps Gridly choose local signals, but ZIP setup works too.";
    recordGridlyGeolocationRequest("v858_first_run_use_my_location");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position?.coords?.latitude);
        const lng = Number(position?.coords?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) setGridlyUserLocation({ lat, lng }, { source: "v858_first_run" });
        const area = resolveGridlyV858NearestAwarenessArea(lat, lng, { requireSupportedArea: true, allowFallback: false });
        if (!area) return showFallback("Gridly is not available for that area yet. Try a nearby ZIP code or town name.");
        gridlyV872FirstRunInteractionAuditState.locationSuccesses += 1;
        gridlyV872FirstRunInteractionAuditState.lastLocationOutcome = "success";
        completeGridlyV858FirstRunSetup(area, { source: "v858_first_run_location" });
      },
      (error) => {
        const code = Number(error?.code || 0);
        const message = code === 1
          ? "No problem. Location is optional — enter a ZIP code or town name to get started."
          : (code === 3 ? "That took too long. Enter a ZIP code or town name to choose your watch area." : "We could not find your location. Enter a ZIP code or town name to choose your watch area.");
        showFallback(message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };
  bindGridlyV872FirstRunActivation(useLocationButton, "use-location", requestFirstRunLocation);
  const manualForm = overlay.querySelector("#gridlyV858ManualLocationForm");
  const continueButton = manualForm?.querySelector('button[type="submit"]');
  const requestManualContinue = () => {
    window.__gridlyV872ContinuePointerUpSeen = true;
    submitManualLocation();
  };
  bindGridlyV872FirstRunActivation(continueButton, "continue", requestManualContinue);
  manualForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    noteGridlyV872FirstRunAction("submit");
    submitManualLocation();
  });
  overlay.addEventListener("pointerdown", (event) => { gridlyV872FirstRunInteractionAuditState.lastPointerDownTarget = getGridlyV872FirstRunTargetLabel(event.target); }, { passive: true });
  overlay.addEventListener("pointerup", (event) => { gridlyV872FirstRunInteractionAuditState.lastPointerUpTarget = getGridlyV872FirstRunTargetLabel(event.target); }, { passive: true });
  overlay.addEventListener("click", (event) => { gridlyV872FirstRunInteractionAuditState.lastClickTarget = getGridlyV872FirstRunTargetLabel(event.target); }, { passive: true });
  gridlyV872FirstRunInteractionAuditState.handlersAttached = true;
  gridlyV872FirstRunInteractionAuditState.useLocationHandlersAttached = Boolean(useLocationButton?.dataset?.gridlyV872TapBound?.includes("use-location"));
  gridlyV872FirstRunInteractionAuditState.continueHandlersAttached = Boolean(continueButton?.dataset?.gridlyV872TapBound?.includes("continue"));
  gridlyV872FirstRunInteractionAuditState.delegatedHandlersAttached = true;
}

function getGridlyV872FirstRunTargetLabel(target) {
  if (!target) return null;
  const isTextNode = typeof Node !== "undefined" && target.nodeType === Node.TEXT_NODE;
  const element = isTextNode ? target.parentElement : target;
  if (!element) return null;
  return element.id || element.getAttribute?.("data-gridly-first-run-action") || element.getAttribute?.("name") || element.tagName?.toLowerCase?.() || null;
}

function noteGridlyV872FirstRunAction(action) {
  gridlyV872FirstRunInteractionAuditState.lastActionAttempted = action;
}

function bindGridlyV872FirstRunActivation(element, actionName, handler) {
  if (!element || typeof handler !== "function") return false;
  if (!element.dataset.gridlyV872TapBound) element.dataset.gridlyV872TapBound = "";
  if (element.dataset.gridlyV872TapBound.split(" ").includes(actionName)) return true;
  element.dataset.gridlyV872TapBound = `${element.dataset.gridlyV872TapBound} ${actionName}`.trim();
  let lastActivationAt = 0;
  const activate = (event) => {
    const now = Date.now();
    if (now - lastActivationAt < 650) {
      event?.preventDefault?.();
      return;
    }
    lastActivationAt = now;
    noteGridlyV872FirstRunAction(actionName);
    if (event?.cancelable !== false) event?.preventDefault?.();
    handler(event);
  };
  element.addEventListener("pointerup", activate, { passive: false });
  element.addEventListener("touchend", activate, { passive: false });
  element.addEventListener("click", activate, { passive: false });
  return true;
}

function getGridlyV859FirstRunCompletionPlaceLabel(area) {
  const label = String(area?.label || "Dayton").trim() || "Dayton";
  return /texas|tx/i.test(label) ? label.replace(/,?\s*TX$/i, ", Texas") : `${label}, Texas`;
}

function showGridlyV859FirstRunCompletionMoment(area) {
  const overlay = els.gridlyWelcomeOnboarding || document.getElementById("gridlyWelcomeOnboarding");
  if (!overlay) return false;
  overlay.classList.add("gridly-v859-completion-visible");
  const card = overlay.querySelector(".gridly-v858-first-run-card");
  if (!card) return false;
  card.innerHTML = `
    <div class="gridly-v859-completion-moment" role="status" aria-live="polite">
      <h2>You’re all set.</h2>
      <p>Watching ${getGridlyV859FirstRunCompletionPlaceLabel(area)}.</p>
    </div>`;
  return true;
}

function resolveGridlyAwarenessAreaQuery(value = "", options = {}) {
  const query = String(value || "").replace(/\s+/g, " ").trim();
  const base = { query, matchType: null, community: null, county: null, zip: null, operational: false, ambiguous: false, candidates: [] };
  if (!query) return Object.freeze({ ...base, status: "INVALID_INPUT" });
  const looksNumeric = /^\d/.test(query);
  if (looksNumeric && !/^\d{5}$/.test(query)) return Object.freeze({ ...base, status: "INVALID_INPUT" });

  let matches = [];
  let matchType = "town";
  if (/^\d{5}$/.test(query)) {
    matchType = "zip";
    matches = (Array.isArray(options.records) ? options.records : GRIDLY_LP051_ZIP_AWARENESS_INDEX.records)
      .filter((record) => String(record?.zip || "") === query)
      .map((record) => ({ record, area: GRIDLY_AWARENESS_AREA_BY_KEY?.[record.awarenessAreaKey] || null }));
    if (!matches.length && GRIDLY_V858_FIRST_RUN_ZIP_TO_AREA?.[query]) {
      const area = resolveGridlyAwarenessArea(GRIDLY_V858_FIRST_RUN_ZIP_TO_AREA[query]);
      if (area) matches = [{ area, record: { zip: query, countyId: area.countyId, communityName: area.label, awarenessAreaKey: area.key, resolutionStatus: "resolved_by_governance" } }];
    }
  } else {
    const normalized = normalizeGridlyAwarenessAreaLookupText(query);
    matches = GRIDLY_AWARENESS_AREA_DEFINITIONS
      .filter((area) => !area?.countyWide && !area?.fallback && [area?.label, area?.storageValue].some((name) => normalizeGridlyAwarenessAreaLookupText(name) === normalized))
      .map((area) => ({ area, record: null }));
  }
  if (!matches.length) return Object.freeze({ ...base, status: "NOT_FOUND", matchType, zip: matchType === "zip" ? query : null });

  const candidates = matches.map(({ area, record }) => {
    const countyId = gridlyNormalizeCountyId(record?.countyId || area?.countyId || "");
    const county = GRIDLY_COUNTY_REGISTRY?.[countyId] || null;
    const countyFips = String(county?.countyFips || (typeof GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID !== "undefined" ? GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID?.[countyId] : "") || "");
    const countyName = GRIDLY_COUNTY_REGISTRY?.[countyId]?.name || record?.countyName || countyId;
    const governedCommunity = (county?.consumerAwarenessAreas || []).find((community) => String(community?.placeGeoid || "") === String(area?.placeGeoid || area?.communityId || record?.communityId || "")) || null;
    return Object.freeze({ awarenessArea: area, awarenessAreaKey: area?.key || record?.awarenessAreaKey || null, community: area?.label || record?.communityName || record?.consumerLabel || null, governedCommunityLabel: governedCommunity?.displayName || null, county: countyName, countyId, countyFips, placeGeoid: governedCommunity?.placeGeoid || area?.placeGeoid || null, canonicalIdentity: governedCommunity?.canonicalIdentity || area?.canonicalCommunityIdentity || null, countyMemberships: Object.freeze([...(governedCommunity?.countyMemberships || [])].map(String).sort()), zip: record?.zip || null, operational: Boolean(area && gridlyGetSelectableOperationalCountyIds().includes(countyId)) });
  });
  const normalizedLabels = new Set(candidates.map((candidate) => normalizeGridlyAwarenessAreaLookupText(candidate.community)));
  const governedLabels = new Set(candidates.map((candidate) => normalizeGridlyAwarenessAreaLookupText(candidate.governedCommunityLabel)).filter(Boolean));
  const placeGeoids = new Set(candidates.map((candidate) => candidate.placeGeoid).filter(Boolean));
  const canonicalIdentities = new Set(candidates.map((candidate) => candidate.canonicalIdentity).filter(Boolean));
  const governedMemberships = candidates[0]?.countyMemberships || [];
  const governedConsumerRegionParent = GRIDLY_AWARENESS_AREA_DEFINITIONS.some((area) => (area?.houstonRegion === true || area?.sanAntonioRegion === true) && normalizeGridlyAwarenessAreaLookupText(area?.parentCommunity || "") === [...normalizedLabels][0]);
  const canonicalMultiCountyPlace = matchType === "town" && candidates.length > 1
    && !governedConsumerRegionParent
    && normalizedLabels.size === 1 && governedLabels.size === 1 && [...governedLabels][0] === [...normalizedLabels][0] && placeGeoids.size === 1
    && canonicalIdentities.size === 1 && canonicalIdentities.has("PLACE_GEOID")
    && governedMemberships.length > 1
    && candidates.every((candidate) => candidate.countyFips && candidate.countyMemberships.join("|") === governedMemberships.join("|") && governedMemberships.includes(candidate.countyFips));
  if (canonicalMultiCountyPlace) {
    const placeGeoid = [...placeGeoids][0];
    const cameraCandidate = candidates.find((candidate) => Number.isFinite(Number(candidate.awarenessArea?.lat)) && Number.isFinite(Number(candidate.awarenessArea?.lng))) || null;
    const canonicalArea = Object.freeze({ ...(cameraCandidate?.awarenessArea || {}), key: `place-${placeGeoid}`, storageValue: candidates[0].community, label: candidates[0].community, countyId: null, countyIds: Object.freeze(candidates.map((candidate) => candidate.countyId).sort()), countyMemberships: Object.freeze([...governedMemberships]), placeGeoid, communityId: placeGeoid, canonicalCommunityIdentity: "PLACE_GEOID", canonicalMultiCountyPlace: true });
    return Object.freeze({ ...base, status: "RESOLVED_CANONICAL_MULTI_COUNTY_PLACE", matchType, community: candidates[0].community, county: null, countyId: null, countyMemberships: canonicalArea.countyMemberships, countyIds: canonicalArea.countyIds, placeGeoid, communityKey: placeGeoid, canonicalIdentity: "PLACE_GEOID", operational: candidates.every((candidate) => candidate.operational), awarenessAreaKey: canonicalArea.key, awarenessArea: canonicalArea, ambiguous: false, candidates: Object.freeze(candidates) });
  }
  if (matches.some(({ record }) => record?.resolutionStatus === "ambiguous") || candidates.length > 1) {
    return Object.freeze({ ...base, status: "AMBIGUOUS", matchType, zip: matchType === "zip" ? query : null, ambiguous: true, candidates: Object.freeze(candidates) });
  }
  const candidate = candidates[0];
  return Object.freeze({ ...base, status: candidate.operational ? "RESOLVED_OPERATIONAL" : "RESOLVED_NOT_OPERATIONAL", matchType, community: candidate.community, county: candidate.county, countyId: candidate.countyId, zip: candidate.zip, operational: candidate.operational, awarenessAreaKey: candidate.awarenessAreaKey, awarenessArea: candidate.awarenessArea, candidates: Object.freeze(candidates) });
}

function resolveGridlyAwarenessArea(value = "") {
  if (typeof gridlySelectedAwarenessAreaResolutionCache !== "undefined") {
    gridlySelectedAwarenessAreaResolutionCache.actualResolverMisses = Number(gridlySelectedAwarenessAreaResolutionCache.actualResolverMisses || 0) + 1;
    gridlySelectedAwarenessAreaResolutionCache.underlyingResolverCalls = Number(gridlySelectedAwarenessAreaResolutionCache.actualResolverMisses || 0);
    gridlySelectedAwarenessAreaResolutionCache.resolverCalls = Number(gridlySelectedAwarenessAreaResolutionCache.actualResolverMisses || 0);
  }
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const normalized = normalizeGridlyAwarenessAreaLookupText(raw);
  if (!normalized) return null;
  const genericCountyAliases = new Set(["entire county", "county wide", "countywide"]);
  if (genericCountyAliases.has(normalized)) return GRIDLY_AWARENESS_AREA_BY_KEY["liberty-county"] || null;
  const normalizedCandidateLookup = new Map();
  const getCandidateLookup = (candidate, field) => {
    const key = `${candidate?.key || ""}:${field}`;
    if (!normalizedCandidateLookup.has(key)) normalizedCandidateLookup.set(key, normalizeGridlyAwarenessAreaLookupText(candidate?.[field] || ""));
    return normalizedCandidateLookup.get(key);
  };
  const countyAliasArea = (GRIDLY_AWARENESS_AREA_DEFINITIONS || []).find((candidate) => {
    if (candidate?.countyWide !== true) return false;
    const countyConfig = GRIDLY_COUNTY_REGISTRY?.[candidate.countyId] || {};
    const countyName = normalizeGridlyAwarenessAreaLookupText(countyConfig.name || candidate.label || candidate.storageValue || "");
    return normalized === countyName || normalized === `entire ${countyName}` || normalized === `all ${countyName}` || getCandidateLookup(candidate, "label") === normalized || getCandidateLookup(candidate, "storageValue") === normalized;
  });
  if (countyAliasArea) return countyAliasArea;
  if (["other", "fallback", "somewhere else"].includes(normalized)) return GRIDLY_AWARENESS_AREA_BY_KEY.other || null;
  const houstonRegion = typeof gridlyLp035FindHoustonRegion === "function" ? gridlyLp035FindHoustonRegion(raw) : null;
  if (houstonRegion) return GRIDLY_AWARENESS_AREA_BY_KEY[houstonRegion.id] || gridlyLp035HoustonRegionAwarenessArea(houstonRegion);
  const dashed = normalized.replace(/\s+/g, "-");
  const area = GRIDLY_AWARENESS_AREA_DEFINITIONS.find((candidate) => {
    return candidate.key === dashed || getCandidateLookup(candidate, "label") === normalized || getCandidateLookup(candidate, "storageValue") === normalized;
  });
  return area || null;
}

function resolveGridlyV858FirstRunLocation(value = "") {
  const result = resolveGridlyAwarenessAreaQuery(value);
  return result.status === "RESOLVED_OPERATIONAL" ? result.awarenessArea : null;
}

function resolveGridlyV858NearestAwarenessArea(lat, lng, options = {}) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return options.allowFallback === false ? null : resolveGridlyAwarenessArea("Dayton");
  const candidates = GRIDLY_AWARENESS_AREA_DEFINITIONS.filter((area) => !area.countyWide && !area.fallback && Number.isFinite(area.lat) && Number.isFinite(area.lng));
  const nearest = candidates.reduce((currentNearest, area) => {
    const distance = ((area.lat - latitude) ** 2) + ((area.lng - longitude) ** 2);
    if (!currentNearest || distance < currentNearest.distance) return { area, distance };
    return currentNearest;
  }, null);
  if (options.requireSupportedArea && (!nearest || nearest.distance > GRIDLY_V872_FIRST_RUN_NEAREST_AREA_MAX_DISTANCE)) return null;
  return nearest?.area || (options.allowFallback === false ? null : resolveGridlyAwarenessArea("Dayton"));
}

function normalizeGridlyAwarenessAreaLookupText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function gridlyNormalizeCountyId(value) {
  const candidate = String(value || "").trim().toLowerCase();
  const countyConfig = GRIDLY_COUNTY_REGISTRY[candidate];
  return countyConfig && countyConfig.operational === true ? candidate : GRIDLY_DEFAULT_COUNTY_ID;
}

function gridlyGetOperationalCountyIds() {
  return Object.keys(GRIDLY_COUNTY_REGISTRY).filter((countyId) => GRIDLY_COUNTY_REGISTRY[countyId]?.operational === true);
}

function gridlyGetSelectableOperationalCountyIds() {
  return gridlyGetOperationalCountyIds().filter((countyId) => GRIDLY_COUNTY_REGISTRY[countyId]?.selectable === true && GRIDLY_COUNTY_REGISTRY[countyId]?.productionEnabled === true);
}

function gridlyLp035FindHoustonRegion(value = "") {
  const normalized = normalizeGridlyAwarenessAreaLookupText(value);
  if (!normalized) return null;
  return GRIDLY_LP035_HOUSTON_REGION_MODEL.find((region) => {
    const labels = [region.id, region.label, `Houston ${region.label}`, `Houston - ${region.label}`, `Houston — ${region.label}`, ...(GRIDLY_LP035_HOUSTON_REGION_LABEL_ALIASES[region.id] || [])];
    return labels.some((label) => normalizeGridlyAwarenessAreaLookupText(label) === normalized);
  }) || null;
}

function gridlyLp035HoustonRegionAwarenessArea(region) {
  if (!region) return null;
  const label = String(region.label || "").trim();
  return Object.freeze({
    key: region.id,
    label,
    storageValue: `Houston — ${label}`,
    countyId: "harris-tx",
    parentCommunity: "Houston",
    awarenessRegionId: region.id,
    awarenessRegionLabel: label,
    lat: region.lat,
    lng: region.lng,
    radiusMiles: 5,
    startupZoom: region.startupZoom || 13,
    houstonRegion: true,
    source: "LP035.1 Houston regional awareness model"
  });
}
/* ACCEPTED_FUNCTIONS_END */
  return Object.freeze({open,applyRuntimeSetup,dispose(){clearTimeout(completionTimer);overlay.__gridlyWalkthroughOrientationCleanup?.();}});
}
