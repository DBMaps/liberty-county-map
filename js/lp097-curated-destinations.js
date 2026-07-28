(function installLp097CuratedDestinations(global) {
  "use strict";

  const verifiedAt = "2026-07-28";
  const countyId = "liberty-tx";
  const records = [
    ["liberty-tx-dayton-city-hall", "Dayton City Hall", ["City of Dayton", "Dayton Municipal Building"], "government", "city_hall", "117 Cook Street", "dayton", "77535", 30.0460, -94.8913, "City of Dayton public facility record"],
    ["liberty-tx-liberty-county-courthouse", "Liberty County Courthouse", ["Liberty County Courthouse and Annex"], "government", "courthouse", "1923 Sam Houston Street", "liberty", "77575", 30.0579, -94.7955, "Liberty County public facility record"],
    ["liberty-tx-liberty-county-sheriff", "Liberty County Sheriff's Office", ["Liberty County Sheriff", "LCSO"], "government", "sheriff", "2400 Beaumont Avenue", "liberty", "77575", 30.0601, -94.7972, "Liberty County public facility record"],
    ["liberty-tx-dayton-police", "Dayton Police Department", ["Dayton PD"], "government", "police", "2004 North Cleveland Street", "dayton", "77535", 30.0622, -94.8912, "City of Dayton public facility record"],
    ["liberty-tx-liberty-police", "Liberty Police Department", ["Liberty PD"], "government", "police", "1914 Lakeland Drive", "liberty", "77575", 30.0632, -94.7904, "City of Liberty public facility record"],
    ["liberty-tx-dayton-high-school", "Dayton High School", ["DHS", "Dayton Broncos"], "education", "high_school", "3200 North Cleveland Street", "dayton", "77535", 30.0667, -94.8918, "Dayton ISD public campus record"],
    ["liberty-tx-cleveland-high-school", "Cleveland High School", ["CHS", "Cleveland Indians"], "education", "high_school", "1600 East Houston Street", "cleveland", "77327", 30.3294, -95.0868, "Cleveland ISD public campus record"],
    ["liberty-tx-dayton-middle-school", "Woodrow Wilson Junior High School", ["Dayton Middle School", "Wilson Junior High"], "education", "middle_school", "309 South Cleveland Street", "dayton", "77535", 30.0478, -94.8886, "Dayton ISD public campus record"],
    ["liberty-tx-liberty-dayton-medical-center", "Liberty-Dayton Regional Medical Center", ["Liberty Dayton Regional Medical Center", "Liberty Hospital"], "medical", "hospital", "1353 North Travis Street", "liberty", "77575", 30.0562, -94.7936, "Public hospital facility record"],
    ["liberty-tx-cleveland-emergency-hospital", "Cleveland Emergency Hospital", ["Cleveland ER", "Cleveland Emergency Room"], "medical", "emergency_room", "1017 South Travis Avenue", "cleveland", "77327", 30.3308, -95.0885, "Public hospital facility record"],
    ["liberty-tx-dayton-jones-library", "Jones Public Library", ["Dayton Library"], "public_service", "library", "801 South Cleveland Street", "dayton", "77535", 30.0387, -94.8888, "City of Dayton public facility record"],
    ["liberty-tx-liberty-municipal-library", "Liberty Municipal Library", ["Geraldine D. Humphreys Cultural Center Library"], "public_service", "library", "1710 Sam Houston Street", "liberty", "77575", 30.0555, -94.7961, "City of Liberty public facility record"],
    ["liberty-tx-dayton-post-office", "US Post Office Dayton", ["Dayton Post Office", "USPS Dayton"], "public_service", "post_office", "110 South Main Street", "dayton", "77535", 30.0460, -94.8893, "USPS public location record"],
    ["liberty-tx-liberty-post-office", "US Post Office Liberty", ["Liberty Post Office", "USPS Liberty"], "public_service", "post_office", "1510 Trinity Street", "liberty", "77575", 30.0550, -94.7940, "USPS public location record"],
    ["liberty-tx-walmart-liberty", "Walmart Supercenter Liberty", ["Walmart Liberty"], "community_destination", "grocery_retail", "2121 Highway 146 Bypass", "liberty", "77575", 30.0751, -94.7844, "Official store locator record"],
    ["liberty-tx-walmart-cleveland", "Walmart Supercenter Cleveland", ["Walmart Cleveland"], "community_destination", "grocery_retail", "831 Highway 59 South", "cleveland", "77327", 30.3338, -95.0857, "Official store locator record"],
    ["liberty-tx-dayton-city-park", "Dayton City Park", ["Dayton Community Center Park"], "community_destination", "park", "801 South Cleveland Street", "dayton", "77535", 30.0389, -94.8887, "City of Dayton parks record"],
    ["liberty-tx-liberty-municipal-airport", "Liberty Municipal Airport", ["Liberty Airport", "T78"], "community_destination", "airport", "Liberty Municipal Airport", "liberty", "77575", 30.0778, -94.6986, "FAA public airport record"]
  ].map(([id, name, aliases, category, subcategory, address, communityId, postalCode, latitude, longitude, sourceAuthority]) => Object.freeze({
    id, name, aliases: Object.freeze(aliases), category, subcategory, address, communityId,
    countyId, state: "TX", postalCode, latitude, longitude, source: "curated",
    sourceAuthority, coordinateVerification: sourceAuthority, verifiedAt, active: true
  }));

  global.GRIDLY_LP097_CURATED_DESTINATIONS = Object.freeze(records);
})(window);
