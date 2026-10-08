# Run the unchanged 172-test Dispatch suite without overwriting historical screenshots.
$ErrorActionPreference='Stop'
$repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$id=[guid]::NewGuid().ToString('N')
$files=@('dispatch-road-selection','dispatch-notice-schedule','dispatch-notice-preview','dispatch-notice-preview-browser','dispatch-marker-normalization','dispatch-selection','dispatch-map-polish','dispatch-operational-map','dispatch-map','dispatch-theme','dispatch-visual-shell')
$copies=@()
$previousChannel=$env:DISPATCH_BROWSER_CHANNEL
$previousCount=$env:GIT_CONFIG_COUNT
$previousKey=$env:GIT_CONFIG_KEY_0
$previousValue=$env:GIT_CONFIG_VALUE_0
try{
 foreach($name in $files){
  $original=Join-Path $repo ('tests\'+$name+'.test.mjs')
  $target=Join-Path $repo ('tests\.dispatch-auth-check-'+$id+'-'+$name+'.test.mjs')
  $source=[IO.File]::ReadAllText($original)
  # Only evidence destinations change. Imports, test bodies and assertions remain identical.
  $source=[regex]::Replace($source,"new URL\('(?<path>\.\./reports/responder/[^']+/)',\s*import\.meta\.url\)",{param($match) "new URL('"+$match.Groups['path'].Value+'auth-m1-'+$id+"/',import.meta.url)"})
  [IO.File]::WriteAllText($target,$source,[Text.UTF8Encoding]::new($false));$copies+=$target
 }
 $env:DISPATCH_BROWSER_CHANNEL='msedge'
 $env:GIT_CONFIG_COUNT='1';$env:GIT_CONFIG_KEY_0='safe.directory';$env:GIT_CONFIG_VALUE_0=$repo.Replace('\','/')
 Push-Location $repo
 try{& 'C:\Program Files\nodejs\node.exe' --test --test-concurrency=1 @copies;if($LASTEXITCODE -ne 0){throw 'Dispatch regression failure'}}finally{Pop-Location}
 Write-Output ('Evidence namespace: auth-m1-'+$id)
}finally{
 foreach($path in $copies){$resolved=[IO.Path]::GetFullPath($path);if(-not $resolved.StartsWith($repo+'\tests\',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch ('^\.dispatch-auth-check-'+$id+'-dispatch-[a-z-]+\.test\.mjs$')){throw 'Unsafe test-copy cleanup'};if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Force}}
 $env:DISPATCH_BROWSER_CHANNEL=$previousChannel;$env:GIT_CONFIG_COUNT=$previousCount;$env:GIT_CONFIG_KEY_0=$previousKey;$env:GIT_CONFIG_VALUE_0=$previousValue
}
