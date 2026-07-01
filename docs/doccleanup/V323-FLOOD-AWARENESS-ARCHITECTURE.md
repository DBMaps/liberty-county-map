> **Supersession Note:** This document has been superseded by `THE-GRIDLY-BLUEPRINT.md` as the governing architectural authority for Gridly. It remains preserved for historical context.

# V323 — Flood Awareness Architecture

## Executive Summary

V323 defines a future flood awareness architecture for Gridly without implementing production behavior. The recommended direction is to keep Gridly an **awareness platform first** and a route intelligence platform second by focusing on driver-actionable conditions: flooded roads, high water, impassable locations, flood-related closures, and official warning areas that materially reduce travel confidence.

Gridly should **not** become a weather app. Rainfall totals, humidity, generic radar imagery, and broad meteorological context are useful inputs for analysts, but they are poor primary consumer messages because they do not directly answer the driver question: **“Can I safely travel?”**

Recommended product posture:

1. Treat flood awareness as a **mobility hazard layer**, not a forecast layer.
2. Prefer **road-specific evidence** over area-wide weather conditions whenever possible.
3. Communicate severity in consumer language: **water on roadway**, **high water**, **road impassable / closed**.
4. Use community reports as early signals, but require recency, clustering, and corroboration before presenting high-confidence guidance.
5. Avoid heat maps for driver-facing flood awareness because they can imply precision where the system only has probabilistic or sparse evidence.
6. Integrate flooding into future Travel Confidence as a reducer, not a standalone routing engine.

This milestone is intentionally limited to research, architecture, product design, and recommendations. It does not add NOAA, NWS, weather, routing, rendering, alerting, corridor, or route intelligence changes.

## Mission Alignment

Gridly’s flood awareness system should answer mobility questions:

- “Is the road ahead passable?”
- “Is there water reported on my likely travel area?”
- “Is official guidance suggesting reduced travel confidence?”
- “Are multiple nearby reports making this area riskier than normal?”

Gridly should avoid becoming a weather destination for questions such as:

- “How much rain will fall?”
- “What is the humidity?”
- “What does the radar look like?”
- “What is the complete weather forecast?”

Flood awareness belongs in Gridly when it changes the driver’s practical decision: delay travel, use extra caution, verify route conditions, avoid a low-water crossing, or treat an area as uncertain.

## Driver Value Analysis

### Highest-value flood information for Texas drivers

| Information | Driver value | Why it matters |
| --- | --- | --- |
| Road flooded | Very high | Directly answers passability and safety. |
| High water reported | Very high | Indicates immediate vehicle risk even before closure. |
| Road impassable | Critical | Strongest consumer-facing travel blocker. |
| Road closure due to flooding | Critical | Officially actionable and less ambiguous than weather conditions. |
| Flooded low-water crossing | Critical in rural/suburban Texas | Low-water crossings are localized, fast-changing, and often not represented by broad forecast polygons. |
| Flash flood warning | High | Official urgent signal that flooding is occurring or imminent; useful for area-level confidence reduction. |
| Flood warning | Medium-high | Useful context, especially when paired with road evidence. |
| Flood advisory | Medium | Useful for caution messaging, but generally weaker than direct road reports. |
| Stream/river gauge above threshold | Medium | Valuable near known crossings, but requires translation into driver terms. |
| Rainfall amount | Low as a primary message | Not directly actionable without location, drainage, road geometry, or field confirmation. |
| Generic radar imagery | Low as a primary Gridly feature | Can distract from mobility decisions and move Gridly toward a weather-app model. |

### Actionable versus non-actionable flood data

#### Actionable

Actionable flood awareness should be specific enough to influence travel behavior:

- “Road flooded.”
- “High water reported.”
- “Road closed due to flooding.”
- “Low-water crossing may be unsafe.”
- “Multiple flood reports nearby.”
- “Flood warning active near destination.”
- “Travel confidence reduced.”

#### Weakly actionable or non-actionable

These may be useful backend inputs but should not be primary consumer messages:

- Rainfall amount without roadway impact.
- Humidity.
- Generic radar imagery.
- Forecast discussion text.
- River stage without a road-specific threshold.
- Watershed status without consumer translation.

### Design principle

Gridly should translate environmental signals into **road-use meaning**. A driver should not have to understand hydrology, NWS product taxonomy, or gauge thresholds to make a safer decision.

## Data Source Inventory

The following inventory is for future architecture only. V323 does not implement integrations.

### Federal sources

#### NOAA / National Weather Service alerts

- **Data available:** Watches, warnings, advisories, alert polygons/zones, affected areas, event names, severity/urgency/certainty metadata, descriptions, and instructions.
- **Public availability:** Public. The NWS API is hosted at `https://api.weather.gov` and provides forecasts, alerts, observations, and related weather data.
- **Update frequency:** Event-driven and cache-oriented. Alert data changes when NWS issues, updates, expires, or cancels products.
- **Geographic coverage:** United States, including Texas.
- **Potential Gridly value:** High for area-level awareness and Travel Confidence reduction, especially flash flood warnings and flood warnings.
- **Risks:** Alert polygons are not equivalent to flooded roads. Warning geography can be county/zone based or polygon based, which may not align cleanly with roads. NWS geolocation documentation notes that alert geolocation methods can cause user queries to miss some or all alerts depending on county/zone handling.
- **Limitations:** Not road-specific; may over-warn relative to a driver’s exact path; consumer wording can be meteorological rather than mobility-specific.
- **Architecture recommendation:** Use as an official context signal only after a future milestone defines normalization, TTL, deduplication, and consumer copy rules. Do not present NWS data as proof that a road is flooded.

Sources: NWS API documentation, NWS alert geolocation primer.

#### Weather.gov API

- **Data available:** NWS forecasts, alerts, observations, gridpoints, stations, offices, and zones.
- **Public availability:** Public API.
- **Update frequency:** Varies by product lifecycle and cache headers.
- **Geographic coverage:** United States.
- **Potential Gridly value:** Medium-high for official alert context; low for general forecasts in the Gridly product experience.
- **Risks:** Pulling forecast and radar-like concepts into Gridly may dilute the awareness-platform mission.
- **Limitations:** Requires careful rate, caching, attribution, and failure handling; weather forecasts do not equal travel safety.
- **Architecture recommendation:** Restrict any future use to alert products and official event metadata that can be translated into travel confidence.

Source: NWS API documentation.

#### USGS water gauges / Water Data APIs

- **Data available:** Real-time and historical measurements including streamflow, gage height, and other water parameters for monitoring locations.
- **Public availability:** Public APIs. USGS Water Data APIs provide machine-readable REST access, including recent real-time measurements.
- **Update frequency:** Gauge-dependent; often near-real-time but not guaranteed uniformly across all sites.
- **Geographic coverage:** National, including Texas monitoring locations.
- **Potential Gridly value:** Medium. Strong near bridges, waterways, low-water crossings, and historically flood-prone corridors if thresholds are mapped to road impacts.
- **Risks:** Gauge readings are hydrologic, not roadway passability. A high river stage may not flood a nearby road; a road can flood from poor drainage with no nearby gauge trigger.
- **Limitations:** Requires local calibration, thresholds, site metadata, stale-data handling, and spatial relationship modeling.
- **Architecture recommendation:** Treat as supporting evidence, not standalone consumer copy, unless a future milestone creates verified road-impact thresholds.

Sources: USGS Water Data APIs, USGS Water Services documentation.

### Texas statewide sources

#### TxDOT DriveTexas / DriveTexas API

