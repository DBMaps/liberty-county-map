# Texas Metro Regionalization Candidate Audit

Audit only. No production or regionalization implementation is authorized.

## Governance

- auditOnly: **true**
- productionChangeAuthorized: **false**
- regionalizationImplementationAuthorized: **false**

## Houston reference model

Houston is the excluded control with 15 child regions: Downtown / Midtown, Heights / Near Northside, Montrose / Museum District, Medical Center / Rice, Uptown / Galleria, Memorial, Spring Branch, Energy Corridor, Westchase / West Houston, Northwest Houston, North Houston / Greenspoint, Northeast Houston, East End, Southeast Houston / Hobby, Southwest Houston.

## Candidate selection algorithm

- areaBand = 100_plus_square_miles
- multiCounty = true
- multipart = true and area >= 10 square miles
- member of statewide top-25 candidate disagreement
- computed bounds sprawl = extreme

## Candidate table

| GEOID | PLACE | Area miÂ² | Parts | Multi-county | Long axis mi | Classification |
|---|---|---:|---:|---|---:|---|
| 4800160 | Abernathy | 3.205 | 1 | true | 7.318 | REVIEW |
| 4801000 | Abilene | 112.097 | 1 | true | 19.402 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4801108 | Ackerly | 0.311 | 1 | true | 0.744 | NO_CHANGE_NEEDED |
| 4801636 | Alba | 1.059 | 1 | true | 1.185 | NO_CHANGE_NEEDED |
| 4802272 | Alvin | 23.805 | 6 | false | 31.82 | REVIEW |
| 4803000 | Amarillo | 108.045 | 1 | true | 17.517 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4803264 | Angleton | 11.741 | 3 | false | 9.387 | NO_CHANGE_NEEDED |
| 4803300 | Anna | 18.016 | 6 | false | 12.056 | NO_CHANGE_NEEDED |
| 4803600 | Aransas Pass | 52.986 | 1 | true | 8.793 | NO_CHANGE_NEEDED |
| 4804000 | Arlington | 99.389 | 1 | false | 15.886 | NO_CHANGE_NEEDED |
| 4804462 | Atascocita | 24.027 | 3 | false | 6.856 | NO_CHANGE_NEEDED |
| 4804504 | Athens | 20.212 | 2 | false | 11.793 | NO_CHANGE_NEEDED |
| 4805000 | Austin | 331.57 | 14 | true | 30.434 | REVIEW |
| 4805168 | Azle | 8.819 | 1 | true | 6.895 | NO_CHANGE_NEEDED |
| 4805732 | Bartlett | 1.251 | 1 | true | 1.641 | NO_CHANGE_NEEDED |
| 4805864 | Bastrop | 10.017 | 4 | false | 7.949 | NO_CHANGE_NEEDED |
| 4806128 | Baytown | 41.32 | 18 | true | 13.546 | NO_CHANGE_NEEDED |
| 4808240 | Big Thicket Lake Estates | 2.523 | 1 | true | 2.04 | NO_CHANGE_NEEDED |
| 4808488 | Blackwell | 0.591 | 1 | true | 1.128 | NO_CHANGE_NEEDED |
| 4808872 | Blue Ridge | 1.26 | 2 | false | 9.144 | NO_CHANGE_NEEDED |
| 4809160 | Boerne | 12.057 | 2 | false | 7.214 | NO_CHANGE_NEEDED |
| 4809448 | Booker | 1.053 | 1 | true | 1.473 | NO_CHANGE_NEEDED |
| 4809916 | Brady | 11.439 | 1 | false | 7.808 | REVIEW |
| 4810192 | Briar | 21.939 | 2 | true | 7.893 | REVIEW |
| 4810768 | Brownsville | 128.428 | 4 | false | 25.925 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4810780 | Brownwood | 14.946 | 2 | false | 10.293 | NO_CHANGE_NEEDED |
| 4810828 | Bruceville-Eddy | 4.13 | 2 | true | 5.127 | NO_CHANGE_NEEDED |
| 4810912 | Bryan | 55.823 | 2 | false | 16.177 | NO_CHANGE_NEEDED |
| 4811212 | Bullard | 4.36 | 1 | true | 3.788 | NO_CHANGE_NEEDED |
| 4811224 | Bulverde | 15.826 | 2 | false | 12.924 | NO_CHANGE_NEEDED |
| 4811428 | Burleson | 29.384 | 7 | true | 10.659 | NO_CHANGE_NEEDED |
| 4811572 | Bushland | 5.976 | 1 | true | 3.47 | NO_CHANGE_NEEDED |
| 4812580 | Canyon Lake | 156.143 | 1 | false | 18.197 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4813024 | Carrollton | 37.383 | 2 | true | 9.467 | NO_CHANGE_NEEDED |
| 4813492 | Cedar Hill | 35.881 | 2 | true | 7.593 | NO_CHANGE_NEEDED |
| 4813552 | Cedar Park | 25.772 | 2 | true | 8.531 | NO_CHANGE_NEEDED |
| 4813684 | Celina | 49.544 | 16 | true | 10.602 | NO_CHANGE_NEEDED |
| 4814920 | Cibolo | 21.111 | 10 | true | 10.633 | NO_CHANGE_NEEDED |
| 4814929 | Cinco Ranch | 4.637 | 6 | true | 3.556 | NO_CHANGE_NEEDED |
| 4815172 | Clarksville City | 6.531 | 1 | true | 4.963 | NO_CHANGE_NEEDED |
| 4815364 | Cleburne | 36.278 | 5 | false | 11.867 | NO_CHANGE_NEEDED |
| 4815436 | Cleveland | 18.812 | 2 | true | 11.907 | NO_CHANGE_NEEDED |
| 4816216 | Combine | 7.576 | 1 | true | 4.641 | REVIEW |
| 4816300 | Concepcion | 0.08 | 1 | false | 0.817 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4816432 | Conroe | 76.579 | 6 | false | 16.59 | NO_CHANGE_NEEDED |
| 4816540 | Cool | 1.651 | 1 | false | 2.786 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4816612 | Coppell | 14.735 | 1 | true | 5.756 | NO_CHANGE_NEEDED |
| 4816624 | Copperas Cove | 18.029 | 1 | true | 9.561 | NO_CHANGE_NEEDED |
| 4817000 | Corpus Christi | 492.902 | 9 | true | 47.14 | REGIONALIZE_LIKE_HOUSTON |
| 4817612 | Creedmoor | 7.615 | 3 | true | 5.494 | NO_CHANGE_NEEDED |
| 4817648 | Cresson | 11.553 | 1 | true | 7.446 | NO_CHANGE_NEEDED |
| 4817960 | Crowley | 7.634 | 1 | true | 3.412 | NO_CHANGE_NEEDED |
| 4818524 | Dalhart | 4.793 | 1 | true | 3.716 | NO_CHANGE_NEEDED |
| 4819000 | Dallas | 383.651 | 3 | true | 31.203 | REVIEW |
| 4819432 | Dayton | 30.7 | 13 | false | 16.671 | REVIEW |
| 4819714 | Del Mar Heights | 0.437 | 1 | false | 1.587 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4819972 | Denton | 98.352 | 11 | false | 16.604 | NO_CHANGE_NEEDED |
| 4819984 | Denver City | 2.609 | 1 | true | 2.168 | NO_CHANGE_NEEDED |
| 4820020 | Deport | 1.112 | 1 | true | 1.684 | NO_CHANGE_NEEDED |
| 4822168 | East Mountain | 2.122 | 1 | true | 4.724 | REVIEW |
| 4822192 | Easton | 2.445 | 1 | true | 1.953 | NO_CHANGE_NEEDED |
| 4822660 | Edinburg | 47.245 | 5 | false | 14.477 | NO_CHANGE_NEEDED |
| 4823044 | Elgin | 7.255 | 4 | true | 5.631 | NO_CHANGE_NEEDED |
| 4823272 | Elmendorf | 6.168 | 1 | true | 4.39 | NO_CHANGE_NEEDED |
| 4824000 | El Paso | 259.357 | 1 | false | 26.162 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4824348 | Ennis | 33.223 | 7 | false | 18.335 | NO_CHANGE_NEEDED |
| 4824864 | Evant | 0.609 | 1 | true | 1.163 | NO_CHANGE_NEEDED |
| 4825168 | Fair Oaks Ranch | 12.286 | 1 | true | 4.945 | NO_CHANGE_NEEDED |
| 4825572 | Fate | 12.351 | 14 | false | 4.924 | NO_CHANGE_NEEDED |
| 4825752 | Ferris | 4.791 | 1 | true | 4.543 | NO_CHANGE_NEEDED |
| 4826232 | Flower Mound | 44.46 | 2 | true | 11.994 | NO_CHANGE_NEEDED |
| 4826664 | Fort Bliss | 17.898 | 2 | false | 7.846 | NO_CHANGE_NEEDED |
| 4826666 | Fort Cavazos | 19.46 | 1 | true | 9.065 | NO_CHANGE_NEEDED |
| 4827000 | Fort Worth | 360.193 | 2 | true | 34.402 | REVIEW |
| 4827300 | Frankston | 2.485 | 1 | true | 2.263 | NO_CHANGE_NEEDED |
| 4827648 | Friendswood | 20.715 | 1 | true | 8.211 | NO_CHANGE_NEEDED |
| 4827684 | Frisco | 69.165 | 1 | true | 11.008 | NO_CHANGE_NEEDED |
| 4827696 | Fritch | 1.622 | 1 | true | 2.963 | NO_CHANGE_NEEDED |
| 4828068 | Galveston | 211.308 | 1 | false | 29.904 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4829000 | Garland | 56.972 | 1 | true | 10.729 | NO_CHANGE_NEEDED |
| 4829336 | Georgetown | 61.242 | 2 | false | 14.73 | NO_CHANGE_NEEDED |
| 4829660 | Gladewater | 12.093 | 1 | true | 4.948 | NO_CHANGE_NEEDED |
| 4829840 | Glenn Heights | 7.275 | 1 | true | 4.019 | NO_CHANGE_NEEDED |
| 4830092 | Golinda | 4.209 | 1 | true | 2.186 | NO_CHANGE_NEEDED |
| 4830416 | Granbury | 18.014 | 7 | false | 8.868 | REVIEW |
| 4830464 | Grand Prairie | 85.449 | 1 | true | 25.134 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4830644 | Grapevine | 35.844 | 1 | true | 7.957 | NO_CHANGE_NEEDED |
| 4831616 | Gunter | 19.546 | 2 | false | 8.654 | REVIEW |
| 4831964 | Hamlin | 5.298 | 1 | true | 3.452 | NO_CHANGE_NEEDED |
| 4832156 | Happy | 1.061 | 1 | true | 1.075 | NO_CHANGE_NEEDED |
| 4832372 | Harlingen | 40.834 | 4 | false | 15.36 | NO_CHANGE_NEEDED |
| 4832456 | Harper | 56.653 | 1 | false | 13.278 | NO_CHANGE_NEEDED |
| 4832720 | Haslet | 9.005 | 1 | true | 5.15 | NO_CHANGE_NEEDED |
| 4832984 | Heath | 12.533 | 4 | true | 4.91 | NO_CHANGE_NEEDED |
| 4833020 | Hebron | 0.269 | 10 | true | 6.273 | REVIEW |
| 4833548 | Hico | 1.825 | 1 | true | 2.167 | NO_CHANGE_NEEDED |
| 4834088 | Hillsboro | 11.086 | 2 | false | 7.772 | NO_CHANGE_NEEDED |
| 4834862 | Horseshoe Bay | 16.587 | 1 | true | 6.667 | NO_CHANGE_NEEDED |
| 4835300 | Hughes Springs | 2.493 | 1 | true | 3.518 | NO_CHANGE_NEEDED |
| 4835528 | Huntsville | 42.61 | 2 | false | 11.726 | NO_CHANGE_NEEDED |
| 4835624 | Hutto | 14.98 | 6 | false | 7.17 | NO_CHANGE_NEEDED |
| 4835636 | Huxley | 2.081 | 1 | false | 6.878 | REVIEW |
| 4836008 | Ingleside | 16.891 | 1 | true | 6.337 | NO_CHANGE_NEEDED |
| 4836092 | Iowa Colony | 11.006 | 3 | false | 7.226 | NO_CHANGE_NEEDED |
| 4838068 | Josephine | 2.342 | 2 | true | 4.38 | NO_CHANGE_NEEDED |
| 4838476 | Katy | 15.308 | 1 | true | 7.459 | NO_CHANGE_NEEDED |
| 4839124 | Kilgore | 18.648 | 1 | true | 7.3 | NO_CHANGE_NEEDED |
| 4839148 | Killeen | 55.273 | 6 | false | 13.723 | NO_CHANGE_NEEDED |
| 4839952 | Kyle | 32.638 | 6 | false | 10.26 | NO_CHANGE_NEEDED |
| 4840100 | La Coma | 1.22 | 1 | false | 2.346 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4840264 | Lago Vista | 15.549 | 3 | false | 7.458 | NO_CHANGE_NEEDED |
| 4840468 | Lake Cherokee | 16.519 | 1 | true | 7.671 | NO_CHANGE_NEEDED |
| 4840674 | Lake Medina Shores | 3.389 | 1 | true | 2.608 | NO_CHANGE_NEEDED |
| 4841440 | La Porte | 19.902 | 2 | false | 7.262 | NO_CHANGE_NEEDED |
| 4841449 | La Presa | 0.505 | 1 | false | 2.29 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4841464 | Laredo | 110.543 | 1 | false | 26.082 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4841475 | Laredo Ranchettes West | 0.073 | 1 | false | 0.699 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4841980 | League City | 53.13 | 1 | true | 13.688 | NO_CHANGE_NEEDED |
| 4842016 | Leander | 39.002 | 9 | true | 10.584 | NO_CHANGE_NEEDED |
| 4842508 | Lewisville | 46.895 | 4 | true | 10.436 | NO_CHANGE_NEEDED |
| 4842568 | Liberty | 45.771 | 6 | false | 14.372 | NO_CHANGE_NEEDED |
| 4843888 | Longview | 56.327 | 1 | true | 11.761 | NO_CHANGE_NEEDED |
| 4844038 | Los Altos | 0.038 | 1 | false | 0.676 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4844167 | Los Veteranos I | 0.394 | 1 | false | 1.807 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4845000 | Lubbock | 144.5 | 2 | false | 18.037 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4845048 | Lueders | 0.59 | 1 | true | 1.292 | NO_CHANGE_NEEDED |
| 4845072 | Lufkin | 34.481 | 2 | false | 9.203 | NO_CHANGE_NEEDED |
| 4845096 | Luling | 5.626 | 1 | true | 6.649 | NO_CHANGE_NEEDED |
| 4845288 | Lytle | 4.97 | 1 | true | 3.43 | NO_CHANGE_NEEDED |
| 4845324 | Mabank | 8.804 | 1 | true | 7.119 | NO_CHANGE_NEEDED |
| 4845384 | McAllen | 62.746 | 2 | false | 25.168 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4845672 | McGregor | 23.111 | 1 | true | 12.361 | NO_CHANGE_NEEDED |
| 4845744 | McKinney | 69.423 | 6 | false | 13.261 | NO_CHANGE_NEEDED |
| 4845804 | McLendon-Chisholm | 12.885 | 1 | true | 5.748 | NO_CHANGE_NEEDED |
| 4846440 | Manor | 9.827 | 2 | false | 7.163 | REVIEW |
| 4846452 | Mansfield | 36.835 | 1 | true | 8.182 | NO_CHANGE_NEEDED |
| 4846500 | Manvel | 27.341 | 5 | false | 8.005 | NO_CHANGE_NEEDED |
| 4846824 | Mart | 1.377 | 1 | true | 2.042 | NO_CHANGE_NEEDED |
| 4847496 | Melissa | 11.526 | 2 | false | 6.811 | NO_CHANGE_NEEDED |
| 4847700 | Mercedes | 11.863 | 2 | false | 5.499 | NO_CHANGE_NEEDED |
| 4847892 | Mesquite | 49.293 | 1 | true | 15.68 | NO_CHANGE_NEEDED |
| 4848072 | Midland | 76.359 | 1 | true | 14.797 | NO_CHANGE_NEEDED |
| 4848096 | Midlothian | 64.45 | 5 | false | 10.739 | NO_CHANGE_NEEDED |
| 4848684 | Mineral Wells | 21.156 | 1 | true | 8.553 | NO_CHANGE_NEEDED |
| 4848772 | Mission Bend | 4.785 | 2 | true | 2.65 | NO_CHANGE_NEEDED |
| 4848804 | Missouri City | 30.403 | 1 | true | 12.642 | NO_CHANGE_NEEDED |
| 4848936 | Monahans | 28.932 | 2 | true | 17.981 | REVIEW |
| 4849068 | Mont Belvieu | 18.13 | 1 | true | 7.891 | NO_CHANGE_NEEDED |
| 4849380 | Morgan's Point | 1.52 | 4 | true | 2.143 | NO_CHANGE_NEEDED |
| 4849440 | Morse | 0.551 | 1 | false | 1.806 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4850200 | Mustang Ridge | 3.729 | 1 | true | 5.701 | REVIEW |
| 4850256 | Nacogdoches | 27.66 | 2 | false | 8.19 | NO_CHANGE_NEEDED |
| 4850472 | Navasota | 8.522 | 1 | true | 5.35 | NO_CHANGE_NEEDED |
| 4850772 | Newark | 0.895 | 1 | true | 3.355 | REVIEW |
| 4850820 | New Braunfels | 45.499 | 2 | true | 13.243 | NO_CHANGE_NEEDED |
| 4850920 | New Fairview | 18.904 | 2 | true | 8.481 | NO_CHANGE_NEEDED |
| 4851492 | Niederwald | 3.667 | 3 | true | 5.396 | REVIEW |
| 4851588 | Nixon | 1.568 | 1 | true | 2.38 | NO_CHANGE_NEEDED |
| 4851840 | Normangee | 1.116 | 1 | true | 1.44 | NO_CHANGE_NEEDED |
| 4853232 | Oakwood | 1.131 | 1 | true | 1.682 | NO_CHANGE_NEEDED |
| 4853388 | Odessa | 52.36 | 2 | true | 12.78 | NO_CHANGE_NEEDED |
| 4853436 | O'Donnell | 0.86 | 1 | true | 1.104 | NO_CHANGE_NEEDED |
| 4853824 | Old River-Winfree | 1.566 | 1 | true | 3.562 | NO_CHANGE_NEEDED |
| 4854132 | Orange | 23.436 | 3 | false | 11.984 | NO_CHANGE_NEEDED |
| 4854432 | Overton | 6.749 | 1 | true | 3.05 | NO_CHANGE_NEEDED |
| 4854444 | Ovilla | 5.789 | 1 | true | 3.893 | NO_CHANGE_NEEDED |
| 4855080 | Paris | 37.066 | 2 | false | 11.082 | NO_CHANGE_NEEDED |
| 4856000 | Pasadena | 44.751 | 4 | false | 15.145 | NO_CHANGE_NEEDED |
| 4856348 | Pearland | 49.372 | 3 | true | 14.168 | NO_CHANGE_NEEDED |
| 4856462 | Pecan Acres | 20.741 | 1 | true | 6.986 | NO_CHANGE_NEEDED |
| 4856468 | Pecan Gap | 0.634 | 1 | true | 1.557 | NO_CHANGE_NEEDED |
| 4856498 | Pecan Plantation | 7.643 | 1 | true | 6.291 | NO_CHANGE_NEEDED |
| 4857176 | Pflugerville | 26.237 | 7 | true | 9.876 | NO_CHANGE_NEEDED |
| 4857200 | Pharr | 24.452 | 4 | false | 12.922 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4857476 | Pilot Point | 7.933 | 5 | true | 9.581 | REVIEW |
| 4858016 | Plano | 72.052 | 1 | true | 14.323 | NO_CHANGE_NEEDED |
| 4858502 | Poetry | 4.063 | 1 | true | 6.36 | REVIEW |
| 4858820 | Port Arthur | 122.747 | 1 | true | 24.495 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4858904 | Portland | 15.178 | 28 | true | 8.983 | NO_CHANGE_NEEDED |
| 4859576 | Princeton | 14.475 | 3 | false | 9.765 | NO_CHANGE_NEEDED |
| 4859696 | Prosper | 25.421 | 1 | true | 9.579 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4860098 | Quesada | 0.009 | 1 | false | 0.396 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4860480 | Ranchitos East | 0.061 | 1 | false | 0.71 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4861196 | Red Oak | 16.242 | 8 | false | 7.555 | REVIEW |
| 4861508 | Reklaw | 2.947 | 1 | true | 3.006 | NO_CHANGE_NEEDED |
| 4861604 | Reno | 13.197 | 1 | true | 4.742 | NO_CHANGE_NEEDED |
| 4861796 | Richardson | 28.653 | 1 | true | 9.049 | NO_CHANGE_NEEDED |
| 4862138 | Rio Bravo | 0.666 | 1 | false | 2.715 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4862504 | Roanoke | 6.954 | 1 | true | 3.853 | NO_CHANGE_NEEDED |
| 4862828 | Rockwall | 30.085 | 4 | false | 8.776 | NO_CHANGE_NEEDED |
| 4863284 | Rosenberg | 37.796 | 2 | false | 16.524 | NO_CHANGE_NEEDED |
| 4863500 | Round Rock | 38.97 | 1 | true | 11.845 | NO_CHANGE_NEEDED |
| 4863572 | Rowlett | 20.819 | 1 | true | 7.531 | NO_CHANGE_NEEDED |
| 4863668 | Royse City | 21.413 | 2 | true | 7.405 | NO_CHANGE_NEEDED |
| 4864064 | Sachse | 9.845 | 1 | true | 4.407 | NO_CHANGE_NEEDED |
| 4865000 | San Antonio | 504.714 | 9 | true | 37.659 | REGIONALIZE_LIKE_HOUSTON |
| 4865036 | San Benito | 16.145 | 2 | false | 8.462 | NO_CHANGE_NEEDED |
| 4865050 | San Carlos II | 0.072 | 1 | false | 0.685 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4865180 | San Diego | 1.901 | 1 | true | 1.904 | NO_CHANGE_NEEDED |
| 4865408 | Sanger | 11.812 | 2 | true | 7.751 | NO_CHANGE_NEEDED |
| 4865600 | San Marcos | 40.555 | 7 | true | 12.705 | NO_CHANGE_NEEDED |
| 4866128 | Schertz | 38.136 | 1 | true | 13.728 | NO_CHANGE_NEEDED |
| 4866392 | Seabrook | 20.776 | 1 | true | 8.453 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4866428 | Seagoville | 19.071 | 1 | true | 8.036 | NO_CHANGE_NEEDED |
| 4866464 | Sealy | 11.867 | 4 | false | 9.872 | NO_CHANGE_NEEDED |
| 4866644 | Seguin | 40.223 | 12 | false | 13.529 | NO_CHANGE_NEEDED |
| 4866704 | Selma | 5.014 | 1 | true | 3.086 | NO_CHANGE_NEEDED |
| 4866908 | Seven Points | 2.755 | 2 | true | 6.702 | REVIEW |
| 4867688 | Shoreacres | 0.962 | 1 | true | 2.286 | REVIEW |
| 4869032 | Southlake | 22.428 | 1 | true | 6.672 | NO_CHANGE_NEEDED |
| 4869104 | Southmayd | 2.823 | 1 | false | 6.48 | REVIEW |
| 4869140 | South Padre Island | 3.736 | 1 | false | 6.777 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4869800 | Springtown | 3.036 | 2 | true | 4.966 | NO_CHANGE_NEEDED |
| 4869908 | Stafford | 7.045 | 2 | true | 4.26 | NO_CHANGE_NEEDED |
| 4869980 | Stamford | 12.916 | 1 | true | 14.841 | REVIEW |
| 4870604 | Streetman | 1.406 | 1 | true | 4.382 | NO_CHANGE_NEEDED |
| 4871924 | Tatum | 3.782 | 1 | true | 2.295 | NO_CHANGE_NEEDED |
| 4872176 | Temple | 79.009 | 7 | false | 15.841 | NO_CHANGE_NEEDED |
| 4872284 | Terrell | 34.393 | 5 | false | 13.535 | NO_CHANGE_NEEDED |
| 4872392 | Texas City | 186.577 | 1 | true | 21.611 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4872656 | The Woodlands | 43.865 | 1 | true | 9.975 | NO_CHANGE_NEEDED |
| 4872776 | Thorndale | 0.966 | 1 | true | 1.643 | NO_CHANGE_NEEDED |
| 4873316 | Tomball | 13.215 | 6 | true | 6.2 | NO_CHANGE_NEEDED |
| 4873592 | Trenton | 1.874 | 3 | true | 7.378 | NO_CHANGE_NEEDED |
| 4873710 | Trophy Club | 4.015 | 1 | true | 2.905 | REVIEW |
| 4873724 | Troup | 2.467 | 1 | true | 2.371 | NO_CHANGE_NEEDED |
| 4874216 | Uhland | 3.824 | 1 | true | 3.869 | NO_CHANGE_NEEDED |
| 4874408 | Universal City | 5.664 | 2 | true | 3.733 | NO_CHANGE_NEEDED |
| 4874732 | Valley Mills | 1.217 | 1 | true | 4.154 | REVIEW |
| 4874756 | Valley View | 2.397 | 1 | false | 8.631 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4874924 | Van Alstyne | 5.553 | 2 | true | 5.338 | NO_CHANGE_NEEDED |
| 4875236 | Venus | 4.798 | 6 | true | 7.36 | REVIEW |
| 4875428 | Victoria | 37.394 | 2 | false | 10.074 | NO_CHANGE_NEEDED |
| 4876000 | Waco | 103.448 | 1 | false | 17.492 | KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM |
| 4876228 | Waller | 6.138 | 4 | true | 4.521 | NO_CHANGE_NEEDED |
| 4876576 | Warren City | 1.75 | 1 | true | 1.961 | NO_CHANGE_NEEDED |
| 4876864 | Weatherford | 31.274 | 2 | false | 17.195 | NO_CHANGE_NEEDED |
| 4877272 | Weslaco | 17.021 | 3 | false | 8.089 | NO_CHANGE_NEEDED |
| 4877620 | Westlake | 7.061 | 1 | true | 4.885 | NO_CHANGE_NEEDED |
| 4877662 | West Livingston | 29.957 | 2 | false | 7.456 | NO_CHANGE_NEEDED |
| 4878628 | Whitewright | 1.836 | 2 | true | 2.643 | NO_CHANGE_NEEDED |
| 4879000 | Wichita Falls | 72.368 | 1 | true | 11.499 | NO_CHANGE_NEEDED |
| 4879204 | Wildwood | 4.709 | 1 | true | 3.748 | NO_CHANGE_NEEDED |
| 4879696 | Windthorst | 2.564 | 1 | true | 2.856 | NO_CHANGE_NEEDED |
| 4879816 | Winnsboro | 3.756 | 1 | true | 3.07 | NO_CHANGE_NEEDED |
| 4880356 | Wylie | 31.076 | 1 | true | 10.006 | NO_CHANGE_NEEDED |
| 4880560 | Yoakum | 4.589 | 1 | true | 3.591 | NO_CHANGE_NEEDED |

