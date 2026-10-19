"""CMS-only macOS comparison. Local tests inject synthetic input and commands.
No signing keys, application build, Apple API, upload or artifact publication.
All security cms imports target one owned disposable keychain (-k); native default
availability is queried separately. This intentionally does not reproduce an
import into the runner's existing default keychain or a distribution identity.
"""
import argparse
import hashlib
import io
import json
import os
import plistlib
import re
import secrets
import shlex
import shutil
import subprocess
from pathlib import Path

import apple_storekit_signing_diagnostic as signing

BASE = "db4df3949b1f02325b8869433bbbd16b234487db"
PREFIX = "refs/tags/gridly-storekit-cms-diagnostic-15-"
FILES = {".github/workflows/gridly-storekit-cms-diagnostic.yml",
         "tools/apple_storekit_cms_diagnostic.py", "tests/storekit-cms-diagnostic.test.py"}
HISTORY = {**signing.HISTORY,
           "gridly-storekit-signing-diagnostic-15-" + BASE:
               ("ffa6924f2ec257f42a183f8f05daaccc66b85685", BASE)}
SECRET = "APPLE_PROVISION_PROFILE_BASE64"
MARKER = "gridly-cms-only-v1"
CONFIRMATIONS = {"cms_only_authorized", "provisioning_profile_access_authorized",
                 "home_context_comparison_authorized",
                 "temporary_keychain_context_comparison_authorized",
                 "no_application_build_or_upload_confirmed"}
AUTH_FIELDS = {"cms_diagnostic_commit", "signing_source_commit",
               "failed_signing_run_id", *CONFIRMATIONS}
COMPARE = ("NATIVE_DEFAULT_RUNNER", "NATIVE_DEFAULT_PRIVATE", "CMS_RUNNER_HOME",
           "CMS_PRIVATE_HOME", "CMS_STRUCTURE", "CMS_PRIVATE_HOME_RESTRICTED",
           "CMS_PRIVATE_HOME_RESTORED", "KEYCHAIN_CONTEXT_COMPARISON", "INPUT_IDENTITY")
STAGES = ("AUTHORIZATION", "PROFILE_INPUT_DECODED", *COMPARE,
          "KEYCHAIN_RESTORED", "CLEANUP_VERIFIED")
CATEGORIES = {
    "PASS": {"NONE", "PARSEABLE_DER", "CHANGED_WITH_SEARCH_LIST", "UNCHANGED_WITH_SEARCH_LIST",
             "ALL_ABSENT"},
    "FAIL": {"AUTHORIZATION_REJECTED", "INPUT_MISSING", "INPUT_DECODE_FAILED", "INPUT_CHANGED",
             "CMS_DECODE_FAILED", "CMS_CERT_IMPORT_FAILED", "CMS_DECODER_CREATE_FAILED",
             "CMS_DECODER_UPDATE_FAILED", "CMS_DECODER_FINISH_FAILED", "OUTPUT_NOT_PLIST",
             "CMS_PARSE_FAILED", "PLAIN_PLIST_INPUT", "NATIVE_DEFAULT_UNAVAILABLE",
             "CONTEXT_SETUP_FAILED", "RESTORE_FAILED", "OWNERSHIP_BLOCKED", "REMOVAL_FAILED",
             "INTERNAL_FAILURE", "COMMAND_TIMEOUT", "COMMAND_FAILED", "BASELINE_CHANGED"},
    "NOT_RUN": {"DEPENDENCY_FAILED", "UNSUPPORTED", "CONTEXT_NOT_ISOLATED", "NOT_STARTED"},
}
# Exact static diagnostic prefixes from Apple's open-source cmsutil.c. Never
# republish a raw line or interpolate an error/value into these categories.
CMS_ERRORS = (
    (b"cert import failed", "CMS_CERT_IMPORT_FAILED"),
    (b"failed to create to decoder", "CMS_DECODER_CREATE_FAILED"),
    (b"failed to add data to decoder", "CMS_DECODER_UPDATE_FAILED"),
    (b"failed to decode message", "CMS_DECODER_FINISH_FAILED"),
)
require = signing.require
git = signing.git
unique_json_object = signing.unique_json_object
captured = signing.captured


