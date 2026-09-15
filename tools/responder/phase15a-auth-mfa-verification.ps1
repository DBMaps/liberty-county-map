[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('Preflight','CreateTestUser','InspectAal1','EnrollTotp','VerifyTotp','InspectCorrelation','SimulateCutoff','RevokeSession','InspectRevocation','RemoveFactor','InspectReset','RecoverUnverifiedTotpFactor','Cleanup')]
  [string]$Mode,

  [ValidatePattern('^[a-z0-9]{20}$')]
  [string]$ProjectRef = 'nhwhkbkludzkuyxmkkcj',

  [ValidatePattern('^$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$')]
  [string]$TestUserId = '',

  [ValidatePattern('^$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$')]
  [string]$SessionId = '',

  [ValidatePattern('^$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$')]
  [string]$FactorId = '',

  [long]$ObservedOldIssuedAt = 0,
  [long]$CandidateNewIssuedAt = 0,
  [switch]$AuthorizeProductionMutation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedProjectRef = 'nhwhkbkludzkuyxmkkcj'
$ExpectedBranch = 'RESPONDER-PHASE15A-controlled-production-auth-mfa-verification'
$ExpectedWorktree = 'C:\GitHub\liberty-county-map\.artifacts\worktrees\RESPONDER-PHASE0-v1-contract-freeze'
$TestLabel = 'Gridly Responder Auth Verification Test'
$MutatingModes = @('CreateTestUser','InspectAal1','EnrollTotp','VerifyTotp','RevokeSession','RemoveFactor','RecoverUnverifiedTotpFactor','Cleanup')
$TemporarySecrets = New-Object System.Collections.Generic.List[string]

function Get-ProcessEnvironment([string]$Name) {
  return [Environment]::GetEnvironmentVariable($Name, [EnvironmentVariableTarget]::Process)
}

function Set-TemporarySecret([string]$Name, [string]$Prompt) {
  if (Get-ProcessEnvironment $Name) { return }
  $Secure = Read-Host $Prompt -AsSecureString
  $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {
    $Plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
    if (-not $Plain) { throw "$Name may not be empty." }
    [Environment]::SetEnvironmentVariable($Name, $Plain, [EnvironmentVariableTarget]::Process)
    $TemporarySecrets.Add($Name) | Out-Null
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
    $Plain = $null
  }
}

function Require-Environment([string]$Name) {
  if (-not (Get-ProcessEnvironment $Name)) { throw "Required environment variable $Name is not set." }
}

function Require-TestEmail {
  Require-Environment 'GRIDLY_RESPONDER_TEST_EMAIL'
  $Email = Get-ProcessEnvironment 'GRIDLY_RESPONDER_TEST_EMAIL'
  if ($Email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'GRIDLY_RESPONDER_TEST_EMAIL is not a valid explicit email address.' }
}

function Require-TestUserId {
  if (-not $TestUserId) { throw '-TestUserId with the one dedicated test UUID is required.' }
  [Environment]::SetEnvironmentVariable('GRIDLY_RESPONDER_TEST_USER_ID', $TestUserId.ToLowerInvariant(), [EnvironmentVariableTarget]::Process)
}

function Require-FactorId {
  if (-not $FactorId) { throw '-FactorId with the one dedicated TOTP factor UUID is required.' }
  [Environment]::SetEnvironmentVariable('GRIDLY_RESPONDER_FACTOR_ID', $FactorId.ToLowerInvariant(), [EnvironmentVariableTarget]::Process)
}

function Require-OperatorPassword {
  Set-TemporarySecret 'GRIDLY_RESPONDER_TEST_PASSWORD' 'Temporary test-user password (not displayed)'
}

function Require-TotpCode {
  Set-TemporarySecret 'GRIDLY_RESPONDER_TOTP_CODE' 'Current authenticator TOTP code (not displayed)'
}

function Require-PublishableKey {
  Set-TemporarySecret 'GRIDLY_SUPABASE_PUBLISHABLE_KEY' 'Production Supabase publishable/anon key (not displayed)'
}

function Require-AdminKey {
  if (-not (Get-ProcessEnvironment 'GRIDLY_SUPABASE_SECRET_KEY') -and -not (Get-ProcessEnvironment 'GRIDLY_SUPABASE_SERVICE_ROLE_KEY')) {
    Set-TemporarySecret 'GRIDLY_SUPABASE_SECRET_KEY' 'Production Supabase secret/service-role key (not displayed)'
  }
}

function Require-PsqlEnvironment {
  foreach ($Name in @('PGHOST','PGUSER','PGDATABASE','PGSSLMODE')) { Require-Environment $Name }
  Set-TemporarySecret 'PGPASSWORD' 'Production database password (not displayed)'
}