- **Data available:** Current road conditions on Texas state-maintained roadways, including closures, accidents, flooding, damage, and construction. The DriveTexas API describes data as road conditions entered by TxDOT staff and contractors.
- **Public availability:** Public traveler website; public API landing page exists.
- **Update frequency:** Close to real time according to TxDOT public materials; the static DriveTexas map displays a data-updated timestamp.
- **Geographic coverage:** Texas state-maintained roads.
- **Potential Gridly value:** Very high. This is the strongest statewide source for road-specific flood closures and flooding conditions on TxDOT-maintained roads.
- **Risks:** Coverage excludes many city, county, private, and neighborhood roads. Human-entered data may lag rapidly changing flooding. API access terms and production reliability need future review.
- **Limitations:** State-maintained road bias; may not cover low-water crossings outside TxDOT jurisdiction.
- **Architecture recommendation:** Highest-priority future official road-condition candidate for Texas flood awareness, but only after a dedicated integration design milestone.

Sources: DriveTexas website, TxDOT DriveTexas public article, DriveTexas API page, DriveTexas ArcGIS item.

#### Texas Water Development Board flood resources

- **Data available:** Flood planning data, GIS resources, floodplain datasets, the Texas Flood Information Viewer, dashboards, TexMesonet data, and flood planning resources.
- **Public availability:** Public web resources, mapping services, and data services.
- **Update frequency:** Varies widely. Some planning datasets are static or periodic; some dashboards and viewers include current conditions.
- **Geographic coverage:** Statewide Texas resources with varying dataset coverage.
- **Potential Gridly value:** Medium for planning, risk context, and identifying flood-prone areas; lower for immediate driver decisions unless a specific current-condition feed is validated.
- **Risks:** Planning datasets can be mistaken for real-time conditions. Static floodplain data should not be rendered as current flooding.
- **Limitations:** Many TWDB datasets are designed for planning and flood risk analysis, not minute-by-minute mobility awareness.
- **Architecture recommendation:** Use as background research and potential future risk-context input, not as a first consumer-facing live flood source.

Sources: TWDB Flood Planning Data Hub, TWDB mapping/data services, Texas Flood Information Viewer, TWDB Cursory Floodplain Dataset, Texas Flood tools library.

#### Texas Flood Information Viewer

- **Data available:** Current flood gauge conditions and weather-related data presented in a map viewer.
- **Public availability:** Public web application.
- **Update frequency:** Depends on underlying gauge/source feeds.
- **Geographic coverage:** Texas.
- **Potential Gridly value:** Medium as a discovery and validation resource for gauge/status concepts.
- **Risks:** Viewer data needs source-level licensing, API, latency, and field definitions reviewed before product use.
- **Limitations:** Gauge-focused, not necessarily road-focused.
- **Architecture recommendation:** Include in a future data due-diligence milestone, especially to compare source coverage against Gridly’s Texas driver markets.

Source: Texas Flood Information Viewer.

### Regional and local sources

#### Harris County Flood Warning System

- **Data available:** Rainfall, stream levels, water levels, channel status, alarms, and interactive maps. Harris County Flood Control District states the system measures rainfall and monitors stream elevations on a real-time basis, with 201 Harris County gage stations and data for more than 350 regional gage stations including partner agencies.
- **Public availability:** Public website and alert signup ecosystem.
- **Update frequency:** Real-time basis, subject to station and system availability.
- **Geographic coverage:** Harris County and surrounding regional partner coverage.
- **Potential Gridly value:** High in Greater Houston for contextual flood awareness near bayous, creeks, and crossings.
- **Risks:** Hydrologic data still needs translation into road impact. Public web availability does not automatically mean production API availability.
- **Limitations:** Regional coverage; not statewide; possible outages or stale readings during severe events.
- **Architecture recommendation:** Treat as a high-value regional source candidate for Houston-area flood confidence after API/access review.

Sources: Harris County Flood Warning System, Harris County FWS FAQ, Harris County FWS About page, FWS Alerts.

#### Houston TranStar

