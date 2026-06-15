# V324 — Flood Data Source Due Diligence

## Executive Summary

V324 is a research-only milestone for future Gridly flood awareness. It does not add flood layers, alerts, weather cards, routing changes, map changes, UI changes, or API integrations.

Gridly should remain **Awareness Platform First, Route Intelligence Second**. Flood-related data should be used to improve driver situational awareness, road-closure awareness, high-water awareness, and travel confidence without turning Gridly into a general-purpose weather application.

### Main Findings

1. **Best first future integration candidate:** **TxDOT DriveTexas API** because it directly addresses driver-facing road conditions and closures on Texas state-maintained roads, has a documented data feed, and aligns with Gridly's existing transportation-awareness mission.
2. **Highest hydrologic awareness candidate:** **USGS Water Data APIs** because they provide reliable, national, machine-readable streamflow and gage-height data useful for water-level context near roads, bridges, and low-water crossings.
3. **Best official alert-awareness candidate:** **NWS / Weather.gov API** because it provides official watches, warnings, advisories, observations, and alerts; however, Gridly should treat it as an official hazard signal rather than a weather-product surface.
4. **Best Houston-region flood confirmation candidate:** **Harris County Flood Warning System (HCFWS)** because it provides real-time rainfall, channel status, water levels, and inundation map context for one of Texas's highest-value flood-awareness regions, but terms, programmatic access, and regional scope require caution.
5. **Best strategic/planning candidate:** **TWDB / Texas Flood Viewer / Texas Flood Planning Data Hub** because it provides statewide flood-risk and floodplain context, but much of the value is static or planning-oriented rather than real-time roadway awareness.

### Recommended Future Integration Sequence

1. **V325 — DriveTexas Road-Condition Source Design**: research-to-architecture bridge only; no live API calls in production.
2. **V326 — Official Water-Level Context Design**: evaluate USGS gauge-to-road proximity scoring.
3. **V327 — Official Alert Context Design**: evaluate NWS/Weather.gov alert ingestion boundaries without weather UI.
4. **V328 — Houston Regional Flood Confirmation Design**: evaluate HCFWS / TranStar as official-plus-regional confirmation sources.

## Source Inventory

### Federal Sources

#### NOAA / National Weather Service / Weather.gov API

