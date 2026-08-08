param([ValidateSet('Execute','Withdraw')][string]$Mode='Execute')
$ErrorActionPreference='Stop'; Set-StrictMode -Version 2
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$evidence=Join-Path $repo 'evidence\lp1837'; $raw=Join-Path $evidence 'raw'; New-Item -Force -ItemType Directory $raw|Out-Null
$guard=Join-Path $evidence '.upload-attempted.local'
$secret='(?i)(CLOUDFLARE_API_TOKEN\s*[=:]\s*\S+|authorization\s*:|cookie\s*:|bearer\s+\S+|access[_-]?token|refresh[_-]?token|session[_-]?token|api[_-]?key|otp\s*[=:])'
function Assert-Safe([string]$Text){if($Text -match $secret){throw 'Secret-shaped output rejected.'}}
function Run([string[]]$WranglerArgs){$text=(& npx --yes wrangler @WranglerArgs 2>&1|Out-String); if($LASTEXITCODE -ne 0){throw "Wrangler failed: $($WranglerArgs -join ' ')"}; Assert-Safe $text; return $text.Trim()}
function Ask([string]$Prompt,[string]$Exact){if((Read-Host $Prompt)-cne $Exact){throw "STOP: exact confirmation '$Exact' was not supplied."}}
if(-not $env:CLOUDFLARE_API_TOKEN){throw 'Create a temporary least-privilege token outside the repository and set CLOUDFLARE_API_TOKEN only in this process.'}
try {
  Ask 'Type exact LP183.7 execution authorization' 'AUTHORIZE_ONE_PROTECTED_PREVIEW_EXECUTION'
  if($Mode -eq 'Withdraw'){
    Ask 'Type WITHDRAW_PREVIEW_GRIDLYGO_COM to remove only the preview DNS/custom-domain publication' 'WITHDRAW_PREVIEW_GRIDLYGO_COM'
    Write-Host 'Use the authenticated Pages Custom domains workflow to remove ONLY preview.gridlygo.com, then remove ONLY its Pages-associated DNS record. Do not delete gridly-preview.'
    exit 0
  }
  if(Test-Path $guard){throw 'An LP183.7 upload was already attempted. Never retry automatically; inspect platform state.'}
  Push-Location $repo
  try {
    $commit=(git rev-parse HEAD).Trim(); if($LASTEXITCODE -ne 0){throw 'Cannot resolve repository commit.'}
    npm run build:lp1833; if($LASTEXITCODE){throw 'LP183.3 build failed'}
    npm run test:lp1833; if($LASTEXITCODE){throw 'LP183.3 tests failed'}
    npm run verify:lp1833; if($LASTEXITCODE){throw 'LP183.3 verify failed'}
    npm run test:lp1831; if($LASTEXITCODE){throw 'LP183.1 tests failed'}
    npm run verify:lp1831; if($LASTEXITCODE){throw 'LP183.1 verify failed'}
    npm run stage:lp1831; if($LASTEXITCODE){throw 'LP183.1 stage failed'}
    $manifest=Get-Content reports/lp1831/deployable-artifact-manifest.json -Raw|ConvertFrom-Json
    if($manifest.artifactIdentity -cne 'sha256:c292ce65fd06f5f3265be988fa3fa8d152dbb0309aaf306e799646dd34b56a7f' -or $manifest.fileCount -ne 493 -or $manifest.totalBytes -ne 155746432){throw 'Authorized artifact identity/facts differ.'}
    $who=Run @('whoami'); $version=Run @('--version'); $projects=Run @('pages','project','list'); $deployments=Run @('pages','deployment','list','--project-name','gridly-preview','--json')
    [IO.File]::WriteAllText((Join-Path $raw 'preflight.txt'),"wrangler=$version`nproject=gridly-preview`n",(New-Object Text.UTF8Encoding($false)))
    Write-Host 'Inspect authenticated dashboard now: exact account; Direct Upload; Git integration false; production branch preview; deployments 0; custom domains 0; Access application/policy unchanged.'
    Ask 'Type VERIFIED_EMPTY_PROJECT_AND_ACCESS_BASELINE only after every dashboard check passes' 'VERIFIED_EMPTY_PROJECT_AND_ACCESS_BASELINE'
    [IO.File]::WriteAllText($guard,"upload attempt reserved for $commit`n",(New-Object Text.UTF8Encoding($false)))
    $upload=Run @('pages','deploy','.artifacts/lp1831/cloudflare-pages','--project-name','gridly-preview','--branch','preview','--commit-hash',$commit,'--commit-dirty=true')
    [IO.File]::WriteAllText((Join-Path $raw 'upload-output.txt'),$upload+"`n",(New-Object Text.UTF8Encoding($false)))
    $after=Run @('pages','deployment','list','--project-name','gridly-preview','--json')
    [IO.File]::WriteAllText((Join-Path $raw 'deployments-after.json'),$after+"`n",(New-Object Text.UTF8Encoding($false)))
    Write-Host 'STOP FOR OWNER REVIEW: prove exactly one deployment, copy its safe ID/URL/branch into owner-execution-evidence.local.json, and run build/test/verify:lp1837.'
    Ask 'Only after deployment/artifact reconciliation, type exact binding authorization' 'AUTHORIZE_PREVIEW_GRIDLYGO_COM_BINDING'
    Write-Host 'In Workers & Pages > gridly-preview > Custom domains, add ONLY preview.gridlygo.com. Do not create a standalone CNAME or edit Access.'
    Ask 'After certificate/hostname activation and preserved Access are visible, type VERIFIED_PREVIEW_BINDING_AND_ACCESS' 'VERIFIED_PREVIEW_BINDING_AND_ACCESS'
    Write-Host 'Manually perform approved-user ALLOW, incognito anonymous DENY, non-approved authenticated DENY, physical-device, and production-isolation tests. Never record OTPs/cookies. Ingest only the safe local JSON summary.'
  } finally {Pop-Location}
} finally {
  Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
  if(Test-Path Env:CLOUDFLARE_API_TOKEN){throw 'Temporary token environment removal failed.'}
  Write-Host 'CLOUDFLARE_API_TOKEN removed. Revoke the temporary token in Cloudflare, then record only revocation status.'
}
