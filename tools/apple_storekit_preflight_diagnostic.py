"""Secret-free Build 15 source/tooling diagnosis; never builds or delivers an app.

A NEW annotated preflight-only tag pins one reviewed child of DELIVERY_SOURCE.
The old delivery tag is inspected/cloned solely as historical source evidence.
Raw command output stays in an owned temporary directory; public output is fixed.
"""
import json
import os
import re
import shutil
import stat
import subprocess
import sys
from pathlib import Path

REPOSITORY = "DBMaps/liberty-county-map"
DELIVERY_SOURCE = "45bfe026b81f4928caceb9632cbf15e7ed842a25"
FAILED_RUN = 39188851227
CERTIFICATION_RUN = 39181592021
FAILED_TAG = "gridly-storekit-testflight-deliver-15-" + DELIVERY_SOURCE
FAILED_TAG_OBJECT = "15a2d8093f31ccaea515b715e604c803d89af469"
PREFIX = "refs/tags/gridly-storekit-preflight-15-"
FILES = {
    ".github/workflows/gridly-storekit-preflight-diagnostic.yml",
    "tools/apple_storekit_preflight_diagnostic.py",
    "tests/storekit-preflight-diagnostic.test.py",
}
STAGES = (
    "P01_SOURCE_SHA", "P02_XCODE_VERSION", "P03_SOURCE_GUARD",
    "P04_CERTIFICATION_HISTORY", "P05_TAG_CHECKOUT", "P06_CLONE_SHA",
    "P07_XCODE_HELP", "P08_INTERNAL_EXPORT_OPTION",
)
CATEGORIES = {
    "NONE", "AUTHORIZATION_FAILED", "SOURCE_SHA_MISMATCH", "DEPENDENCY_FAILED",
    "XCODE_COMMAND_FAILED", "XCODE26_REQUIRED", "DELIVERY_SOURCE_REJECTED",
    "CERTIFICATION_EVIDENCE_REJECTED", "TAG_CHECKOUT_REJECTED",
    "LOCAL_CLONE_FAILED", "CLONED_SHA_MISMATCH", "XCODE_HELP_FAILED",
    "INTERNAL_OPTION_NOT_RECOGNIZED", "INTERNAL_FAILURE", "CLEANUP_FAILED",
    "CLEANUP_HELPER_UNAVAILABLE",
}
ROOT_NAME = "gridly-storekit-preflight-private"
MARKER = "gridly-storekit-preflight-v1\n"
SOURCE_COMMAND = (
    "import sys;sys.path.insert(0,'tools');"
    "import apple_storekit_testflight_delivery as d;"
    "d.source_guard('" + DELIVERY_SOURCE + "',clean=True)"
)
HISTORY_COMMAND = (
    "import sys;sys.path.insert(0,'tools');"
    "import apple_storekit_testflight_delivery as d;d.historical_evidence()"
)


class GateError(Exception):
    pass


def require(value, category="AUTHORIZATION_FAILED"):
    if not value:
        raise GateError(category)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def result(stage, passed, category):
    require(stage in STAGES + ("P09_CLEANUP",))
    require(category in CATEGORIES)
    require((passed and category == "NONE") or (not passed and category != "NONE"))
    return {"stage": stage, "status": "PASS" if passed else "FAIL", "category": category}


def failed_results(category):
    return [result(stage, False, category) for stage in STAGES]


def emit(records):
    # Construct public output anew; never serialize exceptions, subprocesses or paths.
    for record in records:
        require(set(record) == {"stage", "status", "category"})
        fixed = result(record["stage"], record["status"] == "PASS", record["category"])
        require(fixed == record)
        print(json.dumps(fixed, sort_keys=True), flush=True)


def capture(command, *, cwd, env=None, timeout=180, input=None):
    return subprocess.run(command, cwd=cwd, env=env, input=input,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)


def git(repo, *args):
    completed = capture(["git", *args], cwd=repo, timeout=60)
    require(completed.returncode == 0)
    return completed.stdout.decode("utf-8").strip()


