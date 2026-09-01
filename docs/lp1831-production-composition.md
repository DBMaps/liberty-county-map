# LP183.1 governed production composition

The production composition command is release tooling only. It binds the upload
artifact to candidate `65be671a899c749426f54be92e8ae000a24ef389`, records the canonical
production origin `https://gridlygo.com`, and records the separately governed
preview origin `https://preview.gridlygo.com`. ArcGIS referrer configuration
must authorize the exact intended origin; wildcard referrers are not approved.

Create an ignored or repository-external JSON file containing exactly these
public-browser configuration properties (replace placeholders locally):

```json
{
  "arcgisStaticBasemapApiKey": "<ARCGIS_PUBLIC_BROWSER_KEY>",
  "driveTexas": {
    "apiKey": "<DRIVETEXAS_PUBLIC_BROWSER_KEY>"
  }
}
```

No other overlay property is accepted. The tool starts from the complete
tracked `GRIDLY_RUNTIME_CONFIG`, changes only `arcgisStaticBasemapApiKey`, and
emits DriveTexas through its existing separate `GRIDLY_CONFIG.driveTexas.apiKey`
contract. Its `GRIDLY_CONFIG.txdot.apiKey` and `GRIDLY_TXDOT_API_KEY` fallbacks
remain unchanged. The owner input is never copied into the upload directory.

Run:

```text
npm run stage:lp1831:production -- --runtime-config-file <OWNER_LOCAL_JSON>
npm run verify:lp1831:production
```

The stage command writes the upload bytes to
`.artifacts/lp1831/cloudflare-pages` and a redacted manifest to
`.artifacts/lp1831/production-release-report.json`. The report contains property
status only, never configuration values. Its sorted file records and artifact
digest are computed after composition and all existing staging transformations.
Neither command deploys or invokes Cloudflare.
