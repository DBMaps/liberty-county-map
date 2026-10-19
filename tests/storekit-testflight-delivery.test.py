"""Local delivery gates: synthetic metadata/material only; never build, sign or call Apple."""
import ast
import copy
import contextlib
import hashlib
import io
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


def owner_automatic_authorization():
    return {**authorization(), "testflight_auto_distribution_disabled": False,
            delivery.OWNER_AUTO_FIELD: {
                **dict.fromkeys(delivery.OWNER_AUTO_CONFIRMATIONS, True),
                "group_name": "Gridly Internal", "authorized_owner_account_count": 2,
            }}


def source_git(*, parent=delivery.SIGNING_VERIFIED_BASE, base_parent=delivery.SOURCE,
               owner_parent=delivery.DELIVERY_BASE, preflight_parent=delivery.OWNER_CORRECTION,
               preparation=None, past_correction=None, preflight_inventory=None,
               historical_refinement=None, signing_inventory=None, cms_inventory=None,
               refinement_parent=delivery.PREFLIGHT_BASE, signing_parent=delivery.REFINEMENT_BASE,
               cms_parent=delivery.SIGNING_BASE, repair_parent=delivery.CMS_BASE,
               verified_parent=delivery.CMS_REPAIR_BASE, repair_inventory=None, verification_inventory=None,
               correction=None, net=None, mode="100644", dirty=b"", staged=b"", untracked=b"",
               tag_object=None, tag_target=None, tag_type=None, missing_tag=None):
    additions = "\n".join("A\t" + path for path in sorted(delivery.FILES)).encode()
    modifications = "\n".join("M\t" + path for path in sorted(delivery.FILES)).encode()
    repair = "\n".join("M\t" + path for path in sorted(delivery.REPAIR_FILES)).encode()
    verification = "\n".join("M\t" + path for path in sorted(delivery.SIGNING_VERIFICATION_FILES)).encode()
    alignment = "\n".join("M\t" + path for path in sorted(delivery.DELIVERY_ALIGNMENT_FILES)).encode()
    refinement = "\n".join("M\t" + path for path in sorted(delivery.REFINEMENT_FILES)).encode()
    preflight = "\n".join("A\t" + path for path in sorted(delivery.PREFLIGHT_FILES)).encode()
    all_additions = "\n".join("A\t" + path for path in sorted(delivery.FILES | delivery.PREFLIGHT_FILES | delivery.SIGNING_FILES | delivery.CMS_FILES)).encode()
    values = {
        ("rev-parse", "HEAD"): COMMIT.encode(),
        ("show", "-s", "--format=%P", COMMIT): parent.encode(),
        ("show", "-s", "--format=%P", delivery.REFINEMENT_BASE): refinement_parent.encode(),
        ("show", "-s", "--format=%P", delivery.SIGNING_BASE): signing_parent.encode(),
        ("show", "-s", "--format=%P", delivery.CMS_BASE): cms_parent.encode(),
        ("show", "-s", "--format=%P", delivery.CMS_REPAIR_BASE): repair_parent.encode(),
        ("show", "-s", "--format=%P", delivery.SIGNING_VERIFIED_BASE): verified_parent.encode(),
        ("show", "-s", "--format=%P", delivery.PREFLIGHT_BASE): preflight_parent.encode(),
        ("show", "-s", "--format=%P", delivery.OWNER_CORRECTION): owner_parent.encode(),
        ("show", "-s", "--format=%P", delivery.DELIVERY_BASE): base_parent.encode(),
        ("diff", "--name-status", "--no-renames", delivery.SOURCE, delivery.DELIVERY_BASE): additions if preparation is None else preparation,
        ("diff", "--name-status", "--no-renames", delivery.DELIVERY_BASE, delivery.OWNER_CORRECTION): modifications if past_correction is None else past_correction,
        ("diff", "--name-status", "--no-renames", delivery.OWNER_CORRECTION, delivery.PREFLIGHT_BASE): preflight if preflight_inventory is None else preflight_inventory,
        ("diff", "--name-status", "--no-renames", delivery.PREFLIGHT_BASE, delivery.REFINEMENT_BASE): refinement if historical_refinement is None else historical_refinement,
        ("diff", "--name-status", "--no-renames", delivery.REFINEMENT_BASE, delivery.SIGNING_BASE):
            "\n".join("A\t" + path for path in sorted(delivery.SIGNING_FILES)).encode() if signing_inventory is None else signing_inventory,
        ("diff", "--name-status", "--no-renames", delivery.SIGNING_BASE, delivery.CMS_BASE):
            "\n".join("A\t" + path for path in sorted(delivery.CMS_FILES)).encode() if cms_inventory is None else cms_inventory,
        ("diff", "--name-status", "--no-renames", delivery.CMS_BASE, delivery.CMS_REPAIR_BASE): repair if repair_inventory is None else repair_inventory,
        ("diff", "--name-status", "--no-renames", delivery.CMS_REPAIR_BASE, delivery.SIGNING_VERIFIED_BASE): verification if verification_inventory is None else verification_inventory,
        ("diff", "--name-status", "--no-renames", delivery.SIGNING_VERIFIED_BASE, COMMIT): alignment if correction is None else correction,
        ("diff", "--name-status", "--no-renames", delivery.SOURCE, COMMIT): all_additions if net is None else net,
        ("diff", "--name-only", "HEAD"): dirty,
        ("diff", "--cached", "--name-only"): staged,
        ("status", "--porcelain=v1", "--untracked-files=normal"): untracked,
    }
    for target,files in ((delivery.DELIVERY_BASE,delivery.FILES),(delivery.OWNER_CORRECTION,delivery.FILES),
                         (delivery.PREFLIGHT_BASE,delivery.PREFLIGHT_FILES),(delivery.REFINEMENT_BASE,delivery.REFINEMENT_FILES),
                         (delivery.SIGNING_BASE,delivery.SIGNING_FILES),(delivery.CMS_BASE,delivery.CMS_FILES),
                         (delivery.CMS_REPAIR_BASE,delivery.REPAIR_FILES),
                         (delivery.SIGNING_VERIFIED_BASE,delivery.SIGNING_VERIFICATION_FILES)):
        for path in files:
            values[("ls-tree",target,"--",path)]=("100644 blob "+"0"*40+"\t"+path).encode()
    for path in delivery.FILES | delivery.PREFLIGHT_FILES | delivery.SIGNING_FILES | delivery.CMS_FILES:
        values[("ls-tree", COMMIT, "--", path)] = (mode + " blob " + "0"*40 + "\t" + path).encode()
    for name, (original_object, original_target) in delivery.HISTORICAL_TAGS.items():
        ref = "refs/tags/" + name
        values[("rev-parse", "--verify", ref)] = (tag_object or original_object).encode()
        values[("cat-file", "-t", ref)] = (tag_type or "tag").encode()
        values[("rev-parse", "--verify", ref + "^{}")] = (tag_target or original_target).encode()
    def git(*args):
        if missing_tag and args == ("rev-parse", "--verify", "refs/tags/" + missing_tag):
            raise subprocess.CalledProcessError(128, ["git", *args])
        return values[args]
    return git


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

    def test_owner_only_automatic_distribution_requires_explicit_complete_authorization(self):
        candidate = owner_automatic_authorization()
        self.assertEqual(delivery.owner_authorization(candidate, COMMIT, REF, NOW), candidate)
        self.assertIs(candidate["testflight_auto_distribution_disabled"], False)
        self.assertEqual(candidate[delivery.OWNER_AUTO_FIELD]["authorized_owner_account_count"], 2)

    def test_owner_only_missing_false_nonboolean_or_extra_nested_confirmations_fail(self):
        required = delivery.OWNER_AUTO_CONFIRMATIONS | {"group_name", "authorized_owner_account_count"}
        for field in required:
            candidate = owner_automatic_authorization()
            del candidate[delivery.OWNER_AUTO_FIELD][field]
            with self.subTest(missing=field), self.assertRaises(ValueError):
                delivery.owner_authorization(candidate, COMMIT, REF, NOW)
        for field in delivery.OWNER_AUTO_CONFIRMATIONS:
            for value in (False, None, 0, 1, "true"):
                candidate = owner_automatic_authorization()
                candidate[delivery.OWNER_AUTO_FIELD][field] = value
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    delivery.owner_authorization(candidate, COMMIT, REF, NOW)
        candidate = owner_automatic_authorization()
        candidate[delivery.OWNER_AUTO_FIELD]["email"] = "SYNTHETIC_PRIVATE_NEVER_LOG"
        with self.assertRaises(ValueError):
            delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_owner_only_other_account_counts_or_groups_are_rejected(self):
        for field, values in [("authorized_owner_account_count", (0, 1, 3, True, 2.0, "2", None)),
                              ("group_name", ("Other Internal", "External", "", None))]:
            for value in values:
                candidate = owner_automatic_authorization()
                candidate[delivery.OWNER_AUTO_FIELD][field] = value
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_disabled_and_owner_automatic_modes_cannot_be_mixed_or_implicitly_enabled(self):
        for value in (True, 0, 1, None, "false"):
            candidate = {**owner_automatic_authorization(), "testflight_auto_distribution_disabled": value}
            with self.subTest(value=value), self.assertRaises(ValueError):
                delivery.owner_authorization(candidate, COMMIT, REF, NOW)
        with self.assertRaises(ValueError):
            delivery.owner_authorization({**authorization(), "testflight_auto_distribution_disabled": False}, COMMIT, REF, NOW)
        for incomplete in (None, False, True, {}, []):
            candidate = {**owner_automatic_authorization(), delivery.OWNER_AUTO_FIELD: incomplete}
            with self.subTest(incomplete=incomplete), self.assertRaises(ValueError):
                delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_owner_only_common_publication_and_access_confirmations_remain_required(self):
        for field in delivery.CONFIRMATIONS - {"testflight_auto_distribution_disabled"}:
            for value in (False, None, 1, "true"):
                candidate = {**owner_automatic_authorization(), field: value}
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_owner_only_expired_future_incomplete_and_wrong_identity_authorizations_fail(self):
        for now in (NOW-1, NOW+1801):
            with self.assertRaises(ValueError):
                delivery.owner_authorization(owner_automatic_authorization(), COMMIT, REF, now)
        for field, value in [("delivery_commit", "2"*40), ("certified_source_commit", delivery.DELIVERY_BASE),
                              ("certification_run_id", 0), ("diagnostic_build_number", "14"), ("owner_checks_at", None)]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                delivery.owner_authorization({**owner_automatic_authorization(), field: value}, COMMIT, REF, NOW)
        candidate = owner_automatic_authorization()
        del candidate["owner_checks_at"]
        with self.assertRaises(ValueError):
            delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_duplicate_owner_only_confirmation_is_rejected(self):
        text = json.dumps(owner_automatic_authorization()).replace('"authorized": true', '"authorized": true, "authorized": false')
        with self.assertRaises(ValueError):
            json.loads(text, object_pairs_hook=delivery.cert.unique_json_object)

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

    def test_exact_unchanged_thirty_minute_boundary_is_enforced(self):
        self.assertEqual(delivery.OWNER_CHECK_TTL, 1800)
        for value in (authorization(), owner_automatic_authorization()):
            for moment in (NOW, NOW+1800):
                self.assertEqual(delivery.owner_authorization(value, COMMIT, REF, moment), value)
            for moment in (NOW-0.001, NOW+1800.001):
                with self.assertRaises(ValueError):
                    delivery.owner_authorization(value, COMMIT, REF, moment)

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
    def test_exact_pinned_additional_correction_passes_without_runtime_changes(self):
        with patch.object(delivery.cert, "git", side_effect=source_git()), patch.object(delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"):
            self.assertTrue(delivery.source_guard(COMMIT, True)["runtime_unchanged"])

    def test_changed_runtime_or_inventory_or_modes_cannot_pass(self):
        additions = "\n".join("A\t" + path for path in sorted(delivery.FILES)).encode()
        modifications = "\n".join("M\t" + path for path in sorted(delivery.REFINEMENT_FILES)).encode()
        for options in ({"correction": modifications+b"\nM\tjs/gridly-paid-ui.mjs"}, {"correction": b""},
                        {"correction": additions}, {"net": additions+b"\nM\tios/App/App/GridlyStoreKitPlugin.swift"},
                        {"net": b""}, {"preparation": b""}, {"past_correction": b""},
                        {"preflight_inventory": b""}, {"correction": modifications+b"\nM\ttools/apple_storekit_preflight_diagnostic.py"},
                        {"mode": "100755"}):
            with self.subTest(options=options), patch.object(delivery.cert, "git", side_effect=source_git(**options)), patch.object(delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"), self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)

    def test_incorrect_checkout_and_unclean_source_fail(self):
        with patch.object(delivery.cert, "git", return_value=b"9"*40), self.assertRaises(ValueError):
            delivery.source_guard(COMMIT, True)
        for old in (delivery.SOURCE, delivery.DELIVERY_BASE, delivery.OWNER_CORRECTION, delivery.PREFLIGHT_BASE,
                    delivery.REFINEMENT_BASE, delivery.SIGNING_BASE, delivery.CMS_BASE,
                    delivery.CMS_REPAIR_BASE, delivery.SIGNING_VERIFIED_BASE):
            with self.subTest(old=old), self.assertRaises(ValueError):
                delivery.source_guard(old, True)
        for options in ({"dirty": b"js/gridly-paid-ui.mjs"}, {"staged": b"js/gridly-paid-ui.mjs"},
                        {"untracked": b"?? unexpected.txt"}):
            with self.subTest(options=options), patch.object(delivery.cert, "git", side_effect=source_git(**options)), patch.object(delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"), self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)

    def test_additional_or_merged_delivery_ancestry_is_rejected(self):
        for options in ({"parent": "9"*40}, {"parent": delivery.SOURCE},
                        {"parent": delivery.DELIVERY_BASE + " " + "8"*40},
                        {"base_parent": "7"*40}, {"base_parent": delivery.SOURCE + " " + "8"*40},
                        {"owner_parent": "7"*40}, {"preflight_parent": "8"*40},
                        {"preflight_parent": delivery.OWNER_CORRECTION + " " + "8"*40},
                        {"refinement_parent": "8"*40}, {"signing_parent": "8"*40}, {"cms_parent": "8"*40},
                        {"cms_parent": delivery.SIGNING_BASE + " " + "8"*40},
                        {"repair_parent":"8"*40},{"verified_parent":"8"*40},
                        {"repair_parent":delivery.CMS_BASE+" "+"8"*40},
                        {"verified_parent":delivery.CMS_REPAIR_BASE+" "+"8"*40}):
            with self.subTest(options=options), patch.object(delivery.cert, "git", side_effect=source_git(**options)), self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)

    def test_pinned_real_preparation_and_historical_source_remain_exact(self):
        self.assertEqual(delivery.cert.git("show", "-s", "--format=%P", delivery.DELIVERY_BASE).decode().strip(), delivery.SOURCE)
        self.assertEqual(delivery.SOURCE, "f9fc818321970b8b7e29df17358daf87a7d20308")
        self.assertEqual(delivery.RUN, 39181592021)
        self.assertEqual(delivery.OWNER_CORRECTION, "45bfe026b81f4928caceb9632cbf15e7ed842a25")
        self.assertEqual(delivery.PREFLIGHT_BASE, "13e73183cf3f257fbc9acd9a32d34d62b70ffb1e")
        for child,parent in ((delivery.PREFLIGHT_BASE, delivery.OWNER_CORRECTION),
                             (delivery.OWNER_CORRECTION, delivery.DELIVERY_BASE)):
            self.assertEqual(delivery.cert.git("show","-s","--format=%P",child).decode().strip(),parent)
        self.assertEqual(delivery.REFINEMENT_FILES, delivery.FILES | {"tests/storekit-preflight-diagnostic.test.py"})
        for path in delivery.PREFLIGHT_FILES:
            historical = delivery.cert.git("show", delivery.PREFLIGHT_BASE + ":" + path)
            preflight_ref = "refs/tags/gridly-storekit-preflight-15-" + delivery.PREFLIGHT_BASE
            self.assertEqual(historical, delivery.cert.git("show", preflight_ref + ":" + path))
            if path != "tests/storekit-preflight-diagnostic.test.py":
                self.assertEqual((ROOT/path).read_bytes().replace(b"\r\n", b"\n"), historical)
        for name, (tag_object, target) in delivery.HISTORICAL_TAGS.items():
            ref = "refs/tags/" + name
            self.assertEqual(delivery.cert.git("rev-parse", "--verify", ref).decode().strip(), tag_object)
            self.assertEqual(delivery.cert.git("cat-file", "-t", ref).decode().strip(), "tag")
            self.assertEqual(delivery.cert.git("rev-parse", "--verify", ref + "^{}").decode().strip(), target)

    def test_each_missing_modified_or_retargeted_historical_tag_fails_closed(self):
        for name in delivery.HISTORICAL_TAGS:
            for options in ({"missing_tag": name}, {"tag_object": "9"*40},
                            {"tag_target": COMMIT}, {"tag_type": "commit"}):
                with self.subTest(tag=name, options=options), patch.object(delivery.cert, "git", side_effect=source_git(**options)), patch.object(delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"):
                    with self.assertRaises((ValueError, subprocess.CalledProcessError)):
                        delivery.source_guard(COMMIT, True)

    def test_every_refinement_file_is_mandatory_and_duplicate_records_are_rejected(self):
        records = ["M\t" + path for path in sorted(delivery.REFINEMENT_FILES)]
        candidates = [records[:index] + records[index+1:] for index in range(4)]
        candidates += [records + [records[0]], records + ["M\t.github/workflows/gridly-storekit-diagnostic-certification.yml"],
                       records + ["M\t.github/workflows/gridly-storekit-preflight-diagnostic.yml"]]
        for candidate in candidates:
            with self.subTest(candidate=candidate), patch.object(delivery.cert, "git", side_effect=source_git(historical_refinement="\n".join(candidate).encode())), patch.object(delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"), self.assertRaises(ValueError):
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

    def test_owner_only_authorization_uses_same_signed_ipa_and_transport_with_no_group_operations(self):
        report = self.root / "reports/delivery-authorization.json"
        authorization_report = delivery.read_json(report)
        authorization_report["authorization"] = owner_automatic_authorization()
        delivery.write_json(report, authorization_report)
        before = self.ipa.read_bytes()
        calls, options = self.fake_upload()
        delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls, ["--validate-app", "apps", "builds", "--upload-app"])
        self.assertEqual(self.ipa.read_bytes(), before)

    def test_unapproved_owner_only_access_is_rejected_before_credentials_or_transport(self):
        report = self.root / "reports/delivery-authorization.json"
        class NeverReadCredentials(dict):
            def get(self, *args): raise AssertionError("credentials accessed before owner-only eligibility")
        for field in ("no_other_eligible_internal_users_confirmed", "both_accounts_owned_by_owner",
                      "automatic_availability_to_both_accounts_acknowledged"):
            candidate = owner_automatic_authorization()
            candidate[delivery.OWNER_AUTO_FIELD][field] = False
            value = delivery.read_json(report)
            value["authorization"] = candidate
            delivery.write_json(report, value)
            calls, options = self.fake_upload()
            options["credentials"] = NeverReadCredentials()
            with self.subTest(field=field), self.assertRaises(ValueError):
                delivery.transfer(self.root, COMMIT, self.ipa, **options)
            self.assertEqual(calls, [])

    def test_owner_only_eligibility_expiring_after_live_build_check_prevents_upload(self):
        report = self.root / "reports/delivery-authorization.json"
        value = delivery.read_json(report)
        value["authorization"] = owner_automatic_authorization()
        delivery.write_json(report, value)
        calls, options = self.fake_upload()
        get = options["get"]
        def expire(path, token):
            result = get(path, token)
            if path.startswith("/v1/builds?"):
                delivery.time.time.return_value = NOW + 1801
            return result
        options["get"] = expire
        with self.assertRaises(ValueError):
            delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertNotIn("--upload-app", calls)

    def test_successfully_certified_but_expired_build_cannot_read_upload_credentials(self):
        class NeverReadCredentials(dict):
            def get(self,*args): raise AssertionError("credentials accessed after expiry")
        delivery.time.time.return_value = NOW+1801
        with patch.object(delivery,"api_token") as signer,patch.object(delivery.subprocess,"run") as execute,self.assertRaises(ValueError):
            delivery.transfer(self.root, COMMIT, self.ipa, credentials=NeverReadCredentials())
        signer.assert_not_called(); execute.assert_not_called()

    def test_apple_validation_crossing_original_owner_deadline_blocks_upload(self):
        calls,options=self.fake_upload()
        original=options["execute"]
        def expire(command,**kwargs):
            original(command,**kwargs)
            delivery.time.time.return_value=NOW+1801
        options["execute"]=expire
        with self.assertRaises(ValueError):
            delivery.transfer(self.root,COMMIT,self.ipa,**options)
        self.assertEqual(calls,["--validate-app"])
        self.assertFalse((self.root/"reports/delivery-transfer.json").exists())

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

    def test_accepted_upload_is_not_retroactively_rejected_by_expired_owner_timestamp(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=delivery.cert.private_directory(temporary)
            root.mkdir(); (root/".owned").write_text(delivery.cert.PRIVATE_MARKER)
            fixture(root)
            delivery.write_json(root/"reports/delivery-transfer.json",{"status":"ACCEPTED","source_commit":COMMIT,"build":"15"})
            with patch.object(delivery.time,"time",return_value=NOW+3600):
                result=delivery.finish(temporary,"success")
            self.assertEqual(result["upload"],"ACCEPTED")
            self.assertEqual(result["certification"],"PASS")
            self.assertEqual(result["cleanup"],"PASS")

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


class DeliveryPreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.ipa, self.guard = fixture(self.root)
        (self.root / "logs").mkdir()
        self.output = self.root / "reports/delivery-preflight.json"
        self.output.unlink()
        self.github_env = self.root / "github-env"
        self.github_env.write_text("")
        self.environment = {"GITHUB_SHA": COMMIT, "GITHUB_WORKSPACE": str(ROOT),
                            "GITHUB_REF": REF, "GITHUB_REF_NAME": REF.removeprefix("refs/tags/")}
        self.calls = []
        self.failures = {}
        self.history = {"run": delivery.RUN, "source_commit": delivery.SOURCE, "attempt": 1,
                        "status": "success", "artifacts": 0}
        self.addCleanup(patch.stopall)
        self.source = patch.object(delivery, "source_guard", return_value=self.guard).start()
        self.historical = patch.object(delivery, "historical_evidence", return_value=self.history).start()
        patch.object(delivery.time, "time", return_value=NOW).start()

    def execute(self, args, **options):
        self.calls.append((args, options))
        key = None
        output = b""
        if args == ["git", "rev-parse", "HEAD"]:
            key = "identity"; output = (COMMIT + "\n").encode()
        elif args == ["xcodebuild", "-version"]:
            key = "version"; output = b"Xcode 26.6\nBuild version SYNTHETIC\n"
        elif args[:2] == ["grep", "-E"]:
            key = "version_match"
            if key not in self.failures:
                return subprocess.CompletedProcess(args, 0 if re.search(rb"^Xcode 26([. ]|$)", options["input"], re.M) else 1, b"", b"")
        elif args == ["git", "cat-file", "-t", REF]:
            key = "tag"; output = b"tag\n"
        elif args == ["git", "rev-parse", REF + "^{commit}"]:
            key = "tag_sha"; output = (COMMIT + "\n").encode()
        elif args == ["git", "symbolic-ref", "-q", "HEAD"]:
            return self.failures.get("attached", subprocess.CompletedProcess(args, 1, b"", b""))
        elif args[:2] == ["git", "clone"]:
            key = "clone"
            if key not in self.failures:
                (self.root / "source").mkdir()
        elif args[:3] == ["git", "-C", str(self.root / "source")]:
            key = "clone_sha"; output = (COMMIT + "\n").encode()
        elif args == ["xcodebuild", "-help"]:
            key = "help"; output = b"\n  testFlightInternalTestingOnly : Bool\n"
        elif args[:2] == ["grep", "-Eq"]:
            key = "option"
            if key not in self.failures:
                text = Path(args[-1]).read_text()
                return subprocess.CompletedProcess(args, 0 if re.search(r"^[ \t]*testFlightInternalTestingOnly[ \t]*:", text, re.M) else 1, b"", b"")
        else:
            self.fail("unexpected command")
        if key in self.failures:
            action = self.failures[key]
            if isinstance(action, BaseException): raise action
            return action
        return subprocess.CompletedProcess(args, 0, output, b"SYNTHETIC_PRIVATE_NEVER_PUBLIC")

    def probes(self, **kwargs):
        records = delivery.delivery_preflight(self.root, COMMIT, kwargs.get("output", self.output),
                    kwargs.get("github_env", self.github_env), self.environment, execute=self.execute)
        return {record["stage"]: record for record in records}

    def test_all_eight_checks_and_original_private_report_pass(self):
        records = self.probes()
        self.assertEqual(list(records), list(delivery.PREFLIGHT_STAGES))
        self.assertTrue(all(record["status"] == "PASS" for record in records.values()))
        self.assertEqual(delivery.read_json(self.output), {**self.guard, "historical_certification": self.history})
        self.assertEqual(self.github_env.read_text(), "DELIVERY_SOURCE_DIR=" + str(self.root / "source") + "\n")
        self.source.assert_called_once_with(COMMIT, clean=True)
        self.historical.assert_called_once_with()

    def test_expired_preflight_owner_authorization_blocks_all_tooling(self):
        delivery.time.time.return_value = NOW + 1801
        records = self.probes()
        self.assertEqual(records["P01_SOURCE_SHA"]["category"], "AUTHORIZATION_REJECTED")
        self.assertFalse(self.calls); self.source.assert_not_called(); self.historical.assert_not_called()
        self.assertTrue(all(records[stage]["category"] == "DEPENDENCY_FAILED" for stage in delivery.PREFLIGHT_STAGES[1:]))

    def test_event_or_workspace_identity_mismatch_stops_independent_probes(self):
        for key, value in [("GITHUB_SHA", "f"*40), ("GITHUB_WORKSPACE", str(self.root))]:
            old = self.environment[key]; self.environment[key] = value
            records = self.probes()
            self.assertEqual(records["P01_SOURCE_SHA"]["category"], "SOURCE_SHA_MISMATCH")
            self.assertFalse(self.calls)
            self.environment[key] = old

    def test_checkout_sha_mismatch_is_identified_before_xcode(self):
        self.failures["identity"] = subprocess.CompletedProcess([], 0, b"wrong", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P01_SOURCE_SHA"]["category"], "SOURCE_SHA_MISMATCH")
        self.assertEqual(len(self.calls), 1)

    def test_wrong_xcode_version_is_distinct_and_safe_independent_checks_continue(self):
        self.failures["version"] = subprocess.CompletedProcess([], 0, b"Xcode 27.0\n", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P02_XCODE_VERSION"]["category"], "XCODE26_REQUIRED")
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["status"], "PASS")
        self.assertEqual(records["P07_XCODE_HELP"]["status"], "PASS")

    def test_xcode_version_execution_failure_is_fixed(self):
        self.failures["version"] = OSError("PRIVATE COMMAND/PATH NEVER PUBLIC")
        records = self.probes()
        self.assertEqual(records["P02_XCODE_VERSION"]["category"], "XCODE_COMMAND_FAILED")

    def test_source_guard_failure_blocks_cloning_without_claiming_a_pass(self):
        self.source.side_effect = ValueError("PRIVATE_SOURCE_DETAIL")
        records = self.probes()
        self.assertEqual(records["P03_SOURCE_GUARD"]["category"], "DELIVERY_SOURCE_REJECTED")
        self.assertEqual(records["P06_CLONE_SHA"]["category"], "DEPENDENCY_FAILED")
        self.assertFalse(any(args[:2] == ["git","clone"] for args,_ in self.calls))
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["status"], "PASS")

    def test_historical_evidence_failure_is_identified(self):
        self.historical.side_effect = ValueError("PRIVATE RESPONSE NEVER PUBLIC")
        records = self.probes()
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["category"], "CERTIFICATION_EVIDENCE_REJECTED")
        self.assertFalse(self.output.exists())
        self.assertEqual(records["P07_XCODE_HELP"]["status"], "PASS")

    def test_private_report_failure_is_identified_without_writing_outside_root(self):
        outside = ROOT / "NOT_CREATED.json"
        records = self.probes(output=outside)
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["category"], "PREFLIGHT_REPORT_FAILED")
        self.assertFalse(outside.exists())

    def test_tag_checkout_failure_blocks_clone(self):
        self.failures["tag"] = subprocess.CompletedProcess([], 0, b"commit", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P05_TAG_CHECKOUT"]["category"], "TAG_CHECKOUT_REJECTED")
        self.assertEqual(records["P06_CLONE_SHA"]["category"], "DEPENDENCY_FAILED")

    def test_wrong_tag_target_blocks_clone(self):
        self.failures["tag_sha"] = subprocess.CompletedProcess([], 0, b"wrong", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P05_TAG_CHECKOUT"]["category"], "TAG_CHECKOUT_REJECTED")

    def test_attached_checkout_and_old_preflight_tag_cannot_pass(self):
        self.failures["attached"] = subprocess.CompletedProcess([], 0, b"refs/heads/example", b"")
        records = self.probes()
        self.assertEqual(records["P05_TAG_CHECKOUT"]["category"], "TAG_CHECKOUT_REJECTED")
        self.failures.clear()
        self.environment["GITHUB_REF"] = "refs/tags/gridly-storekit-preflight-15-" + COMMIT
        records = self.probes()
        self.assertEqual(records["P05_TAG_CHECKOUT"]["category"], "TAG_CHECKOUT_REJECTED")

    def test_clone_failure_and_timeout_remain_distinct_from_sha_mismatch(self):
        for failure in (subprocess.CompletedProcess([], 1, b"PRIVATE", b"PRIVATE"),
                        subprocess.TimeoutExpired("PRIVATE", 1, output=b"PRIVATE")):
            self.failures["clone"] = failure
            records = self.probes()
            self.assertEqual(records["P06_CLONE_SHA"]["category"], "LOCAL_CLONE_FAILED")

    def test_clone_sha_mismatch_is_identified(self):
        self.failures["clone_sha"] = subprocess.CompletedProcess([], 0, b"wrong", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P06_CLONE_SHA"]["category"], "CLONED_SHA_MISMATCH")
        self.assertEqual(self.github_env.read_text(), "")

    def test_clone_environment_export_failure_is_identified(self):
        records = self.probes(github_env=None)
        self.assertEqual(records["P06_CLONE_SHA"]["category"], "CLONE_ENVIRONMENT_FAILED")

    def test_help_execution_failure_blocks_recognition_even_if_key_is_present(self):
        self.failures["help"] = subprocess.CompletedProcess([], 1, b"testFlightInternalTestingOnly : Bool\n", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P07_XCODE_HELP"]["category"], "XCODE_HELP_FAILED")
        self.assertEqual(records["P08_INTERNAL_EXPORT_OPTION"]["category"], "DEPENDENCY_FAILED")

    def test_missing_internal_option_is_independently_identified(self):
        self.failures["help"] = subprocess.CompletedProcess([], 0, b"unrelated : Bool\n", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P07_XCODE_HELP"]["status"], "PASS")
        self.assertEqual(records["P08_INTERNAL_EXPORT_OPTION"]["category"], "INTERNAL_OPTION_NOT_RECOGNIZED")

    def test_fixed_public_report_never_exposes_raw_output_or_private_paths(self):
        self.failures["version"] = OSError("PRIVATE EXCEPTION NEVER PUBLIC")
        records = self.probes()
        public = io.StringIO()
        delivery.emit_preflight(list(records.values()), stream=public)
        values = [json.loads(line) for line in public.getvalue().splitlines()]
        self.assertEqual(values, list(records.values()))
        for token in ("PRIVATE", str(self.root), "Traceback", "Xcode 26.6"):
            self.assertNotIn(token, public.getvalue())
        self.assertTrue(any(b"SYNTHETIC_PRIVATE" in p.read_bytes() for p in (self.root/"logs").glob("*.log")))

    def test_public_emitter_rejects_arbitrary_labels_fields_and_statuses_atomically(self):
        valid = [delivery.preflight_result(stage, True, "NONE") for stage in delivery.PREFLIGHT_STAGES]
        for change in ({"raw":"PRIVATE"}, {"category":"PRIVATE"}, {"stage":"PRIVATE"}, {"status":"PRIVATE"}):
            records = copy.deepcopy(valid); records[-1].update(change)
            public = io.StringIO()
            with self.assertRaises(ValueError): delivery.emit_preflight(records, stream=public)
            self.assertEqual(public.getvalue(), "")

    def test_only_validated_records_reach_public_descriptor_three(self):
        records = [delivery.preflight_result(stage, True, "NONE") for stage in delivery.PREFLIGHT_STAGES]
        public = io.StringIO()
        with patch.object(delivery.os,"dup",return_value=123) as duplicate, patch.object(delivery.os,"fdopen",return_value=contextlib.nullcontext(public)):
            delivery.emit_preflight(records)
        duplicate.assert_called_once_with(3)
        self.assertEqual(len(public.getvalue().splitlines()),8)

    def test_subprocesses_capture_raw_output_and_cannot_inherit_public_descriptor(self):
        self.probes()
        for args,options in self.calls:
            self.assertIs(options["capture_output"],True)
            self.assertIs(options["close_fds"],True)
            self.assertIs(options["check"],False)
            if args[0]=="xcodebuild":self.assertIn(args[1:],(["-version"],["-help"]))

    def test_main_preflight_failure_never_reaches_transfer_or_credentials(self):
        records=[delivery.preflight_result(stage,False,"INTERNAL_FAILURE") for stage in delivery.PREFLIGHT_STAGES]
        argv=["tool","preflight","--runner-temp",str(self.root),"--commit",COMMIT,
              "--output",str(self.output),"--github-env",str(self.github_env)]
        with patch.object(sys,"argv",argv), patch.object(delivery.cert,"private_directory",return_value=self.root), patch.dict(delivery.os.environ,{"DIAGNOSTIC_PRIVATE_ROOT":str(self.root)}), patch.object(delivery,"delivery_preflight",return_value=records), patch.object(delivery,"emit_preflight") as public, patch.object(delivery,"transfer") as transfer:
            with self.assertRaises(SystemExit) as stopped:delivery.main()
        self.assertEqual(stopped.exception.code,1); transfer.assert_not_called(); public.assert_called_once_with(records)

    def test_interrupted_preflight_produces_only_fixed_internal_failure_records(self):
        argv=["tool","preflight","--runner-temp",str(self.root),"--commit",COMMIT]
        with patch.object(sys,"argv",argv), patch.object(delivery.cert,"private_directory",return_value=self.root), patch.dict(delivery.os.environ,{"DIAGNOSTIC_PRIVATE_ROOT":str(self.root)}), patch.object(delivery,"delivery_preflight",side_effect=KeyboardInterrupt("PRIVATE")), patch.object(delivery,"emit_preflight") as public:
            with self.assertRaises(SystemExit) as stopped:delivery.main()
        self.assertEqual(stopped.exception.code,1)
        self.assertTrue(all(record["category"]=="INTERNAL_FAILURE" for record in public.call_args.args[0]))


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.text = WORKFLOW.read_text()

    def test_unrelated_delivery_execution_and_security_functions_remain_unchanged(self):
        baseline = delivery.cert.git("show", delivery.PREFLIGHT_BASE + ":tools/apple_storekit_testflight_delivery.py").decode()
        current = (ROOT / "tools/apple_storekit_testflight_delivery.py").read_text()
        functions = lambda source: {node.name: ast.dump(node) for node in ast.parse(source).body if isinstance(node, (ast.FunctionDef, ast.ClassDef))}
        before, after = functions(baseline), functions(current)
        self.assertEqual(set(after) - set(before), {"preflight_result", "emit_preflight", "delivery_preflight"})
        self.assertFalse(set(before) - set(after))
        for name in before.keys() - {"source_guard", "main"}:
            self.assertEqual(after[name], before[name], name)
        constants = lambda source: {node.targets[0].id: ast.dump(node.value) for node in ast.parse(source).body
                                    if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)}
        for name,value in constants(baseline).items():
            self.assertEqual(constants(current)[name],value,name)
        self.assertEqual(delivery.OWNER_CHECK_TTL, 1800)
        old_workflow = delivery.cert.git("show", delivery.PREFLIGHT_BASE + ":.github/workflows/gridly-storekit-testflight-delivery.yml").decode()
        def outside_preflight(text):
            text=text.split("\non:\n",1)[1]
            start=text.index("      - name: Verify source, build identity input and Xcode\n")
            end=text.index("      - name: Set up Node\n",start)
            return text[:start],text[end:]
        old_cms = 'security cms -D -i "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" > "$DIAGNOSTIC_PRIVATE_ROOT/profile.plist"'
        new_cms = 'security cms -D -k "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" -i "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" > "$DIAGNOSTIC_PRIVATE_ROOT/profile.plist"'
        self.assertEqual(old_workflow.count(old_cms), 1)
        self.assertEqual(outside_preflight(self.text),outside_preflight(old_workflow.replace(old_cms,new_cms)))
        self.assertIn("no_other_eligible_internal_users_confirmed", self.text)
        self.assertIn("BOTH", self.text)

    def test_nonpreflight_cli_modes_are_bytecode_structurally_unchanged(self):
        old=delivery.cert.git("show",delivery.PREFLIGHT_BASE+":tools/apple_storekit_testflight_delivery.py").decode()
        new=(ROOT/"tools/apple_storekit_testflight_delivery.py").read_text()
        def mode(node,value):
            return isinstance(node,ast.If) and isinstance(node.test,ast.Compare) and ast.dump(node.test)==ast.dump(ast.parse("args.mode == "+repr(value),mode="eval").body)
        def normalized(source):
            function=next(node for node in ast.parse(source).body if isinstance(node,ast.FunctionDef) and node.name=="main")
            function.body=[node for node in function.body if not mode(node,"preflight")]
            for node in ast.walk(function):
                if mode(node,"authorize") and len(node.orelse)==1 and mode(node.orelse[0],"preflight"):
                    node.orelse=node.orelse[0].orelse
            return ast.dump(function)
        self.assertEqual(normalized(old),normalized(new))

    def test_only_separate_new_tag_can_trigger(self):
        trigger = self.text.split("\non:\n", 1)[1].split("\npermissions:", 1)[0]
        self.assertEqual(trigger.strip(), "push:\n    tags:\n      - 'gridly-storekit-testflight-deliver-15-*'")
        for clause in ["github.event.created == true", "github.event.deleted == false", "github.event.forced == false", "github.run_attempt == 1", "github.repository == 'DBMaps/liberty-county-map'"]:
            self.assertIn(clause, self.text)
        self.assertNotIn("repository.private", self.text)

    def test_full_native_certification_precedes_upload_secret_access(self):
        self.assertLess(self.text.index("python3 -B tools/apple_storekit_diagnostic_certification.py certify"), self.text.index("ASC_PRIVATE_KEY_P8_BASE64:"))
        self.assertLess(self.text.index("apple_storekit_testflight_delivery.py authorize"), self.text.index("secrets."))
        self.assertIn("^Xcode 26([. ]|$)", (ROOT / "tools/apple_storekit_testflight_delivery.py").read_text())
        for value in ["macos-26", "'22'", "GRIDLY_STOREKIT_DIAGNOSTICS", "tests/build14-native-lifecycle.test.py", "tests/apple_native_parity_test.py", "tests/storekit-diagnostics-native.test.py", "activation --build-number"]:
            self.assertIn(value, self.text)

    def test_no_public_artifacts_cache_groups_release_or_old_workflow_changes(self):
        self.assertNotRegex(self.text, r"uses:.*(?:upload-artifact|cache|download-artifact)")
        self.assertNotRegex(self.text, r"\n\s+cache:")
        self.assertNotRegex(self.text, r"(?:pilot|fastlane|appStoreVersions|betaGroups|betaTesters|reviewSubmissions|--submit|--release)")
        self.assertIn("persist-credentials: false", self.text)
        self.assertIn("if: always()", self.text)
        self.assertIn("finish-public", self.text)
        self.assertIn('"git", "clone", "--no-hardlinks", "--branch"', (ROOT / "tools/apple_storekit_testflight_delivery.py").read_text())
        self.assertIn('cd "$DELIVERY_SOURCE_DIR"', self.text)

    def test_all_sensitive_shell_blocks_redirect_before_commands(self):
        blocks = re.findall(r"        run: \|\n((?:(?:          .*)?\n)+)", self.text)
        self.assertEqual(len(blocks), 10)
        for index,block in enumerate(blocks[1:-1],1):
            prefix='          set -euo pipefail\n          set +x\n          umask 077\n'
            self.assertTrue(block.startswith(prefix))
            rest=block[len(prefix):]
            if index==2:
                self.assertTrue(rest.startswith('          # FD 3 carries only validated fixed stage records; raw output stays private.\n          exec 3>&1\n'))
                rest=rest.split('          exec 3>&1\n',1)[1]
            self.assertRegex(rest, r'^          exec > "\$DIAGNOSTIC_PRIVATE_ROOT/logs/step-[1-8]\.log" 2>&1\n')
        self.assertEqual(self.text.count("exec 3>&1"),1)
        self.assertIn('--github-env "$GITHUB_ENV" --output',self.text)
        self.assertIn("testFlightInternalTestingOnly", self.text)
        self.assertIn("manageAppVersionAndBuildNumber", self.text)

    def test_each_shell_body_parses_without_running(self):
        bash = Path("C:/Program Files/Git/bin/bash.exe") if os.name == "nt" else Path("/bin/bash")
        blocks = re.findall(r"        run: \|\n((?:(?:          .*)?\n)+)", self.text)
        for block in blocks:
            body = "\n".join(line[10:] if line.startswith("          ") else line for line in block.splitlines()) + "\n"
            subprocess.run([str(bash), "-n"], input=body, text=True, check=True, capture_output=True)



class CmsSigningRepairTests(unittest.TestCase):
    old_cms = 'security cms -D -i "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" > "$DIAGNOSTIC_PRIVATE_ROOT/profile.plist"'
    new_cms = 'security cms -D -k "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" -i "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" > "$DIAGNOSTIC_PRIVATE_ROOT/profile.plist"'

    @staticmethod
    def signing_body(text):
        start = text.index("      - name: Install distribution signing\n")
        end = text.index("      - name: Archive and export", start)
        block = text[start:end].split("        run: |\n", 1)[1]
        return "\n".join(line[10:] for line in block.splitlines()) + "\n"

    def test_only_executable_workflow_change_is_explicit_cms_keychain(self):
        previous = delivery.cert.git("show", delivery.CMS_BASE + ":.github/workflows/gridly-storekit-testflight-delivery.yml").decode()
        current = WORKFLOW.read_text()
        self.assertEqual(previous.count(self.old_cms), 1)
        self.assertEqual(current.count(self.new_cms), 1)
        self.assertNotIn(self.old_cms, current)
        self.assertEqual(current.split("\non:\n",1)[1],
                         previous.replace(self.old_cms,self.new_cms).split("\non:\n",1)[1])
        self.assertEqual(self.signing_body(current), self.signing_body(previous).replace(self.old_cms,self.new_cms))

    def test_cms_uses_the_created_unlocked_import_destination_without_fallback(self):
        body = self.signing_body(WORKFLOW.read_text())
        commands = [line for line in body.splitlines() if line.startswith("security ")]
        cms = [line for line in commands if line.startswith("security cms ")]
        self.assertEqual(cms, [self.new_cms])
        keychain = '"$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db"'
        for prefix in ("security create-keychain ", "security unlock-keychain ", "security import "):
            line = next(line for line in commands if line.startswith(prefix))
            self.assertIn(keychain, line)
            self.assertLess(body.index(line), body.index(self.new_cms))
            if prefix=="security import ":
                self.assertIn("-k " + keychain, line)
        self.assertEqual(body.count("security cms "), 1)
        self.assertNotIn("||", cms[0])
        self.assertIn("set -euo pipefail\n", body)

    def exercise_signing_boundary(self, fail=False, implicit_mutant=False):
        # Execute only the production signing boundary with shell-function fakes.
        # No security/OpenSSL tool, real key, certificate, profile or app is used.
        bash = "C:/Program Files/Git/bin/bash.exe" if os.name=="nt" else "/bin/bash"
        body = self.signing_body(WORKFLOW.read_text())
        preamble = body[:body.index('test -n "$APPLE_DIST_PRIVATE_KEY_PEM_BASE64"')]
        boundary = body[body.index('security create-keychain '):body.index("PROFILE_NAME=$(")]
        if implicit_mutant:
            boundary=boundary.replace(' -k "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" -i ', ' -i ')
        fake = r'''
native_phase=0
security() {
  operation="$1"; shift
  case "$operation" in
    create-keychain)
      last=""
      for value in "$@"; do last="$value"; done
      test "$last" = "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" || return 71
      printf OWNED_SYNTHETIC_KEYCHAIN > "$last"
      native_phase=1;;
    unlock-keychain)
      last=""
      for value in "$@"; do last="$value"; done
      test "$native_phase" = 1 && test -f "$last" || return 72
      test "$last" = "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" || return 72
      native_phase=2;;
    import)
      test "$native_phase" = 2 || return 73
      import_key=""
      while test "$#" -gt 0; do
        if test "$1" = -k; then shift; import_key="$1"; fi
        shift
      done
      test "$import_key" = "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" || return 73
      native_phase=3;;
    set-key-partition-list|list-keychains)
      test "$native_phase" = 3 || return 74;;
    cms)
      test "$native_phase" = 3 || return 75
      cms_key=""
      cms_input=""
      while test "$#" -gt 0; do
        case "$1" in -k) shift; cms_key="$1";; -i) shift; cms_input="$1";; esac
        shift
      done
      test "$cms_key" = "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" || return 76
      test "$cms_input" = "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" || return 77
      test "$(cat "$cms_input")" = SYNTHETIC_PROFILE_BYTES || return 78
      if test "$FAIL_CMS" = 1; then return 23; fi
      printf SYNTHETIC_PLIST_ONLY;;
    *) return 79;;
  esac
}
'''
        with tempfile.TemporaryDirectory(prefix="gridly-cms-repair-synthetic-") as temporary:
            root=Path(temporary)
            (root/"logs").mkdir();(root/"tmp").mkdir()
            for name in ("distribution-private.key","distribution-cert.pem","distribution.p12"):
                (root/name).write_text("SYNTHETIC_PRIVATE_NEVER_PUBLIC")
            (root/"distribution.mobileprovision").write_text("SYNTHETIC_PROFILE_BYTES")
            names=("PATH","SystemRoot","SYSTEMROOT","WINDIR","TEMP","TMP","PATHEXT","COMSPEC","ProgramFiles","PROGRAMFILES")
            env={name:os.environ[name] for name in names if name in os.environ}
            env.update(DIAGNOSTIC_PRIVATE_ROOT=str(root).replace("\\","/"),
                       DELIVERY_SOURCE_DIR=str(root).replace("\\","/"), KEYCHAIN_PASSWORD="SYNTHETIC",
                       TEMP_P12_PASSWORD="SYNTHETIC", FAIL_CMS="1" if fail else "0")
            script=fake+preamble+boundary+'\nprintf VALIDATION_REACHED > "$DIAGNOSTIC_PRIVATE_ROOT/reached"\n'
            result=subprocess.run([bash,"--noprofile","--norc","-e","-o","pipefail"],input=script,text=True,
                                  capture_output=True,env=env)
            expected=76 if implicit_mutant else 23 if fail else 0
            self.assertEqual(result.returncode,expected)
            self.assertEqual((root/"reached").exists(),not (fail or implicit_mutant))
            self.assertTrue(all(not (root/name).exists() for name in
                                ("distribution-private.key","distribution-cert.pem","distribution.p12")))
            self.assertNotIn("SYNTHETIC_PRIVATE_NEVER_PUBLIC",result.stdout+result.stderr)

    def test_actual_boundary_accepts_explicit_imported_identity_keychain(self):
        self.exercise_signing_boundary()

    def test_actual_boundary_rejects_cms_failure_before_profile_validation_and_cleans(self):
        self.exercise_signing_boundary(fail=True)

    def test_synthetic_boundary_detects_an_implicit_keychain_fallback(self):
        self.exercise_signing_boundary(implicit_mutant=True)

    def test_existing_functions_and_controls_are_unchanged_except_source_guard(self):
        before=delivery.cert.git("show",delivery.SIGNING_VERIFIED_BASE+":tools/apple_storekit_testflight_delivery.py").decode()
        after=(ROOT/"tools/apple_storekit_testflight_delivery.py").read_text()
        functions=lambda text:{node.name:ast.dump(node) for node in ast.parse(text).body if isinstance(node,ast.FunctionDef)}
        original,current=functions(before),functions(after)
        self.assertEqual(set(original),set(current))
        for name in original.keys()-{"source_guard"}:
            self.assertEqual(original[name],current[name],name)
        nodes=lambda text:{n.targets[0].id:n.value for n in ast.parse(text).body
                           if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name)}
        old,new=nodes(before),nodes(after)
        self.assertEqual(set(new)-set(old),{"CMS_REPAIR_BASE","SIGNING_VERIFIED_BASE","SIGNING_VERIFICATION_FILES","DELIVERY_ALIGNMENT_FILES"})
        for name,node in old.items():
            if name=="HISTORICAL_TAGS":
                self.assertIsInstance(new[name],ast.Dict)
                self.assertEqual(len(new[name].keys),7)
                retained=ast.Dict(keys=new[name].keys[:6],values=new[name].values[:6])
                self.assertEqual(ast.dump(node),ast.dump(retained))
            else:self.assertEqual(ast.dump(node),ast.dump(new[name]),name)
        self.assertEqual(delivery.OWNER_CHECK_TTL,1800)

    def test_exact_reviewed_history_and_all_seven_authorization_tags(self):
        self.assertEqual(delivery.REFINEMENT_BASE,"4c95caed0d261fca1dbaf86fc926660661d0643b")
        self.assertEqual(delivery.SIGNING_BASE,"db4df3949b1f02325b8869433bbbd16b234487db")
        self.assertEqual(delivery.CMS_BASE,"cbe3c297099dbca9c6d376848157de0253aeae39")
        self.assertEqual(delivery.CMS_REPAIR_BASE,"17e36af1f5a8cc5f7f8ed927fb3e7fae758ee991")
        self.assertEqual(delivery.SIGNING_VERIFIED_BASE,"b1e2b7a35dff887dfa4a464a19215b66893b0ee8")
        self.assertEqual(delivery.SIGNING_VERIFICATION_FILES,{"tools/apple_storekit_signing_diagnostic.py",
            "tests/storekit-signing-diagnostic.test.py","tests/storekit-testflight-delivery.test.py"})
        self.assertEqual(delivery.DELIVERY_ALIGNMENT_FILES,{"tools/apple_storekit_testflight_delivery.py",
            "tests/storekit-testflight-delivery.test.py"})
        expected={
            "gridly-storekit-diagnostic-certify-15-f9fc818321970b8b7e29df17358daf87a7d20308":
                ("bb496cafcbeaf7d6aaf6574e6b5561ac242599fc",delivery.SOURCE),
            "gridly-storekit-testflight-deliver-15-45bfe026b81f4928caceb9632cbf15e7ed842a25":
                ("15a2d8093f31ccaea515b715e604c803d89af469",delivery.OWNER_CORRECTION),
            "gridly-storekit-preflight-15-13e73183cf3f257fbc9acd9a32d34d62b70ffb1e":
                ("41b9592697daf7898b66dd582b6da3af5dc8412d",delivery.PREFLIGHT_BASE),
            "gridly-storekit-testflight-deliver-15-4c95caed0d261fca1dbaf86fc926660661d0643b":
                ("e6425dadac56501e8b389efecd5c50d95501d823",delivery.REFINEMENT_BASE),
            "gridly-storekit-signing-diagnostic-15-db4df3949b1f02325b8869433bbbd16b234487db":
                ("ffa6924f2ec257f42a183f8f05daaccc66b85685",delivery.SIGNING_BASE),
            "gridly-storekit-cms-diagnostic-15-cbe3c297099dbca9c6d376848157de0253aeae39":
                ("975205d798d31197be41fe505a417064b519b63f",delivery.CMS_BASE),
            "gridly-storekit-signing-diagnostic-15-b1e2b7a35dff887dfa4a464a19215b66893b0ee8":
                ("0ec2230f6c42b4212afa18bf71d3045a0c978be3",delivery.SIGNING_VERIFIED_BASE),
        }
        self.assertEqual(delivery.HISTORICAL_TAGS,expected)
        for child,parent in ((delivery.SIGNING_VERIFIED_BASE,delivery.CMS_REPAIR_BASE),
                             (delivery.CMS_REPAIR_BASE,delivery.CMS_BASE),(delivery.CMS_BASE,delivery.SIGNING_BASE),(delivery.SIGNING_BASE,delivery.REFINEMENT_BASE),
                             (delivery.REFINEMENT_BASE,delivery.PREFLIGHT_BASE)):
            self.assertEqual(delivery.cert.git("show","-s","--format=%P",child).decode().strip(),parent)
        for commit,files in ((delivery.SIGNING_BASE,delivery.SIGNING_FILES),(delivery.CMS_BASE,delivery.CMS_FILES)):
            for path in files:
                historical = delivery.cert.git("show",commit+":"+path)
                self.assertEqual(historical, delivery.cert.git("show",delivery.CMS_BASE+":"+path),path)
                if path not in {"tools/apple_storekit_signing_diagnostic.py","tests/storekit-signing-diagnostic.test.py"}:
                    self.assertEqual((ROOT/path).read_bytes().replace(b"\r\n",b"\n"),historical,path)
        checkpoint=delivery.SIGNING_VERIFIED_BASE
        support={"tools/apple_storekit_testflight_delivery.py","tests/storekit-testflight-delivery.test.py"}
        def git(*args):
            return delivery.cert.git(*args).decode().strip()
        rows=git("diff","--name-status","--no-renames",checkpoint).splitlines()
        self.assertEqual(set(rows),{"M\t"+path for path in support})
        self.assertEqual(len(rows),2)
        self.assertFalse(git("diff","--cached","--name-only"))
        self.assertFalse(git("ls-files","--others","--exclude-standard"))
        head=git("rev-parse","HEAD")
        if head==checkpoint:
            self.assertEqual(rows,git("diff","--name-status","--no-renames","HEAD").splitlines())
        else:
            self.assertEqual(git("show","-s","--format=%P",head),checkpoint)
            self.assertFalse(git("status","--porcelain=v1","--untracked-files=all"))
            delivery.source_guard(head,True)
        for path in support:
            entry=git("ls-files","--stage","--",path).split()
            self.assertEqual((entry[0],entry[2]),("100644","0"))
            self.assertEqual(git("ls-tree",head,"--",path).split()[0],"100644")
        # Keep the signed b1 checkpoint byte-identical in the current candidate.
        # Its earlier three-file gate alignment is historical evidence only.
        for path in ("tools/apple_storekit_signing_diagnostic.py","tests/storekit-signing-diagnostic.test.py"):
            self.assertEqual((ROOT/path).read_bytes().replace(b"\r\n",b"\n"),
                             delivery.cert.git("show",checkpoint+":"+path),path)
        helper="tools/apple_storekit_signing_diagnostic.py"
        before=ast.parse(delivery.cert.git("show",delivery.CMS_REPAIR_BASE+":"+helper))
        after=ast.parse(delivery.cert.git("show",checkpoint+":"+helper))
        auth_constants={"SOURCE","DELIVERY","OWNER","PREFLIGHT","SIGNING","CMS","REPAIR","SUPPORT_FILES",
                        "DELIVERY_FILES","PREFLIGHT_FILES","CMS_FILES","HISTORICAL_INVENTORIES","CHAIN","HISTORY"}
        def strip_authorization(tree):
            tree=copy.deepcopy(tree)
            tree.body=[node for node in tree.body if not
                (isinstance(node,ast.FunctionDef) and node.name=="source_guard") and not
                (isinstance(node,ast.Assign) and isinstance(node.targets[0],ast.Name)
                 and node.targets[0].id in auth_constants)]
            return ast.dump(tree)
        self.assertEqual(strip_authorization(before),strip_authorization(after))
        # Mutation checks prove native/security functions and controls stay protected.
        for function in ("signing_script","run_signing","cleanup","authorization","authorize","emit","child_environment"):
            mutant=copy.deepcopy(after)
            node=next(n for n in mutant.body if isinstance(n,ast.FunctionDef) and n.name==function)
            node.body.append(ast.Pass())
            self.assertNotEqual(strip_authorization(before),strip_authorization(mutant),function)
        mutant=copy.deepcopy(after)
        node=next(n for n in mutant.body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name)
                  and n.targets[0].id=="INPUTS")
        node.value=ast.Constant(value="UNAPPROVED_SECRET_CHANGE")
        self.assertNotEqual(strip_authorization(before),strip_authorization(mutant))
        tests="tests/storekit-signing-diagnostic.test.py"
        before=ast.parse(delivery.cert.git("show",delivery.CMS_REPAIR_BASE+":"+tests))
        after=ast.parse(delivery.cert.git("show",checkpoint+":"+tests))
        allowed={"source_git","test_exact_three_additions_and_all_history_pass",
                 "test_exact_three_successor_modifications_and_all_history_pass",
                 "test_extra_missing_renamed_modified_or_duplicate_inventory_fails",
                 "test_extra_commits_merges_wrong_parents_and_dirty_source_fail",
                 "test_all_three_modes_must_remain_100644",
                 "test_existing_tracked_runtime_workflows_and_baseline_are_unchanged",
                 "test_older_tags_and_branch_pushes_cannot_match_new_workflow",
                 "test_reviewed_successor_constants_history_and_inventories_are_exact",
                 "test_each_historical_inventory_and_mode_change_fails_closed",
                 "test_only_source_authorization_changes_preserve_all_native_and_security_functions"}
        def strip_source_expectations(tree):
            tree=copy.deepcopy(tree)
            tree.body=[n for n in tree.body if not (isinstance(n,ast.FunctionDef) and n.name in allowed)]
            for node in ast.walk(tree):
                if isinstance(node,ast.ClassDef):
                    node.body=[n for n in node.body if not (isinstance(n,ast.FunctionDef) and n.name in allowed)]
            return ast.dump(tree)
        self.assertEqual(strip_source_expectations(before),strip_source_expectations(after))

    def test_historical_cms_repair_requires_all_four_reviewed_files_only(self):
        self.assertEqual(delivery.REPAIR_FILES, delivery.FILES | {"tests/storekit-signing-diagnostic.test.py"})
        records=["M\t"+path for path in sorted(delivery.REPAIR_FILES)]
        bad=[records[:i]+records[i+1:] for i in range(4)]
        bad += [records+[records[0]],["A\t"+path for path in sorted(delivery.REPAIR_FILES)],
                records+["M\tjs/gridly-paid-ui.mjs"],
                records+["M\ttools/apple_storekit_signing_diagnostic.py"],
                records+["M\ttests/storekit-preflight-diagnostic.test.py"]]
        for candidate in bad:
            with self.subTest(candidate=candidate),patch.object(delivery.cert,"git",side_effect=source_git(
                    repair_inventory="\n".join(candidate).encode())),patch.object(delivery.subprocess,"run"),\
                    patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)

    def test_one_verified_child_requires_exactly_two_modified_delivery_files(self):
        records=["M\t"+p for p in sorted(delivery.DELIVERY_ALIGNMENT_FILES)]
        candidates=[records[:-1],records[1:],records+[records[0]],
                    ["A\t"+p for p in sorted(delivery.DELIVERY_ALIGNMENT_FILES)]]
        for path in ("js/gridly-paid-ui.mjs","tools/apple_storekit_signing_diagnostic.py",
                     "tests/storekit-signing-diagnostic.test.py",
                     ".github/workflows/gridly-storekit-testflight-delivery.yml",
                     ".github/workflows/gridly-apple-build-9.yml"):
            candidates.append(records+["M\t"+path])
        for candidate in candidates:
            with self.subTest(candidate=candidate),patch.object(delivery.cert,"git",side_effect=source_git(
                    correction="\n".join(candidate).encode())),patch.object(delivery.subprocess,"run"),\
                    patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)

    def test_signing_verification_inventory_and_each_historical_mode_fail_closed(self):
        records=["M\t"+p for p in sorted(delivery.SIGNING_VERIFICATION_FILES)]
        candidates=[records[:-1],records+[records[0]],records+["M\tjs/gridly-paid-ui.mjs"],
                    ["A\t"+p for p in sorted(delivery.SIGNING_VERIFICATION_FILES)]]
        for candidate in candidates:
            with self.subTest(candidate=candidate),patch.object(delivery.cert,"git",side_effect=source_git(
                    verification_inventory="\n".join(candidate).encode())),patch.object(delivery.subprocess,"run"),\
                    patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)
        historical=((delivery.DELIVERY_BASE,delivery.FILES),(delivery.OWNER_CORRECTION,delivery.FILES),
                    (delivery.PREFLIGHT_BASE,delivery.PREFLIGHT_FILES),(delivery.REFINEMENT_BASE,delivery.REFINEMENT_FILES),
                    (delivery.SIGNING_BASE,delivery.SIGNING_FILES),(delivery.CMS_BASE,delivery.CMS_FILES),
                    (delivery.CMS_REPAIR_BASE,delivery.REPAIR_FILES),
                    (delivery.SIGNING_VERIFIED_BASE,delivery.SIGNING_VERIFICATION_FILES))
        valid=source_git()
        for target,files in historical:
            for path in files:
                for mode in ("100755","120000"):
                    def changed(*args):
                        if args==("ls-tree",target,"--",path):
                            return (mode+" blob "+"0"*40+"\t"+path).encode()
                        return valid(*args)
                    with self.subTest(target=target,path=path,mode=mode),patch.object(delivery.cert,"git",side_effect=changed),\
                            patch.object(delivery.subprocess,"run"),patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                        delivery.source_guard(COMMIT,True)

    def test_historical_signing_and_cms_inventory_changes_are_rejected(self):
        for options in ({"signing_inventory":b""},{"cms_inventory":b""},
                        {"signing_inventory":b"A\tjs/gridly-paid-ui.mjs"},
                        {"cms_inventory":b"M\ttools/apple_storekit_cms_diagnostic.py"}):
            with self.subTest(options=options),patch.object(delivery.cert,"git",side_effect=source_git(**options)),\
                    patch.object(delivery.subprocess,"run"),patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)


if __name__ == "__main__":
    unittest.main()
