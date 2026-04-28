const BUILD_VERSION = "Gridly V9.1";
const SUPABASE_URL = "https://nhwhkbkludzkuyxmkkcj.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";
const FRA_URL = "https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY";
const DEFAULT_CENTER = [30.0466, -94.8852];
const REPORT_EXPIRATION_MINUTES = 90;
const REPORT_STALE_MINUTES = 45;
const LIVE_REFRESH_MS = 15000;

let supabaseClient = null;
let realtimeChannel = null;
let map;
let crossingLayer;
let userMarker;
let crossings = [];
let activeReports = [];
let userLocation = null;
let deviceId = null;
const els = {};

const ids = ["greetingTitle","greetingSubtitle","timeContext","routeCardLabel","routeStatusCard","routeStatus","routeEta","departureTime","departureReason","delayRisk","delayReason","nearbyAlertCount","activeAlertText","alternateRoute","alternateReason","savedHome","savedWork","homeInput","workInput","saveRouteBtn","useLocationBtn","refreshBtn","simulateDelayBtn","alertsList","impactFill","impactScore","impactText","crossingSelect","crossingSearch","searchResults","manualReportType","manualReportBtn","clearReportsBtn","reportConfirmation","lastUpdated","dataStatus","syncStatus","crossingCount","reportDecayStatus","lastReportTime","mapTrustNote","buildStatus","debugSupabase","debugRead","debugWrite","debugRealtime","debugDevice"];

document.addEventListener("DOMContentLoaded", async () => {
  hydrateElements();
  initDeviceId();
  setDebug("debugDevice", shortDeviceId());
  safeText("buildStatus", `Build: ${BUILD_VERSION}`);
  initGreeting();
  updateLastUpdated();
  initMap();
  loadSavedRoute();
  bindEvents();
  initSupabase();
  await loadCrossings();
  await loadSharedReports();
  startLiveRefresh();
});

function hydrateElements(){ids.forEach(id=>els[id]=document.getElementById(id));}
function initDeviceId(){deviceId=localStorage.getItem("gridlyDeviceId")||`device-${crypto.randomUUID?crypto.randomUUID():Date.now()}`;localStorage.setItem("gridlyDeviceId",deviceId);}
function shortDeviceId(){return deviceId ? deviceId.replace("device-","").slice(0,8) : "unknown";}

function initSupabase(){
  if(!window.supabase){setSyncState("Supabase library missing","error");setDebug("debugSupabase","Missing");return;}
  try{
    supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:10}}});
    setSyncState("Live reports: Supabase ready"); setDebug("debugSupabase","Ready");
    realtimeChannel=supabaseClient.channel("gridly-reports-v9-1")
      .on("postgres_changes",{event:"*",schema:"public",table:"reports"},payload=>{setDebug("debugRealtime",payload.eventType||"Event");loadSharedReports();})
      .subscribe(status=>{setDebug("debugRealtime",status); if(status==="SUBSCRIBED") setSyncState("Live reports: realtime connected");});
  }catch(error){console.error("Supabase init failed",error);setSyncState(`Live reports: init failed - ${humanError(error)}`,"error");setDebug("debugSupabase","Failed");}
}

function initMap(){map=L.map("map",{zoomControl:false}).setView(DEFAULT_CENTER,11);L.control.zoom({position:"bottomright"}).addTo(map);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);crossingLayer=L.layerGroup().addTo(map);}