- **Data available:** Incidents, high water, road closures, lane closures, construction, cameras, dynamic message signs, traffic conditions, and a Roadway Flood Warning Data Feed. Houston TranStar documentation says it provides XML and JSON feeds over HTTP and tracks areas where roadway flooding risk is high.
- **Public availability:** Public website and documented data feed samples; live feed access may require contacting Houston TranStar.
- **Update frequency:** Some feeds update frequently; lane closure live status is logged and updated once per minute according to the API documentation.
- **Geographic coverage:** Greater Houston / regional transportation network.
- **Potential Gridly value:** Very high for Houston-area road-specific high-water and flood-risk awareness.
- **Risks:** Live feed access requirements, terms, attribution, operational dependency, and regional scope.
- **Limitations:** Not statewide; some data may indicate flood-prone locations or risk rather than confirmed impassability.
- **Architecture recommendation:** Top regional candidate for future Houston flood awareness pilot because it is transportation-focused rather than weather-focused.

Sources: Houston TranStar API documentation, Houston TranStar data feeds, Houston TranStar layers, Houston TranStar public site.

#### Southeast Texas and local FEWS systems

- **Data available:** Varies by authority; may include river stage, flow, rainfall, flood maps, alerting, and local gauge data. TWDB’s 2025 Alternative Flood Early Warning System guide describes FEWS as systems that monitor, transmit, manage, and disseminate flooding-condition information using gauges and software.
- **Public availability:** Varies by county, river authority, drainage district, and emergency management agency.
- **Update frequency:** Varies; many systems aim for near-real-time hydrologic monitoring.
- **Geographic coverage:** Local or regional, often around rivers, bayous, creeks, and flood-prone communities.
- **Potential Gridly value:** Medium-high where coverage intersects common driver routes and known flood crossings.
- **Risks:** Fragmentation, inconsistent data models, variable reliability, and inconsistent licensing/access.
- **Limitations:** Integration cost may be high relative to coverage unless prioritized by market.
- **Architecture recommendation:** Build a source-evaluation rubric before integrating local feeds: public access, update frequency, road relevance, stale-data handling, field definitions, and operational reliability.

Sources: TWDB Alternative Flood Early Warning System Guide, Brazoria County River Authority Groundwater District FEWS example.

## Flood Severity Framework

Severity should describe **travel impact**, not meteorological intensity.

### Recommended consumer severity model

| Level | Label | Consumer meaning | Example copy | Typical evidence |
| --- | --- | --- | --- | --- |
| 1 | Water on roadway | Water has been reported, but passability is uncertain. | “Water reported on roadway. Use caution.” | Single recent community report, low-confidence official note, nearby gauge context. |
| 2 | High water | Water may affect vehicle control or safe passage. | “High water reported. Avoid if possible.” | Multiple reports, official high-water incident, gauge threshold near road. |
| 3 | Road impassable / closed | Travel should not continue through this location. | “Road closed due to flooding.” | TxDOT closure, official road closure, confirmed multiple reports, emergency management notice. |

### Alternative model A: Action-first labels

- **Use Caution** — possible water or flood advisory context.
- **Avoid Area** — high water, multiple reports, or official flood warning with local evidence.
- **Do Not Enter** — road closed, impassable, or official emergency instruction.

Benefit: simple and action-oriented. Risk: “Do Not Enter” may sound like a legal command unless backed by official closure data.

### Alternative model B: Confidence plus severity

- **Reported Water — Low Confidence**
- **High Water — Medium Confidence**
- **Closed / Impassable — High Confidence**

Benefit: transparent about uncertainty. Risk: too much detail for quick driving decisions.

### Recommendation

Start future product design with the three-level travel-impact model, then pair it with a separate confidence attribute internally. Do not expose raw confidence scores to consumers in early versions.

## Community Reporting Framework

Community reports are valuable because flooding is localized and fast-moving. They are also risky because false reports, duplicate reports, stale reports, and imprecise locations can create unsafe guidance.

### Recommended report lifecycle

1. **Single community report**
   - Status: Community Reported.
   - Use: Early awareness only.
   - Suggested copy: “Water reported nearby.”
   - Avoid: Strong avoid/closure language.

2. **Multiple nearby reports**
   - Status: Community Confirmed.
   - Use: Stronger awareness if reports are recent and spatially consistent.
   - Suggested copy: “Multiple flood reports nearby.”
   - Avoid: Treating clustered reports as official closure proof.

