"""Isolated Build 15 delivery gate. Network/signing/upload occur ONLY in a future
separately authorized macOS run. Local tests inject fakes; never load credentials.
No tester/group/version/release mutation API exists here.
"""
import argparse
import contextlib
import base64
import datetime as dt
import hashlib
import http.client
import email.utils
import errno
import math
import socket
import urllib.error
import json
import os
import plistlib
import re
import subprocess
import shutil
import shlex
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
CMS_REPAIR_BASE = "17e36af1f5a8cc5f7f8ed927fb3e7fae758ee991"
SIGNING_VERIFIED_BASE = "b1e2b7a35dff887dfa4a464a19215b66893b0ee8"
P04_BASE = "40824c760a65b56b1b0056d1d9b90d571b7f47d4"
ARCHIVE_BASE = "45ce66b98b44bd6cea67820124e695483e7a6b9b"
EVIDENCE_BASE = "779d67c7b89569db7cacb6a253eff6da8d3f74ef"
ENVIRONMENT_BASE = "b27d780e3148a903917b7a05595f17006f1ab8e0"
TRANSFER_BASE = "2cca00a2248e9a0c04ef5173e3364709a517f31e"
AUTH_BASE = "03620e25ed19fc70ab9e493627fb84c4b9a3617c"
APPLE_ID_BASE = "0c17376475cf76798d553e7b9717543056df1595"
TEST_MODE_FILES = {
    "tools/apple_storekit_testflight_delivery.py",
    "tests/storekit-testflight-delivery.test.py",
}
SIGNING_VERIFICATION_FILES = {
    "tools/apple_storekit_signing_diagnostic.py",
    "tests/storekit-signing-diagnostic.test.py",
    "tests/storekit-testflight-delivery.test.py",
}
DELIVERY_ALIGNMENT_FILES = {
    "tools/apple_storekit_testflight_delivery.py",
    "tests/storekit-testflight-delivery.test.py",
}
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
HISTORY_CATEGORIES = {
    "CERTIFICATION_EVIDENCE_REJECTED", "CERTIFICATION_AUTH_FAILED",
    "CERTIFICATION_RATE_LIMITED", "CERTIFICATION_API_UNAVAILABLE",
    "CERTIFICATION_NETWORK_TIMEOUT", "CERTIFICATION_RESPONSE_INVALID",
    "CERTIFICATION_CONTEXT_REJECTED", "CERTIFICATION_NETWORK_FAILED",
    "CERTIFICATION_API_REJECTED",
}
PREFLIGHT_CATEGORIES = PREFLIGHT_CATEGORIES | HISTORY_CATEGORIES
HISTORY_ATTEMPTS = 3
HISTORY_WAIT_BUDGET = 65
HISTORY_DEADLINE = 90
HISTORY_TIMEOUT = 10
HISTORY_MAX_BYTES = 1048576
RUN = 39181592021
REPOSITORY = "DBMaps/liberty-county-map"
PREFIX = "refs/tags/gridly-storekit-testflight-deliver-15-"
FILES = {
    ".github/workflows/gridly-storekit-testflight-delivery.yml",
    "tools/apple_storekit_testflight_delivery.py",
    "tests/storekit-testflight-delivery.test.py",
}
# The historical four-file refinement is pinned at REFINEMENT_BASE.
# REPAIR_FILES remains the pinned four-file CMS repair inventory.
# The three-file Apple ID correction is pinned at APPLE_ID_BASE.
# Permit one direct-child test-mode correction of TEST_MODE_FILES only; older inventories stay pinned.
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
    "gridly-storekit-signing-diagnostic-15-" + SIGNING_VERIFIED_BASE:
        ("0ec2230f6c42b4212afa18bf71d3045a0c978be3", SIGNING_VERIFIED_BASE),
    "gridly-storekit-testflight-deliver-15-" + P04_BASE:
        ("06dbef1c5ae5f5250b536d8f3b6232487b114f56", P04_BASE),
    "gridly-storekit-testflight-deliver-15-" + ARCHIVE_BASE:
        ("e71cf11b1fbca960527ad019762a12cb68b25600", ARCHIVE_BASE),
    "gridly-storekit-testflight-deliver-15-" + EVIDENCE_BASE:
        ("69876691a5c1e996ac099edb492c75fbd6b99696", EVIDENCE_BASE),
    "gridly-storekit-testflight-deliver-15-" + ENVIRONMENT_BASE:
        ("c8a561e739bff54346c75864042d65b08b1b9b4e", ENVIRONMENT_BASE),
    "gridly-storekit-testflight-deliver-15-" + TRANSFER_BASE:
        ("7f756b44328fa46edccf8b4f4242460617382621", TRANSFER_BASE),
    "gridly-storekit-testflight-deliver-15-" + AUTH_BASE:
        ("4e9510666f0a51bdc9209a877e6dd420677abb7d", AUTH_BASE),
    "gridly-storekit-testflight-deliver-15-" + APPLE_ID_BASE:
        ("554bcf82c8b6aae6e99a610ace4b2d4977c0e999", APPLE_ID_BASE),
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
APPLE_ID_AUTH_FIELD = "apple_id_upload_authorization"
UI_UNUSED_METHOD = "OWNER_AND_INDEPENDENT_APP_STORE_CONNECT_UI"
UI_UNUSED_CONFIRMATIONS = {
    "authorized", "owner_verified_unused", "independent_verified_unused",
    "build_uploads_reviewed", "testflight_all_builds_reviewed",
    "no_pending_or_uncertain_uploads", "exclusive_upload_window_acknowledged",
}


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
    require(isinstance(value, dict) and set(value) - {APPLE_ID_AUTH_FIELD} in (fields, fields | {OWNER_AUTO_FIELD}), "exact owner authorization required")
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
    if APPLE_ID_AUTH_FIELD in value:
        ui_unused_build(value, now)
    return value


def ui_unused_build(authorization, now=None):
    """Explicit owner-approved UI evidence, never an invented live API response."""
    evidence = authorization.get(APPLE_ID_AUTH_FIELD)
    require(isinstance(evidence, dict) and set(evidence) == UI_UNUSED_CONFIRMATIONS | {
        "method", "owner_checked_at", "independent_checked_at",
    }, "complete independent UI build evidence required")
    require(evidence["method"] == UI_UNUSED_METHOD
            and all(evidence[key] is True for key in UI_UNUSED_CONFIRMATIONS),
            "independent UI unused-build confirmations required")
    require(evidence["owner_checked_at"] == authorization["owner_checks_at"],
            "UI owner check must match the owner authorization")
    moment = time.time() if now is None else now
    for name in ("owner_checked_at", "independent_checked_at"):
        stamp = evidence[name]
        require(isinstance(stamp, str) and re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", stamp),
                "genuine UTC UI evidence time required")
        checked = dt.datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc).timestamp()
        require(0 <= moment - checked <= OWNER_CHECK_TTL, "independent UI build evidence expired")
    # Private receipt states the evidence source truthfully. No Apple query is claimed.
    return {"build": "15", "version": "1.0.0", "unused": True, "verification_method": UI_UNUSED_METHOD,
            "owner_checked_at": evidence["owner_checked_at"],
            "independent_checked_at": evidence["independent_checked_at"]}


