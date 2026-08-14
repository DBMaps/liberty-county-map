# LP195 — Texas major metro consumer coverage audit

**Status:** AUDIT / CLASSIFICATION ONLY. No production behavior is changed.

## Evidence boundary

All current-behavior findings are **REPOSITORY-GOVERNED FACTS** derived deterministically from the statewide consumer community projection, governed ZIP index, place-presentation centers, and runtime contract. No external product research was used. ZIP overlap is evidence of current resolver reach, not permission to invent labels, keys, mappings, or regions.

## Executive conclusion

DFW needs an independent-city product model rather than one DFW identity. Austin and El Paso lack governed ZIP reach, so owner-confirmed subdivision would require stronger governance rather than Houston-style projection from current evidence. Corpus Christi and Laredo need no regionalization now. RGV, Beaumont–Port Arthur, and Killeen–Temple already obtain useful granularity from independent governed places. No metro meets the evidence threshold for governed polygon regionalization in LP195.

## Dallas–Fort Worth

- **Classification:** `MULTI_CITY_METRO_MODEL_REQUIRED`
- **Method:** `MULTI_CITY_INDEPENDENT_PLACE_MODEL`
- **Priority:** `P1`
- **Current behavior:** Consumer-eligible Census PLACE/CDP projection; selection, search, home area, Current View and Location Context use the governed PLACE identity where resolved. NONE_FOR_THIS_METRO.
- **Governed places:** Dallas (`4819000`, INCORPORATED_PLACE, counties 48085/48113/48121/48257/48397); Fort Worth (`4827000`, INCORPORATED_PLACE, counties 48121/48251/48367/48439/48497); Arlington (`4804000`, INCORPORATED_PLACE, counties 48439); Plano (`4858016`, INCORPORATED_PLACE, counties 48085/48121); Irving (`4837000`, INCORPORATED_PLACE, counties 48113); Garland (`4829000`, INCORPORATED_PLACE, counties 48085/48113); Grand Prairie (`4830464`, INCORPORATED_PLACE, counties 48113/48139/48251/48439); Frisco (`4827684`, INCORPORATED_PLACE, counties 48085/48121); McKinney (`4845744`, INCORPORATED_PLACE, counties 48085); Denton (`4819972`, INCORPORATED_PLACE, counties 48121).
- **ZIP/community evidence:** 183 governed records reach 2 audited communities (Dallas, Denton); 50 records require or contain multi-county context. ZIP evidence is resolver evidence, not authority for invented sub-city labels.
- **Camera:** Dallas: 32.7933334, -96.7665128, zoom 13, PLACE; Fort Worth: 32.7819538, -97.3485732, zoom 13, PLACE; Arlington: 32.7007082, -97.1246912, zoom 13, PLACE; Plano: 33.0507687, -96.747944, zoom 13, PLACE; Irving: 32.8577478, -96.9700224, zoom 13, PLACE; Garland: 32.9098262, -96.6303341, zoom 13, PLACE; Grand Prairie: 32.6789304, -97.0207429, zoom 13, PLACE; Frisco: 33.1554266, -96.8225959, zoom 13, PLACE; McKinney: 33.2011245, -96.6641609, zoom 13, PLACE; Denton: 33.2174488, -97.1413455, zoom 13, PLACE. The city views use generic PLACE semantics, not metro-region semantics; zoom 13 is wider than the final San Antonio consumer zoom 14 but is not changed here.
- **Conclusion:** The governed substrate preserves the major cities independently; a single DFW consumer identity would discard useful city context. Dallas and Fort Worth remain broad city identities and are candidates for separately scoped ZIP/community presentation work.
- **Precedence:** `INDEPENDENT_GOVERNED_PLACE_WINS`; ambiguous/cross-county ZIP context cannot absorb a PLACE/CDP.
- **Exact follow-up:** LP196: owner-scope independent-city DFW model and decide whether Dallas and Fort Worth each warrant presentation-only sub-city design; do not create a metro-wide override.

## Austin

