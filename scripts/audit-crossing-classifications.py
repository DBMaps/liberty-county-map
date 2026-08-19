#!/usr/bin/env python3
"""Read-only inventory of classification fields in governed crossing packages."""

import collections
import glob
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ("TYPEXING", "POSXING", "XPURPOSE", "PRVCAT", "gridlyClassification")
AREAS = {
    "Baytown": ("harris", 29.7355047, -94.9774274, 70),
    "Dallas": ("dallas", 32.7933334, -96.7665128, 417),
    "Austin": ("travis", 30.2986219, -97.7541339, 135),
    "Liberty": ("liberty", 30.0572, -94.7950, 30),
}


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))["features"]


def values(features, field):
    return dict(sorted(collections.Counter(
        "<NULL>" if feature.get("properties", {}).get(field) is None
        else "<BLANK>" if str(feature["properties"].get(field, "")).strip() == ""
        else str(feature["properties"][field])
        for feature in features
    ).items()))


def distance(lat1, lon1, feature):
    lon2, lat2 = feature["geometry"]["coordinates"][:2]
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    return 3958.761 * 2 * math.asin(math.sqrt(
        math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    ))


def main():
    files = sorted(glob.glob(str(ROOT / "Crossing-Packages/*/Production/*-production-crossings.geojson")))
    statewide = [feature for path in files for feature in load(path)]
    result = {
        "governedPackageCount": len(files),
        "governedCrossingCount": len(statewide),
        "statewide": {field: values(statewide, field) for field in FIELDS},
        "counties": {},
        "awarenessCompositionDiagnostic": {},
    }
    for county in ("harris", "dallas", "travis", "liberty"):
        features = load(next((ROOT / "Crossing-Packages" / county / "Production").glob("*-production-crossings.geojson")))
        result["counties"][county] = {"total": len(features), **{field: values(features, field) for field in FIELDS}}
    # The certified UI totals are supplied as an audit invariant. Ordering by the
    # canonical place anchor is only a composition diagnostic, not a runtime rule.
    for label, (county, lat, lon, certified_count) in AREAS.items():
        features = load(next((ROOT / "Crossing-Packages" / county / "Production").glob("*-production-crossings.geojson")))
        nearest = sorted(features, key=lambda feature: distance(lat, lon, feature))[:certified_count]
        result["awarenessCompositionDiagnostic"][label] = {
            "certifiedCount": certified_count,
            "method": "nearest records to canonical anchor; diagnostic only",
            **{field: values(nearest, field) for field in FIELDS},
        }
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
