"""Signing-only macOS diagnostic. No application build, export, Apple API or upload.
Local tests use synthetic files and injected commands; never load real credentials.
"""
import argparse
import contextlib
import io
import json
import os
import re
import shlex
import shutil
import signal
import subprocess
from pathlib import Path

import apple_native_parity as release

BASE = "4c95caed0d261fca1dbaf86fc926660661d0643b"
PREFIX = "refs/tags/gridly-storekit-signing-diagnostic-15-"
FILES = {
    ".github/workflows/gridly-storekit-signing-diagnostic.yml",
    "tools/apple_storekit_signing_diagnostic.py",
    "tests/storekit-signing-diagnostic.test.py",
}
REPOSITORY = "DBMaps/liberty-county-map"
DIAGNOSTIC_BRANCH = "refs/remotes/origin/codex/storekit-diagnostics"
CHAIN = (
    (BASE, "13e73183cf3f257fbc9acd9a32d34d62b70ffb1e"),
    ("13e73183cf3f257fbc9acd9a32d34d62b70ffb1e", "45bfe026b81f4928caceb9632cbf15e7ed842a25"),
    ("45bfe026b81f4928caceb9632cbf15e7ed842a25", "bd5b1feac696ba7db0e7d8d271b054df1d25850b"),
    ("bd5b1feac696ba7db0e7d8d271b054df1d25850b", "f9fc818321970b8b7e29df17358daf87a7d20308"),
)
HISTORY = {
    "gridly-storekit-diagnostic-certify-15-f9fc818321970b8b7e29df17358daf87a7d20308":
        ("bb496cafcbeaf7d6aaf6574e6b5561ac242599fc", "f9fc818321970b8b7e29df17358daf87a7d20308"),
    "gridly-storekit-testflight-deliver-15-45bfe026b81f4928caceb9632cbf15e7ed842a25":
        ("15a2d8093f31ccaea515b715e604c803d89af469", "45bfe026b81f4928caceb9632cbf15e7ed842a25"),
    "gridly-storekit-preflight-15-13e73183cf3f257fbc9acd9a32d34d62b70ffb1e":
        ("41b9592697daf7898b66dd582b6da3af5dc8412d", "13e73183cf3f257fbc9acd9a32d34d62b70ffb1e"),
    "gridly-storekit-testflight-deliver-15-" + BASE:
        ("e6425dadac56501e8b389efecd5c50d95501d823", BASE),
}
MARKER = "gridly-signing-only-v1"
INPUTS = ("APPLE_DIST_PRIVATE_KEY_PEM_BASE64", "APPLE_DIST_CERT_PEM_BASE64",
          "APPLE_PROVISION_PROFILE_BASE64")
