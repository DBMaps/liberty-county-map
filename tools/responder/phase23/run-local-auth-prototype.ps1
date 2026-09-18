# LOCAL DISPOSABLE PROTOTYPE ONLY. NOT A PRODUCTION MIGRATION.
$ErrorActionPreference = 'Stop'
$bin = 'C:\Program Files\PostgreSQL\17\bin'
if (-not (Test-Path -LiteralPath (Join-Path $bin 'initdb.exe'))) { throw 'PostgreSQL 17 local toolchain missing' }
$data = Join-Path $env:TEMP ('gridly-dispatch-phase23-' + [guid]::NewGuid().ToString('N'))
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
$listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
$started = $false
try {
  & (Join-Path $bin 'initdb.exe') -D $data -U phase23_local_owner -A trust -E UTF8 --no-instructions
  if ($LASTEXITCODE -ne 0) { throw 'Phase 23 initdb failed' }
  & (Join-Path $bin 'pg_ctl.exe') -D $data -l (Join-Path $data 'server.log') -o "-h 127.0.0.1 -p $port" -w start
  if ($LASTEXITCODE -ne 0) { throw 'Phase 23 server start failed' }
  $started = $true
  $env:DISPATCH_PHASE23_PGBIN = $bin
  $env:DISPATCH_PHASE23_PGPORT = [string]$port
  $env:DISPATCH_PHASE23_PGUSER = 'phase23_local_owner'
  $env:DISPATCH_PHASE23_PGDATA = $data
  & node tests/responder-phase23-local-auth-invitation.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Phase 23 disposable suite failed' }
} finally {
  if ($started) { & (Join-Path $bin 'pg_ctl.exe') -D $data -m immediate -w stop }
  $resolved = [System.IO.Path]::GetFullPath($data).TrimEnd('\')
  $tempResolved = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
  if (-not $resolved.StartsWith($tempResolved+'\',[System.StringComparison]::OrdinalIgnoreCase) -or
      -not [System.IO.Path]::GetFileName($resolved).StartsWith('gridly-dispatch-phase23-')) {
    throw 'Phase 23 cleanup path invalid'
  }
  if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
  Remove-Item Env:DISPATCH_PHASE23_PGBIN,Env:DISPATCH_PHASE23_PGPORT,
    Env:DISPATCH_PHASE23_PGUSER,Env:DISPATCH_PHASE23_PGDATA -ErrorAction SilentlyContinue
}