- **Purpose:** Official weather alerts, watches, warnings, observations, forecast zones, gridpoints, and related public weather data. The NWS web API documentation describes access to forecasts, alerts, observations, and other weather data through `api.weather.gov`. Source: [NWS API Web Service](https://www.weather.gov/documentation/services-web-api).
- **Coverage:** National, including Texas.
- **Update frequency:** Near real-time, with cache behavior based on product lifecycle.
- **Public availability:** Open public API, subject to required request headers and operational expectations.
- **Programmatic access:** REST-style JSON / JSON-LD API.
- **Licensing / terms:** U.S. government public data is generally reusable, but Gridly should still preserve NWS attribution, identify the app via `User-Agent`, cache responsibly, and avoid implying NWS endorsement. The public API documentation requires identifying requests with a `User-Agent` and notes cache-friendly usage. Source: [NWS API Web Service](https://www.weather.gov/documentation/services-web-api).
- **Reliability:** High for official alerts; medium for app-facing availability because public endpoints can be rate-limited, changed, or operationally constrained.
- **Flood awareness value:** High for flash flood warnings, flood warnings, severe thunderstorm warnings with flooding context, and area-level official hazard awareness.
- **Gridly integration value:** Medium-high. It provides authoritative hazard context but must be carefully scoped so Gridly does not become a weather app.
- **Risks:** Weather-product scope creep, broad geographic polygons that may not map cleanly to route segments, user-agent / future API-key requirements, rate limits, and alert fatigue.
- **Best suited for:** A. Awareness; C. Travel Confidence; D. Community Confirmation.
- **Travel Confidence contribution:** High when official flood or flash-flood alerts intersect a trip corridor; moderate when alerts are broad and not road-specific.

#### USGS Water Data APIs

- **Purpose:** Current and historical water measurements, including streamflow, gage height, daily values, site metadata, and related hydrologic parameters. USGS describes Water Data APIs as machine-readable REST APIs, and the API landing page highlights most recent real-time measurements for streamflow and gage height. Sources: [USGS Water Data APIs](https://api.waterdata.usgs.gov/) and [USGS Water Data for the Nation](https://waterdata.usgs.gov/).
- **Coverage:** National, with strong Texas river, stream, reservoir, and gauge coverage where stations exist.
- **Update frequency:** Near real-time for automated telemetry sites; periodic or delayed for some sites depending on station capability. USGS notes that telemetry data can be available within minutes, while other delivery may be delayed. Source: [USGS Water Data Blog - dataRetrieval](https://waterdata.usgs.gov/blog/dataretrieval/).
- **Public availability:** Open.
- **Programmatic access:** APIs, downloads, OGC-style services, site metadata endpoints.
- **Licensing / terms:** Federal public data with attribution recommended. Gridly should cite USGS, preserve station metadata, parameter codes, timestamps, provisional-data notices, and avoid over-interpreting provisional readings.
- **Reliability:** High for official hydrologic measurements; station-specific reliability varies by telemetry status, maintenance, and river coverage.
- **Flood awareness value:** High for river-level monitoring, bridge-adjacent gauge awareness, stream-stage trend context, and confidence signals near flood-prone crossings.
- **Gridly integration value:** High as a second-phase source after roadway closures because it provides objective water-level context but requires spatial modeling.
- **Risks:** Gauge-to-road matching complexity, non-road-specific measurements, provisional data, missing local low-water crossings, station outages, and user confusion if stage values lack thresholds.
- **Best suited for:** A. Awareness; C. Travel Confidence; D. Community Confirmation.
- **Travel Confidence contribution:** High where gauges are near the route and have flood-stage thresholds; moderate where gauges are distant or lack roadway relevance.

### Texas State Sources

#### TxDOT DriveTexas

- **Purpose:** Road conditions, closures, incidents, construction, cameras, and travel conditions on Texas state-maintained roadways. The DriveTexas API site states that the feed consists of road conditions on Texas state-maintained roads entered by TxDOT staff and contractors. Source: [DriveTexas API](https://api.drivetexas.org/).
- **Coverage:** Texas statewide, primarily state-maintained roadways.
- **Update frequency:** Near real-time / operational updates as entered by TxDOT staff and contractors.
- **Public availability:** Public website; API access appears available with an API key according to DriveTexas API documentation. Source: [DriveTexas API Documentation](https://api.drivetexas.org/api-docs).
- **Programmatic access:** API / feed.
- **Licensing / terms:** Requires review during onboarding. Expected obligations include attribution to TxDOT / DriveTexas, API key terms, and usage limits. Gridly should not redistribute beyond permitted uses without written confirmation.
- **Reliability:** High for state-maintained roadway events; medium for local/county roads outside TxDOT jurisdiction.
- **Flood awareness value:** Very high for flooded roadway closures, hazardous road conditions, official incidents, and closure-aware driver confidence.
- **Gridly integration value:** High. This is the most mission-aligned official road-condition data source for Texas drivers.
- **Risks:** Coverage gaps on county/city/private roads, API key requirements, terms review, possible latency from manual reporting, and geometry normalization effort.
- **Best suited for:** B. Road Conditions; C. Travel Confidence; D. Community Confirmation.
- **Travel Confidence contribution:** High for trips using state-maintained roads; moderate for local-road-only travel.

#### Texas Water Development Board (TWDB) Data Services and Flood Planning Data Hub

- **Purpose:** State water and flood-planning data, GIS/map services, data downloads, dashboards, floodplain datasets, and flood-planning resources. TWDB describes data services as web-based access to tabular and geographic map data. The Flood Planning Data Hub compiles information for regional flood planning groups. Sources: [TWDB Data Services](https://www.twdb.texas.gov/mapping/data-services.asp) and [TWDB Flood Planning Data](https://www.twdb.texas.gov/flood/planning/data.asp).
- **Coverage:** Texas statewide, with regional flood-planning datasets.
- **Update frequency:** Periodic for planning/floodplain datasets; some TWDB dashboards and map services may refresh more frequently depending on dataset.
- **Public availability:** Open public web data, maps, and downloads.
- **Programmatic access:** Map services, downloads, GIS resources, dashboards.
- **Licensing / terms:** Public state data, but Gridly should preserve TWDB attribution, dataset dates, disclaimers, map-service terms, and source lineage.
- **Reliability:** High for planning context; medium-low for real-time driver awareness.
- **Flood awareness value:** Medium for background flood-risk context and low-water-prone areas; low for active road closures.
- **Gridly integration value:** Medium as a background risk layer or planning input; low for live driver alerts.
- **Risks:** Static/planning data can be mistaken for active flood conditions, data age varies, integration with live routing requires careful labeling.
- **Best suited for:** A. Awareness; C. Travel Confidence.
- **Travel Confidence contribution:** Moderate as a background susceptibility signal; low as a real-time trip decision signal.

#### Texas Flood Information Viewer / Texas Flood Viewer

- **Purpose:** Interactive flood information viewer with best-available flood information provided to TWDB by data contributors. Source: [Texas Flood Information Viewer](https://map.texasflood.org/).
- **Coverage:** Texas statewide, depending on contributor datasets.
- **Update frequency:** Mostly periodic / dataset-dependent.
- **Public availability:** Open web viewer.
- **Programmatic access:** Map viewer; underlying service access requires separate technical review.
- **Licensing / terms:** Attribution and contributor lineage are important because TWDB describes the viewer as best-available information from data contributors.
- **Reliability:** Medium-high for flood-risk reference; low-medium for real-time conditions.
- **Flood awareness value:** Medium for floodplain and risk context; low for active flooded-road detection.
- **Gridly integration value:** Medium-low until programmatic access and terms are confirmed.
- **Risks:** May not be real-time, contributor-source complexity, difficult to explain to drivers without overclaiming current conditions.
- **Best suited for:** A. Awareness; C. Travel Confidence.
- **Travel Confidence contribution:** Moderate for background route susceptibility; low for immediate road-condition confidence.

#### Texas Division of Emergency Management (TDEM) Resources and Portal

- **Purpose:** Disaster response information, state emergency updates, disaster resource pages, portals, dashboards, maps, and links to official partner resources. TDEM disaster pages frequently link drivers to TxDOT road conditions and TWDB real-time weather data rather than acting as a single road-condition API. Source: [TDEM July Flooding Resource Page](https://tdem.texas.gov/disasters/july-flooding-25-0026).
- **Coverage:** Texas statewide.
- **Update frequency:** Event-driven during disasters; portal dashboards vary by product.
- **Public availability:** Public pages; some portal resources may require sign-in or have restricted operational context.
- **Programmatic access:** Mostly web pages, dashboards, maps, and downloads; no single clearly documented public flood-road API identified for Gridly use.
- **Licensing / terms:** Public information with attribution to TDEM and linked agencies; portal data terms require review per dataset.
- **Reliability:** High as an official emergency-management communication source; medium-low as a structured data source for app integration.
- **Flood awareness value:** Medium for official emergency context and escalation awareness; low for granular roadway conditions.
- **Gridly integration value:** Low-medium. Better as an emergency-resource link or escalation context than a first integration.
- **Risks:** Event-driven availability, inconsistent machine-readable structure, restricted dashboards, and not route-specific.
- **Best suited for:** A. Awareness; D. Community Confirmation.
- **Travel Confidence contribution:** Moderate during declared events; low during normal operations.

### Regional Sources

#### Houston TranStar

- **Purpose:** Houston-area traffic, incident, speed, travel-time, roadway, and regional mobility data. Houston TranStar states that it provides some collected data through JSON HTTPS feeds, with samples and descriptions, and asks users to contact TranStar for live feed access. Source: [Houston TranStar API](https://traffic.houstontranstar.org/api/api_doc.aspx).
- **Coverage:** Houston metropolitan region.
- **Update frequency:** Near real-time for traffic/incident feeds, depending on feed and access.
- **Public availability:** Public website; live data feeds may require contact / approval.
- **Programmatic access:** JSON feeds over HTTPS; access may require inquiry.
- **Licensing / terms:** Requires TranStar approval/terms review for live feeds, attribution, and possible redistribution limitations.
- **Reliability:** High regionally for Houston mobility data; low outside the Houston area.
- **Flood awareness value:** High regionally for incident, road condition, and travel-time disruption context; may complement HCFWS and DriveTexas.
- **Gridly integration value:** Medium-high for Houston expansion; low outside region.
- **Risks:** Regional-only coverage, access approval, feed-specific limitations, and overlap with TxDOT/DriveTexas.
- **Best suited for:** B. Road Conditions; C. Travel Confidence; D. Community Confirmation.
- **Travel Confidence contribution:** High within Houston when combined with HCFWS and DriveTexas; low elsewhere.

#### Harris County Flood Warning System (HCFWS)

- **Purpose:** Real-time rainfall, bayou/stream water levels, channel status, inundation maps, sensor selection, and local flood-warning context. HCFCD states that FWS measures rainfall and monitors water levels in bayous and major streams on a real-time basis. Sources: [HCFCD Flood Warning System](https://www.hcfcd.org/Resources/Storm-Center/Flood-Warning-System) and [Harris County FWS](https://www.harriscountyfws.org/).
- **Coverage:** Harris County and nearby regional monitoring context.
- **Update frequency:** Real-time / near real-time during normal operation; site warns that most recent data can sometimes be unavailable.
- **Public availability:** Open public web map; programmatic access is not clearly documented as an official public API.
- **Programmatic access:** Web map; potential feeds or services require separate confirmation. Avoid scraping unless explicitly permitted.
- **Licensing / terms:** HCFWS provides data as a public service and disclaims warranties on availability, accuracy, completeness, currency, and suitability. Source: [Harris County FWS full view](https://www.harriscountyfws.org/?View=full).
- **Reliability:** High for Harris County local awareness; medium for integration because public programmatic access and uptime guarantees are unclear.
- **Flood awareness value:** Very high for local rainfall, bayou status, inundation, and high-water awareness in Harris County.
- **Gridly integration value:** High for Houston/Harris County expansion, but not as a statewide first integration.
- **Risks:** Regional-only scope, unclear API terms, no warranty, possible data-unavailable states, and risk of creating false certainty if readings are stale.
- **Best suited for:** A. Awareness; C. Travel Confidence; D. Community Confirmation.
- **Travel Confidence contribution:** High in Harris County when combined with road-closure sources; low outside region.

#### Southeast Texas Flood Monitoring Systems / SETxFCS / Lamar Sensor Network

- **Purpose:** Flood sensor network and regional flood-monitoring research for Southeast Texas, including water-stage information and sensor threshold references. Public research describes 74 sensors across a seven-county Southeast Texas region and real-time water-stage information. Sources: [Mendeley dataset](https://data.mendeley.com/datasets/kwydrvscym), [PMC paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC10480587/), and [USGS SETxFCS](https://www.usgs.gov/news/southeast-texas-flood-coordination-study-setxfcs).
- **Coverage:** Southeast Texas regional / research network.
- **Update frequency:** Research indicates real-time water-stage information, but app-grade public feed availability requires confirmation.
- **Public availability:** Research datasets and publications are public; operational feeds may be limited or partner-managed.
- **Programmatic access:** Dataset/download and potential partner systems; no single mature public integration endpoint identified.
- **Licensing / terms:** Research-data licensing and operational-data permissions must be reviewed before use.
- **Reliability:** Medium as an emerging/regional network; high potential in covered counties, but operational maturity and feed access need validation.
- **Flood awareness value:** Medium-high for Southeast Texas high-water and local-stage monitoring.
- **Gridly integration value:** Medium for future regional expansion; not first statewide source.
- **Risks:** Research/operational boundary, limited geographic coverage, uncertain API/feed access, and maintenance responsibility.
- **Best suited for:** A. Awareness; C. Travel Confidence; D. Community Confirmation.
- **Travel Confidence contribution:** Moderate-high within covered Southeast Texas corridors; low elsewhere.

#### Flood Data North Texas

- **Purpose:** Regional flood-warning software platform with rainfall and water-level information across North Texas through a connected network of flood gauges. Source: [Flood Data North Texas](https://www.flooddatantx.com/).
- **Coverage:** North Texas regional participating agencies.
- **Update frequency:** Near real-time, based on gauge network.
- **Public availability:** Public website; participation/access model may vary.
- **Programmatic access:** Not clearly documented as an open public API.
- **Licensing / terms:** Requires direct terms review and partner permission before integration.
- **Reliability:** Medium-high regionally if official partner data is maintained; low outside North Texas.
- **Flood awareness value:** High regionally for rainfall and water-level awareness.
- **Gridly integration value:** Medium for future DFW/North Texas expansion.
- **Risks:** Regional coverage, access/terms uncertainty, and inconsistent standardization with statewide sources.
- **Best suited for:** A. Awareness; C. Travel Confidence; D. Community Confirmation.
- **Travel Confidence contribution:** High within North Texas coverage when combined with road-condition data; low elsewhere.

## Source Comparison Matrix

| Source | Coverage | Frequency | Availability | Access type | Reliability | Flood awareness value | Gridly integration value | Best use | Travel Confidence impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TxDOT DriveTexas | Texas statewide, state roads | Near real-time | API key likely required | API/feed | High for state roads | Very high | High | Road Conditions | High |
| USGS Water Data APIs | National | Near real-time / periodic | Open | API/download/OGC | High | High | High | Awareness / Confidence | High where gauge-relevant |
| NWS / Weather.gov API | National | Near real-time | Open with headers | API | High official alerts | High | Medium-high | Awareness | High for alerts |
| HCFWS | Harris County region | Real-time / near real-time | Open web; API unclear | Web map / possible services | High local, medium integration | Very high regional | High regional | Awareness / Confirmation | High regional |
| Houston TranStar | Houston region | Near real-time | Contact may be required | JSON feeds | High regional | High regional | Medium-high regional | Road Conditions | High regional |
| TWDB Data Services / Hub | Texas statewide | Periodic / dataset-specific | Open | Map services/downloads | High planning | Medium | Medium | Background Awareness | Moderate |
| Texas Flood Viewer | Texas statewide | Periodic / dataset-specific | Open | Map viewer / services TBD | Medium-high reference | Medium | Medium-low | Background Awareness | Moderate-low |
| TDEM Resources / Portal | Texas statewide | Event-driven | Public / some restricted | Web/maps/downloads | High communications | Medium | Low-medium | Awareness / Confirmation | Moderate during events |
| Southeast Texas Sensor Systems | Southeast Texas | Real-time claimed / feed TBD | Research public; operational TBD | Datasets / TBD | Medium | Medium-high regional | Medium regional | Awareness / Confirmation | Moderate-high regional |
| Flood Data North Texas | North Texas | Near real-time | Public site; API unclear | Web platform | Medium-high regional | High regional | Medium regional | Awareness / Confirmation | High regional |

## Licensing & Attribution Notes

- **Federal data:** NOAA/NWS and USGS data are strong candidates from a public-data perspective, but Gridly should still include source attribution, timestamps, disclaimers, and caching controls. NWS integration must include a proper `User-Agent` and must not imply NWS endorsement.
- **TxDOT DriveTexas:** Treat as permissioned until API terms are reviewed. The first implementation milestone should include API-key onboarding, written confirmation of allowed app use, attribution language, caching rules, and redistribution limits.
- **TWDB / Texas Flood Viewer:** Attribute TWDB and preserve dataset dates and contributor lineage. Avoid presenting planning or floodplain data as active flooding.
- **TDEM:** Use as official emergency-context source or resource link only unless a specific open dataset has documented terms.
- **Houston TranStar:** Contact TranStar before live-feed use. Respect feed-specific restrictions, attribution, and redistribution rules.
- **HCFWS:** Public-service data includes warranty disclaimers. Avoid scraping undocumented endpoints unless explicitly permitted. Label readings with timestamp and stale-data handling.
- **Regional systems:** Verify ownership, licensing, and operational feed permission before any app integration.

## Reliability Assessment

### High Reliability

- **TxDOT DriveTexas:** Official roadway source for Texas state-maintained road conditions.
- **USGS Water Data APIs:** Official hydrologic measurements with mature public APIs.
- **NWS / Weather.gov API:** Official alert source; best for warnings and watches.
- **HCFWS:** Highly valuable official local network for Harris County, with integration caveats.

### Medium Reliability

- **Houston TranStar:** Strong regional mobility source, but feed access and terms require coordination.
- **TWDB Data Services / Texas Flood Viewer:** Reliable for planning/reference context, less reliable for active road decisions.
- **Southeast Texas / North Texas regional systems:** Valuable where operationally maintained, but standardization and access vary.

### Low-to-Medium Reliability for Direct App Integration

- **TDEM resources:** Reliable as official communications, but not ideal as a structured, real-time driver data feed.

## Flood Awareness Value Assessment

### Highest Driver Problem Fit

1. **Flooded roads / road closures:** TxDOT DriveTexas, Houston TranStar.
2. **High-water crossings / water-level monitoring:** USGS Water Data APIs, HCFWS, regional sensor networks.
3. **Flash flood warnings:** NWS / Weather.gov API.
4. **Background flood-prone route context:** TWDB Data Services, Texas Flood Viewer, TWDB floodplain datasets.
5. **Official disaster escalation context:** TDEM.

### Avoided Scope Creep

Gridly should not expose generalized forecasts, hourly weather, radar, storm cards, or weather dashboards. Flood data should be reduced to transportation-aware signals such as:

- Official road closure present.
- Official flood alert intersects route area.
- Nearby water gauge rising or above threshold.
- Regional flood warning system indicates possible/likely flooding near corridor.
- Multiple independent indicators reduce travel confidence.

## Travel Confidence Relevance

| Source | Confidence signal | Impact | Notes |
| --- | --- | --- | --- |
| TxDOT DriveTexas | Official roadway closure / condition | High | Most direct driver-confidence input for Texas state roads. |
| USGS Water Data APIs | Nearby gauge stage / streamflow trend | High / Moderate | Strong when spatially near road crossings and thresholds exist. |
| NWS / Weather.gov API | Official flood / flash flood alert | High | Should be corridor-aware, not general weather display. |
| HCFWS | Rainfall, channel status, inundation | High regional | Excellent Houston-area confirmation source. |
| Houston TranStar | Regional incidents / travel disruption | High regional | Best when combined with DriveTexas and HCFWS. |
| TWDB / Texas Flood Viewer | Floodplain susceptibility | Moderate / Low | Useful background risk, not active condition. |
| TDEM | Disaster activation / emergency resource context | Moderate during events | Good escalation signal, not granular route confidence. |
| Regional sensor systems | Local water-stage / rainfall gauge confirmation | Moderate-high regional | Requires permissions and stale-data handling. |

## Recommended Tier Rankings

### Tier 1 — Highest-Value Candidates

#### 1. TxDOT DriveTexas

- **Why:** Directly solves the driver problem Gridly cares about most: official Texas road conditions and closures.
- **Expected value:** High for road-closure awareness, flooded roadway avoidance context, and travel confidence.
- **Integration difficulty:** Medium. API access/key, terms review, data normalization, caching, and geometry matching required.
- **Recommended role:** First future flood-awareness integration candidate.

#### 2. USGS Water Data APIs

- **Why:** Strong public API, official hydrologic data, national scalability, and high value for high-water context.
- **Expected value:** High where gauges can be matched to road crossings and flood thresholds.
- **Integration difficulty:** Medium-high. Requires gauge selection, spatial matching, threshold interpretation, stale-data handling, and user-friendly translation.
- **Recommended role:** Second source for water-level confidence context.

#### 3. NWS / Weather.gov API

- **Why:** Authoritative flood and flash-flood alert source.
- **Expected value:** High for official hazard awareness and route-confidence degradation during active alerts.
- **Integration difficulty:** Medium. Alert polygon/county/zone matching, rate limits, user-agent compliance, and strict anti-weather-app product boundaries.
- **Recommended role:** Official alert context, not weather UI.

#### 4. HCFWS

- **Why:** Extremely high regional value for Harris County / Houston flood awareness.
- **Expected value:** High in Gridly's likely Texas expansion areas where bayou, rainfall, and inundation data matter.
- **Integration difficulty:** Medium-high. Programmatic access and permission must be confirmed; stale/unavailable data handling required.
- **Recommended role:** Regional confirmation source after statewide foundations.

### Tier 2 — Useful Secondary Candidates

#### 5. Houston TranStar

- **Why:** Strong regional mobility/incident data that complements DriveTexas and HCFWS in Houston.
- **Expected value:** High regionally, especially for travel-time disruption and incident confirmation.
- **Integration difficulty:** Medium. Live-feed access may require contact and approval.
- **Recommended role:** Houston metro expansion candidate.

#### 6. TWDB Data Services / Texas Flood Planning Data Hub

- **Why:** Good statewide flood-risk and planning context.
- **Expected value:** Moderate as a background susceptibility signal.
- **Integration difficulty:** Medium. GIS/map service consumption and explanatory labeling required.
- **Recommended role:** Background risk/reference layer in future architecture, not active condition source.

#### 7. Texas Flood Information Viewer

- **Why:** Public Texas flood information viewer with best-available contributed data.
- **Expected value:** Moderate for awareness and route susceptibility research.
- **Integration difficulty:** Medium-high until service endpoints and terms are confirmed.
- **Recommended role:** Reference source for future flood-risk context.

### Tier 3 — Low-Priority / Regional or Conditional Candidates

#### 8. TDEM Resources / Portal

- **Why:** Valuable official emergency information, but not a structured road-condition or gauge API.
- **Expected value:** Low-medium for app integration; moderate as a resource/escalation reference.
- **Integration difficulty:** Low for links, high for structured data.
- **Recommended role:** Emergency-resource link or official context, not first integration.

#### 9. Southeast Texas Flood Monitoring Systems

- **Why:** Promising regional sensor network, but operational public feed maturity and permission are unclear.
- **Expected value:** Moderate-high in covered counties.
- **Integration difficulty:** High until API/terms are validated.
- **Recommended role:** Future regional pilot candidate.

#### 10. Flood Data North Texas

- **Why:** Valuable North Texas regional gauge network but public API/terms are unclear.
- **Expected value:** High regionally if access is permitted.
- **Integration difficulty:** High until access and standardization are confirmed.
- **Recommended role:** Future DFW regional expansion candidate.

## Risks & Constraints

1. **No source should be treated as complete.** Road closures, gauges, alerts, and community reports each have gaps.
2. **Roadway data and water data answer different questions.** A high river gauge does not always mean a specific road is flooded, and a road closure does not explain hydrologic conditions.
3. **Static floodplain data can be misunderstood.** TWDB planning data must be labeled as risk context, not active flooding.
4. **Regional systems do not scale statewide.** HCFWS, TranStar, Southeast Texas networks, and North Texas systems are valuable only within coverage boundaries.
5. **Licensing and terms must be confirmed before integration.** DriveTexas, TranStar, HCFWS, and regional systems require special attention.
6. **Stale data can reduce trust.** Every future source must carry timestamp, freshness, and degraded-state handling.
7. **Weather-app creep is a product risk.** NWS/Weather.gov should only power hazard context, not generalized forecasts or weather experiences.
8. **Community reports need official-source separation.** Community confirmation can strengthen awareness but should not override official closures or warnings without clear labeling.

## Recommended Future Integrations

### First Future Integration Candidate: TxDOT DriveTexas

TxDOT DriveTexas should be the first future flood-awareness integration candidate because it is the most driver-specific, Texas-specific, and mission-aligned source. It directly supports road-closure awareness and travel confidence without requiring Gridly to become a weather app.

Recommended first-slice architecture should include:

- API terms and attribution review.
- API-key onboarding research.
- Read-only sandbox/prototype outside production.
- Event taxonomy mapping: closure, incident, condition, construction, flood/high water if available.
- Geometry normalization design.
- Stale-data and source timestamp requirements.
- Product copy boundaries: “Official road condition reported by TxDOT” rather than flood prediction.

### Second Candidate: USGS Water Data APIs

USGS should follow DriveTexas because it adds high-value water-level context around crossings and flood-prone corridors. It should be used only after Gridly defines how gauges are spatially associated with roads and how thresholds are translated into plain-language confidence signals.

### Third Candidate: NWS / Weather.gov API

NWS should be treated as an official alert layer for flood warnings and flash-flood warnings. Integration should be constrained to alert-awareness and travel-confidence inputs, not forecast or weather-product UI.

### Regional Expansion Candidates

- **Houston:** HCFWS + Houston TranStar + DriveTexas.
- **North Texas:** Flood Data North Texas + DriveTexas + NWS.
- **Southeast Texas:** Regional sensor networks + USGS + DriveTexas.

## Recommended Milestone After V324

### V325 — TxDOT DriveTexas Flood/Road-Condition Integration Design

Recommended V325 scope:

- Research DriveTexas API terms, onboarding, attribution, and rate limits.
- Define source data contract without production calls.
- Define roadway event taxonomy and confidence scoring inputs.
- Define stale-data policy and source attribution copy.
- Identify whether flooded-road events are explicitly typed or must be inferred from condition/closure metadata.
- Produce an architecture document only.

V325 should still avoid production implementation, UI changes, route changes, map changes, NOAA calls, NWS calls, and weather features unless separately authorized.