AUTH_FIELDS = {
    "signing_diagnostic_commit", "delivery_source_commit", "failed_delivery_run_id",
    "historical_certification_run_id", "signing_only_authorized",
    "signing_credentials_access_authorized", "private_home_reproduction_authorized",
    "no_application_build_or_upload_confirmed",
}
CONFIRMATIONS = {
    "signing_only_authorized", "signing_credentials_access_authorized",
    "private_home_reproduction_authorized", "no_application_build_or_upload_confirmed",
}
SIGN_STAGES = tuple("S%02d" % n for n in range(1, 15))
HOME_STAGES = ("H01_HOME", "H02_CFFIXED_USER_HOME", "H03_HOME_AGREEMENT")
CLEAN_STAGES = tuple("C%02d" % n for n in range(1, 6))
STAGES = {"A01_AUTHORIZATION", "A02_WORKSPACE", *SIGN_STAGES, *HOME_STAGES, *CLEAN_STAGES}
PASS_CATEGORIES = {"NONE", "NOT_CREATED", "ABSENT_VERIFIED"}
FAIL_CATEGORIES = {
    "DEPENDENCY_FAILED", "COMMAND_FAILED", "INPUTS_MISSING", "ENVIRONMENT_MISMATCH",
    "INTERNAL_FAILURE", "AUTHORIZATION_REJECTED", "WORKSPACE_REJECTED",
    "OWNERSHIP_BLOCKED", "REMOVAL_FAILED", "VERIFICATION_FAILED",
    "VERIFICATION_FAILED_ABSENT",
}
SIGN_FAILURES = {
    "S01": {"INPUTS_MISSING"},
    "S02": {"PRIVATE_KEY_DECODE_FAILED", "CERTIFICATE_DECODE_FAILED", "PROFILE_INPUT_DECODE_FAILED"},
    "S03": {"KEY_PUBLIC_DERIVATION_FAILED", "CERT_PUBLIC_DERIVATION_FAILED", "KEY_CERTIFICATE_MISMATCH"},
    "S04": {"OPENSSL_VERSION_FAILED", "P12_PASSWORD_FAILED", "PKCS12_EXPORT_FAILED"},
    "S05": {"PKCS12_PARSE_FAILED"},
    "S06": {"KEYCHAIN_PASSWORD_FAILED", "PREEXISTING_KEYCHAIN", "KEYCHAIN_OWNERSHIP_MARKER_FAILED", "KEYCHAIN_CREATE_FAILED"},
    "S07": {"KEYCHAIN_UNLOCK_FAILED"},
    "S08": {"CERTIFICATE_IMPORT_FAILED"},
    "S09": {"KEY_PARTITION_FAILED"},
    "S10": {"SEARCH_LIST_FAILED"},
    "S11": {"PROFILE_DECODE_FAILED"},
    "S12": {"PROFILE_NAME_READ_FAILED", "PROFILE_UUID_READ_FAILED", "TEAM_READ_FAILED", "APP_ID_READ_FAILED",
            "APPLICATION_ID_MISMATCH", "PROFILE_NAME_MISMATCH", "TEAM_MISMATCH", "PROFILE_UUID_VALIDATION_FAILED"},
    "S13": {"PROFILE_DIRECTORY_FAILED", "PREEXISTING_PROFILE", "PROFILE_OWNERSHIP_MARKER_FAILED",
            "PROFILE_INSTALL_FAILED", "PROFILE_TEMP_REMOVAL_FAILED"},
    "S14": {"SIGNING_IDENTITY_UNAVAILABLE"},
}
FAIL_CATEGORIES |= set().union(*SIGN_FAILURES.values())

TEMP_FILES = (
    "distribution-private.key", "distribution-cert.pem", "distribution.p12",
    "distribution.mobileprovision", "profile.plist",
)


def require(value):
    if not value:
        raise ValueError("diagnostic contract rejected")


def unique_json_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value)
        value[key] = item
    return value


def git(*args):
    return subprocess.check_output(["git", *args], stderr=subprocess.DEVNULL)


def record(stage, passed, category="NONE"):
    require(stage in STAGES and type(passed) is bool)
    require(category in (PASS_CATEGORIES if passed else FAIL_CATEGORIES))
    if stage in SIGN_STAGES:
        require(category == "NONE" if passed else category in
                {"DEPENDENCY_FAILED", "COMMAND_FAILED", "INTERNAL_FAILURE"} | SIGN_FAILURES[stage])
    elif stage in HOME_STAGES:
        require(category == "NONE" if passed else category in {"ENVIRONMENT_MISMATCH", "INTERNAL_FAILURE"})
    elif stage.startswith("A"):
        require(category == "NONE" if passed else category in {
            "AUTHORIZATION_REJECTED", "WORKSPACE_REJECTED", "DEPENDENCY_FAILED", "INTERNAL_FAILURE"})
    else:
        require(category in PASS_CATEGORIES if passed else category in {
            "OWNERSHIP_BLOCKED", "REMOVAL_FAILED", "VERIFICATION_FAILED", "VERIFICATION_FAILED_ABSENT"})
    return {"stage": stage, "status": "PASS" if passed else "FAIL", "category": category}


def emit(records, stream=None):
    # Validate the entire batch before publishing a single byte.
    checked = []
    for value in records:
        require(isinstance(value, dict) and set(value) == {"stage", "status", "category"})
        require(value["status"] in {"PASS", "FAIL"})
        fixed = record(value["stage"], value["status"] == "PASS", value["category"])
        require(fixed == value)
        checked.append(fixed)
    require(len({v["stage"] for v in checked}) == len(checked))
    output = stream if stream is not None else __import__("sys").stdout
    output.write("".join(json.dumps(v, sort_keys=True) + "\n" for v in checked))
    output.flush()


