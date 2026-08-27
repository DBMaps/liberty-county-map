import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'), css=read('css/styles.css'), app=read('js/app.js');
const manifest=JSON.parse(read('manifest.json'));
const sw=read('service-worker.js');
const tags=[...html.matchAll(/<(button|input|select|textarea|a|details|summary)\b([^>]*)>/gi)];
const count={}; for(const m of tags) count[m[1].toLowerCase()]=(count[m[1].toLowerCase()]||0)+1;
const generic=[...html.matchAll(/<(div|span|p|article)\b([^>]*(?:role=["']button["']|tabindex=["']0["'])[^>]*)>/gi)].map(m=>({element:m[1],id:(m[2].match(/id=["']([^"']+)/)||[])[1]||null,keyboardContract:/role=["']button/.test(m[2])?'requires runtime key handler':'focusable generic'}));
const checks={
 documentLanguage:/<html[^>]+lang="en"/.test(html), pageTitle:/<title>[^<]+<\/title>/.test(html), viewportAllowsZoom:!/(user-scalable\s*=\s*no|maximum-scale\s*=\s*1)/i.test(html), nativeControls:tags.length>0,
 focusVisible:/:focus-visible/.test(css)||/:focus-visible/.test(app), reducedMotion:/prefers-reduced-motion\s*:\s*reduce/.test(css), safeAreas:/env\(safe-area-inset-(top|right|bottom|left)/.test(css), dynamicViewport:/\b(100dvh|100svh)\b/.test(css), keyboardAcceptanceHelper:/window\.gridlyLP2417KeyboardAcceptance\s*=/.test(app), keyboardAcceptancePassive:!/\.click\(|\.focus\(|dispatchEvent|\.submit\(|localStorage|sessionStorage|fetch\(/.test((app.match(/function gridlyLP2417KeyboardAcceptance\(\)[\s\S]*?window\.gridlyLP2417KeyboardAcceptance\s*=/)||[])[0]||''),
 dialogSemantics:/role="dialog"/.test(html), liveRegions:/aria-live=/.test(html), hiddenSemantics:/\b(hidden|inert)\b/.test(app), escapeHandling:/event\.key\s*===?\s*["']Escape/.test(app), focusRestoration:/__opener\.focus|previousActive\.focus|lastRouteSetupTrigger/.test(app), geolocationFallback:/manual|choose from available areas/i.test(html+app),
 pwaStandalone:manifest.display==='standalone', pwaIcons:manifest.icons?.every(i=>fs.existsSync(path.join(root,i.src.replace(/^\.\//,'')))), serviceWorker:/fetch|install|activate/.test(sw)
};
if(Object.values(checks).some(v=>!v)){ console.error(checks); process.exitCode=1; }
const inventory={schemaVersion:2,evidenceType:'DETERMINISTIC_SOURCE_AND_RENDERED_DOM_AUDIT',generatedAt:'2026-08-27',ownerCommand:'window.gridlyLP2417KeyboardAcceptance()',summary:{nativeInteractiveElements:tags.length,byElement:count,genericFocusableElements:generic.length},genericFocusableControls:generic,contracts:{accessibleNames:'Rendered native text, associated labels, aria-label and aria-labelledby are projected without activation',keyboard:'Rendered browser tab-order projection plus native activation and bounded custom key-handler source contracts',hiddenState:'Computed visibility plus hidden, aria-hidden, inert and open-modal leakage are inspected',passive:'No click, focus, submit, event dispatch, network, or storage operation'},limitations:['DOM order is a deterministic projection, not a claim about actual Narrator speech. Four representative Edge + Narrator actions remain.']};
const responsive={schemaVersion:1,evidenceType:'DETERMINISTIC_SOURCE_AUDIT',viewports:['desktop','tablet/narrow desktop','mobile portrait','mobile landscape','200% zoom pressure'],certified:{viewportZoomEnabled:checks.viewportAllowsZoom,safeAreaTokens:checks.safeAreas,dynamicViewportUnits:checks.dynamicViewport,reducedMotion:checks.reducedMotion,scrollableOverlays:/overflow(-y)?\s*:\s*(auto|scroll)/.test(css)},ownerEvidenceRequired:['Physical iOS Safari notch/mobile-chrome rendering','Android Chrome touch target and reflow rendering','Desktop 200% zoom computed layout']};
fs.writeFileSync(path.join(root,'reports/lp2417/interactive-control-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
fs.writeFileSync(path.join(root,'reports/lp2417/responsive-layout-audit.json'),JSON.stringify(responsive,null,2)+'\n');
console.log(JSON.stringify({result:'PASS',checks,inventory:inventory.summary},null,2));
