#!/usr/bin/env python3
"""Read-only inventory helper for a locally supplied NAD R23 ZIP.

The tool deliberately writes only its JSON report. It never extracts or changes the
master archive. When GDAL's ogrinfo is installed, pass --schema to inspect FileGDB
layers through GDAL's /vsizip virtual filesystem.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def archive_inventory(path: Path) -> dict:
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        roots = sorted({PurePosixPath(item.filename).parts[0] for item in members if PurePosixPath(item.filename).parts})
        gdbs = sorted({
            "/".join(PurePosixPath(item.filename).parts[: index + 1])
            for item in members
            for index, part in enumerate(PurePosixPath(item.filename).parts)
            if part.lower().endswith(".gdb")
        })
        return {
            "archive": str(path.resolve()),
            "archiveType": "ZIP",
            "compressedBytesOnDisk": path.stat().st_size,
            "sha256": sha256(path),
            "memberCount": len(members),
            "memberCompressedBytes": sum(item.compress_size for item in members),
            "estimatedExtractedBytes": sum(item.file_size for item in members),
            "topLevelEntries": roots,
            "geodatabases": gdbs,
            "extensions": dict(sorted(Counter(PurePosixPath(item.filename).suffix.lower() or "[none]" for item in members if not item.is_dir()).items())),
            "members": [
                {
                    "path": item.filename,
                    "directory": item.is_dir(),
                    "compressedBytes": item.compress_size,
                    "extractedBytes": item.file_size,
                    "crc32": f"{item.CRC:08x}",
                }
                for item in members
            ],
        }


def inspect_schemas(path: Path, gdbs: list[str]) -> list[dict]:
    ogrinfo = shutil.which("ogrinfo")
    if not ogrinfo:
        raise RuntimeError("--schema requires GDAL ogrinfo on PATH")
    results = []
    for gdb in gdbs:
        datasource = f"/vsizip/{path.resolve().as_posix()}/{gdb}"
        command = [ogrinfo, "-ro", "-so", "-al", "-json", datasource]
        run = subprocess.run(command, capture_output=True, text=True, check=False)
        if run.returncode:
            raise RuntimeError(f"ogrinfo failed for {gdb}: {run.stderr.strip()}")
        results.append({"geodatabase": gdb, "datasource": datasource, "ogrinfo": json.loads(run.stdout)})
    return results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="path to the permanent NAD R23 ZIP")
    parser.add_argument("--output", type=Path, help="write JSON atomically (stdout when omitted)")
    parser.add_argument("--schema", action="store_true", help="include read-only GDAL FileGDB schema inspection")
    args = parser.parse_args(argv)
    if not args.archive.is_file():
        parser.error(f"archive not found: {args.archive}")
    if not zipfile.is_zipfile(args.archive):
        parser.error(f"not a ZIP archive: {args.archive}")
    if args.output and args.output.resolve() == args.archive.resolve():
        parser.error("output must not overwrite the master archive")

    report = archive_inventory(args.archive)
    if args.schema:
        report["schemas"] = inspect_schemas(args.archive, report["geodatabases"])
    rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.output.with_suffix(args.output.suffix + ".tmp")
        temporary.write_text(rendered, encoding="utf-8")
        temporary.replace(args.output)
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
