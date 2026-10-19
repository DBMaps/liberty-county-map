"""Local delivery gates: synthetic metadata/material only; never build, sign or call Apple."""
import copy
import hashlib
import json
import os
import plistlib
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import apple_storekit_testflight_delivery as delivery

COMMIT = "1" * 40
REF = delivery.PREFIX + COMMIT
NOW = 1792364400
STAMP = delivery.dt.datetime.fromtimestamp(NOW, delivery.dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/gridly-storekit-testflight-delivery.yml"


def authorization():
    return {**dict.fromkeys(delivery.CONFIRMATIONS, True), "delivery_commit": COMMIT,
            "certified_source_commit": delivery.SOURCE, "certification_run_id": delivery.RUN,
            "diagnostic_build_number": "15", "owner_checks_at": STAMP}


def event():
    return {"repository": {"full_name": delivery.REPOSITORY}, "created": True, "deleted": False,
            "forced": False, "ref": REF, "after": COMMIT}


def proof(ipa):
    activation = delivery.cert.activation_report_expected({}, "15")
    return {"status": "certified", "source_commit": COMMIT, "build": "15",
            "identity": {"CFBundleIdentifier": delivery.cert.release.BUNDLE, "CFBundleVersion": "15",
                         "CFBundleShortVersionString": "1.0.0", "UIDeviceFamily": [1]},
            "signed_artifacts_unchanged": True, "original_contracts_unchanged": True, "distribution_performed": False,
            "activation": activation, "web_files": 1005, "ipa_sha256": hashlib.sha256(ipa.read_bytes()).hexdigest()}


def fixture(root):
    (root / "reports").mkdir()
    (root / "home").mkdir()
    (root / "export").mkdir()
    ipa = root / "export/synthetic.ipa"
    ipa.write_bytes(b"NOT_AN_APP_OR_SIGNED_IPA")
    delivery.write_json(root / "reports/delivery-authorization.json",
                        {"authorization": authorization(), "ref": REF, "source_commit": COMMIT, "build": "15"})
    guard = {"source_commit": COMMIT, "certified_source_commit": delivery.SOURCE, "build": "15",
             "runtime_unchanged": True, "original_contracts_unchanged": True}
    historical = {"run": delivery.RUN, "source_commit": delivery.SOURCE, "attempt": 1, "status": "success", "artifacts": 0}
    delivery.write_json(root / "reports/delivery-preflight.json", {**guard, "historical_certification": historical})
    delivery.write_json(root / "reports/storekit-diagnostic-certification.json", proof(ipa))
    # Real baseline policy reads this synthetic complete TAP; no baseline assertion is altered.
    tap = root / "reports/storekit-diagnostic-regressions.tap"
    tap.write_text("TAP version 13\nnot ok 1 - " + delivery.cert.FAILURE + "\n1..1\n# tests 1\n# fail 1\n# skipped 0\n# cancelled 0\n# todo 0\n")
    delivery.write_json(root / "reports/storekit-diagnostic-regressions.json", delivery.cert.check_regressions(tap, 1, True))
    for path in (root / "DiagnosticExportOptions.plist", root / "export/ExportOptions.plist"):
        path.write_bytes(plistlib.dumps({"testFlightInternalTestingOnly": True, "method": "app-store-connect",
                                        "destination": "export", "manageAppVersionAndBuildNumber": False}))
    return ipa, guard


class AuthorizationTests(unittest.TestCase):
    def test_exact_independent_authorization_passes(self):
        self.assertEqual(delivery.owner_authorization(authorization(), COMMIT, REF, NOW), authorization())

    def test_each_missing_false_or_nonboolean_confirmation_fails(self):
        for field in delivery.CONFIRMATIONS:
            for value in (None, False, 1, "true"):
                candidate = authorization()
                if value is None:
                    del candidate[field]
                else:
                    candidate[field] = value
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_wrong_source_build_run_and_extra_fields_fail(self):
        for key, value in [("delivery_commit", "2"*40), ("certified_source_commit", "3"*40),
                           ("diagnostic_build_number", "14"), ("diagnostic_build_number", 15),
                           ("certification_run_id", str(delivery.RUN)), ("extra", True)]:
            candidate = {**authorization(), key: value}
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_old_certification_and_branch_refs_cannot_authorize_upload(self):
        for ref in ("refs/heads/codex/storekit-diagnostics", delivery.cert.TAG_PREFIX + "15-" + delivery.SOURCE, REF + "x", REF.upper()):
            with self.subTest(ref=ref), self.assertRaises(ValueError):
                delivery.owner_authorization(authorization(), COMMIT, ref, NOW)

    def test_expired_future_and_malformed_owner_settings_fail(self):
        for now in (NOW-1, NOW+1801):
            with self.assertRaises(ValueError):
                delivery.owner_authorization(authorization(), COMMIT, REF, now)
        with self.assertRaises(ValueError):
            delivery.owner_authorization({**authorization(), "owner_checks_at": "yesterday"}, COMMIT, REF, NOW)

    def test_duplicate_annotation_keys_fail(self):
        with self.assertRaises(ValueError):
            json.loads('{"testflight_upload_authorized":true,"testflight_upload_authorized":false}', object_pairs_hook=delivery.cert.unique_json_object)

    def test_event_branch_updates_forced_tags_and_reruns_fail(self):
        for changes, attempt in [({"created": False}, "1"), ({"forced": True}, "1"), ({"deleted": True}, "1"),
                                  ({"ref": "refs/heads/main"}, "1"), ({"after": "4"*40}, "1"), ({}, "2"),
                                  ({"repository": {"full_name": "elsewhere/repository"}}, "1")]:
            with self.subTest(changes=changes, attempt=attempt), self.assertRaises(ValueError):
                delivery.event_gate({**event(), **changes}, REF, COMMIT, attempt, "5"*40)

    def test_annotated_tag_object_or_peeled_commit_event_passes(self):
        for after in (COMMIT, "5"*40):
            delivery.event_gate({**event(), "after": after}, REF, COMMIT, "1", "5"*40)

    def test_annotated_direct_tag_is_required(self):
        values = {("rev-parse", "HEAD"): COMMIT.encode(), ("rev-parse", "--verify", delivery.cert.DIAGNOSTIC_BRANCH): COMMIT.encode(),
                  ("cat-file", "-t", REF): b"tag",
                  ("cat-file", "-p", REF): ("object " + COMMIT + "\ntype commit\ntag " + REF.removeprefix("refs/tags/") + "\ntagger Synthetic\n\n" + json.dumps(authorization())).encode(),
                  ("rev-parse", "--verify", REF): b"5"*40}
        with patch.object(delivery.cert, "git", side_effect=lambda *args: values[args]), patch.object(delivery, "read_json", return_value=event()), patch.object(delivery.time, "time", return_value=NOW):
            self.assertEqual(delivery.authorize(REF, COMMIT, "synthetic", "1")["build"], "15")
            for replacement in (b"commit", b"blob"):
                values[("cat-file", "-t", REF)] = replacement
                with self.assertRaises(ValueError):
                    delivery.authorize(REF, COMMIT, "synthetic", "1")


class SourceAndEvidenceTests(unittest.TestCase):
    def test_changed_runtime_or_inventory_or_modes_cannot_pass(self):
        records = "\n".join("A\t" + path for path in sorted(delivery.FILES)).encode()
        for records_to_test, valid in [(records, True), (records+b"\nM\tjs/gridly-paid-ui.mjs", False),
                                       (records.replace(b"A\ttools/", b"M\ttools/"), False), (b"", False)]:
            def git(*args):
                if args == ("rev-parse", "HEAD"): return COMMIT.encode()
                if args[:2] == ("show", "-s"): return delivery.SOURCE.encode()
                if args[:2] == ("diff", "--name-status"): return records_to_test
                return b""
            with self.subTest(records=records_to_test), patch.object(delivery.cert, "git", side_effect=git), patch.object(delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"):
                if valid:
                    self.assertTrue(delivery.source_guard(COMMIT, True)["runtime_unchanged"])
                else:
                    with self.assertRaises(ValueError): delivery.source_guard(COMMIT, True)

    def test_incorrect_checkout_and_unclean_source_fail(self):
        with patch.object(delivery.cert, "git", return_value=b"9"*40), self.assertRaises(ValueError):
            delivery.source_guard(COMMIT, True)
        with self.assertRaises(ValueError):
            delivery.source_guard(delivery.SOURCE, True)

    def test_additional_or_merged_delivery_ancestry_is_rejected(self):
        for parents in ("9"*40, delivery.SOURCE + " " + "8"*40):
            def git(*args):
                return COMMIT.encode() if args == ("rev-parse", "HEAD") else parents.encode()
            with self.subTest(parents=parents), patch.object(delivery.cert, "git", side_effect=git), self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)

    def test_missing_or_unsuccessful_historical_certificate_fails(self):
        run = {"id": delivery.RUN, "head_sha": delivery.SOURCE, "run_attempt": 1, "status": "completed", "conclusion": "success",
               "path": ".github/workflows/gridly-storekit-diagnostic-certification.yml", "event": "push", "head_branch": "gridly-storekit-diagnostic-certify-15-" + delivery.SOURCE}
        jobs = {"total_count": 1, "jobs": [{"name": "certify-storekit-diagnostics", "conclusion": "success", "steps": [{"conclusion": "success"}]}]}
        artifacts = {"total_count": 0, "artifacts": []}
        def get(url):
            return jobs if "/jobs?" in url else artifacts if "/artifacts?" in url else run
        self.assertEqual(delivery.historical_evidence(get)["status"], "success")
        for field, value in [("head_sha", COMMIT), ("conclusion", "failure"), ("run_attempt", 2), ("id", 0), ("path", "other.yml")]:
            old = run[field]; run[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError): delivery.historical_evidence(get)
            run[field] = old
        jobs["jobs"][0]["steps"][0]["conclusion"] = "skipped"
        with self.assertRaises(ValueError): delivery.historical_evidence(get)
        jobs["jobs"][0]["steps"][0]["conclusion"] = "success"
        artifacts["total_count"] = 1
        with self.assertRaises(ValueError): delivery.historical_evidence(get)

    def test_original_release_safeguards_unchanged(self):
        delivery.cert.original_contracts()
        protected = delivery.cert.ALLOWED | {".github/workflows/gridly-apple-build-9.yml", "tools/apple_native_parity.py",
                                            "ios/App/App/GridlyBridgeViewController.swift", "ios/App/App.xcodeproj/project.pbxproj",
                                            "android/app/build.gradle", "js/gridly-entitlement.mjs", "js/gridly-store-verification.mjs"}
        for path in protected:
            self.assertEqual((ROOT / path).read_bytes().replace(b"\r\n", b"\n"), delivery.cert.git("show", delivery.SOURCE + ":" + path).replace(b"\r\n", b"\n"), path)


class CertificationAndTransferTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.ipa, self.guard = fixture(self.root)
        self.addCleanup(patch.stopall)
        patch.object(delivery, "source_guard", return_value=self.guard).start()
        patch.object(delivery.time, "time", return_value=NOW).start()

    def test_complete_signed_certificate_and_baseline_exception_pass(self):
        _, regressions = delivery.ready(self.root, COMMIT, self.ipa)
        self.assertEqual(regressions["status"], "baseline_exception")
        self.assertFalse(regressions["suite_green"])

    def test_missing_certificate_prevents_any_credential_or_upload_access(self):
        (self.root / "reports/storekit-diagnostic-certification.json").unlink()
        with patch.object(delivery, "api_token") as signer, patch.object(delivery.subprocess, "run") as execute, self.assertRaises(FileNotFoundError):
            delivery.transfer(self.root, COMMIT, self.ipa, credentials={})
        signer.assert_not_called(); execute.assert_not_called()

    def test_signing_parity_identity_activation_or_build_failure_blocks_upload(self):
        for key, value in [("status", "failed"), ("build", "14"), ("source_commit", delivery.SOURCE), ("signed_artifacts_unchanged", False),
                           ("original_contracts_unchanged", False), ("activation", {}), ("web_files", 1004),
                           ("distribution_performed", True), ("identity", {})]:
            candidate = {**proof(self.ipa), key: value}
            delivery.write_json(self.root / "reports/storekit-diagnostic-certification.json", candidate)
            with self.subTest(key=key), patch.object(delivery.subprocess, "run") as execute, self.assertRaises(ValueError):
                delivery.transfer(self.root, COMMIT, self.ipa, credentials={})
            execute.assert_not_called()

    def test_changed_ipa_or_missing_preflight_blocks_upload(self):
        self.ipa.write_bytes(b"changed synthetic artifact")
        with self.assertRaises(ValueError): delivery.ready(self.root, COMMIT, self.ipa)
        self.ipa.write_bytes(b"NOT_AN_APP_OR_SIGNED_IPA")
        (self.root / "reports/delivery-preflight.json").unlink()
        with self.assertRaises(FileNotFoundError): delivery.ready(self.root, COMMIT, self.ipa)

    def test_noninternal_export_cannot_upload(self):
        for key, value in [("testFlightInternalTestingOnly", False), ("manageAppVersionAndBuildNumber", True), ("destination", "upload")]:
            options = {"testFlightInternalTestingOnly": True, "method": "app-store-connect", "destination": "export", "manageAppVersionAndBuildNumber": False, key: value}
            (self.root / "export/ExportOptions.plist").write_bytes(plistlib.dumps(options))
            with self.subTest(key=key), self.assertRaises(ValueError): delivery.ready(self.root, COMMIT, self.ipa)

    def test_new_regression_is_not_hidden(self):
        (self.root / "reports/storekit-diagnostic-regressions.tap").write_text("not ok 1 - NEW FAILURE\n# tests 1\n# fail 1\n")
        with self.assertRaises(AssertionError): delivery.ready(self.root, COMMIT, self.ipa)

    def fake_upload(self, *, existing=False, fail=False):
        calls = []
        def get(path, token):
            self.assertEqual(token, "SYNTHETIC_NOT_A_JWT")
            calls.append("apps" if path.startswith("/v1/apps?") else "builds")
            if path.startswith("/v1/apps?"):
                return {"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": delivery.cert.release.BUNDLE}}]}
            return {"data": [{"id": "synthetic"}] if existing else []}
        def execute(command, **options):
            action = command[-1]
            calls.append(action)
            if fail and action == "--upload-app": raise subprocess.CalledProcessError(1, command, stderr="PRIVATE NEVER PRINT")
        creds = {"ASC_KEY_ID": "SYNTHETIC1", "ASC_ISSUER_ID": "00000000-0000-0000-0000-000000000000",
                 "ASC_PRIVATE_KEY_P8_BASE64": delivery.base64.b64encode(b"-----BEGIN PRIVATE KEY-----\nNOT_A_REAL_KEY\n-----END PRIVATE KEY-----").decode()}
        return calls, dict(credentials=creds, token_factory=lambda *args: "SYNTHETIC_NOT_A_JWT", get=get, execute=execute, clock=lambda: NOW)

    def test_validate_then_live_unused_check_then_exactly_one_upload(self):
        calls, options = self.fake_upload()
        delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls, ["--validate-app", "apps", "builds", "--upload-app"])
        self.assertEqual(delivery.read_json(self.root / "reports/delivery-transfer.json")["status"], "ACCEPTED")
        with self.assertRaises(ValueError): delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls.count("--upload-app"), 1)

    def test_existing_build_prevents_upload(self):
        calls, options = self.fake_upload(existing=True)
        with self.assertRaises(ValueError): delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertNotIn("--upload-app", calls)

    def test_uncertain_acceptance_records_attempt_and_does_not_retry(self):
        calls, options = self.fake_upload(fail=True)
        with self.assertRaises(subprocess.CalledProcessError): delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(delivery.read_json(self.root / "reports/delivery-transfer.json")["status"], "ATTEMPTED")
        with self.assertRaises(ValueError): delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls.count("--upload-app"), 1)

    def test_apple_validation_failure_prevents_availability_and_upload(self):
        calls, options = self.fake_upload()
        def reject(command, **kwargs):
            calls.append(command[-1])
            raise subprocess.CalledProcessError(1, command)
        options["execute"] = reject
        with self.assertRaises(subprocess.CalledProcessError):
            delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls, ["--validate-app"])

    def test_ipa_changed_during_validation_never_reaches_apple_upload(self):
        calls, options = self.fake_upload()
        def corrupt(command, **kwargs):
            calls.append(command[-1])
            self.ipa.write_bytes(b"ALTERED")
        options["execute"] = corrupt
        with self.assertRaises(ValueError):
            delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls, ["--validate-app"])

    def test_live_availability_timeout_prevents_upload(self):
        calls, options = self.fake_upload()
        moments = iter([NOW, NOW+61])
        options["clock"] = lambda: next(moments)
        with self.assertRaises(ValueError):
            delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertNotIn("--upload-app", calls)

    def test_missing_existing_api_credentials_fail_without_requests(self):
        with patch.object(delivery, "api_token") as signer, patch.object(delivery.subprocess, "run") as execute, patch.object(delivery.cert, "original_contracts"), self.assertRaises(ValueError):
            delivery.transfer(self.root, COMMIT, self.ipa, credentials={})
        signer.assert_not_called(); execute.assert_not_called()


