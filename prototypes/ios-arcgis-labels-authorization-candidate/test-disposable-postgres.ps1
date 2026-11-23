param([string]$PostgresBin='C:\Program Files\PostgreSQL\17\bin')
$ErrorActionPreference='Stop'
$candidate=(Resolve-Path -LiteralPath $PSScriptRoot).Path
$scratch=Join-Path $candidate '.scratch'
New-Item -ItemType Directory -Path $scratch -Force | Out-Null
$cluster=Join-Path $scratch ('pg-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $cluster | Out-Null
$data=Join-Path $cluster 'data'
$passfile=Join-Path $cluster 'local-pass'
$previous=@{}
foreach($item in Get-ChildItem Env: | Where-Object {$_.Name -match '^PG|^GRIDLY_LABELS_DISPOSABLE_'}){$previous[$item.Name]=$item.Value;[Environment]::SetEnvironmentVariable($item.Name,$null,'Process')}
$server=$null
try {
 $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start();$port=$listener.LocalEndpoint.Port;$listener.Stop()
 $password=[Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N')
 [IO.File]::WriteAllText($passfile,$password,[Text.UTF8Encoding]::new($false))
 & "$PostgresBin/initdb.exe" -D $data -U postgres -A scram-sha-256 "--pwfile=$passfile" --no-locale -E UTF8 | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Disposable initdb failed'}
 Remove-Item -LiteralPath $passfile
 $server=Start-Process -FilePath "$PostgresBin/postgres.exe" -ArgumentList @('-D',('"'+$data+'"'),'-h','127.0.0.1','-p',"$port",'-c','log_statement=none','-c','log_min_error_statement=panic') -RedirectStandardError (Join-Path $cluster 'pg.log') -RedirectStandardOutput (Join-Path $cluster 'stdout.log') -WindowStyle Hidden -PassThru
 $ready=$false
 for($i=0;$i -lt 30 -and !$server.HasExited;$i++){
  & "$PostgresBin/pg_isready.exe" -h 127.0.0.1 -p $port -U postgres -d postgres -t 1 -q
  if($LASTEXITCODE -eq 0){$ready=$true;break};Start-Sleep -Milliseconds 200
 }
 if(!$ready){throw 'Disposable PostgreSQL did not become ready'}
 $env:PGHOST='127.0.0.1';$env:PGPORT=[string]$port;$env:PGUSER='postgres';$env:PGPASSWORD=$password;$env:PGDATABASE='postgres';$env:PGSSLMODE='disable'
 $env:PGOPTIONS='-c statement_timeout=2000 -c lock_timeout=750'
 $env:GRIDLY_LABELS_DISPOSABLE_ROOT=$data;$env:GRIDLY_LABELS_DISPOSABLE_BIN=$PostgresBin
 node --test --test-reporter=tap (Join-Path $candidate 'tests/postgres.test.mjs') | Out-File -LiteralPath (Join-Path $candidate 'evidence/postgres.tap') -Encoding utf8
 if($LASTEXITCODE -ne 0){throw 'Disposable PostgreSQL certification failed; inspect evidence/postgres.tap'}
 Get-Content (Join-Path $candidate 'evidence/postgres.tap') -Tail 9
} finally {
 if(Test-Path -LiteralPath (Join-Path $cluster 'pg.log')){Copy-Item -LiteralPath (Join-Path $cluster 'pg.log') -Destination (Join-Path $candidate 'evidence/postgres-startup.log') -Force}
 if($server -and !$server.HasExited){& "$PostgresBin/pg_ctl.exe" -D $data -m fast -w stop | Out-Null;if($LASTEXITCODE -ne 0){throw 'Disposable shutdown failed; cluster retained'}}
 foreach($item in Get-ChildItem Env: | Where-Object {$_.Name -match '^PG|^GRIDLY_LABELS_DISPOSABLE_'}){[Environment]::SetEnvironmentVariable($item.Name,$null,'Process')}
 foreach($name in $previous.Keys){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')}
 $resolved=(Resolve-Path -LiteralPath $cluster).Path
 if([IO.Path]::GetDirectoryName($resolved) -ne $scratch -or [IO.Path]::GetFileName($resolved) -notmatch '^pg-[a-f0-9]{32}$'){throw 'Unexpected disposable path; refusing removal'}
 Remove-Item -LiteralPath $resolved -Recurse -Force
 [IO.File]::WriteAllText((Join-Path $candidate 'evidence/disposable-cleanup.txt'),'Own PostgreSQL process stopped and generated cluster removed. No shared database used.')
}
