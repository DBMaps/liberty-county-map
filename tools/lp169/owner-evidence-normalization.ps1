function Stop-InventoryNormalization {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$true)]
    [string]$ErrorId,

    [Parameter(Mandatory=$true)]
    [string]$Message,

    [Parameter(Mandatory=$true)]
    [string]$TargetObject
  )

  # ThrowTerminatingError preserves ErrorRecord.FullyQualifiedErrorId on
  # Windows PowerShell 5.1; throwing a string makes that field prose-derived.
  [System.ArgumentException]$Exception =
    [System.ArgumentException]::new($Message)

  [System.Management.Automation.ErrorRecord]$ErrorRecord =
    [System.Management.Automation.ErrorRecord]::new(
    $Exception,
    $ErrorId,
    [System.Management.Automation.ErrorCategory]::InvalidData,
    $TargetObject
  )

  $PSCmdlet.ThrowTerminatingError($ErrorRecord)
}

function Get-NormalizedInventoryNames {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$true)][string]$SourceCommand,
    [Parameter(Mandatory=$true)][AllowNull()][AllowEmptyString()][string]$JsonText,
    [Parameter(Mandatory=$true)][string[]]$AllowedProperties,
    [string[]]$WrapperProperties = @(),
    [switch]$AllowEmpty
  )

  # Do not let PowerShell's convenient scalar/property coercions turn a CLI
  # error, status object, or wrapper into inventory evidence. Diagnostics name
  # schemas only; captured values are never included.
  if ([string]::IsNullOrWhiteSpace($JsonText)) {
    Stop-InventoryNormalization `
      -ErrorId 'LP169InventoryBlankOutput' `
      -Message "$SourceCommand SOURCE_UNAVAILABLE; command returned no JSON; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
      -TargetObject $SourceCommand
  }
  try {
    $Parsed = ConvertFrom-Json -InputObject $JsonText
  } catch {
    Stop-InventoryNormalization `
      -ErrorId 'LP169InventoryMalformedJson' `
      -Message "$SourceCommand CAPTURE_FAILED; command returned invalid JSON; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
      -TargetObject $SourceCommand
  }
  if ($null -eq $Parsed -and $JsonText -notmatch '^\s*\[\s*\]\s*$') {
    Stop-InventoryNormalization `
      -ErrorId 'LP169InventoryNullOutput' `
      -Message "$SourceCommand SOURCE_UNAVAILABLE; command returned null JSON; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
      -TargetObject $SourceCommand
  }
  # Inspect the JSON root before normalization. Windows PowerShell 5.1
  # enumerates JSON arrays at the pipeline boundary: [], [x], and [x,y] can
  # otherwise become null, a scalar, and an array respectively.
  $IsArrayRoot = $JsonText -match '^\s*\['
  $IsObjectRoot = $JsonText -match '^\s*\{'
  if (-not $IsArrayRoot -and -not $IsObjectRoot) {
    Stop-InventoryNormalization `
      -ErrorId 'LP169InventoryScalarRoot' `
      -Message "$SourceCommand returned a scalar JSON root; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
      -TargetObject $SourceCommand
  }

  [object[]]$Records = @()
  if ($IsArrayRoot) {
    # The empty-array spelling must be recognized from raw text because PS 5.1
    # gives ConvertFrom-Json no output object for it.
    if ($JsonText -notmatch '^\s*\[\s*\]\s*$') { $Records = @($Parsed) }
  } else {
    $WrapperMatches = @($WrapperProperties | Where-Object { $null -ne $Parsed.PSObject.Properties[$_] })
    if ($WrapperMatches.Count -gt 1) {
      $Observed = @($Parsed.PSObject.Properties | ForEach-Object { $_.Name } | Sort-Object -Unique) -join ','
      Stop-InventoryNormalization `
        -ErrorId 'LP169InventoryAmbiguousProperty' `
        -Message "$SourceCommand returned an ambiguous wrapper; expected wrapper properties: [$($WrapperProperties -join ',')]; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: [$Observed]." `
        -TargetObject $SourceCommand
    }
    if ($WrapperMatches.Count -eq 0) {
      $Observed = @($Parsed.PSObject.Properties | ForEach-Object { $_.Name } | Sort-Object -Unique) -join ','
      Stop-InventoryNormalization `
        -ErrorId 'LP169InventorySchemaMismatch' `
        -Message "$SourceCommand returned an unsupported wrapper; expected wrapper properties: [$($WrapperProperties -join ',')]; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: [$Observed]." `
        -TargetObject $SourceCommand
    }
    $WrappedRecords = $Parsed.PSObject.Properties[$WrapperMatches[0]].Value
    if ($null -eq $WrappedRecords -or -not ($WrappedRecords -is [System.Array])) {
      Stop-InventoryNormalization `
        -ErrorId 'LP169InventorySchemaMismatch' `
        -Message "$SourceCommand returned an invalid wrapper inventory; expected wrapper properties: [$($WrapperProperties -join ',')]; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: [$($WrapperMatches -join ',')]." `
        -TargetObject $SourceCommand
    }
    $Records = @($WrappedRecords)
  }
  if ($Records.Count -eq 0) {
    if ($AllowEmpty) { return ,([object[]]@()) }
    Stop-InventoryNormalization `
      -ErrorId 'LP169InventoryEmptyNotAllowed' `
      -Message "$SourceCommand returned an empty inventory; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
      -TargetObject $SourceCommand
  }

  $Names = @()
  foreach ($Record in $Records) {
    if ($null -eq $Record -or $Record -is [string] -or $Record.GetType().IsPrimitive) {
      Stop-InventoryNormalization `
        -ErrorId 'LP169InventorySchemaMismatch' `
        -Message "$SourceCommand returned a scalar inventory record; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
        -TargetObject $SourceCommand
    }
    $ObservedProperties = @($Record.PSObject.Properties | ForEach-Object { $_.Name } | Sort-Object -Unique)
    $Supported = @($AllowedProperties | Where-Object { $null -ne $Record.PSObject.Properties[$_] })
    if ($Supported.Count -ne 1) {
      $Reason = if ($Supported.Count -eq 0) { 'unsupported' } else { 'ambiguous' }
      $Identifier = if ($Reason -eq 'ambiguous') { 'LP169InventoryAmbiguousProperty' } else { 'LP169InventorySchemaMismatch' }
      Stop-InventoryNormalization `
        -ErrorId $Identifier `
        -Message "$SourceCommand returned an $Reason inventory record; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: [$($ObservedProperties -join ',')]." `
        -TargetObject $SourceCommand
    }
    $Value = $Record.PSObject.Properties[$Supported[0]].Value
    if ($null -eq $Value -or -not ($Value -is [string]) -or [string]::IsNullOrWhiteSpace($Value)) {
      Stop-InventoryNormalization `
        -ErrorId 'LP169InventorySchemaMismatch' `
        -Message "$SourceCommand returned an invalid inventory name; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: [$($ObservedProperties -join ',')]." `
        -TargetObject $SourceCommand
    }
    $Names += $Value.Trim()
  }
  [object[]]$NormalizedNames = @($Names | Sort-Object -Unique)
  # Unary comma prevents PowerShell's return pipeline from unrolling zero, one,
  # or many names. Callers therefore receive an Object[] in every valid case.
  return ,$NormalizedNames
}