def source_guard(commit):
    require(isinstance(commit, str) and re.fullmatch(r"[0-9a-f]{40}", commit) and commit != BASE)
    require(git("rev-parse", "HEAD").decode().strip() == commit)
    require(git("show", "-s", "--format=%P", commit).decode().strip() == BASE)
    for child, parent in CHAIN:
        require(git("show", "-s", "--format=%P", child).decode().strip() == parent)
    rows = git("diff", "--name-status", "--no-renames", BASE, commit).decode().splitlines()
    require(len(rows) == 3 and set(rows) == {"A\t" + p for p in FILES})
    for path in FILES:
        require(git("ls-tree", commit, "--", path).decode().split()[0] == "100644")
    for name, (obj, target) in HISTORY.items():
        ref = "refs/tags/" + name
        require(git("rev-parse", "--verify", ref).decode().strip() == obj)
        require(git("cat-file", "-t", ref).decode().strip() == "tag")
        require(git("rev-parse", "--verify", ref + "^{}").decode().strip() == target)
    require(not git("status", "--porcelain=v1", "--untracked-files=normal"))


def authorization(value, commit):
    require(isinstance(value, dict) and set(value) == AUTH_FIELDS)
    require(value["signing_diagnostic_commit"] == commit)
    require(value["delivery_source_commit"] == BASE)
    require(type(value["failed_delivery_run_id"]) is int and value["failed_delivery_run_id"] == 39196269782)
    require(type(value["historical_certification_run_id"]) is int and value["historical_certification_run_id"] == 39181592021)
    require(all(value[k] is True for k in CONFIRMATIONS))
    return value


def authorize(environment):
    commit, ref = environment["GITHUB_SHA"], environment["GITHUB_REF"]
    require(environment.get("GITHUB_RUN_ATTEMPT") == "1")
    require(ref == PREFIX + commit and environment.get("GITHUB_REF_NAME") == ref.removeprefix("refs/tags/"))
    source_guard(commit)
    require(git("rev-parse", "--verify", DIAGNOSTIC_BRANCH).decode().strip() == commit)
    require(git("cat-file", "-t", ref).decode().strip() == "tag")
    obj = git("rev-parse", "--verify", ref).decode().strip()
    header, sep, annotation = git("cat-file", "-p", ref).decode().partition("\n\n")
    require(sep and header.splitlines()[:3] == ["object " + commit, "type commit", "tag " + ref.removeprefix("refs/tags/")])
    event = json.loads(Path(environment["GITHUB_EVENT_PATH"]).read_text(),
                       object_pairs_hook=unique_json_object)
    require(event.get("repository", {}).get("full_name") == REPOSITORY)
    require(environment.get("GITHUB_EVENT_NAME") == "push")
    require(event.get("created") is True and event.get("deleted") is False and event.get("forced") is False)
    require(event.get("ref") == ref and event.get("after") in {obj, commit})
    value = json.loads(annotation, object_pairs_hook=unique_json_object)
    authorization(value, commit)
    return {"source_commit": commit, "run_id": environment["GITHUB_RUN_ID"], "ref": ref, "authorization": value}


def workspace(runner_temp, run_id):
    require(re.fullmatch(r"[1-9][0-9]{0,19}", str(run_id)))
    parent = Path(runner_temp).resolve(strict=True)
    require(parent.is_dir() and parent != Path(parent.anchor))
    root = parent / ("gridly-signing-diagnostic-" + str(run_id))
    require(not root.is_symlink() and root.resolve().parent == parent)
    return root


def owned(root, context, complete=True):
    marker = root / ".owned"
    require(root.name == "gridly-signing-diagnostic-" + context["run_id"])
    require(re.fullmatch(r"[0-9a-f]{40}", context["source_commit"]))
    require(root.is_dir() and not root.is_symlink())
    require(marker.is_file() and not marker.is_symlink())
    require(json.loads(marker.read_text(), object_pairs_hook=unique_json_object) == {
        "marker": MARKER, "run_id": context["run_id"], "source_commit": context["source_commit"]})
    require(not (root / "home").is_symlink() and not (root / "source").is_symlink())
    for name in ("logs", "reports", "tmp"):
        require(not (root / name).is_symlink())
        require((root / name).is_dir() if complete else not (root / name).exists() or (root / name).is_dir())