3. **Recently reconfirmed report**
   - Status: Recently Confirmed.
   - Use: Increase confidence and extend useful TTL.
   - Suggested copy: “High water recently reconfirmed.”

4. **Officially corroborated report**
   - Status: High Confidence.
   - Use: Strong consumer message when community reports align with official closure/high-water/flood warning data.
   - Suggested copy: “High water confirmed by multiple sources.”

### Potential confidence model

| Confidence | Inputs | Consumer handling |
| --- | --- | --- |
| Community Reported | One recent report | Marker/card only; cautious language. |
| Community Confirmed | Multiple independent recent reports near same segment/crossing | Stronger marker/card; avoid route-level claims. |
| High Confidence | Official source or community cluster corroborated by official/gauge context | Eligible for Travel Confidence reduction and stronger awareness copy. |

### Abuse and safety controls for future milestones

- Time decay aggressively; flood conditions can change quickly.
- Separate “water receded” reports from “still flooded” reports.
- Require reconfirmation for continued visibility.
- Avoid rewarding dramatic reports over precise reports.
- Preserve source transparency: “reported by drivers,” “reported by TxDOT,” “official warning active.”
- Build moderation/escalation rules before high-impact consumer language.

## Visualization Analysis

### A. Current marker-only approach

- **Trust impact:** High if markers are source-labeled and time-stamped.
- **Driver comprehension:** Strong for point-specific hazards; weak for corridor-scale risk.
- **False-positive risk:** Lower than broad overlays because each marker can map to a report/source.
- **Safety implications:** Safest early option because it avoids implying full spatial coverage.
- **Recommendation:** Best initial future visualization for flood awareness.

### B. Flood corridor highlighting

- **Trust impact:** Medium. Can feel authoritative even when based on sparse evidence.
- **Driver comprehension:** Good for route-scale context.
- **False-positive risk:** Medium-high if generated from alerts, gauges, or community reports without verified road impact.
- **Safety implications:** Could over-discourage travel or imply unhighlighted corridors are safe.
- **Recommendation:** Defer until Gridly has robust corridor evidence and confidence rules.

### C. Flood segment highlighting

- **Trust impact:** High when tied to official road closures or verified high-water segments.
- **Driver comprehension:** Excellent because it maps risk to the road network.
- **False-positive risk:** Medium. Segment snapping and geometry errors can mislead drivers.
- **Safety implications:** Strong safety value if source quality is high; dangerous if stale or mis-snapped.
- **Recommendation:** Strong long-term direction, but requires data normalization, geometry matching, stale-data controls, and explicit uncertainty handling.

### D. Heat maps

- **Trust impact:** Low-medium. Heat maps can look precise while hiding data sparsity and uncertainty.
- **Driver comprehension:** Good for broad “area is risky” impressions, poor for road passability.
- **False-positive risk:** High. Sparse reports can smear risk across safe roads; official warning polygons can exaggerate local road impact.
- **Safety implications:** Risk of both over-warning and under-warning; drivers may misread color gradients as confirmed roadway depth.
- **Recommendation:** Do not use heat maps for consumer-facing flood awareness in early Gridly milestones.

### E. Other alternatives

#### Awareness cards

- Summarize nearby flood conditions without map overreach.
- Good for “multiple flood reports nearby” and “official flood warning active.”
- Recommended alongside markers.

#### Source-specific badges

- Examples: “Driver reported,” “TxDOT,” “Official warning,” “Gauge context.”
- Improves trust by explaining why Gridly is showing the item.
- Recommended.

#### Time-decay visual treatment

- Fresh reports appear stronger; aging reports fade or require reconfirmation.
- Reduces stale flood hazard risk.
- Recommended.

### Visualization recommendation

Future flood awareness should begin with **source-labeled markers plus awareness cards**, then evolve toward **verified road-segment highlighting** only when official road-condition or highly reliable segment-level evidence is available. Avoid heat maps as a consumer feature.

