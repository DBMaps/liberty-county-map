(function installGridlyTxgioAddressRuntime(global) {
  "use strict";

  const PACKAGES = Object.freeze({
    "liberty-tx": Object.freeze({
      countyId: "liberty-tx",
      county: "Liberty County",
      fips: "48291",
      url: "data/generated/lp104/txgio-addresses/liberty-48291.addresses.jsonl.gz",
      localityPattern: /\b(?:liberty(?: county)?|dayton|cleveland|kenefick|ames|hardin|daisetta|hull|devers),?\s*(?:texas|tx)?\b/i,
      zipPattern: /\b(?:77327|77328|77371|77535|77538|77564|77575|77582)\b/
    })
  });
  const evidence = [];
  const packagePromises = new Map();

  const clean = (value) => String(value == null ? "" : value).trim().replace(/[.,#]/g, " ").replace(/\s+/g, " ");
  function canonicalRoad(value) {
    return clean(value).toUpperCase()
      .replace(/\b(?:COUNTY\s+ROAD|COUNTY\s+RD|CO(?:UNTY)?\s+RD|CR)\s*(?=[0-9])/g, "CR ")
      .replace(/\s+/g, " ").trim();
  }

  function parseExactAddress(query) {
    const input = String(query || "").trim();
    const first = input.split(",")[0].trim();
    const match = first.match(/^(\d+[A-Z]?)\s+(.+)$/i);
    if (!match) return null;
    const road = canonicalRoad(match[2]);
    if (!road) return null;
    return Object.freeze({ input, houseNumber: match[1].toUpperCase(), road });
  }

  function countyForSearch(query, countyId) {
    const explicit = PACKAGES[String(countyId || "").toLowerCase()];
    if (explicit) return explicit;
    const input = String(query || "");
    return Object.values(PACKAGES).find((item) => item.localityPattern.test(input) || item.zipPattern.test(input)) || null;
  }

  async function readGzipJsonLines(response) {
    if (!response.ok) throw new Error(`package_http_${response.status}`);
    if (typeof global.DecompressionStream !== "function") throw new Error("gzip_stream_unavailable");
    const stream = response.body.pipeThrough(new global.DecompressionStream("gzip"));
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const records = new Map();
    let pending = "";
    const accept = (line) => {
      if (!line.trim()) return;
      const record = JSON.parse(line);
      const house = clean(record.h).toUpperCase();
      const road = canonicalRoad(record.r);
      if (!house || !road || !Number.isFinite(Number(record.y)) || !Number.isFinite(Number(record.x))) return;
      const key = `${house}|${road}`;
      if (!records.has(key)) records.set(key, []);
      records.get(key).push(Object.freeze({ ...record }));
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      lines.forEach(accept);
    }
    pending += decoder.decode();
    if (pending.trim()) accept(pending);
    return records;
  }

  function loadPackage(county) {
    if (!packagePromises.has(county.fips)) {
      const startedAt = Date.now();
      const promise = global.fetch(county.url, { cache: "force-cache", credentials: "same-origin" })
        .then(readGzipJsonLines)
        .then((index) => {
          evidence.push(Object.freeze({ event: "package_loaded", fips: county.fips, keyCount: index.size, durationMs: Date.now() - startedAt }));
          return index;
        })
        .catch((error) => {
          packagePromises.delete(county.fips);
          evidence.push(Object.freeze({ event: "package_load_failed", fips: county.fips, reason: String(error?.message || error) }));
          throw error;
        });
      packagePromises.set(county.fips, promise);
    }
    return packagePromises.get(county.fips);
  }

  function toSearchResult(record, county) {
    return Object.freeze({
      place_id: `txgio:${record.i}`,
      name: record.a,
      display_name: [record.a, record.p, "TX", record.z].filter(Boolean).join(", "),
      lat: String(record.y),
      lon: String(record.x),
      category: "place",
      type: "house",
      provider: "gridly_txgio_county_package",
      address: Object.freeze({ house_number: record.h, road: record.r, city: record.p, county: record.c || county.county, state: "TX", postcode: record.z, country: "United States" }),
      gridlyResolution: Object.freeze({ precision: "exact_address_point", confidenceBasis: "certified_txgio_address_point", sourceClassification: "government_address_point", routePreviewEligible: true })
    });
  }

  async function search(request = {}) {
    const parsed = parseExactAddress(request.query);
    const county = parsed ? countyForSearch(request.query, request.countyId) : null;
    if (!parsed || !county) return Object.freeze({ attempted: false, outcome: "not_applicable", results: Object.freeze([]) });
    try {
      const index = await loadPackage(county);
      const records = index.get(`${parsed.houseNumber}|${parsed.road}`) || [];
      const results = Object.freeze(records.map((record) => toSearchResult(record, county)));
      const outcome = results.length ? "exact_match" : "truthful_no_result";
      evidence.push(Object.freeze({ event: "exact_lookup", fips: county.fips, outcome, resultCount: results.length }));
      return Object.freeze({ attempted: true, countyId: county.countyId, fips: county.fips, outcome, results });
    } catch (error) {
      return Object.freeze({ attempted: true, countyId: county.countyId, fips: county.fips, outcome: "package_unavailable", results: Object.freeze([]), error: String(error?.message || error) });
    }
  }

  async function certification() {
    const cases = [];
    for (const [query, expected] of [
      ["276 County Road 677, Dayton, TX 77535", "exact_match"],
      ["274 County Road 677, Dayton, TX 77535", "truthful_no_result"]
    ]) {
      const result = await search({ query });
      cases.push(Object.freeze({ query, expected, actual: result.outcome, passed: result.outcome === expected, resultCount: result.results.length }));
    }
    return Object.freeze({ milestone: "LP104.5", passed: cases.every((item) => item.passed), cases: Object.freeze(cases), evidence: Object.freeze(evidence.slice()) });
  }

  global.gridlyTxgioAddressRuntime = Object.freeze({ search, certification, canonicalRoad, parseExactAddress, packages: PACKAGES, evidence: () => evidence.slice() });
})(window);