- **Classification:** `GEOMETRY_GOVERNANCE_REQUIRED`
- **Method:** `GOVERNED_POLYGON_REGIONALIZATION`
- **Priority:** `P1`
- **Current behavior:** Consumer-eligible Census PLACE/CDP projection; selection, search, home area, Current View and Location Context use the governed PLACE identity where resolved. NONE_FOR_THIS_METRO.
- **Governed places:** Austin (`4805000`, INCORPORATED_PLACE, counties 48021/48209/48453/48491); Round Rock (`4863500`, INCORPORATED_PLACE, counties 48453/48491); Cedar Park (`4813552`, INCORPORATED_PLACE, counties 48453/48491); Pflugerville (`4857176`, INCORPORATED_PLACE, counties 48453/48491); Leander (`4842016`, INCORPORATED_PLACE, counties 48453/48491).
- **ZIP/community evidence:** 0 governed records reach 0 audited communities (none); 0 records require or contain multi-county context. ZIP evidence is resolver evidence, not authority for invented sub-city labels.
- **Camera:** Austin: 30.2986219, -97.7541339, zoom 13, PLACE; Round Rock: 30.5261465, -97.6635324, zoom 13, PLACE; Cedar Park: 30.5101769, -97.8186264, zoom 13, PLACE; Pflugerville: 30.4477647, -97.6021157, zoom 13, PLACE; Leander: 30.5742732, -97.8617408, zoom 13, PLACE. The city views use generic PLACE semantics, not metro-region semantics; zoom 13 is wider than the final San Antonio consumer zoom 14 but is not changed here.
- **Conclusion:** Austin resolves as one broad PLACE while surrounding governed places remain distinct. The current governed ZIP index reaches none of the audited Austin identities, so repository evidence cannot support Houston-style ZIP projection today; any subdivision would require new governed evidence in a later milestone.
- **Precedence:** `INDEPENDENT_GOVERNED_PLACE_WINS`; ambiguous/cross-county ZIP context cannot absorb a PLACE/CDP.
- **Exact follow-up:** After DFW, decide whether the product defect justifies an Austin governance/design milestone; first reassess governed ZIP acquisition, and use polygons only if the ZIP gap remains.

## El Paso

- **Classification:** `GEOMETRY_GOVERNANCE_REQUIRED`
- **Method:** `GOVERNED_POLYGON_REGIONALIZATION`
- **Priority:** `P1`
- **Current behavior:** Consumer-eligible Census PLACE/CDP projection; selection, search, home area, Current View and Location Context use the governed PLACE identity where resolved. NONE_FOR_THIS_METRO.
- **Governed places:** El Paso (`4824000`, INCORPORATED_PLACE, counties 48141); Horizon City (`4834832`, INCORPORATED_PLACE, counties 48141); Socorro (`4868636`, INCORPORATED_PLACE, counties 48141); San Elizario (`4865360`, INCORPORATED_PLACE, counties 48141); Vinton (`4875668`, INCORPORATED_PLACE, counties 48141).
- **ZIP/community evidence:** 0 governed records reach 0 audited communities (none); 0 records require or contain multi-county context. ZIP evidence is resolver evidence, not authority for invented sub-city labels.
- **Camera:** El Paso: 31.8477804, -106.4311055, zoom 13, PLACE; Horizon City: 31.6796475, -106.1910545, zoom 13, PLACE; Socorro: 31.6384912, -106.2574405, zoom 13, PLACE; San Elizario: 31.5784361, -106.2620195, zoom 13, PLACE; Vinton: 31.959455, -106.5935165, zoom 13, PLACE. The city views use generic PLACE semantics, not metro-region semantics; zoom 13 is wider than the final San Antonio consumer zoom 14 but is not changed here.
- **Conclusion:** El Paso is a single broad governed PLACE at the consumer layer, and the current governed ZIP index reaches none of the audited El Paso identities. Nearby incorporated places remain independent, but no repository-governed sub-city projection substrate exists.
- **Precedence:** `INDEPENDENT_GOVERNED_PLACE_WINS`; ambiguous/cross-county ZIP context cannot absorb a PLACE/CDP.
- **Exact follow-up:** Run an El Paso evidence/governance design milestone only after owner browser confirmation that the broad city view is a material defect; do not infer subdivisions from ZIPs.

## Corpus Christi

- **Classification:** `NO_REGIONALIZATION_NEEDED`
- **Method:** `EXISTING_RUNTIME_ALREADY_SUFFICIENT`
- **Priority:** `P3`
- **Current behavior:** Consumer-eligible Census PLACE/CDP projection; selection, search, home area, Current View and Location Context use the governed PLACE identity where resolved. NONE_FOR_THIS_METRO.
- **Governed places:** Corpus Christi (`4817000`, INCORPORATED_PLACE, counties 48007/48273/48355/48409); Portland (`4858904`, INCORPORATED_PLACE, counties 48355/48409); Robstown (`4862600`, INCORPORATED_PLACE, counties 48355).
- **ZIP/community evidence:** 0 governed records reach 0 audited communities (none); 0 records require or contain multi-county context. ZIP evidence is resolver evidence, not authority for invented sub-city labels.
- **Camera:** Corpus Christi: 27.7542524, -97.1733853, zoom 13, PLACE; Portland: 27.8890482, -97.3315975, zoom 13, PLACE; Robstown: 27.793971, -97.6691627, zoom 13, PLACE. The city views use generic PLACE semantics, not metro-region semantics; zoom 13 is wider than the final San Antonio consumer zoom 14 but is not changed here.
- **Conclusion:** Citywide Corpus Christi plus independently governed nearby places is proportionate to current evidence; ZIP records do not establish governed sub-city consumer labels.
- **Precedence:** `INDEPENDENT_GOVERNED_PLACE_WINS`; ambiguous/cross-county ZIP context cannot absorb a PLACE/CDP.
- **Exact follow-up:** Monitor owner feedback after launch; open a design audit only if citywide context proves materially confusing.

