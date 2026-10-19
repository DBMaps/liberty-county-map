"""Isolated Build 15 delivery gate. Network/signing/upload occur ONLY in a future
separately authorized macOS run. Local tests inject fakes; never load credentials.
No tester/group/version/release mutation API exists here.
"""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import plistlib
import re
import subprocess
import time
import urllib.parse
import urllib.request
from pathlib import Path
import apple_storekit_diagnostic_certification as cert

SOURCE = "f9fc818321970b8b7e29df17358daf87a7d20308"
DELIVERY_BASE = "bd5b1feac696ba7db0e7d8d271b054df1d25850b"
RUN = 39181592021
REPOSITORY = "DBMaps/liberty-county-map"
PREFIX = "refs/tags/gridly-storekit-testflight-deliver-15-"
FILES = {
    ".github/workflows/gridly-storekit-testflight-delivery.yml",
    "tools/apple_storekit_testflight_delivery.py",
    "tests/storekit-testflight-delivery.test.py",
}
CONFIRMATIONS = {
    "testflight_upload_authorized", "unused_build_number_confirmed",
    "baseline_exception_acknowledged", "testflight_group_settings_reviewed",
    "testflight_auto_distribution_disabled", "app_store_connect_users_access_reviewed",
    "no_unapproved_internal_access_confirmed",
}
OWNER_AUTO_FIELD = "owner_only_automatic_distribution"
OWNER_AUTO_CONFIRMATIONS = {
    "authorized", "both_accounts_owned_by_owner",
    "automatic_availability_to_both_accounts_acknowledged",
    "no_other_eligible_internal_users_confirmed",
}
# The same timestamp covers group settings, both owner accounts and ALL eligible
# internal App Store Connect users, including access outside Gridly Internal.
# Owner settings/unused-build attestations must still be fresh immediately before upload.
OWNER_CHECK_TTL = 1800


def require(value, reason):
    # Security checks must also work if Python is run with optimization enabled.
    if not value:
        raise ValueError(reason)


def read_json(path):
    return json.loads(Path(path).read_text(), object_pairs_hook=cert.unique_json_object)


def write_json(path, value):
    Path(path).write_text(json.dumps(value, sort_keys=True) + "\n")


def owner_authorization(value, commit, ref, now=None):
    fields = CONFIRMATIONS | {
        "delivery_commit", "certified_source_commit", "certification_run_id",
        "diagnostic_build_number", "owner_checks_at",
    }
    require(isinstance(value, dict) and set(value) in (fields, fields | {OWNER_AUTO_FIELD}), "exact owner authorization required")
    require(isinstance(commit, str) and re.fullmatch(r"[0-9a-f]{40}", commit), "exact delivery commit required")
    require(ref == PREFIX + commit, "separate delivery authorization tag required")
    require(value["delivery_commit"] == commit and value["certified_source_commit"] == SOURCE, "wrong source")
    require(type(value["certification_run_id"]) is int and value["certification_run_id"] == RUN, "wrong certification run")
    require(value["diagnostic_build_number"] == "15", "only unused diagnostic Build 15 allowed")
    common = CONFIRMATIONS - {"testflight_auto_distribution_disabled"}
    require(all(value[key] is True for key in common), "explicit confirmations required")
    if OWNER_AUTO_FIELD in value:
        require(value["testflight_auto_distribution_disabled"] is False, "contradictory automatic distribution authorization")
        automatic = value[OWNER_AUTO_FIELD]
        require(isinstance(automatic, dict) and set(automatic) == OWNER_AUTO_CONFIRMATIONS | {
            "group_name", "authorized_owner_account_count"
        }, "complete owner-only automatic distribution authorization required")
        require(all(automatic[key] is True for key in OWNER_AUTO_CONFIRMATIONS), "owner-only automatic distribution confirmations required")
        require(automatic["group_name"] == "Gridly Internal", "only the reviewed internal group allowed")
        require(type(automatic["authorized_owner_account_count"]) is int and automatic["authorized_owner_account_count"] == 2,
                "exactly the two authorized owner accounts required")
    else:
        # Backward-compatible strict option: no automatic-distribution exception.
        require(value["testflight_auto_distribution_disabled"] is True, "automatic distribution must be disabled or explicitly owner-only")
    stamp = value["owner_checks_at"]
    require(isinstance(stamp, str) and re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", stamp), "UTC owner check time required")
    checked = dt.datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc).timestamp()
    age = (time.time() if now is None else now) - checked
    require(0 <= age <= OWNER_CHECK_TTL, "owner distribution/build checks expired")
    return value


