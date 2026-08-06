param([Parameter(Mandatory=$true)][string]$NormalizationHelperPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Resolve-Path $NormalizationHelperPath)

# Exercise diagnostic construction through the shared production normalizer.
$DiagnosticCaught = $null
try {
  Get-NormalizedInventoryNames `
    -SourceCommand 'diagnostic source' `
    -JsonText '' `
    -AllowedProperties @('name') `
    -AllowEmpty | Out-Null
} catch {
  $DiagnosticCaught = $_
}
if ($null -eq $DiagnosticCaught) { throw 'Shared-helper diagnostic construction did not terminate.' }
$DiagnosticMessage = $DiagnosticCaught.Exception.Message
if (-not $DiagnosticCaught.FullyQualifiedErrorId.StartsWith('LP169InventoryBlankOutput')) { throw 'Shared-helper diagnostic lost its governed identifier.' }
if ($DiagnosticCaught.Exception.GetType().FullName -cne 'System.ArgumentException') { throw 'Shared-helper diagnostic did not preserve System.ArgumentException.' }
if ($DiagnosticCaught.Exception.GetType().Name -eq 'CommandNotFoundException') { throw 'Shared-helper diagnostic escaped as CommandNotFoundException.' }
if (-not $DiagnosticMessage.Contains('diagnostic source')) { throw 'Shared-helper diagnostic omitted the safe source-command label.' }
if (-not $DiagnosticMessage.Contains('expected record properties: [name]')) { throw 'Shared-helper diagnostic omitted the expected schema.' }
if (-not $DiagnosticMessage.Contains('observed properties only: []')) { throw 'Shared-helper diagnostic omitted the observed property names.' }
foreach ($ForbiddenDiagnosticValue in @('SECRET_DIAGNOSTIC_VALUE', 'CAPTURED_DIAGNOSTIC_VALUE')) {
  if ($DiagnosticMessage.Contains($ForbiddenDiagnosticValue)) { throw 'A captured value escaped into the shared-helper diagnostic.' }
}

function Assert-StableResult([string]$JsonText, [int]$ExpectedCount, [string]$ExpectedNames, [switch]$AllowEmpty) {
  [object[]]$Actual = Get-NormalizedInventoryNames -SourceCommand 'stable result' -JsonText $JsonText -AllowedProperties @('name') -AllowEmpty:$AllowEmpty
  if ($Actual.GetType() -ne [object[]]) { throw 'Valid result was not an explicit Object[].' }
  if ($Actual.Count -ne $ExpectedCount) { throw 'Stable result count assertion failed.' }
  if (($Actual -join ',') -cne $ExpectedNames) { throw 'Stable result value assertion failed.' }
}

function Assert-Rejected([string]$Case, [AllowNull()][AllowEmptyString()][string]$JsonText, [string[]]$AllowedProperties, [string[]]$WrapperProperties, [string]$ExpectedErrorId, [string[]]$ExpectedObservedProperties, [string[]]$ForbiddenValues, [switch]$AllowEmpty) {
  $Caught = $null
  try {
    Get-NormalizedInventoryNames -SourceCommand 'test source command' -JsonText $JsonText -AllowedProperties $AllowedProperties -WrapperProperties $WrapperProperties -AllowEmpty:$AllowEmpty | Out-Null
  } catch {
    $Caught = $_
  }
  if ($null -eq $Caught) { throw "$Case`: malformed inventory was accepted." }
  $Message = $Caught.Exception.Message
  if (-not $Caught.FullyQualifiedErrorId.StartsWith($ExpectedErrorId)) { throw "$Case`: expected governed error identifier $ExpectedErrorId but received $($Caught.FullyQualifiedErrorId)." }
  if ($Caught.Exception.GetType().FullName -cne 'System.ArgumentException') { throw "$Case`: governed rejection did not preserve System.ArgumentException." }
  if ($Caught.Exception.GetType().Name -eq 'CommandNotFoundException') { throw "$Case`: invalid constructor syntax escaped as CommandNotFoundException." }
  if ($Caught.Exception.GetType().Name -eq 'PropertyNotFoundException') { throw "$Case`: PropertyNotFoundStrict escaped the normalizer." }
  if (-not $Message.Contains('test source command')) { throw "$Case`: source command label was absent from the diagnostic." }
  if (-not $Message.Contains("expected record properties: [$($AllowedProperties -join ',')]")) { throw "$Case`: expected schema was absent from the diagnostic." }
  $ExpectedObserved = "observed properties only: [$($ExpectedObservedProperties -join ',')]"
  if (-not $Message.Contains($ExpectedObserved)) { throw "$Case`: observed schema was absent from the diagnostic." }
  foreach ($ForbiddenValue in @($ForbiddenValues)) {
    if ($ForbiddenValue -and $Message.Contains($ForbiddenValue)) { throw "$Case`: a captured value escaped into a diagnostic." }
  }
}