## Laredo

- **Classification:** `NO_REGIONALIZATION_NEEDED`
- **Method:** `EXISTING_RUNTIME_ALREADY_SUFFICIENT`
- **Priority:** `P3`
- **Current behavior:** Consumer-eligible Census PLACE/CDP projection; selection, search, home area, Current View and Location Context use the governed PLACE identity where resolved. NONE_FOR_THIS_METRO.
- **Governed places:** Laredo (`4841464`, INCORPORATED_PLACE, counties 48479); Laredo Ranchettes (`4841473`, CENSUS_DESIGNATED_PLACE, counties 48479); Laredo Ranchettes West (`4841475`, CENSUS_DESIGNATED_PLACE, counties 48479).
- **ZIP/community evidence:** 0 governed records reach 0 audited communities (none); 0 records require or contain multi-county context. ZIP evidence is resolver evidence, not authority for invented sub-city labels.
- **Camera:** Laredo: 27.5603789, -99.4891809, zoom 13, PLACE; Laredo Ranchettes: 27.491353, -99.3597816, zoom 13, PLACE; Laredo Ranchettes West: 27.4900378, -99.3701427, zoom 13, PLACE. The city views use generic PLACE semantics, not metro-region semantics; zoom 13 is wider than the final San Antonio consumer zoom 14 but is not changed here.
- **Conclusion:** The city and nearby CDPs are independently governed; current ZIP evidence does not itself govern meaningful Laredo subdivisions.
- **Precedence:** `INDEPENDENT_GOVERNED_PLACE_WINS`; ambiguous/cross-county ZIP context cannot absorb a PLACE/CDP.
- **Exact follow-up:** Monitor; preserve Laredo Ranchettes CDP precedence in any later proposal.

## Rio Grande Valley

- **Classification:** `ADEQUATE_EXISTING_CONSUMER_GEOGRAPHY`
- **Method:** `MULTI_CITY_INDEPENDENT_PLACE_MODEL`
- **Priority:** `P3`
- **Current behavior:** Consumer-eligible Census PLACE/CDP projection; selection, search, home area, Current View and Location Context use the governed PLACE identity where resolved. NONE_FOR_THIS_METRO.
- **Governed places:** McAllen (`4845384`, INCORPORATED_PLACE, counties 48215); Edinburg (`4822660`, INCORPORATED_PLACE, counties 48215); Mission (`4848768`, INCORPORATED_PLACE, counties 48215); Pharr (`4857200`, INCORPORATED_PLACE, counties 48215); Weslaco (`4877272`, INCORPORATED_PLACE, counties 48215); Harlingen (`4832372`, INCORPORATED_PLACE, counties 48061); Brownsville (`4810768`, INCORPORATED_PLACE, counties 48061).
- **ZIP/community evidence:** 23 governed records reach 1 audited communities (Brownsville); 4 records require or contain multi-county context. ZIP evidence is resolver evidence, not authority for invented sub-city labels.
- **Camera:** McAllen: 26.2249657, -98.246083, zoom 13, PLACE; Edinburg: 26.3183738, -98.15348, zoom 13, PLACE; Mission: 26.2040601, -98.3252207, zoom 13, PLACE; Pharr: 26.163436, -98.1938896, zoom 13, PLACE; Weslaco: 26.1605485, -97.9876536, zoom 13, PLACE; Harlingen: 26.191204, -97.6973825, zoom 13, PLACE; Brownsville: 25.9894042, -97.4806255, zoom 13, PLACE. The city views use generic PLACE semantics, not metro-region semantics; zoom 13 is wider than the final San Antonio consumer zoom 14 but is not changed here.
- **Conclusion:** The cluster already exposes multiple recognizable governed cities. A broad RGV identity would add little and could erase city/county context.
- **Precedence:** `INDEPENDENT_GOVERNED_PLACE_WINS`; ambiguous/cross-county ZIP context cannot absorb a PLACE/CDP.
- **Exact follow-up:** No regional layer; monitor cross-county owner journeys and retain independent-city resolution.

