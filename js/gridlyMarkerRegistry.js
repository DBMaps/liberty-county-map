/* LP244.47: presentation only. Authority, lifecycle and geometry belong to their existing owners. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GridlyMarkerRegistry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const rows = [
    ['ice','Ice / Icy Road','icy-road','winter','crystal',['icy','icy_road','icy_roads']],
    ['black_ice_suspected','Possible Black Ice','black-ice-suspected','winter','slick road, glint and small uncertainty cue',['black_ice','possible_black_ice']],
    ['bridge_overpass_icing','Bridge / Overpass Icing','bridge-overpass-icing','winter','bridge and crystal',['bridge_icing','overpass_icing']],
    ['snow_covered_road','Snow-Covered Road','snow-covered-road','winter','road with accumulated snowbanks',['snow_on_road']],
    ['sleet_freezing_rain','Sleet / Freezing Rain','sleet-freezing-rain','winter','cloud, rain and ice pellets',['sleet','freezing_rain']],
    ['reduced_visibility','Reduced Visibility','reduced-visibility','winter','eye and fog',['low_visibility']],
    ['winter_road_hazard','Other Winter Road Hazard','winter-road-hazard','winter','caution triangle and crystal',['winter_hazard']],
    ['flooding','Flooding / High Water','flooding-high-water','water','road entering water',['flood','high_water','standing_water','water_over_road','txdot_flooding']],
    ['crash','Crash / Wreck','crash-wreck','vehicle','two vehicles and impact burst',['wreck','crash_scene','crash_incident']],
    ['disabled_vehicle','Disabled Vehicle','disabled-vehicle','vehicle','vehicle with raised hood',[]],
    ['debris','Debris in Road','debris-road','caution','scattered angular debris on road',['debris_in_road']],
    ['fallen_tree','Fallen Tree','fallen-tree','caution','fallen branching trunk',[]],
    ['road_blocked','Road appears blocked','road-blocked','caution','obstacle across road',['blocked_road','blocked_roadway']],
    ['road_impassable','Road appears impassable','road-impassable','caution','broken roadway and gap',['impassable','winter_impassable']],
    ['construction','Construction','construction','work','work cone',['road_work','txdot_construction']],
    ['planned_work','Planned Work','planned-work','work','calendar and work cone',['scheduled_work']],
    ['traffic_backup','Traffic Backup / Heavy Delay','traffic-delay','vehicle','queue of vehicles',['heavy_traffic','traffic_delay']],
    ['other_hazard','Other Hazard','other-road-hazard','caution','general caution triangle',['other','road_hazard','other_road_hazard','hazard_cleared','txdot_hazard']],
    ['road_closed','Official Road Closed','road-closed-official','restriction','no entry across road',['txdot_closure','road_closure','closure']],
    ['downed_power_line','Downed Power Line','downed-power-line','caution','broken wire and lightning',[]],
    ['utility_work','Utility Work','utility-work','work','utility pole and wrench',[]],
    ['emergency_response_activity','Emergency Response Activity','emergency-response','response','response beacon',['emergency_response_impact']],
    ['livestock_on_road','Livestock on Road','livestock-road','caution','livestock silhouette',[]],
    ['traffic_signal_issue','Traffic Signal Issue','traffic-signal-issue','caution','signal with interruption slash',['signal_outage']],
    ['rail_blockage_delay','Reported Crossing Delay','crossing-delay','rail','crossbuck and delay clock',['blocked','heavy','delayed','delay','blocked_crossing','crossing_blocked','train_blocking_crossing','rail_blockage','rail_blocked','rail_delay']],
    ['rail_issue','Reported Crossing Condition','crossing-condition','rail','crossbuck and caution cue',['rail_crossing_condition']],
    ['crossing_infrastructure','Crossing Location','crossing-location','infrastructure','crossbuck location medallion',['rail','rail_crossing_infrastructure']],
    ['txdot_damage','Road Damage','road-damage','caution','road surface crack',[]],
    ['txdot_bridge_restriction','Bridge Restriction','bridge-restriction','restriction','bridge and restricted opening',[]],
    ['txdot_incident','Roadway Incident','roadway-incident','vehicle','road and incident burst',[]],
    ['txdot_other','Travel Advisory','travel-advisory','information','information symbol',[]]
  ];
  const colors = Object.freeze({winter:'#17445f',water:'#12616b',work:'#8e480f',caution:'#745516',restriction:'#a3313e',vehicle:'#604674',response:'#70405b',rail:'#345b60',infrastructure:'#465661',information:'#435b72'});
  const key = value => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const entries = Object.create(null), aliases = Object.create(null), assetMap = Object.create(null);
  for (const [condition,label,file,family,symbol,legacyAliases] of rows) {
    entries[condition] = Object.freeze({condition,label,asset:file+'.svg',family,color:colors[family],symbol,size:64,tipRatio:244/256,aliases:Object.freeze(legacyAliases)});
    for (const alias of [condition,...legacyAliases]) { aliases[alias]=condition; assetMap[alias]=file+'.svg'; }
  }
  const winterAssets = Object.freeze(Object.fromEntries(Object.values(entries).filter(x=>x.family==='winter').map(x=>[x.condition.toUpperCase(),x.asset])));
  function resolve(value) { return entries[aliases[key(value)]] || entries.other_hazard; }
  return Object.freeze({basePath:'assets/markers/unified/',size:64,entries:Object.freeze(entries),aliases:Object.freeze(aliases),assetMap:Object.freeze(assetMap),winterAssets,colors,resolve});
});
