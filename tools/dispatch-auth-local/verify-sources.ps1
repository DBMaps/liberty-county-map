# Reviewed local source provenance only; no infrastructure or credential operations.
param([string]$Repository=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path)
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath($Repository).TrimEnd('\','/');$safe=$repo.Replace('\','/')
$base='4f685022e26a07297339750ae67219526384eef2'
$branchName='codex/dispatch-visual-shell'
function Git-Read([string[]]$Arguments){$result=@(& git -c ('safe.directory='+$safe) -C $repo @Arguments);if($LASTEXITCODE -ne 0){throw 'Source provenance Git check failed'};return $result}
$root=(Git-Read @('rev-parse','--show-toplevel')) -join ''
if([IO.Path]::GetFullPath($root) -ne $repo){throw 'Exact repository root required'}
$branch=(Git-Read @('branch','--show-current')) -join ''
$head=(Git-Read @('rev-parse','HEAD')) -join ''
if($branch -ne $branchName){throw 'Certified Dispatch branch required'}
$phase='development'
if($head -ne $base){
 $parents=(Git-Read @('show','-s','--format=%P','HEAD')) -join ''
 $subject=(Git-Read @('show','-s','--format=%s','HEAD')) -join ''
 if($parents -ne $base -or $subject -ne 'Complete Dispatch operational authentication foundation'){throw 'Incompatible source revision; reviewed closure commit required'}
 $phase='closure'
}
$required=@(
 'dispatch/app.mjs','dispatch/local-auth-view.mjs','dispatch/index.html','dispatch/styles.css','dispatch/map.css','dispatch/view-preference.mjs','dispatch/themes.css','dispatch/theme.js','dispatch/auth.mjs','dispatch/components.mjs','dispatch/assets/gridly-logo.png',
 'tools/dispatch-ui/serve.mjs','tools/responder/phase29/installer/install.sql',
 'tools/dispatch-auth-local/docker-guard.cs','tools/dispatch-auth-local/context-docker-guard.cs','tools/dispatch-auth-local/context.local.sql','tools/dispatch-auth-local/session.mjs','tools/dispatch-auth-local/server.mjs',
 'tools/dispatch-auth-local/owner.ps1','tools/dispatch-auth-local/owner-stop.ps1','tools/dispatch-auth-local/owner-credentials.ps1','tools/dispatch-auth-local/owner-fixture.mjs','tools/dispatch-auth-local/owner-runtime.mjs','tools/dispatch-auth-local/verify-sources.ps1',
 'tools/dispatch-auth-local/run.ps1','tools/dispatch-auth-local/certify.ps1','tools/dispatch-auth-local/run-regressions.ps1','tools/dispatch-auth-local/context.test.mjs','tools/dispatch-auth-local/browser.test-support.mjs','tools/dispatch-auth-local/owner.test.mjs','tools/dispatch-auth-local/owner-dialog.test.mjs','tools/dispatch-auth-local/owner-edge.test.mjs','tools/dispatch-auth-local/portability.test.mjs','tools/dispatch-auth-local/OWNER-ACCEPTANCE.md','tools/dispatch-auth-local/README.md'
)
$manifestName='tools/dispatch-auth-local/source-integrity.json'
$manifestPath=Join-Path $repo $manifestName
if(-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)){throw 'Reviewed source manifest missing'}
if((Get-Item -LiteralPath $manifestPath).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Source manifest reparse refused'}
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if((($manifest.PSObject.Properties.Name | Sort-Object) -join ',') -ne 'baseRevision,branch,format,sources' -or $manifest.format -ne 'dispatch-local-auth-sha256-lf-v1' -or $manifest.baseRevision -ne $base -or $manifest.branch -ne $branchName){throw 'Invalid source manifest contract'}
$names=@($manifest.sources.PSObject.Properties.Name)
if((($names | Sort-Object) -join "`n") -ne (($required | Sort-Object) -join "`n")){throw 'Incomplete source manifest coverage'}
foreach($name in @($required)+@($manifestName)){
 $path=Join-Path $repo $name
 if(-not (Test-Path -LiteralPath $path -PathType Leaf)){throw ('Required source missing: '+$name)}
 $cursor=Get-Item -LiteralPath $path
 while($cursor.FullName -ne $repo){if($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Source reparse refused'};$cursor=Get-Item -LiteralPath ([IO.Path]::GetDirectoryName($cursor.FullName));if(-not $cursor){throw 'Invalid source path'}}
 if($name -ne $manifestName){
  $expected=$manifest.sources.$name
  if($expected -notmatch '^[a-f0-9]{64}$'){throw 'Invalid source digest'}
  if($name -like '*.png'){$actual=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
  else{$sha=[Security.Cryptography.SHA256]::Create();try{$text=[IO.File]::ReadAllText($path).Replace("`r`n","`n");$actual=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
  if($actual -ne $expected){throw ('Reviewed source mismatch: '+$name)}
 }
 if($phase -eq 'closure'){
  # Index/worktree must match the committed review, including the manifest itself.
  & git -c ('safe.directory='+$safe) -C $repo ls-files --error-unmatch -- $name *> $null
  if($LASTEXITCODE -ne 0){throw 'Closure source is not tracked'}
  & git -c ('safe.directory='+$safe) -C $repo diff --quiet HEAD -- $name
  if($LASTEXITCODE -ne 0){throw 'Closure source differs from committed review'}
 }
}
Write-Output ('SOURCE INTEGRITY PASS: '+$required.Count+' reviewed files; '+$phase+' provenance; no generated evidence dependency')
