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
OWNER_CORRECTION = "45bfe026b81f4928caceb9632cbf15e7ed842a25"
PREFLIGHT_BASE = "13e73183cf3f257fbc9acd9a32d34d62b70ffb1e"
REFINEMENT_BASE = "4c95caed0d261fca1dbaf86fc926660661d0643b"
SIGNING_BASE = "db4df3949b1f02325b8869433bbbd16b234487db"
CMS_BASE = "cbe3c297099dbca9c6d376848157de0253aeae39"
SIGNING_FILES = {
    ".github/workflows/gridly-storekit-signing-diagnostic.yml",
    "tools/apple_storekit_signing_diagnostic.py",
    "tests/storekit-signing-diagnostic.test.py",
}
CMS_FILES = {
    ".github/workflows/gridly-storekit-cms-diagnostic.yml",
    "tools/apple_storekit_cms_diagnostic.py",
    "tests/storekit-cms-diagnostic.test.py",
}
PREFLIGHT_FILES = {
    ".github/workflows/gridly-storekit-preflight-diagnostic.yml",
    "tools/apple_storekit_preflight_diagnostic.py",
    "tests/storekit-preflight-diagnostic.test.py",
}
PREFLIGHT_STAGES = (
    "P01_SOURCE_SHA", "P02_XCODE_VERSION", "P03_SOURCE_GUARD",
    "P04_CERTIFICATION_HISTORY", "P05_TAG_CHECKOUT", "P06_CLONE_SHA",
    "P07_XCODE_HELP", "P08_INTERNAL_EXPORT_OPTION",
)
PREFLIGHT_CATEGORIES = {
    "NONE", "DEPENDENCY_FAILED", "AUTHORIZATION_REJECTED", "SOURCE_SHA_MISMATCH",
    "XCODE_COMMAND_FAILED", "XCODE26_REQUIRED", "DELIVERY_SOURCE_REJECTED",
    "CERTIFICATION_EVIDENCE_REJECTED", "PREFLIGHT_REPORT_FAILED",
    "TAG_CHECKOUT_REJECTED", "LOCAL_CLONE_FAILED", "CLONED_SHA_MISMATCH",
    "CLONE_ENVIRONMENT_FAILED", "XCODE_HELP_FAILED", "INTERNAL_OPTION_NOT_RECOGNIZED",
    "INTERNAL_FAILURE",
}
RUN = 39181592021
REPOSITORY = "DBMaps/liberty-county-map"
PREFIX = "refs/tags/gridly-storekit-testflight-deliver-15-"
FILES = {
    ".github/workflows/gridly-storekit-testflight-delivery.yml",
    "tools/apple_storekit_testflight_delivery.py",
    "tests/storekit-testflight-delivery.test.py",
}
# The historical four-file refinement is pinned at REFINEMENT_BASE.
# Only one new direct child of CMS_BASE may modify exactly REPAIR_FILES.
REFINEMENT_FILES = FILES | {"tests/storekit-preflight-diagnostic.test.py"}
REPAIR_FILES = FILES | {"tests/storekit-signing-diagnostic.test.py"}
HISTORICAL_TAGS = {
    "gridly-storekit-diagnostic-certify-15-" + SOURCE:
        ("bb496cafcbeaf7d6aaf6574e6b5561ac242599fc", SOURCE),
    "gridly-storekit-testflight-deliver-15-" + OWNER_CORRECTION:
        ("15a2d8093f31ccaea515b715e604c803d89af469", OWNER_CORRECTION),
    "gridly-storekit-preflight-15-" + PREFLIGHT_BASE:
        ("41b9592697daf7898b66dd582b6da3af5dc8412d", PREFLIGHT_BASE),
    "gridly-storekit-testflight-deliver-15-" + REFINEMENT_BASE:
        ("e6425dadac56501e8b389efecd5c50d95501d823", REFINEMENT_BASE),
    "gridly-storekit-signing-diagnostic-15-" + SIGNING_BASE:
        ("ffa6924f2ec257f42a183f8f05daaccc66b85685", SIGNING_BASE),
    "gridly-storekit-cms-diagnostic-15-" + CMS_BASE:
        ("975205d798d31197be41fe505a417064b519b63f", CMS_BASE),
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
    pinned = {SOURCE, DELIVERY_BASE, OWNER_CORRECTION, PREFLIGHT_BASE, REFINEMENT_BASE, SIGNING_BASE, CMS_BASE}
    require(cert.git("rev-parse", "HEAD").decode().strip() == commit and commit not in pinned,
            "new reviewed delivery-support commit required")
    for child, parent in (
        (commit, CMS_BASE), (CMS_BASE, SIGNING_BASE), (SIGNING_BASE, REFINEMENT_BASE),
        (REFINEMENT_BASE, PREFLIGHT_BASE), (PREFLIGHT_BASE, OWNER_CORRECTION),
        (OWNER_CORRECTION, DELIVERY_BASE), (DELIVERY_BASE, SOURCE),
    ):
        require(cert.git("show", "-s", "--format=%P", child).decode().strip() == parent,
                "exact pinned delivery/preflight ancestry required; no extra commits or merges")
    for name, (tag_object, target) in HISTORICAL_TAGS.items():
        ref = "refs/tags/" + name
        require(cert.git("rev-parse", "--verify", ref).decode().strip() == tag_object,
                "historical authorization tag changed or missing")
        require(cert.git("cat-file", "-t", ref).decode().strip() == "tag",
                "historical annotated tag required")
        require(cert.git("rev-parse", "--verify", ref + "^{}").decode().strip() == target,
                "historical authorization target changed")
    subprocess.run(["git", "merge-base", "--is-ancestor", SOURCE, commit], check=True, stdout=subprocess.DEVNULL)
    for base, target, status, inventory in (
        (SOURCE, DELIVERY_BASE, "A", FILES),
        (DELIVERY_BASE, OWNER_CORRECTION, "M", FILES),
        (OWNER_CORRECTION, PREFLIGHT_BASE, "A", PREFLIGHT_FILES),
        (PREFLIGHT_BASE, REFINEMENT_BASE, "M", REFINEMENT_FILES),
        (REFINEMENT_BASE, SIGNING_BASE, "A", SIGNING_FILES),
        (SIGNING_BASE, CMS_BASE, "A", CMS_FILES),
        (CMS_BASE, commit, "M", REPAIR_FILES),
        (SOURCE, commit, "A", FILES | PREFLIGHT_FILES | SIGNING_FILES | CMS_FILES),
    ):
        records = cert.git("diff", "--name-status", "--no-renames", base, target).decode().splitlines()
        require(set(records) == {status + "\t" + path for path in inventory} and len(records) == len(inventory),
                "exact historical inventories and four-file CMS repair required; all other source frozen")
    for path in FILES | PREFLIGHT_FILES | SIGNING_FILES | CMS_FILES:
        require(cert.git("ls-tree", commit, "--", path).decode().split()[0] == "100644", "support file mode changed")
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


def preflight_result(stage, passed, category):
    require(stage in PREFLIGHT_STAGES and category in PREFLIGHT_CATEGORIES, "fixed preflight labels required")
    require(type(passed) is bool and (passed == (category == "NONE")), "fixed preflight outcome required")
    return {"stage": stage, "status": "PASS" if passed else "FAIL", "category": category}


def emit_preflight(records, stream=None):
    require(len(records) == len(PREFLIGHT_STAGES), "all preflight stages required")
    fixed = []
    for stage, record in zip(PREFLIGHT_STAGES, records):
        require(isinstance(record, dict) and set(record) == {"stage", "status", "category"}, "fixed preflight schema required")
        value = preflight_result(stage, record["status"] == "PASS", record["category"])
        require(value == record, "fixed preflight values required")
        fixed.append(value)
    body = "".join(json.dumps(record, sort_keys=True) + "\n" for record in fixed)
    if stream is not None:
        stream.write(body)
        stream.flush()
    else:
        # Only this validated data reaches the public descriptor. Child processes
        # capture stdout/stderr and close inherited extra descriptors by default.
        with os.fdopen(os.dup(3), "w", encoding="utf-8") as public:
            public.write(body)
            public.flush()


def delivery_preflight(root, commit, output, github_env, environment=None, execute=subprocess.run):
    environment = os.environ if environment is None else environment
    records = {stage: preflight_result(stage, False, "DEPENDENCY_FAILED") for stage in PREFLIGHT_STAGES}

    def command(stage, args, *, input=None, timeout=180):
        completed = execute(args, check=False, capture_output=True, close_fds=True, input=input, timeout=timeout)
        with (root / "logs" / (stage + ".log")).open("ab") as log:
            log.write(completed.stdout or b"")
            log.write(completed.stderr or b"")
        return completed

    def checked(stage, category, operation):
        try:
            value = operation()
            records[stage] = preflight_result(stage, True, "NONE")
            return value
        except Exception:
            records[stage] = preflight_result(stage, False, category)
            return None

    def success(completed):
        require(completed.returncode == 0, "private command failed")
        return completed.stdout

    try:
        authorization_guard(root, commit)  # Same unchanged 30-minute gate as before.
    except Exception:
        records["P01_SOURCE_SHA"] = preflight_result("P01_SOURCE_SHA", False, "AUTHORIZATION_REJECTED")
        return list(records.values())

    def identity():
        require(re.fullmatch(r"[0-9a-f]{40}", commit or ""), "exact source required")
        require(environment.get("GITHUB_SHA") == commit, "source/event mismatch")
        require(Path(environment["GITHUB_WORKSPACE"]).resolve() == Path.cwd().resolve(), "workspace mismatch")
        require(success(command("P01_SOURCE_SHA", ["git", "rev-parse", "HEAD"])).decode().strip() == commit, "checkout mismatch")
    checked("P01_SOURCE_SHA", "SOURCE_SHA_MISMATCH", identity)
    if records["P01_SOURCE_SHA"]["status"] != "PASS":
        return list(records.values())

    try:
        version = success(command("P02_XCODE_VERSION", ["xcodebuild", "-version"], timeout=60))
    except Exception:
        records["P02_XCODE_VERSION"] = preflight_result("P02_XCODE_VERSION", False, "XCODE_COMMAND_FAILED")
    else:
        checked("P02_XCODE_VERSION", "XCODE26_REQUIRED", lambda:
                success(command("P02_XCODE_VERSION", ["grep", "-E", "^Xcode 26([. ]|$)"], input=version, timeout=30)))

    guard = checked("P03_SOURCE_GUARD", "DELIVERY_SOURCE_REJECTED", lambda: source_guard(commit, clean=True))
    history = checked("P04_CERTIFICATION_HISTORY", "CERTIFICATION_EVIDENCE_REJECTED", historical_evidence)
    if records["P03_SOURCE_GUARD"]["status"] == records["P04_CERTIFICATION_HISTORY"]["status"] == "PASS":
        def persist():
            require(output and Path(output).resolve().is_relative_to(root.resolve()), "private report required")
            write_json(output, {**guard, "historical_certification": history})
        checked("P04_CERTIFICATION_HISTORY", "PREFLIGHT_REPORT_FAILED", persist)

    def tag_checkout():
        ref = environment["GITHUB_REF"]
        require(ref == PREFIX + commit and environment["GITHUB_REF_NAME"] == ref.removeprefix("refs/tags/"), "exact delivery tag required")
        require(success(command("P05_TAG_CHECKOUT", ["git", "cat-file", "-t", ref])).strip() == b"tag", "annotated tag required")
        require(success(command("P05_TAG_CHECKOUT", ["git", "rev-parse", ref + "^{commit}"])).decode().strip() == commit, "tag target mismatch")
        require(command("P05_TAG_CHECKOUT", ["git", "symbolic-ref", "-q", "HEAD"]).returncode == 1, "detached tag checkout required")
    checked("P05_TAG_CHECKOUT", "TAG_CHECKOUT_REJECTED", tag_checkout)

    clone = root / "source"
    if records["P03_SOURCE_GUARD"]["status"] == records["P05_TAG_CHECKOUT"]["status"] == "PASS":
        checked("P06_CLONE_SHA", "LOCAL_CLONE_FAILED", lambda:
                success(command("P06_CLONE_SHA", [
                    "git", "clone", "--no-hardlinks", "--branch", environment["GITHUB_REF_NAME"],
                    environment["GITHUB_WORKSPACE"], str(clone)
                ])))
        if records["P06_CLONE_SHA"]["status"] == "PASS":
            checked("P06_CLONE_SHA", "CLONED_SHA_MISMATCH", lambda:
                    require(success(command("P06_CLONE_SHA", ["git", "-C", str(clone), "rev-parse", "HEAD"])).decode().strip() == commit, "clone source mismatch"))
        if records["P06_CLONE_SHA"]["status"] == "PASS":
            def export_source():
                require(github_env and not any(c in str(clone) for c in "\r\n"), "safe source export required")
                with Path(github_env).open("a") as destination:
                    destination.write("DELIVERY_SOURCE_DIR=" + str(clone) + "\n")
            checked("P06_CLONE_SHA", "CLONE_ENVIRONMENT_FAILED", export_source)

    help_path = root / "reports/xcode-help.txt"
    def xcode_help():
        completed = command("P07_XCODE_HELP", ["xcodebuild", "-help"], timeout=60)
        help_path.write_bytes((completed.stdout or b"") + (completed.stderr or b""))
        success(completed)
    checked("P07_XCODE_HELP", "XCODE_HELP_FAILED", xcode_help)
    if records["P07_XCODE_HELP"]["status"] == "PASS":
        checked("P08_INTERNAL_EXPORT_OPTION", "INTERNAL_OPTION_NOT_RECOGNIZED", lambda:
                success(command("P08_INTERNAL_EXPORT_OPTION", [
                    "grep", "-Eq", "^[[:space:]]*testFlightInternalTestingOnly[[:space:]]*:", str(help_path)
                ], timeout=30)))
    return [records[stage] for stage in PREFLIGHT_STAGES]


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
    if args.mode == "preflight":
        records = [preflight_result(stage, False, "INTERNAL_FAILURE") for stage in PREFLIGHT_STAGES]
        try:
            root = cert.private_directory(args.runner_temp)
            require(str(root) == os.environ.get("DIAGNOSTIC_PRIVATE_ROOT"), "private CI workspace required")
            records = delivery_preflight(root, args.commit, args.output, args.github_env)
        except BaseException:
            pass  # Interrupts and unexpected setup failures cannot publish raw errors.
        emit_preflight(records)
        raise SystemExit(0 if all(record["status"] == "PASS" for record in records) else 1)
    root = cert.private_directory(args.runner_temp)
    require(str(root) == os.environ.get("DIAGNOSTIC_PRIVATE_ROOT"), "private CI workspace required")
    if args.mode == "authorize":
        result = authorize(args.ref, args.commit, args.event, args.attempt)
        with Path(args.github_env).open("a") as destination:
            destination.write("EXPECTED_COMMIT_SHA=" + args.commit + "\nDIAGNOSTIC_BUILD_NUMBER=15\n")
    else:
        require(os.environ.get("RUNNER_OS") == "macOS" and os.environ.get("GITHUB_ACTIONS") == "true", "future authorized macOS workflow only")
        require(os.environ.get("HOME") == str(root / "home") and os.environ.get("CFFIXED_USER_HOME") == str(root / "home"), "private tool home required")
        transfer(root, args.commit, Path(args.ipa))
        return
    require(args.output and Path(args.output).resolve().is_relative_to(root.resolve()), "private report required")
    write_json(args.output, result)


if __name__ == "__main__":
    main()
