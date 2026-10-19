"""Isolated StoreKit diagnostic certification. Original Build 14 contracts are read-only.

Standard library only. No Apple service calls, upload, credential retrieval or release actions.
The macOS-only commands inspect local signed artifacts and compile a Foundation policy fixture.
"""
import argparse
import hashlib
import json
import os
import plistlib
import re
import shutil
import subprocess
import tempfile
import textwrap
import zipfile
from pathlib import Path
import apple_native_parity as release

BASE = "e0b51235e96ce1cc7fcae81781bbd21e95fb418a"
FLAG = "GRIDLY_STOREKIT_DIAGNOSTICS"
FAILURE = "explicit clear removes exactly one key and the real Retry CTA; all other persistence is byte-identical"
ALLOWED = {
    "ios/App/App/GridlyStoreKitPlugin.swift", "js/gridly-apple-storekit.mjs",
    "js/gridly-paid-access.mjs", "js/gridly-paid-ui.mjs",
    "tests/storekit-diagnostics.test.mjs", "tests/storekit-diagnostics-native.test.py",
    ".github/workflows/gridly-storekit-diagnostic-certification.yml",
    "tools/apple_storekit_diagnostic_certification.py",
}
BASELINE_INPUTS = ["tests/build13-native-pending-recovery.test.cjs", "ios/App/App/GridlyBridgeViewController.swift", "js/app.js", "js/gridly-report-protocol.js"]


def git(*args):
    return subprocess.check_output(["git", *args])


def build_number(value):
    if not re.fullmatch(r"[1-9][0-9]{0,8}", str(value)) or int(value) <= 14:
        raise ValueError("Owner-confirmed diagnostic build number must be an integer greater than 14")
    return str(value)


TAG_PREFIX = "refs/tags/gridly-storekit-diagnostic-certify-"
DIAGNOSTIC_BRANCH = "refs/remotes/origin/codex/storekit-diagnostics"


def unique_json_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate authorization field")
        result[key] = value
    return result


def authorize_tag(ref, event_commit):
    """Fail closed before build/signing; parse tag data, never execute annotation text."""
    match = re.fullmatch(re.escape(TAG_PREFIX) + r"([1-9][0-9]{0,8})-([0-9a-f]{40})", ref or "")
    assert match, "dedicated certification tag with build number and exact commit required"
    number, commit = build_number(match[1]), match[2]
    assert event_commit == commit == git("rev-parse", "HEAD").decode().strip(), "tag/event/checkout commit mismatch"
    assert git("rev-parse", "--verify", DIAGNOSTIC_BRANCH).decode().strip() == commit, "tag must pin the pushed diagnostic branch head"
    assert git("cat-file", "-t", ref).decode().strip() == "tag", "annotated authorization tag required"
    header, separator, annotation = git("cat-file", "-p", ref).decode().partition("\n\n")
    assert separator and header.splitlines()[:3] == ["object " + commit, "type commit", "tag " + ref.removeprefix("refs/tags/")], "authorization must tag the exact commit directly"
    authorization = json.loads(annotation, object_pairs_hook=unique_json_object)
    expected_fields = {"candidate_commit", "diagnostic_build_number", "unused_build_number_confirmed", "baseline_exception_acknowledged", "certification_authorized"}
    assert isinstance(authorization, dict) and set(authorization) == expected_fields, "exact authorization fields required"
    assert authorization["candidate_commit"] == commit and authorization["diagnostic_build_number"] == number, "annotation identity mismatch"
    for field in ("unused_build_number_confirmed", "baseline_exception_acknowledged", "certification_authorized"):
        assert authorization[field] is True, "explicit owner confirmation required: " + field
    return {"source_commit": commit, "build": number, "authorization_tag": ref,
            "tag_object": git("rev-parse", "--verify", ref).decode().strip(),
            "diagnostic_branch": DIAGNOSTIC_BRANCH, **authorization}


def original_contracts():
    for path in [".github/workflows/gridly-apple-build-9.yml", "tools/apple_native_parity.py", *BASELINE_INPUTS]:
        assert Path(path).read_bytes().replace(b"\r\n", b"\n") == git("show", BASE + ":" + path).replace(b"\r\n", b"\n"), "protected Build 14 source changed: " + path