async function loadCrossings(){
  try{safeText("dataStatus","Crossing data: loading");safeText("mapTrustNote","Loading known public crossings from FRA data...");
    const response=await fetch(FRA_URL); if(!response.ok) throw new Error(`FRA feed returned ${response.status}`); const data=await response.json();
    crossings=(data.features||[]).filter(f=>f.geometry&&f.geometry.coordinates).map((feature,index)=>{const [lng,lat]=feature.geometry.coordinates;const p=feature.properties||{};const id=String(p.crossingid||p.crossing_id||p.crossing_number||`crossing-${index}`);return{id,name:p.street||p.roadwayname||p.highwayname||p.road||p.st_name||"Railroad Crossing",railroad:p.railroad||p.railroadname||p.railroad_company||p.rrname||"Rail line",lat:Number(lat),lng:Number(lng),risk:calculateBaseRisk(p,index),props:p};});
    populateCrossingSelect();renderCrossings();updateRouteIntelligence();updateTrustStats();updateLastUpdated();safeText("dataStatus",`Crossing data: ${crossings.length} known crossings loaded`);safeText("crossingCount",`${crossings.length}`);safeText("mapTrustNote",`${crossings.length} known public crossings loaded from FRA data.`);
  }catch(error){console.error("Gridly crossing load failed",error);safeText("dataStatus","Crossing data: unavailable");safeText("crossingCount","Unavailable");safeText("mapTrustNote","Unable to load FRA crossing data. Try refreshing.");showFallbackAlert();}
}

async function loadSharedReports(){
  if(!supabaseClient){setSyncState("Live reports: unavailable","error");return;}
  try{setSyncState("Live reports: reading");setDebug("debugRead","Reading");
    const nowIso=new Date().toISOString();
    const {data,error}=await supabaseClient.from("reports").select("id,crossing_id,crossing_name,railroad,lat,lng,report_type,severity,detail,source,confidence,device_id,created_at,expires_at").or(`expires_at.is.null,expires_at.gt.${nowIso}`).order("created_at",{ascending:false}).limit(250);
    if(error) throw error;
    activeReports=normalizeReports(data||[]);renderAlerts();renderCrossings();updateRouteIntelligence();updateTrustStats();updateLastUpdated();setSyncState(`Live reports: synced (${getLatestReportsByCrossing().length})`);setDebug("debugRead",`${activeReports.length} rows`);
  }catch(error){console.error("Gridly report sync failed",error);setSyncState(`Live reports: read failed - ${humanError(error)}`,"error");setDebug("debugRead","Failed");showFallbackAlert();}
}

function normalizeReports(rows){return rows.map(row=>{const createdAt=row.created_at||new Date().toISOString();const expiresAt=row.expires_at||new Date(new Date(createdAt).getTime()+REPORT_EXPIRATION_MINUTES*60000).toISOString();const minutesAgo=Math.max(0,Math.floor((Date.now()-new Date(createdAt).getTime())/60000));const type=String(row.report_type||"other").toLowerCase();return{id:row.id,crossingId:String(row.crossing_id||""),crossingName:row.crossing_name||"Railroad Crossing",railroad:row.railroad||"Rail line",lat:Number(row.lat),lng:Number(row.lng),type,severity:row.severity||getReportCopy(type).severity,title:`${row.crossing_name||"Crossing"} ${getReportCopy(type).shortTitle}`,detail:row.detail||getReportCopy(type).detail,source:row.source||"user",confidence:row.confidence||"shared live report",deviceId:row.device_id,submittedAt:createdAt,expiresAt,minutesAgo,expired:new Date(expiresAt).getTime()<=Date.now()};});}

async function createSharedReport(crossing,reportType,confidence){
  if(!supabaseClient){setConfirm("Live report sync is unavailable. Supabase is not connected.","error");return;}
  const copy=getReportCopy(reportType); const now=new Date();
  const row={crossing_id:String(crossing.id),crossing_name:crossing.name,railroad:crossing.railroad,lat:Number(crossing.lat),lng:Number(crossing.lng),report_type:reportType,severity:copy.severity,detail:copy.detail,source:"user",confidence,device_id:deviceId,expires_at:new Date(now.getTime()+REPORT_EXPIRATION_MINUTES*60000).toISOString()};
  try{setSyncState("Live reports: sending");setDebug("debugWrite","Sending");
    const {data,error}=await supabaseClient.from("reports").insert(row).select("id,created_at").single(); if(error) throw error;
    setDebug("debugWrite",data?.id?`Saved ${String(data.id).slice(0,8)}`:"Saved"); await loadSharedReports(); map.setView([crossing.lat,crossing.lng],14);
    setConfirm(`Shared report submitted: ${crossing.name} as ${copy.label}. It should appear on other devices after refresh/realtime sync.`,"success");
  }catch(error){console.error("Gridly report insert failed",error);setSyncState(`Live reports: submit failed - ${humanError(error)}`,"error");setDebug("debugWrite","Failed");setConfirm(`Report submit failed: ${humanError(error)}. Check Supabase RLS insert/select policy and Realtime publication for public.reports.`,"error");}
}