## Classification summary

- REGIONALIZE_LIKE_HOUSTON: **2**
- KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM: **31**
- REVIEW: **29**
- NO_CHANGE_NEEDED: **185**

## Detailed candidate records

### Abernathy (4800160)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Abilene (4801000)

- Dimensions: large scale; compact sprawl; multi_county; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Ackerly (4801108)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Alba (4801636)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Alvin (4802272)

- Dimensions: small scale; moderate sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Amarillo (4803000)

- Dimensions: large scale; compact sprawl; multi_county; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Angleton (4803264)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Anna (4803300)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Aransas Pass (4803600)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Arlington (4804000)

- Dimensions: medium scale; compact sprawl; simple; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Atascocita (4804462)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Athens (4804504)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Austin (4805000)

- Dimensions: extreme scale; moderate sprawl; multipart_multi_county; medium consumer coherence; medium single-view usefulness; medium regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Azle (4805168)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Bartlett (4805732)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Bastrop (4805864)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Baytown (4806128)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Big Thicket Lake Estates (4808240)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Blackwell (4808488)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Blue Ridge (4808872)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Boerne (4809160)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Booker (4809448)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Brady (4809916)

- Dimensions: small scale; compact sprawl; simple; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Briar (4810192)

- Dimensions: small scale; compact sprawl; multipart_multi_county; medium consumer coherence; high single-view usefulness; medium regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Brownsville (4810768)