class AvailabilityAndCleanupTests(unittest.TestCase):
    def test_wrong_app_ambiguous_builds_and_pagination_fail_closed(self):
        for apps, builds in [({}, {}), ({"data": []}, {}), ({"data": [], "errors": [{"code": "synthetic"}]}, {}), ({"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": "other.app"}}]}, {}),
                            ({"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": delivery.cert.release.BUNDLE}}]}, {}),
                            ({"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": delivery.cert.release.BUNDLE}}]}, {"data": [], "links": {"next": "unexpected"}}),
                            ({"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": delivery.cert.release.BUNDLE}}]}, {"data": [], "meta": {"paging": {"total": 1}}}),
                            ({"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": delivery.cert.release.BUNDLE}}]}, {"data": [], "errors": [{"code": "synthetic"}]})]:
            with self.subTest(apps=apps, builds=builds), self.assertRaises(ValueError):
                delivery.unused_build(lambda path: apps if path.startswith("/v1/apps?") else builds)

    def test_credentials_cannot_follow_http_redirects(self):
        with self.assertRaises(ValueError):
            delivery.NoRedirect().redirect_request(None, None, 302, "", {}, "https://elsewhere.example")

    def test_cleanup_failure_is_failure_and_summary_never_echoes_private_fields(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = delivery.cert.private_directory(temporary)
            root.mkdir(); (root / ".owned").write_text(delivery.cert.PRIVATE_MARKER)
            (root / "reports").mkdir()
            delivery.write_json(root / "reports/delivery-transfer.json", {"status": "ACCEPTED", "source_commit": "PRIVATE NEVER PRINT", "build": "15"})
            with patch.object(delivery.cert, "cleanup_private", return_value=False):
                result = delivery.finish(temporary, "success")
            self.assertEqual(result["certification"], "FAIL")
            self.assertEqual(result["cleanup"], "FAIL")
            self.assertNotIn("PRIVATE", json.dumps(result))

    def test_cleanup_alone_can_turn_accepted_certification_into_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = delivery.cert.private_directory(temporary)
            root.mkdir()
            (root / ".owned").write_text(delivery.cert.PRIVATE_MARKER)
            fixture(root)
            delivery.write_json(root / "reports/delivery-transfer.json", {"status": "ACCEPTED", "source_commit": COMMIT, "build": "15"})
            with patch.object(delivery.cert, "cleanup_private", return_value=False):
                result = delivery.finish(temporary, "success")
            self.assertEqual(result["upload"], "ACCEPTED")
            self.assertEqual(result["regressions"], "BASELINE_EXCEPTION")
            self.assertEqual(result["cleanup"], "FAIL")
            self.assertEqual(result["certification"], "FAIL")

    def test_private_generated_source_signed_output_and_key_are_removed(self):
        with tempfile.TemporaryDirectory() as temporary:
            env = Path(temporary) / "env"
            delivery.cert.prepare_private(temporary, env)
            root = delivery.cert.private_directory(temporary)
            for name in ("home/.appstoreconnect/private_keys/synthetic.p8", "source/www/config.json", "archive/App.app/file", "export/synthetic.ipa", "logs/raw.log", "reports/private.json"):
                path = root / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_text("SYNTHETIC_PRIVATE")
            result = delivery.finish(temporary, "failure")
            self.assertEqual(result["cleanup"], "PASS")
            self.assertEqual(result["certification"], "FAIL")
            self.assertFalse(root.exists())


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.text = WORKFLOW.read_text()

    def test_only_separate_new_tag_can_trigger(self):
        trigger = self.text.split("\non:\n", 1)[1].split("\npermissions:", 1)[0]
        self.assertEqual(trigger.strip(), "push:\n    tags:\n      - 'gridly-storekit-testflight-deliver-15-*'")
        for clause in ["github.event.created == true", "github.event.deleted == false", "github.event.forced == false", "github.run_attempt == 1", "github.repository == 'DBMaps/liberty-county-map'"]:
            self.assertIn(clause, self.text)
        self.assertNotIn("repository.private", self.text)

    def test_full_native_certification_precedes_upload_secret_access(self):
        self.assertLess(self.text.index("python3 -B tools/apple_storekit_diagnostic_certification.py certify"), self.text.index("ASC_PRIVATE_KEY_P8_BASE64:"))
        self.assertLess(self.text.index("apple_storekit_testflight_delivery.py authorize"), self.text.index("secrets."))
        for value in ["macos-26", "'22'", "^Xcode 26", "GRIDLY_STOREKIT_DIAGNOSTICS", "tests/build14-native-lifecycle.test.py", "tests/apple_native_parity_test.py", "tests/storekit-diagnostics-native.test.py", "activation --build-number"]:
            self.assertIn(value, self.text)

    def test_no_public_artifacts_cache_groups_release_or_old_workflow_changes(self):
        self.assertNotRegex(self.text, r"uses:.*(?:upload-artifact|cache|download-artifact)")
        self.assertNotRegex(self.text, r"\n\s+cache:")
        self.assertNotRegex(self.text, r"(?:pilot|fastlane|appStoreVersions|betaGroups|betaTesters|reviewSubmissions|--submit|--release)")
        self.assertIn("persist-credentials: false", self.text)
        self.assertIn("if: always()", self.text)
        self.assertIn("finish-public", self.text)
        self.assertIn("git clone --no-hardlinks", self.text)
        self.assertIn('cd "$DELIVERY_SOURCE_DIR"', self.text)

    def test_all_sensitive_shell_blocks_redirect_before_commands(self):
        blocks = re.findall(r"        run: \|\n((?:(?:          .*)?\n)+)", self.text)
        self.assertEqual(len(blocks), 10)
        for block in blocks[1:-1]:
            self.assertRegex(block, r'^          set -euo pipefail\n          set \+x\n          umask 077\n          exec > "\$DIAGNOSTIC_PRIVATE_ROOT/logs/step-[1-8]\.log" 2>&1\n')
        self.assertIn("testFlightInternalTestingOnly", self.text)
        self.assertIn("manageAppVersionAndBuildNumber", self.text)

    def test_each_shell_body_parses_without_running(self):
        bash = Path("C:/Program Files/Git/bin/bash.exe") if os.name == "nt" else Path("/bin/bash")
        blocks = re.findall(r"        run: \|\n((?:(?:          .*)?\n)+)", self.text)
        for block in blocks:
            body = "\n".join(line[10:] if line.startswith("          ") else line for line in block.splitlines()) + "\n"
            subprocess.run([str(bash), "-n"], input=body, text=True, check=True, capture_output=True)


if __name__ == "__main__":
    unittest.main()
