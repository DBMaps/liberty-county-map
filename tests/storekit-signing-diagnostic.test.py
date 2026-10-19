"""Synthetic local safety checks. Native signing commands are replaced by fakes."""
import ast
import contextlib
import copy
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import apple_storekit_signing_diagnostic as d

COMMIT = "1" * 40
REF = d.PREFIX + COMMIT
BASH = "C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else "/bin/bash"
CANARY = "SYNTHETIC_PRIVATE_VALUE_NEVER_PUBLIC"


def test_environment():
    # Local Bash fixtures receive only ordinary runtime paths, never inherited
    # signing or service credentials from the surrounding process.
    allowed = ("PATH", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP",
               "PATHEXT", "COMSPEC", "ProgramFiles", "PROGRAMFILES")
    return {name: os.environ[name] for name in allowed if name in os.environ}


def permission():
    return {
        "signing_diagnostic_commit": COMMIT, "delivery_source_commit": d.BASE,
        "failed_delivery_run_id": 39196269782, "historical_certification_run_id": 39181592021,
        **dict.fromkeys(d.CONFIRMATIONS, True),
    }


def context():
    return {"source_commit": COMMIT, "run_id": "123456", "ref": REF, "authorization": permission()}


def fixture(parent):
    root = d.workspace(parent, "123456")
    root.mkdir(mode=0o700)
    for name in ("home", "logs", "reports", "tmp", "source"):
        (root / name).mkdir(mode=0o700)
    (root / ".owned").write_text(json.dumps({"marker": d.MARKER, "run_id": "123456", "source_commit": COMMIT}))
    (root / "reports/context.json").write_text(json.dumps(context()))
    return root


def source_git(**changes):
    values = {
        ("rev-parse", "HEAD"): COMMIT.encode(),
        ("show", "-s", "--format=%P", COMMIT): d.REPAIR.encode(),
        ("diff", "--name-status", "--no-renames", d.REPAIR, COMMIT):
            "\n".join("M\t" + p for p in sorted(d.SUPPORT_FILES)).encode(),
        ("status", "--porcelain=v1", "--untracked-files=normal"): b"",
        ("rev-parse", "--verify", d.DIAGNOSTIC_BRANCH): COMMIT.encode(),
        ("cat-file", "-t", REF): b"tag",
        ("rev-parse", "--verify", REF): b"2" * 40,
        ("cat-file", "-p", REF): ("object " + COMMIT + "\ntype commit\ntag " +
                                  REF.removeprefix("refs/tags/") + "\ntagger SYNTHETIC\n\n" +
                                  json.dumps(permission())).encode(),
    }
    for child, parent in d.CHAIN:
        values[("show", "-s", "--format=%P", child)] = parent.encode()
    for base,target,status,files in d.HISTORICAL_INVENTORIES:
        values[("diff", "--name-status", "--no-renames", base, target)] = "\n".join(status+"\t"+p for p in sorted(files)).encode()
        for path in files:
            values[("ls-tree", target, "--", path)] = ("100644 blob "+"0"*40+"\t"+path).encode()
    for path in d.SUPPORT_FILES:
        values[("ls-tree", COMMIT, "--", path)] = ("100644 blob " + "0"*40 + "\t" + path).encode()
    for name, (obj, target) in d.HISTORY.items():
        ref = "refs/tags/" + name
        values[("rev-parse", "--verify", ref)] = obj.encode()
        values[("cat-file", "-t", ref)] = b"tag"
        values[("rev-parse", "--verify", ref + "^{}")] = target.encode()
    values.update(changes.get("values", {}))
    def git(*args):
        answer = values[args]
        if isinstance(answer, Exception):
            raise answer
        return answer
    return git


