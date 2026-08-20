#!/usr/bin/env python3
"""Read-only, reproducible Recovery Audit 005 private-crossing decision evidence."""

import collections
import csv
import glob
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "reports/recovery-audit-005a-private-crossing-evidence.json"
MATRIX = ROOT / "reports/recovery-audit-005a-private-combination-matrix.csv"
COUNTIES = {"Harris": "harris", "Dallas": "dallas", "Travis": "travis", "Liberty": "liberty"}
AREAS = {
    "Baytown": ("Harris", 29.7355047, -94.9774274, 70),
    "Dallas": ("Dallas", 32.7933334, -96.7665128, 417),
    "Austin": ("Travis", 30.2986219, -97.7541339, 135),
    "Liberty": ("Liberty", 30.0572, -94.7950, 30),
}
PLACEHOLDER = re.compile(r"^(?:|N/?A|NONE|TBD|NOT YET REPORTED BY STATE|ST ?0+|CO ?0+|CR ?0+|LS ?0+|PV ?0+|0+|CROSSING)$", re.I)
PUBLIC_ROAD = re.compile(r"\b(?:PUBLIC|COUNTY ROAD|CO RD|CITY STREET|FM ?\d|US ?\d|SH ?\d|IH ?\d|INTERSTATE|HIGHWAY)\b", re.I)
PRIVATE = re.compile(r"\b(?:PRIVATE|PVT|PV 0+|PRIV)\b|\*PRIVATE", re.I)
INDUSTRIAL = re.compile(r"\b(?:INDUSTR|PLANT|MILL|MINE|QUARRY|CHEMICAL|REFINERY|WAREHOUSE|TERMINAL|PORT)\b", re.I)
FARM = re.compile(r"\b(?:FARM|FIELD|RANCH|AGRIC)\w*\b", re.I)
YARD_RAIL = re.compile(r"\b(?:RR ?YARD|RAIL ?YARD|YARD|RR USE ONLY|RR ONLY|RAILROAD USE|ALL PRIVATE IN YARD)\b", re.I)
SERVICE = re.compile(r"\b(?:MAINT|SERVICE|ACCESS|HAUL|TEMP|CONSTRUCTION)\w*\b", re.I)
DRIVEWAY = re.compile(r"\b(?:DRIVEWAY|DRIVE WAY|DRIVE|ENTRANCE)\b", re.I)
RESIDENTIAL = re.compile(r"\b(?:RESIDENT|HOME|HOUSE|SUBDIVISION|APARTMENT)\w*\b", re.I)
COMMERCIAL = re.compile(r"\b(?:COMMERCIAL|STORE|SHOP|BUSINESS)\b", re.I)


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))["features"]


def text(feature):
    p = feature["properties"]
    return " | ".join(str(p.get(k, "")).strip() for k in ("STREET", "HIGHWAY"))


def value_category(value):
    value = str(value or "").strip()
    if not value:
        return "BLANK"
    if PLACEHOLDER.match(value):
        return "PLACEHOLDER/UNKNOWN"
    tags = []
    for name, pattern in (("PRIVATE", PRIVATE), ("PUBLIC_ROAD", PUBLIC_ROAD), ("INDUSTRIAL", INDUSTRIAL),
                          ("FARM", FARM), ("YARD/RAIL_ONLY", YARD_RAIL), ("SERVICE/ACCESS", SERVICE),
                          ("DRIVEWAY", DRIVEWAY), ("RESIDENTIAL", RESIDENTIAL), ("COMMERCIAL", COMMERCIAL)):
        if pattern.search(value):
            tags.append(name)
    return "+".join(tags) if tags else "NAMED/UNSPECIFIED"


def purpose(feature):
    p, label = feature["properties"], text(feature)
    if p.get("XPURPOSE") == "2": return "PEDESTRIAN/PATHWAY (XPURPOSE=2)"
    if p.get("XPURPOSE") == "3": return "STATION (XPURPOSE=3)"
    for name, pattern in (("RAIL YARD/FACILITY (name evidence)", YARD_RAIL),
                          ("INDUSTRIAL (name evidence)", INDUSTRIAL), ("FARM/AGRICULTURAL (name evidence)", FARM),
                          ("MAINTENANCE/SERVICE/ACCESS (name evidence)", SERVICE), ("PRIVATE DRIVEWAY (name evidence)", DRIVEWAY),
                          ("RESIDENTIAL (name evidence)", RESIDENTIAL), ("COMMERCIAL (name evidence)", COMMERCIAL)):
        if pattern.search(label): return name
    return "ORDINARY/UNSPECIFIED HIGHWAY PURPOSE (XPURPOSE=1)"


def bucket(feature):
    """Conservative proposed product groups; evidence rules intentionally do not affect runtime."""
    p, label = feature["properties"], text(feature)
    if p.get("XPURPOSE") == "2" or YARD_RAIL.search(label): return "GROUP 4"
    if any(rx.search(label) for rx in (INDUSTRIAL, FARM, SERVICE, DRIVEWAY)): return "GROUP 3"
    street, highway = str(p.get("STREET", "")).strip(), str(p.get("HIGHWAY", "")).strip()
    if PUBLIC_ROAD.search(label) and not PRIVATE.search(label): return "GROUP 1"
    if ((street and not PLACEHOLDER.match(street) and not PRIVATE.search(street)) or
            (highway and not PLACEHOLDER.match(highway) and not PRIVATE.search(highway))): return "GROUP 2"
    return "GROUP 5"


