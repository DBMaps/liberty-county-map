/* Exact owner-approved PNG assets. No artwork generation or transformation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GridlyMarkerRegistry=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const entries={
  "ice": {
    "condition": "ice",
    "label": "Ice / Icy Road",
    "asset": "01-icy-road.png",
    "family": "winter",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1254,
    "height": 1254
  },
  "black_ice_suspected": {
    "condition": "black_ice_suspected",
    "label": "Possible Black Ice",
    "asset": "02-possible-black-ice.png",
    "family": "winter",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1133,
    "height": 1388
  },
  "bridge_overpass_icing": {
    "condition": "bridge_overpass_icing",
    "label": "Bridge / Overpass Icing",
    "asset": "03-bridge-overpass-icing.png",
    "family": "winter",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1254,
    "height": 1254
  },
  "snow_covered_road": {
    "condition": "snow_covered_road",
    "label": "Snow-Covered Road",
    "asset": "04-snow-covered-road.png",
    "family": "winter",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1254,
    "height": 1254
  },
  "sleet_freezing_rain": {
    "condition": "sleet_freezing_rain",
    "label": "Sleet / Freezing Rain",
    "asset": "05-sleet-freezing-rain.png",
    "family": "winter",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "reduced_visibility": {
    "condition": "reduced_visibility",
    "label": "Reduced Visibility",
    "asset": "06-reduced-visibility.png",
    "family": "winter",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1254,
    "height": 1254
  },
  "winter_road_hazard": {
    "condition": "winter_road_hazard",
    "label": "Other Winter Road Hazard",
    "asset": "07-other-winter-road-hazard.png",
    "family": "winter",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "flooding": {
    "condition": "flooding",
    "label": "Flooding / High Water",
    "asset": "08-flooding-high-water.png",
    "family": "water",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "crash": {
    "condition": "crash",
    "label": "Crash / Wreck",
    "asset": "09-crash-wreck.png",
    "family": "vehicle",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "disabled_vehicle": {
    "condition": "disabled_vehicle",
    "label": "Disabled Vehicle",
    "asset": "10-disabled-vehicle.png",
    "family": "vehicle",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "debris": {
    "condition": "debris",
    "label": "Debris in Road",
    "asset": "11-debris-in-road.png",
    "family": "caution",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "road_blocked": {
    "condition": "road_blocked",
    "label": "Road Appears Blocked",
    "asset": "12-road-appears-blocked.png",
    "family": "caution",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "construction": {
    "condition": "construction",
    "label": "Construction",
    "asset": "13-construction.png",
    "family": "work",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "planned_work": {
    "condition": "planned_work",
    "label": "Planned Work",
    "asset": "14-planned-work.png",
    "family": "work",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "traffic_backup": {
    "condition": "traffic_backup",
    "label": "Traffic Backup / Heavy Delay",
    "asset": "15-traffic-backup-heavy-delay.png",
    "family": "vehicle",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "other_hazard": {
    "condition": "other_hazard",
    "label": "Other Hazard",
    "asset": "16-other-hazard.png",
    "family": "caution",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "road_closed": {
    "condition": "road_closed",
    "label": "Official Road Closed",
    "asset": "17-official-road-closed.png",
    "family": "restriction",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "downed_power_line": {
    "condition": "downed_power_line",
    "label": "Downed Power Line",
    "asset": "18-downed-power-line.png",
    "family": "caution",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "utility_work": {
    "condition": "utility_work",
    "label": "Utility Work",
    "asset": "19-utility-work.png",
    "family": "work",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "emergency_response_activity": {
    "condition": "emergency_response_activity",
    "label": "Emergency Response Activity",
    "asset": "20-emergency-response-activity.png",
    "family": "vehicle",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "livestock_on_road": {
    "condition": "livestock_on_road",
    "label": "Livestock on Road",
    "asset": "21-livestock-on-road.png",
    "family": "caution",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "traffic_signal_issue": {
    "condition": "traffic_signal_issue",
    "label": "Traffic Signal Issue",
    "asset": "22-traffic-signal-issue.png",
    "family": "caution",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "rail_blockage_delay": {
    "condition": "rail_blockage_delay",
    "label": "Reported Crossing Delay",
    "asset": "23-reported-crossing-delay.png",
    "family": "caution",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1192,
    "height": 1319
  },
  "rail_issue": {
    "condition": "rail_issue",
    "label": "Blocked Crossing",
    "asset": "24-blocked-crossing.png",
    "family": "caution",
    "size": 64,
    "tipRatio": 0.98,
    "width": 887,
    "height": 887
  },
  "crossing_infrastructure": {
    "condition": "crossing_infrastructure",
    "label": "Crossing Location",
    "asset": "25-crossing-location.png",
    "family": "infrastructure",
    "size": 64,
    "tipRatio": 0.98,
    "width": 887,
    "height": 887
  },
  "txdot_damage": {
    "condition": "txdot_damage",
    "label": "Road Damage",
    "asset": "26-road-damage.png",
    "family": "caution",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1254,
    "height": 1254
  },
  "txdot_bridge_restriction": {
    "condition": "txdot_bridge_restriction",
    "label": "Bridge Restriction",
    "asset": "27-bridge-restriction.png",
    "family": "restriction",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1254,
    "height": 1254
  },
  "txdot_other": {
    "condition": "txdot_other",
    "label": "Travel Advisory",
    "asset": "28-travel-advisory.png",
    "family": "information",
    "size": 64,
    "tipRatio": 0.98,
    "width": 1254,
    "height": 1254
  }
};
const aliases={
  "ice": "ice",
  "icy": "ice",
  "icy_road": "ice",
  "icy_roads": "ice",
  "black_ice_suspected": "black_ice_suspected",
  "black_ice": "black_ice_suspected",
  "possible_black_ice": "black_ice_suspected",
  "bridge_overpass_icing": "bridge_overpass_icing",
  "bridge_icing": "bridge_overpass_icing",
  "overpass_icing": "bridge_overpass_icing",
  "snow_covered_road": "snow_covered_road",
  "snow_on_road": "snow_covered_road",
  "sleet_freezing_rain": "sleet_freezing_rain",
  "sleet": "sleet_freezing_rain",
  "freezing_rain": "sleet_freezing_rain",
  "reduced_visibility": "reduced_visibility",
  "low_visibility": "reduced_visibility",
  "winter_road_hazard": "winter_road_hazard",
  "winter_hazard": "winter_road_hazard",
  "flooding": "flooding",
  "flood": "flooding",
  "high_water": "flooding",
  "standing_water": "flooding",
  "water_over_road": "flooding",
  "txdot_flooding": "flooding",
  "crash": "crash",
  "wreck": "crash",
  "crash_scene": "crash",
  "crash_incident": "crash",
  "disabled_vehicle": "disabled_vehicle",
  "debris": "debris",
  "debris_in_road": "debris",
  "fallen_tree": "debris",
  "road_blocked": "road_blocked",
  "blocked_road": "road_blocked",
  "blocked_roadway": "road_blocked",
  "road_impassable": "road_blocked",
  "impassable": "road_blocked",
  "winter_impassable": "road_blocked",
  "construction": "construction",
  "road_work": "construction",
  "txdot_construction": "construction",
  "planned_work": "planned_work",
  "scheduled_work": "planned_work",
  "traffic_backup": "traffic_backup",
  "heavy_traffic": "traffic_backup",
  "traffic_delay": "traffic_backup",
  "other_hazard": "other_hazard",
  "other": "other_hazard",
  "road_hazard": "other_hazard",
  "other_road_hazard": "other_hazard",
  "hazard_cleared": "other_hazard",
  "txdot_hazard": "other_hazard",
  "road_closed": "road_closed",
  "txdot_closure": "road_closed",
  "road_closure": "road_closed",
  "closure": "road_closed",
  "downed_power_line": "downed_power_line",
  "utility_work": "utility_work",
  "emergency_response_activity": "emergency_response_activity",
  "emergency_response_impact": "emergency_response_activity",
  "livestock_on_road": "livestock_on_road",
  "traffic_signal_issue": "traffic_signal_issue",
  "signal_outage": "traffic_signal_issue",
  "rail_blockage_delay": "rail_blockage_delay",
  "blocked": "rail_issue",
  "heavy": "rail_blockage_delay",
  "delayed": "rail_blockage_delay",
  "delay": "rail_blockage_delay",
  "blocked_crossing": "rail_issue",
  "crossing_blocked": "rail_issue",
  "train_blocking_crossing": "rail_issue",
  "rail_blockage": "rail_blockage_delay",
  "rail_blocked": "rail_issue",
  "rail_delay": "rail_blockage_delay",
  "rail_issue": "rail_issue",
  "rail_crossing_condition": "rail_issue",
  "crossing_infrastructure": "crossing_infrastructure",
  "rail": "crossing_infrastructure",
  "rail_crossing_infrastructure": "crossing_infrastructure",
  "txdot_damage": "txdot_damage",
  "txdot_bridge_restriction": "txdot_bridge_restriction",
  "txdot_incident": "txdot_other",
  "txdot_other": "txdot_other",
  "reported_crossing_delay": "rail_blockage_delay",
  "roadway_incident": "txdot_other"
};
const navigation={
  "current_location": {
    "key": "current_location",
    "asset": "current-location.png",
    "size": 48,
    "anchor": [
      24,
      24
    ]
  },
  "trip_start": {
    "key": "trip_start",
    "asset": "trip-start.png",
    "size": 48,
    "anchor": [
      24,
      47.04
    ]
  },
  "trip_destination": {
    "key": "trip_destination",
    "asset": "trip-destination.png",
    "size": 48,
    "anchor": [
      24,
      47.04
    ]
  }
};
const key=value=>String(value||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
Object.values(entries).forEach(Object.freeze);Object.values(navigation).forEach(Object.freeze);
const assetMap=Object.freeze(Object.fromEntries(Object.entries(aliases).map(([alias,condition])=>[alias,entries[condition].asset])));
const winterAssets=Object.freeze(Object.fromEntries(Object.values(entries).filter(e=>e.family==='winter').map(e=>[e.condition.toUpperCase(),e.asset])));
function resolve(value){return entries[aliases[key(value)]]||entries.other_hazard;}
function resolveNavigation(value){return navigation[key(value)]||null;}
return Object.freeze({basePath:'assets/markers/approved/',navigationBasePath:'assets/markers/approved/navigation/',size:64,entries:Object.freeze(entries),aliases:Object.freeze(aliases),assetMap,winterAssets,navigation:Object.freeze(navigation),resolve,resolveNavigation});
});