def apple_id_command(root, ipa, values):
    username = values.get("APPLE_ID_USERNAME", "")
    password = values.get("APPLE_APP_SPECIFIC_PASSWORD", "")
    require(isinstance(username, str) and 0 < len(username) <= 320
            and username == username.strip() and not any(char.isspace() or ord(char) < 32 for char in username)
            and isinstance(password, str) and 0 < len(password) <= 1024
            and password == password.strip() and not any(char in password for char in "\r\n\0"),
            "existing Apple ID upload credentials required")
    # The supported @env form keeps the password out of argv and exception commands.
    command = ["xcrun", "altool", "--type", "ios", "--file", str(ipa),
               "--username", username, "--password", "@env:APPLE_APP_SPECIFIC_PASSWORD"]
    return command, {"env": {**os.environ, "APPLE_APP_SPECIFIC_PASSWORD": password}}


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
    if os.environ.get("GRIDLY_UPLOAD_AUTHENTICATION") == "APPLE_ID":
        require(APPLE_ID_AUTH_FIELD in value, "explicit Apple ID UI authorization required")
    return {"authorization": value, "ref": ref, "source_commit": commit, "build": "15"}


def source_guard(commit, clean):
    require(re.fullmatch(r"[0-9a-f]{40}", commit or ""), "exact source SHA required")
    pinned = {SOURCE, DELIVERY_BASE, OWNER_CORRECTION, PREFLIGHT_BASE, REFINEMENT_BASE,
              SIGNING_BASE, CMS_BASE, CMS_REPAIR_BASE, SIGNING_VERIFIED_BASE, P04_BASE, ARCHIVE_BASE, EVIDENCE_BASE, ENVIRONMENT_BASE, TRANSFER_BASE, AUTH_BASE, APPLE_ID_BASE}
    require(cert.git("rev-parse", "HEAD").decode().strip() == commit and commit not in pinned,
            "new reviewed delivery-support commit required")
    for child, parent in (
        (commit, APPLE_ID_BASE), (APPLE_ID_BASE, AUTH_BASE), (AUTH_BASE, TRANSFER_BASE), (TRANSFER_BASE, ENVIRONMENT_BASE), (ENVIRONMENT_BASE, EVIDENCE_BASE), (EVIDENCE_BASE, ARCHIVE_BASE), (ARCHIVE_BASE, P04_BASE), (P04_BASE, SIGNING_VERIFIED_BASE),
        (SIGNING_VERIFIED_BASE, CMS_REPAIR_BASE),
        (CMS_REPAIR_BASE, CMS_BASE), (CMS_BASE, SIGNING_BASE), (SIGNING_BASE, REFINEMENT_BASE),
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
        (CMS_BASE, CMS_REPAIR_BASE, "M", REPAIR_FILES),
        (CMS_REPAIR_BASE, SIGNING_VERIFIED_BASE, "M", SIGNING_VERIFICATION_FILES),
        (SIGNING_VERIFIED_BASE, P04_BASE, "M", DELIVERY_ALIGNMENT_FILES),
        (P04_BASE, ARCHIVE_BASE, "M", FILES),
        (ARCHIVE_BASE, EVIDENCE_BASE, "M", FILES),
        (EVIDENCE_BASE, ENVIRONMENT_BASE, "M", FILES),
        (ENVIRONMENT_BASE, TRANSFER_BASE, "M", FILES),
        (TRANSFER_BASE, AUTH_BASE, "M", FILES),
        (AUTH_BASE, APPLE_ID_BASE, "M", FILES),
        (APPLE_ID_BASE, commit, "M", TEST_MODE_FILES),
        (SOURCE, commit, "A", FILES | PREFLIGHT_FILES | SIGNING_FILES | CMS_FILES),
    ):
        records = cert.git("diff", "--name-status", "--no-renames", base, target).decode().splitlines()
        require(set(records) == {status + "\t" + path for path in inventory} and len(records) == len(inventory),
                "exact historical inventories and three-file Apple ID delivery correction required; all other source frozen")
        for path in inventory:
            require(cert.git("ls-tree", target, "--", path).decode().split()[0] == "100644",
                    "historical or current support file mode changed")
    for path in FILES | PREFLIGHT_FILES | SIGNING_FILES | CMS_FILES:
        require(cert.git("ls-tree", commit, "--", path).decode().split()[0] == "100644", "support file mode changed")
    require(not cert.git("diff", "--name-only", "HEAD"), "tracked working source changed")
    require(not cert.git("diff", "--cached", "--name-only"), "staged source changed")
    if clean:
        require(not cert.git("status", "--porcelain=v1", "--untracked-files=normal"), "candidate not frozen")
    cert.original_contracts()
    return {"source_commit": commit, "certified_source_commit": SOURCE, "build": "15",
            "runtime_unchanged": True, "original_contracts_unchanged": True}


class HistoryFailure(ValueError):
    """Only an allowlisted category crosses the private retrieval boundary."""
    def __init__(self, category):
        require(category in HISTORY_CATEGORIES, "fixed history category required")
        self.category = category
        super().__init__(category)


class HistoryNoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None  # A moved endpoint needs review; never forward the token.


def history_context(token, environment):
    sha = environment.get("GITHUB_SHA", "")
    valid = (environment.get("GITHUB_ACTIONS") == "true"
             and environment.get("RUNNER_OS") == "macOS"
             and environment.get("GITHUB_REPOSITORY") == REPOSITORY
             and environment.get("GITHUB_EVENT_NAME") == "push"
             and environment.get("GITHUB_RUN_ATTEMPT") == "1"
             and isinstance(sha, str) and re.fullmatch(r"[0-9a-f]{40}", sha)
             and environment.get("GITHUB_REF") == PREFIX + sha
             and environment.get("GITHUB_API_URL") == "https://api.github.com")
    if not valid:
        raise HistoryFailure("CERTIFICATION_CONTEXT_REJECTED")
    if not isinstance(token, str) or not token or not token.isascii() or any(c.isspace() or ord(c) < 33 or ord(c) == 127 for c in token):
        raise HistoryFailure("CERTIFICATION_AUTH_FAILED")


def history_retry_delay(headers, limited, attempt, now):
    # GitHub: honor Retry-After, AND an exhausted primary-limit reset. Without
    # either, a secondary-limit retry must wait at least one minute.
    retry = headers.get("Retry-After")
    remaining = headers.get("X-RateLimit-Remaining")
    reset = headers.get("X-RateLimit-Reset")
    delay = 60 * (2 ** attempt) if limited else 2 ** attempt
    if retry is not None:
        try:
            if re.fullmatch(r"[0-9]+", retry):
                delay = int(retry)
            else:
                stamp = email.utils.parsedate_to_datetime(retry)
                require(stamp.tzinfo is not None, "UTC retry time required")
                delay = stamp.timestamp() - now
            require(math.isfinite(delay), "finite retry time required")
        except (ValueError, TypeError, OverflowError):
            return None  # Do not guess around malformed server instructions.
    if remaining == "0":
        if not isinstance(reset, str) or not re.fullmatch(r"[0-9]+", reset):
            return None
        delay = max(delay, int(reset) - now + 1)
    return max(1, delay)  # No immediate rate-limit retry, even for a past date.


