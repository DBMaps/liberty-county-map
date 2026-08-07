DRAFT — NOT LEGALLY APPROVED

Effective Date: [TO BE SET AT LEGAL APPROVAL]

# Location & Route Intelligence Disclosure

- Gridly may use precise foreground location for location-aware features.
- Route Watch may update foreground location while it is active. Monitoring stops when Route Watch stops.
- No background-location implementation is currently proven.
- Route or location coordinates may be sent to routing and geocoding services, including OSRM and Nominatim. Map providers also receive normal map requests.
- Report coordinates and a persistent pseudonymous device identifier may be stored through Supabase when a community report is submitted; reporting is not anonymous.
- Gridly cannot guarantee that every route, hazard, crossing, weather, or traffic condition is detected or accurate.
- Official signs, closures, gates, law-enforcement instructions, and traffic controls always take priority.