def preflight(commit, number):
    build_number(number)
    assert re.fullmatch(r"[0-9a-f]{40}", commit), "exact candidate SHA required"
    assert git("rev-parse", "HEAD").decode().strip() == commit, "wrong candidate HEAD"
    subprocess.run(["git", "merge-base", "--is-ancestor", BASE, "HEAD"], check=True)
    changes = set(git("diff", "--name-only", BASE, "HEAD").decode().splitlines())
    assert changes and changes <= ALLOWED, "candidate exceeds authorized diagnostic inventory"
    assert not git("status", "--porcelain=v1", "--untracked-files=normal"), "candidate must be frozen and clean"
    original_contracts()
    return {"source_commit": commit, "build": number, "authorized_files": sorted(changes), "original_contracts_unchanged": True}


def check_regressions(tap, exit_code, acknowledged):
    original_contracts()
    text = Path(tap).read_text()
    failed = re.findall(r"^not ok \d+ - (.+)$", text, re.M)
    totals = re.findall(r"^# tests (\d+)$", text, re.M)
    failures = re.findall(r"^# fail (\d+)$", text, re.M)
    assert len(totals) == len(failures) == 1, "missing or ambiguous complete TAP summary"
    count = int(failures[0])
    assert int(totals[0]) > 0 and count == len(failed), "invalid TAP totals"
    assert not re.search(r"^# (?:cancelled|skipped|todo) [1-9]", text, re.M), "incomplete regression execution"
    if exit_code == 0:
        assert count == 0, "inconsistent regression exit"
        status = "passed"
    else:
        assert acknowledged and exit_code == 1 and failed == [FAILURE], "new regression or unacknowledged baseline exception"
        status = "baseline_exception"
    return {"status": status, "exit_code": exit_code, "tests": int(totals[0]), "failures": failed, "unmodified_baseline_inputs": True, "suite_green": status == "passed"}


def activation_proof(number):
    """Compile the exact policy twice and execute it in synthetic macOS bundles."""
    number = build_number(number)
    source = Path("ios/App/App/GridlyStoreKitPlugin.swift").read_text()
    policy = source.split("// BEGIN TESTABLE STORE DIAGNOSTICS\n", 1)[1].split("// END TESTABLE STORE DIAGNOSTICS", 1)[0]
    assert shutil.which("swiftc"), "macOS Swift compiler required"
    results = []
    with tempfile.TemporaryDirectory(prefix="gridly-storekit-activation-") as temporary:
        root = Path(temporary)
        swift = root / "Policy.swift"
        swift.write_text('import Foundation\n' + policy + '\nprint(GridlyStoreDiagnosticPolicy.enabled ? "enabled" : "disabled")\n')
        for enabled in (False, True):
            executable = root / ("flag-on" if enabled else "flag-off")
            subprocess.run(["swiftc", *(["-D", FLAG] if enabled else []), str(swift), "-o", str(executable)], check=True)
            for label, bundle, version, expected in [
                ("candidate", release.BUNDLE, number, enabled),
                ("approved", release.BUNDLE, "14", False),
                ("wrong-bundle", "invalid.fixture", number, False),
                ("missing-build", release.BUNDLE, None, False),
            ]:
                app = root / (("on-" if enabled else "off-") + label + ".app")
                binary = app / "Contents/MacOS/Probe"
                binary.parent.mkdir(parents=True)
                shutil.copy2(executable, binary)
                info = {"CFBundleExecutable": "Probe", "CFBundleIdentifier": bundle, "CFBundlePackageType": "APPL", "CFBundleShortVersionString": "1.0.0"}
                if version is not None:
                    info["CFBundleVersion"] = version
                (app / "Contents/Info.plist").write_bytes(plistlib.dumps(info))
                actual = subprocess.check_output([str(binary)], text=True).strip()
                assert actual == ("enabled" if expected else "disabled"), "diagnostic activation policy mismatch"
                results.append({"flag": enabled, "fixture": label, "result": actual})
    return {"build_number": number, "policy_sha256": release.sha256(policy.encode()), "cases": results, "all_passed": True}


