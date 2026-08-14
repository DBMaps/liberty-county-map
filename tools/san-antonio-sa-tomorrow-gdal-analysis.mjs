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

function query(ogrinfo,dataset,sql,runner){
  const output=execute(ogrinfo,['-ro','-json','-geom=NO','-dialect','SQLite','-sql',sql,dataset],runner,'ogrinfo');
  let parsed;try{parsed=JSON.parse(output);}catch{throw new Error('OGRINFO_JSON_OUTPUT_INVALID');}
  return parsed.features?.map(feature=>feature.properties)||[];
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
  a.Name AS firstName, b.Name AS secondName,
  a.PlanType AS firstPlanType, b.PlanType AS secondPlanType,
  ST_Area(ST_Intersection(a.geom,b.geom)) AS overlapAreaSquareMeters,
  ST_Equals(a.geom,b.geom) AS duplicateGeometry
FROM areas a JOIN areas b ON a.Name COLLATE NOCASE < b.Name COLLATE NOCASE
WHERE ST_Intersects(a.geom,b.geom)
ORDER BY firstName COLLATE NOCASE, secondName COLLATE NOCASE`;

export function analyzeWithGdal(sourceFile,{bin=process.env.GRIDLY_GDAL_BIN,runner=spawnSync,tempRoot=os.tmpdir()}={}){
  const binaries=resolveGdalBinaries(bin);
  const versions=verifyGdalBinaries(binaries,{runner});
  const work=fs.mkdtempSync(path.join(tempRoot,'gridly-sa-tomorrow-'));
  const projected=path.join(work,'sa-tomorrow-epsg-3083.gpkg');
  try{
    execute(binaries.ogr2ogr,['-f','GPKG',projected,sourceFile,'-nln','areas','-select','Name,GlobalID,PlanType','-t_srs',WORKING_CRS,'-nlt','PROMOTE_TO_MULTI','-lco','SPATIAL_INDEX=YES'],runner,'ogr2ogr');
    const features=query(binaries.ogrinfo,projected,FEATURE_SQL,runner).map(p=>({sourceName:String(p.sourceName),sourceGlobalID:p.sourceGlobalID==null?null:String(p.sourceGlobalID),sourcePlanType:String(p.sourcePlanType),geometryType:p.geometryType,componentCount:Number(p.componentCount),geometryStatus:Number(p.geometryValid)===1?'VALID':'INVALID',areaSquareMeters:Number(p.areaSquareMeters),calculatedSquareMiles:Number(p.calculatedSquareMiles),projectedBounds:[Number(p.minX),Number(p.minY),Number(p.maxX),Number(p.maxY)],centroid:[Number(p.centroidX),Number(p.centroidY)],centroidContained:Number(p.centroidContained)===1,pointOnSurface:[Number(p.pointOnSurfaceX),Number(p.pointOnSurfaceY)],longAxisExtentMeters:Math.max(Number(p.maxX)-Number(p.minX),Number(p.maxY)-Number(p.minY))}));
    const pairs=query(binaries.ogrinfo,projected,OVERLAP_SQL,runner);
    const pairwiseOverlaps=pairs.filter(p=>Number(p.overlapAreaSquareMeters)>0.01).map(p=>({first:p.firstName,second:p.secondName,firstPlanType:p.firstPlanType,secondPlanType:p.secondPlanType,overlapAreaSquareMeters:Number(p.overlapAreaSquareMeters)}));
    const duplicateGeometries=pairs.filter(p=>Number(p.duplicateGeometry)===1).map(p=>[p.firstName,p.secondName]);
    const union=query(binaries.ogrinfo,projected,'SELECT ST_Area(ST_Union(geom)) AS totalUnionAreaSquareMeters FROM areas',runner)[0];
    const crossTypeOverlapCount=pairwiseOverlaps.filter(p=>(p.firstPlanType==='Community')!==(p.secondPlanType==='Community')).length;
    const sameTypeOverlapCount=pairwiseOverlaps.length-crossTypeOverlapCount;
    const regionalCenterCommunityAreaRelationship=crossTypeOverlapCount?'CROSS_TYPE_OVERLAY_PRESENT':pairwiseOverlaps.length?'SAME_TYPE_OVERLAP_PRESENT':'NON_OVERLAPPING_ATOMIC_PARTITION';
    return {gdalVersions:versions,features,topology:{pairwiseOverlaps,pairwiseOverlapCount:pairwiseOverlaps.length,crossTypeOverlapCount,sameTypeOverlapCount,duplicateGeometries,disconnectedGeometries:features.filter(x=>x.componentCount>1).map(x=>x.sourceName),totalUnionAreaSquareMeters:Number(union?.totalUnionAreaSquareMeters),regionalCenterCommunityAreaRelationship,gaps:{status:'NOT_DETERMINISTIC_WITHOUT_GOVERNED_CITY_LIMIT_BOUNDARY',areaSquareMeters:null}}};
  } finally {
    fs.rmSync(work,{recursive:true,force:true});
  }
}