- Dimensions: large scale; moderate sprawl; multipart; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Brownwood (4810780)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Bruceville-Eddy (4810828)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Bryan (4810912)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Bullard (4811212)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Bulverde (4811224)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Burleson (4811428)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Bushland (4811572)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Canyon Lake (4812580)

- Dimensions: large scale; compact sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Carrollton (4813024)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Cedar Hill (4813492)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Cedar Park (4813552)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Celina (4813684)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Cibolo (4814920)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Cinco Ranch (4814929)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Clarksville City (4815172)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Cleburne (4815364)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Cleveland (4815436)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Combine (4816216)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Concepcion (4816300)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Conroe (4816432)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Cool (4816540)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Coppell (4816612)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Copperas Cove (4816624)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Corpus Christi (4817000)

- Dimensions: extreme scale; broad sprawl; multipart_multi_county; low consumer coherence; low single-view usefulness; high regionalization fit.
- Concern: one fitted view is likely too coarse for local awareness
- Houston comparison: scale/complexity pressure resembles the control; governed child names are absent
- Classification: **REGIONALIZE_LIKE_HOUSTON**

### Creedmoor (4817612)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Cresson (4817648)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Crowley (4817960)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Dalhart (4818524)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Dallas (4819000)

- Dimensions: extreme scale; moderate sprawl; multipart_multi_county; medium consumer coherence; medium single-view usefulness; medium regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Dayton (4819432)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Del Mar Heights (4819714)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Denton (4819972)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Denver City (4819984)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Deport (4820020)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### East Mountain (4822168)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Easton (4822192)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Edinburg (4822660)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Elgin (4823044)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Elmendorf (4823272)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### El Paso (4824000)