def diagnostic_signed_facts(app, prefix, number):
    """Same signing/profile/entitlement checks as Build 14; separate expected build."""
    subprocess.run(["codesign", "--verify", "--deep", "--strict", "--verbose=2", str(app)], check=True)
    result = subprocess.run(["codesign", "-d", "--verbose=4", str(app)], check=True, capture_output=True, text=True)
    metadata = result.stderr.splitlines() + result.stdout.splitlines()
    assert "Identifier=" + release.BUNDLE in metadata and "TeamIdentifier=" + release.TEAM in metadata
    assert "Authority=" + release.AUTHORITY in metadata
    subprocess.run(["codesign", "-d", "--extract-certificates=" + str(prefix), str(app)], check=True)
    assert hashlib.sha1(Path(str(prefix) + "0").read_bytes()).hexdigest().upper() == release.CERT_SHA1
    entitlements = plistlib.loads(subprocess.check_output(["codesign", "-d", "--entitlements", ":-", str(app)], stderr=subprocess.DEVNULL))
    release.validate_entitlements(entitlements)
    profile = plistlib.loads(subprocess.check_output(["security", "cms", "-D", "-i", str(app / "embedded.mobileprovision")]))
    assert profile["Name"] == "Gridly App Store Build 9" and profile["UUID"] == release.PROFILE_UUID
    assert profile["TeamIdentifier"] == [release.TEAM] and profile["Entitlements"]["application-identifier"] == release.TEAM + "." + release.BUNDLE
    assert profile["Entitlements"].get("get-task-allow") is False
    assert not profile.get("ProvisionsAllDevices") and "ProvisionedDevices" not in profile
    info = plistlib.loads((app / "Info.plist").read_bytes())
    expected = {"CFBundleShortVersionString": "1.0.0", "CFBundleVersion": number, "CFBundleIdentifier": release.BUNDLE, "UIDeviceFamily": [1]}
    assert {key: info.get(key) for key in expected} == expected
    assert subprocess.check_output(["lipo", "-archs", str(app / info["CFBundleExecutable"])], text=True).strip().split() == ["arm64"]
    return {"identity": expected, "entitlements": entitlements, "executable": info["CFBundleExecutable"]}


def certify(app, ipa, number, commit, web_report, settings, activation_report):
    number = build_number(number)
    original_contracts()
    assert git("rev-parse", "HEAD").decode().strip() == commit
    subprocess.run(["git", "diff", "--exit-code", "HEAD"], check=True, stdout=subprocess.DEVNULL)
    activation = json.loads(Path(activation_report).read_text())
    assert activation == activation_report_expected(activation, number), "incomplete activation proof"
    effective = dict(line.split(" = ", 1) for line in Path(settings).read_text().splitlines() if " = " in line)
    for key, value in {"CURRENT_PROJECT_VERSION": number, "MARKETING_VERSION": "1.0.0", "PRODUCT_BUNDLE_IDENTIFIER": release.BUNDLE, "CODE_SIGN_STYLE": "Manual", "CODE_SIGN_IDENTITY": "Apple Distribution", "DEVELOPMENT_TEAM": release.TEAM, "PROVISIONING_PROFILE_SPECIFIER": "Gridly App Store Build 9"}.items():
        assert effective.get(key) == value, "wrong effective build setting: " + key
    assert FLAG in effective.get("SWIFT_ACTIVE_COMPILATION_CONDITIONS", "").split(), "diagnostic compiler condition missing"
    identity = json.loads(Path(web_report).read_text())
    assert identity["candidateGitSha"] == commit and identity["googleLicenseTest"] is False
    assert len(identity["files"]) == 1005 and len({record["path"] for record in identity["files"]}) == 1005
    assert 'as? String == "14"' in Path("ios/App/App/GridlyBridgeViewController.swift").read_text()
    app, ipa = Path(app), Path(ipa)
    with tempfile.TemporaryDirectory(prefix="gridly-diagnostic-parity-") as temporary:
        work = Path(temporary)
        subprocess.run(["ditto", "-x", "-k", str(ipa), str(work / "export")], check=True)
        exported = list((work / "export/Payload").glob("*.app"))
        assert len(exported) == 1
        left = diagnostic_signed_facts(app, work / "archive-cert-", number)
        right = diagnostic_signed_facts(exported[0], work / "ipa-cert-", number)
        assert left == right, "signed identities/entitlements differ"
        archive_binary, ipa_binary = app / left["executable"], exported[0] / right["executable"]
        archive_bytes, ipa_bytes = archive_binary.read_bytes(), ipa_binary.read_bytes()
        archive_macho, ipa_macho = release.macho(archive_bytes), release.macho(ipa_bytes)
        assert archive_macho["architecture"] == ipa_macho["architecture"] and archive_macho["sections"] == ipa_macho["sections"]
        neutral_archive = release.unsigned_copy(archive_binary, work / "archive-neutral")
        neutral_ipa = release.unsigned_copy(ipa_binary, work / "ipa-neutral")
        release.require_neutral_parity(neutral_archive, neutral_ipa)
        recovery_source = Path("ios/App/App/GridlyBridgeViewController.swift").read_text()
        for name in ("legacyRecoveryScript", "legacyReadinessScript"):
            match = re.search(r'private static let ' + name + r' = #"""\n(.*?)\n\s*"""#', recovery_source, re.S)
            assert match, "missing original recovery/readiness body"
            compiled = textwrap.dedent(match.group(1)).encode()
            assert compiled in neutral_archive and compiled in neutral_ipa, "compiled recovery/readiness source mismatch"
        for label in (b"Review legacy saved report", b"Keep saved retry", b"Forget saved retry"):
            assert label in neutral_archive and label in neutral_ipa, "compiled confirmation missing"
        assert archive_binary.read_bytes() == archive_bytes and ipa_binary.read_bytes() == ipa_bytes
        archived_paths = {path.relative_to(app / "public").as_posix() for path in (app / "public").rglob("*") if path.is_file()}
        exported_paths = {path.relative_to(exported[0] / "public").as_posix() for path in (exported[0] / "public").rglob("*") if path.is_file()}
        recorded = {record["path"] for record in identity["files"]}
        assert recorded <= archived_paths and archived_paths - recorded <= {"cordova.js", "cordova_plugins.js"}
        assert exported_paths == archived_paths
        for record in identity["files"]:
            path = record["path"]
            assert not Path(path).is_absolute() and ".." not in Path(path).parts
            for root in (Path("www"), Path("ios/App/App/public"), app / "public", exported[0] / "public"):
                body = (root / path).read_bytes()
                assert len(body) == record["bytes"] and release.sha256(body) == record["sha256"], "web parity mismatch: " + path
        for path in ("js/app.js", "js/gridly-paid-ui.mjs", "js/gridly-paid-access.mjs", "js/gridly-apple-storekit.mjs", "js/gridly-report-protocol.js", "service-worker.js", "consumer-script-manifest.json"):
            assert Path(path).read_bytes() == (app / "public" / path).read_bytes(), "source/archive mismatch: " + path
    return {"status": "certified", "source_commit": commit, "build": number, "identity": left["identity"], "web_files": 1005, "bundle_digest": identity["bundleDigest"], "archive_executable_sha256": release.sha256(archive_bytes), "ipa_executable_sha256": release.sha256(ipa_bytes), "ipa_sha256": release.sha256(ipa.read_bytes()), "signed_artifacts_unchanged": True, "activation": activation, "original_contracts_unchanged": True, "distribution_performed": False}


