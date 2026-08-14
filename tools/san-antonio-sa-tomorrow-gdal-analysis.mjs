import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const WORKING_CRS='EPSG:3083';
const SPAWN_OPTIONS={encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true};

export function assertGdalVersion(text){
  const match=String(text).match(/GDAL\s+(\d+)\.(\d+)\.(\d+)/i);
  if(!match||Number(match[1])!==3||Number(match[2])!==13)throw new Error(`GOVERNED_GDAL_3_13_REQUIRED: ${String(text).trim()}`);
  return match[0];
}

export function resolveGdalBinaries(bin=process.env.GRIDLY_GDAL_BIN,platform=process.platform){
  if(!bin)throw new Error('GRIDLY_GDAL_BIN_REQUIRED');
  const suffix=platform==='win32'?'.exe':'';
  return {ogrinfo:path.join(bin,`ogrinfo${suffix}`),ogr2ogr:path.join(bin,`ogr2ogr${suffix}`)};
}

function execute(executable,args,runner=spawnSync,label=path.basename(executable)){
  const result=runner(executable,args,SPAWN_OPTIONS);
  if(result?.error?.code==='ENOENT'||result?.status===null)throw new Error(`${label.toUpperCase()}_UNAVAILABLE: ${executable}`);
  if(result?.status!==0)throw new Error(`${label.toUpperCase()}_FAILED: ${(result?.stderr||result?.stdout||'').trim()}`);
  return result.stdout;
}

export function verifyGdalBinaries(binaries,{runner=spawnSync}={}){
  const infoVersion=assertGdalVersion(execute(binaries.ogrinfo,['--version'],runner,'ogrinfo'));
  const convertVersion=assertGdalVersion(execute(binaries.ogr2ogr,['--version'],runner,'ogr2ogr'));
  return {ogrinfoVersion:infoVersion,ogr2ogrVersion:convertVersion};
}

function query(ogr2ogr,dataset,sql,runner,work,index){
  const result=path.join(work,`sql-result-${index}.geojson`);
  try{
    execute(ogr2ogr,['-f','GeoJSON',result,dataset,'-dialect','SQLite','-sql',sql],runner,'ogr2ogr');
    let parsed;try{parsed=JSON.parse(fs.readFileSync(result,'utf8'));}catch{throw new Error('OGR2OGR_GEOJSON_OUTPUT_INVALID');}
    if(parsed?.type!=='FeatureCollection'||!Array.isArray(parsed.features))throw new Error('OGR2OGR_GEOJSON_FEATURE_COLLECTION_REQUIRED');
    return parsed.features.map(feature=>feature?.properties||{});
  } finally {
    fs.rmSync(result,{force:true});
  }
}

const FEATURE_SQL=`SELECT
  Name AS sourceName,
  GlobalID AS sourceGlobalID,
  PlanType AS sourcePlanType,
  GeometryType(geom) AS geometryType,
  ST_NumGeometries(geom) AS componentCount,
  ST_IsValid(geom) AS geometryValid,
  ST_Area(geom) AS areaSquareMeters,
  ST_Area(geom) / 2589988.110336 AS calculatedSquareMiles,
  MbrMinX(geom) AS minX, MbrMinY(geom) AS minY,
  MbrMaxX(geom) AS maxX, MbrMaxY(geom) AS maxY,
  ST_X(ST_Centroid(geom)) AS centroidX,
  ST_Y(ST_Centroid(geom)) AS centroidY,
  ST_Contains(geom, ST_Centroid(geom)) AS centroidContained,
  ST_X(ST_PointOnSurface(geom)) AS pointOnSurfaceX,
  ST_Y(ST_PointOnSurface(geom)) AS pointOnSurfaceY
FROM areas ORDER BY Name COLLATE NOCASE`;

const OVERLAP_SQL=`SELECT
  a.Name AS leftName, b.Name AS rightName,
  a.PlanType AS leftPlanType, b.PlanType AS rightPlanType,
  ST_Area(ST_Intersection(a.geom,b.geom)) AS overlapAreaSqM,
  ST_Equals(a.geom,b.geom) AS isDuplicate
FROM areas a JOIN areas b ON a.Name COLLATE NOCASE < b.Name COLLATE NOCASE
WHERE ST_Intersects(a.geom,b.geom)
ORDER BY leftName COLLATE NOCASE, rightName COLLATE NOCASE`;

