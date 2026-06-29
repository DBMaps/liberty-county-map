# V791 — Production Package Absolute Path Fix Certification

## Summary

V791 fixes production package source path resolution in `Build-GridlyProductionPackages.ps1` so package manifests that contain absolute Windows paths are not prefixed with the repository root.

## Root cause

V790 resolved every manifest `packageFile` with `Join-Path` against the current repository path. That preserved relative package manifests, but it incorrectly transformed Windows absolute paths such as `C:\GitHub\Gridly-Source-Data\Crossing-Packages\harris\harris-crossings.geojson` into a repo-prefixed invalid path.

## Files added or modified

- Modified `tools/ProductionPackages/Build-GridlyProductionPackages.ps1`.
- Added `docs/certifications/V791-PRODUCTION-PACKAGE-ABSOLUTE-PATH-FIX.md`.
- Added `docs/certifications/evidence/V791-production-package-absolute-path-fix.json`.

## Tool behavior

The production package manufacturing command now detects rooted platform paths, Windows drive-letter absolute paths, and Windows UNC absolute paths before resolving manifest paths. Relative manifest paths continue to resolve under the repository root. Existing missing-file checks remain in place, so truly missing source packages still block safely.

## Safety rules

V791 is tooling-only. It does not change runtime enablement, search behavior, awareness behavior, consumer behavior, source package contents, community package contents, or production output skip behavior.

## Harris WhatIf result

PowerShell is not installed in the execution container, so the Harris `-WhatIf` command is documented as environment-blocked. Static verification confirms the Harris source path is now preserved as the manifest's absolute Windows path instead of being prefixed with the repository root.

## All Counties WhatIf result

PowerShell is not installed in the execution container, so the all-counties `-WhatIf` command is documented as environment-blocked. Static verification confirms relative package paths still resolve under the repository root while absolute paths remain unprefixed.

## Protected-system verification

The following protected systems remain unchanged:

- Shared Reports
- Route Watch
- Awareness Filtering
- Hazard Lifecycle
- Alert Generation
- Supabase Synchronization
- Runtime county registration
- Search configuration
- Awareness configuration
- Consumer crossing behavior

## Testing results

PowerShell command execution is blocked because the execution container does not provide a `powershell` or `pwsh` executable. JSON evidence validation passed with `python3 -m json.tool`.

## Release decision

PASS, pending execution of the documented PowerShell commands in a Windows or PowerShell-enabled environment.
