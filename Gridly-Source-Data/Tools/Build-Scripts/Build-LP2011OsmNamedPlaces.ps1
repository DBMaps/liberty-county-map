[CmdletBinding()]
param(
 [ValidateSet('WhatIf','Apply','Verify')][string]$Mode='WhatIf',
 [string]$Pbf='C:\GitHub\Gridly-Source-Data\OpenStreetMap\Regional\texas-260625.osm.pbf',
 [string]$OsmConf=$env:OSM_CONFIG_FILE,
 [string]$PlaceSource='C:\GitHub\Gridly-Source-Data\Census\TIGER2025\PLACE\derived\tl_2025_48_place.shp',
 [string]$OutputDirectory='C:\GitHub\Gridly-Source-Data\Processing\LP2011'
)
Set-StrictMode -Version Latest; $ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'gridly-gis-env.ps1')
if(!(Test-Path -LiteralPath $Pbf -PathType Leaf)){throw "LP2011 source absent: $Pbf"}
$item=Get-Item -LiteralPath $Pbf
if($item.Length -ne 707715853){throw "LP2011 source byte mismatch: $($item.Length)"}
$hash=(Get-FileHash -LiteralPath $Pbf -Algorithm SHA256).Hash.ToLowerInvariant()
if($hash -ne '1d80efe1b19b075d036363d722366870df3efb7fbd4a45dc9f16797868ff4413'){throw "LP2011 source SHA-256 mismatch: $hash"}
foreach($cmd in @('ogrinfo','ogr2ogr','node')){if(!(Get-Command $cmd -ErrorAction SilentlyContinue)){throw "LP2011 required command absent: $cmd"}}
if(!$OsmConf -or !(Test-Path -LiteralPath $OsmConf -PathType Leaf)){throw 'LP2011 OSM_CONFIG_FILE/osmconf.ini absent'}
$env:OSM_CONFIG_FILE=$OsmConf
$info=(& ogrinfo -ro -so $Pbf points 2>&1) -join "`n"; if($LASTEXITCODE -ne 0){throw 'LP2011 PBF points layer unreadable'}
foreach($field in @('name','place')){if($info -notmatch "\b$field\b"){throw "LP2011 points field absent: $field"}}
if(!(Test-Path -LiteralPath $PlaceSource -PathType Leaf)){throw "LP2011 canonical PLACE geometry absent: $PlaceSource"}
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('gridly-lp2011-'+[guid]::NewGuid().ToString('N')); New-Item -ItemType Directory $scratch|Out-Null
try {
 $candidates=Join-Path $scratch 'osm-named-place-points.geojson'; $places=Join-Path $scratch 'canonical-places.geojson'
 & ogr2ogr -f GeoJSON $candidates $Pbf points -where "place IS NOT NULL AND name IS NOT NULL AND name <> ''" -select 'osm_id,name,place,other_tags' -lco RFC7946=YES
 if($LASTEXITCODE -ne 0){throw 'LP2011 named-place extraction failed'}
 & ogr2ogr -f GeoJSON $places $PlaceSource -where "STATEFP = '48'" -select 'GEOID,NAME,NAMELSAD,LSAD,CLASSFP,FUNCSTAT,INTPTLAT,INTPTLON' -lco RFC7946=YES
 if($LASTEXITCODE -ne 0){throw 'LP2011 canonical geometry extraction failed'}
 $repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path; $args=@((Join-Path $repo 'tools\lp2011\manufacture-osm-place-evidence.mjs'),'--pbf',$Pbf,'--places',$places,'--candidates',$candidates,'--output','reports/lp2011')
 if($Mode -eq 'Apply'){$args+='--apply'}elseif($Mode -eq 'Verify'){$args+='--verify'}else{$args+='--whatif'}
 & node @args; if($LASTEXITCODE -ne 0){throw 'LP2011 reconciliation failed'}
} finally {Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue}
