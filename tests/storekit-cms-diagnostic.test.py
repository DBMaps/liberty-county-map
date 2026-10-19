"""Synthetic tests only: no real secrets, Apple calls or macOS signing execution."""
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
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import apple_storekit_cms_diagnostic as d

COMMIT = "1" * 40
CANARY = "SYNTHETIC_PRIVATE_VALUE_NEVER_PUBLIC"
PROFILE = b"\x30\x10SYNTHETIC_CMS_ONLY"


def permission():
    return {"cms_diagnostic_commit": COMMIT, "signing_source_commit": d.BASE,
            "failed_signing_run_id": 39202397418, **dict.fromkeys(d.CONFIRMATIONS, True)}


def context():
    return {"source_commit": COMMIT, "run_id": "123456", "authorization": permission()}


def fixture(parent):
    runner = Path(parent) / "runner-home"
    runner.mkdir()
    default = runner / "synthetic-default.keychain-db"
    default.write_bytes(b"NO_REAL_KEYCHAIN")
    env = {"HOME": str(runner), "PATH": "/synthetic/bin", "USER": "synthetic"}
    root = d.workspace(parent, context()["run_id"])
    d.prepare(root, context(), env)
    return root, {**env, d.SECRET: "SYNTHETIC_BASE64_ONLY"}


class Native:
    """Models shared/different native search lists without invoking any tool."""
    def __init__(self, root, *, private_fail=False, restricted_fail=False):
        self.root = root
        state = d.load_state(root)
        self.envs = state["contexts"]
        self.original = {"runner": [str(Path(self.envs["runner"]["HOME"]) / "synthetic-default.keychain-db")],
                         "private": []}
        self.lists = copy.deepcopy(self.original)
        self.calls = []
        self.inputs = []
        self.private_fail = private_fail
        self.restricted_fail = restricted_fail
        self.structure_code = 0
        self.decode_code = 0
        self.profile = PROFILE
        self.restore_code = 0
        self.delete_code = 0
        self.create_code = 0
        self.help_output = b"-cmsout -noout -inform"
        self.cms_error = b"security: cert import failed " + CANARY.encode()
        self.tamper = False
        self.timeout_cms = False

    def __call__(self, args, *, input=None, env, **options):
        self.calls.append((list(args), dict(env)))
        self.assert_environment(env)
        self.assert_options(options)
        name = "private" if env["HOME"] == self.envs["private"]["HOME"] else "runner"
        code, out, err = 0, b"", b""
        if args[0] == "/usr/bin/base64":
            self.inputs.append(input)
            code, out = self.decode_code, self.profile
        elif args[0].endswith("openssl"):
            if "-help" in args: out = self.help_output
            else: code = self.structure_code
        elif args[1] == "list-keychains":
            if "-s" in args:
                requested = args[args.index("-s")+1:]
                if requested == self.original[name] and self.restore_code:
                    code = self.restore_code
                else: self.lists[name] = list(requested)
            else: out = "".join('"' + p + '"\n' for p in self.lists[name]).encode()
        elif args[1] == "default-keychain":
            out = ('"' + self.original["runner"][0] + '"\n').encode()
        elif args[1] == "create-keychain":
            code = self.create_code
            if not code:
                Path(args[-1]).write_bytes(b"OWNED_SYNTHETIC_KEYCHAIN")
                self.lists[name].append(args[-1])
        elif args[1] == "unlock-keychain": pass
        elif args[1] == "delete-keychain":
            code = self.delete_code
            if not code:
                Path(args[-1]).unlink(missing_ok=True)
                for key in self.lists:
                    self.lists[key] = [p for p in self.lists[key] if p != args[-1]]
        elif args[1] == "cms":
            if self.timeout_cms: raise subprocess.TimeoutExpired(args, 30, output=CANARY)
            path = Path(args[args.index("-i")+1])
            self.inputs.append(path.read_bytes())
            restricted = self.lists[name] == [str(self.root / "cms.keychain-db")]
            if (name == "private" and self.private_fail) or (restricted and self.restricted_fail):
                code, err = 1, self.cms_error
            else: out = __import__("plistlib").dumps({"Synthetic": CANARY})
            if self.tamper: path.chmod(0o600); path.write_bytes(b"CHANGED")
        else: raise AssertionError("Unexpected synthetic native command")
        return subprocess.CompletedProcess(args, code, out, err)

    @staticmethod
    def assert_environment(env):
        assert d.SECRET not in env and "GITHUB_TOKEN" not in env
        assert "APPLE_DIST_CERT_PEM_BASE64" not in env and "APPLE_DIST_PRIVATE_KEY_PEM_BASE64" not in env
        assert "BASH_ENV" not in env and "DYLD_INSERT_LIBRARIES" not in env

    @staticmethod
    def assert_options(options):
        assert options["capture_output"] is True and options["close_fds"] is True
        assert options["check"] is False and options["timeout"] == 30


