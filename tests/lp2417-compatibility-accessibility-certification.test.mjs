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
