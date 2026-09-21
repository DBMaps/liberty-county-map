/* LP244.46: additive consumer projection; never a persistence or authorization API. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GridlyHazardNormalization = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const freeze = Object.freeze;
  const key = value => String(value ?? '').trim().toLowerCase().replace(/[ -]+/g, '_');
  const definitions = {
    FLOODING: ['Flooding reported', 'flooding', ['flood', 'flooding']],
    HIGH_WATER: ['High water reported', 'flooding', ['high_water', 'standing_water', 'water_over_road']],
    ROAD_BLOCKED: ['Road appears blocked', 'other_hazard', ['road_blocked', 'road_closed', 'road_closure', 'blocked_road', 'blocked_roadway']],
    ROAD_IMPASSABLE: ['Road appears impassable', 'other_hazard', ['road_impassable', 'impassable', 'winter_impassable']],
    CRASH_SCENE: ['Crash reported', 'crash', ['crash', 'wreck', 'crash_scene', 'crash_incident']],
    DEBRIS: ['Debris in Road', 'debris', ['debris', 'fallen_tree', 'debris_in_road']],
    CONSTRUCTION: ['Construction', 'construction', ['construction', 'road_work']],
    PLANNED_WORK: ['Planned work', 'construction', ['planned_work', 'scheduled_work']],
    RAIL_CROSSING_CONDITION: ['Rail crossing condition reported', 'rail_blockage_delay', ['blocked', 'heavy', 'delayed', 'delay', 'blocked_crossing', 'crossing_blocked', 'train_blocking_crossing', 'rail_blockage_delay', 'rail_blockage', 'rail_blocked', 'rail_delay', 'rail_issue']],
    ICE: ['Ice reported', 'winter', ['ice', 'icy', 'icy_road', 'icy_roads']],
    BLACK_ICE_SUSPECTED: ['Possible black ice reported', 'winter', ['black_ice_suspected', 'black_ice', 'possible_black_ice']],
    BRIDGE_OVERPASS_ICING: ['Bridge or overpass icing reported', 'winter', ['bridge_overpass_icing', 'bridge_icing', 'overpass_icing']],
    SNOW_COVERED_ROAD: ['Snow-covered road reported', 'winter', ['snow_covered_road', 'snow_on_road']],
    SLEET_FREEZING_RAIN: ['Sleet or freezing rain reported', 'winter', ['sleet_freezing_rain', 'sleet', 'freezing_rain']],
    REDUCED_VISIBILITY: ['Reduced visibility reported', 'winter', ['reduced_visibility', 'low_visibility']],
    WINTER_ROAD_HAZARD: ['Winter road hazard reported', 'winter', ['winter_road_hazard', 'winter_hazard']],
    OTHER_ROAD_HAZARD: ['Other Hazard', 'other_hazard', ['other_hazard', 'road_hazard', 'other']],
    DISABLED_VEHICLE: ['Disabled Vehicle', 'disabled_vehicle', ['disabled_vehicle']],
    TRAFFIC_BACKUP: ['Traffic Backup / Heavy Delay', 'traffic_backup', ['traffic_backup', 'heavy_traffic', 'traffic_delay']]
  };
  const aliases = Object.create(null);
  for (const [condition, definition] of Object.entries(definitions)) {
    aliases[key(condition)] = condition;
    for (const alias of definition[2]) aliases[alias] = condition;
    freeze(definition[2]); freeze(definition);
  }
  freeze(definitions); freeze(aliases);
  const advisories = freeze({ USE_CAUTION: 'COMMUNITY_SAFE', EXPECT_DELAYS: 'COMMUNITY_SAFE', MONITOR_CONDITIONS: 'COMMUNITY_SAFE', AVOID_AREA: 'AUTHORIZED_ONLY', RESTRICTED_ACCESS: 'AUTHORIZED_ONLY', IMPASSABLE: 'AUTHORIZED_ONLY', ROAD_CLOSED: 'AUTHORIZED_ONLY', DETOUR_REQUIRED: 'AUTHORIZED_ONLY', TRAFFIC_CONTROL: 'AUTHORIZED_ONLY' });
  const advisoryLabels = freeze({USE_CAUTION:'Use caution',EXPECT_DELAYS:'Expect delays',MONITOR_CONDITIONS:'Monitor conditions',AVOID_AREA:'Avoid Area',RESTRICTED_ACCESS:'Restricted Access',IMPASSABLE:'Impassable',ROAD_CLOSED:'Road Closed',DETOUR_REQUIRED:'Detour Required',TRAFFIC_CONTROL:'Traffic Control'});
  const severityAliases = freeze({ unknown:'UNKNOWN', low:'LOW', minor:'LOW', moderate:'MODERATE', high:'HIGH', severe:'SEVERE', extreme:'SEVERE' });
  const terminal = new Set(['RESOLVED', 'EXPIRED', 'CANCELLED']);
  function lifecycle(record, now = Date.now()) {
    const state = key(record.lifecycleState || record.lifecycle || record.status);
    const type = key(record.report_type || record.type);
    const message = key(record.messageType);
    if (['cancel', 'cancelled', 'canceled'].includes(state) || message === 'cancel') return 'CANCELLED';
    if (['resolved', 'cleared', 'recently_cleared'].includes(state) || ['cleared','hazard_cleared'].includes(type)) return 'RESOLVED';
    const expires = record.expires_at || record.expiresAt || record.expirationTime || record.expires || record.ends || record.endTime || record.end_time;
    if (record.expired === true || ['expired','inactive','historical','stale'].includes(state) || (expires && Number.isFinite(Date.parse(expires)) && Date.parse(expires) <= now)) return 'EXPIRED';
    if (state === 'updated' || message === 'update') return 'UPDATED';
    if (['active', 'actual', 'open', 'ongoing', 'needs_confirmation', 'confirmed', 'unconfirmed'].includes(state)) return 'ACTIVE';
    // Missing community state follows the existing active-until-expiry contract.
    if (!state) return 'ACTIVE';
    return 'UNKNOWN';
  }
  function geometry(record) {
    const source = record.sourceGeometry || record.__geometry || record.geometry;
    const types = {Point:'POINT', MultiPoint:'POINT', LineString:'LINE', MultiLineString:'LINE', Polygon:'POLYGON', MultiPolygon:'POLYGON'};
    const validPair = pair => Array.isArray(pair) && pair.length >= 2 && pair.slice(0,2).every(v=>typeof v === 'number' && Number.isFinite(v)) && Math.abs(pair[0])<=180 && Math.abs(pair[1])<=90;
    const line = value => Array.isArray(value) && value.length>=2 && value.every(validPair);
    const ring = value => line(value) && value.length>=4 && value[0][0]===value.at(-1)[0] && value[0][1]===value.at(-1)[1];
    const polygon = value => Array.isArray(value) && value.length>0 && value.every(ring);
    const valid = source && Object.prototype.hasOwnProperty.call(types, source.type) && ({Point:validPair,MultiPoint:v=>Array.isArray(v)&&v.length>0&&v.every(validPair),LineString:line,MultiLineString:v=>Array.isArray(v)&&v.length>0&&v.every(line),Polygon:polygon,MultiPolygon:v=>Array.isArray(v)&&v.length>0&&v.every(polygon)})[source.type]?.(source.coordinates);
    if (valid) return { geometryPrecision: types[source.type], sourceGeometry: JSON.parse(JSON.stringify(source)) };
    const lat = record.lat ?? record.latitude, lng = record.lng ?? record.longitude ?? record.lon;
    if (lat !== null && lng !== null && lat !== '' && lng !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180) return { geometryPrecision:'POINT', sourceGeometry:{type:'Point',coordinates:[Number(lng),Number(lat)]} };
    return { geometryPrecision: record.roadSegmentId ? 'ROAD_SEGMENT' : record.placeGeoid || record.placeId ? 'PLACE_ONLY' : record.countyId || record.county_id || record.county ? 'COUNTY_ONLY' : 'UNKNOWN', sourceGeometry:null };
  }
  function normalize(record = {}, boundary = 'community', now = Date.now()) {
    // boundary is chosen by the ingest caller, never from a payload's claimed source/authority.
    const official = boundary === 'drivetexas' || boundary === 'nws';
    const weather = boundary === 'nws';
    const authorityClass = official ? 'OFFICIAL_PUBLIC' : boundary === 'derived' ? 'SYSTEM_DERIVED' : 'COMMUNITY_OBSERVATION';
    const rawType = key(record.report_type || record.reportType || record.hazardType || record.type || record.condition || record.event_type || record.eventType || record.category);
    let condition = weather ? 'NOT_APPLICABLE' : aliases[rawType] || 'UNKNOWN';
    const evidence = String(record.condition || record.event_type || record.eventType || record.category || rawType).toLowerCase();
    if (official && !weather && !aliases[rawType]) {
      if (/high.?water/.test(evidence)) condition = 'HIGH_WATER';
      else if (/flood/.test(evidence)) condition = 'FLOODING';
      else if (/crash|accident/.test(evidence)) condition = 'CRASH_SCENE';
      else if (/construction/.test(evidence)) condition = 'CONSTRUCTION';
      else if (/planned|scheduled/.test(evidence)) condition = 'PLANNED_WORK';
      else if (/impassable/.test(evidence)) condition = 'ROAD_IMPASSABLE';
      else if (/blocked/.test(evidence)) condition = 'ROAD_BLOCKED';
    }
    // A closure status alone is not evidence of a physical obstruction.
    if (official && !weather && /^(road_)?clos(ed|ure)$/.test(rawType)) condition = 'UNKNOWN';
    const requested = key(record.advisory).toUpperCase();
    let advisory = advisories[requested] && (official || advisories[requested] === 'COMMUNITY_SAFE') ? requested : 'UNKNOWN';
    if (official && !weather && /(?:road.?clos(?:ed|ure)|^closure$)/.test(evidence)) advisory = 'ROAD_CLOSED';
    if (official && !weather && advisory === 'UNKNOWN' && /^(?:detour_required|required_detour)$/.test(rawType)) advisory = 'DETOUR_REQUIRED';
    if (!official && advisory === 'UNKNOWN' && !['OTHER_ROAD_HAZARD','UNKNOWN'].includes(condition)) advisory = condition === 'TRAFFIC_BACKUP' ? 'EXPECT_DELAYS' : 'USE_CAUTION';
    if (weather && advisory === 'UNKNOWN') advisory = 'MONITOR_CONDITIONS';
    const spatial = geometry(record);
    const severityKey = key(record.severity);
    const severity = Object.prototype.hasOwnProperty.call(severityAliases,severityKey) ? severityAliases[severityKey] : 'UNKNOWN';
    const result = { version:1, condition, severity, advisory, advisoryAuthority:advisories[advisory] || 'NOT_APPLICABLE', authorityClass,
      confidence:freeze({ level: typeof record.confidence === 'number' && Number.isFinite(record.confidence) ? Math.max(0,Math.min(1,record.confidence)) : 'UNKNOWN', sourceValue:['string','number'].includes(typeof (record.confidence ?? record.certainty)) ? (record.confidence ?? record.certainty) : null, confirmationCount:Math.max(0,Number(record.confirmationCount || record.confirmations || record.reports_count) || 0) }),
      lifecycle:lifecycle(record,now), geometryPrecision:spatial.geometryPrecision, sourceGeometry:spatial.sourceGeometry,
      provenance:freeze({ source:boundary, sourceId:String(record.id || record.__sourceId || record.GLOBALID || ''), rawType, sourceClassification:String(record.condition || record.category || record.event || rawType), observedAt:record.created_at || record.startTime || record.effective || null, updatedAt:record.updated_at || record.updatedAt || record.last_updated || record.sent || null }),
      weatherPhenomenon:weather ? String(record.event || record.headline || record.category || 'Weather Alert') : null,
      expiresAt:record.expires_at || record.expiresAt || record.expirationTime || record.expires || record.ends || record.endTime || record.end_time || null,
      accessObservation: record.impassableObserved === true || condition === 'ROAD_IMPASSABLE' ? 'ROAD_IMPASSABLE' : 'UNKNOWN',
      markerFamily:weather ? 'weather' : definitions[condition]?.[1] || 'other_hazard'
    };
    // Stable semantic revision only: confirmations, recency and wording do not create reopening evidence.
    result.materialRevision = JSON.stringify([condition,severity,advisory,result.lifecycle,result.geometryPrecision,result.sourceGeometry,official ? result.expiresAt : null,result.accessObservation]);
    return freeze(result);
  }
  function label(event) {
    if (event.weatherPhenomenon) return event.weatherPhenomenon;
    if (event.authorityClass === 'OFFICIAL_PUBLIC' && advisories[event.advisory] === 'AUTHORIZED_ONLY') return advisoryLabels[event.advisory];
    const conditionLabel = definitions[event.condition]?.[0] || 'Road condition reported';
    return event.accessObservation === 'ROAD_IMPASSABLE' && event.condition !== 'ROAD_IMPASSABLE' ? conditionLabel + '; road appears impassable' : conditionLabel;
  }
  function isActive(event, now = Date.now()) { return ['ACTIVE','UPDATED'].includes(event.lifecycle) && !(event.expiresAt && Date.parse(event.expiresAt) <= now); }
  function materiallyReopened(previous, next) { return terminal.has(previous.lifecycle) && isActive(next) && Boolean(previous.provenance.sourceId) && previous.provenance.sourceId === next.provenance.sourceId && Boolean(next.provenance.updatedAt) && Date.parse(next.provenance.updatedAt) > Date.parse(previous.provenance.updatedAt || previous.provenance.observedAt || '') && previous.materialRevision !== next.materialRevision; }
  const winterOptions = freeze([
    ['ice','Ice'], ['black_ice_suspected','Possible black ice'], ['bridge_overpass_icing','Bridge / overpass icing'], ['snow_covered_road','Snow-covered road'], ['sleet_freezing_rain','Sleet / freezing rain'], ['reduced_visibility','Reduced visibility'], ['winter_road_hazard','Other winter road hazard']
  ].map(([type,label]) => freeze({type,label})));
  const contract = freeze({
    condition:freeze([...Object.keys(definitions),'UNKNOWN','NOT_APPLICABLE']),
    severity:freeze(['UNKNOWN','LOW','MODERATE','HIGH','SEVERE']),
    authorityClass:freeze(['COMMUNITY_OBSERVATION','OFFICIAL_PUBLIC','AUTHORIZED_ORGANIZATION','SYSTEM_DERIVED']),
    advisoryAuthority:freeze(['COMMUNITY_SAFE','AUTHORIZED_ONLY','DISPATCH_PRIVATE','CONSUMER_PROJECTABLE']),
    lifecycle:freeze(['ACTIVE','UPDATED','RESOLVED','EXPIRED','CANCELLED','UNKNOWN']),
    geometryPrecision:freeze(['POINT','LINE','POLYGON','ROAD_SEGMENT','PLACE_ONLY','COUNTY_ONLY','UNKNOWN'])
  });
  return freeze({ contract, definitions, aliases, advisories, advisoryLabels, winterOptions, normalize, community:(r,n)=>normalize(r,'community',n), road:(r,n)=>normalize(r,'drivetexas',n), weather:(r,n)=>normalize(r,'nws',n), derived:(r,n)=>normalize(r,'derived',n), lifecycle, label, isActive, materiallyReopened });
});