- Dimensions: large scale; moderate sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Ennis (4824348)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Evant (4824864)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Fair Oaks Ranch (4825168)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Fate (4825572)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Ferris (4825752)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Flower Mound (4826232)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Fort Bliss (4826664)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Fort Cavazos (4826666)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Fort Worth (4827000)

- Dimensions: extreme scale; moderate sprawl; multipart_multi_county; medium consumer coherence; medium single-view usefulness; medium regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Frankston (4827300)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Friendswood (4827648)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Frisco (4827684)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Fritch (4827696)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Galveston (4828068)

- Dimensions: large scale; moderate sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Garland (4829000)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Georgetown (4829336)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Gladewater (4829660)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Glenn Heights (4829840)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Golinda (4830092)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Granbury (4830416)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Grand Prairie (4830464)

- Dimensions: medium scale; broad sprawl; multi_county; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Grapevine (4830644)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Gunter (4831616)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Hamlin (4831964)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Happy (4832156)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Harlingen (4832372)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Harper (4832456)

- Dimensions: medium scale; compact sprawl; simple; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Haslet (4832720)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Heath (4832984)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Hebron (4833020)

- Dimensions: small scale; compact sprawl; multipart_multi_county; medium consumer coherence; high single-view usefulness; medium regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Hico (4833548)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Hillsboro (4834088)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Horseshoe Bay (4834862)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Hughes Springs (4835300)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Huntsville (4835528)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Hutto (4835624)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Huxley (4835636)

