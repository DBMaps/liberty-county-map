"""Local fakes only: no Git mutations, network, Xcode, signing or delivery."""
import ast
import contextlib
import fnmatch
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("preflight", ROOT / "tools/apple_storekit_preflight_diagnostic.py")
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
COMMIT = "1" * 40
TAG_OBJECT = "2" * 40
REF = d.PREFIX + COMMIT
PRIVATE = b"SYNTHETIC_PRIVATE_OUTPUT_DO_NOT_PUBLISH"


def annotation():
    return {"preflight_commit": COMMIT, "delivery_source_commit": d.DELIVERY_SOURCE,
            "failed_delivery_run_id": d.FAILED_RUN, "historical_certification_run_id": d.CERTIFICATION_RUN,
            "preflight_only_authorized": True, "build_sign_export_upload_forbidden": True}


def event():
    return {"ref": REF, "after": TAG_OBJECT, "created": True, "deleted": False, "forced": False,
            "repository": {"full_name": d.REPOSITORY}}


def cp(code=0, stdout=b"", stderr=b""):
    return subprocess.CompletedProcess([], code, stdout, stderr)


class GateTests(unittest.TestCase):
    def setUp(self):
        self.annotation = json.dumps(annotation())
        self.commands = {
            ("rev-parse", "HEAD"): COMMIT,
            ("cat-file", "-t", REF): "tag",
            ("rev-parse", "--verify", REF): TAG_OBJECT,
            ("show", "-s", "--format=%P", COMMIT): d.DELIVERY_SOURCE,
            ("diff", "--name-status", "--no-renames", d.DELIVERY_SOURCE, COMMIT):
                "\n".join("A\t" + f for f in sorted(d.FILES)),
            ("status", "--porcelain=v1", "--untracked-files=all"): "",
            ("rev-parse", "--verify", "refs/tags/" + d.FAILED_TAG): d.FAILED_TAG_OBJECT,
            ("rev-parse", "refs/tags/" + d.FAILED_TAG + "^{commit}"): d.DELIVERY_SOURCE,
        }
        for f in d.FILES:
            self.commands[("ls-tree", COMMIT, "--", f)] = "100644 blob " + "3"*40 + "\t" + f
        self.context = dict(repo=ROOT, commit=COMMIT, ref=REF, event=event(), attempt="1",
                            event_name="push", repository=d.REPOSITORY)
        self.addCleanup(patch.stopall)
        patch.object(d, "git", side_effect=self.git).start()
        patch.object(d, "capture", side_effect=self.capture).start()

    def git(self, repo, *args):
        self.assertEqual(repo, ROOT)
        if args == ("cat-file", "-p", REF):
            return "object " + COMMIT + "\ntype commit\ntag " + REF.removeprefix("refs/tags/") + "\ntagger synthetic\n\n" + self.annotation
        return self.commands[args]

    def capture(self, args, **kwargs):
        if args[:2] == ["git", "show"]:
            path = args[2].split(":", 1)[1]
            return cp(stdout=(ROOT / path).read_bytes())
        if args[:4] == ["git", "show-ref", "--verify", "--quiet"]:
            return cp(1)
        self.fail("unexpected command")

    def test_exact_preflight_only_authorization_passes(self):
        d.authorize(**self.context)

    def test_commit_or_annotated_object_push_sha_passes(self):
        self.context["event"]["after"] = COMMIT
        d.authorize(**self.context)

    def test_each_missing_or_extra_authorization_field_is_rejected(self):
        for key in annotation():
            value = annotation(); del value[key]
            with self.subTest(key=key), self.assertRaises(d.GateError):
                d.authorization_contract(value, COMMIT)
        with self.assertRaises(d.GateError):
            d.authorization_contract({**annotation(), "upload_authorized": True}, COMMIT)

    def test_false_nonboolean_wrong_build_source_or_run_fails(self):
        for key in annotation():
            bad = False if type(annotation()[key]) is bool else "wrong"
            with self.subTest(key=key), self.assertRaises(d.GateError):
                d.authorization_contract({**annotation(), key: bad}, COMMIT)
        with self.assertRaises(d.GateError):
            d.authorization_contract({**annotation(), "failed_delivery_run_id": True}, COMMIT)

    def test_duplicate_annotation_fields_fail(self):
        with self.assertRaises(d.GateError):
            json.loads('{"preflight_only_authorized":true,"preflight_only_authorized":true}', object_pairs_hook=d.unique_object)

    def test_missing_invalid_or_upload_authorization_is_not_preflight_consent(self):
        for value in (None, [], {}, {"testflight_upload_authorized": True}):
            self.annotation = json.dumps(value)
            with self.subTest(value=value), self.assertRaises(d.GateError):
                d.authorize(**self.context)

    def test_wrong_source_event_checkout_and_malformed_sha_rejected(self):
        for field, value in [("commit", "wrong"), ("commit", "a"*40)]:
            with self.subTest(value=value), self.assertRaises(d.GateError):
                d.authorize(**{**self.context, field: value})
        self.context["event"]["after"] = "f"*40
        with self.assertRaises(d.GateError):
            d.authorize(**self.context)

    def test_ordinary_branch_old_delivery_certification_and_wrong_repo_rejected(self):
        for ref in ("refs/heads/codex/storekit-diagnostics", "refs/tags/"+d.FAILED_TAG,
                    "refs/tags/gridly-storekit-diagnostic-certify-15-" + "f"*40):
            with self.subTest(ref=ref), self.assertRaises(d.GateError):
                d.authorize(**{**self.context, "ref": ref})
        with self.assertRaises(d.GateError):
            d.authorize(**{**self.context, "repository": "other/repo"})

    def test_reruns_dispatch_and_existing_forced_deleted_tags_rejected(self):
        for field, value in [("attempt", "2"), ("event_name", "workflow_dispatch")]:
            with self.subTest(field=field), self.assertRaises(d.GateError):
                d.authorize(**{**self.context, field: value})
        for field, value in [("created", False), ("deleted", True), ("forced", True)]:
            bad = copy.deepcopy(self.context); bad["event"][field] = value
            with self.subTest(field=field), self.assertRaises(d.GateError):
                d.authorize(**bad)

    def test_lightweight_and_indirect_tags_rejected(self):
        self.commands[("cat-file", "-t", REF)] = "commit"
        with self.assertRaises(d.GateError):
            d.authorize(**self.context)
        self.commands[("cat-file", "-t", REF)] = "tag"
        with patch.object(d, "git", side_effect=lambda repo,*args:
                          "object "+TAG_OBJECT+"\ntype tag\ntag indirect\n\n{}" if args==("cat-file","-p",REF) else self.git(repo,*args)):
            with self.assertRaises(d.GateError):
                d.authorize(**self.context)

    def test_additional_parent_commit_runtime_modification_or_file_mode_rejected(self):
        checks = [
            (("show","-s","--format=%P",COMMIT), d.DELIVERY_SOURCE+" "+"f"*40),
            (("diff","--name-status","--no-renames",d.DELIVERY_SOURCE,COMMIT), "M\tios/App/App/GridlyStoreKitPlugin.swift"),
            (("ls-tree",COMMIT,"--","tools/apple_storekit_preflight_diagnostic.py"), "100755 blob "+"3"*40+"\tfile"),
            (("status","--porcelain=v1","--untracked-files=all"), " M existing"),
        ]
        for key, bad in checks:
            old=self.commands[key]; self.commands[key]=bad
            with self.subTest(key=key), self.assertRaises(d.GateError):
                d.authorize(**self.context)
            self.commands[key]=old

    def test_checkout_bytes_must_equal_reviewed_tree(self):
        with patch.object(d,"capture",return_value=cp(stdout=b"modified")):
            with self.assertRaises(d.GateError):
                d.authorize(**self.context)


class ProbeTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix="gridly-preflight-test-")
        self.addCleanup(self.temp.cleanup)
        self.runner_temp=self.temp.name
        self.root=d.prepare(self.runner_temp)
        self.env={"PATH":os.environ.get("PATH",""),"GITHUB_REF":REF}
        self.failures={}
        self.calls=[]

    def execute(self,args,**options):
        self.calls.append((args,options))
        output=b""
        key=None
        if args==["git","rev-parse","HEAD"]: key="source_sha";output=(COMMIT+"\n").encode()
        elif args==["xcodebuild","-version"]: key="version";output=b"Xcode 26.6\nBuild version SYNTHETIC\n"
        elif args[:2]==["grep","-E"]:
            key="version_match"
            if key not in self.failures:
                return cp(0 if re.search(rb"^Xcode 26([. ]|$)",options.get("input",b""),re.M) else 1)
        elif args==["git","cat-file","-t",REF]: key="tag";output=b"tag\n"
        elif args==["git","rev-parse",REF+"^{commit}"]:key="tag_sha";output=(COMMIT+"\n").encode()
        elif args==["git","symbolic-ref","-q","HEAD"]:
            return self.failures.get("attached_head",cp(1))
        elif args==["git","cat-file","-t","refs/tags/"+d.FAILED_TAG]:key="historical_tag";output=b"tag\n"
        elif args==["git","rev-parse","refs/tags/"+d.FAILED_TAG]:key="historical_tag_sha";output=(d.FAILED_TAG_OBJECT+"\n").encode()
        elif args==["git","rev-parse","refs/tags/"+d.FAILED_TAG+"^{commit}"]:key="historical_target";output=(d.DELIVERY_SOURCE+"\n").encode()
        elif args==["git","show-ref","--verify","--quiet","refs/heads/"+d.FAILED_TAG]:
            return self.failures.get("ambiguous_branch",cp(1))
        elif args[:2]==["git","clone"]:
            key="clone"
            if key not in self.failures:(self.root/"source").mkdir()
        elif args[:3]==["git","-C",str(self.root/"source")]:key="clone_sha";output=(d.DELIVERY_SOURCE+"\n").encode()
        elif args[-1:]==[d.SOURCE_COMMAND]:key="source_guard"
        elif args[-1:]==[d.HISTORY_COMMAND]:key="history"
        elif args==["xcodebuild","-help"]:key="help";output=b"\n    testFlightInternalTestingOnly : Bool\n"
        elif args[:2]==["grep","-Eq"]:key="option"
        else:self.fail("unexpected command")
        if key in self.failures:
            action=self.failures[key]
            if isinstance(action,Exception):raise action
            return action
        return cp(stdout=output,stderr=PRIVATE)

    def run_probes(self):
        return {r["stage"]:r for r in d.diagnose(ROOT,COMMIT,self.root,self.env,execute=self.execute)}

    def test_all_eight_checks_pass_with_fixed_public_format(self):
        records=self.run_probes()
        self.assertEqual(list(records),list(d.STAGES))
        self.assertTrue(all(r["status"]=="PASS" for r in records.values()))
        stream=io.StringIO()
        with contextlib.redirect_stdout(stream):d.emit(records.values())
        self.assertNotIn(PRIVATE.decode(),stream.getvalue())
        self.assertNotIn(str(self.root),stream.getvalue())

    def test_wrong_xcode_version_fails_without_stopping_independent_checks(self):
        self.failures["version"]=cp(stdout=b"Xcode 27.0\nBuild version SYNTHETIC\n",stderr=PRIVATE)
        records=self.run_probes()
        self.assertEqual(records["P02_XCODE_VERSION"]["category"],"XCODE26_REQUIRED")
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["status"],"PASS")
        self.assertEqual(records["P07_XCODE_HELP"]["status"],"PASS")

    def test_xcode_version_execution_failure_is_distinct(self):
        self.failures["version"]=OSError(PRIVATE.decode())
        records=self.run_probes()
        self.assertEqual(records["P02_XCODE_VERSION"]["category"],"XCODE_COMMAND_FAILED")
        self.assertFalse(any(args[:2]==["grep","-E"] for args,_ in self.calls))

    def test_source_sha_failure_prevents_all_remaining_execution(self):
        self.failures["source_sha"]=cp(stdout=("f"*40).encode())
        records=self.run_probes()
        self.assertEqual(records["P01_SOURCE_SHA"]["status"],"FAIL")
        self.assertEqual(len(self.calls),1)
        self.assertTrue(all(records[s]["category"]=="DEPENDENCY_FAILED" for s in d.STAGES[1:]))

    def test_original_delivery_source_guard_failure_is_independent(self):
        self.failures["source_guard"]=cp(1,stderr=PRIVATE)
        records=self.run_probes()
        self.assertEqual(records["P03_SOURCE_GUARD"]["category"],"DELIVERY_SOURCE_REJECTED")
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["status"],"PASS")
        args,kw=next((a,k) for a,k in self.calls if a[-1:]==[d.SOURCE_COMMAND])
        self.assertEqual(kw["cwd"],self.root/"source")

    def test_historical_evidence_failure_does_not_stop_xcode_or_clone(self):
        self.failures["history"]=cp(1,stderr=PRIVATE)
        records=self.run_probes()
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["category"],"CERTIFICATION_EVIDENCE_REJECTED")
        self.assertEqual(records["P06_CLONE_SHA"]["status"],"PASS")
        self.assertEqual(records["P07_XCODE_HELP"]["status"],"PASS")

    def test_tag_checkout_failure_blocks_clone_and_source_guard(self):
        self.failures["tag_sha"]=cp(stdout=b"wrong\n")
        records=self.run_probes()
        self.assertEqual(records["P05_TAG_CHECKOUT"]["category"],"TAG_CHECKOUT_REJECTED")
        self.assertEqual(records["P06_CLONE_SHA"]["category"],"DEPENDENCY_FAILED")
        self.assertEqual(records["P03_SOURCE_GUARD"]["category"],"DEPENDENCY_FAILED")
        self.assertFalse(any(args[:2]==["git","clone"] for args,_ in self.calls))
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["status"],"PASS")

    def test_changed_missing_or_ambiguous_historical_tag_is_a_tag_stage_failure(self):
        for key, failure in [("historical_tag",cp(1)),("historical_tag_sha",cp(stdout=b"wrong")),
                             ("historical_target",cp(stdout=b"wrong")),("ambiguous_branch",cp(0))]:
            self.failures={key:failure}
            with self.subTest(key=key):
                records=self.run_probes()
                self.assertEqual(records["P05_TAG_CHECKOUT"]["category"],"TAG_CHECKOUT_REJECTED")
                self.assertEqual(records["P06_CLONE_SHA"]["category"],"DEPENDENCY_FAILED")

    def test_attached_checkout_is_rejected_as_a_tag_checkout_failure(self):
        self.failures["attached_head"]=cp(0,stdout=b"refs/heads/synthetic")
        records=self.run_probes()
        self.assertEqual(records["P05_TAG_CHECKOUT"]["category"],"TAG_CHECKOUT_REJECTED")

    def test_clone_execution_failure_blocks_source_guard(self):
        self.failures["clone"]=cp(1,stderr=PRIVATE)
        records=self.run_probes()
        self.assertEqual(records["P06_CLONE_SHA"]["category"],"LOCAL_CLONE_FAILED")
        self.assertEqual(records["P03_SOURCE_GUARD"]["category"],"DEPENDENCY_FAILED")
        self.assertFalse(any(args[-1:]==[d.SOURCE_COMMAND] for args,_ in self.calls))

    def test_clone_timeout_does_not_appear_as_sha_mismatch(self):
        self.failures["clone"]=subprocess.TimeoutExpired("synthetic",1,output=PRIVATE,stderr=PRIVATE)
        records=self.run_probes()
        self.assertEqual(records["P06_CLONE_SHA"]["category"],"LOCAL_CLONE_FAILED")

    def test_clone_sha_mismatch_never_passes_dependent_source_guard(self):
        self.failures["clone_sha"]=cp(stdout=b"wrong")
        records=self.run_probes()
        self.assertEqual(records["P06_CLONE_SHA"]["category"],"CLONED_SHA_MISMATCH")
        self.assertEqual(records["P03_SOURCE_GUARD"]["category"],"DEPENDENCY_FAILED")

    def test_xcode_help_execution_failure_blocks_option_check_even_when_key_exists(self):
        self.failures["help"]=cp(1,stdout=b"testFlightInternalTestingOnly : Bool",stderr=PRIVATE)
        records=self.run_probes()
        self.assertEqual(records["P07_XCODE_HELP"]["category"],"XCODE_HELP_FAILED")
        self.assertEqual(records["P08_INTERNAL_EXPORT_OPTION"]["category"],"DEPENDENCY_FAILED")
        self.assertFalse(any(args[:2]==["grep","-Eq"] for args,_ in self.calls))

    def test_internal_export_option_recognition_fails_separately(self):
        self.failures["option"]=cp(1,stderr=PRIVATE)
        records=self.run_probes()
        self.assertEqual(records["P07_XCODE_HELP"]["status"],"PASS")
        self.assertEqual(records["P08_INTERNAL_EXPORT_OPTION"]["category"],"INTERNAL_OPTION_NOT_RECOGNIZED")

    def test_original_grep_expressions_and_clone_command_are_preserved(self):
        self.run_probes()
        self.assertTrue(any(args==["grep","-E","^Xcode 26([. ]|$)"] for args,_ in self.calls))
        self.assertTrue(any(args==["grep","-Eq","^[[:space:]]*testFlightInternalTestingOnly[[:space:]]*:",str(self.root/"reports/xcode-help.txt")] for args,_ in self.calls))
        self.assertTrue(any(args==["git","clone","--no-hardlinks","--branch",d.FAILED_TAG,str(ROOT),str(self.root/"source")] for args,_ in self.calls))
        bash=Path("C:/Program Files/Git/bin/bash.exe") if os.name=="nt" else Path("/bin/bash")
        fixtures=[
            ("grep -Eq '^Xcode 26([. ]|$)'","Xcode 26.6\n",0),
            ("grep -Eq '^Xcode 26([. ]|$)'","Xcode 27.0\n",1),
            ("grep -Eq '^[[:space:]]*testFlightInternalTestingOnly[[:space:]]*:'","\t testFlightInternalTestingOnly : Bool\n",0),
            ("grep -Eq '^[[:space:]]*testFlightInternalTestingOnly[[:space:]]*:'","unrelated : Bool\n",1),
        ]
        for command,text,expected in fixtures:
            completed=subprocess.run([str(bash),"--noprofile","--norc","-c",command],input=text,text=True,capture_output=True)
            self.assertEqual(completed.returncode,expected)


    def test_multiple_independent_failures_are_all_reported(self):
        self.failures.update({"version_match":cp(1),"history":cp(1),"help":cp(1)})
        records=self.run_probes()
        for stage in ["P02_XCODE_VERSION","P04_CERTIFICATION_HISTORY","P07_XCODE_HELP"]:
            self.assertEqual(records[stage]["status"],"FAIL")
        self.assertEqual(records["P06_CLONE_SHA"]["status"],"PASS")

    def test_environment_has_private_homes_and_no_inherited_secret_or_account_values(self):
        env=d.child_environment(self.root,{"PATH":"safe","UNRELATED_PRIVATE":"SYNTHETIC","GITHUB_TOKEN":"SYNTHETIC"})
        self.assertNotIn("UNRELATED_PRIVATE",env);self.assertNotIn("GITHUB_TOKEN",env)
        self.assertEqual(env["HOME"],str(self.root/"home"))
        self.assertEqual(env["CFFIXED_USER_HOME"],str(self.root/"home"))
        self.assertEqual(env["GIT_TERMINAL_PROMPT"],"0")

    def test_raw_exception_and_output_never_enter_public_results(self):
        self.failures.update({"version":RuntimeError(PRIVATE.decode()),"history":RuntimeError(PRIVATE.decode())})
        records=self.run_probes()
        stream=io.StringIO()
        with contextlib.redirect_stdout(stream):d.emit(records.values())
        public=stream.getvalue()
        for forbidden in [PRIVATE.decode(),str(self.root),"Traceback","RuntimeError","Xcode 26.6"]:
            self.assertNotIn(forbidden,public)
        self.assertTrue(any(PRIVATE in p.read_bytes() for p in (self.root/"logs").glob("*.log")))

    def test_only_fixed_allowed_command_inventory_can_execute(self):
        self.run_probes()
        for args,options in self.calls:
            self.assertIn(args[0],{"git","grep","xcodebuild",sys.executable})
            if args[0]=="xcodebuild":self.assertIn(args[1:],(["-version"],["-help"]))
            if args[0]==sys.executable:self.assertIn(args,[
                [sys.executable,"-B","-c",d.SOURCE_COMMAND],[sys.executable,"-B","-c",d.HISTORY_COMMAND]])
            self.assertNotIn("GITHUB_TOKEN",options["env"])


class CleanupAndEntryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix="gridly-preflight-entry-")
        self.addCleanup(self.temp.cleanup)
        self.root=d.private_root(self.temp.name)

    def test_cleanup_after_success_and_failure_removes_every_private_file(self):
        for outcome in (True,False):
            root=d.prepare(self.temp.name)
            for file in ["source/copied-object","home/tool-data","logs/private.log","reports/private.txt"]:
                path=root/file;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(PRIVATE)
            self.assertEqual(d.cleanup(self.temp.name),d.result("P09_CLEANUP",True,"NONE"))
            self.assertFalse(root.exists())

    def test_absent_workspace_cleanup_passes(self):
        self.assertEqual(d.cleanup(self.temp.name)["status"],"PASS")

    def test_unowned_directory_is_not_deleted(self):
        self.root.mkdir();(self.root/"keep").write_bytes(PRIVATE)
        self.assertEqual(d.cleanup(self.temp.name)["status"],"FAIL")
        self.assertTrue((self.root/"keep").exists())

    def test_cleanup_failure_is_fixed_failure(self):
        d.prepare(self.temp.name)
        with patch.object(d.shutil,"rmtree",side_effect=OSError(PRIVATE.decode())):
            record=d.cleanup(self.temp.name)
        self.assertEqual(record,d.result("P09_CLEANUP",False,"CLEANUP_FAILED"))
        self.assertNotIn(PRIVATE.decode(),json.dumps(record))

    def test_wrong_marker_symlink_and_missing_temp_are_rejected(self):
        d.prepare(self.temp.name);(self.root/".owned").write_text("wrong")
        self.assertEqual(d.cleanup(self.temp.name)["status"],"FAIL")
        self.assertEqual(d.cleanup("")["status"],"FAIL")
        with patch.object(Path,"is_symlink",return_value=True):
            self.assertEqual(d.cleanup(self.temp.name)["status"],"FAIL")

    def test_existing_directory_cannot_be_reused(self):
        d.prepare(self.temp.name)
        with self.assertRaises(FileExistsError):d.prepare(self.temp.name)

    def test_invalid_authorization_stops_before_tools_and_private_workspace(self):
        event_path=Path(self.temp.name)/"event.json";event_path.write_text(json.dumps(event()))
        env={"RUNNER_OS":"macOS","GITHUB_ACTIONS":"true","RUNNER_TEMP":self.temp.name,
             "GITHUB_WORKSPACE":str(ROOT),"GITHUB_EVENT_PATH":str(event_path),"GITHUB_SHA":COMMIT,
             "GITHUB_REF":REF,"GITHUB_RUN_ATTEMPT":"1","GITHUB_EVENT_NAME":"push","GITHUB_REPOSITORY":d.REPOSITORY}
        stream=io.StringIO()
        with patch.object(d,"authorize",side_effect=RuntimeError(PRIVATE.decode())),patch.object(d,"diagnose") as probes,patch.object(d,"prepare") as prepare,contextlib.redirect_stdout(stream):
            self.assertEqual(d.main("run",env),1)
        probes.assert_not_called();prepare.assert_not_called()
        self.assertNotIn(PRIVATE.decode(),stream.getvalue())
        self.assertEqual(len(stream.getvalue().splitlines()),8)

    def test_run_and_always_cleanup_entrypoints_report_success(self):
        event_path=Path(self.temp.name)/"event.json";event_path.write_text(json.dumps(event()))
        env={"RUNNER_OS":"macOS","GITHUB_ACTIONS":"true","RUNNER_TEMP":self.temp.name,
             "GITHUB_WORKSPACE":str(ROOT),"GITHUB_EVENT_PATH":str(event_path),"GITHUB_SHA":COMMIT,
             "GITHUB_REF":REF,"GITHUB_RUN_ATTEMPT":"1","GITHUB_EVENT_NAME":"push","GITHUB_REPOSITORY":d.REPOSITORY}
        records=[d.result(stage,True,"NONE") for stage in d.STAGES]
        stream=io.StringIO()
        with patch.object(d,"authorize"),patch.object(d,"diagnose",return_value=records),contextlib.redirect_stdout(stream):
            self.assertEqual(d.main("run",env),0)
            self.assertTrue(self.root.is_dir())
            self.assertEqual(d.main("cleanup",env),0)
        self.assertFalse(self.root.exists())
        self.assertEqual(len(stream.getvalue().splitlines()),9)

    def test_run_failure_still_has_separate_always_cleanup(self):
        event_path=Path(self.temp.name)/"event.json";event_path.write_text(json.dumps(event()))
        env={"RUNNER_OS":"macOS","GITHUB_ACTIONS":"true","RUNNER_TEMP":self.temp.name,
             "GITHUB_WORKSPACE":str(ROOT),"GITHUB_EVENT_PATH":str(event_path),"GITHUB_SHA":COMMIT,
             "GITHUB_REF":REF,"GITHUB_RUN_ATTEMPT":"1","GITHUB_EVENT_NAME":"push","GITHUB_REPOSITORY":d.REPOSITORY}
        stream=io.StringIO()
        with patch.object(d,"authorize"),patch.object(d,"diagnose",side_effect=RuntimeError(PRIVATE.decode())),contextlib.redirect_stdout(stream):
            self.assertEqual(d.main("run",env),1)
            self.assertEqual(d.main("cleanup",env),0)
        self.assertFalse(self.root.exists());self.assertNotIn(PRIVATE.decode(),stream.getvalue())

    def test_interrupt_is_sanitized_and_cleanup_still_available(self):
        event_path=Path(self.temp.name)/"event.json";event_path.write_text(json.dumps(event()))
        env={"RUNNER_OS":"macOS","GITHUB_ACTIONS":"true","RUNNER_TEMP":self.temp.name,
             "GITHUB_WORKSPACE":str(ROOT),"GITHUB_EVENT_PATH":str(event_path),"GITHUB_SHA":COMMIT,
             "GITHUB_REF":REF,"GITHUB_RUN_ATTEMPT":"1","GITHUB_EVENT_NAME":"push","GITHUB_REPOSITORY":d.REPOSITORY}
        stream=io.StringIO()
        with patch.object(d,"authorize"),patch.object(d,"diagnose",side_effect=KeyboardInterrupt(PRIVATE.decode())),contextlib.redirect_stdout(stream):
            self.assertEqual(d.main("run",env),1)
            self.assertEqual(d.main("cleanup",env),0)
        self.assertNotIn(PRIVATE.decode(),stream.getvalue())
        self.assertNotIn("Traceback",stream.getvalue())
        self.assertFalse(self.root.exists())

    def test_public_emitter_rejects_raw_or_unknown_fields(self):
        for record in [{"stage":d.STAGES[0],"status":"FAIL","category":PRIVATE.decode()},
                       {"stage":PRIVATE.decode(),"status":"PASS","category":"NONE"},
                       {**d.result(d.STAGES[0],True,"NONE"),"raw":PRIVATE.decode()}]:
            with self.subTest(record=record),self.assertRaises(d.GateError):d.emit([record])


