# LP196 — Canonical multi-county PLACE identity resolution

## Determination

The statewide town resolver previously treated every exact-label awareness-area match as a distinct consumer outcome. Because awareness records are county-scoped, a single Census PLACE repeated in each governed member county reached the unconditional multiple-candidate branch and was classified `AMBIGUOUS`.

LP196 now collapses a **town** result only when every candidate has one normalized consumer label, one PLACE GEOID, canonical identity `PLACE_GEOID`, an identical governed county-membership set, and a candidate county FIPS contained in that set. Existing governed Houston or San Antonio consumer-region parents are excluded. The result is `RESOLVED_CANONICAL_MULTI_COUNTY_PLACE`, has no invented primary county, and persists the PLACE GEOID plus all governed memberships. ZIP resolution is excluded from this rule. Any GEOID, identity, label, or membership conflict remains `AMBIGUOUS`. `INDEPENDENT_GOVERNED_PLACE_WINS` remains unchanged.

## Statewide inventory

Deterministic inventory: **163** same-GEOID multi-county candidate groups. Before: `AMBIGUOUS` for an exact town query with all county records present. After: `RESOLVED_CANONICAL_MULTI_COUNTY_PLACE` when all fail-closed predicates pass, except existing governed consumer-region parents retain their prior regional contract. Memberships are governed county FIPS; awareness records are listed to prove county-scoped duplication.