- Dimensions: small scale; compact sprawl; simple; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Ingleside (4836008)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Iowa Colony (4836092)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Josephine (4838068)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Katy (4838476)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Kilgore (4839124)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Killeen (4839148)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Kyle (4839952)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### La Coma (4840100)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Lago Vista (4840264)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Lake Cherokee (4840468)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Lake Medina Shores (4840674)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### La Porte (4841440)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### La Presa (4841449)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Laredo (4841464)

- Dimensions: large scale; moderate sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Laredo Ranchettes West (4841475)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### League City (4841980)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Leander (4842016)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Lewisville (4842508)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Liberty (4842568)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Longview (4843888)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Los Altos (4844038)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Los Veteranos I (4844167)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Lubbock (4845000)

- Dimensions: large scale; compact sprawl; multipart; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Lueders (4845048)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Lufkin (4845072)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Luling (4845096)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Lytle (4845288)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Mabank (4845324)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### McAllen (4845384)

- Dimensions: medium scale; broad sprawl; multipart; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### McGregor (4845672)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### McKinney (4845744)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### McLendon-Chisholm (4845804)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Manor (4846440)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Mansfield (4846452)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Manvel (4846500)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Mart (4846824)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Melissa (4847496)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Mercedes (4847700)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Mesquite (4847892)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Midland (4848072)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Midlothian (4848096)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Mineral Wells (4848684)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Mission Bend (4848772)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Missouri City (4848804)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Monahans (4848936)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; medium consumer coherence; high single-view usefulness; medium regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Mont Belvieu (4849068)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Morgan's Point (4849380)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Morse (4849440)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Mustang Ridge (4850200)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Nacogdoches (4850256)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Navasota (4850472)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Newark (4850772)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### New Braunfels (4850820)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### New Fairview (4850920)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Niederwald (4851492)

