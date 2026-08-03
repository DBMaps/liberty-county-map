# LP122 — Wave 1 Source Provenance

## Source policy

Only official county-government sources were accepted. The evidence observation date is 2026-08-03; the pages do not publish an effective date for the address assertions, so machine-readable `evidenceDate` is `null` rather than invented. Each record carries county, FIPS, source identifier, observation date, confidence, review status, and an explicit containment statement.

| Source ID | Governing publisher | Authoritative URL | Accepted assertions |
| --- | --- | --- | --- |
| `lee-county-official` | Lee County, Texas | https://www.co.lee.tx.us/ | County containment; Giddings locality; Lee County Courthouse identity/address |
| `milam-county-official` | Milam County, Texas | https://www.co.milam.tx.us/ | County containment; Cameron locality; Milam County Courthouse identity/address |
| `robertson-county-official` | Robertson County, Texas | https://www.co.robertson.tx.us/ | County containment; Franklin locality; Robertson County Courthouse identity/address |

## Evidentiary limits

A courthouse locality is not extrapolated into a complete community inventory. An official street address is not converted into coordinates. No name variant is treated as an alias. Existing LP121 ZIP ambiguity findings remain unchanged, and no source is used beyond the assertions listed above.