| PLACE GEOID | Consumer PLACE | Governed county memberships | County-scoped awareness records |
|---|---|---|---|
| 4800160 | Abernathy | 48189, 48303 | hale-tx, lubbock-tx |
| 4801000 | Abilene | 48253, 48441 | jones-tx, taylor-tx |
| 4801108 | Ackerly | 48115, 48317 | dawson-tx, martin-tx |
| 4801636 | Alba | 48379, 48499 | rains-tx, wood-tx |
| 4803000 | Amarillo | 48375, 48381 | potter-tx, randall-tx |
| 4803600 | Aransas Pass | 48007, 48355, 48409 | aransas-tx, nueces-tx, san-patricio-tx |
| 4805000 | Austin | 48021, 48209, 48453, 48491 | bastrop-tx, hays-tx, travis-tx, williamson-tx |
| 4805168 | Azle | 48367, 48439 | parker-tx, tarrant-tx |
| 4805732 | Bartlett | 48027, 48491 | bell-tx, williamson-tx |
| 4806128 | Baytown | 48071, 48201 | chambers-tx, harris-tx |
| 4808240 | Big Thicket Lake Estates | 48291, 48373 | liberty-tx, polk-tx |
| 4808488 | Blackwell | 48081, 48353 | coke-tx, nolan-tx |
| 4809448 | Booker | 48295, 48357 | lipscomb-tx, ochiltree-tx |
| 4810192 | Briar | 48367, 48439, 48497 | parker-tx, tarrant-tx, wise-tx |
| 4810828 | Bruceville-Eddy | 48145, 48309 | falls-tx, mclennan-tx |
| 4811212 | Bullard | 48073, 48423 | cherokee-tx, smith-tx |
| 4811428 | Burleson | 48251, 48439 | johnson-tx, tarrant-tx |
| 4811572 | Bushland | 48375, 48381 | potter-tx, randall-tx |
| 4813024 | Carrollton | 48085, 48113, 48121 | collin-tx, dallas-tx, denton-tx |
| 4813492 | Cedar Hill | 48113, 48139 | dallas-tx, ellis-tx |
| 4813552 | Cedar Park | 48453, 48491 | travis-tx, williamson-tx |
| 4813684 | Celina | 48085, 48121 | collin-tx, denton-tx |
| 4814920 | Cibolo | 48029, 48187 | bexar-tx, guadalupe-tx |
| 4814929 | Cinco Ranch | 48157, 48201 | fort-bend-tx, harris-tx |
| 4815172 | Clarksville City | 48183, 48459 | gregg-tx, upshur-tx |
| 4815436 | Cleveland | 48291, 48339, 48407 | liberty-tx, montgomery-tx, san-jacinto-tx |
| 4816216 | Combine | 48113, 48257 | dallas-tx, kaufman-tx |
| 4816612 | Coppell | 48113, 48121 | dallas-tx, denton-tx |
| 4816624 | Copperas Cove | 48027, 48099, 48281 | bell-tx, coryell-tx, lampasas-tx |
| 4817000 | Corpus Christi | 48007, 48273, 48355, 48409 | aransas-tx, kleberg-tx, nueces-tx, san-patricio-tx |
| 4817612 | Creedmoor | 48209, 48453 | hays-tx, travis-tx |
| 4817648 | Cresson | 48221, 48251, 48367 | hood-tx, johnson-tx, parker-tx |
| 4817960 | Crowley | 48251, 48439 | johnson-tx, tarrant-tx |
| 4818524 | Dalhart | 48111, 48205 | dallam-tx, hartley-tx |
| 4819000 | Dallas | 48085, 48113, 48121, 48257, 48397 | collin-tx, dallas-tx, denton-tx, kaufman-tx, rockwall-tx |
| 4819984 | Denver City | 48165, 48501 | gaines-tx, yoakum-tx |
| 4820020 | Deport | 48277, 48387 | lamar-tx, red-river-tx |
| 4822168 | East Mountain | 48183, 48459 | gregg-tx, upshur-tx |
| 4822192 | Easton | 48183, 48401 | gregg-tx, rusk-tx |
| 4823044 | Elgin | 48021, 48453 | bastrop-tx, travis-tx |
| 4823272 | Elmendorf | 48029, 48493 | bexar-tx, wilson-tx |
| 4824864 | Evant | 48099, 48193 | coryell-tx, hamilton-tx |
| 4825168 | Fair Oaks Ranch | 48029, 48091, 48259 | bexar-tx, comal-tx, kendall-tx |
| 4825752 | Ferris | 48113, 48139 | dallas-tx, ellis-tx |
| 4826232 | Flower Mound | 48121, 48439 | denton-tx, tarrant-tx |
| 4826666 | Fort Cavazos | 48027, 48099 | bell-tx, coryell-tx |
| 4827000 | Fort Worth | 48121, 48251, 48367, 48439, 48497 | denton-tx, johnson-tx, parker-tx, tarrant-tx, wise-tx |
| 4827300 | Frankston | 48001, 48213 | anderson-tx, henderson-tx |
| 4827648 | Friendswood | 48167, 48201 | galveston-tx, harris-tx |
| 4827684 | Frisco | 48085, 48121 | collin-tx, denton-tx |
| 4827696 | Fritch | 48233, 48341 | hutchinson-tx, moore-tx |
| 4829000 | Garland | 48085, 48113 | collin-tx, dallas-tx |
| 4829660 | Gladewater | 48183, 48459 | gregg-tx, upshur-tx |
| 4829840 | Glenn Heights | 48113, 48139 | dallas-tx, ellis-tx |
| 4830092 | Golinda | 48145, 48309 | falls-tx, mclennan-tx |
| 4830464 | Grand Prairie | 48113, 48139, 48251, 48439 | dallas-tx, ellis-tx, johnson-tx, tarrant-tx |
| 4830644 | Grapevine | 48113, 48121, 48439 | dallas-tx, denton-tx, tarrant-tx |
| 4831964 | Hamlin | 48151, 48253 | fisher-tx, jones-tx |
| 4832156 | Happy | 48381, 48437 | randall-tx, swisher-tx |
| 4832720 | Haslet | 48121, 48439 | denton-tx, tarrant-tx |
| 4832984 | Heath | 48257, 48397 | kaufman-tx, rockwall-tx |
| 4833020 | Hebron | 48085, 48121 | collin-tx, denton-tx |
| 4833548 | Hico | 48143, 48193 | erath-tx, hamilton-tx |
| 4834862 | Horseshoe Bay | 48053, 48299 | burnet-tx, llano-tx |
| 4835000 | Houston | 48157, 48201, 48339, 48473 | fort-bend-tx, harris-tx, montgomery-tx, waller-tx |
| 4835300 | Hughes Springs | 48067, 48343 | cass-tx, morris-tx |
| 4836008 | Ingleside | 48355, 48409 | nueces-tx, san-patricio-tx |
| 4838068 | Josephine | 48085, 48231 | collin-tx, hunt-tx |
| 4838476 | Katy | 48157, 48201, 48473 | fort-bend-tx, harris-tx, waller-tx |
| 4839124 | Kilgore | 48183, 48401 | gregg-tx, rusk-tx |
| 4840468 | Lake Cherokee | 48183, 48401 | gregg-tx, rusk-tx |
| 4840674 | Lake Medina Shores | 48019, 48325 | bandera-tx, medina-tx |
| 4841980 | League City | 48167, 48201 | galveston-tx, harris-tx |
| 4842016 | Leander | 48453, 48491 | travis-tx, williamson-tx |
| 4842508 | Lewisville | 48113, 48121 | dallas-tx, denton-tx |
| 4843888 | Longview | 48183, 48203 | gregg-tx, harrison-tx |
| 4845048 | Lueders | 48253, 48417 | jones-tx, shackelford-tx |
| 4845096 | Luling | 48055, 48187 | caldwell-tx, guadalupe-tx |
| 4845288 | Lytle | 48013, 48029, 48325 | atascosa-tx, bexar-tx, medina-tx |
| 4845324 | Mabank | 48213, 48257, 48467 | henderson-tx, kaufman-tx, van-zandt-tx |
| 4845672 | McGregor | 48099, 48309 | coryell-tx, mclennan-tx |
| 4845804 | McLendon-Chisholm | 48257, 48397 | kaufman-tx, rockwall-tx |
| 4846452 | Mansfield | 48139, 48251, 48439 | ellis-tx, johnson-tx, tarrant-tx |
| 4846824 | Mart | 48293, 48309 | limestone-tx, mclennan-tx |
| 4847892 | Mesquite | 48113, 48257 | dallas-tx, kaufman-tx |
| 4848072 | Midland | 48317, 48329 | martin-tx, midland-tx |
| 4848684 | Mineral Wells | 48363, 48367 | palo-pinto-tx, parker-tx |
| 4848772 | Mission Bend | 48157, 48201 | fort-bend-tx, harris-tx |
| 4848804 | Missouri City | 48157, 48201 | fort-bend-tx, harris-tx |
| 4848936 | Monahans | 48475, 48495 | ward-tx, winkler-tx |
| 4849068 | Mont Belvieu | 48071, 48291 | chambers-tx, liberty-tx |
| 4849380 | Morgan's Point | 48071, 48201 | chambers-tx, harris-tx |
| 4850200 | Mustang Ridge | 48021, 48055, 48453 | bastrop-tx, caldwell-tx, travis-tx |
| 4850472 | Navasota | 48041, 48185 | brazos-tx, grimes-tx |
| 4850772 | Newark | 48439, 48497 | tarrant-tx, wise-tx |
| 4850820 | New Braunfels | 48091, 48187 | comal-tx, guadalupe-tx |
| 4850920 | New Fairview | 48121, 48497 | denton-tx, wise-tx |
| 4851492 | Niederwald | 48055, 48209 | caldwell-tx, hays-tx |
| 4851588 | Nixon | 48177, 48493 | gonzales-tx, wilson-tx |
| 4851840 | Normangee | 48289, 48313 | leon-tx, madison-tx |
| 4853232 | Oakwood | 48161, 48289 | freestone-tx, leon-tx |
| 4853388 | Odessa | 48135, 48329 | ector-tx, midland-tx |
| 4853436 | O'Donnell | 48115, 48305 | dawson-tx, lynn-tx |
| 4853824 | Old River-Winfree | 48071, 48291 | chambers-tx, liberty-tx |
| 4854432 | Overton | 48401, 48423 | rusk-tx, smith-tx |
| 4854444 | Ovilla | 48113, 48139 | dallas-tx, ellis-tx |
| 4856348 | Pearland | 48039, 48157, 48201 | brazoria-tx, fort-bend-tx, harris-tx |
| 4856462 | Pecan Acres | 48439, 48497 | tarrant-tx, wise-tx |
| 4856468 | Pecan Gap | 48119, 48147 | delta-tx, fannin-tx |
| 4856498 | Pecan Plantation | 48221, 48251 | hood-tx, johnson-tx |
| 4857176 | Pflugerville | 48453, 48491 | travis-tx, williamson-tx |
| 4857476 | Pilot Point | 48097, 48121, 48181 | cooke-tx, denton-tx, grayson-tx |
| 4858016 | Plano | 48085, 48121 | collin-tx, denton-tx |
| 4858502 | Poetry | 48231, 48257 | hunt-tx, kaufman-tx |
| 4858820 | Port Arthur | 48245, 48361 | jefferson-tx, orange-tx |
| 4858904 | Portland | 48355, 48409 | nueces-tx, san-patricio-tx |
| 4859696 | Prosper | 48085, 48121 | collin-tx, denton-tx |
| 4861508 | Reklaw | 48073, 48401 | cherokee-tx, rusk-tx |
| 4861604 | Reno | 48367, 48439 | parker-tx, tarrant-tx |
| 4861796 | Richardson | 48085, 48113 | collin-tx, dallas-tx |
| 4862504 | Roanoke | 48121, 48439 | denton-tx, tarrant-tx |
| 4863500 | Round Rock | 48453, 48491 | travis-tx, williamson-tx |
| 4863572 | Rowlett | 48113, 48397 | dallas-tx, rockwall-tx |
| 4863668 | Royse City | 48085, 48231, 48397 | collin-tx, hunt-tx, rockwall-tx |
| 4864064 | Sachse | 48085, 48113 | collin-tx, dallas-tx |
| 4865000 | San Antonio | 48029, 48091, 48325 | bexar-tx, comal-tx, medina-tx |
| 4865180 | San Diego | 48131, 48249 | duval-tx, jim-wells-tx |
| 4865408 | Sanger | 48097, 48121 | cooke-tx, denton-tx |
| 4865600 | San Marcos | 48055, 48187, 48209 | caldwell-tx, guadalupe-tx, hays-tx |
| 4866128 | Schertz | 48029, 48091, 48187 | bexar-tx, comal-tx, guadalupe-tx |
| 4866392 | Seabrook | 48071, 48201 | chambers-tx, harris-tx |
| 4866428 | Seagoville | 48113, 48257 | dallas-tx, kaufman-tx |
| 4866704 | Selma | 48029, 48091, 48187 | bexar-tx, comal-tx, guadalupe-tx |
| 4866908 | Seven Points | 48213, 48257 | henderson-tx, kaufman-tx |
| 4867688 | Shoreacres | 48071, 48201 | chambers-tx, harris-tx |
| 4869032 | Southlake | 48121, 48439 | denton-tx, tarrant-tx |
| 4869800 | Springtown | 48367, 48497 | parker-tx, wise-tx |
| 4869908 | Stafford | 48157, 48201 | fort-bend-tx, harris-tx |
| 4869980 | Stamford | 48207, 48253 | haskell-tx, jones-tx |
| 4870604 | Streetman | 48161, 48349 | freestone-tx, navarro-tx |
| 4871924 | Tatum | 48365, 48401 | panola-tx, rusk-tx |
| 4872392 | Texas City | 48071, 48167 | chambers-tx, galveston-tx |
| 4872656 | The Woodlands | 48201, 48339 | harris-tx, montgomery-tx |
| 4872776 | Thorndale | 48331, 48491 | milam-tx, williamson-tx |
| 4873316 | Tomball | 48201, 48339 | harris-tx, montgomery-tx |
| 4873592 | Trenton | 48085, 48147, 48181 | collin-tx, fannin-tx, grayson-tx |
| 4873710 | Trophy Club | 48121, 48439 | denton-tx, tarrant-tx |
| 4873724 | Troup | 48073, 48423 | cherokee-tx, smith-tx |
| 4874216 | Uhland | 48055, 48209 | caldwell-tx, hays-tx |
| 4874408 | Universal City | 48029, 48187 | bexar-tx, guadalupe-tx |
| 4874732 | Valley Mills | 48035, 48309 | bosque-tx, mclennan-tx |
| 4874924 | Van Alstyne | 48085, 48181 | collin-tx, grayson-tx |
| 4875236 | Venus | 48139, 48251 | ellis-tx, johnson-tx |
| 4876228 | Waller | 48201, 48473 | harris-tx, waller-tx |
| 4876576 | Warren City | 48183, 48459 | gregg-tx, upshur-tx |
| 4877620 | Westlake | 48121, 48439 | denton-tx, tarrant-tx |
| 4878628 | Whitewright | 48147, 48181 | fannin-tx, grayson-tx |
| 4879000 | Wichita Falls | 48077, 48485 | clay-tx, wichita-tx |
| 4879204 | Wildwood | 48199, 48457 | hardin-tx, tyler-tx |
| 4879696 | Windthorst | 48009, 48077 | archer-tx, clay-tx |
| 4879816 | Winnsboro | 48159, 48499 | franklin-tx, wood-tx |
| 4880356 | Wylie | 48085, 48113, 48397 | collin-tx, dallas-tx, rockwall-tx |
| 4880560 | Yoakum | 48123, 48285 | dewitt-tx, lavaca-tx |

## Controls

- Dallas (4819000): five records become one canonical PLACE with memberships 48085, 48113, 48121, 48257, 48397; no Collin default.
- Fort Worth (4827000): five records become one canonical PLACE with memberships 48121, 48251, 48367, 48439, 48497; no Johnson default.
- Austin (4805000): four records become one canonical PLACE with memberships 48021, 48209, 48453, 48491; no Bastrop default.
- El Paso (4824000): one record, so existing `RESOLVED_OPERATIONAL` behavior remains.
- Houston and San Antonio governed regional behavior, semantic PLACE camera data, ZIP mappings, geometry, and independent PLACE precedence were not modified.
- True-ambiguity fixtures prove that differing PLACE GEOIDs, canonical identities, canonical labels, or membership reconciliation fail closed.