def child_environment(root, environment):
    # Scope native HOME overrides to this diagnostic's subprocesses. GitHub never
    # receives path-valued GITHUB_ENV exports, and no runner-HOME fallback exists.
    result = dict(environment)
    result.update(HOME=str(root / "home"), CFFIXED_USER_HOME=str(root / "home"),
                  TMPDIR=str(root / "tmp") + os.sep, DIAGNOSTIC_PRIVATE_ROOT=str(root),
                  DELIVERY_SOURCE_DIR=str(root / "source"))
    return result


def home_records(root, environment):
    expected = str(root / "home")
    home_exists = (root / "home").is_dir() and not (root / "home").is_symlink()
    values = (environment.get("HOME") == expected and home_exists,
              environment.get("CFFIXED_USER_HOME") == expected,
              environment.get("HOME") == environment.get("CFFIXED_USER_HOME") == expected and home_exists)
    return [record(stage, value, "NONE" if value else "ENVIRONMENT_MISMATCH")
            for stage, value in zip(HOME_STAGES, values)]


def captured(args, *, input=None, timeout=90, **options):
    # Kill only this diagnostic's newly created process group on a timeout.
    require(options.pop("capture_output") is True and options.pop("close_fds") is True)
    require(options.pop("check") is False)
    process = subprocess.Popen(args, stdin=subprocess.PIPE if input is not None else subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               close_fds=True, start_new_session=True, **options)
    try:
        stdout, stderr = process.communicate(input=input, timeout=timeout)
    except BaseException:
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGKILL)
        process.communicate()
        raise
    return subprocess.CompletedProcess(args, process.returncode, stdout, stderr)


def command(root, label, args, environment, *, execute=captured, input=None, timeout=90):
    result = execute(args, input=input, capture_output=True, close_fds=True,
                     env=environment, cwd=root / "source", timeout=timeout, check=False)
    with (root / "logs" / (label + ".log")).open("ab") as log:
        log.write(result.stdout or b"")
        log.write(result.stderr or b"")
    return result


def prepare(root, context, environment, execute=captured):
    require(not root.exists())
    root.mkdir(mode=0o700)
    (root / ".owned").write_text(json.dumps({
        "marker": MARKER, "run_id": context["run_id"], "source_commit": context["source_commit"]}))
    for name in ("home", "logs", "reports", "tmp", "source"):
        (root / name).mkdir(mode=0o700)
    (root / "reports/context.json").write_text(json.dumps(context))
    env = child_environment(root, environment)
    for key in INPUTS:
        env.pop(key, None)
    result = command(root, "source-clone", [
        "git", "clone", "--no-hardlinks", "--branch", context["ref"].removeprefix("refs/tags/"),
        environment["GITHUB_WORKSPACE"], str(root / "source")], env, execute=execute, timeout=180)
    require(result.returncode == 0)
    result = command(root, "source-sha", ["git", "rev-parse", "HEAD"], env, execute=execute)
    require(result.returncode == 0 and result.stdout.decode().strip() == context["source_commit"])