def record(stage, status, category="NONE"):
    require(stage in STAGES and status in CATEGORIES and category in CATEGORIES[status])
    if status == "PASS":
        allowed = {"CMS_STRUCTURE": {"PARSEABLE_DER"},
                   "KEYCHAIN_CONTEXT_COMPARISON": {"CHANGED_WITH_SEARCH_LIST", "UNCHANGED_WITH_SEARCH_LIST"},
                   "CLEANUP_VERIFIED": {"ALL_ABSENT"}}.get(stage, {"NONE"})
        require(category in allowed)
    return {"stage": stage, "status": status, "category": category}


def emit(values, stream=None):
    checked = []
    for value in values:
        require(isinstance(value, dict) and set(value) == {"stage", "status", "category"})
        require(record(value["stage"], value["status"], value["category"]) == value)
        checked.append(value)
    require(len({v["stage"] for v in checked}) == len(checked))
    (stream or __import__("sys").stdout).write(
        "".join(json.dumps(v, sort_keys=True) + "\n" for v in checked))


def source_guard(commit):
    require(isinstance(commit, str) and re.fullmatch("[0-9a-f]{40}", commit) and commit != BASE)
    require(git("rev-parse", "HEAD").decode().strip() == commit)
    require(git("show", "-s", "--format=%P", commit).decode().strip() == BASE)
    require(git("show", "-s", "--format=%P", BASE).decode().strip() == signing.BASE)
    for child, parent in signing.CHAIN:
        require(git("show", "-s", "--format=%P", child).decode().strip() == parent)
    rows = git("diff", "--name-status", "--no-renames", BASE, commit).decode().splitlines()
    require(set(rows) == {"A\t" + f for f in FILES} and len(rows) == 3)
    for f in FILES:
        require(git("ls-tree", commit, "--", f).decode().split()[0] == "100644")
    for name, (obj, target) in HISTORY.items():
        ref = "refs/tags/" + name
        require(git("cat-file", "-t", ref).decode().strip() == "tag")
        require(git("rev-parse", "--verify", ref).decode().strip() == obj)
        require(git("rev-parse", "--verify", ref + "^{}").decode().strip() == target)
    require(not git("status", "--porcelain=v1", "--untracked-files=all"))


def authorization(value, commit):
    require(isinstance(value, dict) and set(value) == AUTH_FIELDS)
    require(value["cms_diagnostic_commit"] == commit and value["signing_source_commit"] == BASE)
    require(type(value["failed_signing_run_id"]) is int and value["failed_signing_run_id"] == 39202397418)
    require(all(value[k] is True for k in CONFIRMATIONS))
    return value


def authorize(env):
    require(env.get("GITHUB_RUN_ATTEMPT") == "1" and env.get("GITHUB_EVENT_NAME") == "push")
    commit, ref = env["GITHUB_SHA"], env["GITHUB_REF"]
    require(ref == PREFIX + commit and env["GITHUB_REF_NAME"] == ref.removeprefix("refs/tags/"))
    source_guard(commit)
    require(git("rev-parse", "--verify", signing.DIAGNOSTIC_BRANCH).decode().strip() == commit)
    require(git("cat-file", "-t", ref).decode().strip() == "tag")
    obj = git("rev-parse", "--verify", ref).decode().strip()
    head, sep, body = git("cat-file", "-p", ref).decode().partition("\n\n")
    require(sep and head.splitlines()[:3] ==
            ["object " + commit, "type commit", "tag " + env["GITHUB_REF_NAME"]])
    event = json.loads(Path(env["GITHUB_EVENT_PATH"]).read_text(), object_pairs_hook=unique_json_object)
    require(event.get("repository", {}).get("full_name") == signing.REPOSITORY)
    require(event.get("created") is True and event.get("deleted") is False and event.get("forced") is False)
    require(event.get("ref") == ref and event.get("after") in {obj, commit})
    value = authorization(json.loads(body, object_pairs_hook=unique_json_object), commit)
    return {"source_commit": commit, "run_id": env["GITHUB_RUN_ID"], "authorization": value}


def workspace(parent, run_id):
    require(re.fullmatch("[1-9][0-9]{0,19}", run_id))
    parent = Path(parent).resolve(strict=True)
    require(parent.is_dir() and parent != Path(parent.anchor))
    root = parent / ("gridly-cms-diagnostic-" + run_id)
    require(not root.is_symlink() and root.resolve().parent == parent)
    return root


def owned(root, context):
    require(root.name == "gridly-cms-diagnostic-" + context["run_id"])
    require(root.is_dir() and not root.is_symlink())
    marker = root / ".owned"
    require(marker.is_file() and not marker.is_symlink())
    require(json.loads(marker.read_text(), object_pairs_hook=unique_json_object) ==
            {"marker": MARKER, "run_id": context["run_id"], "source_commit": context["source_commit"]})
    # Reject every nested symlink before reads, writes or recursive cleanup.
    require(not any(p.is_symlink() for p in root.rglob("*")))


