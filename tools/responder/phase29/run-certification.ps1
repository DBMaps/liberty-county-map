param([switch]$FocusedOnly,[switch]$ReviewOnly)
# LOCAL DISPOSABLE CERTIFICATION ONLY. No linked project or production endpoint.
$ErrorActionPreference='Stop'
$repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).Path
$suffix=[guid]::NewGuid().ToString('N').Substring(0,12)
$projectId='gridly-dispatch-phase29-'+$suffix
$runtime=Join-Path $env:TEMP $projectId
$network='gridly-phase29-'+$suffix
$evidence=Join-Path $repo 'reports\responder\phase29-evidence'
if($ReviewOnly){$evidence=Join-Path $evidence 'review-authority-focused'}else{if(-not $FocusedOnly){$evidence=Join-Path $evidence 'review-authority-final'}}
$docker='C:\Users\gulfi\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$supabase='C:\Users\gulfi\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\@supabase\cli-windows-x64\bin\supabase.exe'
$started=$false; $networkCreated=$false; $startAttempted=$false
function Assert-DisposableCliDirectory {
 if((Get-Location).Path -ne $runtime -or -not $runtime.StartsWith([IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Supabase CLI outside disposable TEMP project refused'}
}
function Invoke-SqlFile([string]$file) {
 $sql=[IO.File]::ReadAllText($file)
 $sql=$sql.Replace('\ir seed-static-contract.sql',[IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\phase26\seed-static-contract.sql'))).Replace('\ir compatibility.sql',[IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\phase26\compatibility.sql')))
 $sql | & $docker exec -i ('supabase_db_'+$projectId) psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
 if($LASTEXITCODE -ne 0){throw "SQL install failed: $file"}
}
try {
 & node (Join-Path $PSScriptRoot 'build-package.mjs'); if($LASTEXITCODE -ne 0){throw 'package build failed'}
 if((& $docker info --format '{{.OSType}}').Trim() -ne 'linux'){throw 'healthy local Linux Docker engine required'}
 New-Item -ItemType Directory -Path $runtime | Out-Null
 New-Item -ItemType Directory -Path $evidence -Force | Out-Null
 Push-Location $runtime
 try {
 $env:SUPABASE_TELEMETRY_DISABLED='true'
 Assert-DisposableCliDirectory; & $supabase init | Out-Null; if($LASTEXITCODE -ne 0){throw 'unlinked init failed'}
 if(Test-Path -LiteralPath (Join-Path $runtime 'supabase\.temp\project-ref')){throw 'linked project refused'}
 Assert-DisposableCliDirectory; & $supabase migration new phase29_disposable_bootstrap | Out-Null; if($LASTEXITCODE -ne 0){throw 'bootstrap generation failed'}
 $stubFile=Get-ChildItem -LiteralPath (Join-Path $runtime 'supabase\migrations') -Filter '*phase29_disposable_bootstrap.sql' | Select-Object -First 1
 [IO.File]::WriteAllText($stubFile.FullName,'CREATE SCHEMA dispatch_api;',[Text.UTF8Encoding]::new($false))
 $configPath=Join-Path $runtime 'supabase\config.toml'; $config=[IO.File]::ReadAllText($configPath)
 $config=[regex]::new('schemas\s*=\s*\["public",\s*"graphql_public"\]').Replace($config,'schemas = ["public", "graphql_public", "dispatch_api"]',1)
 $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?enroll_enabled\s*=\s*)false').Replace($config,'$1true',1)
 $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?verify_enabled\s*=\s*)false').Replace($config,'$1true',1)
 [IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false))
 & $docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 $network | Out-Null; if($LASTEXITCODE -ne 0){throw 'loopback network failed'}; $networkCreated=$true; $startAttempted=$true
 Assert-DisposableCliDirectory; & $supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --network-id $network 2>$null | Out-Null
 if($LASTEXITCODE -ne 0){throw 'disposable Supabase start failed'}; $started=$true
 $vars=@{}; Assert-DisposableCliDirectory; & $supabase status -o env 2>$null | ForEach-Object {if($_ -match '^([A-Z0-9_]+)="(.*)"$'){$vars[$matches[1]]=$matches[2]}}
 if($vars.API_URL -ne 'http://127.0.0.1:54321'){throw 'non-loopback API refused'}
 'DROP SCHEMA dispatch_api;' | & $docker exec -i ('supabase_db_'+$projectId) psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
 if($LASTEXITCODE -ne 0){throw 'bootstrap cleanup failed'}
 Invoke-SqlFile (Join-Path $PSScriptRoot '..\phase26\baseline.sql')
 Invoke-SqlFile (Join-Path $PSScriptRoot '..\phase26\preflight.sql')
 Invoke-SqlFile (Join-Path $PSScriptRoot '..\phase28\package.local.sql')
 Invoke-SqlFile (Join-Path $PSScriptRoot 'package.local.sql')
 Invoke-SqlFile (Join-Path $PSScriptRoot '..\phase28\postflight.sql')
 Invoke-SqlFile (Join-Path $PSScriptRoot '..\phase28\rollback.sql')
 Invoke-SqlFile (Join-Path $PSScriptRoot '..\phase26\preflight.sql')
 Invoke-SqlFile (Join-Path $PSScriptRoot '..\phase28\package.local.sql')
 Invoke-SqlFile (Join-Path $PSScriptRoot 'package.local.sql')
 Invoke-SqlFile (Join-Path $PSScriptRoot '..\phase28\postflight.sql')
 if($FocusedOnly){
  & node --test (Join-Path $repo 'tests\responder-phase29-durable-contract.test.mjs'); if($LASTEXITCODE -ne 0){throw 'focused SQL delimiter regression failed'}
  $probe='BEGIN; GRANT dispatch_function_owner TO postgres; SET LOCAL ROLE dispatch_function_owner; DO $probe$ BEGIN IF to_regprocedure(''dispatch_private.report_review_prerequisites(uuid)'') IS NULL OR to_regprocedure(''dispatch_private.report_public_eligible(uuid)'') IS NULL THEN RAISE EXCEPTION ''eligibility functions missing''; END IF; IF dispatch_private.report_review_prerequisites(''00000000-0000-0000-0000-000000000000'') OR dispatch_private.report_public_eligible(''00000000-0000-0000-0000-000000000000'') THEN RAISE EXCEPTION ''unknown review must refuse''; END IF; END $probe$; ROLLBACK; INSERT INTO dispatch_private.organizations(display_name,legal_name,organization_type) VALUES (''LOCAL SYNTHETIC REFUSAL'',''LOCAL SYNTHETIC REFUSAL'',''MUNICIPALITY'');'
  $probe | & $docker exec -i ('supabase_db_'+$projectId) psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
  if($LASTEXITCODE -ne 0){throw 'focused installed function/refusal fixture failed'}
  foreach($case in @(@{file='package.local.sql';error='PHASE29_REFUSED populated'},@{file='..\phase28\rollback.sql';error='ROLLBACK_REFUSED'})){
   $output=[IO.File]::ReadAllText((Join-Path $PSScriptRoot $case.file)) | & $docker exec -i ('supabase_db_'+$projectId) psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1
   if($LASTEXITCODE -eq 0 -or ($output -join '
') -notmatch $case.error){throw ('focused refusal failed: '+$case.file)}
  }
  Invoke-SqlFile (Join-Path $PSScriptRoot '..\phase28\postflight.sql')
  [IO.File]::WriteAllText((Join-Path $evidence 'recovery-focused-results.json'),'{"verdict":"PASS","checksPassed":8,"checksFailed":0,"checks":["initial installation","Phase27 security continuity","empty rollback","reinstallation","delimiter regression","installed eligibility functions refuse missing review","populated install refusal","evidence-bearing rollback refusal"]}')
  Write-Output 'PHASE29_RECOVERY_FOCUSED_PASS: 8/8 checks; 10/10 static tests'
  return
 }
 $env:P29_REVIEW_ONLY=if($ReviewOnly){'true'}else{'false'}; $env:P29_API_URL=$vars.API_URL; $env:P29_ANON_KEY=$vars.ANON_KEY; $env:P29_SERVICE_KEY=$vars.SERVICE_ROLE_KEY
 $env:P29_DOCKER=$docker; $env:P29_PROJECT_ID=$projectId; $env:P29_EVIDENCE_DIR=$evidence
 & node --test (Join-Path $PSScriptRoot 'runtime.test.mjs'); if($LASTEXITCODE -ne 0){throw 'Phase 29 runtime certification failed'}
 } finally {Pop-Location}
} finally {
 if($startAttempted -and (Test-Path -LiteralPath $runtime)){Push-Location $runtime; try{Assert-DisposableCliDirectory; & $supabase stop --no-backup 2>$null | Out-Null}finally{Pop-Location}}
 if($networkCreated){& $docker network rm $network 2>$null | Out-Null}
 $resolved=[IO.Path]::GetFullPath($runtime); $tempRoot=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
 if(-not $resolved.StartsWith($tempRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch '^gridly-dispatch-phase29-[a-f0-9]{12}$'){throw 'unsafe disposable cleanup path'}
 if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
 foreach($name in 'P29_REVIEW_ONLY','P29_API_URL','P29_ANON_KEY','P29_SERVICE_KEY','P29_DOCKER','P29_PROJECT_ID','P29_EVIDENCE_DIR'){[Environment]::SetEnvironmentVariable($name,$null,'Process')}
}