class AuthorizationAndSourceTests(unittest.TestCase):
    def test_local_runtime_environment_never_inherits_signing_credentials(self):
        with patch.dict(os.environ, dict.fromkeys(d.INPUTS, CANARY)):
            environment = test_environment()
        self.assertTrue(all(key not in environment for key in d.INPUTS))
        self.assertNotIn(CANARY, json.dumps(environment))

    def test_exact_permission_passes(self):
        self.assertEqual(d.authorization(permission(), COMMIT), permission())

    def test_every_missing_false_nonboolean_or_extra_permission_fails(self):
        for field in d.AUTH_FIELDS:
            candidate = permission()
            del candidate[field]
            with self.subTest(field=field), self.assertRaises(ValueError):
                d.authorization(candidate, COMMIT)
        for field in d.CONFIRMATIONS:
            for value in (False, 1, "true", None):
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    d.authorization({**permission(), field: value}, COMMIT)
        with self.assertRaises(ValueError):
            d.authorization({**permission(), "upload_authorized": True}, COMMIT)

    def test_wrong_source_run_or_types_fail(self):
        for field, value in (("signing_diagnostic_commit", "9"*40), ("delivery_source_commit", COMMIT),
                             ("failed_delivery_run_id", 0), ("failed_delivery_run_id", True),
                             ("historical_certification_run_id", "39181592021")):
            with self.subTest(field=field), self.assertRaises(ValueError):
                d.authorization({**permission(), field: value}, COMMIT)

    def test_duplicate_json_fields_fail(self):
        with self.assertRaises(ValueError):
            json.loads('{"authorized":true,"authorized":false}', object_pairs_hook=d.unique_json_object)

    def test_exact_three_successor_modifications_and_all_history_pass(self):
        with patch.object(d, "git", side_effect=source_git()):
            d.source_guard(COMMIT)

    def test_extra_missing_renamed_modified_or_duplicate_inventory_fails(self):
        rows = ["M\t" + p for p in sorted(d.SUPPORT_FILES)]
        bad = [rows[:-1], rows + [rows[0]], rows + ["M\tjs/gridly-paid-ui.mjs"],
               ["A\t" + p for p in d.SUPPORT_FILES], rows + ["A\tunexpected.txt"], rows + ["M\t.github/workflows/gridly-storekit-signing-diagnostic.yml"],
               rows + ["M\t.github/workflows/gridly-storekit-testflight-delivery.yml"]]
        key = ("diff", "--name-status", "--no-renames", d.REPAIR, COMMIT)
        for value in bad:
            with self.subTest(value=value), patch.object(d, "git", side_effect=source_git(values={key: "\n".join(value).encode()})), self.assertRaises(ValueError):
                d.source_guard(COMMIT)

    def test_extra_commits_merges_wrong_parents_and_dirty_source_fail(self):
        for key, value in [
            (("rev-parse", "HEAD"), b"9"*40),
            (("show", "-s", "--format=%P", COMMIT), b"9"*40),
            (("show", "-s", "--format=%P", COMMIT), (d.REPAIR+" "+"9"*40).encode()),
            (("status", "--porcelain=v1", "--untracked-files=normal"), b"?? unexpected"),
            *[(("show", "-s", "--format=%P", child), b"9"*40) for child, _ in d.CHAIN],
            *[(("show", "-s", "--format=%P", child), (parent+" "+"9"*40).encode()) for child,parent in d.CHAIN],
        ]:
            with self.subTest(key=key), patch.object(d, "git", side_effect=source_git(values={key: value})), self.assertRaises(ValueError):
                d.source_guard(COMMIT)

    def test_every_historical_tag_object_type_target_and_missing_tag_fail(self):
        for name in d.HISTORY:
            ref = "refs/tags/" + name
            for key, value in (
                (("rev-parse", "--verify", ref), b"9"*40),
                (("cat-file", "-t", ref), b"commit"),
                (("rev-parse", "--verify", ref+"^{}"), COMMIT.encode()),
                (("rev-parse", "--verify", ref), subprocess.CalledProcessError(1, ["git"])),
            ):
                with self.subTest(tag=name, key=key), patch.object(d, "git", side_effect=source_git(values={key: value})), self.assertRaises((ValueError, subprocess.CalledProcessError)):
                    d.source_guard(COMMIT)

    def test_all_three_modes_must_remain_100644(self):
        for path in d.SUPPORT_FILES:
            for mode in ("100755", "120000"):
                key = ("ls-tree", COMMIT, "--", path)
                with self.subTest(path=path, mode=mode), patch.object(d, "git", side_effect=source_git(values={key: (mode+" blob "+"0"*40+"\t"+path).encode()})), self.assertRaises(ValueError):
                    d.source_guard(COMMIT)

    def test_reviewed_successor_constants_history_and_inventories_are_exact(self):
        import apple_storekit_testflight_delivery as frozen
        self.assertEqual(d.REPAIR,"17e36af1f5a8cc5f7f8ed927fb3e7fae758ee991")
        self.assertEqual((d.SOURCE,d.DELIVERY,d.OWNER,d.PREFLIGHT,d.BASE,d.SIGNING,d.CMS),
            ("f9fc818321970b8b7e29df17358daf87a7d20308","bd5b1feac696ba7db0e7d8d271b054df1d25850b",
             "45bfe026b81f4928caceb9632cbf15e7ed842a25","13e73183cf3f257fbc9acd9a32d34d62b70ffb1e",
             "4c95caed0d261fca1dbaf86fc926660661d0643b","db4df3949b1f02325b8869433bbbd16b234487db",
             "cbe3c297099dbca9c6d376848157de0253aeae39"))
        self.assertEqual(d.CHAIN,((d.REPAIR,d.CMS),(d.CMS,d.SIGNING),(d.SIGNING,d.BASE),
            (d.BASE,d.PREFLIGHT),(d.PREFLIGHT,d.OWNER),(d.OWNER,d.DELIVERY),(d.DELIVERY,d.SOURCE)))
        self.assertEqual(d.SUPPORT_FILES,{"tools/apple_storekit_signing_diagnostic.py",
            "tests/storekit-signing-diagnostic.test.py","tests/storekit-testflight-delivery.test.py"})
        self.assertEqual(d.DELIVERY_FILES,frozen.FILES)
        self.assertEqual(d.PREFLIGHT_FILES,frozen.PREFLIGHT_FILES)
        self.assertEqual(d.CMS_FILES,frozen.CMS_FILES)
        self.assertEqual(d.HISTORY,frozen.HISTORICAL_TAGS)
        self.assertEqual(d.HISTORICAL_INVENTORIES,(
            (d.SOURCE,d.DELIVERY,"A",d.DELIVERY_FILES),(d.DELIVERY,d.OWNER,"M",d.DELIVERY_FILES),
            (d.OWNER,d.PREFLIGHT,"A",d.PREFLIGHT_FILES),
            (d.PREFLIGHT,d.BASE,"M",d.DELIVERY_FILES|{"tests/storekit-preflight-diagnostic.test.py"}),
            (d.BASE,d.SIGNING,"A",d.FILES),(d.SIGNING,d.CMS,"A",d.CMS_FILES),
            (d.CMS,d.REPAIR,"M",d.DELIVERY_FILES|{"tests/storekit-signing-diagnostic.test.py"})))
        for child,parent in d.CHAIN:
            self.assertEqual(d.git("show","-s","--format=%P",child).decode().strip(),parent)
        for base,target,status,files in d.HISTORICAL_INVENTORIES:
            rows=d.git("diff","--name-status","--no-renames",base,target).decode().splitlines()
            self.assertEqual(set(rows),{status+"\t"+p for p in files})
            self.assertEqual(len(rows),len(files))
            for path in files:
                self.assertEqual(d.git("ls-tree",target,"--",path).decode().split()[0],"100644")

    def test_each_historical_inventory_and_mode_change_fails_closed(self):
        for base,target,status,files in d.HISTORICAL_INVENTORIES:
            rows=[status+"\t"+p for p in sorted(files)]
            key=("diff","--name-status","--no-renames",base,target)
            bad=[rows[:-1],rows+[rows[0]],rows+["M\tjs/gridly-paid-ui.mjs"],
                 [("M" if status=="A" else "A")+"\t"+p for p in sorted(files)]]
            for candidate in bad:
                with self.subTest(target=target),patch.object(d,"git",side_effect=source_git(values={
                        key:"\n".join(candidate).encode()})),self.assertRaises(ValueError):
                    d.source_guard(COMMIT)
            for path in files:
                key=("ls-tree",target,"--",path)
                for mode in ("100755","120000"):
                    with self.subTest(target=target,path=path,mode=mode),patch.object(d,"git",side_effect=source_git(values={
                            key:(mode+" blob "+"0"*40+"\t"+path).encode()})),self.assertRaises(ValueError):
                        d.source_guard(COMMIT)

    def test_only_source_authorization_changes_preserve_all_native_and_security_functions(self):
        baseline=d.git("show",d.REPAIR+":tools/apple_storekit_signing_diagnostic.py").decode()
        current=(ROOT/"tools/apple_storekit_signing_diagnostic.py").read_text()
        functions=lambda text:{n.name:ast.dump(n) for n in ast.parse(text).body if isinstance(n,ast.FunctionDef)}
        before,after=functions(baseline),functions(current)
        self.assertEqual(set(before),set(after))
        for name in before.keys()-{"source_guard"}:
            self.assertEqual(before[name],after[name],name)
        assignments=lambda text:{n.targets[0].id:n.value for n in ast.parse(text).body
            if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name)}
        before,after=assignments(baseline),assignments(current)
        self.assertEqual(set(after)-set(before),{"SOURCE","DELIVERY","OWNER","PREFLIGHT","SIGNING","CMS","REPAIR",
            "SUPPORT_FILES","DELIVERY_FILES","PREFLIGHT_FILES","CMS_FILES","HISTORICAL_INVENTORIES"})
        for name,value in before.items():
            if name=="CHAIN":
                self.assertEqual(ast.dump(value),ast.dump(ast.Tuple(elts=after[name].elts[3:],ctx=ast.Load())))
            elif name=="HISTORY":
                self.assertEqual(ast.dump(value),ast.dump(ast.Dict(keys=after[name].keys[:4],values=after[name].values[:4])))
            else:self.assertEqual(ast.dump(value),ast.dump(after[name]),name)

    def authorization_case(self, change=None, event_change=None, git_change=None):
        with tempfile.TemporaryDirectory(prefix="gridly-sign-auth-") as temporary:
            event_path = Path(temporary)/"event.json"
            event = {"repository": {"full_name": d.REPOSITORY}, "created": True, "deleted": False,
                     "forced": False, "ref": REF, "after": "2"*40}
            event.update(event_change or {})
            event_path.write_text(json.dumps(event))
            env = {"GITHUB_SHA": COMMIT, "GITHUB_REF": REF,
                   "GITHUB_REF_NAME": REF.removeprefix("refs/tags/"), "GITHUB_EVENT_PATH": str(event_path),
                   "GITHUB_RUN_ATTEMPT": "1", "GITHUB_EVENT_NAME": "push", "GITHUB_RUN_ID": "123456"}
            env.update(change or {})
            with patch.object(d, "git", side_effect=source_git(values=git_change or {})):
                return d.authorize(env)

    def test_annotated_exact_owner_tag_and_first_attempt_pass(self):
        self.assertEqual(self.authorization_case(), context())

    def test_branch_old_tags_reruns_and_wrong_events_rejected(self):
        for field, value in (("GITHUB_RUN_ATTEMPT", "2"), ("GITHUB_REF", "refs/heads/codex/storekit-diagnostics"),
                             ("GITHUB_REF", d.PREFIX+ d.BASE), ("GITHUB_EVENT_NAME", "workflow_dispatch"),
                             ("GITHUB_REF_NAME", "incorrect")):
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.authorization_case({field: value})
        for event in ({"created": False}, {"deleted": True}, {"forced": True},
                      {"after": "9"*40}, {"repository": {"full_name": "OTHER/REPO"}}):
            with self.subTest(event=event), self.assertRaises(ValueError):
                self.authorization_case(event_change=event)

    def test_lightweight_indirect_or_malformed_tags_rejected(self):
        for key, value in (
            (("cat-file", "-t", REF), b"commit"),
            (("cat-file", "-p", REF), b"object wrong\ntype tag\n\n{}"),
            (("rev-parse", "--verify", d.DIAGNOSTIC_BRANCH), b"9"*40),
        ):
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.authorization_case(git_change={key: value})


class SigningTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="gridly-synthetic-sign-")
        self.addCleanup(self.temporary.cleanup)
        self.root = fixture(Path(self.temporary.name))
        self.environment = {**test_environment(), **dict.fromkeys(d.INPUTS, CANARY)}

    def fake_shell(self, fail=None, mutate=None):
        def execute(args, **options):
            self.assertEqual(args, ["/bin/bash", "--noprofile", "--norc", "-e", "-o", "pipefail"])
            self.assertIs(options["capture_output"], True)
            self.assertIs(options["close_fds"], True)
            self.assertEqual(options["timeout"], 300)
            records = []
            for stage in d.SIGN_STAGES:
                passed = stage != fail
                records.append(d.record(stage, passed, "NONE" if passed else
                                        "INPUTS_MISSING" if stage == "S01" else "COMMAND_FAILED"))
                if not passed:
                    break
            if mutate:
                mutate(records)
            (self.root/"reports/signing-status.jsonl").write_text("".join(json.dumps(r)+"\n" for r in records))
            return subprocess.CompletedProcess(args, 1 if fail else 0, CANARY.encode(), CANARY.encode())
        return execute

    def test_actual_instrumented_shell_with_mocked_native_tools_and_every_failure_stage(self):
        # Execute the real stage/trap control flow. All macOS/crypto commands are
        # shell-function fakes; no signing key, certificate or profile is real.
        prefix = r'''
base64() {
  if test "$FAIL_STAGE" = S02; then return 1; fi
  cat
}
shasum() {
  cat >/dev/null
  if test "$FAIL_STAGE" = EMPTY_HASH; then return 0; fi
  if test "$FAIL_STAGE" = HASH_MISMATCH; then printf 'SYNTHETIC_%s -\n' "$BASHPID"; return 0; fi
  printf 'SYNTHETIC_HASH -\n'
}
openssl() {
  if test "$FAIL_STAGE" = "$current"; then
    case "$current:$1" in S03:pkey|S04:pkcs12|S05:pkcs12) return 1;; esac
  fi
  case "$1" in
    version) printf 'SYNTHETIC_PRIVATE_OPENSSL\n';;
    rand) printf 'SYNTHETIC_PASSWORD\n';;
    pkey|x509) printf 'SYNTHETIC_PUBLIC_KEY\n';;
    pkcs12)
      if test "$2" = -export; then
        while test "$#" -gt 0; do
          if test "$1" = -out; then shift; touch "$1"; break; fi
          shift
        done
      fi;;
    *) return 2;;
  esac
}
security() {
  if test "$FAIL_STAGE" = "$current"; then return 1; fi
  case "$1" in
    create-keychain) touch "${@: -1}";;
    cms) printf 'SYNTHETIC_PROFILE_CONTENT\n';;
    find-identity) printf '%s "%s"\n' "$EXPECTED_CERT" "$EXPECTED_AUTHORITY";;
    unlock-keychain|import|set-key-partition-list|list-keychains) return 0;;
    *) return 2;;
  esac
}
plistbuddy() {
  if test "$FAIL_STAGE" = S12; then return 1; fi
  case "$2" in
    'Print :Name') printf 'Gridly App Store Build 9\n';;
    'Print :UUID') printf '%s\n' "$EXPECTED_UUID";;
    'Print :TeamIdentifier:0') printf '%s\n' "$EXPECTED_TEAM";;
    'Print :Entitlements:application-identifier') printf '%s.%s\n' "$EXPECTED_TEAM" "$EXPECTED_BUNDLE";;
    *) return 2;;
  esac
}
cp() {
  if test "$FAIL_STAGE" = S13; then return 1; fi
  command cp "$@"
}
'''
        for failed in (None, *d.SIGN_STAGES, "HASH_MISMATCH", "EMPTY_HASH", "MISSING_CERT", "MISSING_PROFILE"):
            with self.subTest(stage=failed), tempfile.TemporaryDirectory(prefix="gridly-mocked-shell-") as temporary:
                root = fixture(Path(temporary))
                environment = {**self.environment, "FAIL_STAGE": failed or "",
                               "EXPECTED_CERT": d.release.CERT_SHA1,
                               "EXPECTED_AUTHORITY": d.release.AUTHORITY,
                               "EXPECTED_UUID": d.release.PROFILE_UUID,
                               "EXPECTED_TEAM": d.release.TEAM, "EXPECTED_BUNDLE": d.release.BUNDLE}
                expected_failure = "S03" if failed in {"HASH_MISMATCH", "EMPTY_HASH"} else "S01" if failed in {"MISSING_CERT", "MISSING_PROFILE"} else failed
                if expected_failure == "S01":
                    missing = 1 if failed == "MISSING_CERT" else 2 if failed == "MISSING_PROFILE" else 0
                    environment[d.INPUTS[missing]] = ""
                def execute(args, **options):
                    env = options["env"].copy()
                    for field in ("HOME", "CFFIXED_USER_HOME", "TMPDIR", "DIAGNOSTIC_PRIVATE_ROOT", "DELIVERY_SOURCE_DIR"):
                        env[field] = env[field].replace("\\", "/")
                    script = options["input"].decode().replace("/usr/libexec/PlistBuddy", "plistbuddy")
                    old = next(line for line in script.splitlines() if line.startswith('test "$PROFILE_UUID"'))
                    script = script.replace(old, 'test "$PROFILE_UUID" = "$EXPECTED_UUID"')
                    result = subprocess.run([BASH, "--noprofile", "--norc", "-e", "-o", "pipefail"],
                                            input=(prefix+script).encode(), env=env, cwd=options["cwd"],
                                            capture_output=True, close_fds=True, timeout=30)
                    return subprocess.CompletedProcess(args, result.returncode, result.stdout, result.stderr)
                records = d.run_signing(root, context(), environment, execute)[3:]
                if failed is None:
                    self.assertTrue(all(r["status"] == "PASS" for r in records), records)
                else:
                    index = d.SIGN_STAGES.index(expected_failure)
                    self.assertTrue(all(r["status"] == "PASS" for r in records[:index]))
                    self.assertEqual(records[index]["status"], "FAIL", records)
                    categories = dict(zip(d.SIGN_STAGES, (
                        "INPUTS_MISSING", "PRIVATE_KEY_DECODE_FAILED", "KEY_PUBLIC_DERIVATION_FAILED",
                        "PKCS12_EXPORT_FAILED", "PKCS12_PARSE_FAILED", "KEYCHAIN_CREATE_FAILED",
                        "KEYCHAIN_UNLOCK_FAILED", "CERTIFICATE_IMPORT_FAILED", "KEY_PARTITION_FAILED",
                        "SEARCH_LIST_FAILED", "PROFILE_DECODE_FAILED", "PROFILE_NAME_READ_FAILED",
                        "PROFILE_INSTALL_FAILED", "SIGNING_IDENTITY_UNAVAILABLE")))
                    expected_category = "KEY_CERTIFICATE_MISMATCH" if failed in {"HASH_MISMATCH", "EMPTY_HASH"} else categories[expected_failure]
                    self.assertEqual(records[index]["category"], expected_category)
                    self.assertTrue(all(r["category"] == "DEPENDENCY_FAILED" for r in records[index+1:]))

    def test_full_success_has_three_home_and_fourteen_signing_results(self):
        records = d.run_signing(self.root, context(), self.environment, self.fake_shell())
        self.assertEqual([r["stage"] for r in records], [*d.HOME_STAGES, *d.SIGN_STAGES])
        self.assertTrue(all(r["status"] == "PASS" for r in records))

    def test_second_signing_attempt_is_blocked(self):
        d.run_signing(self.root, context(), self.environment, self.fake_shell())
        with self.assertRaises(FileExistsError):
            d.run_signing(self.root, context(), self.environment, self.fake_shell())

    def test_timeout_preserves_exact_last_active_stage_without_raw_error(self):
        def timeout(*args, **options):
            (self.root/"reports/signing-status.jsonl").write_text("".join(json.dumps(d.record(s, True))+"\n" for s in d.SIGN_STAGES[:7]))
            (self.root/"reports/current-stage").write_text("S08\n")
            raise subprocess.TimeoutExpired(CANARY, 300, output=CANARY.encode())
        records = d.run_signing(self.root, context(), self.environment, timeout)
        self.assertEqual(records[10], d.record("S08", False, "COMMAND_FAILED"))
        self.assertTrue(all(r["category"] == "DEPENDENCY_FAILED" for r in records[11:]))

    def test_home_inconsistencies_prevent_all_native_operations(self):
        expected = d.child_environment(self.root, self.environment)
        for field in ("HOME", "CFFIXED_USER_HOME"):
            wrong = {**expected, field: "UNEXPECTED_HOME"}
            execute = MagicMock()
            with patch.object(d, "child_environment", return_value=wrong):
                records = d.run_signing(self.root, context(), self.environment, execute)
            execute.assert_not_called()
            self.assertTrue(any(r["category"] == "ENVIRONMENT_MISMATCH" for r in records))
            self.assertTrue(all(r["category"] == "DEPENDENCY_FAILED" for r in records[3:]))

    def test_missing_private_home_blocks_signing_with_fixed_home_failure(self):
        (self.root/"home").rmdir()
        execute = MagicMock()
        records = d.run_signing(self.root, context(), self.environment, execute)
        execute.assert_not_called()
        self.assertEqual(records[0]["category"], "ENVIRONMENT_MISMATCH")

    def test_private_environment_never_falls_back_to_original_home(self):
        env = d.child_environment(self.root, {"HOME": "RUNNER_ORIGINAL", "CFFIXED_USER_HOME": "OTHER"})
        self.assertEqual(env["HOME"], str(self.root/"home"))
        self.assertEqual(env["CFFIXED_USER_HOME"], str(self.root/"home"))

    def test_public_output_has_no_raw_values_paths_hashes_or_errors(self):
        records = d.run_signing(self.root, context(), self.environment, self.fake_shell("S08"))
        output = io.StringIO()
        d.emit(records, output)
        for token in (CANARY, str(self.root), "Traceback", d.release.CERT_SHA1, d.release.PROFILE_UUID):
            self.assertNotIn(token, output.getvalue())
        self.assertIn(CANARY.encode(), (self.root/"logs/signing-private.log").read_bytes())

    def test_malformed_private_status_cannot_reach_public_output(self):
        for mutation in (
            lambda rows: rows[0].update(raw=CANARY),
            lambda rows: rows[0].update(stage=CANARY),
            lambda rows: rows.reverse(),
        ):
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                d.run_signing(self.root, context(), self.environment, self.fake_shell(mutate=mutation))
            (self.root/"signing-attempted").unlink()

    def test_cross_stage_categories_cannot_misrepresent_signing_or_home_results(self):
        for stage, passed, category in (
            ("S01", True, "NOT_CREATED"), ("S03", False, "INPUTS_MISSING"),
            ("H01_HOME", False, "COMMAND_FAILED"), ("C01", False, "ENVIRONMENT_MISMATCH"),
        ):
            with self.subTest(stage=stage, category=category), self.assertRaises(ValueError):
                d.record(stage, passed, category)

    def test_emitter_rejects_entire_bad_batch_without_partial_output(self):
        valid = [d.record("S01", True), d.record("S02", True)]
        for patch_value in ({"status": CANARY}, {"category": CANARY}, {"stage": CANARY}, {"raw": CANARY}):
            rows = copy.deepcopy(valid); rows[-1].update(patch_value)
            output = io.StringIO()
            with self.assertRaises(ValueError):
                d.emit(rows, output)
            self.assertEqual(output.getvalue(), "")
        with self.assertRaises(ValueError):
            d.emit([valid[0], valid[0]], io.StringIO())