def public_json(url, *, token=None, environment=None, open_request=None,
                sleep=time.sleep, clock=time.time, monotonic=time.monotonic):
    base = "https://api.github.com/repos/" + REPOSITORY + "/actions/runs/" + str(RUN)
    if url not in {base, base + "/attempts/1/jobs?per_page=100", base + "/artifacts?per_page=100"}:
        raise HistoryFailure("CERTIFICATION_CONTEXT_REJECTED")
    history_context(token, {} if environment is None else environment)
    if open_request is None:
        # No redirect, cookie handler, proxy, or global opener can forward credentials.
        open_request = urllib.request.build_opener(
            urllib.request.ProxyHandler({}), HistoryNoRedirect()).open
    started, waited = monotonic(), 0
    category = "CERTIFICATION_API_UNAVAILABLE"
    for attempt in range(HISTORY_ATTEMPTS):
        remaining = HISTORY_DEADLINE - (monotonic() - started)
        if remaining <= 0:
            raise HistoryFailure(category)
        request = urllib.request.Request(url, method="GET", headers={
            "Accept": "application/vnd.github+json", "Authorization": "Bearer " + token,
            "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Gridly-P04-certification-evidence",
        })
        headers, limited = {}, False
        try:
            with open_request(request, timeout=min(HISTORY_TIMEOUT, remaining)) as response:
                if response.geturl() != url:
                    raise HistoryFailure("CERTIFICATION_CONTEXT_REJECTED")
                if response.status != 200:
                    raise HistoryFailure("CERTIFICATION_API_REJECTED")
                if (response.headers.get("Content-Type", "").split(";")[0].strip() != "application/json"
                        or response.headers.get("Link")):
                    raise HistoryFailure("CERTIFICATION_RESPONSE_INVALID")
                body = response.read(HISTORY_MAX_BYTES + 1)
                length = response.headers.get("Content-Length")
                if (len(body) > HISTORY_MAX_BYTES or (length is not None and (
                        not re.fullmatch(r"[0-9]+", length) or int(length) != len(body)))):
                    raise HistoryFailure("CERTIFICATION_RESPONSE_INVALID")
                try:
                    value = json.loads(body, object_pairs_hook=cert.unique_json_object)
                except (ValueError, UnicodeError, TypeError):
                    raise HistoryFailure("CERTIFICATION_RESPONSE_INVALID") from None
                if not isinstance(value, dict):
                    raise HistoryFailure("CERTIFICATION_RESPONSE_INVALID")
                if monotonic() - started >= HISTORY_DEADLINE:
                    raise HistoryFailure("CERTIFICATION_NETWORK_TIMEOUT")
                return value
        except urllib.error.HTTPError as failure:
            code, headers = failure.code, failure.headers
            # Only a bounded message inspection identifies a secondary limit when
            # GitHub supplies no retry header. Neither body nor exception is logged.
            limited = code == 429 or (code == 403 and (
                headers.get("Retry-After") is not None or headers.get("X-RateLimit-Remaining") == "0"))
            if code == 403 and not limited:
                try:
                    message = json.loads(failure.read(HISTORY_MAX_BYTES + 1)).get("message", "")
                    limited = isinstance(message, str) and "rate limit" in message.lower()
                except (ValueError, TypeError, AttributeError, OSError):
                    pass
            failure.close()
            if limited:
                category = "CERTIFICATION_RATE_LIMITED"
            elif code in {401, 403}:
                raise HistoryFailure("CERTIFICATION_AUTH_FAILED") from None
            elif code in {500, 502, 503, 504}:
                category = "CERTIFICATION_API_UNAVAILABLE"
            elif 300 <= code < 400:
                raise HistoryFailure("CERTIFICATION_CONTEXT_REJECTED") from None
            else:
                raise HistoryFailure("CERTIFICATION_API_REJECTED") from None
        except http.client.IncompleteRead:
            raise HistoryFailure("CERTIFICATION_RESPONSE_INVALID") from None
        except (TimeoutError, socket.timeout):
            category = "CERTIFICATION_NETWORK_TIMEOUT"
        except urllib.error.URLError as failure:
            if isinstance(failure.reason, (TimeoutError, socket.timeout)):
                category = "CERTIFICATION_NETWORK_TIMEOUT"
            else:
                raise HistoryFailure("CERTIFICATION_NETWORK_FAILED") from None
        except OSError:
            raise HistoryFailure("CERTIFICATION_NETWORK_FAILED") from None
        if attempt + 1 >= HISTORY_ATTEMPTS:
            raise HistoryFailure(category) from None
        delay = history_retry_delay(headers, limited, attempt, clock())
        if (delay is None or waited + delay > HISTORY_WAIT_BUDGET
                or monotonic() - started + delay >= HISTORY_DEADLINE):
            raise HistoryFailure(category) from None
        sleep(delay)
        waited += delay
    raise HistoryFailure(category)


def historical_evidence(get=None, *, token=None, environment=None):
    if get is None:
        get = lambda url: public_json(url, token=token, environment=environment)
    base = "https://api.github.com/repos/" + REPOSITORY + "/actions/runs/" + str(RUN)

    def response(url, fields):
        value = get(url)
        if not isinstance(value, dict) or not all(key in value and type(value[key]) is kind for key, kind in fields.items()):
            raise HistoryFailure("CERTIFICATION_RESPONSE_INVALID")
        return value

    def matches(value):
        if not value:
            raise HistoryFailure("CERTIFICATION_EVIDENCE_REJECTED")

    run = response(base, {"id": int, "head_sha": str, "run_attempt": int, "status": str,
                          "conclusion": str, "path": str, "event": str, "head_branch": str})
    matches(run["id"] == RUN and run["head_sha"] == SOURCE and run["run_attempt"] == 1)
    matches(run["status"] == "completed" and run["conclusion"] == "success")
    matches(run["path"] == ".github/workflows/gridly-storekit-diagnostic-certification.yml")
    matches(run["event"] == "push" and run["head_branch"] == "gridly-storekit-diagnostic-certify-15-" + SOURCE)
    jobs = response(base + "/attempts/1/jobs?per_page=100", {"total_count": int, "jobs": list})
    matches(jobs["total_count"] == 1 and len(jobs["jobs"]) == 1)
    job = jobs["jobs"][0]
    if (not isinstance(job, dict) or not all(type(job.get(key)) is str for key in ("name", "conclusion"))
            or not isinstance(job.get("steps"), list) or not job["steps"]
            or not all(isinstance(step, dict) and type(step.get("conclusion")) is str for step in job["steps"])):
        raise HistoryFailure("CERTIFICATION_RESPONSE_INVALID")
    matches(job["name"] == "certify-storekit-diagnostics" and job["conclusion"] == "success")
    matches(all(step["conclusion"] == "success" for step in job["steps"]))
    artifacts = response(base + "/artifacts?per_page=100", {"total_count": int, "artifacts": list})
    matches(artifacts["total_count"] == 0 and artifacts["artifacts"] == [])
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
    # Remove the step-scoped token BEFORE authorization or any child tool starts.
    # It stays only in this helper's historical-request closure, never GITHUB_ENV.
    history_token = environment.pop("GRIDLY_HISTORY_TOKEN", None)
    history_environment = {key: environment.get(key) for key in (
        "GITHUB_ACTIONS", "RUNNER_OS", "GITHUB_REPOSITORY", "GITHUB_EVENT_NAME",
        "GITHUB_RUN_ATTEMPT", "GITHUB_SHA", "GITHUB_REF", "GITHUB_API_URL")}
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
        except Exception as failure:
            if stage == "P04_CERTIFICATION_HISTORY" and isinstance(failure, HistoryFailure):
                category = failure.category
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
    history = checked("P04_CERTIFICATION_HISTORY", "INTERNAL_FAILURE",
                      lambda: historical_evidence(token=history_token, environment=history_environment))
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
    verify_delivery_export(root / "DiagnosticExportOptions.plist", "INPUT")
    verify_delivery_export(ipa.parent / "ExportOptions.plist", "OUTPUT")
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



