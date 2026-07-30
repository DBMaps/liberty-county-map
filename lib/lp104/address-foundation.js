'use strict';
const crypto = require('node:crypto');
const ROAD_RULES = [
  [/\b(?:county road|county rd|co rd|cr)\s*(\d+[a-z]?)\b/g, 'cr $1'],
  [/\b(?:farm(?:-|\s+)to(?:-|\s+)market(?: road)?|fm)\s*(\d+[a-z]?)\b/g, 'fm $1'],
  [/\b(?:state highway|texas highway|sh|tx)\s*(\d+[a-z]?)\b/g, 'sh $1'],
  [/\b(?:u s highway|us highway|u s|us)\s*(\d+[a-z]?)\b/g, 'us $1'],
  [/\b(?:interstate|i)[-\s]*(\d+[a-z]?)\b/g, 'i $1']
];
function clean(v) { return String(v ?? '').toLowerCase().replace(/u\.s\./g, 'us').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function normalizeRoad(value) { return ROAD_RULES.reduce((v,[pattern,replacement]) => v.replace(pattern,replacement), clean(value)).replace(/\s+/g,' ').trim(); }
function normalizeHouse(value) { const m=String(value??'').trim().match(/^(\d{1,9})([A-Za-z]?)$/); return m ? `${Number(m[1])}${m[2].toLowerCase()}` : ''; }
function lookupHash(r) { return crypto.createHash('sha256').update([normalizeHouse(r.houseNumber),normalizeRoad(r.canonicalRoadIdentity||r.road),clean(r.postalCode).slice(0,5),clean(r.countyFips||r.countyId),'tx'].join('|')).digest('hex'); }
const authorityRank={county_911:0,regional_911:1,statewide_authoritative:2,national_address_database:3,open_address_point:4,gridly_verified_exception:5};
function precedence(a,b) { for (const x of [[authorityRank[a.sourceAuthority]??99,authorityRank[b.sourceAuthority]??99],[-Number(a.precision==='address_point'),-Number(b.precision==='address_point')],[-Date.parse(a.sourceDate||0),-Date.parse(b.sourceDate||0)],[String(a.sourceId),String(b.sourceId)]]) if(x[0]!==x[1]) return x[0]-x[1]; return String(a.id).localeCompare(String(b.id)); }
function eligible(r, license) { return license?.productionEligible===true && r.state==='TX' && ['address_point','rooftop','parcel_centroid','entrance'].includes(r.precision) && Number.isFinite(r.latitude)&&Number.isFinite(r.longitude); }
function normalizeRecord(raw, source, buildVersion) { const out={id:'',lookupHash:'',houseNumber:normalizeHouse(raw.houseNumber),canonicalRoadIdentity:normalizeRoad(raw.canonicalRoadIdentity||raw.road),locality:String(raw.locality||''),localityAliases:Array.isArray(raw.localityAliases)?raw.localityAliases:[],countyId:String(raw.countyId||''),countyFips:String(raw.countyFips||''),state:'TX',postalCode:String(raw.postalCode||'').slice(0,5),latitude:Number(raw.latitude),longitude:Number(raw.longitude),precision:String(raw.precision||''),sourceId:source.sourceId,sourceAuthority:String(source.authority),sourceVersion:String(source.sourceVersion||''),sourceDate:String(source.sourceDate||''),sourceLicense:String(source.license||''),attributionRequired:Boolean(source.attributionRequired),consumerEligible:false,buildVersion}; out.lookupHash=lookupHash(out); out.id=crypto.createHash('sha256').update(`${out.lookupHash}|${out.sourceId}|${raw.sourceRecordId||''}`).digest('hex'); out.consumerEligible=eligible(out,source); return out; }
module.exports={normalizeRoad,normalizeHouse,lookupHash,precedence,eligible,normalizeRecord};