function Invoke-SafeNode([string]$Action, [string[]]$Arguments = @()) {
  $Helper = Join-Path $PSScriptRoot 'phase15a-auth-mfa-helper.mjs'
  $Output = & node $Helper $Action @Arguments 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    Write-Error ($Output.Trim())
    throw "Phase 15A helper mode $Action failed; no secret-bearing response body was displayed."
  }
  Write-Host $Output.Trim()
  return $Output | ConvertFrom-Json
}

function Invoke-SafePsql([string]$SqlPath, [hashtable]$Variables) {
  Require-PsqlEnvironment
  $Arguments = @('-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1')
  foreach ($Name in ($Variables.Keys | Sort-Object)) {
    $Arguments += @('-v',("{0}={1}" -f $Name,$Variables[$Name]))
  }
  $Sql = Get-Content -Raw -LiteralPath $SqlPath
  $Output = $Sql | & psql @Arguments 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw 'Bounded read-only psql verification failed; raw output was suppressed.' }
  $Line = ($Output -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 1).Trim()
  Write-Host $Line
  return $Line | ConvertFrom-Json
}

try {
  $Root = (& git rev-parse --show-toplevel 2>$null | Out-String).Trim()
  if ([IO.Path]::GetFullPath($Root).TrimEnd('\') -ne [IO.Path]::GetFullPath($ExpectedWorktree).TrimEnd('\')) {
    throw 'Refusing to operate outside the dedicated Phase 15A responder worktree.'
  }
  $Branch = (& git branch --show-current 2>$null | Out-String).Trim()
  if ($Branch -ne $ExpectedBranch) { throw "Refusing branch '$Branch'; expected '$ExpectedBranch'." }
  if ($ProjectRef -ne $ExpectedProjectRef) { throw 'Refusing unexpected production project identity.' }
  if ($MutatingModes -contains $Mode -and -not $AuthorizeProductionMutation) {
    throw "OWNER EXECUTION REQUIRED: mode $Mode refuses to run without -AuthorizeProductionMutation."
  }
  if ((& git status --short 2>$null | Out-String).Trim()) { throw 'Refusing a dirty responder worktree. Do not clean, reset, or stash; review it.' }

  [Environment]::SetEnvironmentVariable('GRIDLY_SUPABASE_PROJECT_REF', $ProjectRef, [EnvironmentVariableTarget]::Process)
  $ExpectedUrl = "https://$ProjectRef.supabase.co"
  if (-not (Get-ProcessEnvironment 'GRIDLY_SUPABASE_URL')) {
    [Environment]::SetEnvironmentVariable('GRIDLY_SUPABASE_URL', $ExpectedUrl, [EnvironmentVariableTarget]::Process)
  }
  if ((Get-ProcessEnvironment 'GRIDLY_SUPABASE_URL').TrimEnd('/') -ne $ExpectedUrl) {
    throw 'Refusing GRIDLY_SUPABASE_URL because it does not match the frozen production project reference.'
  }

  switch ($Mode) {
    'Preflight' {
      Require-TestEmail
      Require-PublishableKey
      Require-AdminKey
      Require-PsqlEnvironment
      if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
      if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { throw 'psql is required.' }
      $SupabaseCli = if (Get-Command supabase -ErrorAction SilentlyContinue) { 'available_not_used' } else { 'not_installed_not_required' }
      Write-Output (ConvertTo-Json ([ordered]@{
        mode='PreflightTools'; node=(& node --version); psql=(& psql --version); supabase_cli=$SupabaseCli;
        worktree=$ExpectedWorktree; branch=$ExpectedBranch; project_ref=$ExpectedProjectRef; secrets_displayed=$false
      }) -Compress)
      Invoke-SafeNode 'preflight' | Out-Null
      $Preflight = Invoke-SafePsql (Join-Path $PSScriptRoot 'phase15a-preflight.sql') @{
        project_ref=$ProjectRef; test_email=(Get-ProcessEnvironment 'GRIDLY_RESPONDER_TEST_EMAIL')
      }
      if ($Preflight.transaction_read_only -ne 'on' -or -not $Preflight.project_ref_matches -or $Preflight.reporting_enabled -or
          $Preflight.agency_private_present -or $Preflight.responder_public_present -or $Preflight.agency_publishing_object_count -ne 0) {
        throw 'PREFLIGHT_STOP: production identity, read-only state, reporting gate, or responder-schema invariant failed.'
      }
      if ($Preflight.test_email_match_count -eq 0 -and $Preflight.marked_test_user_count -eq 0 -and $Preflight.auth_counts.users -eq 0) {
        Write-Output 'PREFLIGHT_PASS_NEW_USER_ALLOWED_AFTER_OWNER_REVIEW'
      } elseif ($Preflight.test_email_match_count -eq 1 -and $Preflight.marked_test_user_count -eq 1 -and $Preflight.auth_counts.users -eq 1) {
        Write-Output 'PREFLIGHT_RECOVERY_REQUIRED_DO_NOT_CREATE_DUPLICATE'
      } else {
        throw 'PREFLIGHT_STOP: Auth population differs from the Phase 15 baseline or the supplied email conflicts with another identity.'
      }
    }
    'CreateTestUser' {
      Require-TestEmail; Require-PublishableKey; Require-AdminKey; Require-OperatorPassword
      Invoke-SafeNode 'create-test-user' | Out-Null
    }
    'InspectAal1' {
      Require-TestEmail; Require-TestUserId; Require-PublishableKey; Require-OperatorPassword
      Invoke-SafeNode 'inspect-aal1' | Out-Null
    }
    'EnrollTotp' {
      Require-TestEmail; Require-TestUserId; Require-PublishableKey; Require-OperatorPassword
      $QrPath = Join-Path ([IO.Path]::GetTempPath()) ("gridly-phase15a-totp-{0}.html" -f [Guid]::NewGuid().ToString('N'))
      [Environment]::SetEnvironmentVariable('GRIDLY_RESPONDER_QR_PATH', $QrPath, [EnvironmentVariableTarget]::Process)
      try {
        Invoke-SafeNode 'enroll-totp' | Out-Null
        Start-Process -FilePath $QrPath
        Read-Host 'Scan the temporary QR, close its browser tab, then press Enter here' | Out-Null
      } finally {
        if (Test-Path -LiteralPath $QrPath) { Remove-Item -LiteralPath $QrPath -Force }
        [Environment]::SetEnvironmentVariable('GRIDLY_RESPONDER_QR_PATH', $null, [EnvironmentVariableTarget]::Process)
      }
      Write-Output 'TEMPORARY_TOTP_QR_DELETED'
    }
    'VerifyTotp' {
      Require-TestEmail; Require-TestUserId; Require-FactorId; Require-PublishableKey; Require-OperatorPassword; Require-TotpCode
      Invoke-SafeNode 'verify-totp' | Out-Null
    }
    { $_ -in @('InspectCorrelation','InspectRevocation','InspectReset') } {
      Require-TestUserId
      Invoke-SafePsql (Join-Path $PSScriptRoot 'phase15a-auth-evidence.sql') @{
        test_user_id=$TestUserId; session_id=$SessionId
      } | Out-Null
    }
    'SimulateCutoff' {
      if ($ObservedOldIssuedAt -lt 1) { throw '-ObservedOldIssuedAt must be copied from the safe JWT evidence.' }
      $Arguments = @($ObservedOldIssuedAt.ToString([Globalization.CultureInfo]::InvariantCulture))
      if ($CandidateNewIssuedAt -gt 0) { $Arguments += $CandidateNewIssuedAt.ToString([Globalization.CultureInfo]::InvariantCulture) }
      Invoke-SafeNode 'simulate-cutoff' $Arguments | Out-Null
    }
    'RevokeSession' {
      Require-TestEmail; Require-TestUserId; Require-FactorId; Require-PublishableKey; Require-OperatorPassword; Require-TotpCode
      Invoke-SafeNode 'revoke-session' | Out-Null
    }
    'RemoveFactor' {
      Require-TestEmail; Require-TestUserId; Require-FactorId; Require-PublishableKey; Require-OperatorPassword; Require-TotpCode
      Invoke-SafeNode 'remove-factor' | Out-Null
    }
    'RecoverUnverifiedTotpFactor' {
      Require-TestUserId; Require-FactorId; Require-AdminKey
      Invoke-SafeNode 'recover-unverified-totp-factor' | Out-Null
    }
    'Cleanup' {
      Require-TestEmail; Require-TestUserId; Require-PublishableKey; Require-AdminKey; Require-OperatorPassword
      Invoke-SafeNode 'cleanup' | Out-Null
      Invoke-SafePsql (Join-Path $PSScriptRoot 'phase15a-auth-evidence.sql') @{
        test_user_id=$TestUserId; session_id=''
      } | Out-Null
    }
  }
} finally {
  foreach ($Name in $TemporarySecrets) {
    [Environment]::SetEnvironmentVariable($Name, $null, [EnvironmentVariableTarget]::Process)
  }
  foreach ($Name in @('GRIDLY_RESPONDER_TEST_USER_ID','GRIDLY_RESPONDER_FACTOR_ID','GRIDLY_RESPONDER_TOTP_CODE')) {
    [Environment]::SetEnvironmentVariable($Name, $null, [EnvironmentVariableTarget]::Process)
  }
}