DELIVERY_STAGES = (
    "D01_FINAL_LOCAL_VERIFICATION", "D02_CREDENTIAL_PRESENCE_FORMAT",
    "D03_APPLE_VALIDATION", "D04_POST_VALIDATION_VERIFICATION",
    "D05_LIVE_BUILD_AVAILABILITY", "D06_ACTUAL_UPLOAD",
)
DELIVERY_STAGE_FAILURES = {
    "D01_FINAL_LOCAL_VERIFICATION": "LOCAL_VERIFICATION_REJECTED",
    "D02_CREDENTIAL_PRESENCE_FORMAT": "CREDENTIAL_SETUP_REJECTED",
    "D03_APPLE_VALIDATION": "APPLE_VALIDATION_FAILED",
    "D04_POST_VALIDATION_VERIFICATION": "POST_VALIDATION_REJECTED",
    "D05_LIVE_BUILD_AVAILABILITY": "BUILD_AVAILABILITY_FAILED",
    "D06_ACTUAL_UPLOAD": "UPLOAD_FAILED_OR_UNCERTAIN",
}
DELIVERY_CATEGORIES = set(DELIVERY_STAGE_FAILURES.values()) | {
    "NONE", "DEPENDENCY_FAILED", "DELIVERY_CONTEXT_REJECTED", "OWNER_AUTHORIZATION_EXPIRED",
    "SOURCE_GUARD_REJECTED", "SIGNED_PROOF_REJECTED", "IPA_BYTES_CHANGED",
    "CREDENTIAL_FORMAT_REJECTED", "CREDENTIAL_MATERIAL_REJECTED",
    "API_TOKEN_GENERATION_FAILED", "BUILD_NOT_CONFIRMED_UNUSED", "PREVIOUS_UPLOAD_ATTEMPT",
    "APPLE_ID_CREDENTIALS_REJECTED", "UI_BUILD_EVIDENCE_REJECTED", "APPLE_ID_AUTHORIZATION_REJECTED",
} | {
    origin + "_EXPORT_" + reason
    for origin in ("INPUT", "OUTPUT")
    for reason in ("UNREADABLE", "INTERNAL_ONLY_MISSING", "INTERNAL_ONLY_REJECTED",
                   "METHOD_MISSING", "METHOD_REJECTED", "DESTINATION_MISSING", "DESTINATION_REJECTED",
                   "BUILD_NUMBER_MISSING", "BUILD_NUMBER_REJECTED")
}


class DeliveryCheckFailure(ValueError):
    def __init__(self, category):
        require(category in DELIVERY_CATEGORIES, "fixed delivery category required")
        self.category = category
        super().__init__(category)


def verify_delivery_export(path, origin):
    """Retain the exact export guard; diagnose only fixed key/type conditions."""
    require(origin in {"INPUT", "OUTPUT"}, "fixed export origin required")
    try:
        return export_guard(path)
    except Exception as error:
        category = origin + "_EXPORT_UNREADABLE"
        try:
            require(Path(path).stat().st_size <= 65536, "bounded diagnostic plist required")
            options = plistlib.loads(Path(path).read_bytes())
            require(isinstance(options, dict), "dictionary required")
            for key, expected, label in (
                ("testFlightInternalTestingOnly", True, "INTERNAL_ONLY"),
                ("method", "app-store-connect", "METHOD"), ("destination", "export", "DESTINATION"),
                ("manageAppVersionAndBuildNumber", False, "BUILD_NUMBER")):
                if key not in options:
                    category = origin + "_EXPORT_" + label + "_MISSING"
                    break
                if (options[key] is not expected if type(expected) is bool else options[key] != expected):
                    category = origin + "_EXPORT_" + label + "_REJECTED"
                    break
        except Exception:
            pass  # No plist values, paths or parser errors may cross the boundary.
        raise DeliveryCheckFailure(category) from error


def delivery_failure_category(stage, error):
    if isinstance(error, DeliveryCheckFailure):
        return error.category
    # Compare only our own fixed messages; never return exception text.
    exact = {
        "private tool home required": "DELIVERY_CONTEXT_REJECTED",
        "future authorized macOS workflow only": "DELIVERY_CONTEXT_REJECTED",
        "owner distribution/build checks expired": "OWNER_AUTHORIZATION_EXPIRED",
        "exact historical inventories and three-file Apple ID delivery correction required; all other source frozen": "SOURCE_GUARD_REJECTED",
        "tracked working source changed": "SOURCE_GUARD_REJECTED",
        "missing preflight/certification evidence": "SIGNED_PROOF_REJECTED",
        "signed certification required": "SIGNED_PROOF_REJECTED",
        "wrong signed identity": "SIGNED_PROOF_REJECTED",
        "signed/parity proof incomplete": "SIGNED_PROOF_REJECTED",
        "activation/web parity required": "SIGNED_PROOF_REJECTED",
        "certified IPA bytes changed": "IPA_BYTES_CHANGED",
        "IPA changed before upload": "IPA_BYTES_CHANGED",
        "existing team API upload credentials required": "CREDENTIAL_FORMAT_REJECTED",
        "existing Apple ID upload credentials required": "APPLE_ID_CREDENTIALS_REJECTED",
        "explicit Apple ID UI authorization required": "APPLE_ID_AUTHORIZATION_REJECTED",
        "complete independent UI build evidence required": "UI_BUILD_EVIDENCE_REJECTED",
        "independent UI unused-build confirmations required": "UI_BUILD_EVIDENCE_REJECTED",
        "UI owner check must match the owner authorization": "UI_BUILD_EVIDENCE_REJECTED",
        "genuine UTC UI evidence time required": "UI_BUILD_EVIDENCE_REJECTED",
        "independent UI build evidence expired": "UI_BUILD_EVIDENCE_REJECTED",
        "existing API signing material required": "CREDENTIAL_MATERIAL_REJECTED",
        "invalid signing response": "API_TOKEN_GENERATION_FAILED",
        "Build 15 already exists or availability is undetermined": "BUILD_NOT_CONFIRMED_UNUSED",
        "previous upload attempt; owner must investigate": "PREVIOUS_UPLOAD_ATTEMPT",
    }
    if stage == "D05_LIVE_BUILD_AVAILABILITY" and isinstance(error, subprocess.CalledProcessError) and isinstance(error.cmd, (list, tuple)) and error.cmd[:1] == ["node"]:
        return "API_TOKEN_GENERATION_FAILED"
    return exact.get(str(error), DELIVERY_STAGE_FAILURES[stage])


@contextlib.contextmanager
def delivery_stage(stage, progress):
    require(stage in DELIVERY_STAGES, "fixed delivery stage required")
    if progress is not None:
        progress(stage, "RUNNING", "NONE")
    try:
        yield
    except BaseException as error:
        if progress is not None:
            try:
                progress(stage, "FAIL", delivery_failure_category(stage, error))
            except Exception:
                pass  # Reporting failure never resumes or retries the failed operation.
        raise
    else:
        if progress is not None:
            progress(stage, "PASS", "NONE")


def emit_delivery(records):
    require(isinstance(records, list) and len(records) == len(DELIVERY_STAGES), "complete fixed delivery report required")
    stopped = False
    for expected, record in zip(DELIVERY_STAGES, records):
        require(isinstance(record, dict) and set(record) == {"stage", "status", "category"}
                and record["stage"] == expected and record["status"] in {"PASS", "FAIL", "RUNNING", "NOT_RUN"}
                and record["category"] in DELIVERY_CATEGORIES, "fixed delivery record required")
        require(not stopped or record["status"] == "NOT_RUN", "dependent stage cannot execute")
        if record["status"] == "PASS":
            require(record["category"] == "NONE", "successful stage cannot have an error")
        elif record["status"] == "NOT_RUN":
            require(record["category"] == "DEPENDENCY_FAILED", "unexecuted stage required")
            stopped = True
        elif record["status"] == "RUNNING":
            require(record["category"] == "NONE", "running stage cannot have an error")
            stopped = True
        else:
            require(record["category"] not in {"NONE", "DEPENDENCY_FAILED"}, "fixed failure category required")
            stopped = True
    payload = json.dumps({"delivery_stages": records}, sort_keys=True).encode() + b"\n"
    require(len(payload) <= 8192, "bounded public result required")
    os.write(3, payload)