def authorization_contract(value, commit):
    expected = {
        "preflight_commit": commit,
        "delivery_source_commit": DELIVERY_SOURCE,
        "failed_delivery_run_id": FAILED_RUN,
        "historical_certification_run_id": CERTIFICATION_RUN,
        "preflight_only_authorized": True,
        "build_sign_export_upload_forbidden": True,
    }
    require(isinstance(value, dict) and set(value) == set(expected))
    require(all(type(value[key]) is type(item) and value[key] == item for key, item in expected.items()))


def authorize(repo, commit, ref, event, attempt, event_name, repository):
    require(isinstance(commit, str) and re.fullmatch(r"[0-9a-f]{40}", commit), "SOURCE_SHA_MISMATCH")
    require(git(repo, "rev-parse", "HEAD") == commit, "SOURCE_SHA_MISMATCH")
    require(event_name == "push" and repository == REPOSITORY and attempt == "1")
    require(ref == PREFIX + commit and event.get("ref") == ref)
    require(event.get("repository", {}).get("full_name") == REPOSITORY)
    require(event.get("created") is True and event.get("deleted") is False and event.get("forced") is False)
    require(git(repo, "cat-file", "-t", ref) == "tag")
    tag_object = git(repo, "rev-parse", "--verify", ref)
    require(event.get("after") in {commit, tag_object}, "SOURCE_SHA_MISMATCH")
    raw = git(repo, "cat-file", "-p", ref)
    header, separator, annotation = raw.partition("\n\n")
    require(separator and header.splitlines()[:3] == [
        "object " + commit, "type commit", "tag " + ref.removeprefix("refs/tags/")
    ])
    require(len(annotation) <= 8192)
    authorization_contract(json.loads(annotation, object_pairs_hook=unique_object), commit)
    # Only three new diagnostic files may be added above the exact frozen source.
    require(git(repo, "show", "-s", "--format=%P", commit) == DELIVERY_SOURCE)
    changes = git(repo, "diff", "--name-status", "--no-renames", DELIVERY_SOURCE, commit).splitlines()
    require(set(changes) == {"A\t" + name for name in FILES} and len(changes) == len(FILES))
    for name in FILES:
        require(git(repo, "ls-tree", commit, "--", name).split()[0] == "100644")
        # Reject checkout-time byte changes even when Git considers them normalized.
        original = capture(["git", "show", commit + ":" + name], cwd=repo)
        require(original.returncode == 0 and Path(repo, name).read_bytes() == original.stdout)
    require(not git(repo, "status", "--porcelain=v1", "--untracked-files=all"))


def private_root(runner_temp):
    require(isinstance(runner_temp, str) and bool(runner_temp))
    parent = Path(runner_temp).resolve(strict=True)
    require(parent.is_dir() and not any(c in str(parent) for c in "\r\n"))
    return parent / ROOT_NAME


def prepare(runner_temp):
    root = private_root(runner_temp)
    root.mkdir(mode=0o700)  # Existing/unowned paths fail closed.
    (root / ".owned").write_text(MARKER)
    for directory in ("home", "tmp", "logs", "reports"):
        (root / directory).mkdir(mode=0o700)
    return root


def child_environment(root, environment):
    # Explicit tooling allowlist. No token, signing, account or upload variables.
    allowed = ("PATH", "LANG", "LC_ALL", "DEVELOPER_DIR", "SDKROOT", "TOOLCHAINS",
               "SSL_CERT_FILE", "SSL_CERT_DIR", "SystemRoot", "WINDIR")
    env = {key: environment[key] for key in allowed if key in environment}
    env.update({"HOME": str(root / "home"), "CFFIXED_USER_HOME": str(root / "home"),
                "XDG_CACHE_HOME": str(root / "home/.cache"),
                "npm_config_cache": str(root / "home/.npm"), "TMPDIR": str(root / "tmp") + "/",
                "PYTHONDONTWRITEBYTECODE": "1", "GIT_TERMINAL_PROMPT": "0"})
    return env


