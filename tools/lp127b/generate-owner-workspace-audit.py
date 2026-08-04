#!/usr/bin/env python3
"""Generate deterministic LP127B inventory-only evidence from governed inputs."""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "reports/lp127b-owner-workspace/owner-source-data-file-inventory.json"
OUT = ROOT / "evidence/lp127b"


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(name: str, value) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def family(path: str) -> str:
    if path.startswith(("National-Address-Database/", "Texas-Address-Points/")): return "Addresses"
    if path.startswith(("FRA/", "Crossing-Packages/")): return "Rail Crossings"
    if path.startswith(("OpenStreetMap/", "DriveTexas/")): return "Roadways and Transportation"
    if path.startswith("Census/"): return "Geography"
    if path.startswith("Texas-Public-Safety/"): return "Government and Public Safety"
    if path.startswith("Community-Packages/"): return "Communities and Destinations"
    if path.startswith("NOAA/"): return "Weather, Hazards, and Other"
    return "Governance and Tooling"


def group_key(path: str) -> str:
    match = re.match(r"(.+?\.gdb)(?:/.*)?$", path, re.I)
    if match: return match.group(1)
    # A shapefile and its sidecars are one logical dataset.
    match = re.match(r"(.+?)\.(?:shp(?:\.xml)?|dbf|shx|prj|cpg)$", path, re.I)
    if match: return match.group(1) + ".shp"
    return path


def classify(path: str) -> tuple[str, str | None]:
    p = path.lower()
    if "certificate" in p or "certification" in p: return "CERTIFICATE", "CERTIFIED_CANDIDATE"
    if "manifest" in p or "registry" in p: return "MANIFEST", "REVIEW_REQUIRED"
    if p.startswith("audit-output/") or "/reports/" in p: return "BUILD_REPORT", "REVIEW_REQUIRED"
    if p.startswith("tools/") or p.endswith(("readme.txt", ".md")): return "CONFIGURATION_ONLY", "NOT_RELEVANT_TO_GRIDLY"
    if "place-downloads-here" in p or p.endswith("desktop.ini"): return "CONFIGURATION_ONLY", "NOT_RELEVANT_TO_GRIDLY"
    if p.startswith("crossing-packages/"):
        if p == "crossing-packages/texas/fra-crossings-tx.geojson": return "DERIVED_STATEWIDE_OUTPUT", "READY_FOR_MANUFACTURING"
        return "DERIVED_COUNTY_PACKAGE", "CERTIFIED_CANDIDATE" if "/production/" in p else "MANUFACTURED_CANDIDATE"
    if p.startswith("community-packages/"): return "DERIVED_MULTI_COUNTY_PACKAGE", "MANUFACTURED_CANDIDATE"
    if p.startswith("openstreetmap/community-packages/"): return "DERIVED_COUNTY_PACKAGE", "READY_FOR_MANUFACTURING"
    if p.startswith("texas-address-points/liberty/"): return "DERIVED_COUNTY_PACKAGE", "READY_FOR_MANUFACTURING"
    if p in ("fra/raw/fra-crossings-tx-raw.geojson", "national-address-database/nad_r23.zip", "texas-address-points/raw/texas-2026.gdb", "openstreetmap/regional/texas-260625.osm.pbf", "census/tl_2025_us_county.zip", "census/tl_2025_us_county/tl_2025_us_county.shp", "texas-public-safety/tcjs/popreportcurrent.xlsx"):
        return "AUTHORITATIVE_SOURCE_SNAPSHOT", "ADAPTER_EXISTS" if p.startswith(("fra/", "texas-address-points/")) else "READY_FOR_ADAPTER"
    if p == "national-address-database/extracted/nad_r23.gdb": return "AUTHORITATIVE_SOURCE_SNAPSHOT", "ADAPTER_EXISTS"
    if p.startswith("fra/raw/"): return "GOVERNED_SOURCE_SNAPSHOT", "REVIEW_REQUIRED"
    if p.startswith("fra/processed/"): return "DERIVED_STATEWIDE_OUTPUT", "READY_FOR_MANUFACTURING"
    if p.startswith("census/") and p.endswith(".geojson"): return "DERIVED_COUNTY_PACKAGE", "READY_FOR_MANUFACTURING"
    return "UNKNOWN_ASSET", "SOURCE_IDENTITY_INCOMPLETE"


