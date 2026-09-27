// Build only the accepted onboarding renderer and pure geography/preferences.
// This never evaluates app.js startup, provider clients, maps or store evidence.
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
export function functionSource(source,name) {
 const start=source.indexOf('function '+name+'(');
 if(start<0)throw Error('Missing accepted function '+name);
 const line=source.slice(start,source.indexOf('\n',start)).trimEnd();
 if(line.endsWith('}'))return line;
 const end=source.indexOf('\n}',start)+2;
 if(end<start)throw Error('Invalid accepted function '+name);
 return source.slice(start,end);
}
export function constantSource(source,name) {
 const start=source.indexOf('const '+name+' =');
 if(start<0)throw Error('Missing accepted constant '+name);
 for(let end=source.indexOf(';',start);end>=0;end=source.indexOf(';',end+1)) {
  const fragment=source.slice(start,end+1);
  try {new vm.Script(fragment);return fragment;}catch(error){if(!(error instanceof SyntaxError))throw error;}
 }
 throw Error('Invalid accepted constant '+name);
}
export async function build(source) {
 source=source.replaceAll('\r\n','\n');
 const declarations=new Map();
 const add=name=>{
  if(declarations.has(name))return;
  const body=constantSource(source,name);declarations.set(name,null);
  for(const identifier of new Set(body.match(/\b[A-Z][A-Z0-9_]+\b/g)||[])) {
   if(identifier!==name && source.includes('const '+identifier+' ='))add(identifier);
  }
  declarations.delete(name);declarations.set(name,body);
 };
 const pureFunctions=['gridlyExtractCountyGeoid','gridlyGetOperationalCountyBoundaryGeoidById','normalizeGridlyAwarenessAreaLookupText','gridlyNormalizeCountyId','gridlyGetOperationalCountyIds','gridlyGetSelectableOperationalCountyIds',
  'gridlyBuildOperationalCountyWideAwarenessArea','gridlyLp035HoustonRegionAwarenessArea','gridlyBuildRegistryCommunityAwarenessArea'];
 for(const name of ['GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID','GRIDLY_DEFAULT_COUNTY_ID','GRIDLY_COUNTY_REGISTRY','GRIDLY_AWARENESS_AREA_DEFINITIONS','GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID','GRIDLY_HARRIS_COMMUNITY_COVERAGE_AUDIT',
  'GRIDLY_LP035_HOUSTON_REGION_MODEL','GRIDLY_LP035_HOUSTON_REGION_LABEL_ALIASES','GRIDLY_LP194_SAN_ANTONIO_REGION_MODEL','GRIDLY_V905_COMMUNITY_MAP_FOCUS','GRIDLY_LP051_ZIP_AWARENESS_INDEX','GRIDLY_V858_FIRST_RUN_ZIP_TO_AREA'])add(name);
 const runtimeFunctions=pureFunctions.map(name=>functionSource(source,name));
 const operations=[
  source.slice(source.indexOf('gridlyGetSelectableOperationalCountyIds().forEach((countyId) => {'),source.indexOf('// LP194_SAN_ANTONIO_RUNTIME_START')),
  functionSource(source,'gridlyLp194SanAntonioRegionAwarenessArea'),
  source.split('\n').find(line=>line.startsWith('GRIDLY_LP194_SAN_ANTONIO_REGION_MODEL.forEach(')),
  source.slice(source.indexOf('gridlyGetSelectableOperationalCountyIds().forEach((countyId) => {',source.indexOf('function gridlyBuildRegistryCommunityAwarenessArea(')),source.indexOf('const GRIDLY_LP051_ZIP_AWARENESS_RECORDS'))
 ];
 const pure=[...[...declarations.entries()].sort((a,b)=>source.indexOf(a[1])-source.indexOf(b[1])).map(entry=>entry[1]),...runtimeFunctions,...operations].join('\n');
 if(/\b(?:window|document|fetch|localStorage|navigator|setTimeout)\b/.test(pure))throw Error('Onboarding model must be pure');
 const context=vm.createContext({});vm.runInContext(pure,context,{timeout:15000});
 const model=JSON.parse(vm.runInContext(`JSON.stringify({geoids:GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID,areas:GRIDLY_AWARENESS_AREA_DEFINITIONS,registry:GRIDLY_COUNTY_REGISTRY,zip:GRIDLY_LP051_ZIP_AWARENESS_INDEX,zipFallback:GRIDLY_V858_FIRST_RUN_ZIP_TO_AREA,houston:GRIDLY_LP035_HOUSTON_REGION_MODEL,houstonAliases:GRIDLY_LP035_HOUSTON_REGION_LABEL_ALIASES})`,context));
 model.registry=Object.fromEntries(Object.entries(model.registry).map(([id,row])=>[id,{name:row.name,countyFips:row.countyFips,operational:row.operational,selectable:row.selectable,productionEnabled:row.productionEnabled,consumerAwarenessAreas:row.consumerAwarenessAreas}]));
 const names=['renderGridlyV858FirstRunExperience','getGridlyV872FirstRunTargetLabel','noteGridlyV872FirstRunAction','bindGridlyV872FirstRunActivation',
  'getGridlyV859FirstRunCompletionPlaceLabel','showGridlyV859FirstRunCompletionMoment',
  'resolveGridlyAwarenessAreaQuery','resolveGridlyAwarenessArea','resolveGridlyV858FirstRunLocation','resolveGridlyV858NearestAwarenessArea',
  'normalizeGridlyAwarenessAreaLookupText','gridlyNormalizeCountyId','gridlyGetOperationalCountyIds','gridlyGetSelectableOperationalCountyIds','gridlyLp035FindHoustonRegion','gridlyLp035HoustonRegionAwarenessArea'];
 const functions=names.map(name=>functionSource(source,name)).join('\n\n');
 const hash=createHash('sha256').update(pure+'\n'+functions).digest('hex');
 return {model,functions,hash};
}
if(process.argv[1] && resolve(process.argv[1])===resolve(import.meta.filename)) {
 const result=await build(await readFile(resolve(root,'js/app.js'),'utf8'));
 await writeFile(resolve(root,'assets/onboarding/paid-onboarding-model.json'),JSON.stringify({...result.model,sourceHash:result.hash})+'\n');
 const modulePath=resolve(root,'js/gridly-paid-onboarding.mjs');
 const ports=await readFile(modulePath,'utf8');
 await writeFile(modulePath,ports.replace(/\/\* ACCEPTED_FUNCTIONS_START \*\/[\s\S]*?\/\* ACCEPTED_FUNCTIONS_END \*\//,'/* ACCEPTED_FUNCTIONS_START */\n'+result.functions+'\n/* ACCEPTED_FUNCTIONS_END */'));
 console.log('Accepted onboarding extracted; pure areas:',result.model.areas.length);
}