def activation_report_expected(report, number):
    source = Path("ios/App/App/GridlyStoreKitPlugin.swift").read_text()
    policy = source.split("// BEGIN TESTABLE STORE DIAGNOSTICS\n", 1)[1].split("// END TESTABLE STORE DIAGNOSTICS", 1)[0]
    expected = [{"flag": enabled, "fixture": label, "result": "enabled" if enabled and label == "candidate" else "disabled"} for enabled in (False, True) for label in ("candidate", "approved", "wrong-bundle", "missing-build")]
    return {"build_number": number, "policy_sha256": release.sha256(policy.encode()), "cases": expected, "all_passed": True}



PRIVATE_DIRECTORY = "gridly-storekit-private"
PRIVATE_MARKER = "gridly-storekit-certification-v1\n"


def private_directory(runner_temp):
    parent = Path(runner_temp).resolve(strict=True)
    assert parent.is_dir() and str(parent) not in ("/", "\\"), "runner temporary directory required"
    root = parent / PRIVATE_DIRECTORY
    assert not root.is_symlink() and not any(character in str(root) for character in "\r\n"), "unsafe private directory"
    return root


def prepare_private(runner_temp, github_env):
    root = private_directory(runner_temp)
    root.mkdir(mode=0o700)  # Never reuse a directory from a previous attempt.
    (root / ".owned").write_text(PRIVATE_MARKER)
    for name in ("logs", "reports", "tmp"):
        (root / name).mkdir(mode=0o700)
    with Path(github_env).open("a") as destination:
        destination.write("DIAGNOSTIC_PRIVATE_ROOT=" + str(root) + "\n")
    return {"status": "prepared"}


