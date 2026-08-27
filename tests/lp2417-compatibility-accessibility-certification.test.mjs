import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8'), css=fs.readFileSync('css/styles.css','utf8'), app=fs.readFileSync('js/app.js','utf8');
test('document semantics and user zoom remain accessible',()=>{ assert.match(html,/<html[^>]+lang="en"/); assert.match(html,/<title>Gridly/); assert.doesNotMatch(html,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i); });
test('shared modal and focus contracts are present',()=>{ assert.match(html,/role="dialog"/); assert.match(html,/aria-live=/); assert.match(app,/event\.key\s*===?\s*["']Escape/); assert.match(app,/__opener\.focus|previousActive\.focus|lastRouteSetupTrigger/); assert.match(app,/\binert\b/); });
test('responsive accessibility contracts are present',()=>{ assert.match(css,/env\(safe-area-inset-/); assert.match(css,/100dvh|100svh/); assert.match(css,/prefers-reduced-motion\s*:\s*reduce/); assert.match(css,/:focus-visible/); });
test('PWA contract is valid and referenced icons exist',()=>{ const m=JSON.parse(fs.readFileSync('manifest.json')); assert.equal(m.display,'standalone'); for(const icon of m.icons) assert.ok(fs.existsSync(icon.src.replace(/^\.\//,'')),icon.src); assert.match(fs.readFileSync('service-worker.js','utf8'),/install/); });
test('OA-1 rendered keyboard helper is passive and exposes the bounded acceptance contract',()=>{
  const start=app.indexOf('function gridlyLP2417KeyboardAcceptance()');
  const end=app.indexOf('window.gridlyLP2417KeyboardAcceptance = gridlyLP2417KeyboardAcceptance;',start);
  assert.ok(start>0&&end>start);
  const helper=app.slice(start,end);
  for(const field of ['focusableCount','essentialControlCount','unnamedEssentialControls','hiddenFocusableDefinedCount','hiddenFocusableControls','hiddenButTabReachableControls','properlyExcludedHiddenControls','positiveTabIndexControls','genericFocusableControls','genericFocusableControlsWithoutKeyboardSemantics','pointerOnlyEssentialActions','modalFocusContract','escapeContract','focusRestorationContract','deterministicPass','physicalSpotChecksRemaining','focusOrderProjection']) assert.match(helper,new RegExp(field));
  assert.match(helper,/getComputedStyle|getClientRects/);
  assert.match(helper,/aria-labelledby|aria-label|element\.labels/);
  assert.doesNotMatch(helper,/\.click\(|\.focus\(|dispatchEvent|\.submit\(|localStorage|sessionStorage|fetch\(/);
});
test('map keyboard contract keeps the named map while excluding redundant marker stops',()=>{
  assert.match(html,/id="map"[^>]+role="region"[^>]+aria-label="Interactive travel conditions map\. Use arrow keys to pan\."/);
  assert.match(app,/leafletKeyboardContainer[\s\S]*?map\?\.keyboard\?\.enabled/);
  assert.match(app,/"Gridly crossing-inventory Leaflet marker"/);
  assert.match(app,/L\.marker\(\[crossing\.lat, crossing\.lng\], \{ icon, keyboard: false/);
  assert.match(app,/gridlyMarkerType: "drivetexas_official"[\s\S]*?keyboard: false|keyboard: false[\s\S]*?gridlyMarkerType: "drivetexas_official"/);
  assert.match(app,/sourceIncident: incident[\s\S]*?keyboard: false|keyboard: false[\s\S]*?sourceIncident: incident/);
});
test('hidden focus definitions are separated from real hidden Tab leaks',()=>{
  assert.match(app,/hiddenButTabReachable = hiddenFocusable\.filter\(\(item\) => !item\.excludedFromSequentialFocus\)/);
  assert.match(app,/properlyExcludedHidden = hiddenFocusable\.filter\(\(item\) => item\.excludedFromSequentialFocus\)/);
  assert.match(app,/deterministicPass:[^\n]+!hiddenButTabReachable\.length/);
});
test('non-actionable route status container is not a false keyboard stop',()=>{
  assert.doesNotMatch(html,/<div[^>]+id="routeStatusCard"[^>]+(?:role="button"|tabindex="0")/);
  assert.match(html,/id="mobileEditRouteBtn"[^>]+aria-label="Edit saved route"/);
  assert.match(app,/mobileDestinationCommandImpact[\s\S]*?addEventListener\("keydown"[\s\S]*?event\.key !== "Enter" && event\.key !== " "/);
});
test('OA-1 Settings uses one native click authority for Enter, Space, and pointer activation',()=>{
  const start=app.indexOf('function bindGridlySettingsActivation(');
  const end=app.indexOf('window.gridlySettingsActivationAudit =',start);
  assert.ok(start>0&&end>start);
  const binding=app.slice(start,end);
  assert.match(binding,/gridlySettingsActivationBound/);
  assert.match(binding,/addEventListener\("click"/);
  assert.match(binding,/openSettingsSurfaceFromDock\("native_settings_button_click"\)/);
  assert.doesNotMatch(binding,/event\.key\s*===|\.click\(\)|dispatchEvent/);
  assert.match(app,/if \(intent === 'settings'\) \{\s*bindGridlySettingsActivation\(button\)/);
});
test('OA-1 Settings audit is bounded to button identity, native events, and open outcome',()=>{
  for(const field of ['settingsButtonIdentity','settingsButtonConnected','settingsButtonVisible','settingsButtonListenerAuthority','keydown','keyup','click','settingsOpenAttempted','settingsOpenSucceeded','settingsOpenFailureReason']) assert.match(app,new RegExp(field));
  assert.match(app,/isTrusted: Boolean\(event\.isTrusted\)/);
  assert.match(app,/pointerType: event\.pointerType \|\| null/);
});
test('OA-1 Settings console acceptance exercises one production open and close lifecycle',()=>{
  const start=app.indexOf('function gridlyLP2417SettingsAcceptance()');
  const end=app.indexOf('window.gridlyLP2417SettingsAcceptance = gridlyLP2417SettingsAcceptance;',start);
  assert.ok(start>0&&end>start);
  const helper=app.slice(start,end);
  for(const field of ['openerFound','openerNativeButton','openerVisible','openerEnabled','listenerBindAttemptCount','listenerAttachedCount','openAttemptDelta','openSuccessDelta','opened','focusEnteredSettings','closed','focusRestoredToOpener','duplicateOpenDetected','BEFORE_ACTIVATION','AFTER_ACTIVATION_BEFORE_CLOSE','AFTER_CLOSE','visibleSettingsSurfaceCount','activeSettingsSurfaceIds','focusedElement','pass']) assert.match(helper,new RegExp(field));
  assert.match(helper,/getGridlySettingsDockButton\(\)/);
  assert.match(helper,/opener\.click\(\)/);
  assert.match(helper,/gridlySettingsActivationAudit\.settingsOpenAttempted/);
  assert.match(helper,/gridlySettingsActivationAudit\.settingsOpenSucceeded/);
  assert.match(helper,/closeButton\?\.click\(\)/);
  assert.doesNotMatch(helper,/openSettingsSurfaceFromDock\(|openPortraitV2Sheet\(|closePortraitV2Sheet\(/);
  assert.doesNotMatch(helper,/\.hidden\s*=|\.style\.|setAttribute\(["'](?:hidden|style)|localStorage|sessionStorage|fetch\(|XMLHttpRequest|submit|saveGridly|awareness|route|report/i);
});
test('Settings surface classification ignores dormant markup and detects simultaneous visible surfaces',()=>{
  const start=app.indexOf('function classifyGridlySettingsSurfaces(');
  const end=app.indexOf('\n}\n\nfunction getGridlySettingsSurfaceState()',start)+2;
  assert.ok(start>0&&end>start);
  const classify=Function(`${app.slice(start,end)}; return classifyGridlySettingsSurfaces;`)();
  const portrait={id:'gridlyPortraitV2Sheet'}, legacy={id:'settingsModal'};
  let state=classify([portrait,legacy],(node)=>node===portrait);
  assert.equal(state.visibleSettingsSurfaceCount,1,'dormant alternate markup is not an active duplicate');
  assert.deepEqual(state.activeSettingsSurfaces,[portrait]);
  state=classify([portrait,legacy],()=>true);
  assert.equal(state.visibleSettingsSurfaceCount,2,'two simultaneously visible Settings surfaces are a duplicate');
});
test('Settings acceptance samples the active visible surface before close and bounds focus to it',()=>{
  const start=app.indexOf('function gridlyLP2417SettingsAcceptance()');
  const end=app.indexOf('window.gridlyLP2417SettingsAcceptance = gridlyLP2417SettingsAcceptance;',start);
  const helper=app.slice(start,end);
  assert.ok(helper.indexOf('const afterActivation = checkpoint()') < helper.indexOf('closeButton?.click()'));
  assert.match(helper,/opened = afterActivation\.visibleSettingsSurfaceCount === 1/);
  assert.match(helper,/afterActivation\.activeSettingsSurfaces\[0\]\.contains\(document\.activeElement\)/);
  assert.match(helper,/duplicateOpenDetected = afterActivation\.visibleSettingsSurfaceCount > 1/);
  assert.match(helper,/AFTER_CLOSE[\s\S]*?afterClose\.visibleSettingsSurfaceCount === 0/);
});
test('production Settings success follows the completed visible lifecycle',()=>{
  const start=app.indexOf('function openSettingsSurfaceFromDock(');
  const end=app.indexOf('\n}\n\nfunction bindGridlySettingsDockTapDiagnostics',start)+2;
  const lifecycle=app.slice(start,end);
  assert.match(lifecycle,/lifecycleReportedOpen = Boolean\(openV2Sheet\('settings'\)\)/);
  assert.match(lifecycle,/return visible;/);
  assert.doesNotMatch(lifecycle,/return lifecycleReportedOpen && visible/);
  assert.match(app,/if \(opened\) \{\s*gridlySettingsActivationAudit\.settingsOpenSucceeded \+= 1/);
});
test('OA-1 Settings listener accounting separates binding attempts from the one live attachment',()=>{
  assert.match(app,/listenerBindAttemptCount:\s*0/);
  assert.match(app,/listenerAttachedCount:\s*0/);
  assert.match(app,/gridlySettingsActivationAudit\.listenerBindAttemptCount \+= 1/);
  assert.match(app,/countGridlyAttachedSettingsActivationListeners\(\)/);
  assert.match(app,/node\.isConnected && node\.dataset\.gridlySettingsActivationBound === "true"/);
});
test('production Settings lifecycle enters the sheet and restores its activation opener',()=>{
  assert.match(app,/settingsFocusTarget\?\.focus\?\.\(\)/);
  assert.match(app,/closingSheetName === "settings" && gridlySettingsLastActivationOpener\?\.isConnected/);
  assert.match(app,/gridlySettingsLastActivationOpener\.focus\(\)/);
});