def signing_script():
    # Use the pinned, unmodified delivery signing operations, rather than a
    # second implementation of certificate/keychain/provisioning behavior.
    text = Path(__file__).resolve().parents[1].joinpath(
        ".github/workflows/gridly-storekit-testflight-delivery.yml").read_text()
    start = text.index("      - name: Install distribution signing\n")
    end = text.index("      - name: Archive and export", start)
    body = text[start:end].split("        run: |\n", 1)[1]
    body = "\n".join(line[10:] for line in body.splitlines()) + "\n"
    body = body.replace('exec > "$DIAGNOSTIC_PRIVATE_ROOT/logs/step-6.log" 2>&1\n', "")
    body = body.replace("trap cleanup_signing_material EXIT", "trap signing_exit EXIT")
    # No application step needs these metadata exports in a signing-only run.
    body = body.replace('{ printf \'PROFILE_NAME=%s\\n\' "$PROFILE_NAME"; printf \'TEAM_ID=%s\\n\' "$TEAM_ID"; } >> "$GITHUB_ENV"\n', "")
    # Bash errexit ignores a failed nonfinal test in an AND-list. Preserve the
    # original checks, but explicitly propagate their outcome to this stage.
    for line in (
        'test -n "$APPLE_DIST_PRIVATE_KEY_PEM_BASE64" && test -n "$APPLE_DIST_CERT_PEM_BASE64" && test -n "$APPLE_PROVISION_PROFILE_BASE64"',
        'test -n "$KEY_PUBLIC_SHA" && test "$KEY_PUBLIC_SHA" = "$CERT_PUBLIC_SHA"',
    ):
        require(body.count(line) == 1)
        body = body.replace(line, line + " || exit 1")
    anchors = (
        ('test -n "$APPLE_DIST_PRIVATE_KEY_PEM_BASE64"', "S01"),
        ('printf \'%s\' "$APPLE_DIST_PRIVATE_KEY_PEM_BASE64" | base64', "S02"),
        ("KEY_PUBLIC_SHA=$(", "S03"), ("openssl version\n", "S04"),
        ('openssl pkcs12 -legacy -in "$DIAGNOSTIC_PRIVATE_ROOT/distribution.p12"', "S05"),
        ('KEYCHAIN_PASSWORD="$(', "S06"), ("security unlock-keychain ", "S07"),
        ("security import ", "S08"), ("security set-key-partition-list ", "S09"),
        ("security list-keychains ", "S10"), ("security cms ", "S11"),
        ("PROFILE_NAME=$(", "S12"), ('mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles"', "S13"),
    )
    for needle, stage in anchors:
        require(body.count(needle) == 1)
        body = body.replace(needle, 'next_stage ' + stage + '\n' + needle, 1)
    temporary_remove = 'rm -f "$DIAGNOSTIC_PRIVATE_ROOT/distribution-private.key" "$DIAGNOSTIC_PRIVATE_ROOT/distribution-cert.pem" "$DIAGNOSTIC_PRIVATE_ROOT/distribution.p12"\n'
    require(body.count(temporary_remove) == 1)
    body = body.replace(temporary_remove, temporary_remove + '  trap_remove_rc=$?\n')
    create = 'security create-keychain -p "$KEYCHAIN_PASSWORD" "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db"'
    require(body.count(create) == 1)
    body = body.replace(create, 'test ! -e "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db"\n'
                        'printf attempted > "$DIAGNOSTIC_PRIVATE_ROOT/keychain-attempted"\n' + create)
    operations = (
        ('test -n "$APPLE_DIST_PRIVATE_KEY_PEM_BASE64"', "INPUTS_MISSING"),
        ('printf \'%s\' "$APPLE_DIST_PRIVATE_KEY_PEM_BASE64" | base64', "PRIVATE_KEY_DECODE_FAILED"),
        ('printf \'%s\' "$APPLE_DIST_CERT_PEM_BASE64" | base64', "CERTIFICATE_DECODE_FAILED"),
        ('printf \'%s\' "$APPLE_PROVISION_PROFILE_BASE64" | base64', "PROFILE_INPUT_DECODE_FAILED"),
        ("KEY_PUBLIC_SHA=$(", "KEY_PUBLIC_DERIVATION_FAILED"),
        ("CERT_PUBLIC_SHA=$(", "CERT_PUBLIC_DERIVATION_FAILED"),
        ('test -n "$KEY_PUBLIC_SHA"', "KEY_CERTIFICATE_MISMATCH"),
        ("openssl version\n", "OPENSSL_VERSION_FAILED"),
        ('TEMP_P12_PASSWORD="$(', "P12_PASSWORD_FAILED"),
        ("openssl pkcs12 -export -legacy ", "PKCS12_EXPORT_FAILED"),
        ("openssl pkcs12 -legacy -in ", "PKCS12_PARSE_FAILED"),
        ('KEYCHAIN_PASSWORD="$(', "KEYCHAIN_PASSWORD_FAILED"),
        ('test ! -e "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db"', "PREEXISTING_KEYCHAIN"),
        ('printf attempted > "$DIAGNOSTIC_PRIVATE_ROOT/keychain-attempted"', "KEYCHAIN_OWNERSHIP_MARKER_FAILED"),
        ("security create-keychain ", "KEYCHAIN_CREATE_FAILED"),
        ("security unlock-keychain ", "KEYCHAIN_UNLOCK_FAILED"),
        ("security import ", "CERTIFICATE_IMPORT_FAILED"),
        ("security set-key-partition-list ", "KEY_PARTITION_FAILED"),
        ("security list-keychains ", "SEARCH_LIST_FAILED"),
        ("security cms ", "PROFILE_DECODE_FAILED"),
        ("PROFILE_NAME=$(", "PROFILE_NAME_READ_FAILED"),
        ("PROFILE_UUID=$(", "PROFILE_UUID_READ_FAILED"),
        ("TEAM_ID=$(", "TEAM_READ_FAILED"),
        ("APP_ID=$(", "APP_ID_READ_FAILED"),
        ('test "$APP_ID" = ', "APPLICATION_ID_MISMATCH"),
        ('test "$PROFILE_NAME" = ', "PROFILE_NAME_MISMATCH"),
        ('test "$TEAM_ID" = ', "TEAM_MISMATCH"),
        ('test "$PROFILE_UUID" = ', "PROFILE_UUID_VALIDATION_FAILED"),
        ('mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles"', "PROFILE_DIRECTORY_FAILED"),
        ('test ! -e "$profile_path"', "PREEXISTING_PROFILE"),
        ('printf \'%s\' "$profile_path" > ', "PROFILE_OWNERSHIP_MARKER_FAILED"),
        ('cp "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision"', "PROFILE_INSTALL_FAILED"),
        ('rm -f "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision"', "PROFILE_TEMP_REMOVAL_FAILED"),
    )
    for needle, category in operations:
        require(body.count(needle) == 1)
        body = body.replace(needle, "set_operation " + category + "\n" + needle, 1)
    header = r'''set -euo pipefail
set +x
umask 077
current=""
category=COMMAND_FAILED
status_file="$DIAGNOSTIC_PRIVATE_ROOT/reports/signing-status.jsonl"
passed() {
  printf '{"stage":"%s","status":"PASS","category":"NONE"}\n' "$1" >> "$status_file"
}
set_operation() {
  category="$1"
  printf '%s\n' "$category" > "$DIAGNOSTIC_PRIVATE_ROOT/reports/current-operation"
}
next_stage() {
  if test -n "$current"; then passed "$current"; fi
  current="$1"
  category=COMMAND_FAILED
  printf '%s\n' "$current" > "$DIAGNOSTIC_PRIVATE_ROOT/reports/current-stage"
}
signing_exit() {
  rc=$?
  failed_category="$category"
  trap - EXIT
  set +e
  cleanup_signing_material
  cleanup_rc=${trap_remove_rc:-1}
  printf '%s\n' "$cleanup_rc" > "$DIAGNOSTIC_PRIVATE_ROOT/reports/temporary-trap-exit"
  if test "$rc" -ne 0 && test -n "$current"; then
    printf '{"stage":"%s","status":"FAIL","category":"%s"}\n' "$current" "$failed_category" >> "$status_file"
  fi
  exit "$rc"
}
'''
    identity = ('security find-identity -v -p codesigning "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db"'
                ' | grep -Fq \'' + release.CERT_SHA1 + ' "' + release.AUTHORITY + '"\'\n')
    return header + body + "next_stage S14\nset_operation SIGNING_IDENTITY_UNAVAILABLE\n" + identity + 'passed "$current"\ncurrent=""\n'