def diagnose(repo, commit, root, environment, execute=capture):
    records = {stage: result(stage, False, "DEPENDENCY_FAILED") for stage in STAGES}
    env = child_environment(root, environment)

    def command(stage, args, *, cwd=repo, timeout=180, input=None):
        completed = execute(args, cwd=cwd, env=env, timeout=timeout, input=input)
        with (root / "logs" / (stage + ".log")).open("ab") as stream:
            stream.write(completed.stdout or b"")
            stream.write(completed.stderr or b"")
        return completed

    def check(stage, category, operation):
        try:
            operation()
            records[stage] = result(stage, True, "NONE")
        except Exception:
            records[stage] = result(stage, False, category)

    def must(completed, category):
        require(completed.returncode == 0, category)
        return completed.stdout

    check("P01_SOURCE_SHA", "SOURCE_SHA_MISMATCH", lambda:
          require(must(command("P01_SOURCE_SHA", ["git", "rev-parse", "HEAD"]), "SOURCE_SHA_MISMATCH").decode().strip() == commit))
    if records["P01_SOURCE_SHA"]["status"] != "PASS":
        return list(records.values())  # Never execute tooling on a changed source checkout.

    try:
        completed = command("P02_XCODE_VERSION", ["xcodebuild", "-version"], timeout=60)
        require(completed.returncode == 0)
    except Exception:
        records["P02_XCODE_VERSION"] = result("P02_XCODE_VERSION", False, "XCODE_COMMAND_FAILED")
    else:
        check("P02_XCODE_VERSION", "XCODE26_REQUIRED", lambda:
              must(command("P02_XCODE_VERSION", ["grep", "-E", "^Xcode 26([. ]|$)"],
                           input=completed.stdout, timeout=30), "XCODE26_REQUIRED"))

    def tag_checkout():
        require(must(command("P05_TAG_CHECKOUT", ["git", "cat-file", "-t", environment["GITHUB_REF"]]), "TAG_CHECKOUT_REJECTED").strip() == b"tag")
        require(must(command("P05_TAG_CHECKOUT", ["git", "rev-parse", environment["GITHUB_REF"] + "^{commit}"]), "TAG_CHECKOUT_REJECTED").decode().strip() == commit)
        detached = command("P05_TAG_CHECKOUT", ["git", "symbolic-ref", "-q", "HEAD"])
        require(detached.returncode == 1)
        require(must(command("P05_TAG_CHECKOUT", ["git", "cat-file", "-t", "refs/tags/" + FAILED_TAG]), "TAG_CHECKOUT_REJECTED").strip() == b"tag")
        require(must(command("P05_TAG_CHECKOUT", ["git", "rev-parse", "refs/tags/" + FAILED_TAG]), "TAG_CHECKOUT_REJECTED").decode().strip() == FAILED_TAG_OBJECT)
        require(must(command("P05_TAG_CHECKOUT", ["git", "rev-parse", "refs/tags/" + FAILED_TAG + "^{commit}"]), "TAG_CHECKOUT_REJECTED").decode().strip() == DELIVERY_SOURCE)
        require(command("P05_TAG_CHECKOUT", ["git", "show-ref", "--verify", "--quiet", "refs/heads/" + FAILED_TAG]).returncode == 1)
    check("P05_TAG_CHECKOUT", "TAG_CHECKOUT_REJECTED", tag_checkout)

    clone = root / "source"
    if records["P05_TAG_CHECKOUT"]["status"] == "PASS":
        try:
            cloned = command("P06_CLONE_SHA", ["git", "clone", "--no-hardlinks", "--branch", FAILED_TAG, str(repo), str(clone)])
            require(cloned.returncode == 0)
        except Exception:
            records["P06_CLONE_SHA"] = result("P06_CLONE_SHA", False, "LOCAL_CLONE_FAILED")
        else:
            check("P06_CLONE_SHA", "CLONED_SHA_MISMATCH", lambda:
                  require(must(command("P06_CLONE_SHA", ["git", "-C", str(clone), "rev-parse", "HEAD"]),
                               "CLONED_SHA_MISMATCH").decode().strip() == DELIVERY_SOURCE))
    if records["P06_CLONE_SHA"]["status"] == "PASS":
        check("P03_SOURCE_GUARD", "DELIVERY_SOURCE_REJECTED", lambda:
              must(command("P03_SOURCE_GUARD", [sys.executable, "-B", "-c", SOURCE_COMMAND], cwd=clone), "DELIVERY_SOURCE_REJECTED"))

    # Independent of clone and Xcode; only the existing public GitHub GET helper.
    check("P04_CERTIFICATION_HISTORY", "CERTIFICATION_EVIDENCE_REJECTED", lambda:
          must(command("P04_CERTIFICATION_HISTORY", [sys.executable, "-B", "-c", HISTORY_COMMAND], timeout=120), "CERTIFICATION_EVIDENCE_REJECTED"))

    help_file = root / "reports/xcode-help.txt"
    def help_command():
        completed = command("P07_XCODE_HELP", ["xcodebuild", "-help"], timeout=60)
        help_file.write_bytes((completed.stdout or b"") + (completed.stderr or b""))
        must(completed, "XCODE_HELP_FAILED")
    check("P07_XCODE_HELP", "XCODE_HELP_FAILED", help_command)
    if records["P07_XCODE_HELP"]["status"] == "PASS":
        check("P08_INTERNAL_EXPORT_OPTION", "INTERNAL_OPTION_NOT_RECOGNIZED", lambda:
              must(command("P08_INTERNAL_EXPORT_OPTION", [
                  "grep", "-Eq", "^[[:space:]]*testFlightInternalTestingOnly[[:space:]]*:", str(help_file)
              ], timeout=30), "INTERNAL_OPTION_NOT_RECOGNIZED"))
    return [records[stage] for stage in STAGES]


