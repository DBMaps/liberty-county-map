# LP244.4 governed native provider configuration

## Authority and schema

`js/gridly.local.js` is the existing, gitignored local browser authority. Create it with
`tools/Setup-GridlyLocalDriveTexas.ps1`; add the owner's existing referrer-restricted
ArcGIS public-client key to its `GRIDLY_RUNTIME_CONFIG.arcgisStaticBasemapApiKey` field.
Do not invent, paste into a command line, or commit either value.

`tools/native-provider-config.mjs compose` reads that authority in an isolated JavaScript
context and atomically creates the gitignored `owner-local/native-provider-config.json`:

```json
{
  "arcgisStaticBasemapApiKey": "<nonblank existing public-client key>",
  "driveTexas": {
    "apiKey": "<nonblank existing DriveTexas key>"
  }
}
```

Those are the only permitted properties. Placeholders, blank values, extra properties,
invalid JSON, tracked output, and non-ignored output fail closed. Validation reports only
configured/not-configured status and never prints credential values.

DriveTexas/Official Roadways consumes the composed `driveTexas.apiKey`. Report submission
does **not** share that credential: it consumes the separately governed, tracked Supabase
public-client URL/key in `js/app.js`. The staged verifier proves both consumer contracts
and rejects service-role material without exposing either value.

## Windows/JDK 21 workflow

From the repository root in PowerShell:

```powershell
npm ci
powershell -ExecutionPolicy Bypass -File tools/Prepare-GridlyNative.ps1
npm run verify:native-web:configured
npm run verify:native-poi:android
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
if ((java -version 2>&1 | Out-String) -notmatch 'version "21\.') { throw "JDK 21 is required" }
.\android\gradlew.bat -p android clean :app:processDebugResources :app:assembleDebug
```

The wrapper verifies `js/gridly.local.js`, composes and validates the JSON without printing
values, runs `npm run prepare:native`, then proves staged Official Roadways and report
submission configuration. The remaining commands preserve the normal native closure flow.
