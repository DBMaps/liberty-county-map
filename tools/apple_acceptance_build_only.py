"""Build-only controls. No remote/store API, credential or distribution operations."""
import argparse
import contextlib
import hashlib
import io
import json
import plistlib
import re
import subprocess
import sys
import zipfile
from pathlib import Path

from apple_native_parity import approved_recovery_source, certify_native_parity, expected_app_identity, validate_recovery_build

SOURCE = "b7359198b99bb605e1fb2328e57e273dc37844b7"
BASE = "faac47368da3137b50d53813b7f0299a2f4b1830"
APPLE14 = "e0b51235e96ce1cc7fcae81781bbd21e95fb418a"
LEGAL = ("legal/privacy.html", "legal/terms.html", "legal/community-guidelines.html")
SHIPPING = ("js/app.js", "js/gridlyWeatherLiveConnector.js", "js/gridlyWeatherAuthoritySourceIntegration.js", "js/gridlyAlertsWeatherAuthorityHandoff.js")


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args]).decode().strip()


def require_recovery_build(source, build_number):
    """Refuse an archive whose version metadata silently disables recovery."""
    validate_recovery_build(source, build_number)


def preflight(root, build_number, source_commit):
    assert build_number == "16", "only proposed internal Build16 is permitted; no Build14/15 rebuild"
    assert re.fullmatch(r"[0-9a-f]{40}", source_commit) and git(root, "rev-parse", "HEAD") == source_commit, "wrong source commit"
    assert git(root, "merge-base", SOURCE, source_commit) == SOURCE, "certified integration ancestry missing"
    assert git(root, "merge-base", BASE, source_commit) == BASE
    assert git(root, "merge-base", APPLE14, source_commit) == APPLE14
    assert not git(root, "status", "--porcelain", "--untracked-files=no"), "dirty tracked source"
    native = root / "ios/App/App/GridlyBridgeViewController.swift"
    legacy = subprocess.check_output(["git", "-C", str(root), "show", APPLE14 + ":ios/App/App/GridlyBridgeViewController.swift"]).decode()
    assert native.read_text(encoding="utf-8") == approved_recovery_source(legacy), "native source differs beyond reviewed compatibility extension"
    for relative in SHIPPING:
        certified = subprocess.check_output(["git", "-C", str(root), "show", SOURCE + ":" + relative]).decode()
        assert (root / relative).read_text(encoding="utf-8") == certified, "certified performance/NWS source drift: " + relative
    require_recovery_build(native.read_text(encoding="utf-8"), build_number)
    return {"source": source_commit, "integrationSource": SOURCE, "build": build_number, "availability": "PROVISIONAL_NOT_VERIFIED_OR_RESERVED", "upload": False}


def attest(root, app, ipa, identity, build_number, source_commit):
    assert re.fullmatch(r"[0-9a-f]{40}", source_commit) and git(root, "rev-parse", "HEAD") == source_commit
    native = (root / "ios/App/App/GridlyBridgeViewController.swift").read_text(encoding="utf-8")
    legacy = subprocess.check_output(["git", "-C", str(root), "show", APPLE14 + ":ios/App/App/GridlyBridgeViewController.swift"]).decode()
    assert native == approved_recovery_source(legacy), "native source changed after preflight"
    require_recovery_build(native, build_number)
    manifest = json.loads(identity.read_text(encoding="utf-8"))
    assert manifest["candidateGitSha"] == source_commit and manifest["googleLicenseTest"] is False
    assert manifest["sourceGitState"]["trackedDirty"] is False, "uncommitted runtime source"
    assert manifest["sourceGitState"]["trackedDiffSha256"] == hashlib.sha256(b"").hexdigest()
    assert manifest.get("androidProduction", False) is False
    records = manifest["files"]
    assert len(records) == 1007 and len({r["path"] for r in records}) == 1007
    expected = expected_app_identity(build_number)
    with zipfile.ZipFile(ipa) as archive:
        infos = [n for n in archive.namelist() if re.fullmatch(r"Payload/[^/]+\.app/Info.plist", n)]
        assert len(infos) == 1
        prefix = infos[0].removesuffix("Info.plist") + "public/"
        for info in (plistlib.loads((app / "Info.plist").read_bytes()), plistlib.loads(archive.read(infos[0]))):
            assert {k: info.get(k) for k in expected} == expected
            assert info["MinimumOSVersion"] == "16.4"
        recorded = {r["path"] for r in records}
        packed = {n.removeprefix(prefix) for n in archive.namelist() if n.startswith(prefix) and not n.endswith("/")}
        native_paths = {p.relative_to(app / "public").as_posix() for p in (app / "public").rglob("*") if p.is_file()}
        assert native_paths == packed and recorded <= packed
        assert packed - recorded <= {"cordova.js", "cordova_plugins.js"}
        for record in records:
            relative = record["path"]
            assert not Path(relative).is_absolute() and ".." not in Path(relative).parts
            for body in ((root / "www" / relative).read_bytes(), (root / "ios/App/App/public" / relative).read_bytes(), (app / "public" / relative).read_bytes(), archive.read(prefix + relative)):
                assert len(body) == record["bytes"] and hashlib.sha256(body).hexdigest() == record["sha256"], relative
        for relative in LEGAL + SHIPPING:
            assert relative in recorded
            assert archive.read(prefix + relative) == (root / relative).read_bytes(), relative
    # Preserve the certified signature-neutral executable, certificate, profile,
    # entitlement and compiled recovery checks; only build metadata is parameterized.
    with contextlib.redirect_stdout(io.StringIO()):
        native_parity = certify_native_parity(app, ipa, root / "ios/App/App/GridlyBridgeViewController.swift", build_number)
    return {"source": source_commit, "integrationSource": SOURCE, "build": build_number, "buildAvailability": "PROVISIONAL_NOT_VERIFIED_OR_RESERVED", "bundle": "com.gridlygo.gridly", "team": "2XSH6R7K37", "ipaBytes": ipa.stat().st_size, "ipaSha256": hashlib.sha256(ipa.read_bytes()).hexdigest(), "files": len(records), "bundleDigest": manifest["bundleDigest"], "nativeCodeParity": native_parity["code_equal"], "uploaded": False, "retainedForDistribution": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("preflight", "attest"))
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--build-number", required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--app", type=Path)
    parser.add_argument("--ipa", type=Path)
    parser.add_argument("--identity", type=Path)
    args = parser.parse_args()
    try:
        result = preflight(args.source, args.build_number, args.source_commit) if args.command == "preflight" else attest(args.source, args.app, args.ipa, args.identity, args.build_number, args.source_commit)
        print(json.dumps(result, sort_keys=True))
    except AssertionError as error:
        # No raw signing command, profile or secret-bearing log is printed.
        print(str(error) or "BUILD_ONLY_CERTIFICATION_FAILED", file=sys.stderr)
        raise SystemExit(1)