class WorkflowAndPreservationTests(unittest.TestCase):
    def setUp(self):
        self.path=ROOT/".github/workflows/gridly-storekit-preflight-diagnostic.yml"
        self.workflow=self.path.read_text()
        self.helper=(ROOT/"tools/apple_storekit_preflight_diagnostic.py").read_text()

    def test_separate_tag_only_no_branch_dispatch_delivery_or_certification_trigger(self):
        trigger=self.workflow.split("\non:\n",1)[1].split("\npermissions:\n",1)[0]
        self.assertEqual(trigger.strip(),"push:\n    tags:\n      - 'gridly-storekit-preflight-15-*'")
        self.assertNotIn("workflow_dispatch:",self.workflow)
        for clause in ["github.event.created == true","github.event.deleted == false","github.event.forced == false",
                       "github.run_attempt == 1","github.repository == 'DBMaps/liberty-county-map'"]:
            self.assertIn(clause,self.workflow)

    def test_preflight_tag_cannot_activate_any_existing_workflow(self):
        matching=[]
        for path in (ROOT/".github/workflows").glob("*.yml"):
            text=path.read_text()
            trigger=text.split("\non:\n",1)[1].split("\npermissions:",1)[0].split("\njobs:",1)[0]
            if re.search(r"^  push:\s*$",trigger,re.M):
                self.assertIn("    tags:",trigger)
                patterns=re.findall(r"^      - '([^']+)'$",trigger,re.M)
                self.assertTrue(patterns)
                if any(fnmatch.fnmatchcase(REF.removeprefix("refs/tags/"),pattern) for pattern in patterns):
                    matching.append(path.name)
        self.assertEqual(matching,["gridly-storekit-preflight-diagnostic.yml"])

    def test_public_repository_read_only_no_secrets_artifacts_or_caches(self):
        for forbidden in ["secrets.","upload-artifact","download-artifact","actions/cache","repository.private","id-token:","write-all",
                          "workflow_call:","workflow_run:","uses: ./.github","ASC_KEY_ID","ASC_ISSUER_ID","ASC_PRIVATE_KEY"]:
            self.assertNotIn(forbidden,self.workflow)
        self.assertIn("permissions:\n  contents: read",self.workflow)
        self.assertIn("persist-credentials: false",self.workflow)
        self.assertEqual(re.findall(r"uses: (.+)",self.workflow),["actions/checkout@v4"])

    def test_pinned_checkout_macos_and_always_cleanup(self):
        self.assertIn("ref: "+chr(36)+"{{ github.sha }}",self.workflow)
        self.assertIn("fetch-depth: 0",self.workflow)
        self.assertIn("runs-on: macos-26",self.workflow)
        self.assertIn("if: always()",self.workflow)
        self.assertIn("apple_storekit_preflight_diagnostic.py cleanup",self.workflow)
        self.assertIn("CLEANUP_HELPER_UNAVAILABLE",self.workflow)

    def test_no_build_sign_export_upload_or_apple_transport_commands(self):
        tree=ast.parse(self.helper)
        literal_lists=[node for node in ast.walk(tree) if isinstance(node,ast.List)]
        xcode_commands=[]
        for node in literal_lists:
            values=[v.value if isinstance(v,ast.Constant) else None for v in node.elts]
            if values and values[0]=="xcodebuild":xcode_commands.append(values)
        self.assertEqual(sorted(xcode_commands),[["xcodebuild","-help"],["xcodebuild","-version"]])
        self.assertNotRegex(self.helper,r"(?:import (?:urllib|http|requests)|urlopen|urlretrieve|api_token|unused_build|\.transfer\(|--upload-app|--validate-app|security |codesign |xcrun |npm |npx )")
        self.assertEqual(d.SOURCE_COMMAND,"import sys;sys.path.insert(0,'tools');import apple_storekit_testflight_delivery as d;d.source_guard('"+d.DELIVERY_SOURCE+"',clean=True)")
        self.assertEqual(d.HISTORY_COMMAND,"import sys;sys.path.insert(0,'tools');import apple_storekit_testflight_delivery as d;d.historical_evidence()")

    def test_historical_sources_immutable_and_only_exact_current_refinement_allowed(self):
        certified = "f9fc818321970b8b7e29df17358daf87a7d20308"
        preparation = "bd5b1feac696ba7db0e7d8d271b054df1d25850b"
        owner = "45bfe026b81f4928caceb9632cbf15e7ed842a25"
        previous = "13e73183cf3f257fbc9acd9a32d34d62b70ffb1e"
        delivery_files = {
            ".github/workflows/gridly-storekit-testflight-delivery.yml",
            "tools/apple_storekit_testflight_delivery.py",
            "tests/storekit-testflight-delivery.test.py",
        }
        refinement = delivery_files | {"tests/storekit-preflight-diagnostic.test.py"}
        tags = {
            "gridly-storekit-diagnostic-certify-15-" + certified:
                ("bb496cafcbeaf7d6aaf6574e6b5561ac242599fc", certified),
            "gridly-storekit-testflight-deliver-15-" + owner:
                ("15a2d8093f31ccaea515b715e604c803d89af469", owner),
            "gridly-storekit-preflight-15-" + previous:
                ("41b9592697daf7898b66dd582b6da3af5dc8412d", previous),
        }
        def git(*args):
            return subprocess.check_output(["git", *args], cwd=ROOT)
        # A. Historical objects remain immutable and independently reproducible.
        self.assertEqual(d.DELIVERY_SOURCE, owner)
        for child, parent in ((previous, owner), (owner, preparation), (preparation, certified)):
            self.assertEqual(git("show", "-s", "--format=%P", child).decode().strip(), parent)
        for name, (tag_object, target) in tags.items():
            ref = "refs/tags/" + name
            self.assertEqual(git("rev-parse", "--verify", ref).decode().strip(), tag_object)
            self.assertEqual(git("cat-file", "-t", ref).decode().strip(), "tag")
            self.assertEqual(git("rev-parse", "--verify", ref + "^{}").decode().strip(), target)
        for path in delivery_files:
            self.assertEqual(git("show", previous + ":" + path), git("show", owner + ":" + path), path)
        historical_preflight = "refs/tags/gridly-storekit-preflight-15-" + previous
        for path in d.FILES:
            self.assertEqual(git("show", historical_preflight + ":" + path),
                             git("show", previous + ":" + path), path)
        # The amended test is the ONLY preflight file allowed to differ now.
        for path in d.FILES - {"tests/storekit-preflight-diagnostic.test.py"}:
            self.assertEqual((ROOT/path).read_bytes().replace(b"\r\n", b"\n"),
                             git("show", previous + ":" + path), path)

        # B. This exact working candidate, or ONE clean direct child, only.
        # Neither subsets nor arbitrary later commits can use this exception.
        def check_refinement(records, modes, head, parents, dirty):
            self.assertEqual(len(records), 4)
            self.assertEqual(set(records), {"M\t" + path for path in refinement})
            self.assertEqual(set(modes), refinement)
            self.assertTrue(all(value == "100644" for value in modes.values()))
            if head != previous:
                self.assertEqual(parents, previous)
                self.assertFalse(dirty)
        records = git("diff", "--name-status", "--no-renames", previous).decode().splitlines()
        head = git("rev-parse", "HEAD").decode().strip()
        parents = git("show", "-s", "--format=%P", head).decode().strip()
        modes = {}
        for record in git("diff", "--raw", "--no-renames", previous).decode().splitlines():
            metadata, path = record.split("\t")
            modes[path] = metadata.split()[1]
        dirty = git("status", "--porcelain=v1", "--untracked-files=normal")
        self.assertFalse(git("ls-files", "--others", "--exclude-standard"))
        check_refinement(records, modes, head, parents, dirty)
        if head != previous:
            committed = git("diff", "--name-status", "--no-renames", previous, head).decode().splitlines()
            self.assertEqual(committed, records)
        # Negative cases prove this is not a general protected-file exclusion.
        good = ["M\t" + path for path in sorted(refinement)]
        good_modes = dict.fromkeys(refinement, "100644")
        for bad in (good[:-1], good + [good[0]],
                    good + ["M\tjs/gridly-paid-ui.mjs"],
                    good + ["M\t.github/workflows/gridly-storekit-preflight-diagnostic.yml"],
                    ["A\t" + row[2:] for row in good]):
            with self.subTest(inventory=bad), self.assertRaises(AssertionError):
                check_refinement(bad, good_modes, previous, owner, b"")
        for bad_modes, bad_parent, bad_dirty in (
            ({**good_modes, next(iter(refinement)): "100755"}, previous, b""),
            (good_modes, owner, b""), (good_modes, previous + " " + owner, b""),
            (good_modes, previous, b" M js/gridly-paid-ui.mjs"),
        ):
            with self.subTest(parent=bad_parent, dirty=bad_dirty), self.assertRaises(AssertionError):
                check_refinement(good, bad_modes, "1"*40, bad_parent, bad_dirty)
        # All original release/certification/runtime/baseline assertions remain.
        protected = [
            ".github/workflows/gridly-storekit-diagnostic-certification.yml",
            "tools/apple_storekit_diagnostic_certification.py",
            ".github/workflows/gridly-apple-build-9.yml", "tools/apple_native_parity.py",
            "ios/App/App/GridlyStoreKitPlugin.swift", "ios/App/App/GridlyBridgeViewController.swift",
            "ios/App/App.xcodeproj/project.pbxproj", "android/app/build.gradle",
            "js/gridly-apple-storekit.mjs", "js/gridly-paid-access.mjs", "js/gridly-paid-ui.mjs",
            "js/gridly-entitlement.mjs", "js/gridly-store-verification.mjs",
            "tests/storekit-diagnostics.test.mjs", "tests/storekit-diagnostics-native.test.py",
            "tests/build13-native-pending-recovery.test.cjs",
        ]
        for path in protected:
            self.assertEqual((ROOT/path).read_bytes().replace(b"\r\n", b"\n"),
                             git("show", owner + ":" + path).replace(b"\r\n", b"\n"), path)

    def test_python_sources_parse_without_bytecode_or_execution(self):
        ast.parse(self.helper)
        ast.parse(Path(__file__).read_text())

    def test_shell_bodies_parse_without_execution(self):
        bash=Path("C:/Program Files/Git/bin/bash.exe") if os.name=="nt" else Path("/bin/bash")
        blocks=re.findall(r"        run: \|\n((?:(?:          .*)?\n)+)",self.workflow)
        self.assertEqual(len(blocks),2)
        for block in blocks:
            body="\n".join(line[10:] for line in block.splitlines())+"\n"
            subprocess.run([str(bash),"-n"],input=body,text=True,capture_output=True,check=True)


if __name__=="__main__":
    unittest.main()