def distance(lat1, lon1, feature):
    lon2, lat2 = feature["geometry"]["coordinates"][:2]
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2-lat1), math.radians(lon2-lon1)
    return 3958.761 * 2 * math.asin(math.sqrt(math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2))


def sample(feature):
    p = feature["properties"]
    return {k: p.get(k, "") for k in ("CROSSING", "COUNTYNAME", "STREET", "HIGHWAY", "TYPEXING", "XPURPOSE", "PRVCAT", "POSXING", "gridlyClassification")}


def main():
    paths = sorted(glob.glob(str(ROOT / "Crossing-Packages/*/Production/*-production-crossings.geojson")))
    all_rows = [f for path in paths for f in load(path)]
    private = [f for f in all_rows if str(f["properties"].get("TYPEXING", "")).strip().lower() == "private"]
    county_rows = {label: load(next((ROOT / "Crossing-Packages" / slug / "Production").glob("*-production-crossings.geojson"))) for label, slug in COUNTIES.items()}
    keys = lambda f: (f["properties"].get("TYPEXING", ""), f["properties"].get("XPURPOSE", ""), f["properties"].get("PRVCAT", ""),
                      f["properties"].get("POSXING", ""), value_category(f["properties"].get("HIGHWAY")),
                      value_category(f["properties"].get("STREET")), f["properties"].get("gridlyClassification", ""))
    combos = collections.Counter(keys(f) for f in private)
    with MATRIX.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, lineterminator="\n"); writer.writerow(("statewide_count", "TYPEXING", "XPURPOSE", "PRVCAT", "POSXING", "HIGHWAY_category", "STREET_category", "gridlyClassification"))
        for key, count in sorted(combos.items(), key=lambda item: (-item[1], item[0])): writer.writerow((count, *key))
    classifications = {}
    for cls in sorted({f["properties"].get("gridlyClassification", "") for f in private}):
        rows = [f for f in private if f["properties"].get("gridlyClassification", "") == cls]
        classifications[cls] = {"count": len(rows), "combinations": [{"count": n, "fields": dict(zip(("TYPEXING","XPURPOSE","PRVCAT","POSXING","HIGHWAY_category","STREET_category","gridlyClassification"), k))} for k,n in sorted(collections.Counter(keys(f) for f in rows).items(), key=lambda x:(-x[1],x[0]))], "samples": [sample(f) for f in rows[:3]]}
    groups = {}
    for group in ("GROUP 1", "GROUP 2", "GROUP 3", "GROUP 4", "GROUP 5"):
        rows = [f for f in private if bucket(f) == group]
        groups[group] = {"statewide": len(rows), **{name: sum(bucket(f)==group and f["properties"].get("TYPEXING")=="Private" for f in values) for name,values in county_rows.items()}, "samples": [sample(f) for f in rows[:3]]}
    awareness = {}
    for area,(county,lat,lon,count) in AREAS.items():
        diagnostic = sorted(county_rows[county], key=lambda f: distance(lat,lon,f))[:count]
        awareness[area] = {"certifiedBaseline": count, "method": "nearest-anchor composition diagnostic; not persisted runtime membership",
                           "privateByGroup": dict(collections.Counter(bucket(f) for f in diagnostic if f["properties"].get("TYPEXING")=="Private")),
                           "hypotheticalExcludeGroups3And4": count-sum(bucket(f) in ("GROUP 3","GROUP 4") for f in diagnostic if f["properties"].get("TYPEXING")=="Private")}
    public_norm = [f for f in private if f["properties"].get("gridlyClassification") == "PUBLIC_ROADWAY"]
    evidence = collections.Counter()
    for f in public_norm:
        p=f["properties"]; s=str(p.get("STREET","")).strip(); h=str(p.get("HIGHWAY","")).strip()
        evidence["both" if s and h else "STREET only" if s else "HIGHWAY only" if h else "neither"] += 1
        label=text(f)
        for name,rx in (("public access/road",PUBLIC_ROAD),("private access/road",PRIVATE),("industrial access",INDUSTRIAL),("driveway",DRIVEWAY),("service road/access",SERVICE)):
            if rx.search(label): evidence[name]+=1
    output = {"scope": {"packages": len(paths), "governed": len(all_rows), "sourcePrivate": len(private)},
              "privateNormalizedClassification": dict(collections.Counter(f["properties"].get("gridlyClassification","") for f in private)),
              "matrix": {"uniqueCombinations": len(combos), "path": str(MATRIX.relative_to(ROOT))},
              "purposeDistribution": dict(collections.Counter(purpose(f) for f in private)), "publicRoadwayNameEvidence": dict(evidence),
              "nonPublicPrivateBreakdown": classifications, "decisionGroups": groups, "awarenessDiagnostics": awareness}
    OUT.write_text(json.dumps(output, indent=2, sort_keys=True)+"\n", encoding="utf-8")
    print(json.dumps(output, indent=2, sort_keys=True))


if __name__ == "__main__": main()
