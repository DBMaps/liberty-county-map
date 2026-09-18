# LOCAL DISPOSABLE PROTOTYPE ONLY. NOT A PRODUCTION MIGRATION.
$ErrorActionPreference = 'Stop'
$bin = 'C:\Program Files\PostgreSQL\17\bin'
if (-not (Test-Path -LiteralPath (Join-Path $bin 'initdb.exe'))) { throw 'PostgreSQL 17 local toolchain missing' }
$data = Join-Path $env:TEMP ('gridly-dispatch-phase22-' + [guid]::NewGuid().ToString('N'))
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
$listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
$started = $false
try {
  & (Join-Path $bin 'initdb.exe') -D $data -U phase22_local_owner -A trust -E UTF8 --no-instructions
  if ($LASTEXITCODE -ne 0) { throw 'Phase 22 initdb failed' }
  & (Join-Path $bin 'pg_ctl.exe') -D $data -l (Join-Path $data 'server.log') -o "-h 127.0.0.1 -p $port" -w start
  if ($LASTEXITCODE -ne 0) { throw 'Phase 22 server start failed' }
  $started = $true
  $env:DISPATCH_PHASE22_PGBIN = $bin
  $env:DISPATCH_PHASE22_PGPORT = [string]$port
  $env:DISPATCH_PHASE22_PGUSER = 'phase22_local_owner'
  $env:DISPATCH_PHASE22_PGDATA = $data
  & node tests/responder-phase22-local-rls-command.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Phase 22 disposable suite failed' }
} finally {
  if ($started) { & (Join-Path $bin 'pg_ctl.exe') -D $data -m immediate -w stop }
  $resolved = [System.IO.Path]::GetFullPath($data).TrimEnd('\')
  $tempResolved = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
  if (-not $resolved.StartsWith($tempResolved+'\',[System.StringComparison]::OrdinalIgnoreCase) -or
      -not [System.IO.Path]::GetFileName($resolved).StartsWith('gridly-dispatch-phase22-')) {
    throw 'Phase 22 cleanup path invalid'
  }
  if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
  Remove-Item Env:DISPATCH_PHASE22_PGBIN,Env:DISPATCH_PHASE22_PGPORT,
    Env:DISPATCH_PHASE22_PGUSER,Env:DISPATCH_PHASE22_PGDATA -ErrorAction SilentlyContinue
}
