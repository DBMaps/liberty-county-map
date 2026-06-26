(function initGridlyPackageRegistry(globalScope) {
  "use strict";

  const GRIDLY_PACKAGE_TYPES = Object.freeze(["community", "transportation", "intelligence", "experience"]);
  const GRIDLY_PACKAGE_STATUSES = Object.freeze(["placeholder", "draft", "active", "operational-maintenance", "paused", "deprecated", "reserved", "planned-foundation", "controlled-migrated"]);
  const GRIDLY_PACKAGE_VALIDATION_STATES = Object.freeze(["pending", "valid", "invalid"]);

  const cloneArray = (value) => Array.isArray(value) ? value.slice() : [];

  function normalizeDependency(dependency) {
    if (typeof dependency === "string") {
      return { id: dependency, version: null, optional: false };
    }
    if (dependency && typeof dependency === "object" && !Array.isArray(dependency)) {
      return {
        id: typeof dependency.id === "string" ? dependency.id : null,
        version: typeof dependency.version === "string" ? dependency.version : null,
        optional: dependency.optional === true
      };
    }
    return { id: null, version: null, optional: false };
  }

  function normalizePackageMetadata(metadata) {
    const normalized = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
    return Object.freeze({
      id: typeof normalized.id === "string" ? normalized.id.trim() : "",
      name: typeof normalized.name === "string" ? normalized.name.trim() : "",
      packageType: typeof normalized.packageType === "string" ? normalized.packageType.trim().toLowerCase() : "",
      version: typeof normalized.version === "string" ? normalized.version.trim() : "",
      status: typeof normalized.status === "string" ? normalized.status.trim().toLowerCase() : "placeholder",
      dependencies: Object.freeze(cloneArray(normalized.dependencies).map(normalizeDependency)),
      capabilities: Object.freeze(cloneArray(normalized.capabilities).filter((capability) => typeof capability === "string" && capability.trim()).map((capability) => capability.trim())),
      validationState: typeof normalized.validationState === "string" ? normalized.validationState.trim().toLowerCase() : "pending",
      community: normalized.community && typeof normalized.community === "object" && !Array.isArray(normalized.community) ? Object.freeze(Object.assign({}, normalized.community)) : null,
      ownership: normalized.ownership && typeof normalized.ownership === "object" && !Array.isArray(normalized.ownership) ? Object.freeze(Object.assign({}, normalized.ownership)) : null,
      regional: normalized.regional && typeof normalized.regional === "object" && !Array.isArray(normalized.regional) ? Object.freeze(Object.assign({}, normalized.regional)) : null,
      operationalRegion: normalized.operationalRegion && typeof normalized.operationalRegion === "object" && !Array.isArray(normalized.operationalRegion) ? Object.freeze(Object.assign({}, normalized.operationalRegion)) : null,
      transportation: normalized.transportation && typeof normalized.transportation === "object" && !Array.isArray(normalized.transportation) ? Object.freeze(Object.assign({}, normalized.transportation)) : null,
      intelligence: normalized.intelligence && typeof normalized.intelligence === "object" && !Array.isArray(normalized.intelligence) ? Object.freeze(Object.assign({}, normalized.intelligence)) : null
    });
  }

  function validatePackageMetadata(metadata, existingIds) {
    const issues = [];
    const duplicateIds = [];
    const dependencyIssues = [];
    const requiredFields = ["id", "name", "packageType", "version", "status", "dependencies", "capabilities", "validationState"];

    requiredFields.forEach((field) => {
      if (!(field in metadata) || metadata[field] === "" || metadata[field] === null || metadata[field] === undefined) {
        issues.push({ id: metadata.id || null, field, issue: "missing" });
      }
    });

    if (!GRIDLY_PACKAGE_TYPES.includes(metadata.packageType)) {
      issues.push({ id: metadata.id || null, field: "packageType", issue: "invalid" });
    }
    if (!GRIDLY_PACKAGE_STATUSES.includes(metadata.status)) {
      issues.push({ id: metadata.id || null, field: "status", issue: "invalid" });
    }
    if (!GRIDLY_PACKAGE_VALIDATION_STATES.includes(metadata.validationState)) {
      issues.push({ id: metadata.id || null, field: "validationState", issue: "invalid" });
    }
    if (existingIds.has(metadata.id)) {
      duplicateIds.push(metadata.id);
      issues.push({ id: metadata.id || null, field: "id", issue: "duplicate" });
    }
    if (!Array.isArray(metadata.dependencies)) {
      dependencyIssues.push({ id: metadata.id || null, dependency: null, issue: "dependencies must be an array" });
    } else {
      metadata.dependencies.forEach((dependency) => {
        if (!dependency || typeof dependency.id !== "string" || !dependency.id.trim()) {
          dependencyIssues.push({ id: metadata.id || null, dependency, issue: "dependency id must be a non-empty string" });
        }
        if (dependency.version !== null && typeof dependency.version !== "string") {
          dependencyIssues.push({ id: metadata.id || null, dependency, issue: "dependency version must be a string when provided" });
        }
      });
    }

    return Object.freeze({
      valid: issues.length === 0 && dependencyIssues.length === 0 && duplicateIds.length === 0,
      issues: Object.freeze(issues),
      duplicateIds: Object.freeze(duplicateIds),
      dependencyIssues: Object.freeze(dependencyIssues)
    });
  }

  function createGridlyPackageRegistry(initialPackages) {
    const packagesById = new Map();
    const invalidPackages = [];
    const duplicateIds = [];
    const dependencyIssues = [];

    function register(metadata) {
      const normalized = normalizePackageMetadata(metadata);
      const validation = validatePackageMetadata(normalized, packagesById);
      if (!validation.valid) {
        invalidPackages.push({ id: normalized.id || null, issues: validation.issues });
        duplicateIds.push(...validation.duplicateIds);
        dependencyIssues.push(...validation.dependencyIssues);
        return Object.freeze({ registered: false, package: normalized, validation });
      }
      const registeredPackage = Object.freeze(Object.assign({}, normalized, { validationState: "valid" }));
      packagesById.set(registeredPackage.id, registeredPackage);
      return Object.freeze({ registered: true, package: registeredPackage, validation });
    }

    function discover(criteria) {
      const filters = criteria && typeof criteria === "object" ? criteria : {};
      return Object.freeze(Array.from(packagesById.values()).filter((pkg) => {
        if (filters.packageType && pkg.packageType !== String(filters.packageType).toLowerCase()) return false;
        if (filters.status && pkg.status !== String(filters.status).toLowerCase()) return false;
        if (filters.capability && !pkg.capabilities.includes(String(filters.capability))) return false;
        return true;
      }));
    }

    function audit() {
      const packages = discover();
      const packageTypes = packages.reduce((summary, pkg) => {
        summary[pkg.packageType] = (summary[pkg.packageType] || 0) + 1;
        return summary;
      }, {});
      const validationPassed = duplicateIds.length === 0 && invalidPackages.length === 0 && dependencyIssues.length === 0;
      return Object.freeze({
        registryAvailable: true,
        packageCount: packages.length,
        packageTypes: Object.freeze(packageTypes),
        validationPassed,
        duplicateIds: Object.freeze(duplicateIds.slice()),
        invalidPackages: Object.freeze(invalidPackages.slice()),
        dependencyIssues: Object.freeze(dependencyIssues.slice()),
        safeForCommunityMigration: validationPassed && packages.some((pkg) => pkg.packageType === "community")
      });
    }

    const registry = Object.freeze({ register, discover, getPackage: (id) => packagesById.get(id) || null, getCommunityPackage: (countyId) => packagesById.get(`community.${countyId}`) || null, audit });
    cloneArray(initialPackages).forEach(register);
    return registry;
  }

  const initialPackageMetadata = Object.freeze([
    {
      id: "community.liberty-tx",
      name: "Liberty",
      packageType: "community",
      version: "1.0.0-v746",
      status: "active",
      dependencies: [],
      capabilities: ["community-identity", "administrative-boundary-relationship", "awareness-areas", "municipalities", "community-validation", "regional-membership"],
      validationState: "valid",
      community: Object.freeze({
        countyId: "liberty-tx",
        displayName: "Liberty",
        countyName: "Liberty County",
        state: "TX",
        administrativeBoundaryRelationship: Object.freeze({ countyId: "liberty-tx", boundaryPath: "data/liberty-county-boundary.geojson", relationship: "county-administrative-boundary" }),
        awarenessAreas: Object.freeze(["Entire Liberty County", "Dayton", "Liberty", "Cleveland", "Ames", "Hardin", "Devers", "Hull", "Daisetta", "Moss Hill", "Raywood", "Kenefick", "Tarkington"]),
        municipalities: Object.freeze(["Dayton", "Liberty", "Cleveland", "Ames", "Hardin", "Devers", "Hull", "Daisetta", "Moss Hill", "Raywood", "Kenefick", "Tarkington"]),
        productionEnabled: true,
        selectable: true,
        launchBaselineCompatible: true
      }),
      regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "liberty-tx", lifecycle: "production", activeImplementation: true, referenceImplementation: true, launchBaselineProtected: true, runtimeOwnershipMigrated: false }),
      operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "reference-community-package" }),
      ownership: Object.freeze({
        ownsCommunityIdentity: true,
        ownsAdministrativeBoundaryRelationship: true,
        ownsAwarenessAreas: true,
        ownsMunicipalities: true,
        ownsPackageMetadata: true,
        ownsValidationState: true,
        ownsRoads: false,
        ownsCorridors: false,
        ownsRail: false,
        ownsCrossings: false,
        ownsTransportationIntelligence: false,
        ownsIntelligenceObjects: false,
        ownsTrust: false,
        ownsPresentationBehavior: false,
        ownsMobileLayout: false,
        ownsDesktopLayout: false
      })
    },
    { id: "community.montgomery-tx", name: "Montgomery", packageType: "community", version: "0.0.0-regional-v749", status: "operational-maintenance", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "montgomery-tx", lifecycle: "operational-maintenance", activeImplementation: false, referenceImplementation: false, runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "operational-maintenance-community-package" }) },
    { id: "community.san-jacinto-tx", name: "San Jacinto", packageType: "community", version: "0.0.0-regional-v749", status: "operational-maintenance", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "san-jacinto-tx", lifecycle: "operational-maintenance", activeImplementation: false, referenceImplementation: false, runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "operational-maintenance-community-package" }) },
    { id: "community.chambers-tx", name: "Chambers", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "chambers-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-community-package" }) },
    { id: "community.jefferson-tx", name: "Jefferson", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "jefferson-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-community-package" }) },
    { id: "community.hardin-tx", name: "Hardin", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "hardin-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-community-package" }) },
    { id: "community.orange-tx", name: "Orange", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "orange-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-community-package" }) },
    { id: "community.polk-tx", name: "Polk", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "polk-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-community-package" }) },
    { id: "community.tyler-tx", name: "Tyler", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "tyler-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-community-package" }) },
    { id: "community.walker-tx", name: "Walker", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "walker-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-community-package" }) },
    { id: "community.harris-tx", name: "Harris", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "harris-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-community-package" }) },

    { id: "transportation.tx146", name: "TX146", packageType: "transportation", version: "0.0.0-v750-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["transportation-package-placeholder", "regional-corridor-metadata"], validationState: "valid", transportation: Object.freeze({ corridorId: "tx146", corridorName: "TX146", facilityType: "state-highway", regionRelationship: "planned-regional-corridor", supportedCommunities: Object.freeze(["liberty-tx", "chambers-tx", "harris-tx"]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, directionalDisplayAllowed: false, assetMigrationComplete: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-transportation-package" }) },
    { id: "transportation.us90", name: "US90", packageType: "transportation", version: "0.0.0-v750-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["transportation-package-placeholder", "regional-corridor-metadata"], validationState: "valid", transportation: Object.freeze({ corridorId: "us90", corridorName: "US90", facilityType: "us-highway", regionRelationship: "planned-regional-corridor", supportedCommunities: Object.freeze(["liberty-tx", "jefferson-tx", "harris-tx"]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, directionalDisplayAllowed: false, assetMigrationComplete: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-transportation-package" }) },
    { id: "transportation.us59-i69", name: "US59 / I69", packageType: "transportation", version: "0.0.0-v750-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["transportation-package-placeholder", "regional-corridor-metadata"], validationState: "valid", transportation: Object.freeze({ corridorId: "us59-i69", corridorName: "US59 / I69", facilityType: "interstate-us-highway-corridor", regionRelationship: "planned-regional-corridor", supportedCommunities: Object.freeze(["liberty-tx", "montgomery-tx", "san-jacinto-tx", "polk-tx", "harris-tx"]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, directionalDisplayAllowed: false, assetMigrationComplete: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-transportation-package" }) },
    { id: "transportation.i45", name: "I45", packageType: "transportation", version: "0.0.0-v750-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["transportation-package-placeholder", "regional-corridor-metadata"], validationState: "valid", transportation: Object.freeze({ corridorId: "i45", corridorName: "I45", facilityType: "interstate", regionRelationship: "planned-regional-corridor", supportedCommunities: Object.freeze(["montgomery-tx", "walker-tx", "harris-tx"]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, directionalDisplayAllowed: false, assetMigrationComplete: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-transportation-package" }) },
    { id: "transportation.i10", name: "I10", packageType: "transportation", version: "0.0.0-v750-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["transportation-package-placeholder", "regional-corridor-metadata"], validationState: "valid", transportation: Object.freeze({ corridorId: "i10", corridorName: "I10", facilityType: "interstate", regionRelationship: "planned-regional-corridor", supportedCommunities: Object.freeze(["chambers-tx", "jefferson-tx", "orange-tx", "harris-tx"]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, directionalDisplayAllowed: false, assetMigrationComplete: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-transportation-package" }) },
    { id: "transportation.tx105", name: "TX105", packageType: "transportation", version: "0.0.0-v750-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["transportation-package-placeholder", "regional-corridor-metadata"], validationState: "valid", transportation: Object.freeze({ corridorId: "tx105", corridorName: "TX105", facilityType: "state-highway", regionRelationship: "planned-regional-corridor", supportedCommunities: Object.freeze(["liberty-tx", "montgomery-tx"]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, directionalDisplayAllowed: false, assetMigrationComplete: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-transportation-package" }) },
    { id: "transportation.tx321", name: "TX321", packageType: "transportation", version: "0.0.0-v750-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["transportation-package-placeholder", "regional-corridor-metadata"], validationState: "valid", transportation: Object.freeze({ corridorId: "tx321", corridorName: "TX321", facilityType: "state-highway", regionRelationship: "planned-regional-corridor", supportedCommunities: Object.freeze(["liberty-tx"]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, directionalDisplayAllowed: false, assetMigrationComplete: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-transportation-package" }) },
    { id: "transportation.fm1960", name: "FM1960", packageType: "transportation", version: "0.0.0-v750-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["transportation-package-placeholder", "regional-corridor-metadata"], validationState: "valid", transportation: Object.freeze({ corridorId: "fm1960", corridorName: "FM1960", facilityType: "farm-to-market-road", regionRelationship: "planned-regional-corridor", supportedCommunities: Object.freeze(["liberty-tx", "harris-tx"]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, directionalDisplayAllowed: false, assetMigrationComplete: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-transportation-package" }) },
    { id: "transportation.fm1409", name: "FM1409", packageType: "transportation", version: "0.0.0-v750-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["transportation-package-placeholder", "regional-corridor-metadata"], validationState: "valid", transportation: Object.freeze({ corridorId: "fm1409", corridorName: "FM1409", facilityType: "farm-to-market-road", regionRelationship: "planned-regional-corridor", supportedCommunities: Object.freeze(["liberty-tx", "chambers-tx"]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, directionalDisplayAllowed: false, assetMigrationComplete: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-transportation-package" }) },
    { id: "transportation.fm1011", name: "FM1011", packageType: "transportation", version: "0.0.0-v750-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["transportation-package-placeholder", "regional-corridor-metadata"], validationState: "valid", transportation: Object.freeze({ corridorId: "fm1011", corridorName: "FM1011", facilityType: "farm-to-market-road", regionRelationship: "planned-regional-corridor", supportedCommunities: Object.freeze(["liberty-tx"]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, directionalDisplayAllowed: false, assetMigrationComplete: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-transportation-package" }) },
    { id: "intelligence.community-reports", name: "Community Reports", packageType: "intelligence", version: "0.0.0-v756-controlled-migration", status: "controlled-migrated", dependencies: ["regional.southeast-texas"], capabilities: ["intelligence-package-placeholder", "community-report-metadata", "community-reports-adapter-ready", "controlled-package-ownership", "ownership-active"], validationState: "valid", intelligence: Object.freeze({ providerId: "community-reports", providerName: "Community Reports", intelligenceCategory: "community-reporting", operationalRegionRelationship: "planned-regional-intelligence-provider", supportedCommunities: Object.freeze(["liberty-tx", "montgomery-tx", "san-jacinto-tx"]), supportedCommunityPackages: Object.freeze(["community.liberty-tx", "community.montgomery-tx", "community.san-jacinto-tx"]), supportedReportTypes: Object.freeze(["flooding", "crash", "disabled_vehicle", "debris", "road_closed", "construction", "traffic_backup", "rail_blockage_delay", "rail_issue", "other_hazard"]), supportedTransportationPackages: Object.freeze([]), lifecycleStatus: "foundation", adapterReady: true, migrationState: "controlled-migrated", ownershipScope: Object.freeze(["provider identity", "intelligence package metadata", "provider relationship metadata", "supported report type metadata", "supported community package metadata", "migration state", "validation state"]), runtimeOwnershipActive: true, providerMigrationComplete: true, behaviorChanged: false, writePathChanged: false, readPathChanged: false, alertGenerationChanged: false, communityPulseChanged: false, trustModelActive: false, freshnessModelActive: false, confidenceModelActive: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-intelligence-package" }) },
    { id: "intelligence.drivetexas", name: "DriveTexas", packageType: "intelligence", version: "0.0.0-v762-controlled-migration", status: "controlled-migrated", dependencies: ["regional.southeast-texas"], capabilities: ["intelligence-package-placeholder", "transportation-provider-metadata", "controlled-package-ownership", "ownership-active"], validationState: "valid", intelligence: Object.freeze({ providerId: "drivetexas", providerName: "DriveTexas", intelligenceCategory: "transportation-road-conditions", operationalRegionRelationship: "planned-regional-intelligence-provider", supportedCommunities: Object.freeze(["liberty-tx", "montgomery-tx", "san-jacinto-tx", "chambers-tx", "jefferson-tx", "hardin-tx", "orange-tx", "polk-tx", "tyler-tx", "walker-tx", "harris-tx"]), supportedTransportationPackages: Object.freeze(["transportation.tx146", "transportation.us90", "transportation.us59-i69", "transportation.i45", "transportation.i10", "transportation.tx105", "transportation.tx321", "transportation.fm1960", "transportation.fm1409", "transportation.fm1011"]), lifecycleStatus: "foundation", migrationState: "controlled-migrated", ownershipScope: Object.freeze(["provider identity", "package metadata", "provider relationship metadata", "supported intelligence metadata", "migration metadata", "validation metadata"]), runtimeOwnershipActive: true, providerMigrationComplete: true, runtimeActivationPerformed: false, transportationIntelligenceActivated: false, directionalIntelligenceActivated: false, behaviorChanged: false, alertGenerationChanged: false, readPathChanged: false, writePathChanged: false, communityPulseChanged: false, supabaseSchemaChanged: false, experienceOwnershipChanged: false, transportationOwnershipChanged: false, trustModelActive: false, freshnessModelActive: false, confidenceModelActive: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-intelligence-package" }) },
    { id: "intelligence.weather", name: "Weather", packageType: "intelligence", version: "0.0.0-v767-controlled-migration", status: "controlled-migrated", dependencies: ["regional.southeast-texas"], capabilities: ["intelligence-package-placeholder", "weather-provider-metadata", "controlled-package-ownership", "ownership-active"], validationState: "valid", intelligence: Object.freeze({ providerId: "weather", providerName: "Weather", intelligenceCategory: "weather-context", operationalRegionRelationship: "planned-regional-intelligence-provider", supportedCommunities: Object.freeze(["liberty-tx", "montgomery-tx", "san-jacinto-tx"]), supportedTransportationPackages: Object.freeze([]), lifecycleStatus: "foundation", migrationState: "controlled-migrated", ownershipScope: Object.freeze(["provider identity", "package metadata", "provider relationship metadata", "supported intelligence metadata", "migration metadata", "validation metadata"]), runtimeOwnershipActive: true, providerMigrationComplete: true, runtimeActivationPerformed: false, weatherRuntimeActivated: false, transportationIntelligenceActivated: false, directionalIntelligenceActivated: false, behaviorChanged: false, alertGenerationChanged: false, readPathChanged: false, writePathChanged: false, communityPulseChanged: false, supabaseSchemaChanged: false, experienceOwnershipChanged: false, transportationOwnershipChanged: false, trustModelActive: false, freshnessModelActive: false, confidenceModelActive: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-intelligence-package" }) },
    { id: "intelligence.rail", name: "Rail", packageType: "intelligence", version: "0.0.0-v751-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["intelligence-package-placeholder", "rail-provider-metadata"], validationState: "valid", intelligence: Object.freeze({ providerId: "rail", providerName: "Rail", intelligenceCategory: "rail-crossing-context", operationalRegionRelationship: "planned-regional-intelligence-provider", supportedCommunities: Object.freeze(["liberty-tx", "montgomery-tx", "san-jacinto-tx"]), supportedTransportationPackages: Object.freeze([]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, providerMigrationComplete: false, trustModelActive: false, freshnessModelActive: false, confidenceModelActive: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-intelligence-package" }) },
    { id: "intelligence.future-providers", name: "Future Providers", packageType: "intelligence", version: "0.0.0-v751-foundation", status: "planned-foundation", dependencies: ["regional.southeast-texas"], capabilities: ["intelligence-package-placeholder", "future-provider-metadata"], validationState: "valid", intelligence: Object.freeze({ providerId: "future-providers", providerName: "Future Providers", intelligenceCategory: "future-provider-readiness", operationalRegionRelationship: "planned-regional-intelligence-provider", supportedCommunities: Object.freeze([]), supportedTransportationPackages: Object.freeze([]), lifecycleStatus: "foundation", runtimeOwnershipActive: false, providerMigrationComplete: false, trustModelActive: false, freshnessModelActive: false, confidenceModelActive: false, validationState: "valid" }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "planned-intelligence-package" }) }
  ]);


  const SOUTHEAST_TEXAS_OPERATIONAL_REGION = Object.freeze({
    id: "operational-region.southeast-texas",
    name: "Southeast Texas Operational Region",
    blueprintAmendment: "Blueprint Amendment 002 — Operational Region",
    geographicRole: "highest-geographic-organizing-unit",
    constitutionalAuthority: "Blueprint",
    runtimeRegistrationAuthority: "Package Registry"
  });

  const southeastTexasCommunityFoundation = Object.freeze({
    id: "regional.southeast-texas",
    name: "Southeast Texas Community Foundation",
    version: "0.2.0-v749",
    packageType: "regional-community-foundation",
    operationalRegionId: SOUTHEAST_TEXAS_OPERATIONAL_REGION.id,
    operationalRegionName: SOUTHEAST_TEXAS_OPERATIONAL_REGION.name,
    blueprintAmendmentAlignment: SOUTHEAST_TEXAS_OPERATIONAL_REGION.blueprintAmendment,
    hierarchy: Object.freeze(["Operational Region", "Regional Community Foundation", "Community Packages", "Awareness Areas"]),
    registryDrivenMembership: true,
    permanentMembershipHardcoded: false,
    runtimeOwnership: Object.freeze({ transportationMigrated: false, intelligenceMigrated: false, experienceChanged: false })
  });

  function getRegionalCommunityPackages(foundation, registryRef) {
    if (!foundation || !registryRef || typeof registryRef.discover !== "function") return Object.freeze([]);
    return Object.freeze(registryRef.discover({ packageType: "community" }).filter((pkg) => pkg.regional?.foundationId === foundation.id && pkg.regional?.operationalRegionId === foundation.operationalRegionId));
  }

  function validateRegionalCommunityFoundation(foundation, registryRef) {
    const communities = getRegionalCommunityPackages(foundation, registryRef);
    const missingOperationalRegionLinks = communities.filter((pkg) => pkg.operationalRegion?.id !== foundation.operationalRegionId);
    const activeImplementations = communities.filter((pkg) => pkg.regional?.activeImplementation === true);
    const operationalMaintenance = communities.filter((pkg) => pkg.regional?.lifecycle === "operational-maintenance");
    const planned = communities.filter((pkg) => ["planned", "future", "onboarding"].includes(pkg.regional?.lifecycle));
    return Object.freeze({
      valid: foundation.operationalRegionId === SOUTHEAST_TEXAS_OPERATIONAL_REGION.id && foundation.registryDrivenMembership === true && foundation.permanentMembershipHardcoded === false && missingOperationalRegionLinks.length === 0 && activeImplementations.length === 1 && activeImplementations[0]?.regional?.countyId === "liberty-tx" && operationalMaintenance.every((pkg) => pkg.regional?.activeImplementation === false) && planned.every((pkg) => pkg.regional?.activeImplementation === false && pkg.status === "reserved"),
      operationalRegion: SOUTHEAST_TEXAS_OPERATIONAL_REGION,
      communityPackages: Object.freeze(communities),
      missingOperationalRegionLinks: Object.freeze(missingOperationalRegionLinks.map((pkg) => pkg.id)),
      activeImplementations: Object.freeze(activeImplementations.map((pkg) => pkg.regional?.countyId))
    });
  }


  function getTransportationFoundationPackages(registryRef) {
    if (!registryRef || typeof registryRef.discover !== "function") return Object.freeze([]);
    return Object.freeze(registryRef.discover({ packageType: "transportation" }).filter((pkg) => pkg.operationalRegion?.id === SOUTHEAST_TEXAS_OPERATIONAL_REGION.id && pkg.transportation?.lifecycleStatus === "foundation"));
  }

  function validateTransportationFoundation(registryRef) {
    const transportationPackages = getTransportationFoundationPackages(registryRef);
    const runtimeOwnershipMigrated = transportationPackages.some((pkg) => pkg.transportation?.runtimeOwnershipActive === true);
    const assetMigrationComplete = transportationPackages.some((pkg) => pkg.transportation?.assetMigrationComplete === true);
    const directionalDisplayAllowed = transportationPackages.some((pkg) => pkg.transportation?.directionalDisplayAllowed === true);
    const invalidPackages = transportationPackages.filter((pkg) => pkg.status !== "planned-foundation" || pkg.validationState !== "valid" || pkg.transportation?.validationState !== "valid");
    return Object.freeze({
      valid: transportationPackages.length === 10 && runtimeOwnershipMigrated === false && assetMigrationComplete === false && directionalDisplayAllowed === false && invalidPackages.length === 0,
      operationalRegion: SOUTHEAST_TEXAS_OPERATIONAL_REGION,
      transportationPackages,
      runtimeOwnershipMigrated,
      assetMigrationComplete,
      directionalDisplayAllowed,
      invalidPackages: Object.freeze(invalidPackages.map((pkg) => pkg.id))
    });
  }

  function getIntelligenceFoundationPackages(registryRef) {
    if (!registryRef || typeof registryRef.discover !== "function") return Object.freeze([]);
    return Object.freeze(registryRef.discover({ packageType: "intelligence" }).filter((pkg) => pkg.operationalRegion?.id === SOUTHEAST_TEXAS_OPERATIONAL_REGION.id && pkg.intelligence?.lifecycleStatus === "foundation"));
  }

  function validateIntelligenceFoundation(registryRef) {
    const intelligencePackages = getIntelligenceFoundationPackages(registryRef);
    const controlledMigratedProviderIds = Object.freeze(["community-reports", "drivetexas", "weather"]);
    const controlledMigratedPackages = intelligencePackages.filter((pkg) => controlledMigratedProviderIds.includes(pkg.intelligence?.providerId));
    const runtimeOwnershipMigrated = controlledMigratedPackages.some((pkg) => pkg.intelligence?.runtimeOwnershipActive === true);
    const providerMigrationComplete = controlledMigratedPackages.some((pkg) => pkg.intelligence?.providerMigrationComplete === true);
    const communityReportsControlledMigrated = intelligencePackages.some((pkg) => pkg.id === "intelligence.community-reports" && pkg.status === "controlled-migrated" && pkg.intelligence?.runtimeOwnershipActive === true && pkg.intelligence?.providerMigrationComplete === true && pkg.intelligence?.writePathChanged === false && pkg.intelligence?.readPathChanged === false && pkg.intelligence?.alertGenerationChanged === false && pkg.intelligence?.communityPulseChanged === false);
    const driveTexasControlledMigrated = intelligencePackages.some((pkg) => pkg.id === "intelligence.drivetexas" && pkg.status === "controlled-migrated" && pkg.intelligence?.runtimeOwnershipActive === true && pkg.intelligence?.providerMigrationComplete === true && pkg.intelligence?.runtimeActivationPerformed === false && pkg.intelligence?.transportationIntelligenceActivated === false && pkg.intelligence?.directionalIntelligenceActivated === false);
    const weatherControlledMigrated = intelligencePackages.some((pkg) => pkg.id === "intelligence.weather" && pkg.status === "controlled-migrated" && pkg.intelligence?.runtimeOwnershipActive === true && pkg.intelligence?.providerMigrationComplete === true && pkg.intelligence?.runtimeActivationPerformed === false && pkg.intelligence?.weatherRuntimeActivated === false && pkg.intelligence?.transportationIntelligenceActivated === false && pkg.intelligence?.directionalIntelligenceActivated === false);
    const trustModelActivated = intelligencePackages.some((pkg) => pkg.intelligence?.trustModelActive === true);
    const freshnessModelActivated = intelligencePackages.some((pkg) => pkg.intelligence?.freshnessModelActive === true);
    const confidenceModelActivated = intelligencePackages.some((pkg) => pkg.intelligence?.confidenceModelActive === true);
    const invalidPackages = intelligencePackages.filter((pkg) => {
      const providerId = pkg.intelligence?.providerId;
      const expectedStatus = controlledMigratedProviderIds.includes(providerId) ? "controlled-migrated" : "planned-foundation";
      return pkg.status !== expectedStatus || pkg.validationState !== "valid" || pkg.intelligence?.validationState !== "valid";
    });
    return Object.freeze({
      valid: intelligencePackages.length === 5 && communityReportsControlledMigrated === true && driveTexasControlledMigrated === true && weatherControlledMigrated === true && trustModelActivated === false && freshnessModelActivated === false && confidenceModelActivated === false && invalidPackages.length === 0,
      operationalRegion: SOUTHEAST_TEXAS_OPERATIONAL_REGION,
      intelligencePackages,
      runtimeOwnershipMigrated,
      providerMigrationComplete,
      communityReportsControlledMigrated,
      driveTexasControlledMigrated,
      weatherControlledMigrated,
      controlledMigratedProviderIds,
      trustModelActivated,
      freshnessModelActivated,
      confidenceModelActivated,
      invalidPackages: Object.freeze(invalidPackages.map((pkg) => pkg.id))
    });
  }

  const registry = createGridlyPackageRegistry(initialPackageMetadata);
  globalScope.GridlyPackageRegistry = Object.freeze({ create: createGridlyPackageRegistry, packageTypes: GRIDLY_PACKAGE_TYPES });
  globalScope.gridlyPackageRegistry = registry;
  globalScope.gridlyPackageRegistryAudit = function gridlyPackageRegistryAudit() { return registry.audit(); };
  globalScope.gridlySoutheastTexasCommunityFoundation = southeastTexasCommunityFoundation;
  globalScope.gridlySoutheastTexasOperationalRegion = SOUTHEAST_TEXAS_OPERATIONAL_REGION;
  globalScope.gridlyRegionalCommunityLookup = function gridlyRegionalCommunityLookup(countyId) { return getRegionalCommunityPackages(southeastTexasCommunityFoundation, registry).find((pkg) => pkg.regional?.countyId === countyId) || null; };
  globalScope.gridlyRegionalCommunityFoundationValidation = function gridlyRegionalCommunityFoundationValidation() { return validateRegionalCommunityFoundation(southeastTexasCommunityFoundation, registry); };
  globalScope.gridlyTransportationFoundationValidation = function gridlyTransportationFoundationValidation() { return validateTransportationFoundation(registry); };
  globalScope.gridlyIntelligenceFoundationValidation = function gridlyIntelligenceFoundationValidation() { return validateIntelligenceFoundation(registry); };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createGridlyPackageRegistry, GRIDLY_PACKAGE_TYPES, initialPackageMetadata, southeastTexasCommunityFoundation, validateRegionalCommunityFoundation, validateTransportationFoundation, validateIntelligenceFoundation, SOUTHEAST_TEXAS_OPERATIONAL_REGION };
  }
})(typeof window !== "undefined" ? window : globalThis);