- Dimensions: small scale; compact sprawl; multipart_multi_county; medium consumer coherence; high single-view usefulness; medium regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Nixon (4851588)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Normangee (4851840)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Oakwood (4853232)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Odessa (4853388)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### O'Donnell (4853436)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Old River-Winfree (4853824)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Orange (4854132)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Overton (4854432)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Ovilla (4854444)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Paris (4855080)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Pasadena (4856000)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Pearland (4856348)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Pecan Acres (4856462)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Pecan Gap (4856468)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Pecan Plantation (4856498)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Pflugerville (4857176)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Pharr (4857200)

- Dimensions: small scale; broad sprawl; multipart; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Pilot Point (4857476)

- Dimensions: small scale; compact sprawl; multipart_multi_county; medium consumer coherence; high single-view usefulness; medium regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Plano (4858016)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Poetry (4858502)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Port Arthur (4858820)

- Dimensions: large scale; moderate sprawl; multi_county; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Portland (4858904)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Princeton (4859576)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Prosper (4859696)

- Dimensions: medium scale; broad sprawl; multi_county; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Quesada (4860098)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Ranchitos East (4860480)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Red Oak (4861196)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Reklaw (4861508)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Reno (4861604)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Richardson (4861796)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Rio Bravo (4862138)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Roanoke (4862504)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Rockwall (4862828)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Rosenberg (4863284)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Round Rock (4863500)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Rowlett (4863572)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Royse City (4863668)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Sachse (4864064)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### San Antonio (4865000)