def run_signing(root, context, environment, execute=captured):
    owned(root, context)
    env = child_environment(root, environment)
    homes = home_records(root, env)
    if any(v["status"] != "PASS" for v in homes):
        return homes + [record(s, False, "DEPENDENCY_FAILED") for s in SIGN_STAGES]
    # Exclusive attempt marker is written before credential access/native commands.
    with (root / "signing-attempted").open("x") as marker:
        marker.write("one authorized signing sequence")
    try:
        result = command(root, "signing-private", ["/bin/bash", "--noprofile", "--norc", "-e", "-o", "pipefail"],
                         env, execute=execute, input=signing_script().encode(), timeout=300)
    except Exception:
        result = subprocess.CompletedProcess([], 1, b"", b"")
    records = []
    path = root / "reports/signing-status.jsonl"
    if path.exists():
        require(not path.is_symlink())
        records = [json.loads(line, object_pairs_hook=unique_json_object)
                   for line in path.read_text().splitlines()]
    sink = io.StringIO()
    emit(records, sink)
    require([v["stage"] for v in records] == list(SIGN_STAGES[:len(records)]))
    failed = [v for v in records if v["status"] == "FAIL"]
    require(len(failed) <= 1 and (not failed or records[-1] == failed[0]))
    if result.returncode == 0:
        require(len(records) == 14 and not failed)
    elif not failed:
        current = root / "reports/current-stage"
        pending = current.read_text().strip() if current.is_file() and not current.is_symlink() else ""
        if len(records) < 14 and pending == SIGN_STAGES[len(records)]:
            operation = root / "reports/current-operation"
            category = operation.read_text().strip() if operation.is_file() and not operation.is_symlink() else "COMMAND_FAILED"
            require(category in SIGN_FAILURES[pending] | {"COMMAND_FAILED"})
            records.append(record(pending, False, category))
        # Unexpected shell/trap failure cannot be represented as successful signing.
        elif records:
            records[-1] = record(records[-1]["stage"], False, "INTERNAL_FAILURE")
        else:
            records = [record("S01", False, "INTERNAL_FAILURE")]
    records += [record(s, False, "DEPENDENCY_FAILED") for s in SIGN_STAGES[len(records):]]
    return homes + records


