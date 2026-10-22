"""Portable fail-closed controls; these tests do not claim macOS signing proof."""
import copy
import re
import sys
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import apple_acceptance_build_only as build
import apple_native_parity as parity
LEGACY = subprocess.check_output(["git", "show", build.APPLE14 + ":ios/App/App/GridlyBridgeViewController.swift"]).decode()


class BuildOnlyControls(unittest.TestCase):
    def test_actual_source_permits_only_reviewed_14_16_compatibility_extension(self):
        source = (ROOT / "ios/App/App/GridlyBridgeViewController.swift").read_text(encoding="utf-8")
        self.assertEqual(source, parity.approved_recovery_source(LEGACY))
        build.require_recovery_build(source, "14")
        build.require_recovery_build(source, "16")
        for value in ("12", "13", "15", "17", "016", "16.0", "", None):
            with self.subTest(value=value), self.assertRaisesRegex(AssertionError, "RECOVERY_BUILD_MISMATCH"):
                build.require_recovery_build(source, value)

    def test_legacy_source_remains_build14_only(self):
        build.require_recovery_build(LEGACY, "14")
        with self.assertRaisesRegex(AssertionError, "RECOVERY_BUILD_MISMATCH"):
            build.require_recovery_build(LEGACY, "16")

    def test_unrelated_build_literal_cannot_authorize_recovery(self):
        source = LEGACY
        source += '\nlet unrelated = \'Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String == "16"\'\n'
        with self.assertRaisesRegex(AssertionError, "RECOVERY_BUILD_MISMATCH"):
            build.require_recovery_build(source, "16")

    def test_identity_guard_cannot_be_omitted(self):
        with self.assertRaisesRegex(AssertionError, "RECOVERY_BUILD_MISMATCH"):
            build.require_recovery_build('private var recoveryBuild: Bool {\ntrue\n    }', "16")

    def test_legacy_build14_parity_default_is_unchanged(self):
        self.assertEqual(parity.expected_app_identity(), {"CFBundleShortVersionString": "1.0.0", "CFBundleVersion": "14", "CFBundleIdentifier": "com.gridlygo.gridly", "UIDeviceFamily": [1]})

    def test_explicit_build_changes_only_expected_build_metadata(self):
        old = parity.expected_app_identity()
        expected = copy.deepcopy(old)
        expected["CFBundleVersion"] = "16"
        self.assertEqual(parity.expected_app_identity("16"), expected)
        for invalid in ("0", "16;echo SECRET", "16\n", "", 16):
            with self.subTest(invalid=invalid), self.assertRaises(AssertionError):
                parity.expected_app_identity(invalid)

    def test_wrong_source_is_refused_before_reading_signing_material(self):
        with patch.object(build, "git", return_value="0" * 40):
            with self.assertRaisesRegex(AssertionError, "wrong source"):
                build.preflight(ROOT, "16", build.SOURCE)

    def test_reviewed_source_cleanliness_ancestry_and_narrow_native_parity(self):
        def metadata(root, *args):
            if args[0] == "rev-parse": return build.SOURCE
            if args[0] == "merge-base": return args[1]
            if args[0] == "status": return ""
            self.fail("unexpected Git command")
        def certified(args):
            relative = args[-1].split(":", 1)[1]
            return LEGACY.encode() if relative.endswith(".swift") else (ROOT / relative).read_text(encoding="utf-8").encode()
        with patch.object(build, "git", side_effect=metadata), patch.object(build.subprocess, "check_output", side_effect=certified):
            self.assertEqual(build.preflight(ROOT, "16", build.SOURCE)["source"], build.SOURCE)
        with patch.object(build, "git", side_effect=lambda root,*args: " M js/app.js" if args[0] == "status" else metadata(root,*args)):
            with self.assertRaisesRegex(AssertionError, "dirty tracked"):
                build.preflight(ROOT, "16", build.SOURCE)

    def test_old_or_injected_build_number_is_refused(self):
        for value in ("14", "15", "16; echo oops", "16\n"):
            with self.subTest(value=value), self.assertRaisesRegex(AssertionError, "only proposed"):
                build.preflight(ROOT, value, build.SOURCE)

    def test_certified_performance_or_nws_drift_is_refused_before_signing(self):
        def metadata(root, *args):
            if args[0] == "rev-parse": return build.SOURCE
            if args[0] == "merge-base": return args[1]
            return ""
        for changed in build.SHIPPING:
            def certified(args):
                relative = args[-1].split(":", 1)[1]
                if relative.endswith(".swift"): return LEGACY.encode()
                return ((ROOT / relative).read_text(encoding="utf-8") + ("drift" if relative == changed else "")).encode()
            with self.subTest(changed=changed), patch.object(build, "git", side_effect=metadata), patch.object(build.subprocess, "check_output", side_effect=certified):
                with self.assertRaisesRegex(AssertionError, "certified performance/NWS source drift"):
                    build.preflight(ROOT, "16", build.SOURCE)

    def test_workflow_has_no_automatic_trigger_or_transfer_capability(self):
        workflow = (ROOT / ".github/workflows/gridly-apple-acceptance-build-only.yml").read_text(encoding="utf-8")
        triggers = workflow.split("on:\n", 1)[1].split("permissions:", 1)[0]
        self.assertRegex(triggers, r"(?m)^  workflow_dispatch:$")
        self.assertNotRegex(triggers, r"(?m)^  (push|pull_request|workflow_run|schedule|workflow_call):")
        actions = re.findall(r"uses: ([^\s]+)", workflow)
        self.assertEqual(set(actions), {"actions/checkout@v4", "actions/setup-node@v4"})
        self.assertNotRegex(workflow, r"altool|iTMSTransporter|fastlane|deliver |upload-artifact|gh release|curl |ASC_|APPLE_ID_USERNAME|APPLE_APP_SPECIFIC_PASSWORD|allowProvisioningUpdates")
        self.assertIn('<key>destination</key><string>export</string>', workflow)
        self.assertIn('<key>uploadSymbols</key><false/>', workflow)
        self.assertIn('<key>manageAppVersionAndBuildNumber</key><false/>', workflow)
        self.assertIn("contents: read", workflow)
        self.assertNotRegex(workflow, r"(?m)^  [\w-]+: write$")

    def test_workflow_refuses_stale_control_and_wrong_actor_branch(self):
        workflow = (ROOT / ".github/workflows/gridly-apple-acceptance-build-only.yml").read_text(encoding="utf-8")
        self.assertIn('test "$REVIEWED_WORKFLOW_COMMIT" = "$GITHUB_SHA"', workflow)
        self.assertIn("github.actor == 'DBMaps'", workflow)
        self.assertIn("refs/heads/codex/community-loading-production-integration-v1", workflow)
        self.assertEqual(workflow.count("ref: ${{ github.sha }}"), 2)
        self.assertIn('--source-commit "$REVIEWED_WORKFLOW_COMMIT"', workflow)
        self.assertIn('--source-commit "$GITHUB_SHA"', workflow)
        preflight = workflow.index("Verify reviewed control source")
        secrets = workflow.index("secrets.GRIDLY_NATIVE_PROVIDER_CONFIG_BASE64")
        self.assertLess(preflight, secrets)
        self.assertIn("cancel-in-progress: false", workflow)
        self.assertIn("if: always()", workflow)
        self.assertIn('rm -rf "$private"', workflow)
        self.assertIn("previous-keychains.txt", workflow)
        self.assertLess(workflow.index('> "$private/previous-keychains.txt"'), workflow.index('security create-keychain'))
        self.assertIn('exit "$cleanup_failed"', workflow)


if __name__ == "__main__":
    unittest.main()