def cleanup(runner_temp):
    try:
        root = private_root(runner_temp)
        if not root.exists() and not root.is_symlink():
            return result("P09_CLEANUP", True, "NONE")
        require(not root.is_symlink() and root.is_dir())
        marker = root / ".owned"
        require(not marker.is_symlink() and marker.is_file() and marker.read_text() == MARKER)
        # Git's read-only copied objects need an owned-directory-only Windows retry.
        def writable_retry(function, path, error):
            resolved = Path(path).resolve()
            require(resolved.is_relative_to(root))
            os.chmod(resolved, stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
            function(path)
        shutil.rmtree(root, onerror=writable_retry)
        require(not root.exists())
        return result("P09_CLEANUP", True, "NONE")
    except BaseException:
        return result("P09_CLEANUP", False, "CLEANUP_FAILED")


def main(mode=None, environment=None):
    environment = os.environ if environment is None else environment
    mode = (sys.argv[1] if len(sys.argv) == 2 else "") if mode is None else mode
    if mode == "cleanup":
        record = cleanup(environment.get("RUNNER_TEMP", ""))
        emit([record])
        return 0 if record["status"] == "PASS" else 1
    records = failed_results("AUTHORIZATION_FAILED")
    try:
        require(mode == "run" and environment.get("RUNNER_OS") == "macOS" and environment.get("GITHUB_ACTIONS") == "true")
        repo = Path(environment["GITHUB_WORKSPACE"]).resolve(strict=True)
        event = json.loads(Path(environment["GITHUB_EVENT_PATH"]).read_text(), object_pairs_hook=unique_object)
        commit = environment["GITHUB_SHA"]
        authorize(repo, commit, environment["GITHUB_REF"], event, environment["GITHUB_RUN_ATTEMPT"],
                  environment["GITHUB_EVENT_NAME"], environment["GITHUB_REPOSITORY"])
        records = failed_results("INTERNAL_FAILURE")
        root = prepare(environment["RUNNER_TEMP"])
        records = diagnose(repo, commit, root, environment)
    except GateError as error:
        if error.args == ("SOURCE_SHA_MISMATCH",):
            records[0] = result(STAGES[0], False, "SOURCE_SHA_MISMATCH")
    except BaseException:
        pass  # Includes interrupted tools; never print raw traceback or private values.
    emit(records)
    return 0 if all(record["status"] == "PASS" for record in records) else 1


if __name__ == "__main__":
    raise SystemExit(main())
