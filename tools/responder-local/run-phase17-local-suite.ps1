# Disposable localhost PostgreSQL/PostGIS only. No remote connection or production work.
$ErrorActionPreference='Stop'
$bin='C:\Program Files\PostgreSQL\17\bin'
if(-not (Test-Path -LiteralPath (Join-Path $bin 'initdb.exe'))){throw 'PostgreSQL 17 local toolchain missing'}
$data=Join-Path $env:TEMP ('gridly-responder-phase17-'+[guid]::NewGuid().ToString('N'))
$listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
$listener.Start(); $port=$listener.LocalEndpoint.Port; $listener.Stop()
$started=$false
try{
  & (Join-Path $bin 'initdb.exe') -D $data -U postgres -A trust -E UTF8 --no-instructions *> $null
  if($LASTEXITCODE -ne 0){throw 'Phase 17 initdb failed'}
  & (Join-Path $bin 'pg_ctl.exe') -D $data -l (Join-Path $data 'server.log') -o "-h 127.0.0.1 -p $port" -w start
  if($LASTEXITCODE -ne 0){throw 'Phase 17 server start failed'}
  $started=$true
  $env:RESPONDER_PHASE17_PGBIN=$bin
  $env:RESPONDER_PHASE17_PGPORT=[string]$port
  $env:RESPONDER_PHASE17_PGUSER='postgres'
  $env:RESPONDER_PHASE17_PGDATA=$data
  & node tests/responder-phase17-production-migration.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Phase 17 disposable suite failed'}
  & node tests/responder-phase17-security-regression.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Phase 17 security regression suite failed'}
}finally{
  if($started){& (Join-Path $bin 'pg_ctl.exe') -D $data -m immediate -w stop}
  $resolved=[IO.Path]::GetFullPath($data).TrimEnd('\')
  $tempResolved=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
  if(-not $resolved.StartsWith($tempResolved+'\',[StringComparison]::OrdinalIgnoreCase) -or
     -not [IO.Path]::GetFileName($resolved).StartsWith('gridly-responder-phase17-')){
    throw 'Phase 17 cleanup path invalid'
  }
  if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
  Remove-Item Env:RESPONDER_PHASE17_PGBIN,Env:RESPONDER_PHASE17_PGPORT,
    Env:RESPONDER_PHASE17_PGUSER,Env:RESPONDER_PHASE17_PGDATA -ErrorAction SilentlyContinue
}
