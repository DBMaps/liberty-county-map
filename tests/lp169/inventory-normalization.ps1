param([Parameter(Mandatory=$true)][string]$CaptureScriptPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Tokens = $null
$ParseErrors = $null
$Ast = [System.Management.Automation.Language.Parser]::ParseFile($CaptureScriptPath, [ref]$Tokens, [ref]$ParseErrors)
if ($ParseErrors.Count -ne 0) { throw 'Capture script is not valid Windows PowerShell syntax.' }
$FunctionAst = $Ast.Find({ param($Node) $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq 'Get-NormalizedInventoryNames' }, $true)
if ($null -eq $FunctionAst) { throw 'Normalization helper was not found.' }
& ([scriptblock]::Create($FunctionAst.Extent.Text))

function Assert-Equal([string]$Expected, [string]$Actual, [string]$Label) {
  if ($Expected -cne $Actual) { throw "$Label assertion failed." }
}
function Assert-Rejected($InputObject, [string[]]$AllowedProperties, [string[]]$WrapperProperties, [string]$ForbiddenValue) {
  try {
    Get-NormalizedInventoryNames -SourceCommand 'test source command' -InputObject $InputObject -AllowedProperties $AllowedProperties -WrapperProperties $WrapperProperties | Out-Null
    throw 'Malformed inventory was accepted.'
  } catch {
    if ($_.Exception.Message -eq 'Malformed inventory was accepted.') { throw }
    if (-not $_.Exception.Message.Contains('test source command') -or -not $_.Exception.Message.Contains('observed properties only')) { throw 'Safe schema diagnostic was not emitted.' }
    if ($ForbiddenValue -and $_.Exception.Message.Contains($ForbiddenValue)) { throw 'A captured value escaped into a diagnostic.' }
  }
}

$GitHub = @([pscustomobject]@{ name = 'ZETA' }, [pscustomobject]@{ name = 'ALPHA' }, [pscustomobject]@{ name = 'ALPHA' })
Assert-Equal 'ALPHA,ZETA' ((Get-NormalizedInventoryNames -SourceCommand 'gh secret list' -InputObject $GitHub -AllowedProperties @('name')) -join ',') 'GitHub name array'
$Supabase = [pscustomobject]@{ secrets = @([pscustomobject]@{ name = 'SECOND' }, [pscustomobject]@{ name = 'FIRST' }) }
Assert-Equal 'FIRST,SECOND' ((Get-NormalizedInventoryNames -SourceCommand 'supabase secrets list' -InputObject $Supabase -AllowedProperties @('name') -WrapperProperties @('secrets')) -join ',') 'explicit Supabase wrapper'
Assert-Rejected ([pscustomobject]@{ secrets = @([pscustomobject]@{ name = 'VALUE' }) }) @('name') @() 'VALUE'
Assert-Rejected ([pscustomobject]@{ status = 'SECRET_VALUE' }) @('name') @() 'SECRET_VALUE'
Assert-Rejected 'SECRET_SCALAR' @('name') @() 'SECRET_SCALAR'
Assert-Rejected @([pscustomobject]@{ name = 'VALID' }, [pscustomobject]@{ status = 'SECRET_INVALID' }) @('name') @() 'SECRET_INVALID'
Assert-Rejected ([pscustomobject]@{ name = 'ONE'; slug = 'TWO' }) @('name','slug') @() 'ONE'

Write-Output 'inventory normalization regression tests passed'