## Beaumont–Port Arthur

- **Classification:** `ADEQUATE_EXISTING_CONSUMER_GEOGRAPHY`
- **Method:** `EXISTING_RUNTIME_ALREADY_SUFFICIENT`
- **Priority:** `P3`
- **Current behavior:** Consumer-eligible Census PLACE/CDP projection; selection, search, home area, Current View and Location Context use the governed PLACE identity where resolved. NONE_FOR_THIS_METRO.
- **Governed places:** Beaumont (`4807000`, INCORPORATED_PLACE, counties 48245); Port Arthur (`4858820`, INCORPORATED_PLACE, counties 48245/48361); Nederland (`4850580`, INCORPORATED_PLACE, counties 48245); Port Neches (`4858940`, INCORPORATED_PLACE, counties 48245); Groves (`4831328`, INCORPORATED_PLACE, counties 48245).
- **ZIP/community evidence:** 0 governed records reach 0 audited communities (none); 0 records require or contain multi-county context. ZIP evidence is resolver evidence, not authority for invented sub-city labels.
- **Camera:** Beaumont: 30.084912, -94.1453303, zoom 13, PLACE; Port Arthur: 29.9000079, -93.8944195, zoom 13, PLACE; Nederland: 29.969288, -94.0017137, zoom 13, PLACE; Port Neches: 29.9607676, -93.9617904, zoom 13, PLACE; Groves: 29.9459705, -93.9166563, zoom 13, PLACE. The city views use generic PLACE semantics, not metro-region semantics; zoom 13 is wider than the final San Antonio consumer zoom 14 but is not changed here.
- **Conclusion:** Beaumont, Port Arthur, and adjacent communities are independently governed and consumer eligible; subdivision is not demonstrated as necessary.
- **Precedence:** `INDEPENDENT_GOVERNED_PLACE_WINS`; ambiguous/cross-county ZIP context cannot absorb a PLACE/CDP.
- **Exact follow-up:** No implementation milestone; monitor independent-city selection.

## Killeen–Temple

- **Classification:** `ADEQUATE_EXISTING_CONSUMER_GEOGRAPHY`
- **Method:** `MULTI_CITY_INDEPENDENT_PLACE_MODEL`
- **Priority:** `P3`
- **Current behavior:** Consumer-eligible Census PLACE/CDP projection; selection, search, home area, Current View and Location Context use the governed PLACE identity where resolved. NONE_FOR_THIS_METRO.
- **Governed places:** Killeen (`4839148`, INCORPORATED_PLACE, counties 48027); Temple (`4872176`, INCORPORATED_PLACE, counties 48027); Belton (`4807492`, INCORPORATED_PLACE, counties 48027); Harker Heights (`4832312`, INCORPORATED_PLACE, counties 48027); Copperas Cove (`4816624`, INCORPORATED_PLACE, counties 48027/48099/48281).
- **ZIP/community evidence:** 0 governed records reach 0 audited communities (none); 0 records require or contain multi-county context. ZIP evidence is resolver evidence, not authority for invented sub-city labels.
- **Camera:** Killeen: 31.0776691, -97.731952, zoom 13, PLACE; Temple: 31.1049362, -97.3885117, zoom 13, PLACE; Belton: 31.0523452, -97.4795422, zoom 13, PLACE; Harker Heights: 31.0567082, -97.6442214, zoom 13, PLACE; Copperas Cove: 31.1195749, -97.9143974, zoom 13, PLACE. The city views use generic PLACE semantics, not metro-region semantics; zoom 13 is wider than the final San Antonio consumer zoom 14 but is not changed here.
- **Conclusion:** Killeen, Temple, Belton, and nearby cities already retain useful independent PLACE identity; collapsing them would reduce granularity.
- **Precedence:** `INDEPENDENT_GOVERNED_PLACE_WINS`; ambiguous/cross-county ZIP context cannot absorb a PLACE/CDP.
- **Exact follow-up:** No regional layer; monitor cross-county Copperas Cove precedence.

## Owner browser test matrix (P0/P1 only)

These ZIPs are selected directly from the governed repository ZIP records.

