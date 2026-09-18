# LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
$ErrorActionPreference='Stop'
$repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).Path
$suffix=[guid]::NewGuid().ToString('N').Substring(0,12)
$projectId='gridly-dispatch-phase26-'+$suffix
$runtime=Join-Path $env:TEMP $projectId
$network='gridly-phase26-'+$suffix
$evidence=Join-Path $repo 'reports\responder\phase26-evidence'
$docker='C:\Users\gulfi\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$started=$false; $networkCreated=$false; $startAttempted=$false
function Invoke-SqlFile([string]$file,[switch]$ExpectFailure){
  $text=[IO.File]::ReadAllText((Join-Path $PSScriptRoot $file))
  $text=$text.Replace('\ir seed-static-contract.sql',[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'seed-static-contract.sql')))
  $text=$text.Replace('\ir compatibility.sql',[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'compatibility.sql')))
  $text | & $docker exec -i ('supabase_db_'+$projectId) psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
  if($ExpectFailure){if($LASTEXITCODE -eq 0){throw "$file unexpectedly succeeded"}}
  elseif($LASTEXITCODE -ne 0){throw "$file failed"}
}
function Invoke-Scalar([string]$sql){
  $out=& $docker exec ('supabase_db_'+$projectId) psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d postgres -c $sql
  if($LASTEXITCODE -ne 0){throw 'scalar SQL failed'}; $last=$out|Select-Object -Last 1; if($null -eq $last){return ''}; return $last.Trim()
}
try{
  if(-not (Test-Path -LiteralPath $docker)){throw 'Docker CLI missing'}
  if((& $docker info --format '{{.OSType}}').Trim() -ne 'linux'){throw 'healthy Docker Linux engine required'}
  New-Item -ItemType Directory -Path $runtime | Out-Null
  New-Item -ItemType Directory -Path $evidence -Force | Out-Null
  Push-Location $runtime
  try{
    $env:SUPABASE_TELEMETRY_DISABLED='true'
    & npm exec --offline -- supabase init | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Supabase init failed'}
    if(Test-Path -LiteralPath (Join-Path $runtime 'supabase\.temp\project-ref')){throw 'linked local project forbidden'}
    $stubDir=Join-Path $runtime 'supabase\migrations'; New-Item -ItemType Directory -Path $stubDir -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $stubDir '00000000000000_phase26_disposable_api_bootstrap.sql'),'CREATE SCHEMA dispatch_api;',[Text.UTF8Encoding]::new($false))
    $configPath=Join-Path $runtime 'supabase\config.toml'
    $config=[IO.File]::ReadAllText($configPath)
    $config=[regex]::new('schemas\s*=\s*\["public",\s*"graphql_public"\]').Replace($config,'schemas = ["public", "graphql_public", "dispatch_api"]',1)
    $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?enroll_enabled\s*=\s*)false').Replace($config,'$1true',1)
    $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?verify_enabled\s*=\s*)false').Replace($config,'$1true',1)
    [IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false))
    & $docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 $network | Out-Null
    if($LASTEXITCODE -ne 0){throw 'network create failed'}; $networkCreated=$true; $startAttempted=$true
    & npm exec --offline -- supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --network-id $network 2>$null | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Supabase start failed'}; $started=$true
    $vars=@{}; & npm exec --offline -- supabase status -o env 2>$null | ForEach-Object {if($_ -match '^([A-Z0-9_]+)="(.*)"$'){$vars[$matches[1]]=$matches[2]}}
    if($vars.API_URL -ne 'http://127.0.0.1:54321'){throw 'API is not loopback-only'}
    Invoke-Scalar 'DROP SCHEMA dispatch_api'
    Invoke-SqlFile 'baseline.sql'
    [IO.File]::WriteAllText((Join-Path $evidence 'baseline-catalog.json'),(Invoke-Scalar "SELECT jsonb_build_object('schemas',(SELECT jsonb_agg(nspname ORDER BY nspname) FROM pg_namespace WHERE nspname IN('public','auth','report_retention','gridly_rehearsal')),'consumer_rows',(SELECT count(*) FROM public.gridly_consumer_sentinel),'reporting_enabled',(SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton))")+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
    Invoke-SqlFile 'preflight.sql'
    foreach($f in 'failure-type-table.sql','failure-rls.sql','failure-command.sql','failure-grants.sql'){Invoke-SqlFile $f -ExpectFailure}
    if((Invoke-Scalar "SELECT count(*) FROM pg_namespace WHERE nspname LIKE 'phase26_failure_%'") -ne '0'){throw 'failure transaction residue'}
    Invoke-SqlFile 'apply.sql'; Invoke-SqlFile 'postflight.sql'
    Invoke-SqlFile 'rollback.sql'
    if((Invoke-Scalar "SELECT count(*) FROM pg_namespace WHERE nspname LIKE 'dispatch_%'") -ne '0'){throw 'pre-data rollback residue'}
    Invoke-SqlFile 'preflight.sql'; Invoke-SqlFile 'apply.sql'; Invoke-SqlFile 'postflight.sql'
    $env:P26_API_URL=$vars.API_URL; $env:P26_ANON_KEY=$vars.ANON_KEY; $env:P26_SERVICE_KEY=$vars.SERVICE_ROLE_KEY
    $env:P26_DOCKER=$docker; $env:P26_PROJECT_ID=$projectId; $env:P26_EVIDENCE_DIR=$evidence
    & node --test (Join-Path $PSScriptRoot 'rehearsal-runtime.test.mjs')
    if($LASTEXITCODE -ne 0){throw 'runtime rehearsal failed'}
    Invoke-SqlFile 'rollback.sql' -ExpectFailure
    if((Invoke-Scalar "SELECT count(*) FROM pg_namespace WHERE nspname='dispatch_private'") -ne '1'){throw 'evidence rollback did not preserve schema'}
    Invoke-SqlFile 'postflight.sql'
    $catalog=Invoke-Scalar "SELECT jsonb_build_object('schemas',(SELECT jsonb_agg(nspname ORDER BY nspname) FROM pg_namespace WHERE nspname LIKE 'dispatch_%'),'tables',(SELECT jsonb_agg(n.nspname||'.'||c.relname ORDER BY 1) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'dispatch_%' AND c.relkind='r'),'types',(SELECT jsonb_agg(n.nspname||'.'||t.typname ORDER BY 1) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname LIKE 'dispatch_%' AND t.typtype='e'),'functions',(SELECT jsonb_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' ORDER BY 1) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('dispatch_private','dispatch_api')),'policies',(SELECT jsonb_agg(schemaname||'.'||tablename||'.'||policyname ORDER BY 1) FROM pg_policies WHERE schemaname LIKE 'dispatch_%'),'consumer_rows',(SELECT count(*) FROM public.gridly_consumer_sentinel),'reporting_enabled',(SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton))"
    $raw=Join-Path $evidence 'post-catalog.raw.json'; [IO.File]::WriteAllText($raw,$catalog+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
    & node (Join-Path $PSScriptRoot 'catalog-snapshot.mjs') $raw (Join-Path $evidence 'post-catalog-certified.json')
    Remove-Item -LiteralPath $raw -Force
  } finally {Pop-Location}
} finally {
  if($startAttempted -and (Test-Path -LiteralPath $runtime)){Push-Location $runtime; try{& npm exec --offline -- supabase stop --no-backup 2>$null | Out-Null}finally{Pop-Location}}
  if($networkCreated){& $docker network rm $network 2>$null | Out-Null}
  $resolved=[IO.Path]::GetFullPath($runtime); $tempRoot=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
  if(-not $resolved.StartsWith($tempRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or -not [IO.Path]::GetFileName($resolved).StartsWith('gridly-dispatch-phase26-')){throw 'unsafe cleanup target'}
  if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
  $containers=@(& $docker ps -a --filter 'name=gridly-dispatch-phase26-' --format '{{.Names}}'); $networks=@(& $docker network ls --filter 'name=gridly-phase26-' --format '{{.Name}}')
  $teardown=@{phase=26;containers_remaining=@($containers|Where-Object {$_});networks_remaining=@($networks|Where-Object {$_});temporary_databases_remaining=0;remote_connections=0;production_credentials=0;runtime_directory_removed=(-not (Test-Path -LiteralPath $resolved))}|ConvertTo-Json -Depth 4
  [IO.File]::WriteAllText((Join-Path $evidence 'teardown.json'),$teardown+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
  Remove-Item Env:P26_API_URL,Env:P26_ANON_KEY,Env:P26_SERVICE_KEY,Env:P26_DOCKER,Env:P26_PROJECT_ID,Env:P26_EVIDENCE_DIR,Env:SUPABASE_TELEMETRY_DISABLED -ErrorAction SilentlyContinue
}