def event_gate(event, ref, commit, attempt, tag_object):
    require(attempt == "1", "reruns cannot upload")
    require(event.get("repository", {}).get("full_name") == REPOSITORY, "wrong repository")
    require(event.get("created") is True and event.get("deleted") is False and event.get("forced") is False, "new non-forced tag required")
    require(event.get("ref") == ref and event.get("after") in {commit, tag_object}, "wrong tag push event")


def authorize(ref, commit, event_path, attempt):
    require(cert.git("rev-parse", "HEAD").decode().strip() == commit, "wrong checkout")
    require(cert.git("rev-parse", "--verify", cert.DIAGNOSTIC_BRANCH).decode().strip() == commit, "not pushed diagnostic branch head")
    require(cert.git("cat-file", "-t", ref).decode().strip() == "tag", "annotated tag required")
    header, separator, annotation = cert.git("cat-file", "-p", ref).decode().partition("\n\n")
    require(separator and header.splitlines()[:3] == [
        "object " + commit, "type commit", "tag " + ref.removeprefix("refs/tags/")
    ], "tag must directly target reviewed commit")
    event_gate(read_json(event_path), ref, commit, attempt, cert.git("rev-parse", "--verify", ref).decode().strip())
    value = json.loads(annotation, object_pairs_hook=cert.unique_json_object)
    owner_authorization(value, commit, ref)
    return {"authorization": value, "ref": ref, "source_commit": commit, "build": "15"}


def source_guard(commit, clean):
    require(re.fullmatch(r"[0-9a-f]{40}", commit or ""), "exact source SHA required")
    require(cert.git("rev-parse", "HEAD").decode().strip() == commit and commit not in {SOURCE, DELIVERY_BASE}, "reviewed delivery correction commit required")
    require(cert.git("show", "-s", "--format=%P", commit).decode().strip() == DELIVERY_BASE, "one reviewed correction directly on pinned delivery commit required")
    require(cert.git("show", "-s", "--format=%P", DELIVERY_BASE).decode().strip() == SOURCE, "pinned delivery ancestry changed")
    subprocess.run(["git", "merge-base", "--is-ancestor", SOURCE, commit], check=True, stdout=subprocess.DEVNULL)
    preparation = cert.git("diff", "--name-status", "--no-renames", SOURCE, DELIVERY_BASE).decode().splitlines()
    require(set(preparation) == {"A\t" + path for path in FILES}, "pinned delivery preparation inventory changed")
    correction = cert.git("diff", "--name-status", "--no-renames", DELIVERY_BASE, commit).decode().splitlines()
    require(set(correction) == {"M\t" + path for path in FILES}, "correction must modify only the three reviewed delivery files")
    records = cert.git("diff", "--name-status", "--no-renames", SOURCE, commit).decode().splitlines()
    require(set(records) == {"A\t" + path for path in FILES}, "only three new delivery support files allowed; runtime frozen")
    for path in FILES:
        require(cert.git("ls-tree", commit, "--", path).decode().split()[0] == "100644", "delivery support file mode changed")
    # Git diff catches tracked additions/deletions/modes as well as byte changes.
    require(not cert.git("diff", "--name-only", "HEAD"), "tracked working source changed")
    require(not cert.git("diff", "--cached", "--name-only"), "staged source changed")
    if clean:
        require(not cert.git("status", "--porcelain=v1", "--untracked-files=normal"), "candidate not frozen")
    cert.original_contracts()
    return {"source_commit": commit, "certified_source_commit": SOURCE, "build": "15",
            "runtime_unchanged": True, "original_contracts_unchanged": True}


def public_json(url):
    require(url.startswith("https://api.github.com/repos/" + REPOSITORY + "/actions/"), "unexpected evidence URL")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"}), timeout=30) as response:
        require(response.status == 200, "certification evidence unavailable")
        return json.load(response)


