from contextlib import redirect_stderr, redirect_stdout
import io
import subprocess
import unittest
from unittest.mock import patch

import pf_root_diagnostic
import run


class RootFilterDiagnosticTests(unittest.TestCase):
    argv = ("/usr/bin/sudo", "-n", "/sbin/pfctl", "-sr")
    wildcard = 'anchor "com.apple/*"'
    scrub = "scrub-" + wildcard
    sensitive = "SYNTHETIC_PRIVATE_MARKER 192.0.2.17 /private/synthetic"

    def test_classifies_only_the_certification_gate_shapes(self):
        cases = [
            ("", "PF_ROOT_EMPTY"),
            ("  \n\t\r\n", "PF_ROOT_EMPTY"),
            (self.wildcard, "PF_ROOT_EXPECTED"),
            (f"  {self.wildcard} all\r\n\r\n", "PF_ROOT_EXPECTED"),
            (f"{self.scrub}\n{self.wildcard} all\n", "PF_ROOT_EXPECTED"),
            (f"{self.scrub} all\n{self.wildcard}\n", "PF_ROOT_EXPECTED"),
            (self.scrub, "PF_ROOT_OTHER"),
            (f"{self.wildcard}\n{self.scrub}", "PF_ROOT_OTHER"),
            (f"{self.wildcard}\n{self.wildcard}", "PF_ROOT_OTHER"),
            ('anchor "com.apple" all', "PF_ROOT_OTHER"),
            (f"{self.wildcard} on en0", "PF_ROOT_OTHER"),
            (f"{self.wildcard} all\npass out quick from 192.0.2.17 to any", "PF_ROOT_OTHER"),
            (f"{self.wildcard} all\n{self.sensitive}", "PF_ROOT_OTHER"),
        ]
        for rules, status in cases:
            with self.subTest(status=status, rules=rules):
                self.assertEqual(pf_root_diagnostic.classify_root_filter(rules), status)

    def test_only_fixed_output_and_one_read_only_command(self):
        cases = [
            (subprocess.CompletedProcess(self.argv, 0, "", self.sensitive), "PF_ROOT_EMPTY", 0),
            (subprocess.CompletedProcess(self.argv, 0, self.wildcard, self.sensitive), "PF_ROOT_EXPECTED", 0),
            (subprocess.CompletedProcess(self.argv, 0, self.sensitive, self.sensitive), "PF_ROOT_OTHER", 0),
            (subprocess.CalledProcessError(77, self.argv, self.sensitive, self.sensitive), "PF_ROOT_UNREADABLE", 1),
            (subprocess.TimeoutExpired(self.argv, 15, self.sensitive, self.sensitive), "PF_ROOT_UNREADABLE", 1),
            (OSError(self.sensitive), "PF_ROOT_UNREADABLE", 1),
        ]
        for result, status, code in cases:
            with self.subTest(status=status, result_type=type(result).__name__):
                stdout, stderr = io.StringIO(), io.StringIO()
                with (
                    patch.object(run.subprocess, "run", side_effect=[result]) as process,
                    redirect_stdout(stdout), redirect_stderr(stderr),
                ):
                    self.assertEqual(pf_root_diagnostic.main(), code)
                process.assert_called_once_with(
                    self.argv, cwd=run.ROOT, env=run.ENV, input=None, text=True, encoding="utf-8",
                    errors="replace", stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15, check=True,
                )
                self.assertEqual(stdout.getvalue(), status + "\n")
                self.assertEqual(stderr.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