def native_git():
    ref = d.PREFIX + COMMIT
    values = {
        ("rev-parse", "HEAD"): COMMIT.encode(),
        ("show", "-s", "--format=%P", COMMIT): d.BASE.encode(),
        ("show", "-s", "--format=%P", d.BASE): d.signing.BASE.encode(),
        ("diff", "--name-status", "--no-renames", d.BASE, COMMIT):
            "\n".join("A\t" + p for p in sorted(d.FILES)).encode(),
        ("status", "--porcelain=v1", "--untracked-files=all"): b"",
        ("rev-parse", "--verify", d.signing.DIAGNOSTIC_BRANCH): COMMIT.encode(),
        ("cat-file", "-t", ref): b"tag",
        ("rev-parse", "--verify", ref): b"2" * 40,
        ("cat-file", "-p", ref): ("object " + COMMIT + "\ntype commit\ntag " +
                                  ref.removeprefix("refs/tags/") + "\ntagger synthetic\n\n" +
                                  json.dumps(permission())).encode(),
    }
    for child, parent in d.signing.CHAIN:
        values[("show", "-s", "--format=%P", child)] = parent.encode()
    for f in d.FILES:
        values[("ls-tree", COMMIT, "--", f)] = ("100644 blob " + "0"*40 + "\t" + f).encode()
    for name, (obj, target) in d.HISTORY.items():
        ref = "refs/tags/" + name
        values[("cat-file", "-t", ref)] = b"tag"
        values[("rev-parse", "--verify", ref)] = obj.encode()
        values[("rev-parse", "--verify", ref + "^{}")] = target.encode()
    return values