## Awareness Experience

Consumer copy should be short, source-aware, and travel-oriented.

### Example messages

- “Flooded roadway reported on FM 1960.”
- “High water reported on US 90. Avoid if possible.”
- “Road closed due to flooding near Dayton.”
- “Flood warning active near Dayton. Travel confidence reduced.”
- “Multiple flood reports nearby.”
- “Water reported near a low-water crossing.”
- “High water recently reconfirmed by drivers.”
- “Official road condition: flooding reported.”
- “Flood risk nearby. Check conditions before leaving.”
- “Travel confidence reduced due to flood reports near your area.”

### Copy guidelines

- Say “reported” unless the source is official or confirmed.
- Use “closed” only when an official closure or high-confidence rule supports it.
- Avoid “safe” and “unsafe” as absolute claims.
- Avoid rainfall totals as headline copy.
- Avoid “forecast says” framing unless future scope explicitly includes forecast-derived awareness.

## Travel Confidence Concepts

Flooding should influence Travel Confidence as a **confidence reducer**, not as a route computation engine in this milestone.

### Conceptual model

| Travel Confidence | Flood condition concept | Product meaning |
| --- | --- | --- |
| High | No nearby flood reports, no relevant official warning, no known closures | Normal flood-aware confidence. |
| Moderate | Flood advisory/warning nearby, single water-on-road report, gauge context near route area | Travel may be possible, but conditions deserve caution and verification. |
| Low | High water, multiple nearby reports, official flood warning near travel area, known low-water crossing risk | Travel confidence reduced; consider delaying or checking official conditions. |
| Very Low / Avoid | Official flooded closure, impassable road, flash flood emergency, multiple confirmed high-water reports | Do not rely on normal travel assumptions; avoid affected area. |

### Architecture recommendations

- Keep severity and confidence separate internally.
- Confidence should combine source quality, recency, proximity, severity, and corroboration.
- Official road closures should outweigh generic area warnings.
- Single community reports should reduce confidence lightly unless reconfirmed.
- Stale reports should decay quickly.
- Flood warning polygons should reduce area confidence but not imply a specific road is flooded.
- Travel Confidence should explain the top reason: “Reduced due to high water reports,” not a black-box score.

## Product Recommendations

1. **Adopt mobility-first flood language.** Use road condition terms before weather terms.
2. **Prioritize official road-condition sources.** TxDOT DriveTexas and Houston TranStar are more aligned with Gridly than generic forecasts.
3. **Use NWS alerts as context, not proof.** Warnings support area confidence but do not confirm roadway flooding.
4. **Treat gauges as evidence requiring translation.** Gauge height and streamflow need local thresholds before driver-facing conclusions.
5. **Start with markers and awareness cards.** This minimizes false precision.
6. **Defer heat maps.** They are poorly aligned with “Can I safely travel?”
7. **Design a confidence model before integration.** Flood awareness is safety-sensitive; confidence should exist before broad display.
8. **Require source transparency.** Drivers should know whether an item comes from community, TxDOT, TranStar, NWS, or gauge context.
9. **Build for recency and expiration.** Flood data becomes dangerous when stale.
10. **Avoid route changes until awareness is proven.** Flood awareness can inform travel confidence before it changes routing.

## Recommended Future Milestones

### V324 — Flood Data Source Due Diligence

- Validate source access, licensing, attribution, API terms, rate limits, and operational reliability.
- Prioritize TxDOT DriveTexas, Houston TranStar, NWS alerts, USGS gauges, TWDB/Texas Flood Viewer, and Harris County FWS.
- Output: source scorecard and integration readiness ranking.

### V325 — Flood Taxonomy and Normalization Design

- Define canonical flood event types, severity labels, source fields, TTL rules, and stale-data states.
- Output: non-production data model and copy rules.

### V326 — Community Flood Reporting Product Spec

- Define report categories, reconfirmation, expiration, abuse controls, and confidence transitions.
- Output: UX/content spec only.

### V327 — Flood Confidence Scoring Prototype Plan