| Metro | Input | Expected governed identity | Consumer label | County | Camera | Precedence concern |
| --- | --- | --- | --- | --- | --- | --- |
| Dallas–Fort Worth | `75001` | PLACE 4819000 (Dallas) | Dallas | Dallas County | PLACE center 32.7933334, -96.7665128; startup zoom 13 | Do not replace this PLACE with a metro identity. |
| Dallas–Fort Worth | `Fort Worth` | PLACE 4827000 (Fort Worth) | Fort Worth | Tarrant County | PLACE center 32.7819538, -97.3485732; startup zoom 13 | No governed ZIP expectation exists; validate PLACE search only. |
| Dallas–Fort Worth | `Arlington` | PLACE 4804000 (Arlington) | Arlington | Tarrant County | PLACE center 32.7007082, -97.1246912; startup zoom 13 | No governed ZIP expectation exists; validate PLACE search only. |
| Austin | `Austin` | PLACE 4805000 (Austin) | Austin | Travis County | PLACE center 30.2986219, -97.7541339; startup zoom 13 | No governed ZIP expectation exists; validate PLACE search only. |
| El Paso | `El Paso` | PLACE 4824000 (El Paso) | El Paso | El Paso County | PLACE center 31.8477804, -106.4311055; startup zoom 13 | No governed ZIP expectation exists; validate PLACE search only. |

## Protected-scope finding

LP195 emits reports, a read-only builder, tests, and package scripts only. It creates no runtime IDs or geometry and does not modify runtime registries, `js/app.js`, awareness arrays, ZIP mappings, search, semantic cameras, Houston, San Antonio LP191–LP194 artifacts, Supabase, deployment, Route Watch, hazard lifecycle, Reports behavior, or native/store configuration.

## Final decision table

| Metro | Current Classification | Recommended Method | Priority | Follow-up Milestone Needed? | Reason |
| --- | --- | --- | --- | --- | --- |
| Dallas–Fort Worth | `MULTI_CITY_METRO_MODEL_REQUIRED` | `MULTI_CITY_INDEPENDENT_PLACE_MODEL` | P1 | Yes | The governed substrate preserves the major cities independently; a single DFW consumer identity would discard useful city context. Dallas and Fort Worth remain broad city identities and are candidates for separately scoped ZIP/community presentation work. |
| Austin | `GEOMETRY_GOVERNANCE_REQUIRED` | `GOVERNED_POLYGON_REGIONALIZATION` | P1 | Yes | Austin resolves as one broad PLACE while surrounding governed places remain distinct. The current governed ZIP index reaches none of the audited Austin identities, so repository evidence cannot support Houston-style ZIP projection today; any subdivision would require new governed evidence in a later milestone. |
| El Paso | `GEOMETRY_GOVERNANCE_REQUIRED` | `GOVERNED_POLYGON_REGIONALIZATION` | P1 | Yes | El Paso is a single broad governed PLACE at the consumer layer, and the current governed ZIP index reaches none of the audited El Paso identities. Nearby incorporated places remain independent, but no repository-governed sub-city projection substrate exists. |
| Corpus Christi | `NO_REGIONALIZATION_NEEDED` | `EXISTING_RUNTIME_ALREADY_SUFFICIENT` | P3 | No | Citywide Corpus Christi plus independently governed nearby places is proportionate to current evidence; ZIP records do not establish governed sub-city consumer labels. |
| Laredo | `NO_REGIONALIZATION_NEEDED` | `EXISTING_RUNTIME_ALREADY_SUFFICIENT` | P3 | No | The city and nearby CDPs are independently governed; current ZIP evidence does not itself govern meaningful Laredo subdivisions. |
| Rio Grande Valley | `ADEQUATE_EXISTING_CONSUMER_GEOGRAPHY` | `MULTI_CITY_INDEPENDENT_PLACE_MODEL` | P3 | No | The cluster already exposes multiple recognizable governed cities. A broad RGV identity would add little and could erase city/county context. |
| Beaumont–Port Arthur | `ADEQUATE_EXISTING_CONSUMER_GEOGRAPHY` | `EXISTING_RUNTIME_ALREADY_SUFFICIENT` | P3 | No | Beaumont, Port Arthur, and adjacent communities are independently governed and consumer eligible; subdivision is not demonstrated as necessary. |
| Killeen–Temple | `ADEQUATE_EXISTING_CONSUMER_GEOGRAPHY` | `MULTI_CITY_INDEPENDENT_PLACE_MODEL` | P3 | No | Killeen, Temple, Belton, and nearby cities already retain useful independent PLACE identity; collapsing them would reduce granularity. |

**Recommended next milestone:** `LP196_DFW_INDEPENDENT_CITY_CONSUMER_MODEL_DESIGN`. It should remain design-only until the owner chooses whether Dallas and Fort Worth need separate presentation-region work.
