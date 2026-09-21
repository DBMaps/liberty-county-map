// Offline vector authoring only. No SVG generation occurs in the consumer runtime.
const fs = require('node:fs');
const registry = require('../../js/gridlyMarkerRegistry.js');
const p = d => `<path d="${d}"/>`;
const circle = (x,y,r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
const rect = (x,y,w,h,r=4) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const crystal = `<path d="M128 48v92M88 71l80 46M88 117l80-46M116 56l12 12 12-12M116 132l12-12 12 12M91 85l17-5-4-17M152 125l-4-17 17-5M91 103l17 5-4 17M152 63l-4 17 17 5"/>`;
const road = p('M104 49 78 145M152 49l26 96');
const crossbuck = p('m88 54 78 48m-78 0 78-48M127 80v64');
const car = `<path d="m87 90 10-29h62l10 29v33H87ZM89 90h78M101 124v12m54-12v12"/><path d="M99 105h8m42 0h8"/>`;
const cone = `<path d="m128 51-31 83h62ZM111 97h34M105 113h46M87 140h82"/>`;
const art = {
  ice:crystal,
  black_ice_suspected:road+p('M111 63v16m-5 47-5 14M101 108q17-25 34-9t26-7M129 88v29m-14-14h28')+'<g transform="translate(2 -5)">'+p('M145 54q0-13 13-13t13 12q0 8-12 14v6')+circle(159,83,1)+'</g>',
  bridge_overpass_icing:p('M78 146V99h100v47M83 125h90M96 99V86m32 13V86m32 13V86M97 146q31-48 62 0')+'<g transform="translate(65 22) scale(.49)">'+crystal+'</g>',
  snow_covered_road:road+p('M128 64v19m0 25v13')+'<path d="M80 145V111q-8-20 6-26 0-15 14-15l-8 47 12-5 7 10-2 23ZM176 145v-36q6-17-6-22 0-18-16-20l5 42-12 5 2 15-5 16Z" fill="#f0f9ff" stroke="none"/>'+'<path d="M80 148v-16q3-14 17-9 1-17 18-10 12-18 23-2 19-8 20 12 16-5 18 11v14Z" fill="#f0f9ff" stroke="none"/>',
  sleet_freezing_rain:'<path d="M87 95a18 18 0 0 1-2-35 24 24 0 0 1 46-7 20 20 0 0 1 30 14 15 15 0 0 1 7 28Z" fill="#f0f9ff" stroke="none"/>'+p('m95 109-9 14m41-14-9 14m41-14-9 14m-39 13 6 6-6 6-6-6Zm39 0 6 6-6 6-6-6Z'),
  reduced_visibility:p('M76 82q52-50 104 0-52 50-104 0Z')+circle(128,82,10)+p('M79 117h98M89 135h78M107 152h42'),
  winter_road_hazard:p('M128 45 70 148h116Z')+'<g transform="translate(67 58) scale(.48)">'+crystal+'</g>',
  flooding:road+p('M128 60v16m0 14v13M77 114q13-12 26 0t26 0 26 0 26 0M77 138q13-12 26 0t26 0 26 0 26 0'),
  crash:'<g transform="rotate(-12 101 110)">'+p('M79 97 87 78h29l8 19v29H79ZM81 97h41M87 126v10m29-10v10')+'</g><g transform="rotate(12 155 110)">'+p('M132 97 140 78h29l8 19v29h-45ZM134 97h41M140 126v10m29-10v10')+'</g>'+p('M128 61V47m-12 20-10-9m34 9 10-9'),
  disabled_vehicle:car+p('m146 88 29-27M174 60l5 3'),
  debris:road+p('M128 57v19')+'<path d="m100 98 24-19 30 19-9 32-40-4Z" fill="#f0f9ff" stroke="none"/>',
  road_blocked:road+p('M128 54v19m0 60v12')+rect(85,87,86,27,3)+p('m108 87-19 25m48-25-19 25m48-25-19 25'),
  road_impassable:p('M104 49 92 91l25 12-28 12-11 30M152 49l12 42-27 12 28 12 13 30M128 53v22m0 57v13M86 99l-11 7m96 0 12-7'),
  construction:cone,
  planned_work:rect(78,59,94,85)+p('M78 81h94M102 48v23m48-23v23')+'<circle cx="154" cy="125" r="26" fill="#102b40"/>'+p('M154 110v17h12'),
  traffic_backup:'<g transform="translate(57 23) scale(.54)">'+car+'</g><g transform="translate(39 65) scale(.46)">'+car+'</g><g transform="translate(99 65) scale(.46)">'+car+'</g>',
  other_hazard:p('M128 47 72 147h112ZM128 83v31')+circle(128,131,2),
  road_closed:'<circle cx="128" cy="96" r="48" fill="#102b40"/><path d="M97 96h62" stroke-width="15"/>',
  downed_power_line:p('M88 147 112 49M87 64l54 14M122 72q16 27 53 18M119 85q17 36 55 27M143 114l-15 23h18l-8 18'),
  utility_work:p('M94 144V57M77 71h35M83 57v13m21-13v13M127 141l30-44q-18-7-12-25l13 11 12-14q13 21-7 33'),
  emergency_response_activity:p('M94 137v-29a34 34 0 0 1 68 0v29ZM85 144h86M128 48v12M86 62l9 9m65 0 10-9M72 95h13m86 0h13M129 94l-12 22h18l-9 18'),
  livestock_on_road:'<path d="M82 89h59l9-20 24 7 6 23-18 9-5 19v18h-13v-22H99v22H86v-29l-10-9ZM151 71l-5-11m26 17 7-8M81 94l-10-8"/>',
  traffic_signal_issue:rect(107,49,43,101,9)+circle(128,68,5)+circle(128,98,5)+circle(128,129,5)+p('m84 144 88-88'),
  rail_blockage_delay:'<g transform="translate(0 0) scale(.84)">'+crossbuck+'</g>'+circle(155,124,29)+p('M155 106v20l13 8'),
  rail_issue:'<g transform="translate(0 0) scale(.84)">'+crossbuck+'</g>'+p('m155 99-28 48h56ZM155 117v11')+circle(155,139,1),
  crossing_infrastructure:p('M107 48 83 147M149 48l24 99M99 65h57M94 88h68M88 113h80M82 140h94'),
  txdot_damage:road+p('m128 56-14 24 27 17-26 19 20 26M139 97l13-6m-36 25-17-4'),
  txdot_bridge_restriction:p('M78 147V81h100v66M78 105h100M94 147v-22q34-27 68 0v22M128 45v42m-11-30 11-12 11 12m-22 18 11 12 11-12'),
  txdot_incident:road+'<circle cx="128" cy="101" r="30" fill="#102b40"/>'+p('M128 83v19')+circle(128,116,1),
  txdot_other:circle(128,92,47)+circle(128,70,3)+p('M128 88v28M117 118h22')
};
fs.mkdirSync('assets/markers/unified',{recursive:true});
for(const entry of Object.values(registry.entries)) {
  if(!art[entry.condition])throw new Error('Missing art '+entry.condition);
  const shape='M128 244 52 159a94 94 0 1 1 152 0Z';
  const body='<path d="'+shape+'" fill="'+registry.bodyColor+'" stroke="'+entry.color+'" stroke-width="16" stroke-linejoin="round"/><path d="'+shape+'" fill="'+registry.bodyColor+'" stroke="#f0f9ff" stroke-width="4" stroke-linejoin="round"/>';
  fs.writeFileSync(registry.basePath+entry.asset,'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><title>'+entry.label.replaceAll('&','&amp;')+'</title>'+body+'<g transform="translate(-20.48 -15.36) scale(1.16)" fill="none" stroke="#f0f9ff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">'+art[entry.condition]+'</g></svg>\n');
}
console.log('Authored '+Object.keys(registry.entries).length+' static vector assets');
