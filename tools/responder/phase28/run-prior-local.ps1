# LOCAL DISPOSABLE REGRESSIONS ONLY. Never connects to an existing database.
param([Parameter(Mandatory=$true)][ValidateSet(21,22,23)][int]$Phase)
$ErrorActionPreference='Stop'
$bin='C:\Program Files\PostgreSQL\17\bin'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$data=Join-Path $env:TEMP ('gridly-dispatch-phase'+$Phase+'-'+[guid]::NewGuid().ToString('N'))
$owner='phase'+$Phase+'_local_owner'
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$listener.Start(); $port=$listener.LocalEndpoint.Port; $listener.Stop()
$started=$false
$testFile=@{21='responder-phase21-local-schema.test.mjs';22='responder-phase22-local-rls-command.test.mjs';23='responder-phase23-local-auth-invitation.test.mjs'}[$Phase]
try {
 & (Join-Path $bin 'initdb.exe') -D $data -U $owner -A trust -E UTF8 --no-instructions
 if($LASTEXITCODE -ne 0){throw 'initdb failed'}
 # A captured PowerShell pipeline can wait on handles inherited by postgres.
 # Give the launcher its own files and wait only for pg_ctl to exit.
 $launchArgs='-D "'+$data+'" -l "'+(Join-Path $data 'server.log')+'" -o "-h 127.0.0.1 -p '+$port+'" -w start'
 $launcher=Start-Process -FilePath (Join-Path $bin 'pg_ctl.exe') -ArgumentList $launchArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $data 'launcher.out') -RedirectStandardError (Join-Path $data 'launcher.err')
 if(-not $launcher.WaitForExit(60000)){throw 'local PostgreSQL startup timed out'}
 if($launcher.ExitCode -ne 0){throw 'local PostgreSQL startup failed'}
 $started=$true
 foreach($pair in @{PGBIN=$bin;PGPORT=[string]$port;PGUSER=$owner;PGDATA=$data}.GetEnumerator()) {
  [Environment]::SetEnvironmentVariable('DISPATCH_PHASE'+$Phase+'_'+$pair.Key,$pair.Value,'Process')
 }
 Push-Location $repo
 try { & node (Join-Path 'tests' $testFile); if($LASTEXITCODE -ne 0){throw "Phase $Phase regression failed"} }
 finally { Pop-Location }
} finally {
 if($started -or (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid'))) {
  & (Join-Path $bin 'pg_ctl.exe') -D $data -m immediate -w stop
  if($LASTEXITCODE -ne 0){throw 'Local server cleanup failed; preserve data for inspection'}
 }
 $resolved=[IO.Path]::GetFullPath($data)
 $tempRoot=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
 if(-not $resolved.StartsWith($tempRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch ('^gridly-dispatch-phase'+$Phase+'-[a-f0-9]{32}$')){throw 'Unsafe cleanup path'}
 if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
 foreach($key in 'PGBIN','PGPORT','PGUSER','PGDATA'){[Environment]::SetEnvironmentVariable('DISPATCH_PHASE'+$Phase+'_'+$key,$null,'Process')}
}
