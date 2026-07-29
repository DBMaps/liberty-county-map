# LP103 Authoritative Rural Address Resolution

## Status and exact root cause

LP102 proved that the existing primary OpenStreetMap/Nominatim path has no address point for the
owner-supplied rural residence and that the Census address-range service can return a different
house number on the correct road. LP102 correctly rejects that interpolation. The unresolved
consumer problem was therefore a **source-coverage gap**, not a normalization or ranking defect:
Gridly had no production-authorized address-point source or governed private record after primary
no-result and before its strict Census fallback.

LP103 adds that missing source tier. It does not seed or publish the private residence. Production
completion remains gated on loading an owner-approved, verified record through a protected
administrative process and then collecting browser evidence.

## Investigation findings

### Existing project data

Repository searches covered address, E911/911, parcel situs, appraisal, structure, driveway,
entrance, rural range, and the protected road/address forms. The only relevant committed spatial
assets are county boundaries and road segments. No Liberty County address-point, E911, parcel-situs,
structure, driveway, or entrance dataset and no licensed address package was found. LP102's case
file is diagnostic material, not an authoritative location source.

### Official county and regional sources

Liberty County CAD, Liberty County government/911 addressing, H-GAC, and ArcGIS service discovery
were investigated. This execution environment returned HTTP 403 for the official county, CAD, and
H-GAC sites, while the integrated web-search service returned HTTP 401. No public FeatureServer,
download, license, update cadence, or production-use grant could therefore be verified. Gridly must
not infer permission from a public viewer and must not automate or scrape one.

The preferred authoritative acquisition is a Liberty County 911 physical-address point or verified
entrance record supplied directly by the responsible county authority under written production-use,
retention, attribution, and update terms. A CAD situs record is useful corroboration but is not by
itself proof of an entrance coordinate. Until those terms are received, neither source is represented
as licensed or enabled.

### Existing provider and alternatives

The six legitimate County Road abbreviation/locality forms were already exercised through the
configured primary path in LP102. Their governed outcome was primary confirmed-no-result; the
Census range candidate used a different house number and was rejected. Exactness is unchanged.

Commercial rooftop/parcel candidates (including Smarty, Precisely, HERE, Esri, and Google) require
account credentials and current contract review. No credential was present, so LP103 did not send
the private residence to those providers and does not claim a target result. Before selection, the
owner must obtain in writing: all-28-county coverage, returned house/road and precision semantics,
confidence meaning, price and quota, server-side-key support, cache/retention rules, attribution,
subprocessor/privacy terms, deletion handling, and permission to use coordinates for routing. No paid
provider or key is committed by LP103.

### Legal and privacy conclusion

* Nominatim remains primary under the existing OSM attribution and public-service governance.
* Census remains a federal address-range fallback, not evidence that a structure exists.
* County/911 data is recommended only after an explicit production-use grant; access to a viewer is
  not a license.
* Owner-confirmed GPS or a field-verified entrance is eligible only as a Gridly-governed record and is
  labeled by its actual verification method. It never becomes an official-source claim.
* The private registry is service-role-only with RLS, no client read grant, no public seed, and a
  SHA-256 lookup predicate/cache key. Normal consumer delivery necessarily returns the accepted
  destination to the requesting browser; passive diagnostics expose only booleans/classifications.

## Implemented resolution hierarchy

```text
primary provider
  -> private verified rural registry
  -> strict Census address-range fallback
  -> truthful no-result
```

The registry record includes normalized identity, house number, canonical road, locality, county,
state, ZIP, coordinate and source, verification method/date/status, source authority, aliases,
precision, and consumer eligibility. New records default to ineligible. Only `verified` plus
`consumer_eligible=true` records can resolve.

Lookup uses a SHA-256 digest of normalized `house|road|state|ZIP`; County Road, County Rd, CR, and
Co Rd normalize to one road identity. The returned values always come from the verified record—not
from the query. The existing acceptance gate then requires house, road, locality/county/state/ZIP,
coordinates, and approved precision to agree. Route Preview is set true only after this gate.

## Deployment and owner action

1. Obtain either (a) a county 911/authoritative address-point or entrance record with written use
   terms, or (b) an owner-confirmed/field-verified entrance coordinate and approval to store it.
2. Apply `202607290100_lp103_verified_rural_address_registry.sql`.
3. Through a protected administrator session, calculate the SHA-256 fingerprint using the same
   normalized `house|road|state|ZIP` algorithm and insert the private record. Do not place the SQL,
   address, coordinate, or fingerprint in source control, tickets, analytics, or browser consoles.
4. Set `verification_status='verified'` and `consumer_eligible=true` only after a second-person review
   of identity, coordinate, source label, authority, permission, and county containment.
5. Redeploy `gridly-geocode`, then deploy the cache-busted browser application. Rotate the geocode
   cache namespace so an earlier no-result cannot mask the new record.
6. Configure request-log redaction at the Supabase/edge ingress layer where available. Treat normal
   request-body visibility as operationally unavoidable and apply Gridly retention/access policy.

## Exact browser certification

1. Hard-refresh production and open DevTools Network. Clear prior Gridly geocoder evidence.
2. Enter the private address locally in consumer Search; do not paste it into a shared console,
   screenshot, issue, or recording.
3. Confirm exactly one card shows the correct house and County Road identity. Confirm the known wrong
   Census number and unrelated road fallbacks are absent.
4. Select the card and open Route Preview. Confirm its destination marker is the owner-verified
   property/entrance coordinate.
5. Confirm Network contains only POST requests to Gridly's `gridly-geocode` function and no browser
   request to Nominatim, Census, a county viewer, or a commercial geocoder.
6. Run `window.gridlyLp103RuralAddressResolutionTrace?.()` and confirm it contains classifications and
   booleans only: accepted verified source, both identity agreements true, eligible precision,
   containment true, Census not invoked, and Route Preview eligible. It must contain no address,
   house value, coordinate, provider secret, or raw record.
7. Run `window.gridlyLp103VisibleRuralAddressCertification?.()` and require `failedChecks: []` and
   `safeToMerge: true`.

Automated synthetic contracts prove the architecture and safety invariants. They cannot certify that
the private production row exists or that its coordinate is correct. LP103 must not be declared
production-complete until steps 1–7 succeed.