window.reportCrossingFromPopup=(crossingId,reportType)=>{const crossing=crossings.find(item=>String(item.id)===String(crossingId));if(crossing) createSharedReport(crossing,reportType,"exact map marker");};
window.zoomToCrossing=(crossingId)=>{const crossing=crossings.find(item=>String(item.id)===String(crossingId));if(!crossing)return;map.setView([crossing.lat,crossing.lng],15);crossingLayer.eachLayer(layer=>{const ll=layer.getLatLng();if(Number(ll.lat).toFixed(6)===Number(crossing.lat).toFixed(6)&&Number(ll.lng).toFixed(6)===Number(crossing.lng).toFixed(6))layer.openPopup();});};

function renderCrossings(){if(!crossingLayer)return;crossingLayer.clearLayers();crossings.forEach(crossing=>{const report=getLatestReportForCrossing(crossing.id);const hasActiveIssue=report&&report.type!=="cleared"&&!report.expired;const isCleared=report&&report.type==="cleared"&&!report.expired;const isExpired=report&&report.expired;const icon=L.divIcon({className:"",html:`<div class="gridly-marker ${hasActiveIssue?"alert":""} ${isCleared?"cleared":""} ${isExpired?"expired":""}"></div>`,iconSize:[24,24],iconAnchor:[12,12]});L.marker([crossing.lat,crossing.lng],{icon}).bindPopup(buildPopup(crossing,report),{maxWidth:330}).addTo(crossingLayer);});}
function buildPopup(crossing,report){const status=report?report.expired?"Expired report":report.type==="cleared"?"Recently cleared":report.title:"No active report";const source=report?getSourceLabel(report.source):"FRA crossing inventory";const age=report?`${report.minutesAgo} min ago`:"No recent report";const freshness=report?getFreshnessLabel(report):"Verified crossing";return `<div class="gridly-popup"><strong>${sanitizeText(crossing.name)}</strong><span>${sanitizeText(crossing.railroad)}</span><br><span>Status: ${sanitizeText(status)}</span><br><span>Risk Score: ${crossing.risk}/100</span><br><span>Source: ${sanitizeText(source)}</span><br><span>Freshness: ${sanitizeText(freshness)} · ${sanitizeText(age)}</span><div class="popup-report-grid"><button class="popup-report-btn danger" onclick="reportCrossingFromPopup('${sanitizeAttr(crossing.id)}','blocked')">Blocked</button><button class="popup-report-btn warning" onclick="reportCrossingFromPopup('${sanitizeAttr(crossing.id)}','heavy')">Delay</button><button class="popup-report-btn blue" onclick="reportCrossingFromPopup('${sanitizeAttr(crossing.id)}','cleared')">Cleared</button><button class="popup-report-btn neutral" onclick="reportCrossingFromPopup('${sanitizeAttr(crossing.id)}','other')">Other</button></div></div>`;}

