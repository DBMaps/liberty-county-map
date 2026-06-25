(function initGridlyPackageRegistry(globalScope) {
  "use strict";

  const GRIDLY_PACKAGE_TYPES = Object.freeze(["community", "transportation", "intelligence", "experience"]);
  const GRIDLY_PACKAGE_STATUSES = Object.freeze(["placeholder", "draft", "active", "paused", "deprecated", "reserved"]);
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
      regional: normalized.regional && typeof normalized.regional === "object" && !Array.isArray(normalized.regional) ? Object.freeze(Object.assign({}, normalized.regional)) : null
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
      regional: Object.freeze({ foundationId: "regional.southeast-texas", countyId: "liberty-tx", lifecycle: "production", activeImplementation: true, referenceImplementation: true, runtimeOwnershipMigrated: false }),
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
    { id: "community.montgomery-tx", name: "Montgomery", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", countyId: "montgomery-tx", lifecycle: "operational-maintenance", activeImplementation: false, runtimeOwnershipMigrated: false }) },
    { id: "community.san-jacinto-tx", name: "San Jacinto", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", countyId: "san-jacinto-tx", lifecycle: "operational-maintenance", activeImplementation: false, runtimeOwnershipMigrated: false }) },
    { id: "community.chambers-tx", name: "Chambers", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", countyId: "chambers-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }) },
    { id: "community.jefferson-tx", name: "Jefferson", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", countyId: "jefferson-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }) },
    { id: "community.hardin-tx", name: "Hardin", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", countyId: "hardin-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }) },
    { id: "community.orange-tx", name: "Orange", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", countyId: "orange-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }) },
    { id: "community.polk-tx", name: "Polk", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", countyId: "polk-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }) },
    { id: "community.tyler-tx", name: "Tyler", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", countyId: "tyler-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }) },
    { id: "community.walker-tx", name: "Walker", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", countyId: "walker-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }) },
    { id: "community.harris-tx", name: "Harris", packageType: "community", version: "0.0.0-regional-v747", status: "reserved", dependencies: [], capabilities: ["community-metadata", "regional-membership"], validationState: "valid", regional: Object.freeze({ foundationId: "regional.southeast-texas", countyId: "harris-tx", lifecycle: "planned", activeImplementation: false, runtimeOwnershipMigrated: false }) },
    { id: "intelligence.community-reports", name: "Community Reports", packageType: "intelligence", version: "0.0.0-placeholder", status: "placeholder", dependencies: [], capabilities: ["report-metadata"], validationState: "pending" }
  ]);


  const southeastTexasCommunityFoundation = Object.freeze({
    id: "regional.southeast-texas",
    name: "Southeast Texas Community Foundation",
    version: "0.1.0-v747",
    region: Object.freeze({ name: "Southeast Texas", state: "TX", role: "primary-operational-region" }),
    packageType: "regional-community-foundation",
    runtimeOwnership: Object.freeze({ transportationMigrated: false, intelligenceMigrated: false, experienceChanged: false }),
    communities: Object.freeze([
      Object.freeze({ countyId: "liberty-tx", packageId: "community.liberty-tx", lifecycle: "production", activeImplementation: true, referenceImplementation: true }),
      Object.freeze({ countyId: "montgomery-tx", packageId: "community.montgomery-tx", lifecycle: "operational-maintenance", activeImplementation: false, referenceImplementation: false }),
      Object.freeze({ countyId: "san-jacinto-tx", packageId: "community.san-jacinto-tx", lifecycle: "operational-maintenance", activeImplementation: false, referenceImplementation: false }),
      Object.freeze({ countyId: "chambers-tx", packageId: "community.chambers-tx", lifecycle: "planned", activeImplementation: false, referenceImplementation: false }),
      Object.freeze({ countyId: "jefferson-tx", packageId: "community.jefferson-tx", lifecycle: "planned", activeImplementation: false, referenceImplementation: false }),
      Object.freeze({ countyId: "hardin-tx", packageId: "community.hardin-tx", lifecycle: "planned", activeImplementation: false, referenceImplementation: false }),
      Object.freeze({ countyId: "orange-tx", packageId: "community.orange-tx", lifecycle: "planned", activeImplementation: false, referenceImplementation: false }),
      Object.freeze({ countyId: "polk-tx", packageId: "community.polk-tx", lifecycle: "planned", activeImplementation: false, referenceImplementation: false }),
      Object.freeze({ countyId: "tyler-tx", packageId: "community.tyler-tx", lifecycle: "planned", activeImplementation: false, referenceImplementation: false }),
      Object.freeze({ countyId: "walker-tx", packageId: "community.walker-tx", lifecycle: "planned", activeImplementation: false, referenceImplementation: false }),
      Object.freeze({ countyId: "harris-tx", packageId: "community.harris-tx", lifecycle: "planned", activeImplementation: false, referenceImplementation: false })
    ])
  });

  function validateRegionalCommunityFoundation(foundation, registryRef) {
    const communities = cloneArray(foundation?.communities);
    const missingPackages = communities.filter((community) => !registryRef.getPackage(community.packageId));
    const activeImplementations = communities.filter((community) => community.activeImplementation === true);
    return Object.freeze({
      valid: missingPackages.length === 0 && activeImplementations.length === 1 && activeImplementations[0]?.countyId === "liberty-tx",
      missingPackages: Object.freeze(missingPackages),
      activeImplementations: Object.freeze(activeImplementations.map((community) => community.countyId))
    });
  }

  const registry = createGridlyPackageRegistry(initialPackageMetadata);
  globalScope.GridlyPackageRegistry = Object.freeze({ create: createGridlyPackageRegistry, packageTypes: GRIDLY_PACKAGE_TYPES });
  globalScope.gridlyPackageRegistry = registry;
  globalScope.gridlyPackageRegistryAudit = function gridlyPackageRegistryAudit() { return registry.audit(); };
  globalScope.gridlySoutheastTexasCommunityFoundation = southeastTexasCommunityFoundation;
  globalScope.gridlyRegionalCommunityLookup = function gridlyRegionalCommunityLookup(countyId) { return southeastTexasCommunityFoundation.communities.find((community) => community.countyId === countyId) || null; };
  globalScope.gridlyRegionalCommunityFoundationValidation = function gridlyRegionalCommunityFoundationValidation() { return validateRegionalCommunityFoundation(southeastTexasCommunityFoundation, registry); };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createGridlyPackageRegistry, GRIDLY_PACKAGE_TYPES, initialPackageMetadata, southeastTexasCommunityFoundation, validateRegionalCommunityFoundation };
  }
})(typeof window !== "undefined" ? window : globalThis);