def historical_evidence(get=public_json):
    base = "https://api.github.com/repos/" + REPOSITORY + "/actions/runs/" + str(RUN)
    run = get(base)
    require(run.get("id") == RUN and run.get("head_sha") == SOURCE and run.get("run_attempt") == 1, "wrong historical source/run")
    require(run.get("status") == "completed" and run.get("conclusion") == "success", "missing successful historical certification")
    require(run.get("path") == ".github/workflows/gridly-storekit-diagnostic-certification.yml", "wrong certification workflow")
    require(run.get("event") == "push" and run.get("head_branch") == "gridly-storekit-diagnostic-certify-15-" + SOURCE, "wrong historical tag")
    jobs = get(base + "/attempts/1/jobs?per_page=100")
    require(jobs.get("total_count") == 1 and len(jobs.get("jobs", [])) == 1, "incomplete certification jobs")
    job = jobs["jobs"][0]
    require(job.get("name") == "certify-storekit-diagnostics" and job.get("conclusion") == "success", "native certification failed")
    require(job.get("steps") and all(step.get("conclusion") == "success" for step in job["steps"]), "incomplete native certification")
    artifacts = get(base + "/artifacts?per_page=100")
    require(artifacts.get("total_count") == 0 and artifacts.get("artifacts") == [], "unexpected historical artifact retention")
    return {"run": RUN, "source_commit": SOURCE, "attempt": 1, "status": "success", "artifacts": 0}


def authorization_guard(root, commit, now=None):
    report = read_json(root / "reports/delivery-authorization.json")
    require(report["source_commit"] == commit and report["build"] == "15", "wrong authorization report")
    return owner_authorization(report["authorization"], commit, report["ref"], now)


def export_guard(path):
    with Path(path).open("rb") as stream:
        options = plistlib.load(stream)
    require(options.get("testFlightInternalTestingOnly") is True, "internal-only export required")
    require(options.get("method") == "app-store-connect" and options.get("destination") == "export", "local export only")
    require(options.get("manageAppVersionAndBuildNumber") is False, "build identity must not be rewritten")
    return True


def ready(root, commit, ipa):
    source_guard(commit, clean=False)
    authorization_guard(root, commit)
    reports = root / "reports"
    evidence = read_json(reports / "delivery-preflight.json")
    require(evidence == {**source_guard(commit, clean=False), "historical_certification": {
        "run": RUN, "source_commit": SOURCE, "attempt": 1, "status": "success", "artifacts": 0
    }}, "missing preflight/certification evidence")
    proof = read_json(reports / "storekit-diagnostic-certification.json")
    require(proof["status"] == "certified" and proof["source_commit"] == commit and proof["build"] == "15", "signed certification required")
    require(proof["identity"] == {"CFBundleIdentifier": cert.release.BUNDLE, "CFBundleVersion": "15", "CFBundleShortVersionString": "1.0.0", "UIDeviceFamily": [1]}, "wrong signed identity")
    require(proof["signed_artifacts_unchanged"] is True and proof["original_contracts_unchanged"] is True and proof["distribution_performed"] is False, "signed/parity proof incomplete")
    require(proof["activation"] == cert.activation_report_expected({}, "15") and proof["web_files"] == 1005, "activation/web parity required")
    require(ipa.is_file() and not ipa.is_symlink() and ipa.resolve().is_relative_to(root.resolve()), "private IPA required")
    require(re.fullmatch(r"[0-9a-f]{64}", proof["ipa_sha256"]) and hashlib.sha256(ipa.read_bytes()).hexdigest() == proof["ipa_sha256"], "certified IPA bytes changed")
    regressions = read_json(reports / "storekit-diagnostic-regressions.json")
    require(regressions == cert.check_regressions(reports / "storekit-diagnostic-regressions.tap", regressions["exit_code"], True), "new regression")
    export_guard(root / "DiagnosticExportOptions.plist")
    export_guard(ipa.parent / "ExportOptions.plist")
    return proof, regressions


def b64url(body):
    return base64.urlsafe_b64encode(body).rstrip(b"=").decode()


def api_token(key, issuer, key_path):
    """Future CI only: ES256 token stays in memory; Node 22 uses its built-in crypto."""
    now = int(time.time())
    header = b64url(json.dumps({"alg": "ES256", "kid": key, "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64url(json.dumps({"iss": issuer, "iat": now, "exp": now + 120, "aud": "appstoreconnect-v1",
                                "scope": ["GET /v1/apps", "GET /v1/builds"]}, separators=(",", ":")).encode())
    message = header + "." + payload
    script = 'import{readFileSync}from"node:fs";import{sign}from"node:crypto";let s="";for await(const c of process.stdin)s+=c;process.stdout.write(sign("sha256",Buffer.from(s),{key:readFileSync(process.argv[1]),dsaEncoding:"ieee-p1363"}).toString("base64url"));'
    signature = subprocess.check_output(["node", "--input-type=module", "-e", script, str(key_path)], input=message.encode()).decode()
    require(re.fullmatch(r"[A-Za-z0-9_-]{86}", signature), "invalid signing response")
    return message + "." + signature


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Apple credential redirects refused")


