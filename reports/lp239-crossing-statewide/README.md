# LP239.6 Statewide Canonical Crossing Authority Parity Certification

Deterministically audits the LP239.2 registry through `gridlyCanonicalCrossingRuntime.resolveRecords({ placeGeoid })`. No production behavior was changed.

## Summary

| Metric | Total |
|---|---:|
| canonicalPlaceCount | 1859 |
| crossingAuthorityPassCount | 1859 |
| crossingAuthorityFailCount | 0 |
| availableNonemptyPlaceCount | 760 |
| availableEmptyPlaceCount | 1099 |
| unavailablePlaceCount | 0 |
| totalCanonicalCrossingIdentityCount | 9094 |
| totalResolvedCrossingRecordCount | 9094 |
| unresolvedCrossingIdentityCount | 0 |
| duplicateCrossingIdentityCount | 0 |
| membershipMismatchPlaceCount | 0 |
| identityMismatchPlaceCount | 0 |
| overallPass | true |

## Beaumont control

{"canonicalCommunity":"Beaumont","canonicalPlaceId":"4807000","membershipCountyIds":["jefferson-tx"],"membershipCount":1,"crossingAuthorityAvailable":true,"crossingAuthorityReason":null,"canonicalCrossingIdentityCount":146,"resolvedCrossingRecordCount":146,"crossingCountyIds":["jefferson-tx"],"unresolvedCrossingIds":[],"duplicateCrossingIds":[],"missingCrossingMemberships":[],"crossingAuthorityState":"AVAILABLE_NONEMPTY","crossingIdentityParityPass":true,"crossingMembershipParityPass":true,"crossingAuthorityPass":true,"unexpectedCrossingCountyIds":[],"identityMismatch":false}

## Failure ledger

Empty — all canonical PLACE crossing authority rows passed.