def transfer_public(root, commit, ipa):
    require(root.is_dir() and not root.is_symlink() and not (root / ".owned").is_symlink()
            and (root / ".owned").read_text() == cert.PRIVATE_MARKER, "owned private root required")
    reports = root / "reports"
    require(reports.is_dir() and not reports.is_symlink(), "private reports required")
    destination = reports / "delivery-stages.json"
    require(not destination.exists() and not destination.is_symlink(), "one delivery report only")
    records = [{"stage": stage, "status": "NOT_RUN", "category": "DEPENDENCY_FAILED"} for stage in DELIVERY_STAGES]
    def progress(stage, status, category):
        index = DELIVERY_STAGES.index(stage)
        require(records[index]["status"] == ("NOT_RUN" if status == "RUNNING" else "RUNNING"),
                "one execution per delivery stage")
        candidate = [dict(record) for record in records]
        candidate[index] = {"stage": stage, "status": status, "category": category}
        # Validate atomically before private persistence or the public FD.
        # Validation is performed by the same emitter; no raw child output uses FD 3.
        require(not destination.is_symlink(), "private report leaf required")
        emit_delivery(candidate)
        write_json(destination, {"delivery_stages": candidate})
        records[:] = candidate
    def precheck(private, source, artifact):
        require(os.environ.get("RUNNER_OS") == "macOS" and os.environ.get("GITHUB_ACTIONS") == "true", "future authorized macOS workflow only")
        require(os.environ.get("HOME") == str(root / "home") and os.environ.get("CFFIXED_USER_HOME") == str(root / "home"), "private tool home required")
        return ready(private, source, artifact)
    return transfer(root, commit, ipa, precheck=precheck, progress=progress)


def transfer(root, commit, ipa, precheck=ready, credentials=None, token_factory=api_token,
             get=apple_get, execute=subprocess.run, clock=time.time, progress=None):
    """One validation then one upload; fixed reporting never bypasses a gate."""
    with delivery_stage("D01_FINAL_LOCAL_VERIFICATION", progress):
        precheck(root, commit, ipa)
        marker = root / "reports/delivery-transfer.json"
        require(not marker.exists(), "previous upload attempt; owner must investigate")
    with delivery_stage("D02_CREDENTIAL_PRESENCE_FORMAT", progress):
        # Credentials are first read only AFTER authorization, signed certification and parity.
        values = os.environ if credentials is None else credentials
        authorization = authorization_guard(root, commit)
        apple_id_mode = APPLE_ID_AUTH_FIELD in authorization
        require(os.environ.get("GRIDLY_UPLOAD_AUTHENTICATION") != "APPLE_ID" or apple_id_mode,
                "explicit Apple ID UI authorization required")
        transport_options = {}
        if apple_id_mode:
            command, transport_options = apple_id_command(root, ipa, values)
        else:
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
    with delivery_stage("D03_APPLE_VALIDATION", progress):
        execute([*command, "--validate-app"], check=True, cwd=root / "home", **transport_options)
    with delivery_stage("D04_POST_VALIDATION_VERIFICATION", progress):
        # Recheck frozen source, owner settings TTL, IPA digest, all reports after validation.
        current_proof, _ = precheck(root, commit, ipa)
    with delivery_stage("D05_LIVE_BUILD_AVAILABILITY", progress):
        check_started = clock()
        if apple_id_mode:
            # D05 retains its historical name; this mode verifies fresh UI evidence,
            # not authenticated API availability. The owner explicitly approved this change.
            unused = ui_unused_build(authorization_guard(root, commit), now=clock())
        else:
            token = token_factory(key, issuer, key_path)
            unused = unused_build(lambda path: get(path, token))
        authorization_guard(root, commit)
        require(0 <= clock() - check_started <= 60, "build availability check expired")
        require(hashlib.sha256(ipa.read_bytes()).hexdigest() == current_proof["ipa_sha256"], "IPA changed before upload")
        write_json(root / "reports/delivery-availability.json", {**unused, "checked_at": int(clock())})
    with delivery_stage("D06_ACTUAL_UPLOAD", progress):
        # No build/signing work or unrelated Apple operation between this final unused-build gate and the upload.
        write_json(marker, {"status": "ATTEMPTED", "source_commit": commit, "build": "15"})
        execute([*command, "--upload-app"], check=True, cwd=root / "home", **transport_options)
        write_json(marker, {"status": "ACCEPTED", "source_commit": commit, "build": "15"})



# Only fixed classifications cross the public boundary. No matching text is emitted.
ARCHIVE_RULES = (
    ("PROVISIONING_OR_SIGNING", "PROFILE_REJECTED", r"(?:error:.*(?:provisioning profile|no profiles for|requires a provisioning)|provisioning profile.*(?:doesn't|does not|expired|not include))"),
    ("PROVISIONING_OR_SIGNING", "SIGNING_FAILED", r"(?:error:.*(?:code ?sign|signing certificate|signing identity)|command codesign failed)"),
    ("MISSING_BUILD_INPUT", "BUILD_INPUT_MISSING", r"(?:build input files? cannot be found|error:.*(?:file not found|no such file or directory|unable to open base configuration|unable to load project))"),
    ("SWIFT_COMPILATION", "SWIFT_COMPILER_FAILED", r"(?:\.swift:\d+(?::\d+)?:\s*(?:fatal )?error:|swift compiler error:|command swiftcompile failed|command swiftfrontend failed)"),
    ("PACKAGE_DEPENDENCY", "DEPENDENCY_RESOLUTION_FAILED", r"(?:could not resolve package dependencies|failed to resolve dependencies|error:.*(?:missing package product|package resolution|package dependency))"),
    ("SANDBOX_OR_FILESYSTEM", "SANDBOX_DENIED", r"(?:sandbox:.*deny|error:.*(?:operation not permitted|permission denied|read-only file system))"),
    ("TOOLCHAIN_OR_SDK", "TOOLCHAIN_UNAVAILABLE", r"(?:xcodebuild: error:.*(?:sdk|toolchain|destination|platform)|error:.*(?:sdk.*(?:not found|cannot be located)|invalid active developer path))"),
)
ARCHIVE_MAX_BYTES = 1048576
ARCHIVE_STRUCTURED_STATES = {"NOT_AVAILABLE", "READ", "UNREADABLE", "LIMIT_REACHED", "CONTEXT_REJECTED"}


def classify_archive(text, exit_code, source="PRIVATE_TEXT", structured="NOT_AVAILABLE"):
    require(type(exit_code) is int and 0 <= exit_code <= 255, "bounded exit status required")
    require(source in {"NONE", "PRIVATE_TEXT", "STRUCTURED"} and structured in ARCHIVE_STRUCTURED_STATES,
            "fixed evidence source required")
    record = {"stage": "XCODE_ARCHIVE", "status": "PASS" if exit_code == 0 else "FAIL",
              "exit_code": exit_code, "category": "NONE" if exit_code == 0 else "UNCLASSIFIED",
              "reason": "NONE" if exit_code == 0 else "UNKNOWN",
              "evidence_source": source, "structured_status": structured}
    if exit_code:
        # Input is bounded before regex matching; output is constants only.
        for line in text[:ARCHIVE_MAX_BYTES].splitlines():
            for category, reason, pattern in ARCHIVE_RULES:
                if re.search(pattern, line[:8192], re.I):
                    record.update(category=category, reason=reason)
                    return record
    return record