- Dimensions: extreme scale; broad sprawl; multipart_multi_county; low consumer coherence; low single-view usefulness; high regionalization fit.
- Concern: one fitted view is likely too coarse for local awareness
- Houston comparison: scale/complexity pressure resembles the control; governed child names are absent
- Classification: **REGIONALIZE_LIKE_HOUSTON**

### San Benito (4865036)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### San Carlos II (4865050)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### San Diego (4865180)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Sanger (4865408)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### San Marcos (4865600)

- Dimensions: medium scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Schertz (4866128)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Seabrook (4866392)

- Dimensions: small scale; broad sprawl; multi_county; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Seagoville (4866428)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Sealy (4866464)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Seguin (4866644)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Selma (4866704)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Seven Points (4866908)

- Dimensions: small scale; compact sprawl; multipart_multi_county; medium consumer coherence; high single-view usefulness; medium regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Shoreacres (4867688)

- Dimensions: small scale; extreme sprawl; multi_county; medium consumer coherence; medium single-view usefulness; medium regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Southlake (4869032)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Southmayd (4869104)

- Dimensions: small scale; compact sprawl; simple; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### South Padre Island (4869140)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Springtown (4869800)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Stafford (4869908)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Stamford (4869980)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Streetman (4870604)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Tatum (4871924)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Temple (4872176)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Terrell (4872284)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Texas City (4872392)