def stage_failure_test(stage):
    def test(self):
        records = d.run_signing(self.root, context(), self.environment, self.fake_shell(stage))
        signing = records[3:]
        index = d.SIGN_STAGES.index(stage)
        self.assertTrue(all(r["status"] == "PASS" for r in signing[:index]))
        self.assertEqual(signing[index]["status"], "FAIL")
        self.assertTrue(all(r["category"] == "DEPENDENCY_FAILED" for r in signing[index+1:]))
    return test

for _stage in d.SIGN_STAGES:
    setattr(SigningTests, "test_failure_" + _stage + "_blocks_all_dependent_stages", stage_failure_test(_stage))


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="gridly-synthetic-clean-")
        self.addCleanup(self.temporary.cleanup)
        self.root = fixture(Path(self.temporary.name))
        self.env = test_environment()
        self.calls = []
        self.profile = self.root/"home/Library/MobileDevice/Provisioning Profiles"/(d.release.PROFILE_UUID+".mobileprovision")

    def native(self, args, **options):
        self.calls.append(args)
        self.assertNotIn(d.INPUTS[0], options["env"])
        if args[:2] == ["security", "delete-keychain"]:
            Path(args[-1]).unlink()
        return subprocess.CompletedProcess(args, 0, b"", CANARY.encode())

    def material(self, profile=True, keychain=True):
        if profile:
            self.profile.parent.mkdir(parents=True)
            self.profile.write_text(CANARY)
            (self.root/"installed-profile").write_text(str(self.profile))
        if keychain:
            (self.root/"signing.keychain-db").write_text(CANARY)
            (self.root/"keychain-attempted").write_text("attempted")
        for name in d.TEMP_FILES:
            (self.root/name).write_text(CANARY)

    def test_full_cleanup_removes_each_owned_resource_and_verifies_absence(self):
        self.material()
        records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertEqual([r["stage"] for r in records], list(d.CLEAN_STAGES))
        self.assertTrue(all(r["status"] == "PASS" for r in records))
        self.assertFalse(self.root.exists())
        self.assertEqual(len(self.calls), 2)

    def test_cleanup_before_signing_creates_no_keychain_calls(self):
        records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertTrue(all(r["status"] == "PASS" for r in records))
        self.assertFalse(self.calls)

    def test_cleanup_after_partial_decode(self):
        (self.root/d.TEMP_FILES[0]).write_text(CANARY)
        records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertTrue(all(r["status"] == "PASS" for r in records))
        self.assertFalse(self.root.exists())

    def test_missing_workspace_reports_not_created(self):
        d.cleanup(self.root, context(), self.env, self.native)
        records = d.cleanup(self.root, context(), {**self.env, "SIGNING_STEP_OUTCOME": "skipped"}, self.native)
        self.assertTrue(all(r["status"] == "PASS" for r in records))
        self.assertEqual(records[1]["category"], "NOT_CREATED")
        self.assertEqual(records[4]["category"], "ABSENT_VERIFIED")

    def test_missing_workspace_after_possible_signing_does_not_claim_keychain_cleanup(self):
        d.cleanup(self.root, context(), self.env, self.native)
        for outcome in (None, "success", "failure", "cancelled", "UNTRUSTED"):
            env = {**self.env, "SIGNING_STEP_OUTCOME": outcome}
            records = d.cleanup(self.root, context(), env, self.native)
            self.assertEqual(records[1]["category"], "VERIFICATION_FAILED_ABSENT")
            self.assertEqual(records[4]["category"], "VERIFICATION_FAILED_ABSENT")

    def test_wrong_owner_blocks_all_mutations(self):
        self.material()
        (self.root/".owned").write_text("{}")
        with patch.object(d.shutil, "rmtree") as remove:
            records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertTrue(all(r["category"] == "OWNERSHIP_BLOCKED" for r in records))
        remove.assert_not_called()
        self.assertFalse(self.calls)
        self.assertTrue(self.profile.exists())

    def test_unowned_profile_or_keychain_is_not_removed(self):
        for target in ("profile", "keychain"):
            with self.subTest(target=target):
                with tempfile.TemporaryDirectory(prefix="gridly-unowned-") as temporary:
                    root = fixture(Path(temporary))
                    path = root/"signing.keychain-db" if target == "keychain" else root/"home/Library/MobileDevice/Provisioning Profiles"/(d.release.PROFILE_UUID+".mobileprovision")
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(CANARY)
                    records = d.cleanup(root, context(), self.env, self.native)
                    self.assertTrue(path.exists())
                    self.assertEqual(records[3]["category"], "OWNERSHIP_BLOCKED")
                    self.assertEqual(records[4]["category"], "OWNERSHIP_BLOCKED")

    def test_keychain_error_remains_failure_even_when_workspace_is_removed(self):
        self.material()
        def fail(args, **options):
            return subprocess.CompletedProcess(args, 1, CANARY.encode(), CANARY.encode())
        records = d.cleanup(self.root, context(), self.env, fail)
        self.assertEqual(records[1]["status"], "FAIL")
        self.assertEqual(records[3]["status"], "PASS")
        self.assertEqual(records[4]["category"], "VERIFICATION_FAILED_ABSENT")
        self.assertFalse(self.root.exists())

    def test_keychain_nonzero_after_removal_is_distinct_from_remaining_file(self):
        self.material()
        def fail_after_removal(args, **options):
            if args[:2] == ["security", "delete-keychain"]:
                Path(args[-1]).unlink()
                return subprocess.CompletedProcess(args, 1, b"", CANARY.encode())
            return subprocess.CompletedProcess(args, 0, b"", b"")
        records = d.cleanup(self.root, context(), self.env, fail_after_removal)
        self.assertEqual(records[1]["category"], "VERIFICATION_FAILED_ABSENT")
        self.assertEqual(records[4]["status"], "PASS")
        self.assertFalse(all(r["status"] == "PASS" for r in records))

    def test_search_list_residue_or_unparseable_result_is_not_success(self):
        for output in (('"'+str(self.root/"signing.keychain-db")+'"').encode(), b'"unterminated'):
            with tempfile.TemporaryDirectory(prefix="gridly-search-residue-") as temporary:
                root = fixture(Path(temporary))
                (root/"keychain-attempted").write_text("attempted")
                def residue(*args, **options):
                    return subprocess.CompletedProcess(args[0], 0, output.replace(str(self.root).encode(), str(root).encode()), b"")
                records = d.cleanup(root, context(), self.env, residue)
                self.assertEqual(records[1]["category"], "VERIFICATION_FAILED")
                self.assertEqual(records[4]["category"], "VERIFICATION_FAILED_ABSENT")

    def test_directory_removal_failure_and_false_success_are_distinguished(self):
        self.material(profile=False, keychain=False)
        with patch.object(d.shutil, "rmtree", side_effect=PermissionError(CANARY)):
            records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertEqual(records[3]["category"], "REMOVAL_FAILED")
        self.assertEqual(records[4]["category"], "REMOVAL_FAILED")
        with patch.object(d.shutil, "rmtree"):
            records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertEqual(records[3]["category"], "REMOVAL_FAILED")

    def test_directory_exception_after_successful_removal_stays_failed(self):
        original = d.shutil.rmtree
        def removed_then_error(path):
            original(path)
            raise OSError(CANARY)
        with patch.object(d.shutil, "rmtree", side_effect=removed_then_error):
            records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertEqual(records[3]["category"], "VERIFICATION_FAILED_ABSENT")
        self.assertEqual(records[4]["status"], "PASS")

    def test_temp_removal_error_survives_successful_later_tree_removal(self):
        self.material(profile=False, keychain=False)
        original = Path.unlink
        def deny(path, *args, **kwargs):
            if path.name == d.TEMP_FILES[0]:
                raise PermissionError(CANARY)
            return original(path, *args, **kwargs)
        with patch.object(Path, "unlink", deny):
            records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertEqual(records[2]["category"], "REMOVAL_FAILED")
        self.assertEqual(records[3]["status"], "PASS")

    def test_original_trap_error_is_reported_even_if_files_are_now_absent(self):
        (self.root/"reports/temporary-trap-exit").write_text("1\n")
        records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertEqual(records[2]["category"], "VERIFICATION_FAILED_ABSENT")
        self.assertEqual(records[4]["status"], "PASS")

    def test_partial_workspace_initialization_can_be_removed_without_native_calls(self):
        for name in ("logs", "reports", "tmp"):
            (self.root/name/"context.json").unlink(missing_ok=True)
            (self.root/name).rmdir()
        records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertTrue(all(r["status"] == "PASS" for r in records))
        self.assertFalse(self.calls)
        self.assertFalse(self.root.exists())

    def test_profile_unlink_failure_is_distinct_from_final_absence(self):
        self.material(profile=True, keychain=False)
        original = Path.unlink
        def deny(path, *args, **kwargs):
            if path == self.profile:
                raise PermissionError(CANARY)
            return original(path, *args, **kwargs)
        with patch.object(Path, "unlink", deny):
            records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertEqual(records[0]["category"], "REMOVAL_FAILED")
        self.assertEqual(records[3]["status"], "PASS")
        self.assertEqual(records[4]["status"], "PASS")

    def test_profile_ancestor_symlink_blocks_unrelated_resource_removal(self):
        self.material(profile=True, keychain=False)
        original = Path.is_symlink
        ancestor = self.root/"home/Library"
        with patch.object(Path, "is_symlink", lambda path: path == ancestor or original(path)):
            records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertEqual(records[0]["category"], "OWNERSHIP_BLOCKED")
        self.assertEqual(records[3]["category"], "OWNERSHIP_BLOCKED")
        self.assertTrue(self.profile.exists())

    def test_profile_marker_and_keychain_attempt_marker_must_be_exact(self):
        self.material()
        (self.root/"installed-profile").write_text("UNRELATED_PROFILE")
        (self.root/"keychain-attempted").write_text("UNRELATED_KEYCHAIN")
        records = d.cleanup(self.root, context(), self.env, self.native)
        self.assertEqual(records[0]["category"], "OWNERSHIP_BLOCKED")
        self.assertEqual(records[1]["category"], "OWNERSHIP_BLOCKED")
        self.assertFalse(self.calls)
        self.assertTrue(self.profile.exists())
        self.assertTrue((self.root/"signing.keychain-db").exists())

    def test_cleanup_public_results_exclude_private_output(self):
        self.material()
        records = d.cleanup(self.root, context(), self.env, self.native)
        output = io.StringIO(); d.emit(records, output)
        for value in (CANARY, str(self.root), d.release.PROFILE_UUID, "security"):
            self.assertNotIn(value, output.getvalue())