# Complete PS 5.1 strict-mode response/return-cardinality matrix.
Assert-Rejected 'blank text' '' @('name') @() 'LP169InventoryBlankOutput' @() @() -AllowEmpty
Assert-Rejected 'whitespace' " `t`r`n" @('name') @() 'LP169InventoryBlankOutput' @() @() -AllowEmpty
Assert-Rejected 'JSON null' 'null' @('name') @() 'LP169InventoryNullOutput' @() @()
Assert-StableResult '[]' 0 '' -AllowEmpty                               # 4 empty array / 14 zero result
Assert-Rejected 'rejected empty array' '[]' @('name') @() 'LP169InventoryEmptyNotAllowed' @() @()
Assert-Rejected 'empty object record' '[{}]' @('name') @() 'LP169InventorySchemaMismatch' @() @() -AllowEmpty
Assert-StableResult '[{"name":"ONLY"}]' 1 'ONLY'                       # 6 / 13 one result
Assert-StableResult '[{"name":"ZETA"},{"name":"ALPHA"},{"name":"ALPHA"}]' 2 'ALPHA,ZETA' # 7 / 15 many, sorted/deduped
Assert-Rejected 'string scalar' '"SECRET_SCALAR"' @('name') @() 'LP169InventoryScalarRoot' @() @('SECRET_SCALAR')
Assert-Rejected 'numeric scalar' '42' @('name') @() 'LP169InventoryScalarRoot' @() @('42')
Assert-Rejected 'unsupported wrapper' '{"status":"SECRET_VALUE"}' @('name') @() 'LP169InventorySchemaMismatch' @('status') @('SECRET_VALUE')
Assert-Rejected 'mixed valid and invalid array' '[{"name":"VALID"},{"status":"SECRET_INVALID"}]' @('name') @() 'LP169InventorySchemaMismatch' @('status') @('VALID','SECRET_INVALID')
Assert-Rejected 'conflicting properties' '[{"name":"ONE","slug":"TWO"}]' @('name','slug') @() 'LP169InventoryAmbiguousProperty' @('name','slug') @('ONE','TWO')
Assert-Rejected 'malformed JSON' '{not-json}' @('name') @() 'LP169InventoryMalformedJson' @() @('not-json')

# Explicitly supported wrappers must themselves contain JSON arrays.
[object[]]$Wrapped = Get-NormalizedInventoryNames -SourceCommand 'wrapper result' -JsonText '{"secrets":[{"name":"SECOND"},{"name":"FIRST"}]}' -AllowedProperties @('name') -WrapperProperties @('secrets')
if ($Wrapped.GetType() -ne [object[]] -or $Wrapped.Count -ne 2 -or ($Wrapped -join ',') -cne 'FIRST,SECOND') { throw 'Supported wrapper array assertion failed.' }
Assert-Rejected 'null wrapper array' '{"secrets":null}' @('name') @('secrets') 'LP169InventorySchemaMismatch' @('secrets') @() -AllowEmpty
Assert-Rejected 'object wrapper array' '{"secrets":{"name":"VALUE"}}' @('name') @('secrets') 'LP169InventorySchemaMismatch' @('secrets') @('VALUE')

Write-Output 'inventory normalization regression tests passed'
