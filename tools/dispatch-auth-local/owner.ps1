# Interactive owner acceptance only. No production, consumer or publication activation.
param(
 [Parameter(Mandatory=$true)][string]$Supabase,
 [Parameter(Mandatory=$true)][string]$Docker,
 [switch]$Certification,
 [ValidateSet('None','AfterNetwork','AfterProvision')][string]$Fault='None'
)
$ErrorActionPreference='Stop'
$project='gridly-dispatch-auth-'+[guid]::NewGuid().ToString('N').Substring(0,12)
$runtime=Join-Path $env:TEMP $project
$network=$project+'-net'
$priorPath=$env:PATH
$priorTelemetry=$env:SUPABASE_TELEMETRY_DISABLED
$created=$false
$attempted=$false
function Exec-Checked([string]$exe,[string[]]$argv){if($exe -eq $Docker){$argv=@('--host','npipe:////./pipe/dockerDesktopLinuxEngine')+$argv};& $exe @argv; if($LASTEXITCODE -ne 0){throw ('Local command failed: '+[IO.Path]::GetFileName($exe)+' '+$argv[0])}}
function Tcp-Open([string]$address,[int]$port){$socket=[Net.Sockets.TcpClient]::new();try{$task=$socket.ConnectAsync($address,$port);return ($task.Wait(1200) -and $socket.Connected)}catch{return $false}finally{$socket.Dispose()}}
$worker=$null;$credentialWindow=$null;$edgeProcess=$null;$consoleMode=$null;$failure=$null;$cleanupErrors=New-Object 'System.Collections.Generic.List[string]'
$secretEnv=@{};foreach($key in 'DISPATCH_LOCAL_API','DISPATCH_LOCAL_ANON','DISPATCH_LOCAL_SERVICE','DISPATCH_LOCAL_DOCKER','DISPATCH_LOCAL_PROJECT','DISPATCH_LOCAL_EVIDENCE','DISPATCH_OWNER_RUNTIME','DISPATCH_OWNER_FAULT'){$secretEnv[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
try{
 $repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path;$safeRepo=$repo.Replace('\','/')
 & (Join-Path $PSScriptRoot 'verify-sources.ps1') -Repository $repo
 if($Fault -ne 'None' -and -not $Certification){throw 'Fault injection is certification-only'}
 try{if(-not [Console]::IsInputRedirected){$consoleMode=[Console]::TreatControlCAsInput;[Console]::TreatControlCAsInput=$true}elseif(-not $Certification){throw 'Use an interactive PowerShell console'}}catch{if(-not $Certification){throw 'Use an interactive PowerShell console'};$consoleMode=$null}
 foreach($port in 54321,54322,54324,4180){
  if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object {$_.LocalPort -eq $port}).Count){throw ('Expected port occupied: '+$port)}
  $probe=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$port);try{$probe.Start()}finally{$probe.Stop()}
 }
 if(-not [IO.Path]::IsPathRooted($Docker) -or -not [IO.Path]::IsPathRooted($Supabase)){throw 'Absolute executable paths required'}
 if($env:DOCKER_HOST -or $env:DOCKER_CONTEXT){throw 'Ambient Docker endpoint overrides are unsupported'}
 $endpoint=& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' context inspect --format '{{.Endpoints.docker.Host}}';if($LASTEXITCODE -ne 0 -or $endpoint.Trim() -ne 'npipe:////./pipe/dockerDesktopLinuxEngine'){throw 'Certified local Linux Docker endpoint required'}
 New-Item -ItemType Directory -Path $runtime | Out-Null
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $acl=New-Object Security.AccessControl.DirectorySecurity;$acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false)
 foreach($identity in @($sid,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))}
 Set-Acl -LiteralPath $runtime -AclObject $acl
 Write-Output ('OWNER SESSION: '+$runtime)
 Push-Location $runtime
 try{
  $env:SUPABASE_TELEMETRY_DISABLED='true'
  $version=& $Supabase --version;if($LASTEXITCODE -ne 0 -or $version.Trim() -ne '2.119.0'){throw 'Certified Supabase CLI v2.119.0 required'}
  Exec-Checked $Supabase @('start','--help') | Out-Null
  Exec-Checked $Supabase @('init') | Out-Null
  $configPath=Join-Path $runtime 'supabase\config.toml'
  $config=[IO.File]::ReadAllText($configPath)
  $config=[regex]::Replace($config,'(?m)^project_id = .*$',('project_id = "'+$project+'"'))
  $config=[regex]::new('(?ms)(\[realtime\].*?enabled\s*=\s*)true').Replace($config,'$1false',1)
  $config=[regex]::Replace($config,'(?m)^jwt_expiry = .*$', 'jwt_expiry = 900')
  # Global signup denial is separate from the CLI's email-provider switch.
  $config=[regex]::new('(?ms)(\[auth\].*?enable_signup\s*=\s*)true').Replace($config,'$1false',1)
  $config=[regex]::new('(?ms)(\[auth\.sms\].*?enable_signup\s*=\s*)true').Replace($config,'$1false',1)
  $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?enroll_enabled\s*=\s*)false').Replace($config,'$1true',1)
  $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?verify_enabled\s*=\s*)false').Replace($config,'$1true',1)
  $config=[regex]::Replace($config,'(?m)^schemas = .*$', 'schemas = ["public", "graphql_public", "dispatch_api"]')
  [IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false))
  Exec-Checked $Supabase @('migration','new','disposable_context_bootstrap') | Out-Null
  $bootstrap=Get-ChildItem -LiteralPath 'supabase\migrations' -Filter '*disposable_context_bootstrap.sql' | Select-Object -First 1
  'CREATE SCHEMA dispatch_api;' | Set-Content -LiteralPath $bootstrap.FullName -Encoding ASCII
  if(Test-Path -LiteralPath 'supabase\.temp\project-ref'){throw 'Linked project forbidden'}
  New-Item -ItemType Directory -Path shim | Out-Null
  $source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'context-docker-guard.cs')).Replace('@@DOCKER@@',$Docker.Replace('"','""')).Replace('@@PROJECT@@',$project).Replace('@@NETWORK@@',$network).Replace('@@LOG@@',(Join-Path $runtime 'bindings.log'))
  [IO.File]::WriteAllText((Join-Path $runtime 'shim\guard.cs'),$source)
  Exec-Checked 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' @('/nologo','/r:System.Web.Extensions.dll',('/out:'+(Join-Path $runtime 'shim\docker.exe')),(Join-Path $runtime 'shim\guard.cs'))
  $shim=Join-Path $runtime 'shim\docker.exe'
  $env:PATH=(Join-Path $runtime 'shim')+';'+$priorPath
  Exec-Checked $Docker @('network','create','--driver','bridge','--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',$network) | Out-Null
  $created=$true
  if($Fault -eq 'AfterNetwork'){throw 'Injected startup refusal after owned network creation'}
  $denied=0
  # Windows PowerShell treats redirected native stderr as error records; expected guard refusals remain explicit.
  $ErrorActionPreference='Continue'
  foreach($mapping in '0.0.0.0:54324:8025','[::]:54324:8025','54325:8025','54324:1025','54324:8025/udp'){
   & $shim create --name ('supabase_inbucket_'+$project) --network $network -p $mapping public.ecr.aws/supabase/mailpit:v1.31.3 2>$null
   if($LASTEXITCODE -ne 125){throw 'Adversarial mapping accepted'};$denied++
  }
  foreach($flag in '--publish-all','--publish=54324:8025','--network=host','--privileged'){
   & $shim create --name ('supabase_inbucket_'+$project) --network $network $flag public.ecr.aws/supabase/mailpit:v1.31.3 2>$null
   if($LASTEXITCODE -ne 125){throw 'Unexpected Docker flag accepted'};$denied++
  }
  foreach($extra in @(@('-p','54325:5000'),@('--network','host'),@('--privileged'))){
   & $shim run --rm --network $network --label ('com.supabase.cli.project='+$project) --label ('com.docker.compose.project='+$project) @extra public.ecr.aws/supabase/storage-api:v1.79.28 node dist/scripts/migrate-call.js 2>$null
   if($LASTEXITCODE -ne 125){throw 'Unsafe migration job accepted'};$denied++
  }
  # Unsafe negative control is CREATED but NEVER STARTED; no listener is exposed.
  Exec-Checked $Docker @('create','--name',('supabase_inbucket_'+$project),'--network',$network,'-p','54324:8025','public.ecr.aws/supabase/mailpit:v1.31.3') | Out-Null
  & $shim start ('supabase_inbucket_'+$project) 2>$null;if($LASTEXITCODE -ne 125){throw 'Unsafe pre-start binding accepted'};$denied++
  $running=& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' inspect ('supabase_inbucket_'+$project) --format '{{.State.Running}}';if($running.Trim() -ne 'false'){throw 'Negative control ran'}
  Exec-Checked $Docker @('rm',('supabase_inbucket_'+$project)) | Out-Null
  $ErrorActionPreference='Stop'
  $attempted=$true
  $ErrorActionPreference='Continue'
  & $Supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --network-id $network *> (Join-Path $runtime 'startup.log')
  $ErrorActionPreference='Stop'
  if($LASTEXITCODE -ne 0){throw 'Guarded startup failed; private logs are not printed'}
  $inventory=@();$bindings=0
  foreach($service in 'db','kong','inbucket','auth','rest'){
   $name='supabase_'+$service+'_'+$project
   $ports=(& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' inspect $name --format '{{json .NetworkSettings.Ports}}') | ConvertFrom-Json
   if($LASTEXITCODE -ne 0){throw 'Resolved inspection failed'}
   foreach($property in $ports.PSObject.Properties){foreach($binding in $property.Value){if($binding.HostIp -ne '127.0.0.1'){throw 'Non-loopback resolved publication'};$bindings++;$inventory+=($name+' '+$binding.HostIp+':'+$binding.HostPort+' -> '+$property.Name)}}
   $networks=(& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' inspect $name --format '{{json .NetworkSettings.Networks}}') | ConvertFrom-Json
   if(@($networks.PSObject.Properties).Count -ne 1 -or -not $networks.$network){throw 'Network isolation drift'}
  }
  if($bindings -ne 3 -or @(Get-Content -LiteralPath (Join-Path $runtime 'bindings.log')).Count -ne 3){throw 'CLI bypass or inventory drift'}
  $addresses=@(Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred | Where-Object {$_.IPAddress -notmatch '^(127\.|169\.254\.)'} | Select-Object -ExpandProperty IPAddress -Unique)
  if($addresses.Count -eq 0){throw 'No host non-loopback probe available'}
  $probes=0
  foreach($port in 54321,54322,54324){if(-not (Tcp-Open '127.0.0.1' $port)){throw 'Local service unreachable'};foreach($address in $addresses){if(Tcp-Open $address $port){throw 'Non-loopback service reachable'};$probes++}}
  Write-Output ('GUARD PASS: '+$denied+' adversarial refusals; 3 resolved localhost bindings; 3 localhost TCP passes; '+$probes+' non-loopback rejections')
  $inventory | Write-Output
  $vars=@{}
  $ErrorActionPreference='Continue'
  & $Supabase status -o env 2>$null | ForEach-Object {if($_ -match '^([A-Z0-9_]+)="(.*)"$'){$vars[$matches[1]]=$matches[2]}}
  $ErrorActionPreference='Stop'
  if($LASTEXITCODE -ne 0 -or $vars.API_URL -ne 'http://127.0.0.1:54321' -or -not $vars.ANON_KEY -or -not $vars.SERVICE_ROLE_KEY){throw 'Disposable Auth configuration unavailable'}
  $env:DISPATCH_LOCAL_API=$vars.API_URL;$env:DISPATCH_LOCAL_ANON=$vars.ANON_KEY;$env:DISPATCH_LOCAL_SERVICE=$vars.SERVICE_ROLE_KEY
  $env:DISPATCH_LOCAL_DOCKER=$Docker;$env:DISPATCH_LOCAL_PROJECT=$project
  $env:DISPATCH_LOCAL_EVIDENCE=Join-Path ((Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path) ('reports\responder\dispatch-auth-owner\'+$project)
  New-Item -ItemType Directory -Path $env:DISPATCH_LOCAL_EVIDENCE -Force | Out-Null
  [pscustomobject]@{project=$project;resolvedPorts=$inventory;adversarialRefusals=$denied;loopbackReachable=3;nonLoopbackRejected=$probes;schemaExposure=@('public','graphql_public','dispatch_api')} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $env:DISPATCH_LOCAL_EVIDENCE 'network-gates.json') -Encoding utf8
  $env:DISPATCH_OWNER_RUNTIME=$runtime;$env:DISPATCH_OWNER_FAULT=$Fault
  $worker=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList ('"'+(Join-Path $PSScriptRoot 'owner-runtime.mjs')+'"') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'worker.out') -RedirectStandardError (Join-Path $runtime 'worker.err')
  $null=$worker.Handle
  foreach($key in $secretEnv.Keys){[Environment]::SetEnvironmentVariable($key,$null,'Process')}
  $deadline=[DateTime]::UtcNow.AddSeconds(90)
  while(-not (Test-Path -LiteralPath (Join-Path $runtime 'ready.json'))){
   $worker.Refresh();if($worker.HasExited -or (Test-Path -LiteralPath (Join-Path $runtime 'failed.json'))){if(Test-Path -LiteralPath (Join-Path $runtime 'failed.json')){$failureState=Get-Content -LiteralPath (Join-Path $runtime 'failed.json') -Raw | ConvertFrom-Json;throw ('Owner runtime startup refused at '+$failureState.phase)};throw 'Owner runtime startup refused'}
   if([DateTime]::UtcNow -gt $deadline){throw 'Owner runtime startup timed out'}
   if($consoleMode -ne $null -and [Console]::KeyAvailable){$key=[Console]::ReadKey($true);if([int]$key.KeyChar -eq 3){throw 'Owner canceled startup'}}
   Start-Sleep -Milliseconds 200
  }
  $ready=Get-Content -LiteralPath (Join-Path $runtime 'ready.json') -Raw | ConvertFrom-Json
  if($ready.url -ne 'http://127.0.0.1:4180/' -or $ready.project -ne $project -or $ready.pid -ne $worker.Id){throw 'Owner runtime identity mismatch'}
  $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object {$_.LocalPort -eq 4180})
  if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1' -or $listeners[0].OwningProcess -ne $worker.Id){throw 'UI isolation drift'}
  if(-not (Tcp-Open '127.0.0.1' 4180)){throw 'UI unreachable'};foreach($address in $addresses){if(Tcp-Open $address 4180){throw 'Non-loopback UI reachable'}}
  Write-Output ('LOCAL DISPATCH URL: '+$ready.url)
  Write-Output ('STOP COMMAND: & "'+(Join-Path $PSScriptRoot 'owner-stop.ps1')+'" -SessionPath "'+$runtime+'"')
  Write-Output 'Press Ctrl+C in this console to stop and verify cleanup. Keep this console open.'
  if(-not $Certification){
   $credentialArgs='-NoProfile -STA -File "'+(Join-Path $PSScriptRoot 'owner-credentials.ps1')+'" -Mode Show -Path "'+$ready.credentialPath+'"'
   $credentialWindow=Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentList $credentialArgs -WindowStyle Hidden -PassThru
   $edge=Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe';if(-not (Test-Path -LiteralPath $edge)){$edge=Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'}
   if(-not (Test-Path -LiteralPath $edge)){throw 'Microsoft Edge unavailable'}
   $edgeProfile=Join-Path $runtime 'edge-profile';$edgeProcess=Start-Process -FilePath $edge -ArgumentList ('--inprivate --new-window --user-data-dir="'+$edgeProfile+'" '+$ready.url) -PassThru
  }
  while($true){
   $worker.Refresh();if($worker.HasExited){$worker.WaitForExit();if($worker.ExitCode -ne 0){throw 'Owner runtime ended unexpectedly'};break}
   if($consoleMode -ne $null -and [Console]::KeyAvailable){$key=[Console]::ReadKey($true);if([int]$key.KeyChar -eq 3){[IO.File]::WriteAllText((Join-Path $runtime 'stop.request'),'');break}}
   Start-Sleep -Milliseconds 200
  }
 }finally{Pop-Location}
}catch{$failure=$_.Exception.Message;Write-Output ('OWNER START/SESSION REFUSED: '+$failure)}finally{
 # Independent cleanup actions continue even if one action fails. Names are exact UUID-owned resources.
 if($worker){try{if(Test-Path -LiteralPath $runtime){[IO.File]::WriteAllText((Join-Path $runtime 'stop.request'),'')};if(-not $worker.WaitForExit(10000)){Stop-Process -Id $worker.Id -Force;$worker.WaitForExit()}}catch{$cleanupErrors.Add('UI process shutdown failed')}}
 if($edgeProcess){try{
  $all=@(Get-CimInstance Win32_Process);$rootProcess=@($all | Where-Object {$_.ProcessId -eq $edgeProcess.Id -and $_.Name -eq 'msedge.exe' -and $_.CommandLine -like ('*'+(Join-Path $runtime 'edge-profile')+'*')})
  $ownedPids=@($rootProcess.ProcessId);for($i=0;$i -lt 8;$i++){$ownedPids+=@($all | Where-Object {$ownedPids -contains $_.ParentProcessId -and $ownedPids -notcontains $_.ProcessId} | Select-Object -ExpandProperty ProcessId)}
  foreach($ownedPid in ($ownedPids | Select-Object -Unique)){Stop-Process -Id $ownedPid -Force -ErrorAction SilentlyContinue}
 }catch{$cleanupErrors.Add('Owned Edge shutdown failed')}}
 if(Test-Path -LiteralPath (Join-Path $runtime 'credentials.dpapi')){try{& (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -NoProfile -STA -File (Join-Path $PSScriptRoot 'owner-credentials.ps1') -Mode Forget -Path (Join-Path $runtime 'credentials.dpapi') *> $null;if($LASTEXITCODE -ne 0){$cleanupErrors.Add('Owned clipboard cleanup failed')}}catch{$cleanupErrors.Add('Owned clipboard cleanup failed')}}
 if($credentialWindow){try{$credentialWindow.Refresh();if(-not $credentialWindow.HasExited){Stop-Process -Id $credentialWindow.Id -Force}}catch{$cleanupErrors.Add('Credential window shutdown failed')}}
 if($attempted -and (Test-Path -LiteralPath $runtime)){try{Push-Location $runtime;try{$ErrorActionPreference='Continue';& $Supabase stop --no-backup *> (Join-Path $runtime 'shutdown.log')}finally{$ErrorActionPreference='Stop';Pop-Location}}catch{$cleanupErrors.Add('CLI stop failed; attempting exact Docker cleanup')}}
 $env:PATH=$priorPath;$env:SUPABASE_TELEMETRY_DISABLED=$priorTelemetry
 try{
  $containers=@(& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' ps -a --filter ('label=com.supabase.cli.project='+$project) --format '{{.Names}}');if($LASTEXITCODE -ne 0){throw 'inventory'}
  foreach($name in $containers){& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' rm -f $name *> $null;if($LASTEXITCODE -ne 0){$cleanupErrors.Add('Owned container removal failed')}}
  $volumes=@(& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' volume ls --format '{{.Name}}' | Where-Object {$_ -match ('^supabase_[a-z0-9_]+_'+[regex]::Escape($project)+'$')});if($LASTEXITCODE -ne 0){throw 'inventory'}
  foreach($name in $volumes){& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' volume rm $name *> $null;if($LASTEXITCODE -ne 0){$cleanupErrors.Add('Owned volume removal failed')}}
  if($created){& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' network rm $network *> $null;if($LASTEXITCODE -ne 0){$cleanupErrors.Add('Owned network removal failed')}}
  $leftContainers=@(& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' ps -a --filter ('label=com.supabase.cli.project='+$project) --format '{{.Names}}');if($LASTEXITCODE -ne 0){throw 'inventory'}
  $leftVolumes=@(& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' volume ls --format '{{.Name}}' | Where-Object {$_ -match ('^supabase_[a-z0-9_]+_'+[regex]::Escape($project)+'$')});if($LASTEXITCODE -ne 0){throw 'inventory'}
  $leftNetworks=@(& $Docker --host 'npipe:////./pipe/dockerDesktopLinuxEngine' network ls --format '{{.Name}}' | Where-Object {$_ -eq $network});if($LASTEXITCODE -ne 0){throw 'inventory'}
  if($leftContainers.Count+$leftVolumes.Count+$leftNetworks.Count){$cleanupErrors.Add('Owned Docker resources remain')}
 }catch{$cleanupErrors.Add('Docker cleanup verification unavailable')}
 $resolved=[IO.Path]::GetFullPath($runtime);$taskTempRoot=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
 try{if(-not $resolved.StartsWith($taskTempRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch '^gridly-dispatch-auth-[a-f0-9]{12}$'){throw 'Unsafe cleanup path'};if(Test-Path -LiteralPath $resolved){if((Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Unsafe cleanup reparse'};Remove-Item -LiteralPath $resolved -Recurse -Force}}catch{$cleanupErrors.Add('Private temporary runtime removal failed')}
 foreach($key in $secretEnv.Keys){[Environment]::SetEnvironmentVariable($key,$secretEnv[$key],'Process')};$vars=$null;$secretEnv=$null
 if($consoleMode -ne $null){[Console]::TreatControlCAsInput=$consoleMode}
 $reportRoot=Join-Path ((Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path) ('reports\responder\dispatch-auth-owner\'+$project)
 New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null
 [pscustomobject]@{project=$project;cleanupPassed=($cleanupErrors.Count -eq 0);temporaryRuntimeRemoved=(-not (Test-Path -LiteralPath $runtime));errors=@($cleanupErrors.ToArray());failedSession=($failure -ne $null)} | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $reportRoot 'cleanup.json') -Encoding utf8
 if($cleanupErrors.Count){Write-Output ('CLEANUP INCOMPLETE: '+($cleanupErrors -join '; ')+'; project '+$project);throw 'Owner cleanup incomplete'}
 Write-Output ('CLEANUP PASS: owned services, UI process, credentials and runtime removed; project '+$project)
}
if($failure){throw 'Owner startup/session failed safely'}