- Design shadow scoring rules for source quality, recency, proximity, corroboration, and severity.
- Output: offline prototype plan and test fixtures; no production behavior.

### V328 — Houston Pilot Architecture

- Evaluate Houston TranStar and Harris County FWS as a regional pilot stack.
- Output: regional architecture decision record.

### V329 — Travel Confidence Flood Integration Spec

- Define how flood evidence reduces future Travel Confidence without changing routes.
- Output: product/architecture spec only.

## Recommended Flood Roadmap

1. **Research and source validation** — confirm access rights, reliability, and coverage.
2. **Taxonomy and severity** — define Gridly-native flood event language.
3. **Confidence framework** — design source, recency, and corroboration scoring.
4. **Community report design** — define driver reporting and reconfirmation behavior.
5. **Marker/card awareness prototype** — non-routing, non-alert, source-labeled awareness only.
6. **Regional pilot planning** — Houston-area pilot using transportation-first sources.
7. **Travel Confidence integration** — reduce confidence based on flood evidence after validation.
8. **Segment highlighting evaluation** — only after verified road-segment evidence is reliable.

## Explicit Non-Goals for V323

V323 does not implement:

- NOAA API calls.
- NWS API calls.
- Weather API calls.
- Flood layers.
- Flood alerts.
- Flood heatmaps.
- Route changes.
- Corridor changes.
- Map rendering changes.
- Route intelligence changes.
- New UI.
- Production behavior changes.

## Research Sources

- NWS API documentation: https://www.weather.gov/documentation/services-web-api
- NWS alerts page: https://www.weather.gov/alerts
- NWS alert geolocation primer: https://www.weather.gov/media/documentation/docs/NWS_Geolocation.pdf
- USGS Water Data APIs: https://api.waterdata.usgs.gov/
- USGS Water Services: https://waterservices.usgs.gov/
- USGS Instantaneous Values Service: https://waterservices.usgs.gov/docs/instantaneous-values/instantaneous-values-details/
- DriveTexas: https://drivetexas.org/
- DriveTexas static map: https://static.drivetexas.org/
- DriveTexas API: https://api.drivetexas.org/
- TxDOT DriveTexas article: https://www.txdot.gov/about/newsroom/statewide/news-archive/019-2017.html
- TxDOT road conditions article: https://www.txdot.gov/about/newsroom/stories/be-your-own-traffic-reporter.html
- DriveTexas ArcGIS item: https://www.arcgis.com/home/item.html?id=baad58d4d3bb4c159d0d659325429bc4
- TWDB Flood Planning Data Hub: https://www.twdb.texas.gov/flood/planning/data.asp
- TWDB Data Services: https://www.twdb.texas.gov/mapping/data-services.asp
- TWDB mapping page: https://www.twdb.texas.gov/mapping/
- TWDB Cursory Floodplain Dataset: https://www.twdb.texas.gov/flood/science/floodplain-dataset.asp
- Texas Flood Information Viewer: https://map.texasflood.org/
- Texas Flood tools library: https://www.texasflood.org/tools-library/index.html
- Harris County Flood Warning System: https://www.harriscountyfws.org/
- Harris County FWS FAQ: https://www.harriscountyfws.org/faqs
- Harris County FWS About: https://www.harriscountyfws.org/about
- FWS Alerts: https://fwsalerts.org/
- Houston TranStar API documentation: https://traffic.houstontranstar.org/api/api_doc.aspx
- Houston TranStar data feeds: https://traffic.houstontranstar.org/datafeed/datafeed_info.aspx
- Houston TranStar layers: https://traffic.houstontranstar.org/layers/
- Houston TranStar public site: https://www.houstontranstar.org/
- TWDB Alternative Flood Early Warning System Guide: https://www.twdb.texas.gov/flood/research/early-warning-system/TWDB_Alternative_Flood_Early_Warning_System_Guide_2025.pdf
- Brazoria County River Authority Groundwater District FEWS example: https://bcragd.org/flood-early-warning-system/