def cleanup(root, context, environment, execute=captured):
    if not root.exists() and not root.is_symlink():
        # A vanished directory alone does not prove native keychain deregistration.
        # Only GitHub's skipped signing-step outcome proves no signing ran.
        if environment.get("SIGNING_STEP_OUTCOME") == "skipped":
            return [record(s, True, "NOT_CREATED" if s in {"C01", "C02", "C03"} else "ABSENT_VERIFIED")
                    for s in CLEAN_STAGES]
        return [record(s, False, "VERIFICATION_FAILED_ABSENT") if s in {"C02", "C05"}
                else record(s, True, "ABSENT_VERIFIED") for s in CLEAN_STAGES]
    try:
        owned(root, context, complete=False)
    except Exception:
        return [record(s, False, "OWNERSHIP_BLOCKED") for s in CLEAN_STAGES]
    env = child_environment(root, {k: v for k, v in environment.items() if k not in INPUTS})
    results = []
    block_tree = False
    profile = root / "home/Library/MobileDevice/Provisioning Profiles" / (release.PROFILE_UUID + ".mobileprovision")
    keychain = root / "signing.keychain-db"
    marker = root / "installed-profile"
    try:
        require(profile.resolve().is_relative_to(root.resolve()))
        require(all(not p.is_symlink() for p in profile.parents if p.is_relative_to(root)))
        if marker.exists() or marker.is_symlink():
            require(not marker.is_symlink() and marker.read_text() == str(profile) and not profile.is_symlink())
            profile.unlink(missing_ok=True)
            require(not profile.exists())
            results.append(record("C01", True))
        else:
            require(not profile.exists() and not profile.is_symlink())
            results.append(record("C01", True, "NOT_CREATED"))
    except ValueError:
        block_tree = True
        results.append(record("C01", False, "OWNERSHIP_BLOCKED"))
    except Exception:
        results.append(record("C01", False, "REMOVAL_FAILED" if profile.exists() else "VERIFICATION_FAILED_ABSENT"))
    native_verified = False
    try:
        attempted = root / "keychain-attempted"
        require(not attempted.is_symlink() and not keychain.is_symlink())
        if not attempted.exists():
            require(not keychain.exists())
            results.append(record("C02", True, "NOT_CREATED"))
            native_verified = True
        else:
            require(attempted.read_text() == "attempted")
            delete_failed = False
            if keychain.exists():
                answer = command(root, "keychain-delete", ["security", "delete-keychain", str(keychain)], env, execute=execute)
                delete_failed = answer.returncode != 0
            listed = command(root, "keychain-absence", ["security", "list-keychains", "-d", "user"], env, execute=execute)
            try:
                native_verified = listed.returncode == 0 and str(keychain) not in shlex.split(listed.stdout.decode())
            except (ValueError, UnicodeError):
                native_verified = False
            absent = not keychain.exists() and native_verified
            if delete_failed:
                results.append(record("C02", False, "VERIFICATION_FAILED_ABSENT" if absent else "REMOVAL_FAILED"))
            elif absent:
                results.append(record("C02", True, "ABSENT_VERIFIED"))
            else:
                results.append(record("C02", False, "VERIFICATION_FAILED"))
    except ValueError:
        block_tree = True
        results.append(record("C02", False, "OWNERSHIP_BLOCKED"))
    except Exception:
        results.append(record("C02", False, "VERIFICATION_FAILED_ABSENT" if not keychain.exists() else "REMOVAL_FAILED"))
    temp_error = False
    for name in TEMP_FILES:
        path = root / name
        try:
            require(not path.is_symlink())
            path.unlink(missing_ok=True)
        except ValueError:
            block_tree = True
            temp_error = True
        except Exception:
            temp_error = True
    temp_absent = all(not (root / p).exists() and not (root / p).is_symlink() for p in TEMP_FILES)
    # Preserve the original EXIT trap's failure even if this later removal worked.
    trap_result = root / "reports/temporary-trap-exit"
    try:
        require(not trap_result.is_symlink())
        if trap_result.exists():
            require(re.fullmatch(r"[0-9]+\n?", trap_result.read_text()))
            temp_error = temp_error or trap_result.read_text().strip() != "0"
    except Exception:
        temp_error = True
    results.append(record("C03", not temp_error and temp_absent,
                          "NONE" if not temp_error and temp_absent else
                          "VERIFICATION_FAILED_ABSENT" if temp_absent else "REMOVAL_FAILED"))
    if block_tree:
        results.append(record("C04", False, "OWNERSHIP_BLOCKED"))
    else:
        try:
            owned(root, context, complete=False)  # Revalidate immediately before recursive removal.
            shutil.rmtree(root)
            require(not root.exists())
            results.append(record("C04", True))
        except Exception:
            results.append(record("C04", False, "REMOVAL_FAILED" if root.exists() else "VERIFICATION_FAILED_ABSENT"))
    final_absent = not root.exists() and not root.is_symlink() and not profile.exists() and not keychain.exists()
    if block_tree:
        results.append(record("C05", False, "OWNERSHIP_BLOCKED"))
    elif final_absent and native_verified:
        results.append(record("C05", True))
    else:
        results.append(record("C05", False, "VERIFICATION_FAILED_ABSENT" if final_absent else "REMOVAL_FAILED"))
    return results


