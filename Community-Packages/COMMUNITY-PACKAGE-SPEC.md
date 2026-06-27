# Gridly Community Package Specification

## Purpose

Community Packages are deployment units produced by the Gridly Build System and consumed by the Gridly Runtime System.

The Build System manufactures Community Package assets from source datasets.

The Runtime System consumes registered Community Packages through the Package Registry.

---

## Architecture Flow

```text
Gridly Workspace
        │
        ▼
Community Package Builder
        │
        ▼
Community Packages
        │
        ▼
Package Registry
        │
        ▼
Runtime
        │
        ▼
Experience
```

---

## Community Package Ownership

Each Community Package owns:

- Boundary
- Road Network
- Railroads
- Rail Crossings
- Municipal Areas
- Awareness Areas
- Community Metadata
- Package Manifest

---

## Community Package Does NOT Own

A Community Package does **not** own:

- Runtime behavior
- Experience Layer
- Transportation Package metadata
- Intelligence provider configuration
- Trust
- Confidence
- Freshness

---

## Build System

The Build System owns:

- Source datasets
- Processing
- Package manufacturing
- Validation
- Runtime asset generation

Current Workspace:

```text
Gridly Workspace
│
├── OpenStreetMap
├── Census
├── FRA
├── NOAA
├── Processing
├── Community Package Builder
└── Build Scripts
```

---

## Runtime System

The Runtime System owns:

- Package Registry
- Runtime
- Experience

The Runtime consumes Community Packages.

---

## Manufacturing Flow

```text
Gridly Workspace
        │
        ▼
Community Package Builder
        │
        ▼
Community Packages
        │
        ▼
Package Registry
        │
        ▼
Runtime
        │
        ▼
Experience
```

---

## Current Manufacturing Status

| Community | Status |
|-----------|--------|
| Liberty | Operational |
| Montgomery | Operational |
| San Jacinto | Operational |
| Chambers | Roads Extracted |
| Jefferson | Building |
| Hardin | Pending |
| Polk | Pending |
| Walker | Pending |
| Harris (selected portions) | Planned |

---

## Guiding Principle

The Workspace manufactures packages.

The Package Registry registers packages.

The Runtime consumes packages.

The Experience presents packages.