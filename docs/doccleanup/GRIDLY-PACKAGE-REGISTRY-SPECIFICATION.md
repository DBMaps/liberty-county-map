# GRIDLY Package Registry Specification

## 1. Purpose

This specification defines the contract for the Gridly Package Registry in the Southeast Texas Regional Foundation. The registry is the governed discovery and metadata layer for Community, Transportation, Intelligence, and Experience packages.

The registry does not implement runtime behavior. It defines how future implementation will discover packages, understand metadata, validate dependencies, enforce compatibility, and organize repository growth without changing the V740 Launch Baseline.

This document is architecture documentation only. It does not authorize JavaScript, CSS, HTML, Supabase, UI, migration, package loader, runtime registry, or feature changes.

## 2. Registry Philosophy

The registry exists to make package ownership explicit before implementation. It supports the permanent architecture:

```text
Community owns identity.
Transportation owns infrastructure.
Intelligence owns intelligence.
Experience consumes Intelligence.
```

The registry must describe packages. It must not become the owner of package domain assets. Registry records point to package contracts, versions, relationships, validation evidence, and compatibility metadata.

## 3. Package Discovery

Package discovery must be deterministic and governed. Future implementation may use registry files, manifests, build-time checks, validation tools, or runtime adapters, but discovery must respect ownership boundaries.

Discovery must answer:

- Which packages exist in a region?
- What layer owns each package?
- What version and status is each package in?
- What packages does it depend on?
- What validation and certification evidence exists?
- Which runtime or Experience consumers are allowed to read it?

Discovery must not create ownership or mutate packages.

## 4. Registration Model

Every registered package must declare:

- Package id.
- Package type: community, transportation, intelligence, or experience.
- Region id.
- Display name.
- Canonical slug.
- Version.
- Status.
- Owner.
- Source path.
- Specification version.
- Dependency declarations.
- Compatibility declarations.
- Validation evidence references.
- Certification evidence references.
- Runtime relationship notes.

Registration is a contract for future tooling. This milestone creates no runtime registry implementation.

## 5. Metadata

Registry metadata must be sufficient to validate package identity and relationships without loading presentation behavior.

Recommended metadata groups:

- Identity metadata.
- Ownership metadata.
- Layer metadata.
- Region metadata.
- Version metadata.
- Lifecycle metadata.
- Dependency metadata.
- Relationship metadata.
- Validation metadata.
- Certification metadata.
- Compatibility metadata.
- Runtime consumption metadata.
- Deprecation and migration notes where future implementation requires them.

## 6. Dependencies

Dependencies must be explicit and directional.

Allowed dependency patterns:

- Community Package to parent Region.
- Community Package to referenced Transportation, Intelligence, and Experience identifiers.
- Transportation Package to parent Region and referenced Community, Intelligence, Experience, or adjacent Transportation identifiers.
- Intelligence Package to provider metadata, parent Region, referenced Community identifiers, referenced Transportation identifiers, and Experience eligibility identifiers.
- Experience Package to Intelligence Package identifiers and approved consumption relationships.

Forbidden dependency patterns:

- Experience Package owning or mutating Intelligence.
- Intelligence Package owning Community identity or Transportation infrastructure.
- Community Package owning Transportation infrastructure or Intelligence Objects.
- Transportation Package owning Community identity or Intelligence Objects.
- County-specific duplication of regional transportation assets.
- Provider-specific duplication of transportation assets.
- Runtime UI code as a registry source of ownership.

## 7. Validation

Registry validation must confirm:

- Package ids are unique.
- Package types match allowed layers.
- Region references exist.
- Package paths are valid.
- Dependency declarations point to registered or approved external references.
- Dependencies do not violate ownership rules.
- Versions are parseable and compatible.
- Validation evidence is present for packages seeking certification.
- Certification evidence is present for production packages.
- Experience packages consume Intelligence without owning it.
- Runtime files are not required to establish package ownership.

## 8. Versioning

Registry versioning must preserve implementation safety and architectural traceability.

Required versioning concepts:

- Package version.
- Specification version.
- Registry schema version.
- Compatibility range.
- Certification version.
- Deprecated version metadata.
- Superseded package metadata where future migration requires it.

Version changes must not silently redefine ownership. Ownership changes require architecture governance review and, when necessary, Blueprint amendment records.

## 9. Compatibility

Compatibility metadata must explain which packages can safely work together. Compatibility checks must consider:

- Region compatibility.
- Layer compatibility.
- Specification compatibility.
- Dependency compatibility.
- Relationship schema compatibility.
- Validation schema compatibility.
- Experience consumption compatibility.
- Runtime adapter compatibility where future authorized implementation exists.

Compatibility must protect the rule that Experience consumes Intelligence and never owns Intelligence.

## 10. Future Expansion

The registry must support future expansion to:

- Additional Southeast Texas packages.
- Additional Texas regions.
- Future states.
- New Community Packages.
- New Transportation Packages.
- New Intelligence providers.
- New Experience Packages.
- Future package validation tools.
- Future certification workflows.
- Future runtime adapters.

Expansion must not require redesigning the platform around one county, one provider, one screen, or one runtime implementation.

## 11. Runtime Relationship

The registry may eventually be consumed by runtime adapters, build-time tools, validation tools, documentation generators, or deployment workflows. Runtime consumption must remain downstream of certified package metadata.

The registry must not be treated as permission to change current runtime behavior. Runtime work requires separate implementation authorization, validation, and release approval.

## 12. Repository Organization

Recommended future organization:

```text
/registry/
  package-registry.json
  schemas/
    package-registry.schema.json
    package-metadata.schema.json
  validation/
    checklist.md
    results.json

/regions/
  <region-id>/
    region.json

/community-packages/
  <region-id>/
    <community-package-id>/

/transportation-packages/
  <region-id>/
    corridors/
      <corridor-id>/

/intelligence-packages/
  <region-id>/
    <provider-id>/

/experience-packages/
  <region-id>/
    <experience-id>/
```

This organization is a contract for future implementation. It creates no package implementation in this milestone.

## 13. No Implementation in This Milestone

This specification does not create:

- Registry files.
- Runtime loaders.
- Package manifests.
- JavaScript adapters.
- CSS changes.
- HTML changes.
- Supabase tables.
- Data migrations.
- Feature behavior.
- UI behavior.

It only defines the contract that future registry implementation must follow.
