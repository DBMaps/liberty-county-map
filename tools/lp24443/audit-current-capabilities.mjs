// Audit-only: reads tracked text and writes evidence under reports/. No runtime execution or network.
import fs from 'node:fs';
import cp from 'node:child_process';
const root = cp.execFileSync('git', ['rev-parse','--show-toplevel'], {encoding:'utf8'}).trim();
process.chdir(root);
const changed=cp.execFileSync('git',['diff','--name-only','647c85a30d042a90276c3915ba92538df78ddf1c'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
if(changed.some(p=>!/^docs\/launch\/LP24443-|^reports\/lp24443-|^tools\/lp24443\//i.test(p)))throw new Error('Baseline source differs; run this audit against its recorded baseline.');
const files = cp.execFileSync('git',['ls-tree','-r','--name-only','-z','647c85a30d042a90276c3915ba92538df78ddf1c'],{encoding:'utf8',maxBuffer:16e6}).split('\0').filter(Boolean);
const groups = {
  route: /\broute\b|routeWatch|route watch|corridor|destination|origin|polyline|route geometry|route hazards|near route|distance ahead|\bahead\b|\btrip\b|\btravel\b|\bwatch\b|journey|waypoint|proximity/i,
  notifications: /notification|\bpush\b|showNotification|Notification\.permission|PushManager|subscription|\bFCM\b|Firebase|\bAPNs\b|Apple Push Notification|device token|registration token|deep link|\bintent\b|UNUserNotificationCenter/i,
  delivery: /showNotification|Notification\.requestPermission|Notification\.permission|PushManager|pushNotificationReceived|pushNotificationActionPerformed|FirebaseMessagingService|UNUserNotificationCenter|POST_NOTIFICATIONS|appUrlOpen|aps-environment|notification_subscriptions|push_token|device_token/i,
  winter: /\bice\b|\bicy\b|black ice|\bsnow\b|\bsleet\b|freezing rain|\bfreeze\b|\bfrozen\b|winter|bridge ice|overpass ice|blowing snow|reduced visibility/i,
  privacy: /localStorage|sessionStorage|indexedDB|caches\.|analytics|telemetry|console\.|device_id/i,
};
const results = Object.fromEntries(Object.keys(groups).map(k=>[k,[]]));
const scanned=[]; const skipped=[];
for(const file of files){
  if(/lp24443/i.test(file)) continue;
  if(!/\.(?:js|mjs|cjs|ts|json|html|md|sql|toml|xml|plist|swift|kt|java|gradle|geojson|pbxproj|yml|yaml|txt|ps1|sh|bat|cmd|css|xcconfig|properties|entitlements|xcworkspacedata|xcscheme|storyboard|xcprivacy|xcsettings)$/.test(file)){skipped.push({file,reason:'non-text-extension'});continue;}
  const stat=fs.statSync(file);
  if(stat.size>12e6){skipped.push({file,reason:'large-data-over-12MB',bytes:stat.size});continue;}
  const source=fs.readFileSync(file,'utf8');scanned.push(file);
  const lines=source.split(/\r?\n/);
  for(const [name,re] of Object.entries(groups)){
    const hits=[];let count=0;
    lines.forEach((line,i)=>{if(re.test(line)){count++;if(hits.length<6)hits.push({line:i+1,excerpt:line.slice(0,230)});}});
    if(count)results[name].push({file,count,examples:hits});
  }
}
const app=fs.readFileSync('js/app.js','utf8');
function objectLiteral(name){const start=app.indexOf(`const ${name} = {`);if(start<0)return null;const from=app.indexOf('{',start);const to=app.indexOf('\n};',from);return Function(`"use strict";return (${app.slice(from,to+2)})`)();}
function literal(file,name,terminator){const source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');const marker=`const ${name} = `;const start=source.indexOf(marker)+marker.length;if(start<marker.length)throw new Error(name);const end=source.indexOf(terminator,start);if(end<0)throw new Error(name);return Function(`"use strict";return (${source.slice(start,end+terminator.length-1).trim()})`)();}
const output={schemaVersion:1,audit:'LP244.43',startingHead:'647c85a30d042a90276c3915ba92538df78ddf1c',scope:'Tracked repository text; generated/native dependencies and owner-local secrets excluded by tracked-file inventory. No production observation.',trackedFiles:files.length,scannedTextFiles:scanned.length,skipped,searchPatterns:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.source])),results,hazardTypes:objectLiteral('HAZARD_TYPES'),hazardAliases:objectLiteral('HAZARD_CATEGORY_MAP'),capabilities:{home:'persisted canonical identity; selected awareness derives from home',destination:'search/marker/route preview foundation; no independent all-surface community context',aroundMe:'foreground location and nearest context; mixed browser/custom native providers',routeWatch:'implemented foreground route and live proximity foundation; no certified background trip delivery',routing:'public OSRM driving route and nearest APIs',notifications:'PARTIALLY IMPLEMENTED: preferences and diagnostic candidates; delivery NOT IMPLEMENTED',androidPush:'missing app push integration and configuration',iosPush:'missing push capability, entitlements and registration callbacks',backend:'report, geocoding, retention and moderation foundation; no push subscription/queue implementation',winter:'ice runtime type and retrieval exist; absent primary road picker; water marker alias',deepLinks:'iOS delegate proxy scaffold; no consumer target dispatcher'}};
output.taxonomyDefinitions={roadPicker:literal('js/app.js','ROAD_HAZARD_TYPE_OPTIONS','\n];'),otherHazardSubtypes:literal('js/app.js','OTHER_HAZARD_SUBTYPE_OPTIONS','\n]);'),productionMarkerAssets:literal('js/app.js','GRIDLY_PRODUCTION_MARKER_CATEGORY_ASSETS','\n});'),weatherCategories:literal('js/gridlyWeatherProvider.js','NORMALIZED_CATEGORIES','\n  ]);'),driveTexasCategories:literal('js/gridlyDriveTexasProvider.js','NORMALIZED_CATEGORIES','\n  ]);'),conditionDisplay:Object.fromEntries(['COMMUNITY_LABELS','OTHER_HAZARD_SUBTYPE_LABELS','OFFICIAL_ROADWAY_LABELS','OFFICIAL_ROADWAY_GROUP_LABELS'].map(name=>[name,literal('js/gridlyConditionDisplayLabel.js',name,'\n  });')]))};
fs.mkdirSync('reports',{recursive:true});
fs.writeFileSync('reports/lp24443-current-capability-inventory.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({tracked:files.length,scanned:scanned.length,skipped:skipped.length,matchedFiles:Object.fromEntries(Object.entries(results).map(([k,v])=>[k,v.length])),deliveryRuntime:results.delivery.filter(x=>/^(js\/|android\/|ios\/|supabase\/)|^service-worker/.test(x.file)).map(x=>({file:x.file,count:x.count}))}));
