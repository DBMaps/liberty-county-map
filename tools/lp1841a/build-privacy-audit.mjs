import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "reports/lp1841a");
const evidence = (file, lines, finding) => ({ file, lines, finding });
const appEvidence = (lines, finding) => evidence("js/app.js", lines, finding);
const common = { schemaVersion: "LP184.1A-1", milestone: "LP184.1A", auditOnly: true, generatedAt: null };
const dataClass = (value) => ({
  name: value.name, collected: value.collected, source: value.source, purpose: value.purpose,
  storage: value.storage, retention: value.retention, sentToServer: value.sentToServer,
  thirdPartyRecipients: value.thirdPartyRecipients, linkedToIdentity: value.linkedToIdentity,
  requiredForCoreFunction: value.requiredForCoreFunction, deletionMechanism: value.deletionMechanism,
  evidence: value.evidence, classification: value.classification
});

async function sha(file) { return createHash("sha256").update(await readFile(path.join(root, file))).digest("hex"); }

async function reports() {
  const protectedFiles = ["index.html", "js/app.js", "manifest.json", "service-worker.js", "android/app/src/main/AndroidManifest.xml", "ios/App/App/Info.plist"];
  const protectedHashes = Object.fromEntries(await Promise.all(protectedFiles.map(async f => [f, await sha(f)])));
  const location = {
    ...common, classification: "AUDIT_ONLY_CURRENT_RUNTIME", preciseLocation: true,
    requestTiming: ["Explicit current-location controls and report placement", "destination routing after a non-startup request", "Route Watch activation"],
    startupBehavior: "Startup readiness explicitly defers automatic geolocation.",
    getCurrentPosition: true, watchPosition: true,
    routeWatch: { continuousForeground: true, highAccuracy: true, backgroundLocation: false, stopsOn: "Stop Route Watch and clear-route flows call clearWatch", storage: "In-memory userLocation and window aliases only", history: false },
    currentLocationToSupabase: false,
    providerTransmission: { osrmRouting: true, osrmNearest: true, nominatimReverseGeocoding: true, mapTileProviders: "Tile requests reveal viewport/tile coordinates, not the userLocation object as an explicit parameter" },
    evidence: [appEvidence("39062-39118", "getCurrentPosition uses configured high-accuracy options and stores coordinates in runtime state."), appEvidence("48122-48138", "Explicit current-location control requests high accuracy."), appEvidence("48413-48469", "Route Watch stores current position in memory, watches in foreground, and clears the watcher."), appEvidence("90436-90442", "Stop Route Watch stops position updates."), appEvidence("81087-81103", "Supabase report rows contain report coordinates, not a standalone current-position telemetry write.")]
  };
  const community = {
    ...common, classification: "PSEUDONYMOUS_SHARED_COMMUNITY_REPORTING",
    table: "reports", publicSharedVisibility: true,
    submittedFields: ["crossing_id", "crossing_name", "railroad", "lat", "lng", "report_type", "severity", "detail", "source", "confidence", "device_id", "expires_at"],
    serverGeneratedOrObservedFields: ["id", "created_at"],
    categories: { hazards: ["flooding", "ice", "debris", "crash", "construction", "road_closed", "disabled_vehicle", "traffic_backup", "other_hazard"], crossingReports: "report_type selected by crossing workflow", clearing: "hazard_cleared rows; crossing lifecycle includes clear/confirmation report types" },
    lifecycle: { expiration: "LIFECYCLE_DERIVED from expires_at (hazards use configured minutes; clear rows 30 minutes)", expiredRowDeletion: "unknown", historicalPersistence: "HISTORICAL_STORAGE is implemented in client-side history capture; server deletion after expiry is not proven", userRemoval: "No consumer self-service removal mechanism proven; development/admin purge helpers are not consumer mechanisms" },
    evidence: [appEvidence("79891-79976", "Report writes are inserted into Supabase."), appEvidence("81087-81103", "Road hazard row exact shape."), appEvidence("81673-81689", "Clear event is a new pseudonymous report row with coordinates and expiry."), appEvidence("84469-84530", "Crossing reports calculate expiry and submit shared report fields."), appEvidence("42499-42520", "Realtime changes cause all shared reports to reload.")]
  };
  const inventory = {
    ...common, classification: "PRIVACY_ARCHITECTURE_AUDIT_COMPLETE_WITH_UNKNOWNS",
    truthBoundary: "Repository-observable current consumer behavior only; provider-side retention and deployed database policy are unknown.",
    dataClasses: [
      dataClass({ name: "precise_current_location", collected: true, source: "Browser Geolocation API", purpose: "Map centering, nearby context, reporting, routing, Route Watch", storage: "Runtime memory", retention: "LIFECYCLE_DERIVED: page/app runtime; Route Watch alias cleared when stopped", sentToServer: false, thirdPartyRecipients: ["OSRM when used as route origin/nearest input", "Nominatim when reverse geocoding is invoked"], linkedToIdentity: false, requiredForCoreFunction: false, deletionMechanism: "Stop Route Watch clears watch; app/page data ends runtime state", evidence: location.evidence, classification: "PRECISE_FOREGROUND_LOCATION" }),
      dataClass({ name: "community_report", collected: true, source: "User report workflow", purpose: "Shared roadway and crossing awareness", storage: "Supabase public.reports and runtime caches", retention: "UNKNOWN server deletion; active visibility is lifecycle-derived from expires_at", sentToServer: true, thirdPartyRecipients: ["Supabase"], linkedToIdentity: true, requiredForCoreFunction: true, deletionMechanism: "No consumer mechanism proven", evidence: community.evidence, classification: "PSEUDONYMOUS_USER_GENERATED_CONTENT" }),
      dataClass({ name: "persistent_device_identifier", collected: true, source: "crypto.randomUUID fallback Date.now", purpose: "Associate reports, duplicate suppression, scoped development cleanup", storage: "localStorage gridlyDeviceId; Supabase reports.device_id", retention: "PERSISTENT_UNTIL_APP_DATA_CLEAR locally; UNKNOWN on server", sentToServer: true, thirdPartyRecipients: ["Supabase"], linkedToIdentity: true, requiredForCoreFunction: true, deletionMechanism: "Clear site/app data locally; no consumer server deletion mechanism proven", evidence: [appEvidence("41886-41889", "Persistent device identifier is generated and saved."), appEvidence("81087-81103", "Identifier is attached to report rows.")], classification: "PSEUDONYMOUS_NOT_ANONYMOUS" }),
      dataClass({ name: "consumer_account_identity", collected: false, source: "none proven", purpose: "none", storage: "none proven", retention: "not_applicable", sentToServer: false, thirdPartyRecipients: [], linkedToIdentity: false, requiredForCoreFunction: false, deletionMechanism: "not_applicable", evidence: [evidence("package.json", "1-12", "No authentication dependency; runtime uses public Supabase client without account UI."), appEvidence("42499-42520", "Supabase initializes data/realtime without an auth flow.")], classification: "NO_ACCOUNT_LOGIN_EMAIL_PHONE_USERNAME_PASSWORD_OR_SOCIAL_IDENTITY_PROVEN" }),
      dataClass({ name: "saved_places_and_preferences", collected: true, source: "User selections", purpose: "Personalization, routes, notification preferences, map style", storage: "localStorage", retention: "PERSISTENT_UNTIL_CLEAR", sentToServer: false, thirdPartyRecipients: [], linkedToIdentity: false, requiredForCoreFunction: false, deletionMechanism: "In-app reset paths remove saved-place keys; clearing app/site data removes all", evidence: [appEvidence("45962-46007", "ZIP lookup result and home/work labels are used locally."), appEvidence("85471-85506", "Saved places persist in localStorage."), appEvidence("94619-94652", "Smart alert preferences persist locally.")], classification: "LOCAL_DEVICE_PREFERENCES" })
    ],
    accounts: { required: false, login: false, email: false, phone: false, username: false, password: false, socialIdentity: false, authenticationUsage: false },
    payments: { classification: "ABSENT", storeKit: false, googlePlayBilling: false, stripe: false, revenueCat: false, paddle: false, paypal: false, entitlements: false, paywall: false, receipts: false, trials: false, cancellation: false },
    localStorage: { present: true, relevant: ["gridlyDeviceId", "saved places/home/work", "home-town/profile/settings", "movement intelligence and commute baseline samples", "map style", "notification preferences", "UI seen/expanded flags", "crossing review decisions", "local feedback log"] },
    sessionStorage: { present: true, relevant: ["startup geolocation prompt guard", "first-run reset marker"] },
    indexedDB: false, cookies: false, nativeStorage: false, cacheStorage: "Service worker application-shell and fetched-asset caching; no proven user/device record cache schema",
    operationalRights: { dataAccess: false, dataDeletion: false, correction: false, reportRemoval: false, accountDeletion: "not_applicable_no_accounts" },
    dataSaleSharing: { sale: false, targetedAdvertisingSharing: false, dataBrokerTransfer: false, licensing: false, note: "No current repository implementation proven." },
    analytics: { googleAnalytics: "ABSENT", firebaseAnalytics: "ABSENT", metaPixel: "ABSENT", mixpanel: "ABSENT", amplitude: "ABSENT", posthog: "ABSENT", sentry: "ABSENT", datadog: "ABSENT", fullstory: "ABSENT", hotjar: "ABSENT", microsoftClarity: "ABSENT", ordinaryLoggingIsAnalytics: false },
    notifications: { browserNotificationApi: false, nativePush: false, tokens: false, externalProvider: false, preferenceUiOnly: true },
    materialPrivacyDefect: { found: true, finding: "Persistent device_id is attached to community reports; any anonymous-reporting characterization would be inaccurate. Expiry filtering does not prove deletion of expired server rows." },
    evidence: [appEvidence("113217-113226", "Runtime self-audit identifies geolocation, notification preference-only state, storage, and Supabase persistence."), evidence("package.json", "1-12", "Dependencies are Capacitor runtime packages only.")]
  };
  const thirdParty = {
    ...common, classification: "CURRENT_RUNTIME_NETWORK_INVENTORY",
    services: [
      { provider: "Supabase", purpose: "Shared reports, realtime changes, public roadway assets", dataSent: ["community report fields including coordinates and device_id", "database queries"], dataReceived: ["shared reports", "realtime change events", "public storage assets"], locationSent: true, userGeneratedContentSent: true, deviceIdentifierSent: true, evidence: community.evidence },
      { provider: "OSRM public demo server", purpose: "Routing and nearest-road snapping", dataSent: ["origin/destination coordinates", "tap/report candidate coordinates"], dataReceived: ["route geometry/duration/distance", "nearest road candidates"], locationSent: true, userGeneratedContentSent: false, deviceIdentifierSent: false, evidence: [appEvidence("16856-16857", "OSRM endpoints."), appEvidence("68596-68620", "Route coordinate URL."), appEvidence("79554-79570", "Nearest-road coordinate URL.")] },
      { provider: "OpenStreetMap Nominatim", purpose: "Reverse geocoding/search", dataSent: ["latitude/longitude for reverse lookup", "search query for forward lookup"], dataReceived: ["place/address candidates"], locationSent: true, userGeneratedContentSent: false, deviceIdentifierSent: false, evidence: [appEvidence("86976-86996", "Reverse geocode sends coordinate parameters.")] },
      { provider: "OpenStreetMap/Carto/Esri", purpose: "Map tiles and labels", dataSent: ["tile coordinates, IP and ordinary HTTP metadata"], dataReceived: ["map imagery/tiles"], locationSent: "unknown", userGeneratedContentSent: false, deviceIdentifierSent: false, evidence: [appEvidence("46834-46858", "Configured tile providers.")] },
      { provider: "DriveTexas/TxDOT", purpose: "Official roadway situations", dataSent: ["provider request and ordinary HTTP metadata"], dataReceived: ["roadway situation data"], locationSent: false, userGeneratedContentSent: false, deviceIdentifierSent: false, evidence: [appEvidence("98582-98583", "DriveTexas provenance is rendered for official records.")] },
      { provider: "Weather provider configured by runtime", purpose: "Weather awareness", dataSent: ["selected awareness location or provider query parameters"], dataReceived: ["weather observations/forecast"], locationSent: "unknown", userGeneratedContentSent: false, deviceIdentifierSent: false, evidence: [appEvidence("94353-94610", "Notification architecture consumes runtime weather/community state but does not deliver push.")] },
      { provider: "Zippopotam.us", purpose: "ZIP lookup", dataSent: ["ZIP code"], dataReceived: ["town/state lookup"], locationSent: false, userGeneratedContentSent: false, deviceIdentifierSent: false, evidence: [appEvidence("45962-45970", "ZIP code is placed in provider URL.")] },
      { provider: "data.transportation.gov", purpose: "FRA crossing fallback inventory", dataSent: ["Texas/Liberty query and ordinary HTTP metadata"], dataReceived: ["crossing GeoJSON"], locationSent: false, userGeneratedContentSent: false, deviceIdentifierSent: false, evidence: [appEvidence("21-22", "Transportation.gov crossing endpoint configured.")] }
    ], cloudflare: { classification: "PREVIEW_INFRASTRUCTURE_SEPARATE_FROM_CURRENT_CONSUMER_RUNTIME", consumerRuntimeDataFlowProven: false }
  };
  const native = {
    ...common, classification: "DECLARATIONS_DO_NOT_MATCH_WEB_RUNTIME_LOCATION_USE",
    android: { declared: [], locationRuntimeUseProven: true, backgroundLocationDeclared: false, notificationsDeclared: false, camera: false, photos: false, contacts: false, microphone: false, bluetooth: false, result: "No permissions declared; foreground web geolocation use is proven." },
    ios: { usageDescriptionKeys: [], locationRuntimeUseProven: true, backgroundModesLocation: false, notifications: false, camera: false, photos: false, contacts: false, microphone: false, bluetooth: false, result: "No native permission usage descriptions declared; foreground web geolocation use is proven." },
    evidence: [evidence("android/app/src/main/AndroidManifest.xml", "1-17", "No uses-permission elements."), evidence("ios/App/App/Info.plist", "1-18", "No privacy usage-description or background-mode keys."), appEvidence("48447-48457", "Runtime uses high-accuracy watchPosition.")]
  };
  const summary = {
    ...common, classification: inventory.classification, executionAuthorized: false, executionOccurred: false, deploymentOccurred: false,
    runtimeChanged: false, cloudflareChanged: false, authorizationsChanged: false,
    findings: { preciseLocation: true, routeWatchLiveForegroundLocation: true, backgroundLocation: false, currentLocationSentToSupabase: false, reportCoordinatesSentToSupabase: true, reportsPseudonymous: true, accounts: false, emailCollection: false, payments: "ABSENT", notifications: "PREFERENCE_UI_ONLY", analytics: "ABSENT", advertisingTracking: "ABSENT", dataSaleSharing: "NO_IMPLEMENTATION_PROVEN", serverRetentionAfterExpiry: "UNKNOWN", consumerDeletionRequestMechanism: false },
    protectedArtifactSha256: protectedHashes,
    sourceReports: ["data-inventory.json", "location-privacy-audit.json", "community-reporting-privacy-audit.json", "third-party-service-inventory.json", "native-permission-audit.json"]
  };
  return { "data-inventory.json": inventory, "location-privacy-audit.json": location, "community-reporting-privacy-audit.json": community, "third-party-service-inventory.json": thirdParty, "native-permission-audit.json": native, "lp1841a-summary.json": summary };
}

const canonical = value => `${JSON.stringify(value, null, 2)}\n`;
export async function run(mode = "verify") {
  const expected = await reports();
  if (mode === "build") { await mkdir(out, { recursive: true }); await Promise.all(Object.entries(expected).map(([name, value]) => writeFile(path.join(out, name), canonical(value), "utf8"))); }
  const mismatches = [];
  for (const [name, value] of Object.entries(expected)) { let actual = ""; try { actual = await readFile(path.join(out, name), "utf8"); } catch {} if (actual !== canonical(value)) mismatches.push(name); }
  if (mismatches.length) throw new Error(`LP184.1A deterministic verification failed: ${mismatches.join(", ")}`);
  console.log(`LP184.1A ${mode} passed (${Object.keys(expected).length} canonical reports).`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await run(process.argv[2] || "verify");