class ContractTests(unittest.TestCase):
    def test_exact_permission(self):
        self.assertEqual(d.authorization(permission(), COMMIT), permission())

    def test_missing_permissions_fail(self):
        for key in d.AUTH_FIELDS:
            v = permission(); del v[key]
            with self.subTest(key=key), self.assertRaises(ValueError): d.authorization(v, COMMIT)

    def test_nonboolean_permissions_fail(self):
        for key in d.CONFIRMATIONS:
            for value in (False, 1, "true", None):
                with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                    d.authorization({**permission(), key: value}, COMMIT)

    def test_extra_permissions_fail(self):
        with self.assertRaises(ValueError): d.authorization({**permission(), "upload_authorized": True}, COMMIT)

    def test_wrong_source_and_run_fail(self):
        for key, value in (("cms_diagnostic_commit", "3"*40), ("signing_source_commit", COMMIT),
                           ("failed_signing_run_id", 39202397419), ("failed_signing_run_id", True),
                           ("failed_signing_run_id", "39202397418")):
            with self.subTest(key=key), self.assertRaises(ValueError):
                d.authorization({**permission(), key: value}, COMMIT)

    def test_duplicate_fields_fail(self):
        with self.assertRaises(ValueError):
            json.loads('{"cms_only_authorized":true,"cms_only_authorized":false}',
                       object_pairs_hook=d.unique_json_object)

    def test_source_exact_child(self):
        values = native_git()
        with patch.object(d, "git", side_effect=lambda *args: values[args]):
            d.source_guard(COMMIT)

    def test_source_rejects_parent_inventory_modes_dirty_and_history(self):
        cases = [
            (("show", "-s", "--format=%P", COMMIT), b"3"*40),
            (("diff", "--name-status", "--no-renames", d.BASE, COMMIT), b"M\tjs/gridly-paid-ui.mjs"),
            (("ls-tree", COMMIT, "--", sorted(d.FILES)[0]), b"100755 blob x\tfile"),
            (("status", "--porcelain=v1", "--untracked-files=all"), b"?? extra"),
            (("rev-parse", "--verify", "refs/tags/" + next(iter(d.HISTORY))), b"3"*40),
            (("show", "-s", "--format=%P", d.BASE), b"3"*40),
        ]
        for key, value in cases:
            values = native_git(); values[key] = value
            with self.subTest(key=key), patch.object(d, "git", side_effect=lambda *a: values[a]), self.assertRaises(ValueError):
                d.source_guard(COMMIT)

    def authorized_env(self, td, **updates):
        ref = d.PREFIX + COMMIT
        event = {"repository": {"full_name": d.signing.REPOSITORY}, "created": True,
                 "deleted": False, "forced": False, "ref": ref, "after": "2"*40}
        event.update(updates.pop("event", {}))
        path = Path(td)/"event.json";path.write_text(json.dumps(event))
        env = {"GITHUB_SHA": COMMIT, "GITHUB_REF": ref, "GITHUB_REF_NAME": ref.removeprefix("refs/tags/"),
               "GITHUB_RUN_ATTEMPT": "1", "GITHUB_RUN_ID": "123456", "GITHUB_EVENT_NAME": "push",
               "GITHUB_EVENT_PATH": str(path)}
        env.update(updates)
        return env

    def test_annotated_authorization(self):
        with tempfile.TemporaryDirectory() as td:
            env = self.authorized_env(td); values = native_git()
            with patch.object(d, "git", side_effect=lambda *a: values[a]):
                self.assertEqual(d.authorize(env)["authorization"], permission())

    def test_wrong_event_ref_attempt_branch_or_lightweight_tag_fail(self):
        for change in ({"GITHUB_RUN_ATTEMPT": "2"}, {"GITHUB_EVENT_NAME": "workflow_dispatch"},
                       {"GITHUB_REF": "refs/heads/codex/storekit-diagnostics"},
                       {"GITHUB_REF_NAME": "old-delivery-tag"},
                       {"event": {"created": False}}, {"event": {"deleted": True}},
                       {"event": {"forced": True}}, {"event": {"after": "3"*40}},
                       {"event": {"repository": {"full_name": "OTHER/REPO"}}}):
            with tempfile.TemporaryDirectory() as td:
                values = native_git(); env = self.authorized_env(td, **change)
                with self.subTest(change=change), patch.object(d, "git", side_effect=lambda *a: values[a]), self.assertRaises(ValueError):
                    d.authorize(env)
        with tempfile.TemporaryDirectory() as td:
            env = self.authorized_env(td); values = native_git()
            for key, value in ((("cat-file", "-t", d.PREFIX+COMMIT), b"commit"),
                               (("rev-parse", "--verify", d.signing.DIAGNOSTIC_BRANCH), b"3"*40)):
                bad = dict(values); bad[key] = value
                with patch.object(d, "git", side_effect=lambda *a: bad[a]), self.assertRaises(ValueError): d.authorize(env)

    def test_nested_tag_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            env = self.authorized_env(td); values = native_git()
            key = ("cat-file", "-p", d.PREFIX+COMMIT)
            values[key] = values[key].replace(b"type commit", b"type tag")
            with patch.object(d, "git", side_effect=lambda *a: values[a]), self.assertRaises(ValueError): d.authorize(env)

    def test_ci_requires_macos_actions_attempt_one(self):
        for env in ({}, {"GITHUB_ACTIONS": "true", "RUNNER_OS": "Windows", "GITHUB_RUN_ATTEMPT": "1"},
                    {"GITHUB_ACTIONS": "true", "RUNNER_OS": "macOS", "GITHUB_RUN_ATTEMPT": "2"}):
            with self.assertRaises(ValueError): d.signing.require_ci(env)

    def test_workflow_secrets_only_after_authorization(self):
        text = (ROOT/".github/workflows/gridly-storekit-cms-diagnostic.yml").read_text()
        self.assertEqual(re.findall(r"secrets\.([A-Z0-9_]+)", text), [d.SECRET])
        self.assertLess(text.index("diagnostic.py prepare"), text.index("secrets."))
        self.assertIn("persist-credentials: false", text)
        self.assertIn("github.run_attempt == 1", text)
        self.assertIn("if: always()", text)

    def test_workflow_tag_only_no_artifacts_build_or_upload(self):
        text = (ROOT/".github/workflows/gridly-storekit-cms-diagnostic.yml").read_text()
        block = re.search(r"(?m)^on:\n([\s\S]*?)(?=^[^\s#])", text).group(1)
        self.assertIn("gridly-storekit-cms-diagnostic-15-*", block)
        for forbidden in ("branches:", "workflow_dispatch", "pull_request", "schedule:"): self.assertNotIn(forbidden, block)
        for forbidden in ("upload-artifact@", "actions/cache@", "xcodebuild ", "altool ", "iTMSTransporter",
                          "appstoreconnect", "APPLE_DIST_PRIVATE_KEY", "APPLE_DIST_CERT"):
            self.assertNotIn(forbidden, text)

    def test_workflow_shell_blocks_parse_without_execution(self):
        text=(ROOT/".github/workflows/gridly-storekit-cms-diagnostic.yml").read_text()
        blocks=[]
        lines=text.splitlines()
        for i,line in enumerate(lines):
            if line=="        run: |":
                body=[]
                for value in lines[i+1:]:
                    if value and not value.startswith("          "): break
                    body.append(value[10:] if value else "")
                blocks.append("\n".join(body)+"\n")
        self.assertEqual(len(blocks),3)
        bash="C:/Program Files/Git/bin/bash.exe" if os.name=="nt" else "/bin/bash"
        for block in blocks:
            result=subprocess.run([bash,"-n"],input=block,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertIn("set +x",block)
            self.assertIn("umask 077",block)
            self.assertIn("2>/dev/null",block)

    def test_reporting_batch_validation_before_output(self):
        output = io.StringIO()
        with self.assertRaises(ValueError):
            d.emit([d.record("AUTHORIZATION", "PASS"),
                    {"stage": "CMS_STRUCTURE", "status": "PASS", "category": CANARY}], output)
        self.assertEqual(output.getvalue(), "")

    def test_reporting_rejects_unknown_stages_statuses_keys_categories(self):
        for value in ({"stage": CANARY, "status": "PASS", "category": "NONE"},
                      {"stage": "AUTHORIZATION", "status": CANARY, "category": "NONE"},
                      {"stage": "AUTHORIZATION", "status": "PASS", "category": "NONE", "path": CANARY},
                      {"stage": "CMS_STRUCTURE", "status": "PASS", "category": "NONE"}):
            with self.assertRaises(ValueError): d.emit([value], io.StringIO())


class ComparisonTests(unittest.TestCase):
    def run_fixture(self, operation):
        with tempfile.TemporaryDirectory() as td:
            root, env = fixture(td)
            fake = Native(root)
            operation(root, env, fake)

    def test_complete_comparison_uses_one_decoded_file_and_restores(self):
        def check(root, env, fake):
            values = d.diagnose(root, context(), env, fake, locate=lambda *a, **k: "/synthetic/openssl")
            self.assertTrue(all(v["status"] == "PASS" for v in values), values)
            self.assertEqual(len([a for a,e in fake.calls if a[0] == "/usr/bin/base64"]), 1)
            cms_calls = [a for a,e in fake.calls if a[0] == "/usr/bin/security" and a[1] == "cms"]
            self.assertEqual(len(cms_calls), 4)
            self.assertEqual(len({a[a.index("-i")+1] for a in cms_calls}), 1)
            self.assertTrue(all("-k" in a and a[a.index("-k")+1] == str(root/"cms.keychain-db") for a in cms_calls))
            self.assertEqual(fake.inputs[1:], [PROFILE]*4)
            self.assertFalse(any(PROFILE in path.read_bytes() for path in (root/"logs").glob("*")))
            self.assertFalse(any(CANARY.encode() in path.read_bytes() for path in (root/"logs").glob("*")))
            self.assertEqual(fake.lists, fake.original)
            cleanup = d.cleanup(root, context(), "success", fake)
            self.assertTrue(all(v["status"] == "PASS" for v in cleanup), cleanup)
            self.assertFalse(root.exists())
            self.assertEqual(fake.lists, fake.original)
        self.run_fixture(check)

    def test_private_home_failure_does_not_block_independent_comparisons(self):
        def check(root, env, fake):
            fake.private_fail = True
            values = {v["stage"]:v for v in d.diagnose(root, context(), env, fake, locate=lambda *a,**k: "/synthetic/openssl")}
            self.assertEqual(values["CMS_RUNNER_HOME"]["status"], "PASS")
            self.assertEqual(values["CMS_PRIVATE_HOME"]["category"], "CMS_CERT_IMPORT_FAILED")
            self.assertEqual(values["CMS_STRUCTURE"]["status"], "PASS")
            self.assertEqual(values["CMS_PRIVATE_HOME_RESTORED"]["status"], "FAIL")
            self.assertEqual(values["INPUT_IDENTITY"]["status"], "PASS")
            self.assertEqual(fake.lists, fake.original)
        self.run_fixture(check)

    def test_search_list_effect_is_separately_identified(self):
        def check(root, env, fake):
            fake.restricted_fail = True
            values = {v["stage"]:v for v in d.diagnose(root, context(), env, fake, locate=lambda *a,**k: "/synthetic/openssl")}
            self.assertEqual(values["CMS_PRIVATE_HOME"]["status"], "PASS")
            self.assertEqual(values["CMS_PRIVATE_HOME_RESTRICTED"]["status"], "FAIL")
            self.assertEqual(values["CMS_PRIVATE_HOME_RESTORED"]["status"], "PASS")
            self.assertEqual(values["KEYCHAIN_CONTEXT_COMPARISON"]["category"], "CHANGED_WITH_SEARCH_LIST")
            self.assertEqual(fake.lists, fake.original)
        self.run_fixture(check)

    def test_runner_home_and_cf_unset_or_set_preserved(self):
        for cf in (None, "/synthetic/original-cf"):
            with tempfile.TemporaryDirectory() as td:
                root, env = fixture(td)
                if cf: env["CFFIXED_USER_HOME"] = cf
                values = d.environments(root, env)
                self.assertEqual(values["runner"].get("CFFIXED_USER_HOME"), cf)
                self.assertEqual(values["runner"]["HOME"], env["HOME"])
                self.assertEqual(values["private"]["HOME"], str(root/"home"))
                self.assertEqual(values["private"]["CFFIXED_USER_HOME"], str(root/"home"))

    def test_environment_excludes_credentials_and_injection(self):
        def check(root, env, fake):
            bad = {**env, "GITHUB_TOKEN": CANARY, "APPLE_DIST_PRIVATE_KEY_PEM_BASE64": CANARY,
                   "APPLE_DIST_CERT_PEM_BASE64": CANARY, "BASH_ENV": CANARY, "DYLD_INSERT_LIBRARIES": CANARY}
            for value in d.environments(root, bad).values():
                Native.assert_environment(value)
                self.assertNotIn(CANARY, json.dumps(value))
        self.run_fixture(check)

    def test_missing_input_has_no_native_comparison(self):
        def check(root, env, fake):
            del env[d.SECRET]
            values = d.diagnose(root, context(), env, fake)
            self.assertEqual(values[0]["category"], "INPUT_MISSING")
            self.assertEqual(fake.calls, [])
            self.assertTrue(all(v["status"] == "NOT_RUN" for v in values[1:]))
        self.run_fixture(check)

    def test_bad_base64_and_empty_input_fail_closed(self):
        for code, data in ((1, PROFILE), (0, b"")):
            def check(root, env, fake):
                fake.decode_code, fake.profile = code, data
                values = d.diagnose(root, context(), env, fake)
                self.assertEqual(values[0]["category"], "INPUT_DECODE_FAILED")
                self.assertEqual(len(fake.calls), 1)
            self.run_fixture(check)

    def test_input_tampering_stops_comparison(self):
        def check(root, env, fake):
            fake.tamper = True
            values = {v["stage"]:v for v in d.diagnose(root, context(), env, fake, locate=lambda *a,**k: "/synthetic/openssl")}
            self.assertEqual(values["INPUT_IDENTITY"]["category"], "INPUT_CHANGED")
            self.assertEqual(values["CMS_PRIVATE_HOME"]["status"], "NOT_RUN")
            self.assertEqual(fake.lists, fake.original)
        self.run_fixture(check)

    def test_attempt_marker_blocks_second_secret_read(self):
        def check(root, env, fake):
            d.diagnose(root, context(), env, fake, locate=lambda *a,**k: "/synthetic/openssl")
            count = len(fake.calls)
            with self.assertRaises(FileExistsError): d.diagnose(root, context(), env, fake)
            self.assertEqual(len(fake.calls), count)
        self.run_fixture(check)

    def test_structure_missing_tool_is_not_run(self):
        def check(root, env, fake):
            values = {v["stage"]:v for v in d.diagnose(root, context(), env, fake, locate=lambda *a,**k: None)}
            self.assertEqual(values["CMS_STRUCTURE"]["status"], "NOT_RUN")
            self.assertEqual(values["CMS_STRUCTURE"]["category"], "UNSUPPORTED")
            self.assertEqual(values["CMS_RUNNER_HOME"]["status"], "PASS")
        self.run_fixture(check)

    def test_structure_unsupported_options_is_not_run(self):
        def check(root, env, fake):
            fake.help_output = b"unsupported " + CANARY.encode()
            values = {v["stage"]:v for v in d.diagnose(root, context(), env, fake, locate=lambda *a,**k: "/synthetic/openssl")}
            self.assertEqual(values["CMS_STRUCTURE"]["category"], "UNSUPPORTED")
        self.run_fixture(check)

    def test_structural_parse_failure_does_not_claim_invalid_apple_trust(self):
        def check(root, env, fake):
            fake.structure_code = 1
            values = {v["stage"]:v for v in d.diagnose(root, context(), env, fake, locate=lambda *a,**k: "/synthetic/openssl")}
            self.assertEqual(values["CMS_STRUCTURE"]["category"], "CMS_PARSE_FAILED")
            self.assertEqual(values["CMS_RUNNER_HOME"]["status"], "PASS")
        self.run_fixture(check)

    def test_plain_plist_is_distinguished_from_cms(self):
        for profile in (b"<?xml version='1.0'?><plist/>", b"bplist00SYNTHETIC"):
            def check(root, env, fake):
                fake.profile = profile
                values = {v["stage"]:v for v in d.diagnose(root, context(), env, fake)}
                self.assertEqual(values["CMS_STRUCTURE"]["category"], "PLAIN_PLIST_INPUT")
            self.run_fixture(check)

    def test_cms_fixed_error_prefix_categories_and_unknown_fallback(self):
        for text, category in (*d.CMS_ERRORS, (b"unknown " + CANARY.encode(), "CMS_DECODE_FAILED")):
            def check(root, env, fake):
                fake.private_fail = True; fake.cms_error = text + b" " + CANARY.encode()
                values = {v["stage"]:v for v in d.diagnose(root, context(), env, fake, locate=lambda *a,**k: None)}
                self.assertEqual(values["CMS_PRIVATE_HOME"]["category"], category)
                sink = io.StringIO(); d.emit(list(values.values()), sink)
                self.assertNotIn(CANARY, sink.getvalue())
                self.assertNotIn(str(root), sink.getvalue())
            self.run_fixture(check)

    def test_success_exit_with_non_plist_output_is_failure(self):
        def check(root, env, fake):
            original = fake.__call__
            def execute(args, **kwargs):
                answer = original(args, **kwargs)
                return subprocess.CompletedProcess(args, 0, b"not a plist "+CANARY.encode(), b"") if len(args)>1 and args[1]=="cms" else answer
            values = {v["stage"]:v for v in d.diagnose(root, context(), env, execute, locate=lambda *a,**k: None)}
            self.assertEqual(values["CMS_RUNNER_HOME"]["category"], "OUTPUT_NOT_PLIST")
        self.run_fixture(check)

    def test_keychain_setup_failure_not_reported_as_cms_failure(self):
        def check(root, env, fake):
            fake.create_code = 1
            values = {v["stage"]:v for v in d.diagnose(root, context(), env, fake, locate=lambda *a,**k: None)}
            self.assertEqual(values["CMS_RUNNER_HOME"]["category"], "CONTEXT_SETUP_FAILED")
            self.assertEqual(values["KEYCHAIN_CONTEXT_COMPARISON"]["status"], "NOT_RUN")
        self.run_fixture(check)

    def test_timeout_restores_context_and_never_publishes_raw_output(self):
        def check(root, env, fake):
            fake.timeout_cms = True
            values = d.diagnose(root, context(), env, fake, locate=lambda *a,**k: None)
            self.assertEqual(next(v for v in values if v["stage"]=="CMS_RUNNER_HOME")["category"], "COMMAND_TIMEOUT")
            self.assertEqual(fake.lists, fake.original)
            out = io.StringIO();d.emit(values, out)
            self.assertNotIn(CANARY, out.getvalue())
        self.run_fixture(check)

    def test_native_default_query_failure_is_fixed(self):
        def check(root, env, fake):
            original = fake.__call__
            def execute(args, **kwargs):
                answer = original(args, **kwargs)
                return subprocess.CompletedProcess(args, 1, b"", CANARY.encode()) if len(args)>1 and args[1]=="default-keychain" else answer
            values = {v["stage"]:v for v in d.diagnose(root, context(), env, execute, locate=lambda *a,**k: None)}
            self.assertEqual(values["NATIVE_DEFAULT_RUNNER"]["category"], "NATIVE_DEFAULT_UNAVAILABLE")
            self.assertEqual(values["NATIVE_DEFAULT_PRIVATE"]["category"], "NATIVE_DEFAULT_UNAVAILABLE")
            self.assertEqual(values["CMS_RUNNER_HOME"]["status"], "PASS")
        self.run_fixture(check)


    def test_each_cell_uses_a_fresh_empty_certificate_database(self):
        def check(root, env, fake):
            values = d.diagnose(root, context(), env, fake, locate=lambda *a,**k: None)
            native = [a[1] for a,e in fake.calls if a[0]=="/usr/bin/security"]
            self.assertEqual(native.count("create-keychain"), 4)
            self.assertEqual(native.count("unlock-keychain"), 4)
            self.assertEqual(native.count("delete-keychain"), 3)
            self.assertEqual(native.count("cms"), 4)
            self.assertEqual(next(v for v in values if v["stage"]=="INPUT_IDENTITY")["status"],"PASS")
        self.run_fixture(check)

    def test_structural_timeout_does_not_block_native_cells(self):
        def check(root, env, fake):
            original = fake.__call__
            def execute(args, **kwargs):
                if args[0].endswith("openssl"):
                    raise subprocess.TimeoutExpired(args, 30, output=CANARY)
                return original(args, **kwargs)
            values = {v["stage"]:v for v in d.diagnose(root, context(), env, execute,
                                                       locate=lambda *a,**k:"/synthetic/openssl")}
            self.assertEqual(values["CMS_STRUCTURE"]["category"], "COMMAND_TIMEOUT")
            self.assertEqual(values["CMS_RUNNER_HOME"]["status"], "PASS")
        self.run_fixture(check)

    def test_original_baseline_change_is_not_attributed_to_search_list(self):
        def check(root, env, fake):
            original = fake.__call__
            private_calls = []
            def execute(args, **kwargs):
                answer = original(args, **kwargs)
                if args[0]=="/usr/bin/security" and args[1]=="cms" and kwargs["env"]["HOME"]==str(root/"home"):
                    private_calls.append(True)
                    if len(private_calls)==1:
                        return subprocess.CompletedProcess(args,1,b"",b"cert import failed")
                return answer
            values = {v["stage"]:v for v in d.diagnose(root, context(), env, execute, locate=lambda *a,**k:None)}
            self.assertEqual(values["KEYCHAIN_CONTEXT_COMPARISON"]["category"], "BASELINE_CHANGED")
            self.assertEqual(values["INPUT_IDENTITY"]["status"], "PASS")
        self.run_fixture(check)


class CleanupTests(unittest.TestCase):
    def run_fixture(self, operation):
        with tempfile.TemporaryDirectory() as td:
            root, env = fixture(td); fake = Native(root)
            operation(root, env, fake)

    def test_cleanup_before_comparison(self):
        def check(root, env, fake):
            values = d.cleanup(root, context(), "skipped", fake)
            self.assertTrue(all(v["status"]=="PASS" for v in values))
            self.assertFalse(root.exists())
            self.assertEqual(fake.calls, [])
        self.run_fixture(check)

    def test_wrong_owner_blocks_cleanup_without_mutation(self):
        def check(root, env, fake):
            (root/".owned").write_text("{}")
            values = d.cleanup(root, context(), "failure", fake)
            self.assertTrue(all(v["category"]=="OWNERSHIP_BLOCKED" for v in values))
            self.assertTrue(root.exists())
            self.assertEqual(fake.calls, [])
        self.run_fixture(check)

    def test_missing_workspace_after_started_is_not_cleanup_success(self):
        with tempfile.TemporaryDirectory() as td:
            root = d.workspace(td, "123456")
            values = d.cleanup(root, context(), "failure")
            self.assertTrue(all(v["status"]=="FAIL" for v in values))

    def test_skipped_uncreated_workspace_is_explicitly_not_started(self):
        with tempfile.TemporaryDirectory() as td:
            values = d.cleanup(d.workspace(td,"123456"), context(), "skipped")
            self.assertEqual(values[0]["category"], "NOT_STARTED")
            self.assertEqual(values[1]["category"], "ALL_ABSENT")

    def test_restore_failure_remains_failure_even_after_later_success(self):
        def check(root, env, fake):
            fake.restore_code = 1
            d.diagnose(root, context(), env, fake, locate=lambda *a,**k: None)
            fake.restore_code = 0
            values = d.cleanup(root, context(), "failure", fake)
            self.assertEqual(values[0]["category"], "RESTORE_FAILED")
            self.assertEqual(values[1]["status"], "FAIL")
        self.run_fixture(check)

    def test_keychain_delete_failure_never_claims_clean(self):
        def check(root, env, fake):
            d.diagnose(root, context(), env, fake, locate=lambda *a,**k: None)
            fake.delete_code = 1
            values = d.cleanup(root, context(), "success", fake)
            self.assertTrue(all(v["status"]=="FAIL" for v in values))
        self.run_fixture(check)

    def test_workspace_removal_failure_is_reported(self):
        def check(root, env, fake):
            with patch.object(d.shutil, "rmtree", side_effect=OSError(CANARY)):
                values = d.cleanup(root, context(), "skipped", fake)
            self.assertEqual(values[1]["category"], "REMOVAL_FAILED")
            self.assertTrue(root.exists())
        self.run_fixture(check)

    def test_symlink_blocks_owned_cleanup(self):
        with tempfile.TemporaryDirectory() as td:
            root, env = fixture(td); fake = Native(root)
            with patch.object(Path, "is_symlink", autospec=True, side_effect=lambda p: p.name=="logs"):
                values = d.cleanup(root, context(), "skipped", fake)
            self.assertEqual(values[0]["category"], "OWNERSHIP_BLOCKED")
            self.assertTrue(root.exists())

    def test_unowned_native_keychain_blocks_cleanup(self):
        def check(root, env, fake):
            (root/"cms.keychain-db").write_bytes(b"UNOWNED")
            values=d.cleanup(root,context(),"failure",fake)
            self.assertTrue(all(v["category"]=="OWNERSHIP_BLOCKED" for v in values))
            self.assertEqual(fake.calls,[])
            self.assertTrue(root.exists())
        self.run_fixture(check)

    def test_malformed_snapshot_paths_cannot_reach_native_setter(self):
        for paths in (["relative"], ["\\n"], [1], ["a","a"]):
            def check(root, env, fake):
                state=d.load_state(root);state["snapshots"]={"runner":paths}
                d.save(root,"state.json",state)
                values=d.cleanup(root,context(),"failure",fake)
                self.assertTrue(all(v["category"]=="OWNERSHIP_BLOCKED" for v in values))
                self.assertEqual(fake.calls,[])
            self.run_fixture(check)

    def test_altered_private_home_cannot_redirect_cleanup(self):
        def check(root, env, fake):
            state=d.load_state(root);state["contexts"]["private"]["HOME"]=CANARY
            d.save(root,"state.json",state)
            values=d.cleanup(root,context(),"failure",fake)
            self.assertTrue(all(v["category"]=="OWNERSHIP_BLOCKED" for v in values))
            self.assertEqual(fake.calls,[])
        self.run_fixture(check)

    def test_workspace_rejects_invalid_run_ids_and_root_parent(self):
        with tempfile.TemporaryDirectory() as td:
            for value in ("0", "-1", "../elsewhere", "1/2", "1"*21):
                with self.assertRaises(ValueError): d.workspace(td, value)
            with self.assertRaises(ValueError): d.workspace(Path(td).anchor, "123456")

    def test_parsing_and_no_network_or_release_imports(self):
        source = (ROOT/"tools/apple_storekit_cms_diagnostic.py").read_text()
        tree = ast.parse(source)
        imports = {n.names[0].name for n in ast.walk(tree) if isinstance(n, ast.Import)}
        self.assertFalse(imports & {"requests", "urllib", "socket", "http"})
        for forbidden in ("xcodebuild", "altool", "iTMSTransporter", "codesign ", "set-key-partition-list",
                          "security import", "APPLE_DIST_PRIVATE_KEY_PEM_BASE64"):
            self.assertNotIn(forbidden, source)

    def test_main_authorization_rejection_prevents_prepare_or_secret_access(self):
        env = {"GITHUB_ACTIONS":"true","RUNNER_OS":"macOS","GITHUB_RUN_ATTEMPT":"1",
               "RUNNER_TEMP":tempfile.gettempdir(),"GITHUB_RUN_ID":"123456"}
        out = io.StringIO()
        with patch.dict(os.environ, env, clear=True), patch.object(d, "authorize", side_effect=ValueError(CANARY)), \
             patch.object(d, "prepare") as prepare, contextlib.redirect_stdout(out):
            self.assertEqual(d.main(["prepare"]), 1)
        prepare.assert_not_called()
        self.assertNotIn(CANARY, out.getvalue())
        self.assertIn("AUTHORIZATION_REJECTED", out.getvalue())


if __name__ == "__main__":
    unittest.main()