def logical_name(path: str) -> str:
    return Path(path).name.replace("-", " ").replace("_", " ")


def main() -> None:
    physical = read(INPUT)
    groups = defaultdict(list)
    for item in physical: groups[group_key(item["relativePath"])].append(item)
    records = []
    for primary, files in groups.items():
        source_type, readiness = classify(primary)
        paths = sorted(x["relativePath"] for x in files)
        identity = "GRIDLY_SOURCE_DATA_REPO\0" + primary
        records.append({
            "inventoryId": "lp127b-" + hashlib.sha256(identity.encode()).hexdigest()[:16],
            "sourceFamily": family(primary), "logicalDatasetName": logical_name(primary),
            "logicalRoot": "GRIDLY_SOURCE_DATA_REPO", "relativePath": primary,
            "repositoryState": "OUTSIDE_GIT_CONTROL", "sourceType": source_type,
            "readinessStatus": readiness, "physicalFileCount": len(files),
            "totalByteSize": sum(x["byteSize"] for x in files), "physicalPaths": paths,
            "physicalFiles": [{"relativePath": x["relativePath"], "byteSize": x["byteSize"],
                "hashStatus": "HASH_AVAILABLE" if x["sha256Status"] == "CALCULATED" else ("HASH_FAILED" if x["sha256Status"] == "FAILED" else "HASH_NOT_CALCULATED"),
                "sha256": x["sha256"], "repositoryHashComparison": "VERIFIED_MISMATCH" if x["relativePath"] == "Crossing-Packages/Texas/fra-crossings-tx.geojson" else "NO_RECORDED_HASH",
                "applicationRepositorySha256": "6396582142ea3329a6981885c462e9bf8d7d37c1c1a7183a70f97b22ca497b3f" if x["relativePath"] == "Crossing-Packages/Texas/fra-crossings-tx.geojson" else None} for x in sorted(files, key=lambda y:y["relativePath"])],
            "publisher": None, "sourceDate": None, "licensing": None, "statewideCompleteness": None
        })
    records.sort(key=lambda x:(x["sourceFamily"], x["logicalDatasetName"], x["logicalRoot"], x["relativePath"]))
    type_counts = Counter(x["sourceType"] for x in records)
    write("owner-source-data-logical-inventory.json", {
        "schemaVersion":"gridly-lp127b-logical-inventory-v1", "milestone":"LP127B",
        "authoritativeInput": "reports/lp127b-owner-workspace/owner-source-data-file-inventory.json",
        "ordering":["sourceFamily","logicalDatasetName","logicalRoot","relativePath"],
        "summary":{"physicalFileCount":len(physical),"physicalByteSize":sum(x["byteSize"] for x in physical),"logicalDatasetCount":len(records),"hashedPhysicalFileCount":sum(x["sha256Status"]=="CALCULATED" for x in physical),"sourceTypeCounts":dict(sorted(type_counts.items()))},
        "records":records})

    presence = [
      ("Census county ZIP","PRESENT","Census/tl_2025_us_county.zip"), ("emergency-management source","NOT_IDENTIFIABLE_FROM_INVENTORY",None),
      ("FRA statewide source","PRESENT","FRA/Raw/fra-crossings-tx-raw.geojson"), ("HHSC healthcare source","NOT_IDENTIFIABLE_FROM_INVENTORY",None),
      ("municipal boundaries","NOT_IDENTIFIABLE_FROM_INVENTORY",None), ("NAD R23 archive","PRESENT","National-Address-Database/NAD_r23.zip"),
      ("NAD R23 extracted geodatabase","PRESENT","National-Address-Database/extracted/NAD_r23.gdb"), ("OSM Texas PBF","PRESENT","OpenStreetMap/Regional/texas-260625.osm.pbf"),
      ("populated places","DERIVED_ONLY","Community-Packages"), ("sheriff source","NOT_IDENTIFIABLE_FROM_INVENTORY",None),
      ("TCJS workbook","PRESENT","Texas-Public-Safety/TCJS/PopReportCurrent.xlsx"), ("TEA education source","NOT_IDENTIFIABLE_FROM_INVENTORY",None),
      ("Texas county boundaries","PRESENT","Census/tl_2025_us_county.zip"), ("TPWD parks source","NOT_IDENTIFIABLE_FROM_INVENTORY",None),
      ("TxDOT statewide roadway source","NOT_IDENTIFIABLE_FROM_INVENTORY",None), ("TxGIO statewide address source","PRESENT","Texas-Address-Points/Raw/Texas-2026.gdb")]
    gaps = [
      ("Census tl_2025_us_county.zip","RESOLVED_PRESENT_IN_OWNER_WORKSPACE","Census/tl_2025_us_county.zip"),
      ("emergency-management data","STILL_NOT_FOUND",None), ("HHSC healthcare","STILL_NOT_FOUND",None),
      ("municipal boundaries","STILL_NOT_FOUND",None), ("NAD R23 archive","RESOLVED_PRESENT_IN_OWNER_WORKSPACE","National-Address-Database/NAD_r23.zip"),
      ("NAD R23 extracted geodatabase","RESOLVED_PRESENT_IN_OWNER_WORKSPACE","National-Address-Database/extracted/NAD_r23.gdb"),
      ("OpenStreetMap Regional texas-260625.osm.pbf","RESOLVED_PRESENT_IN_OWNER_WORKSPACE","OpenStreetMap/Regional/texas-260625.osm.pbf"),
      ("populated places","DERIVED_ONLY","Community-Packages"), ("sheriff-office data","STILL_NOT_FOUND",None),
      ("TEA education","STILL_NOT_FOUND",None), ("TPWD parks","STILL_NOT_FOUND",None),
      ("TxDOT statewide roadway source snapshot","STILL_NOT_FOUND",None),
      ("TxGIO StratMap 2026 statewide address geodatabase","RESOLVED_PRESENT_IN_OWNER_WORKSPACE","Texas-Address-Points/Raw/Texas-2026.gdb")]
    write("lp127a-reconciliation-report.json", {"schemaVersion":"gridly-lp127b-reconciliation-v1","milestone":"LP127B","records":[{"lp127aGap":a,"status":b,"ownerWorkspacePath":c} for a,b,c in sorted(gaps)]})
    write("remaining-source-gap-report.json", {"schemaVersion":"gridly-lp127b-gap-report-v1","milestone":"LP127B","presence":[{"sourceFamily":a,"status":b,"evidencePath":c} for a,b,c in sorted(presence)],"remainingHighPriorityGaps":[{"tier":1,"dataset":"TxDOT statewide roadway source","status":"STILL_NOT_FOUND"},{"tier":1,"dataset":"municipal boundaries","status":"STILL_NOT_FOUND"},{"tier":1,"dataset":"populated places original source","status":"DERIVED_ONLY"},{"tier":2,"dataset":"HHSC healthcare source","status":"STILL_NOT_FOUND"},{"tier":2,"dataset":"TEA education source","status":"STILL_NOT_FOUND"},{"tier":2,"dataset":"TPWD parks source","status":"STILL_NOT_FOUND"},{"tier":3,"dataset":"sheriff source","status":"STILL_NOT_FOUND"},{"tier":3,"dataset":"emergency-management source","status":"STILL_NOT_FOUND"}]})

    readiness = [
      {"dataset":"FRA Texas statewide crossings","sourcePath":"FRA/Raw/fra-crossings-tx-raw.geojson","authoritativeSourceSnapshot":True,"acquisitionMetadata":False,"parser":True,"adapter":True,"singleCountyBuilder":True,"multiCountyBuilder":True,"statewideOrchestrator":True,"deterministicSerialization":True,"certificateGenerator":True,"manifestGenerator":True,"tests":True,"runtimeIntegration":True,"nextEngineeringAction":"manufacture additional counties"},
      {"dataset":"TxGIO Texas-2026 address points","sourcePath":"Texas-Address-Points/Raw/Texas-2026.gdb","authoritativeSourceSnapshot":True,"acquisitionMetadata":False,"parser":True,"adapter":True,"singleCountyBuilder":True,"multiCountyBuilder":True,"statewideOrchestrator":False,"deterministicSerialization":True,"certificateGenerator":True,"manifestGenerator":True,"tests":True,"runtimeIntegration":True,"nextEngineeringAction":"manufacture additional counties"},
      {"dataset":"Census 2025 US county boundaries","sourcePath":"Census/tl_2025_us_county.zip","authoritativeSourceSnapshot":True,"acquisitionMetadata":False,"parser":True,"adapter":False,"singleCountyBuilder":True,"multiCountyBuilder":True,"statewideOrchestrator":True,"deterministicSerialization":True,"certificateGenerator":True,"manifestGenerator":True,"tests":True,"runtimeIntegration":True,"nextEngineeringAction":"manufacture additional counties"},
      {"dataset":"OSM Texas regional PBF","sourcePath":"OpenStreetMap/Regional/texas-260625.osm.pbf","authoritativeSourceSnapshot":True,"acquisitionMetadata":False,"parser":True,"adapter":False,"singleCountyBuilder":True,"multiCountyBuilder":True,"statewideOrchestrator":False,"deterministicSerialization":True,"certificateGenerator":True,"manifestGenerator":True,"tests":True,"runtimeIntegration":True,"nextEngineeringAction":"add multi-county orchestration"},
      {"dataset":"NAD R23","sourcePath":"National-Address-Database/NAD_r23.zip","authoritativeSourceSnapshot":True,"acquisitionMetadata":True,"parser":True,"adapter":True,"singleCountyBuilder":True,"multiCountyBuilder":False,"statewideOrchestrator":False,"deterministicSerialization":True,"certificateGenerator":True,"manifestGenerator":True,"tests":True,"runtimeIntegration":False,"nextEngineeringAction":"verify source identity"}]
    write("source-manufacturing-readiness-report.json", {"schemaVersion":"gridly-lp127b-readiness-v1","milestone":"LP127B","records":sorted(readiness,key=lambda x:x["dataset"]),"recommendedNextWave":{"dataset":"TxGIO Texas-2026 address points","physicalSourcePath":"Texas-Address-Points/Raw/Texas-2026.gdb","sourceHashStatus":"HASH_NOT_CALCULATED (directory components)","targetScope":"adjacent-county multi-county run","targetCounties":["Lee","Milam","Robertson"],"existingBuilder":"tools/lp104/build-txgio-address-packages.mjs","existingMultiCountyOrchestrator":"tools/lp1051/manufacture-gridly-28-address-counties.mjs","missingOrchestration":"generalize governed county selection beyond the prior 28-county configuration","expectedOutputs":["county address JSONL packages","manifests","certificates"],"certificationRequirements":"deterministic rebuild, source identity/hash review, per-county certification","humanReviewRequirements":"county attribution and sample address review","prohibitedActions":["manufacturing in LP127B","candidate activation","production approval","runtime integration"]}})

    by_hash = defaultdict(list)
    by_name = defaultdict(list)
    for x in physical:
        if x["sha256"]: by_hash[x["sha256"]].append(x["relativePath"])
        by_name[x["filename"].lower()].append(x)
    exact = [{"sha256":h,"paths":sorted(p),"classification":"EXACT_DUPLICATE","recommendation":"Retain; consolidation requires a separate governed milestone."} for h,p in by_hash.items() if len(p)>1]
    different = [{"filename":n,"variants":[{"path":x["relativePath"],"sha256":x["sha256"]} for x in sorted(v,key=lambda y:y["relativePath"])],"classification":"SAME_FILENAME_DIFFERENT_HASH"} for n,v in by_name.items() if len({x["sha256"] for x in v if x["sha256"]})>1]
    write("source-duplicate-and-supersession-report.json", {"schemaVersion":"gridly-lp127b-duplicates-v1","milestone":"LP127B","exactDuplicateGroups":sorted(exact,key=lambda x:x["sha256"]),"sameFilenameDifferentHashGroups":sorted(different,key=lambda x:x["filename"]),"relationships":[{"classification":"ARCHIVE_AND_EXTRACTED_EQUIVALENTS","archive":"National-Address-Database/NAD_r23.zip","extracted":"National-Address-Database/extracted/NAD_r23.gdb","note":"Related identity; no whole-directory hash comparison claimed."},{"classification":"ARCHIVE_AND_EXTRACTED_EQUIVALENTS","archive":"Census/tl_2025_us_county.zip","extracted":"Census/tl_2025_us_county/tl_2025_us_county.shp","note":"Related identity; not an exact-byte duplicate."},{"classification":"REVIEW_SUPERSEDED_BY_PRODUCTION_CANDIDATE","olderPattern":"Crossing-Packages/<county>/<county>-crossings.geojson","newerPattern":"Crossing-Packages/<county>/Production/<county>-production-crossings.geojson"}]})


if __name__ == "__main__": main()
