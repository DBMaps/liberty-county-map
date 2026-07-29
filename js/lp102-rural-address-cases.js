(function installLp102RuralAddressCases(global) {
  "use strict";
  global.GRIDLY_LP102_RURAL_CASES = Object.freeze([
    ["county_road_full", "274 County Road 677, Dayton, TX 77535"],
    ["county_rd", "274 County Rd 677, Dayton, TX 77535"],
    ["cr", "274 CR 677, Dayton, TX 77535"],
    ["co_rd", "274 Co Rd 677, Dayton, TX 77535"],
    ["web_address", "274 Web Road, Dayton, TX 77535"],
    ["webb_address", "274 Webb Road, Dayton, TX 77535"],
    ["county_road_only", "County Road 677, Dayton, TX 77535"],
    ["cr_only", "CR 677, Dayton, TX 77535"],
    ["web_road_only", "Web Road, Dayton, TX 77535"],
    ["webb_road_only", "Webb Road, Dayton, TX 77535"],
    ["urban_control", "1600 Pennsylvania Avenue NW, Washington, DC 20500"],
    ["business_control", "Dayton Walmart"],
    ["numbered_road_control", "County Road 676, Dayton, TX 77535"],
    ["invalid_rural_control", "999999 County Road 999999, Dayton, TX 77535"],
    ["out_of_area_control", "100 County Road 67, Muleshoe, TX 79347"],
    ["governed_control", "Liberty Courthouse"]
  ].map((entry) => Object.freeze(entry)));
})(window);