def safe_environment(root, original):
    # Do not pass the profile secret, GitHub token, signing credentials, shell
    # startup hooks or loader injections to any native subprocess.
    names = ("PATH", "HOME", "CFFIXED_USER_HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "__CF_USER_TEXT_ENCODING")
    env = {k: original[k] for k in names if k in original}
    require(env.get("HOME") and Path(env["HOME"]).is_absolute() and Path(env["HOME"]).is_dir())
    env["TMPDIR"] = str(root / "tmp") + os.sep
    return env


def environments(root, original):
    runner = safe_environment(root, original)
    private = {**runner, "HOME": str(root / "home"), "CFFIXED_USER_HOME": str(root / "home")}
    require(runner["HOME"] != private["HOME"])
    return {"runner": runner, "private": private}


def save(root, name, value):
    target = root / name
    require(not target.is_symlink())
    target.write_text(json.dumps(value), encoding="utf-8")
    target.chmod(0o600)


def load_state(root):
    return json.loads((root / "state.json").read_text(), object_pairs_hook=unique_json_object)


def prepare(root, context, env):
    require(not root.exists())
    root.mkdir(mode=0o700)
    save(root, ".owned", {"marker": MARKER, "run_id": context["run_id"], "source_commit": context["source_commit"]})
    for name in ("home", "tmp", "logs"):
        (root / name).mkdir(mode=0o700)
    contexts = environments(root, env)
    save(root, "context.json", context)
    save(root, "state.json", {"contexts": contexts, "snapshots": {}, "keychain_attempted": False,
                              "mutation_attempted": False, "restore_failed": False})


def command(root, label, args, env, execute=captured, input=None):
    # Timeouts terminate the owned process group through the reviewed helper.
    result = execute(args, input=input, env=env, cwd=root, timeout=30,
                     capture_output=True, close_fds=True, check=False)
    with (root / "logs" / (label + ".log")).open("ab") as out:
        # Decoder stdout is consumed in memory; do not create a second decoded
        # profile or retain plist/certificate content in raw logs.
        out.write(result.stderr or b"")
    return result


def search_list(root, label, env, execute):
    answer = command(root, label, ["/usr/bin/security", "list-keychains", "-d", "user"], env, execute)
    require(answer.returncode == 0)
    paths = shlex.split(answer.stdout.decode())
    require(all(Path(p).is_absolute() and "\n" not in p and "\0" not in p for p in paths))
    require(len(paths) == len(set(paths)))
    return paths


def restore(root, state, execute):
    """Restore both original lists; verify both after all writes (including aliases)."""
    if not state["keychain_attempted"] and not state["mutation_attempted"]:
        return True
    ok = True
    for name in ("private", "runner"):
        if name not in state["snapshots"]:
            ok = False
            continue
        try:
            result = command(root, "restore-" + name,
                             ["/usr/bin/security", "list-keychains", "-d", "user", "-s",
                              *state["snapshots"][name]], state["contexts"][name], execute)
            ok = result.returncode == 0 and ok
        except Exception:
            ok = False
    for name in ("runner", "private"):
        try:
            ok = search_list(root, "verify-" + name, state["contexts"][name], execute) == state["snapshots"][name] and ok
        except Exception:
            ok = False
    if not ok:
        state["restore_failed"] = True
    save(root, "state.json", state)
    return ok


def identity(path):
    require(path.is_file() and not path.is_symlink())
    stat = path.stat()
    return (stat.st_dev, stat.st_ino, stat.st_size, hashlib.sha256(path.read_bytes()).digest())


def fresh_keychain(root, state, execute):
    """Fresh import destination per decode: prior certificate imports cannot bias the next cell."""
    keychain = root / "cms.keychain-db"
    env = state["contexts"]["private"]
    if keychain.exists():
        require(state["keychain_attempted"])
        answer = command(root, "keychain-reset-delete",
                         ["/usr/bin/security", "delete-keychain", str(keychain)], env, execute)
        require(answer.returncode == 0 and not keychain.exists())
    state["keychain_attempted"] = True
    save(root, "state.json", state)
    password = secrets.token_urlsafe(32)
    answer = command(root, "keychain-create",
                     ["/usr/bin/security", "create-keychain", "-p", password, str(keychain)], env, execute)
    require(answer.returncode == 0)
    answer = command(root, "keychain-unlock",
                     ["/usr/bin/security", "unlock-keychain", "-p", password, str(keychain)], env, execute)
    password = None
    require(answer.returncode == 0 and restore(root, state, execute))


def cms(root, stage, env, original_identity, execute, state, restricted=False):
    profile = root / "profile.mobileprovision"
    require(identity(profile) == original_identity)
    try:
        fresh_keychain(root, state, execute)
        if restricted:
            state["mutation_attempted"] = True
            save(root, "state.json", state)
            answer = command(root, "restrict-search-list",
                             ["/usr/bin/security", "list-keychains", "-d", "user", "-s",
                              str(root / "cms.keychain-db")], env, execute)
            require(answer.returncode == 0 and search_list(root, "restricted-list", env, execute) ==
                    [str(root / "cms.keychain-db")])
    except Exception:
        return record(stage, "FAIL", "CONTEXT_SETUP_FAILED")
    try:
        result = command(root, stage, ["/usr/bin/security", "cms", "-D", "-k",
                         str(root / "cms.keychain-db"), "-i", str(profile)], env, execute)
    except subprocess.TimeoutExpired:
        require(identity(profile) == original_identity)
        return record(stage, "FAIL", "COMMAND_TIMEOUT")
    except Exception:
        require(identity(profile) == original_identity)
        return record(stage, "FAIL", "COMMAND_FAILED")
    finally:
        restore(root, state, execute)
    require(identity(profile) == original_identity)
    if result.returncode:
        category = next((cat for text, cat in CMS_ERRORS if text in (result.stderr or b"")),
                        "CMS_DECODE_FAILED")
        return record(stage, "FAIL", category)
    try:
        value = plistlib.loads(result.stdout)
        require(isinstance(value, dict) and bool(value))
    except Exception:
        return record(stage, "FAIL", "OUTPUT_NOT_PLIST")
    return record(stage, "PASS")


def structure(root, env, original_identity, execute, locate=shutil.which):
    profile = root / "profile.mobileprovision"
    require(identity(profile) == original_identity)
    data = profile.read_bytes()
    if data.lstrip().startswith((b"<?xml", b"<plist", b"bplist")):
        return record("CMS_STRUCTURE", "FAIL", "PLAIN_PLIST_INPUT")
    tool = locate("openssl", path=env.get("PATH", ""))
    if not tool:
        return record("CMS_STRUCTURE", "NOT_RUN", "UNSUPPORTED")
    try:
        help_result = command(root, "cms-help", [tool, "cms", "-help"], env, execute)
        help_text = (help_result.stdout or b"") + (help_result.stderr or b"")
        if not all(option in help_text for option in (b"-cmsout", b"-noout", b"-inform")):
            return record("CMS_STRUCTURE", "NOT_RUN", "UNSUPPORTED")
        answer = command(root, "cms-structure",
                         [tool, "cms", "-cmsout", "-inform", "DER", "-in", str(profile), "-noout"], env, execute)
    except subprocess.TimeoutExpired:
        require(identity(profile) == original_identity)
        return record("CMS_STRUCTURE", "FAIL", "COMMAND_TIMEOUT")
    except Exception:
        require(identity(profile) == original_identity)
        return record("CMS_STRUCTURE", "FAIL", "COMMAND_FAILED")
    require(identity(profile) == original_identity)
    return record("CMS_STRUCTURE", "PASS", "PARSEABLE_DER") if answer.returncode == 0 else record(
        "CMS_STRUCTURE", "FAIL", "CMS_PARSE_FAILED")


def diagnose(root, context, env, execute=captured, locate=shutil.which):
    owned(root, context)
    require(json.loads((root / "context.json").read_text()) == context)
    # Exclusive marker before reading the sole authorized secret; no second attempt.
    with (root / "attempted").open("x") as out:
        out.write("one CMS-only comparison")
    results = {}
    state = load_state(root)
    fingerprint = None
    def put(value): results[value["stage"]] = value
    try:
        secret = env.get(SECRET)
        if not secret:
            put(record("PROFILE_INPUT_DECODED", "FAIL", "INPUT_MISSING"))
            return [results.get(s, record(s, "NOT_RUN", "DEPENDENCY_FAILED"))
                    for s in ("PROFILE_INPUT_DECODED", *COMPARE)]
        require(isinstance(secret, str) and len(secret) <= 8 * 1024 * 1024)
        decoded = command(root, "input-decode", ["/usr/bin/base64", "-D"],
                          state["contexts"]["runner"], execute, input=secret.encode())
        if decoded.returncode != 0 or not decoded.stdout or len(decoded.stdout) > 6 * 1024 * 1024:
            put(record("PROFILE_INPUT_DECODED", "FAIL", "INPUT_DECODE_FAILED"))
        else:
            profile = root / "profile.mobileprovision"
            with profile.open("xb") as out: out.write(decoded.stdout)
            profile.chmod(0o400)
            fingerprint = identity(profile)
            put(record("PROFILE_INPUT_DECODED", "PASS"))
            put(structure(root, state["contexts"]["runner"], fingerprint, execute, locate))
            for name in ("runner", "private"):
                state["snapshots"][name] = search_list(root, "snapshot-" + name, state["contexts"][name], execute)
                default = command(root, "default-" + name,
                                  ["/usr/bin/security", "default-keychain", "-d", "user"],
                                  state["contexts"][name], execute)
                try:
                    paths = shlex.split(default.stdout.decode())
                    available = default.returncode == 0 and len(paths) == 1 and Path(paths[0]).is_file()
                except Exception:
                    available = False
                put(record("NATIVE_DEFAULT_" + name.upper(), "PASS" if available else "FAIL",
                           "NONE" if available else "NATIVE_DEFAULT_UNAVAILABLE"))
            save(root, "state.json", state)  # Both snapshots precede native mutation.
            put(cms(root, "CMS_RUNNER_HOME", state["contexts"]["runner"], fingerprint, execute, state))
            require(not state["restore_failed"])
            put(cms(root, "CMS_PRIVATE_HOME", state["contexts"]["private"], fingerprint, execute, state))
            require(not state["restore_failed"])
            if state["snapshots"]["private"] == [str(root / "cms.keychain-db")]:
                put(record("KEYCHAIN_CONTEXT_COMPARISON", "NOT_RUN", "CONTEXT_NOT_ISOLATED"))
            else:
                put(cms(root, "CMS_PRIVATE_HOME_RESTRICTED", state["contexts"]["private"],
                        fingerprint, execute, state, restricted=True))
            require(not state["restore_failed"])
            put(cms(root, "CMS_PRIVATE_HOME_RESTORED", state["contexts"]["private"], fingerprint, execute, state))
            require(not state["restore_failed"])
            a, b, c = (results.get(s) for s in ("CMS_PRIVATE_HOME", "CMS_PRIVATE_HOME_RESTRICTED",
                                               "CMS_PRIVATE_HOME_RESTORED"))
            if a and b and c and not any(v["category"] in
                    {"CONTEXT_SETUP_FAILED", "COMMAND_TIMEOUT", "COMMAND_FAILED"} for v in (a, b, c)):
                if (a["status"], a["category"]) != (c["status"], c["category"]):
                    put(record("KEYCHAIN_CONTEXT_COMPARISON", "FAIL", "BASELINE_CHANGED"))
                else:
                    changed = (a["status"], a["category"]) != (b["status"], b["category"])
                    put(record("KEYCHAIN_CONTEXT_COMPARISON", "PASS",
                               "CHANGED_WITH_SEARCH_LIST" if changed else "UNCHANGED_WITH_SEARCH_LIST"))
            require(identity(profile) == fingerprint)
            put(record("INPUT_IDENTITY", "PASS"))
    except Exception:
        if fingerprint is not None:
            try:
                same = identity(root / "profile.mobileprovision") == fingerprint
            except Exception:
                same = False
            put(record("INPUT_IDENTITY", "FAIL", "CONTEXT_SETUP_FAILED" if same else "INPUT_CHANGED"))
        else:
            results.setdefault("PROFILE_INPUT_DECODED", record("PROFILE_INPUT_DECODED", "FAIL", "INPUT_DECODE_FAILED"))
    finally:
        # Mandatory even on a failed decode/setup/mutation/timeout. Cleanup later
        # independently verifies/restores again, but never erases an earlier failure.
        if not restore(root, state, execute):
            put(record("KEYCHAIN_CONTEXT_COMPARISON", "FAIL", "RESTORE_FAILED"))
    return [results.get(s, record(s, "NOT_RUN", "DEPENDENCY_FAILED"))
            for s in ("PROFILE_INPUT_DECODED", *COMPARE)]


def cleanup(root, context, outcome, execute=captured):
    if not root.exists() and not root.is_symlink():
        return [record("KEYCHAIN_RESTORED", "NOT_RUN", "NOT_STARTED"),
                record("CLEANUP_VERIFIED", "PASS", "ALL_ABSENT")] if outcome == "skipped" else [
                    record(s, "FAIL", "OWNERSHIP_BLOCKED") for s in ("KEYCHAIN_RESTORED", "CLEANUP_VERIFIED")]
    try:
        owned(root, context)
        state = load_state(root)
        require(set(state) == {"contexts", "snapshots", "keychain_attempted", "mutation_attempted", "restore_failed"})
        expected_contexts = environments(root, state["contexts"]["runner"])
        require(state["contexts"] == expected_contexts)
        require(all(type(state[k]) is bool for k in ("keychain_attempted", "mutation_attempted", "restore_failed")))
        require(set(state["snapshots"]).issubset({"runner", "private"}))
        for paths in state["snapshots"].values():
            require(isinstance(paths, list) and len(paths) == len(set(paths)))
            require(all(isinstance(p, str) and Path(p).is_absolute() and
                        "\n" not in p and "\0" not in p for p in paths))
        if not state["keychain_attempted"]:
            require(not (root / "cms.keychain-db").exists())
    except Exception:
        return [record(s, "FAIL", "OWNERSHIP_BLOCKED") for s in ("KEYCHAIN_RESTORED", "CLEANUP_VERIFIED")]
    restored = restore(root, state, execute)
    keychain = root / "cms.keychain-db"
    native_absent = not state["keychain_attempted"]
    deletion_ok = True
    if state["keychain_attempted"]:
        try:
            if keychain.exists():
                answer = command(root, "keychain-delete", ["/usr/bin/security", "delete-keychain", str(keychain)],
                                 state["contexts"]["private"], execute)
                deletion_ok = answer.returncode == 0
            restored = restore(root, state, execute) and restored
            native_absent = all(str(keychain) not in search_list(root, "absence-" + name, env, execute)
                                for name, env in state["contexts"].items()) and not keychain.exists()
        except Exception:
            native_absent = False
    keychain_ok = restored and native_absent and deletion_ok and not state["restore_failed"]
    removed = False
    try:
        owned(root, context)  # Recheck ownership and all symlinks immediately before removal.
        # Windows synthetic fixtures map mode 0400 to a deletion-blocking readonly
        # attribute. Restore write permission only on this owned input after all
        # comparisons; macOS also removes this exact file with the private tree.
        profile = root / "profile.mobileprovision"
        if profile.exists():
            profile.chmod(0o600)
        shutil.rmtree(root)
        removed = not root.exists() and not root.is_symlink()
    except Exception:
        pass
    return [record("KEYCHAIN_RESTORED", "PASS" if keychain_ok else "FAIL",
                   "NONE" if keychain_ok else "RESTORE_FAILED"),
            record("CLEANUP_VERIFIED", "PASS" if removed and keychain_ok else "FAIL",
                   "ALL_ABSENT" if removed and keychain_ok else "REMOVAL_FAILED")]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("prepare", "compare", "cleanup"))
    mode = parser.parse_args(argv).mode
    env = os.environ
    values = []
    try:
        signing.require_ci(env)
        root = workspace(env["RUNNER_TEMP"], env["GITHUB_RUN_ID"])
        if mode == "cleanup":
            context = {"run_id": env["GITHUB_RUN_ID"], "source_commit": env["GITHUB_SHA"]}
            values = cleanup(root, context, env.get("CMS_STEP_OUTCOME", "unknown"))
        else:
            context = authorize(env)  # Before workspace creation or secret access.
            if mode == "prepare":
                prepare(root, context, env)
                values = [record("AUTHORIZATION", "PASS")]
            else:
                values = diagnose(root, context, env)
    except BaseException:
        stages = ("KEYCHAIN_RESTORED", "CLEANUP_VERIFIED") if mode == "cleanup" else (
            ("AUTHORIZATION",) if mode == "prepare" else ("PROFILE_INPUT_DECODED", *COMPARE))
        values = [record(s, "FAIL", "AUTHORIZATION_REJECTED" if mode == "prepare" else
                         "OWNERSHIP_BLOCKED" if mode == "cleanup" else "INTERNAL_FAILURE") for s in stages]
    emit(values)
    return 1 if any(v["status"] == "FAIL" for v in values) else 0


if __name__ == "__main__":
    raise SystemExit(main())
