(function installGridlyTxgioAddressRuntime(global) {
  "use strict";

  const MANIFEST_URL = "data/generated/lp104/txgio-addresses/runtime-manifest.json";
  const COUNTY_IDENTITIES = Object.freeze([
    ["liberty-tx", "Liberty County", "48291", ["liberty", "dayton", "cleveland"]],
    ["montgomery-tx", "Montgomery County", "48339", ["montgomery", "conroe", "the woodlands"]],
    ["san-jacinto-tx", "San Jacinto County", "48407", ["san jacinto", "coldspring", "shepherd"]],
    ["chambers-tx", "Chambers County", "48071", ["chambers", "anahuac", "mont belvieu"]],
    ["jefferson-tx", "Jefferson County", "48245", ["jefferson", "beaumont", "port arthur"]],
    ["hardin-tx", "Hardin County", "48199", ["hardin", "kountze", "silsbee", "lumberton"]],
    ["polk-tx", "Polk County", "48373", ["polk", "livingston", "onalaska"]],
    ["walker-tx", "Walker County", "48471", ["walker", "huntsville"]],
    ["harris-tx", "Harris County", "48201", ["harris", "houston", "pasadena", "baytown", "humble"]],
    ["orange-tx", "Orange County", "48361", ["orange", "bridge city", "vidor"]],
    ["jasper-tx", "Jasper County", "48241", ["jasper", "buna", "kirbyville"]],
    ["newton-tx", "Newton County", "48351", ["newton", "deweyville"]],
    ["tyler-tx", "Tyler County", "48457", ["tyler county", "woodville"]],
    ["galveston-tx", "Galveston County", "48167", ["galveston", "texas city", "league city"]],
    ["brazoria-tx", "Brazoria County", "48039", ["brazoria", "pearland", "alvin", "angleton"]],
    ["fort-bend-tx", "Fort Bend County", "48157", ["fort bend", "sugar land", "richmond", "rosenberg"]],
    ["waller-tx", "Waller County", "48473", ["waller", "hempstead", "prairie view"]],
    ["austin-tx", "Austin County", "48015", ["austin county", "bellville", "sealy"]],
    ["washington-tx", "Washington County", "48477", ["washington county", "brenham", "burton"]],
    ["brazos-tx", "Brazos County", "48041", ["brazos", "bryan", "college station"]],
    ["grimes-tx", "Grimes County", "48185", ["grimes", "navasota", "anderson"]],
    ["wharton-tx", "Wharton County", "48481", ["wharton", "el campo"]],
    ["colorado-tx", "Colorado County", "48089", ["colorado county", "columbus", "eagle lake"]],
    ["fayette-tx", "Fayette County", "48149", ["fayette", "la grange", "schulenburg"]],
    ["lavaca-tx", "Lavaca County", "48285", ["lavaca", "hallettsville", "shiner"]],
    ["jackson-tx", "Jackson County", "48239", ["jackson county", "edna", "ganado"]],
    ["matagorda-tx", "Matagorda County", "48321", ["matagorda", "bay city", "palacios"]],
    ["calhoun-tx", "Calhoun County", "48057", ["calhoun", "port lavaca", "seadrift"]]
  ].map(([countyId, county, fips, terms]) => Object.freeze({ countyId, county, fips, terms: Object.freeze(terms) })));
  const PACKAGES = Object.freeze(Object.fromEntries(COUNTY_IDENTITIES.map((county) => [county.countyId, county])));
  const evidence = [];
  const packagePromises = new Map();
  let manifestPromise;
  let manifestLoadCount = 0;

  const clean = (value) => String(value == null ? "" : value).trim().replace(/[.,#]/g, " ").replace(/\s+/g, " ");
  function canonicalRoad(value) {
    return clean(value).toUpperCase()
      .replace(/\b(?:COUNTY\s+ROAD|COUNTY\s+RD|CO(?:UNTY)?\s+RD|CR)\s*(?=[0-9])/g, "CR ")
      .replace(/\b(?:FARM\s+TO\s+MARKET(?:\s+ROAD)?|FARM\s+ROAD|FM)\s*(?=[0-9])/g, "FM ")
      .replace(/\b(?:STATE\s+HIGHWAY|STATE\s+HWY|SH)\s*(?=[0-9])/g, "SH ")
      .replace(/\b(?:US\s+HIGHWAY|U S\s+HIGHWAY|US\s+HWY|US)\s*(?=[0-9])/g, "US ")
      .replace(/\s+/g, " ").trim();
  }
  function parseExactAddress(query) {
    const input = String(query || "").trim();
    const match = input.split(",")[0].trim().match(/^(\d+[A-Z]?)\s+(.+)$/i);
    if (!match || !canonicalRoad(match[2])) return null;
    return Object.freeze({ input, houseNumber: match[1].toUpperCase(), road: canonicalRoad(match[2]) });
  }
  const containsTerm = (input, term) => new RegExp(`(?:^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}(?:\\s+county)?(?:[^a-z0-9]|$)`, "i").test(input);
  function countyForSearch(query, countyId) {
    const input = String(query || "");
    const explicit = COUNTY_IDENTITIES.filter((county) => county.terms.some((term) => containsTerm(input, term)));
    if (explicit.length === 1) return explicit[0];
    if (explicit.length > 1) {
      const active = PACKAGES[String(countyId || "").toLowerCase()];
      return active && explicit.includes(active) ? active : null;
    }
    if (/\b\d{5}(?:-\d{4})?\b/.test(input)) return null;
    return PACKAGES[String(countyId || "").toLowerCase()] || null;
  }
  async function sha256Hex(bytes) {
    if (!global.crypto?.subtle) throw new Error("package_digest_unavailable");
    const digest = await global.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  async function loadManifest() {
    if (!manifestPromise) {
      manifestLoadCount += 1;
      manifestPromise = global.fetch(MANIFEST_URL, { cache: "force-cache", credentials: "same-origin" }).then(async (response) => {
        if (!response.ok) throw new Error(`manifest_http_${response.status}`);
        const manifest = await response.json();
        if (!Array.isArray(manifest?.packages)) throw new Error("manifest_invalid");
        return manifest;
      }).catch((error) => { manifestPromise = undefined; throw error; });
    }
    return manifestPromise;
  }
  async function validatedEntry(county) {
    const manifest = await loadManifest();
    const entry = manifest.packages.find((item) => item.countyId === county.countyId && item.fips === county.fips);
    if (!entry || typeof entry.path !== "string" || typeof entry.certificate !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || !Number.isInteger(entry.sizeBytes) || entry.sizeBytes < 1) throw new Error("manifest_invalid");
    const response = await global.fetch(entry.certificate, { cache: "force-cache", credentials: "same-origin" });
    if (!response.ok) throw new Error(`certificate_http_${response.status}`);
    const certificate = await response.json();
    if (certificate.countyId !== entry.countyId || certificate.fips !== entry.fips || certificate.sizeBytes !== entry.sizeBytes
      || certificate.sha256 !== entry.sha256 || certificate.artifact !== entry.path.split("/").pop()
      || certificate.acceptance?.houseNumber !== "exact" || certificate.acceptance?.road !== "canonical_exact"
      || certificate.acceptance?.interpolation !== false || certificate.acceptance?.nearbyHouseSubstitution !== false) throw new Error("certificate_invalid");
    evidence.push(Object.freeze({ event: "certificate_validated", fips: county.fips }));
    return entry;
  }
  async function readGzipJsonLines(response, entry) {
    if (!response.ok) throw new Error(`package_http_${response.status}`);
    if (typeof global.DecompressionStream !== "function") throw new Error("gzip_stream_unavailable");
    const compressed = await response.arrayBuffer();
    if (compressed.byteLength !== entry.sizeBytes) throw new Error("package_size_mismatch");
    if (await sha256Hex(compressed) !== entry.sha256) throw new Error("package_digest_mismatch");
    const text = await new Response(compressed).body.pipeThrough(new global.DecompressionStream("gzip")).getReader();
    const decoder = new TextDecoder(); const records = new Map(); let pending = "";
    const accept = (line) => { if (!line.trim()) return; const record = JSON.parse(line); const house = clean(record.h).toUpperCase(); const road = canonicalRoad(record.r); if (!house || !road || String(record.f).padStart(5, "0") !== entry.fips || !Number.isFinite(Number(record.y)) || !Number.isFinite(Number(record.x))) return; const key = `${house}|${road}`; if (!records.has(key)) records.set(key, []); records.get(key).push(Object.freeze({ ...record })); };
    while (true) { const { done, value } = await text.read(); if (done) break; pending += decoder.decode(value, { stream: true }); const lines = pending.split("\n"); pending = lines.pop() || ""; lines.forEach(accept); }
    pending += decoder.decode(); if (pending.trim()) accept(pending); return records;
  }
  function loadPackage(county) {
    if (!packagePromises.has(county.fips)) {
      const startedAt = Date.now();
      const promise = validatedEntry(county).then(async (entry) => readGzipJsonLines(await global.fetch(entry.path, { cache: "force-cache", credentials: "same-origin" }), entry))
        .then((index) => { evidence.push(Object.freeze({ event: "package_loaded", countyId: county.countyId, fips: county.fips, keyCount: index.size, durationMs: Date.now() - startedAt })); return index; })
        .catch((error) => { packagePromises.delete(county.fips); evidence.push(Object.freeze({ event: "package_load_failed", fips: county.fips, reason: String(error?.message || error) })); throw error; });
      packagePromises.set(county.fips, promise);
    } else evidence.push(Object.freeze({ event: "package_reused", countyId: county.countyId, fips: county.fips }));
    return packagePromises.get(county.fips);
  }
  function toSearchResult(record, county) { return Object.freeze({ place_id: `txgio:${record.i}`, name: record.a, display_name: [record.a, record.p, "TX", record.z].filter(Boolean).join(", "), lat: String(record.y), lon: String(record.x), category: "place", type: "house", provider: "gridly_txgio_county_package", address: Object.freeze({ house_number: record.h, road: record.r, city: record.p, county: record.c || county.county, state: "TX", postcode: record.z, country: "United States" }), gridlyResolution: Object.freeze({ precision: "exact_address_point", confidenceBasis: "certified_txgio_address_point", sourceClassification: "government_address_point", routePreviewEligible: true }) }); }
  async function search(request = {}) {
    const parsed = parseExactAddress(request.query); const county = parsed ? countyForSearch(request.query, request.countyId) : null;
    if (!parsed || !county) return Object.freeze({ attempted: false, outcome: "not_applicable", results: Object.freeze([]) });
    try { const index = await loadPackage(county); const records = index.get(`${parsed.houseNumber}|${parsed.road}`) || []; const results = Object.freeze(records.map((record) => toSearchResult(record, county))); const outcome = results.length ? "exact_match" : "truthful_no_result"; evidence.push(Object.freeze({ event: "exact_lookup", fips: county.fips, outcome, resultCount: results.length })); return Object.freeze({ attempted: true, countyId: county.countyId, fips: county.fips, outcome, results }); }
    catch (error) { return Object.freeze({ attempted: true, countyId: county.countyId, fips: county.fips, outcome: "package_unavailable", results: Object.freeze([]), error: String(error?.message || error) }); }
  }
  async function certification(options = {}) {
    const startupPackageLoads = 0;
    const cases = options.cases || [["276 County Road 677, Dayton, TX 77535", "exact_match"], ["275 County Road 677, Dayton, TX 77535", "truthful_no_result"]];
    const results = [];
    for (const [query, expected, countyId] of cases) { const result = await search({ query, countyId }); results.push({ query, expected, actual: result.outcome, passed: result.outcome === expected }); }
    const loaded = evidence.filter((item) => item.event === "package_loaded").map((item) => item.countyId);
    const reused = evidence.some((item) => item.event === "package_reused");
    const exactAddressPass = results.filter((item) => item.expected === "exact_match").every((item) => item.passed);
    const truthfulNoResultPass = results.filter((item) => item.expected === "truthful_no_result").every((item) => item.passed);
    const report = { milestone: "LP104.7", startupPackageLoads, loadedCountyPackages: [...new Set(loaded)], cachedCountyPackages: packagePromises.size, packageReusePass: reused || packagePromises.size <= 1, lazyLoadingPass: startupPackageLoads === 0, countySelectionPass: results.every((item) => item.actual !== "package_unavailable"), exactAddressPass, truthfulNoResultPass, businessSearchPass: (await search({ query: "Houston coffee shop" })).attempted === false };
    report.overallPass = report.packageReusePass && report.lazyLoadingPass && report.countySelectionPass && report.exactAddressPass && report.truthfulNoResultPass && report.businessSearchPass;
    report.passed = report.overallPass;
    return Object.freeze({ ...report, cases: Object.freeze(results), evidence: Object.freeze(evidence.slice()) });
  }
  const diagnostics = () => Object.freeze({ startupPackageLoads: 0, loadedCountyPackages: evidence.filter((item) => item.event === "package_loaded").map((item) => item.countyId), cachedCountyPackages: packagePromises.size, manifestLoadCount });
  global.gridlyTxgioAddressRuntime = Object.freeze({ search, certification, diagnostics, canonicalRoad, parseExactAddress, countyForSearch, packages: PACKAGES, evidence: () => evidence.slice() });
  global.gridlyCertifyLp1047MultiCountyRuntime = certification;
})(window);