class ExecutionAndWorkflowTests(unittest.TestCase):
    def test_prepare_only_clones_pinned_local_source_without_credentials(self):
        with tempfile.TemporaryDirectory(prefix="gridly-sign-prepare-") as temporary:
            root = d.workspace(temporary, "123456")
            calls = []
            def execute(args, **options):
                self.assertTrue(all(key not in options["env"] for key in d.INPUTS))
                calls.append(args)
                return subprocess.CompletedProcess(args, 0, COMMIT.encode() if args[:2] == ["git", "rev-parse"] else b"", CANARY.encode())
            env = {**test_environment(), **dict.fromkeys(d.INPUTS, CANARY), "GITHUB_WORKSPACE": str(ROOT)}
            d.prepare(root, context(), env, execute)
            self.assertEqual(len(calls), 2)
            self.assertEqual(calls[0][:4], ["git", "clone", "--no-hardlinks", "--branch"])
            self.assertEqual(calls[0][4], REF.removeprefix("refs/tags/"))
            d.owned(root, context())
            self.assertEqual(json.loads((root/"reports/context.json").read_text()), context())

    def test_failed_clone_or_wrong_cloned_sha_can_be_cleaned_without_signing(self):
        for clone_failure in (True, False):
            with tempfile.TemporaryDirectory(prefix="gridly-sign-prepare-fail-") as temporary:
                root = d.workspace(temporary, "123456")
                def execute(args, **options):
                    return subprocess.CompletedProcess(args, 1 if clone_failure else 0, b"WRONG_SHA", CANARY.encode())
                with self.assertRaises(ValueError):
                    d.prepare(root, context(), {"GITHUB_WORKSPACE": str(ROOT)}, execute)
                native = MagicMock()
                records = d.cleanup(root, context(), {}, native)
                self.assertTrue(all(r["status"] == "PASS" for r in records))
                native.assert_not_called()

    def test_prepare_never_reuses_existing_workspace(self):
        with tempfile.TemporaryDirectory(prefix="gridly-sign-no-reuse-") as temporary:
            root = fixture(Path(temporary))
            with self.assertRaises(ValueError):
                d.prepare(root, context(), {}, MagicMock())

    def test_generated_shell_and_three_workflow_blocks_parse(self):
        subprocess.run([BASH, "-n"], input=d.signing_script(), text=True, capture_output=True, check=True)
        workflow = (ROOT/".github/workflows/gridly-storekit-signing-diagnostic.yml").read_text()
        blocks = re.findall(r"        run: \|\n((?:(?:          .*)?\n)+)", workflow)
        self.assertEqual(len(blocks), 3)
        for block in blocks:
            subprocess.run([BASH, "-n"], input="\n".join(s[10:] for s in block.splitlines())+"\n", text=True, capture_output=True, check=True)

    def test_original_signing_commands_are_retained_in_order(self):
        path = ".github/workflows/gridly-storekit-testflight-delivery.yml"
        baseline = subprocess.check_output(["git", "show", d.BASE+":"+path], cwd=ROOT).decode()
        checkpoint = "cbe3c297099dbca9c6d376848157de0253aeae39"
        historical = subprocess.check_output(["git", "show", checkpoint+":"+path], cwd=ROOT).decode()
        def signing_section(text):
            return text.split("      - name: Install distribution signing\n", 1)[1].split("      - name: Archive and export", 1)[0]
        section = signing_section(baseline)
        self.assertEqual(section, signing_section(historical))
        original = 'security cms -D -i "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" > "$DIAGNOSTIC_PRIVATE_ROOT/profile.plist"'
        repaired = 'security cms -D -k "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" -i "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" > "$DIAGNOSTIC_PRIVATE_ROOT/profile.plist"'
        self.assertEqual(section.count(original), 1)
        expected = section.replace(original, repaired)
        current = signing_section((ROOT/path).read_text())
        def validate(candidate):
            self.assertEqual(candidate, expected)
            self.assertEqual(candidate.count(repaired), 1)
            self.assertNotIn(original, candidate)
            keychain = '"$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db"'
            commands = [line.strip() for line in candidate.splitlines() if line.strip().startswith("security ")]
            setup = [next(line for line in commands if line.startswith("security "+operation))
                     for operation in ("create-keychain ", "unlock-keychain ", "import ")]
            positions = [candidate.index(line) for line in setup] + [candidate.index(repaired)]
            self.assertEqual(positions, sorted(positions))
            for line in setup:
                self.assertIn(keychain, line)
        validate(current)
        for mutant in (section, expected.replace("security unlock-keychain", "security lock-keychain"),
                       expected.replace(repaired, repaired.replace("signing.keychain-db", "other.keychain-db")),
                       expected.replace(repaired, repaired.replace("distribution.mobileprovision", "other.mobileprovision")),
                       expected.replace(repaired, repaired.replace("profile.plist", "other.plist")),
                       expected + "          security list-keychains\n",
                       expected.replace("          security unlock-keychain", "          # security unlock-keychain")):
            with self.subTest(mutant="bounded signing mutation"), self.assertRaises(AssertionError):
                validate(mutant)
        script = d.signing_script()
        commands = [line[10:] for line in expected.splitlines() if line.startswith("          ") and line[10:].startswith(
            ("security ", "openssl ", "KEY_PUBLIC_SHA=", "CERT_PUBLIC_SHA=", "PROFILE_NAME=", "PROFILE_UUID=", "TEAM_ID=", "APP_ID="))]
        position = 0
        for command in commands:
            position = script.index(command, position) + len(command)
        self.assertEqual(len(re.findall(r"^next_stage S[0-9]+$", script, re.M)), 14)

    def test_no_application_build_export_upload_or_network_path(self):
        source = (ROOT/"tools/apple_storekit_signing_diagnostic.py").read_text()
        script = d.signing_script()
        for forbidden in ("xcodebuild", "xcrun", "--upload-app", "--validate-app", "urlopen", "requests.",
                          "import urllib", "npm ", "npx ", "pod install", "codesign --sign"):
            self.assertNotIn(forbidden, source + script)
        self.assertIn('choices=("prepare", "sign", "cleanup")', source)

    def test_workflow_is_separate_tag_only_first_attempt_before_secrets(self):
        workflow = (ROOT/".github/workflows/gridly-storekit-signing-diagnostic.yml").read_text()
        trigger = workflow.split("\non:\n",1)[1].split("\npermissions:",1)[0].strip()
        self.assertEqual(trigger, "push:\n    tags:\n      - 'gridly-storekit-signing-diagnostic-15-*'")
        self.assertIn("github.run_attempt == 1", workflow)
        self.assertIn("github.event.created == true", workflow)
        self.assertIn("github.event.deleted == false", workflow)
        self.assertIn("github.event.forced == false", workflow)
        self.assertLess(workflow.index("diagnostic.py prepare"), workflow.index("secrets."))
        self.assertIn("runs-on: macos-26", workflow)
        self.assertIn("timeout-minutes: 15", workflow)
        self.assertIn("if: always()", workflow)
        self.assertIn("persist-credentials: false", workflow)
        self.assertIn("contents: read", workflow)
        for forbidden in ("upload-artifact", "download-artifact", "actions/cache", "GITHUB_ENV", "ASC_", "workflow_dispatch:", "workflow_call:"):
            self.assertNotIn(forbidden, workflow)
        self.assertEqual(re.findall(r"uses: (.+)", workflow), ["actions/checkout@v4"])

    def test_older_tags_and_branch_pushes_cannot_match_new_workflow(self):
        import fnmatch
        pattern = d.PREFIX.removeprefix("refs/tags/") + "*"
        for name in [*d.HISTORY, "codex/storekit-diagnostics"]:
            if fnmatch.fnmatchcase(name, pattern):
                # The immutable old signing tag shares the filter, but its source
                # and sole parent cannot authorize this exact repaired successor.
                self.assertEqual(d.HISTORY[name][1],d.SIGNING)
                old=d.HISTORY[name][1]
                changes={("rev-parse","HEAD"):old.encode(),
                         ("show","-s","--format=%P",old):d.BASE.encode()}
                with patch.object(d,"git",side_effect=source_git(values=changes)),self.assertRaises(ValueError):
                    d.source_guard(old)
            else:
                self.assertFalse(fnmatch.fnmatchcase(name, pattern))
        self.assertTrue(fnmatch.fnmatchcase(REF.removeprefix("refs/tags/"), pattern))

    def test_no_path_exports_or_parent_home_mutation(self):
        source = (ROOT/"tools/apple_storekit_signing_diagnostic.py").read_text()
        self.assertNotIn('environment["HOME"] =', source)
        workflow = (ROOT/".github/workflows/gridly-storekit-signing-diagnostic.yml").read_text()
        self.assertNotRegex(workflow, r"^\s+(?:HOME|CFFIXED_USER_HOME|DIAGNOSTIC_PRIVATE_ROOT):")

    def test_main_denies_native_or_credential_access_before_authorization(self):
        environment = {"GITHUB_ACTIONS": "true", "RUNNER_OS": "macOS", "GITHUB_RUN_ATTEMPT": "1",
                       "RUNNER_TEMP": tempfile.gettempdir(), "GITHUB_RUN_ID": "123456", "GITHUB_SHA": COMMIT}
        with patch.dict(os.environ, environment, clear=True), patch.object(d, "authorize", side_effect=ValueError(CANARY)), patch.object(d, "run_signing") as signing, contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(d.main(["sign"]), 1)
        signing.assert_not_called()
        self.assertNotIn(CANARY, output.getvalue())

    def test_real_local_context_cannot_execute_native_modes(self):
        for mode in ("prepare", "sign", "cleanup"):
            with patch.dict(os.environ, {}, clear=True), patch.object(d, "captured") as execute, contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(d.main([mode]), 1)
            execute.assert_not_called()

    def test_timeout_kills_only_new_owned_process_group(self):
        process = MagicMock(pid=12345, returncode=-9)
        process.communicate.side_effect = [subprocess.TimeoutExpired(CANARY, 1), (b"", b"")]
        with patch.object(d.subprocess, "Popen", return_value=process) as popen, patch.object(d.os, "killpg", create=True) as kill, patch.object(d.signal, "SIGKILL", 9, create=True):
            with self.assertRaises(subprocess.TimeoutExpired):
                d.captured(["SYNTHETIC"], capture_output=True, close_fds=True, check=False, timeout=1)
        self.assertIs(popen.call_args.kwargs["start_new_session"], True)
        kill.assert_called_once_with(12345, 9)

    def test_workspace_rejects_root_invalid_run_ids_and_existing_symlinks(self):
        for run in ("0", "../123", "123\n", "1"*21, ""):
            with self.subTest(run=run), self.assertRaises(ValueError):
                d.workspace(tempfile.gettempdir(), run)
        with self.assertRaises(ValueError):
            d.workspace(Path(tempfile.gettempdir()).anchor, "123456")

    def test_existing_tracked_runtime_workflows_and_baseline_are_unchanged(self):
        checkpoint = "17e36af1f5a8cc5f7f8ed927fb3e7fae758ee991"
        authorized = {"tools/apple_storekit_signing_diagnostic.py",
                      "tests/storekit-testflight-delivery.test.py",
                      "tests/storekit-signing-diagnostic.test.py"}
        def git(*args):
            return subprocess.check_output(["git", *args], cwd=ROOT).decode().strip()
        expected = {"M\t"+path for path in authorized}
        def validate(head, parents, records, modes, dirty, staged, untracked):
            self.assertFalse(staged)
            self.assertFalse(untracked)
            self.assertEqual(set(records), expected)
            self.assertEqual(len(records), 3)
            self.assertEqual(modes, dict.fromkeys(authorized, "100644"))
            if head == checkpoint:
                self.assertIsNone(parents)
                self.assertEqual(dirty, records)
            else:
                self.assertEqual(parents, checkpoint)
                self.assertFalse(dirty)
        head = git("rev-parse", "HEAD")
        precommit = head == checkpoint
        records = git("diff", "--name-status", "--no-renames", checkpoint).splitlines()
        dirty = git("diff", "--name-status", "--no-renames", "HEAD").splitlines()
        modes = {}
        for path in authorized:
            entry = git("ls-files", "--stage", "--", path).split()
            self.assertEqual(entry[2], "0")
            modes[path] = entry[0]
            self.assertEqual(git("ls-tree", head, "--", path).split()[0], "100644")
        parents = None if precommit else git("show", "-s", "--format=%P", head)
        validate(head, parents, records, modes, dirty,
                 git("diff", "--cached", "--name-only"), git("ls-files", "--others", "--exclude-standard"))
        if not precommit:
            d.source_guard(head)
        # Negative cases exercise both exact candidate scope and postcommit cleanliness.
        valid = dict(head="1"*40, parents=checkpoint, records=sorted(expected),
                     modes=dict.fromkeys(authorized, "100644"), dirty=[], staged="", untracked="")
        mutations = [
            {"records":sorted(expected)[:-1]}, {"records":sorted(expected)+[sorted(expected)[0]]},
            {"records":sorted(expected)+["M\tjs/gridly-paid-ui.mjs"]},
            {"records":[line.replace("M\t","A\t") for line in sorted(expected)]},
            {"parents":checkpoint+" "+"2"*40}, {"parents":"2"*40},
            {"dirty":["M\t"+next(iter(authorized))]}, {"staged":"unexpected"}, {"untracked":"unexpected"},
            {"modes":dict.fromkeys(authorized,"100755")},
            {"head":checkpoint,"parents":None,"dirty":[]},
        ]
        for mutation in mutations:
            with self.subTest(mutation=mutation), self.assertRaises(AssertionError):
                validate(**{**valid,**mutation})
        # The original historical signing workflow/helper and test snapshot remain pinned.
        signing = "db4df3949b1f02325b8869433bbbd16b234487db"
        for path in (".github/workflows/gridly-storekit-signing-diagnostic.yml",
                     "tools/apple_storekit_signing_diagnostic.py", "tests/storekit-signing-diagnostic.test.py"):
            historical = subprocess.check_output(["git","show",signing+":"+path],cwd=ROOT)
            historical_checkpoint = "cbe3c297099dbca9c6d376848157de0253aeae39" if path == "tests/storekit-signing-diagnostic.test.py" else checkpoint
            self.assertEqual(historical, subprocess.check_output(["git","show",historical_checkpoint+":"+path],cwd=ROOT))
            if path == ".github/workflows/gridly-storekit-signing-diagnostic.yml":
                self.assertEqual((ROOT/path).read_bytes().replace(b"\r\n",b"\n"),historical)
        protected = [".github/workflows/gridly-apple-build-9.yml", "tools/apple_native_parity.py",
                     "ios/App/App/GridlyStoreKitPlugin.swift", "js/gridly-apple-storekit.mjs",
                     "js/gridly-paid-access.mjs", "js/gridly-paid-ui.mjs",
                     "tools/apple_storekit_diagnostic_certification.py",
                     "tests/build13-native-pending-recovery.test.cjs"]
        for path in protected:
            expected = subprocess.check_output(["git","show",d.BASE+":"+path],cwd=ROOT)
            self.assertEqual((ROOT/path).read_bytes().replace(b"\r\n",b"\n"), expected.replace(b"\r\n",b"\n"),path)

    def test_python_sources_parse(self):
        ast.parse((ROOT/"tools/apple_storekit_signing_diagnostic.py").read_text())
        ast.parse(Path(__file__).read_text())


if __name__ == "__main__":
    unittest.main()