function bindEvents(){els.saveRouteBtn?.addEventListener("click",saveRoute);els.useLocationBtn?.addEventListener("click",useMyLocation);els.refreshBtn?.addEventListener("click",refreshReports);els.simulateDelayBtn?.addEventListener("click",simulateDelay);els.manualReportBtn?.addEventListener("click",submitManualReport);els.clearReportsBtn?.addEventListener("click",loadSharedReports);els.crossingSearch?.addEventListener("input",handleCrossingSearch);document.querySelectorAll(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");const targets={dashboard:"dashboardSection",map:"mapSection",routes:"setupCard",report:"reportSection",alerts:"alertsSection"};document.getElementById(targets[btn.dataset.section])?.scrollIntoView({behavior:"smooth",block:"start"});}));}
function saveRoute(){const home=els.homeInput?.value.trim();const work=els.workInput?.value.trim();if(!home||!work){flashButton(els.saveRouteBtn,"Add Home + Work");return;}localStorage.setItem("gridlyHome",home);localStorage.setItem("gridlyWork",work);loadSavedRoute();updateRouteIntelligence();flashButton(els.saveRouteBtn,"Route Saved");}
function loadSavedRoute(){const home=localStorage.getItem("gridlyHome");const work=localStorage.getItem("gridlyWork");if(home){safeText("savedHome",home);if(els.homeInput)els.homeInput.value=home;}if(work){safeText("savedWork",work);if(els.workInput)els.workInput.value=work;}}
function useMyLocation(){if(!navigator.geolocation){flashButton(els.useLocationBtn,"Unavailable");return;}navigator.geolocation.getCurrentPosition(position=>{userLocation={lat:position.coords.latitude,lng:position.coords.longitude};if(userMarker)map.removeLayer(userMarker);userMarker=L.circleMarker([userLocation.lat,userLocation.lng],{radius:9,color:"#43e6a0",fillColor:"#43e6a0",fillOpacity:.85}).bindPopup("Your current location").addTo(map);map.setView([userLocation.lat,userLocation.lng],13);const nearest=findNearestCrossings(userLocation.lat,userLocation.lng,5);updateRouteIntelligence(nearest);setConfirm(nearest.length?`Location found. Nearest crossing: ${nearest[0].name}.`:"Location found, but no nearby crossing was matched.","success");flashButton(els.useLocationBtn,"Location Found");},()=>{setConfirm("Location permission was blocked. Use map popup reporting, search, or manual fallback.","error");flashButton(els.useLocationBtn,"Location Blocked");});}
function submitManualReport(){const crossing=crossings.find(item=>String(item.id)===String(els.crossingSelect?.value));const reportType=els.manualReportType?.value||"blocked";if(!crossing){setConfirm("Choose a crossing before submitting a manual report.","error");return;}createSharedReport(crossing,reportType,"manual fallback");}
async function refreshReports(){await loadSharedReports();flashButton(els.refreshBtn,"Updated");}
async function simulateDelay(){if(!crossings.length)return;const crossing=crossings[Math.floor(Math.random()*crossings.length)];await createSharedReport(crossing,"blocked","simulated demo action");flashButton(els.simulateDelayBtn,"Delay Added");}

function updateRouteIntelligence(nearest=[]){const savedHome=localStorage.getItem("gridlyHome");const savedWork=localStorage.getItem("gridlyWork");const latestReports=getLatestReportsByCrossing();const activeIssues=latestReports.filter(r=>!r.expired&&r.type!=="cleared");const highAlerts=activeIssues.filter(r=>r.severity==="high").length;const moderateAlerts=activeIssues.filter(r=>r.severity==="moderate").length;const crossingRisk=nearest.length?Math.round(nearest.reduce((s,c)=>s+c.risk,0)/nearest.length):28;const impact=Math.min(100,activeIssues.length*10+highAlerts*22+moderateAlerts*8+Math.round(crossingRisk*.35));const extraMinutes=Math.max(0,Math.round(impact/7));safeText("nearbyAlertCount",activeIssues.length);safeText("activeAlertText",activeIssues.length===1?"One active shared report currently affecting the area.":"Live shared reports near your saved or current location.");if(els.impactFill)els.impactFill.style.width=`${impact}%`;safeText("impactScore",`${impact} / 100`);els.routeStatusCard?.classList.remove("clear","delayed","high");if(!savedHome||!savedWork){safeText("routeStatus","Set Route");safeText("routeEta","Save Home + Work");safeText("departureTime","Set route first");safeText("departureReason","Home and Work unlock personalized daily route intelligence.");els.routeStatusCard?.classList.add("delayed");}else if(impact>=70){safeText("routeStatus","Delayed");safeText("routeEta",`ETA 32 min (+${extraMinutes})`);safeText("departureTime","Leave now");safeText("departureReason","High shared route impact detected near your commute window.");els.routeStatusCard?.classList.add("high");}else if(impact>=40){safeText("routeStatus","Watch");safeText("routeEta",`ETA 26 min (+${extraMinutes})`);safeText("departureTime","Leave 8 min early");safeText("departureReason","Moderate shared report risk near one or more crossings.");els.routeStatusCard?.classList.add("delayed");}else{safeText("routeStatus","Clear");safeText("routeEta","ETA 21 min");safeText("departureTime","Normal departure");safeText("departureReason","No major active shared delay detected.");els.routeStatusCard?.classList.add("clear");}if(impact>=70){safeText("delayRisk","High");safeText("delayReason","Multiple shared reports or one major crossing blockage detected.");safeText("alternateRoute","Use alternate");safeText("alternateReason","Avoid the highest-impact crossing if possible.");safeText("impactText","High route impact. Gridly recommends leaving now or rerouting.");}else if(impact>=40){safeText("delayRisk","Moderate");safeText("delayReason","Some nearby crossing or traffic risk detected.");safeText("alternateRoute","Have backup");safeText("alternateReason","Alternate route may help if reports increase.");safeText("impactText","Moderate route impact. Watch your commute before leaving.");}else{safeText("delayRisk","Low");safeText("delayReason","No major live reports affecting the area.");safeText("alternateRoute","Not needed");safeText("alternateReason","Current route appears clear.");safeText("impactText","Low route impact. Normal travel expected.");}}
function renderAlerts(){if(!els.alertsList)return;const latestReports=getLatestReportsByCrossing();if(!latestReports.length){els.alertsList.innerHTML=`<div class="alert-item"><strong>No active shared alerts</strong><p>Your saved route looks quiet right now.</p></div>`;return;}els.alertsList.innerHTML=latestReports.slice(0,10).map(report=>{const label=report.expired?"Expired":report.type==="cleared"?"Cleared":report.severity==="high"?"High Impact":report.severity==="moderate"?"Moderate":"Watch";return `<div class="alert-item"><strong>${sanitizeText(report.title)}</strong><p>${label} · ${report.minutesAgo} min ago · ${sanitizeText(getFreshnessLabel(report))}</p><p>${sanitizeText(report.detail)}</p><span class="source-pill">${sanitizeText(getSourceLabel(report.source))}</span></div>`;}).join("");}
function updateTrustStats(){const latestReports=getLatestReportsByCrossing();const active=latestReports.filter(r=>!r.expired);const lastReport=[...activeReports].sort((a,b)=>new Date(b.submittedAt||0)-new Date(a.submittedAt||0))[0];safeText("reportDecayStatus",`${REPORT_EXPIRATION_MINUTES} min expiry`);safeText("lastReportTime",lastReport?`${lastReport.minutesAgo} min ago`:"None yet");safeText("nearbyAlertCount",active.filter(r=>r.type!=="cleared").length);}
function getLatestReportForCrossing(crossingId){return activeReports.filter(r=>String(r.crossingId)===String(crossingId)).sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt))[0];}
function getLatestReportsByCrossing(){const mapByCrossing=new Map();activeReports.filter(r=>!r.expired).sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)).forEach(r=>{if(!mapByCrossing.has(String(r.crossingId)))mapByCrossing.set(String(r.crossingId),r);});return [...mapByCrossing.values()];}
function getFreshnessLabel(report){if(report.expired)return"Expired";if(report.minutesAgo>=REPORT_STALE_MINUTES)return"Stale soon";if(report.minutesAgo>=15)return"Recent";return"Fresh";}
function getSourceLabel(source){return{user:"Shared user report",demo:"Demo report",simulated:"Simulated report"}[source]||"Shared report";}
function getReportCopy(type){const types={blocked:{label:"Blocked",shortTitle:"blocked",detail:"Shared report: crossing or road appears blocked.",severity:"high"},heavy:{label:"Heavy Delay",shortTitle:"heavy delay",detail:"Shared report: traffic is moving slowly near this crossing.",severity:"moderate"},cleared:{label:"Cleared",shortTitle:"cleared",detail:"Shared report: previous issue appears cleared.",severity:"low"},other:{label:"Other Issue",shortTitle:"issue",detail:"Shared report: local road issue may affect travel.",severity:"moderate"}};return types[type]||types.other;}
function populateCrossingSelect(){if(!els.crossingSelect)return;const sorted=[...crossings].sort((a,b)=>a.name.localeCompare(b.name));els.crossingSelect.innerHTML=`<option value="">Choose a crossing</option>${sorted.map(c=>`<option value="${sanitizeAttr(c.id)}">${sanitizeText(c.name)} · ${sanitizeText(c.railroad)}</option>`).join("")}`;}
function handleCrossingSearch(){const query=els.crossingSearch?.value.trim().toLowerCase()||"";if(!query){els.searchResults.innerHTML="";return;}const matches=crossings.filter(c=>`${c.name} ${c.railroad}`.toLowerCase().includes(query)).slice(0,6);els.searchResults.innerHTML=matches.length?matches.map(c=>`<button class="search-result-btn" type="button" onclick="zoomToCrossing('${sanitizeAttr(c.id)}')">${sanitizeText(c.name)}<span>${sanitizeText(c.railroad)} · Click to zoom and report from map</span></button>`).join(""):`<button class="search-result-btn" type="button">No matching crossing found<span>Try a street name, crossing name, or railroad.</span></button>`;}
function findNearestCrossings(lat,lng,count=5){return crossings.map(c=>({...c,distance:haversineDistance(lat,lng,c.lat,c.lng)})).sort((a,b)=>a.distance-b.distance).slice(0,count);}
function haversineDistance(lat1,lng1,lat2,lng2){const r=3958.8;const dLat=toRad(lat2-lat1);const dLng=toRad(lng2-lng1);const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;return 2*r*Math.asin(Math.sqrt(a));}
function toRad(v){return v*Math.PI/180;}
function calculateBaseRisk(props,index){let score=18;const traffic=Number(props.aadt||props.avgdailytraffic||props.traffic||0);const trains=Number(props.daythrutrain||props.totaltrains||props.trains||0);if(traffic>5000)score+=20;if(traffic>10000)score+=12;if(trains>5)score+=14;if(trains>15)score+=14;score+=index%7;return Math.min(score,82);}
function initGreeting(){const hour=new Date().getHours();if(hour>=5&&hour<12)setGreeting("Good Morning","Morning Route Intelligence","Check your work route before leaving. Gridly watches crossings, route risk, and shared live reports.","Work Route");else if(hour>=12&&hour<17)setGreeting("Good Afternoon","Midday Mobility Check","Heading out soon? Gridly checks nearby crossings, slowdowns, and active road issues.","Current Route");else if(hour>=17&&hour<22)setGreeting("Good Evening","Evening Commute Intelligence","Check your route home before you leave. Gridly watches for crossing delays and local traffic impacts.","Commute Home");else setGreeting("Late Night Check","After-Hours Route Watch","Quiet roads are still worth checking. Gridly looks for late-night rail delays and blocked crossings.","Night Route");}
function setGreeting(title,context,subtitle,routeLabel){safeText("greetingTitle",title);safeText("timeContext",context);safeText("greetingSubtitle",subtitle);safeText("routeCardLabel",routeLabel);}
function updateLastUpdated(){const now=new Date();safeText("lastUpdated",`Last updated: ${now.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}`);}
function startLiveRefresh(){setInterval(loadSharedReports,LIVE_REFRESH_MS);}
function showFallbackAlert(){if(!els.alertsList)return;els.alertsList.innerHTML=`<div class="alert-item"><strong>Crossing data or live reports unavailable</strong><p>Gridly could not load one of its feeds. Try refreshing the page.</p></div>`;}
function flashButton(button,message){if(!button)return;const original=button.textContent;button.textContent=message;setTimeout(()=>button.textContent=original,1300);}
function safeText(id,value){if(els[id])els[id].textContent=value;}
function setDebug(id,value){safeText(id,value);}
function setSyncState(message,type="normal"){safeText("syncStatus",message);}
function setConfirm(message,type="normal"){if(!els.reportConfirmation)return;els.reportConfirmation.textContent=message;els.reportConfirmation.classList.remove("success","error");if(type)els.reportConfirmation.classList.add(type);}
function humanError(error){return error?.message||error?.details||error?.hint||String(error||"Unknown error");}
function sanitizeText(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function sanitizeAttr(value){return sanitizeText(value).replaceAll("`","");}