def archive_report(runner_temp, exit_code):
    """Read only existing private diagnostics; never add/change archive flags."""
    unknown = classify_archive("", exit_code, "NONE")
    try:
        root = cert.private_directory(runner_temp)
        require(root.is_dir() and not root.is_symlink(), "owned root required")
        marker = root / ".owned"
        require(marker.is_file() and not marker.is_symlink() and marker.read_text() == cert.PRIVATE_MARKER,
                "owned root required")
        require(str(root) == os.environ.get("DIAGNOSTIC_PRIVATE_ROOT"), "private CI context required")
        logs = root / "logs"
        require(logs.is_dir() and not logs.is_symlink(), "owned logs required")
        if not exit_code:
            return classify_archive("", 0, "NONE")
        raw = logs / "archive-raw.log"
        require(raw.is_file() and not raw.is_symlink(), "owned archive log required")
        with raw.open("rb") as stream:
            first = stream.read(ARCHIVE_MAX_BYTES // 2)
            stream.seek(max(len(first), raw.stat().st_size - ARCHIVE_MAX_BYTES // 2))
            tail = stream.read(ARCHIVE_MAX_BYTES // 2)
        text = (first + b"\n" + tail).decode("utf-8", errors="replace")
        # Only a bundle explicitly referenced by THIS archive log is eligible.
        # No directory crawl or inference from timestamps/stale build results.
        bundles, structured = [], "NOT_AVAILABLE"
        for line in text.splitlines():
            match = re.fullmatch(r"\s*Writing error result bundle to\s+(.+\.xcresult)\s*", line)
            if match:
                candidate = Path(match.group(1).strip().strip("'\\\""))
                try:
                    require(candidate.is_absolute() and candidate.resolve().is_relative_to(root), "private result required")
                    for parent in (candidate, *candidate.parents):
                        if parent == root:
                            break
                        require(not parent.is_symlink(), "linked result rejected")
                    require(candidate.is_dir(), "result not available")
                    bundles = [candidate]
                except Exception:
                    structured = "CONTEXT_REJECTED"
                break
        try:
            if bundles:
                structured = "UNREADABLE"
                # Apple's documented legacy object format; unsupported versions/timeouts
                # fail privately and fall back to bounded raw error classification.
                output = logs / "archive-result-private.json"
                with output.open("xb") as destination:
                    result = subprocess.run(["xcrun", "xcresulttool", "get", "object", "--legacy",
                                             "--path", str(bundles[0]), "--format", "json"],
                                            stdout=destination, stderr=subprocess.DEVNULL, timeout=10, check=False)
                if result.returncode == 0 and output.stat().st_size > ARCHIVE_MAX_BYTES:
                    structured = "LIMIT_REACHED"
                if result.returncode == 0 and output.stat().st_size <= ARCHIVE_MAX_BYTES:
                    value = json.loads(output.read_bytes())
                    messages, stack, count = [], [(value, 0)], 0
                    while stack and count < 2048 and len(messages) < 32:
                        item, depth = stack.pop(); count += 1
                        if depth > 16:
                            continue
                        if isinstance(item, dict):
                            errors = item.get("errorSummaries", {})
                            for issue in errors.get("_values", [])[:32] if isinstance(errors, dict) else []:
                                if isinstance(issue, dict):
                                    kind = issue.get("issueType", {}).get("_value", "")
                                    message = issue.get("message", {}).get("_value", "")
                                    if isinstance(kind, str) and isinstance(message, str):
                                        messages.append(kind[:256] + ": error: " + message[:4096])
                            stack.extend((child, depth + 1) for child in list(item.values())[:128] if isinstance(child, (dict, list)))
                        elif isinstance(item, list):
                            stack.extend((child, depth + 1) for child in item[:128] if isinstance(child, (dict, list)))
                    structured = "READ"
                    record = classify_archive("\n".join(messages), exit_code, "STRUCTURED", structured)
                    if record["reason"] != "UNKNOWN":
                        return record
        except Exception:
            structured = "UNREADABLE"
        return classify_archive(text, exit_code, "PRIVATE_TEXT", structured)
    except Exception:
        # A malformed/unreadable optional result bundle must not publish errors or
        # alter the archive status. UNKNOWN is truthful and fail-closed.
        unknown["structured_status"] = "CONTEXT_REJECTED"
        return unknown


def emit_archive(record):
    require(set(record) == {"stage", "status", "exit_code", "category", "reason", "evidence_source", "structured_status"},
            "fixed archive schema required")
    allowed = {("NONE", "NONE"), ("UNCLASSIFIED", "UNKNOWN")} | {(a, b) for a, b, _ in ARCHIVE_RULES}
    require(record["stage"] == "XCODE_ARCHIVE" and (record["category"], record["reason"]) in allowed,
            "fixed archive category required")
    require(type(record["exit_code"]) is int and 0 <= record["exit_code"] <= 255
            and record["status"] == ("PASS" if record["exit_code"] == 0 else "FAIL"),
            "archive status mismatch")
    require((record["exit_code"] == 0) == (record["category"] == "NONE" and record["reason"] == "NONE"),
            "archive classification mismatch")
    require(record["evidence_source"] in {"NONE", "PRIVATE_TEXT", "STRUCTURED"}
            and record["structured_status"] in ARCHIVE_STRUCTURED_STATES, "fixed archive evidence required")
    os.write(3, (json.dumps(record, sort_keys=True) + "\n").encode())



def owned_runner_directory(path):
    require(path.is_absolute() and path.is_dir() and not path.is_symlink(), "owned runner directory required")
    require(all(not parent.is_symlink() for parent in path.parents), "symlinked runner parent")
    value = path.stat()
    if hasattr(os, "getuid"):
        require(value.st_uid == os.getuid(), "runner directory owner changed")
    return [value.st_dev, value.st_ino, value.st_uid]


def runner_context(root):
    require(root.is_dir() and not root.is_symlink()
            and not (root / ".owned").is_symlink()
            and (root / ".owned").read_text() == cert.PRIVATE_MARKER, "owned workspace required")
    if hasattr(os, "getuid"):
        require(root.stat().st_uid == os.getuid(), "workspace owner changed")
    path = root / "runner-context.json"
    require(path.is_file() and not path.is_symlink(), "runner context required")
    value = read_json(path)
    require(set(value) == {"home", "identity", "cf_home"} and isinstance(value["home"], str)
            and not any(c in value["home"] for c in "\r\n")
            and isinstance(value["identity"], list) and len(value["identity"]) == 3
            and all(type(part) is int for part in value["identity"]), "exact runner context required")
    home = Path(value["home"])
    require(not home.is_relative_to(root) and home != root, "original runner home required")
    require(owned_runner_directory(home) == value["identity"], "runner home identity changed")
    require(value["cf_home"] is None or value["cf_home"] == str(home), "conflicting CoreFoundation home")
    return value


def capture_runner_context(root):
    # Before overriding HOME: capture metadata only, never credentials/keychain data.
    home = Path(os.environ["HOME"])
    value = {"home": str(home), "identity": owned_runner_directory(home),
             "cf_home": os.environ.get("CFFIXED_USER_HOME")}
    require(value["cf_home"] is None or value["cf_home"] == str(home), "conflicting runner context")
    write_json(root / "runner-context.json", value)
    runner_context(root)
    shell = "export HOME=" + shlex.quote(str(home)) + "\n"
    shell += ("unset CFFIXED_USER_HOME\n" if value["cf_home"] is None else
              "export CFFIXED_USER_HOME=" + shlex.quote(value["cf_home"]) + "\n")
    (root / "runner-context.sh").write_text(shell)


def runner_native_environment(root):
    context = runner_context(root)
    environment = dict(os.environ)
    environment["HOME"] = context["home"]
    if context["cf_home"] is None:
        environment.pop("CFFIXED_USER_HOME", None)
    else:
        environment["CFFIXED_USER_HOME"] = context["cf_home"]
    return environment


def runner_profile(root):
    home = Path(runner_context(root)["home"])
    profile = home / "Library/MobileDevice/Provisioning Profiles" / (cert.release.PROFILE_UUID + ".mobileprovision")
    for parent in profile.parents:
        require(not parent.is_symlink(), "unsafe profile parent")
        if parent.exists() and hasattr(os, "getuid"):
            require(parent.stat().st_uid == os.getuid(), "profile parent owner changed")
        if parent == home:
            break
    return profile


def prepare_signing_context(root, commit):
    authorization_guard(root, commit)
    context = runner_context(root)
    require(os.environ.get("HOME") == context["home"]
            and os.environ.get("CFFIXED_USER_HOME") == context["cf_home"], "runner signing context required")
    profile = runner_profile(root)
    require(not profile.exists() and not profile.is_symlink(), "existing runner profile must not be replaced")
    snapshot = root / "keychain-search-list.json"
    require(not snapshot.exists() and not snapshot.is_symlink(), "one signing context only")
    listed = subprocess.run(["security", "list-keychains", "-d", "user"], check=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            env=runner_native_environment(root))
    names = shlex.split(listed.stdout.decode())
    require(all(Path(name).is_absolute() and not any(c in name for c in "\r\n") for name in names)
            and str(root / "signing.keychain-db") not in names, "original keychain list required")
    write_json(snapshot, {"home": context["home"], "names": names})


def install_runner_profile(root, commit):
    authorization_guard(root, commit)
    context = runner_context(root)
    require(os.environ.get("HOME") == context["home"]
            and os.environ.get("CFFIXED_USER_HOME") == context["cf_home"], "runner profile context required")
    require((root / "keychain-search-list.json").is_file(), "signing context not prepared")
    keychain = root / "signing.keychain-db"
    require(keychain.is_file() and not keychain.is_symlink(), "owned signing keychain required")
    listed = subprocess.run(["security", "list-keychains", "-d", "user"], check=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=runner_native_environment(root))
    require(shlex.split(listed.stdout.decode()) == [str(keychain)], "runner signing keychain not discoverable")
    source = root / "distribution.mobileprovision"
    require(source.is_file() and not source.is_symlink(), "owned original profile required")
    profile = runner_profile(root)
    profile.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    runner_profile(root)  # Recheck ancestors after mkdir, never overwrite a profile.
    with profile.open("xb") as destination:
        value = destination.fileno()
        identity = os.fstat(value)
        ownership = {"path": str(profile), "identity": [identity.st_dev, identity.st_ino, identity.st_uid]}
        (root / "installed-profile").write_text(str(profile))
        # Record ownership before writing; interrupted writes remain removable by inode.
        write_json(root / "profile-ownership.json", ownership)
        destination.write(source.read_bytes())
        destination.flush()
        os.fsync(value)
    require(profile.read_bytes() == source.read_bytes(), "installed profile bytes changed")


def verify_runner_profile_ownership(root, profile):
    require(profile == runner_profile(root), "wrong runner profile")
    record = root / "profile-ownership.json"
    require(record.is_file() and not record.is_symlink(), "profile ownership required")
    value = read_json(record)
    require(set(value) == {"path", "identity"} and value["path"] == str(profile), "wrong profile ownership")
    if profile.exists() or profile.is_symlink():
        require(not profile.is_symlink() and profile.is_file(), "unsafe runner profile")
        state = profile.stat()
        require([state.st_dev, state.st_ino, state.st_uid] == value["identity"], "installed profile identity changed")


def restore_keychain_context(root):
    path = root / "keychain-search-list.json"
    if not path.exists():
        require(not path.is_symlink() and not (root / "signing.keychain-db").exists()
                and not (root / "installed-profile").exists(), "missing keychain context")
        return None
    require(path.is_file() and not path.is_symlink(), "unsafe keychain snapshot")
    value = read_json(path)
    require(set(value) == {"home", "names"} and value["home"] == runner_context(root)["home"]
            and isinstance(value["names"], list)
            and all(isinstance(name, str) and Path(name).is_absolute()
                    and not any(c in name for c in "\r\n") for name in value["names"])
            and str(root / "signing.keychain-db") not in value["names"], "invalid original keychain context")
    environment = runner_native_environment(root)
    subprocess.run(["security", "list-keychains", "-d", "user", "-s", *value["names"]],
                   check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=environment)
    listed = subprocess.run(["security", "list-keychains", "-d", "user"], check=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=environment)
    require(shlex.split(listed.stdout.decode()) == value["names"], "keychain context restoration unverified")
    return value["names"]


def cleanup_errno(error):
    code = getattr(error, "errno", None)
    for name in ("EACCES", "EPERM", "EBUSY", "ETXTBSY", "ENOTEMPTY", "EEXIST", "ENOENT", "EROFS"):
        if code == getattr(errno, name):
            return name
    return "UNKNOWN"


def cleanup_delivery(runner_temp):
    """Only owned delivery resources; independent fixed results, never raw output."""
    stages = {name: {"status": "NOT_RUN", "category": "DEPENDENCY_FAILED"} for name in (
        "C01_OWNERSHIP", "C02_PROFILE", "C03_KEYCHAIN", "C04_WORKSPACE", "C05_ABSENCE")}
    resources = dict.fromkeys(("workspace", "profile", "keychain"), "UNVERIFIED")
    raw = []
    root_identity = None
    workspace_details = {"error_code": "NONE", "retry_status": "NOT_ATTEMPTED", "retry_error_code": "NONE"}
    stages["C04_WORKSPACE"].update(workspace_details)
    def record(name, success, category):
        stages[name] = {"status": "PASS" if success else "FAIL", "category": category}
        if name == "C04_WORKSPACE":
            stages[name].update(workspace_details)
    def absent(path):
        # lstat distinguishes absence from unreadability and dangling symlinks.
        try:
            path.lstat()
        except FileNotFoundError:
            return True
        return False
    def owned():
        require(root.is_dir() and not root.is_symlink(), "unowned workspace")
        marker = root / ".owned"
        require(marker.is_file() and not marker.is_symlink()
                and marker.read_text() == cert.PRIVATE_MARKER, "unowned workspace")
        current = root.stat()
        require(root_identity is None or (current.st_dev, current.st_ino) == root_identity,
                "workspace identity changed")
        if hasattr(os, "getuid"):
            require(current.st_uid == os.getuid(), "workspace owner changed")
    def private_details(name="cleanup-private.log"):
        # Exclusive creation prevents following an existing log leaf. No public IO.
        try:
            owned()
            logs = root / "logs"
            if logs.is_dir() and not logs.is_symlink():
                with (logs / name).open("xb") as target:
                    target.write(b"\n".join(raw))
        except Exception:
            pass  # Private logging cannot bypass removal or certify cleanup.
    try:
        root = cert.private_directory(runner_temp)
        owned()
        initial = root.stat()
        root_identity = (initial.st_dev, initial.st_ino)
        require(Path.home() == root / "home", "private delivery home required")
        has_runner_context = (root / "runner-context.json").exists() or (root / "runner-context.json").is_symlink()
        require(has_runner_context or not any((root / name).exists() for name in
                ("runner-context.sh", "keychain-search-list.json", "profile-ownership.json")), "runner context missing")
        profile = (runner_profile(root) if has_runner_context else
                   Path.home() / "Library/MobileDevice/Provisioning Profiles" / (cert.release.PROFILE_UUID + ".mobileprovision"))
        native_environment = runner_native_environment(root) if has_runner_context else None
        keychain = root / "signing.keychain-db"
        # Never traverse symlinked profile ancestors or remove an unowned target.
        for parent in (profile.parent, *profile.parents):
            if parent == root:
                break
            require(not parent.is_symlink(), "unsafe profile parent")
        record("C01_OWNERSHIP", True, "OWNERSHIP_VERIFIED")
    except Exception as error:
        raw.append(str(error).encode())
        record("C01_OWNERSHIP", False, "OWNERSHIP_UNVERIFIED")
        record("C05_ABSENCE", False, "ABSENCE_UNVERIFIED")
        return {"status": "FAIL", "stages": stages, "resources": resources}
    profile_category = "OWNERSHIP_UNVERIFIED"
    try:
        marker = root / "installed-profile"
        if not absent(marker):
            require(marker.is_file() and not marker.is_symlink(), "unsafe profile marker")
            require(Path(marker.read_text()) == profile and not profile.is_symlink(), "wrong installed profile")
            if has_runner_context:
                verify_runner_profile_ownership(root, profile)
            profile_category = "REMOVAL_FAILED"
            profile.unlink(missing_ok=True)
        profile_category = "ABSENCE_UNVERIFIED"
        require(absent(profile), "profile remains or lacks installation ownership")
        record("C02_PROFILE", True, "ABSENCE_VERIFIED")
    except Exception as error:
        raw.append(str(error).encode())
        record("C02_PROFILE", False, profile_category)
    native_absent = False
    delete_failed = False
    keychain_category = "OWNERSHIP_UNVERIFIED"
    restoration_failed = False
    expected_search_list = None
    if has_runner_context:
        try:
            expected_search_list = restore_keychain_context(root)
        except Exception as error:
            restoration_failed = True
            raw.append(str(error).encode())
    try:
        require(not keychain.is_symlink(), "unsafe keychain")
        if not absent(keychain):
            keychain_category = "REMOVAL_FAILED"
            deleted = subprocess.run(["security", "delete-keychain", str(keychain)],
                                     check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=native_environment)
            raw.extend((deleted.stdout, deleted.stderr))
            delete_failed = deleted.returncode != 0
        # Query while the private HOME still exists. Tree removal must not erase
        # the ability to distinguish a native keychain registration from a file.
        keychain_category = "REMOVAL_FAILED_ABSENCE_UNVERIFIED" if delete_failed else "ABSENCE_UNVERIFIED"
        listed = subprocess.run(["security", "list-keychains", "-d", "user"],
                                check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=native_environment)
        raw.extend((listed.stdout, listed.stderr))
        require(listed.returncode == 0, "native absence unverified")
        names = shlex.split(listed.stdout.decode())
        require(all(Path(name).is_absolute() for name in names), "invalid native listing")
        require(not restoration_failed and (expected_search_list is None or names == expected_search_list),
                "keychain context restoration unverified")
        native_absent = str(keychain) not in names
        keychain_category = "RESOURCE_REMAINS"
        require(native_absent and absent(keychain), "keychain remains")
        record("C03_KEYCHAIN", not delete_failed,
               "OPERATION_FAILED_BUT_ABSENT" if delete_failed else "ABSENCE_VERIFIED")
    except Exception as error:
        raw.append(str(error).encode())
        record("C03_KEYCHAIN", False, keychain_category)
    private_details()
    workspace_category = "OWNERSHIP_UNVERIFIED"
    try:
        owned()  # Recheck immediately before the sole recursive deletion.
        workspace_category = "REMOVAL_FAILED"
        shutil.rmtree(root)
        workspace_category = "ABSENCE_UNVERIFIED"
        workspace_details["retry_status"] = "NOT_NEEDED"
        record("C04_WORKSPACE", absent(root), "ABSENCE_VERIFIED" if absent(root) else "RESOURCE_REMAINS")
    except Exception as error:
        raw.append(str(error).encode())
        workspace_details["error_code"] = cleanup_errno(error)
        # At most ONE retry, only for transient busy/nonempty errors. Never chmod,
        # clear immutable flags, kill processes, follow links or expand the root.
        if workspace_category == "REMOVAL_FAILED" and workspace_details["error_code"] in {"EBUSY", "ENOTEMPTY"}:
            try:
                owned()  # Same inode/owner/marker immediately before another deletion.
                workspace_details["retry_status"] = "ATTEMPTED"
                time.sleep(0.25)
                owned()
                shutil.rmtree(root)
                workspace_details["retry_status"] = "SUCCEEDED"
            except Exception as retry_error:
                raw.append(str(retry_error).encode())
                workspace_details["retry_error_code"] = cleanup_errno(retry_error)
                workspace_details["retry_status"] = ("BLOCKED_OWNERSHIP" if
                    workspace_details["retry_status"] != "ATTEMPTED" else "FAILED")
        private_details("cleanup-removal-private.log")
        # The first operation failure stays FAIL even if the retry removed all files.
        record("C04_WORKSPACE", False, workspace_category)
    # Final filesystem checks run independently, even after earlier exceptions.
    for name, path in (("workspace", root), ("profile", profile), ("keychain", keychain)):
        try:
            resources[name] = "ABSENT" if absent(path) else "PRESENT"
        except Exception as error:
            raw.append(str(error).encode())
        if name == "keychain" and not native_absent:
            resources[name] = "UNVERIFIED" if resources[name] == "ABSENT" else resources[name]
    all_absent = all(value == "ABSENT" for value in resources.values())
    prior_ok = all(value["status"] == "PASS" for name, value in stages.items() if name != "C05_ABSENCE")
    category = ("ABSENCE_VERIFIED" if prior_ok else "ABSENT_WITH_PRIOR_FAILURE") if all_absent else (
        "ABSENCE_UNVERIFIED" if "UNVERIFIED" in resources.values() else "RESOURCE_REMAINS")
    record("C05_ABSENCE", all_absent, category)
    return {"status": "PASS" if all_absent and prior_ok else "FAIL",
            "stages": stages, "resources": resources}


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
    # Fixed schema only; no raw exception or resource path may cross this boundary.
    cleanup = cleanup_delivery(runner_temp)
    result["cleanup"] = cleanup["status"]
    result["cleanup_stages"] = cleanup["stages"]
    result["resource_absence"] = cleanup["resources"]
    if result["cleanup"] != "PASS":
        result["certification"] = "FAIL"
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["private-init", "authorize", "preflight", "transfer", "finish-public", "archive-public", "signing-context", "profile-install"])
    for name in ("runner-temp", "github-env", "ref", "commit", "event", "attempt", "output", "ipa", "job-status", "archive-exit"):
        parser.add_argument("--" + name)
    args = parser.parse_args()
    if args.mode == "private-init":
        cert.prepare_private(args.runner_temp, args.github_env)
        root = cert.private_directory(args.runner_temp)
        (root / "home").mkdir(mode=0o700)
        try:
            capture_runner_context(root)
        except Exception:
            print('{"private_workspace":"FAILED"}')
            raise SystemExit(1) from None
        with Path(args.github_env).open("a") as destination:
            for key, value in {"HOME": root / "home", "CFFIXED_USER_HOME": root / "home",
                               "XDG_CACHE_HOME": root / "home/.cache", "npm_config_cache": root / "home/.npm",
                               "TMPDIR": root / "tmp",
                               "JAVA_TOOL_OPTIONS": '-Duser.home="' + str(root / "home") + '" -Djava.io.tmpdir="' + str(root / "tmp") + '"'}.items():
                destination.write(key + "=" + str(value) + "\n")
        print('{"private_workspace":"PREPARED"}')
        return
    if args.mode in {"signing-context", "profile-install"}:
        require(os.environ.get("RUNNER_OS") == "macOS" and os.environ.get("GITHUB_ACTIONS") == "true", "authorized macOS only")
        root = cert.private_directory(args.runner_temp)
        require(str(root) == os.environ.get("DIAGNOSTIC_PRIVATE_ROOT"), "owned private root required")
        if args.mode == "signing-context":
            prepare_signing_context(root, args.commit)
        else:
            install_runner_profile(root, args.commit)
        return
    if args.mode == "finish-public":
        result = finish(args.runner_temp, args.job_status)
        print(json.dumps(result, sort_keys=True))
        raise SystemExit(0 if result["certification"] == result["cleanup"] == "PASS" else 1)
    if args.mode == "archive-public":
        emit_archive(archive_report(args.runner_temp, int(args.archive_exit)))
        return
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
        transfer_public(root, args.commit, Path(args.ipa))
        return
    require(args.output and Path(args.output).resolve().is_relative_to(root.resolve()), "private report required")
    write_json(args.output, result)


if __name__ == "__main__":
    main()