export function analyzeWithGdal(sourceFile,{bin=process.env.GRIDLY_GDAL_BIN,runner=spawnSync,tempRoot=os.tmpdir()}={}){
  const binaries=resolveGdalBinaries(bin);
  const versions=verifyGdalBinaries(binaries,{runner});
  const work=fs.mkdtempSync(path.join(tempRoot,'gridly-sa-tomorrow-'));
  const projected=path.join(work,'sa-tomorrow-epsg-3083.gpkg');
  try{
    execute(binaries.ogr2ogr,['-f','GPKG',projected,sourceFile,'-nln','areas','-select','Name,GlobalID,PlanType','-t_srs',WORKING_CRS,'-nlt','PROMOTE_TO_MULTI','-lco','SPATIAL_INDEX=YES'],runner,'ogr2ogr');
    const features=query(binaries.ogr2ogr,projected,FEATURE_SQL,runner,work,1).map(p=>({sourceName:String(p.sourceName),sourceGlobalID:p.sourceGlobalID==null?null:String(p.sourceGlobalID),sourcePlanType:String(p.sourcePlanType),geometryType:p.geometryType,componentCount:Number(p.componentCount),geometryStatus:Number(p.geometryValid)===1?'VALID':'INVALID',areaSquareMeters:Number(p.areaSquareMeters),calculatedSquareMiles:Number(p.calculatedSquareMiles),projectedBounds:[Number(p.minX),Number(p.minY),Number(p.maxX),Number(p.maxY)],centroid:[Number(p.centroidX),Number(p.centroidY)],centroidContained:Number(p.centroidContained)===1,pointOnSurface:[Number(p.pointOnSurfaceX),Number(p.pointOnSurfaceY)],longAxisExtentMeters:Math.max(Number(p.maxX)-Number(p.minX),Number(p.maxY)-Number(p.minY))})).sort((a,b)=>a.sourceName.localeCompare(b.sourceName,'en'));
    const pairs=query(binaries.ogr2ogr,projected,OVERLAP_SQL,runner,work,2);
    const pairwiseOverlaps=pairs.filter(p=>Number(p.overlapAreaSqM)>0.01).map(p=>({first:p.leftName,second:p.rightName,firstPlanType:p.leftPlanType,secondPlanType:p.rightPlanType,overlapAreaSquareMeters:Number(p.overlapAreaSqM)})).sort((a,b)=>a.first.localeCompare(b.first,'en')||a.second.localeCompare(b.second,'en'));
    const duplicateGeometries=pairs.filter(p=>Number(p.isDuplicate)===1).map(p=>[p.leftName,p.rightName]).sort((a,b)=>a[0].localeCompare(b[0],'en')||a[1].localeCompare(b[1],'en'));
    const union=query(binaries.ogr2ogr,projected,'SELECT ST_Area(ST_Union(geom)) AS totalUnionAreaSquareMeters FROM areas',runner,work,3)[0];
    const crossTypeOverlapCount=pairwiseOverlaps.filter(p=>(p.firstPlanType==='Community')!==(p.secondPlanType==='Community')).length;
    const sameTypeOverlapCount=pairwiseOverlaps.length-crossTypeOverlapCount;
    const regionalCenterCommunityAreaRelationship=crossTypeOverlapCount?'CROSS_TYPE_OVERLAY_PRESENT':pairwiseOverlaps.length?'SAME_TYPE_OVERLAP_PRESENT':'NON_OVERLAPPING_ATOMIC_PARTITION';
    return {gdalVersions:versions,features,topology:{pairwiseOverlaps,pairwiseOverlapCount:pairwiseOverlaps.length,crossTypeOverlapCount,sameTypeOverlapCount,duplicateGeometries,disconnectedGeometries:features.filter(x=>x.componentCount>1).map(x=>x.sourceName),totalUnionAreaSquareMeters:Number(union?.totalUnionAreaSquareMeters),regionalCenterCommunityAreaRelationship,gaps:{status:'NOT_DETERMINISTIC_WITHOUT_GOVERNED_CITY_LIMIT_BOUNDARY',areaSquareMeters:null}}};
  } finally {
    fs.rmSync(work,{recursive:true,force:true});
  }
}