def cleanup_private(runner_temp):
    """Only this run's marked directory and its exact installed profile are removable."""
    root = private_directory(runner_temp)
    if not root.exists():
        return True
    assert (root / ".owned").is_file() and not (root / ".owned").is_symlink() and (root / ".owned").read_text() == PRIVATE_MARKER, "refuse unowned cleanup"
    clean = True
    try:
        marker = root / "installed-profile"
        if marker.exists():
            installed = Path(marker.read_text())
            expected = Path.home() / "Library/MobileDevice/Provisioning Profiles" / (release.PROFILE_UUID + ".mobileprovision")
            assert installed == expected and not installed.is_symlink(), "refuse unrelated profile removal"
            installed.unlink(missing_ok=True)
    except Exception:
        clean = False
    try:
        keychain = root / "signing.keychain-db"
        if keychain.exists():
            subprocess.run(["security", "delete-keychain", str(keychain)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        clean = False
    try:
        shutil.rmtree(root)
    except Exception:
        clean = False
    return clean and not root.exists()


def finish_public(runner_temp, job_status):
    """Never return raw report fields, exception text, paths, signing facts or logs."""
    result = {"certification": "FAIL", "regressions": "NOT_CERTIFIED", "cleanup": "FAIL", "artifact_upload": "DISABLED", "distribution": "DISABLED"}
    try:
        root = private_directory(runner_temp)
        assert (root / ".owned").is_file() and not (root / ".owned").is_symlink() and (root / ".owned").read_text() == PRIVATE_MARKER
        assert job_status == "success"
        reports = root / "reports"
        authorization = json.loads((reports / "storekit-diagnostic-authorization.json").read_text())
        preflight_report = json.loads((reports / "storekit-diagnostic-preflight.json").read_text())
        certificate = json.loads((reports / "storekit-diagnostic-certification.json").read_text())
        regressions = json.loads((reports / "storekit-diagnostic-regressions.json").read_text())
        commit, number = authorization["source_commit"], build_number(authorization["build"])
        assert re.fullmatch(r"[0-9a-f]{40}", commit)
        assert authorization["authorization_tag"] == TAG_PREFIX + number + "-" + commit
        assert all(authorization[field] is True for field in ("certification_authorized", "unused_build_number_confirmed", "baseline_exception_acknowledged"))
        assert preflight_report["source_commit"] == certificate["source_commit"] == commit
        assert preflight_report["build"] == certificate["build"] == number
        assert certificate["status"] == "certified" and certificate["distribution_performed"] is False
        assert preflight_report["original_contracts_unchanged"] is certificate["original_contracts_unchanged"] is certificate["signed_artifacts_unchanged"] is True
        assert certificate["activation"] == activation_report_expected({}, number)
        assert regressions == check_regressions(reports / "storekit-diagnostic-regressions.tap", regressions["exit_code"], True)
        result["regressions"] = "BASELINE_EXCEPTION" if regressions["status"] == "baseline_exception" else "PASS"
        result["certification"] = "PASS"
    except Exception:
        pass  # No error text or report content may reach public logs.
    try:
        if cleanup_private(runner_temp):
            result["cleanup"] = "PASS"
    except Exception:
        pass
    if result["cleanup"] != "PASS":
        result["certification"] = "FAIL"
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["private-init", "finish-public", "authorize-tag", "preflight", "regressions", "activation", "certify"])
    parser.add_argument("--build-number")
    parser.add_argument("--commit")
    parser.add_argument("--ref")
    parser.add_argument("--github-env")
    parser.add_argument("--output")
    parser.add_argument("--runner-temp")
    parser.add_argument("--job-status")
    parser.add_argument("--tap")
    parser.add_argument("--exit-code", type=int)
    parser.add_argument("--baseline-acknowledged", action="store_true")
    parser.add_argument("--app")
    parser.add_argument("--ipa")
    parser.add_argument("--web-report")
    parser.add_argument("--settings")
    parser.add_argument("--activation-report")
    args = parser.parse_args()
    if args.mode == "private-init":
        prepare_private(args.runner_temp, args.github_env)
        print('{"private_workspace":"PREPARED"}')
        return
    if args.mode == "finish-public":
        result = finish_public(args.runner_temp, args.job_status)
        print(json.dumps(result, sort_keys=True))
        raise SystemExit(0 if result["certification"] == result["cleanup"] == "PASS" else 1)
    assert args.output, "local report destination required"
    if args.mode == "authorize-tag":
        result = authorize_tag(args.ref, args.commit)
        assert args.github_env, "GitHub environment output required"
        with Path(args.github_env).open("a") as destination:
            destination.write("EXPECTED_COMMIT_SHA=" + result["source_commit"] + "\nDIAGNOSTIC_BUILD_NUMBER=" + result["build"] + "\n")
    elif args.mode == "preflight":
        result = preflight(args.commit, args.build_number)
    elif args.mode == "regressions":
        result = check_regressions(args.tap, args.exit_code, args.baseline_acknowledged)
    elif args.mode == "activation":
        result = activation_proof(args.build_number)
    else:
        result = certify(args.app, args.ipa, args.build_number, args.commit, args.web_report, args.settings, args.activation_report)
    destination = Path(args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"mode": args.mode, "status": result.get("status", "passed")}))


if __name__ == "__main__":
    main()