- Dimensions: large scale; moderate sprawl; multi_county; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### The Woodlands (4872656)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Thorndale (4872776)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Tomball (4873316)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Trenton (4873592)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Trophy Club (4873710)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Troup (4873724)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Uhland (4874216)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Universal City (4874408)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Valley Mills (4874732)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Valley View (4874756)

- Dimensions: small scale; extreme sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Van Alstyne (4874924)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Venus (4875236)

- Dimensions: small scale; compact sprawl; multipart_multi_county; medium consumer coherence; high single-view usefulness; medium regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **REVIEW**

### Victoria (4875428)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Waco (4876000)

- Dimensions: large scale; compact sprawl; simple; high consumer coherence; medium single-view usefulness; low regionalization fit.
- Concern: fixed zoom is pressured; fit behavior requires validation
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **KEEP_SINGLE_PLACE_WITH_DYNAMIC_ZOOM**

### Waller (4876228)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Warren City (4876576)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Weatherford (4876864)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Weslaco (4877272)

- Dimensions: small scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Westlake (4877620)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### West Livingston (4877662)

- Dimensions: medium scale; compact sprawl; multipart; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Whitewright (4878628)

- Dimensions: small scale; compact sprawl; multipart_multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Wichita Falls (4879000)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Wildwood (4879204)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Windthorst (4879696)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Winnsboro (4879816)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Wylie (4880356)

- Dimensions: medium scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

### Yoakum (4880560)

- Dimensions: small scale; compact sprawl; multi_county; high consumer coherence; high single-view usefulness; low regionalization fit.
- Concern: one coherent view remains plausible
- Houston comparison: less combined scale/complexity pressure than the control
- Classification: **NO_CHANGE_NEEDED**

## Recommended next-stage sequencing

1. owner review of REGIONALIZE_LIKE_HOUSTON records
1. governed child-name/boundary research without runtime mutation
1. browser validation of REVIEW and dynamic-zoom records
1. separate implementation authorization, if any

## Explicit limitations

- No population/demographic source is governed by the input reports.
- Internal activity centers are counted only when governed repository identities establish them; none are inferred from general knowledge.
- Bounds are a sprawl proxy, not an urban-form or travel-pattern model.
- Classifications authorize no runtime or registry change.
