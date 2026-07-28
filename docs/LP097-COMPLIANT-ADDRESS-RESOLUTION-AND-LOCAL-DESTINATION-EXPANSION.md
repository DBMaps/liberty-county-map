# LP097 — Compliant Address Resolution and Local Destination Expansion

## 1. Executive Summary
LP097 adds address-specific intent modeling, rural-road normalization, a deterministic three-attempt provider strategy, precision classification, address-first ranking, honest consumer states, and a governed Liberty County destination index. It preserves the existing selected-coordinate handoff to destination route preview. The direct browser provider remains a production launch blocker; this milestone does not claim production or manual-device certification.

## 2. LP096 Baseline
LP096 found one direct browser Nominatim free-form path, a five-candidate request/display cap, no structured full-address attempts, no exactness contract, and no consumer distinction between provider failure and no match.

## 3. Existing Search Architecture
The 350 ms live-input pipeline is retained. Saved Places and local seeds render immediately; remote results are normalized, ranked, contained, deduplicated, displayed in five compact rows, selected, and passed to the unchanged destination-marker/OSRM preview path.

## 4. Existing Curated Destination Inventory
The prior inline inventory mixed communities, roadway corridors, crossings, civic places, schools, medical facilities, and retailers. Many records lacked aliases, county IDs, verification metadata, activation state, or a canonical category. LP097 does not delete valid legacy roadway seeds. Governed LP097 records are separate from user addresses and are merged into the existing seed search adapter.

## 5. Address Intent Model
`buildGridlyLp097AddressModel` retains the original query and separately produces a display normalization, house number, street, locality, ZIP, rural/highway flags, structured components, and no more than three provider variants. House numbers are never removed from address variants.

## 6. Rural Address Normalization
`CR`, `County Rd`, `County Road`, and `Co Rd` normalize to `County Road` for controlled provider attempts. FM, TX, US, and State Highway forms retain their route number and any leading house number. The original input remains the final fallback.

## 7. Provider Boundary
The repository has no deployable owned search API contract. LP097 therefore retains the guarded direct Nominatim call rather than inventing an unavailable proxy. `providerBoundaryAvailable` is false and `safeToMerge` remains false in the audit until an owned boundary and browser certification exist.

## 8. Provider Compliance and Privacy
Requests are limited to three sequential attempts, stop after a coordinate-valid exact match, reuse a two-minute memory cache, suppress duplicate in-flight calls, throttle, and apply cooldowns. Raw queries are not written to storage or audit output. Nominatim attribution already remains part of the app's map/provider attribution. A future Gridly boundary must identify Gridly, rate-limit, cache transiently, avoid permanent raw-query logs, and return typed unavailable/rate-limited responses.

## 9. Controlled Query Strategy
1. Structured street/city/county/state/postal/country attempt for a recognized complete address.
2. Locality-aware expanded free-form attempt.
3. Original free-form fallback.

The evaluated provider limit is 15 per attempt, while the visible list remains five. Attempts are sequential and never exceed three.

## 10. Result Classification
Consumer labels are Exact address, Address, Place, Public service, Medical, School, Government, Retail, Road, Highway, Community, and Approximate location. Provider-internal class/type values are used only as internal signals.

## 11. Ranking Model
Exact house-number and road agreement receives the highest boost. Saved places follow; an exact governed name/alias match precedes general address and POI matches. Address-intent road, highway, and broad approximate results are penalized so they cannot impersonate the requested house address.

## 12. Consumer Failure States
The UI distinguishes temporarily unavailable, cooldown, unconfirmed exact address, approximate classification, and genuine no-match. It never labels a road corridor as an exact address.

## 13. Curated Destination Data Model
Every LP097 record has a stable ID, canonical name, aliases, category/subcategory, public address, community/county/state/ZIP, valid coordinates, source/coordinate verification description, verification date, and active state. The browser data file is immutable.

## 14. Liberty County Destination Expansion
The governed set covers medical/emergency, city and county government/law enforcement, education, libraries/post offices, retail, park, and airport destinations in Dayton, Liberty, and Cleveland. Expansion remains intentionally county-scoped and controlled.

## 15. Seed Governance
- **Verifier:** a maintainer checks the named public authority or official facility/store locator and map coordinate before review.
- **Required fields:** all fields in the LP097 canonical record; private residences are prohibited.
- **Coordinates:** building/entrance or authoritative facility point only; never a community centroid or roadway centerline.
- **Duplicates:** canonical ID uniqueness plus normalized name/community and coordinate proximity review.
- **Aliases:** recognizable former/alternate official names only; aliases may not make unsupported service claims.
- **Categories:** one product category and a controlled subcategory.
- **Updates:** refresh source, coordinate, and `verifiedAt` together; retain stable ID.
- **Deactivation:** set `active: false`; do not silently repoint an ID to another facility.
- **County expansion:** add a separately reviewed county batch only after its category and coordinate validation passes.

## 16. Certification Fixture Inventory
The 60-record fixture contains 15 public complete addresses, 10 synthetic County Road forms, five CR forms, five highway-address forms, 15 public-place searches, five broad searches, and five intentional ambiguous/no-match searches. Synthetic rural entries test contracts and do not claim provider coverage. The owner-supplied private test address is deliberately absent.

## 17. Static Test Results
The LP097 test validates fixture coverage, governed required fields, coordinate ranges, duplicate IDs, category coverage, request limits, structured lookup, stop-early behavior, ranking/classification copy, passive audit availability, and private-fixture exclusion.

## 18. Provider Integration Results
Status: **not executed**. This environment could not reach the provider (tunnel 403 before an HTTP provider response). No success percentage is fabricated. Controlled-provider and production-browser results remain pending.

## 19. Browser Certification
Run the supplied console block in production after deployment. The passive helper performs no requests or persistence. `safeToMerge` intentionally remains false until the owned provider boundary, browser run, and manual portrait run are certified.

## 20. Mobile Manual Testing
Use a fresh private session at mobile portrait width. Search a fixture public address; verify Exact address is above road seeds, select it, and confirm route preview. Repeat with a public rural address, CR spelling, and omitted locality. Verify approximate and provider-unavailable states, and confirm Enter does not duplicate requests. Then search one destination from every governed category and regression-check US 90, TX 146, Saved Places, Home, Work, Favorites, Route Watch, crossings, reporting, and awareness filters. For the owner-only address, record only yes/no, rank, coordinate validity, route handoff, and persistence pass; do not capture or store its text.

## 21. Protected Systems Confirmation
No Shared Reports, Route Watch calculation, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase synchronization, Historical Intelligence, Official Source Integration, crossing interaction, Saved Places storage, Home/Work contract, OSRM behavior, reporting, or notification code was changed.

## 22. Known Limitations
There is no production-owned provider boundary; rural resolution remains dependent on provider map coverage. Provider integration, production browser, and physical-device portrait certification are pending. The curated set is useful but intentionally not an exhaustive business directory.

## 23. Launch Recommendation
Keep the full-address launch gate closed. The patch is ready for controlled browser validation, but merge/launch should wait for the owned provider boundary plus successful browser and real-device evidence.

## 24. Files Changed
`index.html`, `js/app.js`, `js/lp097-curated-destinations.js`, `css/styles.css`, the LP097 fixture/test, and this document.

## 25. Tests Performed
Run `node tests/lp097-address-resolution-and-destinations.test.js`, `node --check js/app.js`, and the existing LP096 contract test. Provider probing was attempted separately and was blocked before provider response.