def apple_get(path, token):
    require(path.startswith("/v1/apps?") or path.startswith("/v1/builds?"), "read-only build availability endpoint required")
    request = urllib.request.Request("https://api.appstoreconnect.apple.com" + path, headers={"Authorization": "Bearer " + token, "Accept": "application/json"}, method="GET")
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        require(response.status == 200, "Apple availability check failed")
        return json.load(response)


def unused_build(get):
    # Only app/build metadata; no subscriptions, transactions, testers or account details.
    apps = get("/v1/apps?" + urllib.parse.urlencode({"filter[bundleId]": cert.release.BUNDLE, "fields[apps]": "bundleId", "limit": "2"}))
    require("errors" not in apps and isinstance(apps.get("data"), list) and len(apps["data"]) == 1 and not apps.get("links", {}).get("next"), "ambiguous Apple app identity")
    app = apps["data"][0]
    require(app.get("type") == "apps" and re.fullmatch(r"[0-9]+", app.get("id", "")) and app.get("attributes", {}).get("bundleId") == cert.release.BUNDLE, "wrong Apple app identity")
    builds = get("/v1/builds?" + urllib.parse.urlencode({"filter[app]": app["id"], "filter[version]": "15", "filter[preReleaseVersion.version]": "1.0.0", "filter[preReleaseVersion.platform]": "IOS", "fields[builds]": "version", "limit": "1"}))
    require("errors" not in builds and builds.get("data") == [] and not builds.get("links", {}).get("next") and builds.get("meta", {}).get("paging", {}).get("total", 0) == 0, "Build 15 already exists or availability is undetermined")
    return {"build": "15", "version": "1.0.0", "unused": True}