def require_ci(environment):
    require(environment.get("GITHUB_ACTIONS") == "true" and environment.get("RUNNER_OS") == "macOS")
    require(environment.get("GITHUB_RUN_ATTEMPT") == "1")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("prepare", "sign", "cleanup"))
    args = parser.parse_args(argv)
    environment = os.environ
    records = []
    try:
        require_ci(environment)
        root = workspace(environment["RUNNER_TEMP"], environment["GITHUB_RUN_ID"])
        if args.mode == "cleanup":
            context = {"run_id": environment["GITHUB_RUN_ID"], "source_commit": environment["GITHUB_SHA"]}
            records = cleanup(root, context, environment)
        else:
            context = authorize(environment)  # Before any native or credential operation.
            if args.mode == "prepare":
                records = [record("A01_AUTHORIZATION", True)]
                prepare(root, context, environment)
                records.append(record("A02_WORKSPACE", True))
            else:
                saved = root / "reports/context.json"
                require(not saved.is_symlink())
                require(json.loads(saved.read_text(), object_pairs_hook=unique_json_object) == context)
                records = run_signing(root, context, environment)
    except BaseException:
        if args.mode == "cleanup":
            records = [record(s, False, "OWNERSHIP_BLOCKED") for s in CLEAN_STAGES]
        elif args.mode == "sign":
            records = [record(s, False, "INTERNAL_FAILURE") for s in (*HOME_STAGES, *SIGN_STAGES)]
        elif records:
            records.append(record("A02_WORKSPACE", False, "WORKSPACE_REJECTED"))
        else:
            records = [record("A01_AUTHORIZATION", False, "AUTHORIZATION_REJECTED"),
                       record("A02_WORKSPACE", False, "DEPENDENCY_FAILED")]
    emit(records)
    return 0 if all(v["status"] == "PASS" for v in records) else 1


if __name__ == "__main__":
    raise SystemExit(main())
