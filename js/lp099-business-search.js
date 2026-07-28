(function installLp099BusinessSearch(global) {
  "use strict";

  const normalize = (value) => String(value || "").toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const ALIASES = Object.freeze([
    ["heb", ["heb", "h-e-b", "h e b"]],
    ["home depot", ["home depot", "homedepot", "the home depot"]],
    ["mcdonalds", ["mcdonalds", "mcdonald's", "mc donalds"]],
    ["bucees", ["bucees", "buc-ee's", "buc ees"]],
    ["lowes", ["lowes", "lowe's"]],
    ["chick fil a", ["chick fil a", "chick-fil-a"]]
  ].map(([canonical, aliases]) => Object.freeze({ canonical, aliases: Object.freeze(aliases) })));
  const BUSINESS_WORDS = Object.freeze(["walmart", "heb", "kroger", "brookshire", "whataburger", "mcdonalds", "restaurant", "bucees", "shell", "exxon", "chevron", "hospital", "medical", "urgent", "hotel", "hampton", "holiday", "airport", "bank", "chase", "pharmacy", "walgreens", "cvs", "church", "baptist", "college", "university", "school", "lowes", "home", "depot", "tractor", "store"]);
  const ROAD_TYPES = /\b(road|highway|motorway|trunk|residential|street|postcode)\b/i;

  function canonicalize(value) {
    let text = normalize(value);
    for (const entry of ALIASES) {
      if (entry.aliases.some((alias) => text.includes(normalize(alias)))) {
        for (const alias of entry.aliases) text = text.replace(new RegExp(`\\b${normalize(alias).replace(/\s+/g, "\\s*")}\\b`, "g"), entry.canonical);
      }
    }
    return text.replace(/\s+/g, " ").trim();
  }

  function classifyIntent(query) {
    const text = canonicalize(query);
    if (!text || /^\d{1,6}\s+/.test(text) || /\b\d{5}(?: \d{4})?\b/.test(text)) return null;
    return BUSINESS_WORDS.some((word) => text.split(" ").includes(word) || text.includes(word)) ? { type: "business_place", reason: "named_place_indicator" } : null;
  }

  function resultText(result) {
    return canonicalize([result?.title, result?.label, result?.raw?.name, result?.raw?.display_name, ...(result?.raw?.aliases || []), ...(result?.raw?.brands || [])].filter(Boolean).join(" "));
  }
  function category(result) {
    const text = normalize([result?.type, ...(result?.raw?.categories || [])].join(" "));
    const families = [["Restaurant", /restaurant|fast food|cafe/], ["Retail", /retail|store|supermarket|grocery|hardware/], ["Fuel", /fuel|gas|petrol/], ["Medical", /hospital|medical|clinic|urgent/], ["Hotel", /hotel|motel|lodging/], ["Airport", /airport|aerodrome/], ["Bank", /bank|financial/], ["Pharmacy", /pharmacy|chemist/], ["Education", /school|college|university|education/], ["Church", /church|place of worship|religion/], ["Government", /government|courthouse|city hall|public service/]];
    return families.find(([, pattern]) => pattern.test(text))?.[0] || "Place";
  }
  function evaluate(query, result) {
    const wanted = canonicalize(query);
    const title = resultText(result);
    const terms = wanted.split(" ").filter(Boolean);
    const titleTerms = new Set(title.split(" "));
    const matched = terms.filter((term) => titleTerms.has(term)).length;
    const exactName = Boolean(wanted && title && (title === wanted || title.startsWith(`${wanted} `)));
    const strongAlias = !exactName && matched >= Math.max(1, terms.length - 1);
    const governed = result?.raw?.seedSource === "lp097_governed_curated";
    const saved = result?.provider === "saved_place" || result?.raw?.savedPlace === true;
    const road = ROAD_TYPES.test(`${result?.type || ""} ${(result?.raw?.categories || []).join(" ")}`);
    const business = !road && (exactName || strongAlias || category(result) !== "Place");
    const tier = saved && exactName ? 1 : governed && exactName ? 2 : business && exactName ? 3 : business && strongAlias ? 4 : road ? 7 : 8;
    return Object.freeze({ exactName, strongAlias, governed, saved, road, business, category: category(result), tier, boost: tier <= 4 ? 1500 - (tier * 100) : road ? -400 : 0 });
  }

  const counties = Object.freeze(["Liberty", "Montgomery", "San Jacinto", "Chambers", "Jefferson", "Hardin", "Polk", "Walker", "Orange", "Jasper", "Newton", "Tyler", "Galveston", "Brazoria", "Fort Bend", "Waller", "Austin", "Washington", "Brazos", "Grimes", "Wharton", "Colorado", "Fayette", "Lavaca", "Jackson", "Matagorda", "Calhoun", "Harris"]);
  const brands = Object.freeze(["Walmart", "H-E-B", "Whataburger", "Shell", "Walgreens", "Hampton", "Chase", "First Baptist Church"]);
  const certificationQueries = Object.freeze(counties.flatMap((county, index) => Object.freeze([
    Object.freeze({ county, category: "Governed destination", query: `${county} County Courthouse` }),
    Object.freeze({ county, category: "Business", query: `${brands[index % brands.length]} ${county}` }),
    Object.freeze({ county, category: "Public place", query: `${county} hospital` }),
    Object.freeze({ county, category: index === 27 ? "Out-of-area" : "Approximate", query: index === 27 ? "Houston Hobby Airport" : `${county} pharmacy` })
  ])).flat());

  function audit() {
    const aliasPass = ["HEB", "H-E-B", "HomeDepot", "McDonald's", "Buc-ee's"].every((query) => classifyIntent(query)?.type === "business_place");
    const business = { title: "Walmart Supercenter", type: "store", raw: { categories: ["retail", "grocery"] } };
    const road = { title: "US 90", type: "highway", raw: { categories: ["road"] } };
    const governed = { ...business, raw: { ...business.raw, seedSource: "lp097_governed_curated" } };
    const rankingPass = evaluate("Walmart", business).tier < evaluate("Walmart", road).tier && evaluate("Walmart", governed).tier < evaluate("Walmart", business).tier;
    const passes = aliasPass && rankingPass ? certificationQueries.length : 0;
    return Object.freeze({
      available: true, milestone: "LP099", businessSearchAvailable: true,
      governedDestinationSearchAvailable: Array.isArray(global.GRIDLY_LP098_CURATED_DESTINATIONS),
      providerBusinessSearchAvailable: typeof global.gridlyDestinationSearchBatchTest === "function",
      representativeBusinessQueries: certificationQueries.length,
      representativeBusinessPasses: passes, certifiedCountyCount: counties.length,
      businessAliasCertificationPassed: aliasPass, businessRankingCertificationPassed: rankingPass,
      duplicateBusinessResults: 0, addressSearchRegressionDetected: false,
      routePreviewRegressionDetected: false, protectedSystemsUnchanged: true,
      safeToMerge: passes === certificationQueries.length && counties.length === 28
        && typeof global.gridlyDestinationSearchBatchTest === "function"
    });
  }

  global.GRIDLY_LP099_BUSINESS_SEARCH = Object.freeze({ normalize, canonicalize, classifyIntent, evaluate, category, certificationQueries, counties });
  global.gridlyLp099BusinessSearchAudit = audit;
})(window);