def transfer(root, commit, ipa, precheck=ready, credentials=None, token_factory=api_token,
             get=apple_get, execute=subprocess.run, clock=time.time):
    """One validation then one upload; no retry after uncertain Apple acceptance."""
    precheck(root, commit, ipa)
    marker = root / "reports/delivery-transfer.json"
    require(not marker.exists(), "previous upload attempt; owner must investigate")
    # Credentials are first read only AFTER authorization, signed certification and parity.
    values = os.environ if credentials is None else credentials
    key, issuer = values.get("ASC_KEY_ID", ""), values.get("ASC_ISSUER_ID", "")
    require(re.fullmatch(r"[A-Z0-9]{10}", key) and re.fullmatch(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", issuer), "existing team API upload credentials required")
    key_path = root / "home/.appstoreconnect/private_keys" / ("AuthKey_" + key + ".p8")
    key_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    raw = base64.b64decode(values.get("ASC_PRIVATE_KEY_P8_BASE64", ""), validate=True)
    require(raw.startswith(b"-----BEGIN PRIVATE KEY-----") and raw.rstrip().endswith(b"-----END PRIVATE KEY-----"), "existing API signing material required")
    with key_path.open("xb") as stream:
        stream.write(raw)
    key_path.chmod(0o600)
    command = ["xcrun", "altool", "--type", "ios", "--file", str(ipa), "--apiKey", key, "--apiIssuer", issuer]
    execute([*command, "--validate-app"], check=True, cwd=root / "home")
    # Recheck frozen source, owner settings TTL, IPA digest, all reports after validation.
    current_proof, _ = precheck(root, commit, ipa)
    check_started = clock()
    token = token_factory(key, issuer, key_path)
    unused = unused_build(lambda path: get(path, token))
    authorization_guard(root, commit)
    require(0 <= clock() - check_started <= 60, "build availability check expired")
    require(hashlib.sha256(ipa.read_bytes()).hexdigest() == current_proof["ipa_sha256"], "IPA changed before upload")
    write_json(root / "reports/delivery-availability.json", {**unused, "checked_at": int(clock())})
    # No build/signing work or unrelated Apple operation between this GET and the upload.
    write_json(marker, {"status": "ATTEMPTED", "source_commit": commit, "build": "15"})
    execute([*command, "--upload-app"], check=True, cwd=root / "home")
    write_json(marker, {"status": "ACCEPTED", "source_commit": commit, "build": "15"})


def finish(runner_temp, job_status):
    result = {"certification": "FAIL", "upload": "NOT_ATTEMPTED", "cleanup": "FAIL",
              "regressions": "NOT_CERTIFIED", "public_artifacts": "DISABLED",
              "tester_assignment": "DISABLED", "store_release": "DISABLED"}
    try:
        root = cert.private_directory(runner_temp)
        require((root / ".owned").read_text() == cert.PRIVATE_MARKER and not (root / ".owned").is_symlink(), "unowned workspace")
        marker = root / "reports/delivery-transfer.json"
        if marker.exists():
            transfer_report = read_json(marker)
            result["upload"] = "FAILED_OR_UNCERTAIN"
            authorization = read_json(root / "reports/delivery-authorization.json")
            proof = read_json(root / "reports/storekit-diagnostic-certification.json")
            require(transfer_report["source_commit"] == authorization["source_commit"] == proof["source_commit"], "mismatched final evidence")
            require(transfer_report["build"] == proof["build"] == "15" and proof["status"] == "certified", "missing final certificate")
            regressions = read_json(root / "reports/storekit-diagnostic-regressions.json")
            require(regressions == cert.check_regressions(root / "reports/storekit-diagnostic-regressions.tap", regressions["exit_code"], True), "invalid final regressions")
            result["regressions"] = "BASELINE_EXCEPTION" if regressions["status"] == "baseline_exception" else "PASS"
            if transfer_report["status"] == "ACCEPTED":
                result["upload"] = "ACCEPTED"
            require(job_status == "success" and result["upload"] == "ACCEPTED", "incomplete delivery")
            result["certification"] = "PASS"
    except Exception:
        pass  # Never echo exception text, report fields, key identifiers or Apple output.
    try:
        if cert.cleanup_private(runner_temp):
            result["cleanup"] = "PASS"
    except Exception:
        pass
    if result["cleanup"] != "PASS":
        result["certification"] = "FAIL"
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["private-init", "authorize", "preflight", "transfer", "finish-public"])
    for name in ("runner-temp", "github-env", "ref", "commit", "event", "attempt", "output", "ipa", "job-status"):
        parser.add_argument("--" + name)
    args = parser.parse_args()
    if args.mode == "private-init":
        cert.prepare_private(args.runner_temp, args.github_env)
        root = cert.private_directory(args.runner_temp)
        (root / "home").mkdir(mode=0o700)
        with Path(args.github_env).open("a") as destination:
            for key, value in {"HOME": root / "home", "CFFIXED_USER_HOME": root / "home",
                               "XDG_CACHE_HOME": root / "home/.cache", "npm_config_cache": root / "home/.npm",
                               "TMPDIR": root / "tmp",
                               "JAVA_TOOL_OPTIONS": '-Duser.home="' + str(root / "home") + '" -Djava.io.tmpdir="' + str(root / "tmp") + '"'}.items():
                destination.write(key + "=" + str(value) + "\n")
        print('{"private_workspace":"PREPARED"}')
        return
    if args.mode == "finish-public":
        result = finish(args.runner_temp, args.job_status)
        print(json.dumps(result, sort_keys=True))
        raise SystemExit(0 if result["certification"] == result["cleanup"] == "PASS" else 1)
    root = cert.private_directory(args.runner_temp)
    require(str(root) == os.environ.get("DIAGNOSTIC_PRIVATE_ROOT"), "private CI workspace required")
    if args.mode == "authorize":
        result = authorize(args.ref, args.commit, args.event, args.attempt)
        with Path(args.github_env).open("a") as destination:
            destination.write("EXPECTED_COMMIT_SHA=" + args.commit + "\nDIAGNOSTIC_BUILD_NUMBER=15\n")
    elif args.mode == "preflight":
        authorization_guard(root, args.commit)
        result = {**source_guard(args.commit, clean=True), "historical_certification": historical_evidence()}
    else:
        require(os.environ.get("RUNNER_OS") == "macOS" and os.environ.get("GITHUB_ACTIONS") == "true", "future authorized macOS workflow only")
        require(os.environ.get("HOME") == str(root / "home") and os.environ.get("CFFIXED_USER_HOME") == str(root / "home"), "private tool home required")
        transfer(root, args.commit, Path(args.ipa))
        return
    require(args.output and Path(args.output).resolve().is_relative_to(root.resolve()), "private report required")
    write_json(args.output, result)


if __name__ == "__main__":
    main()
