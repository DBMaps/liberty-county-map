from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

import run


class IsolationTests(unittest.TestCase):
    def test_only_the_default_root_can_dispatch_the_deny_anchor(self):
        default = 'scrub-anchor "com.apple/*" all\nanchor "com.apple/*" all'
        run.require_default_rules(default, 'nat-anchor "com.apple/*" all')
        for rules in ("", "pass out quick all\n" + default, default + "\npass out all"):
            with self.subTest(rules=rules), self.assertRaisesRegex(run.Blocked, "PF_ROOT_FILTER"):
                run.require_default_rules(rules, "")
        with self.assertRaisesRegex(run.Blocked, "PF_ROOT_TRANSLATION"):
            run.require_default_rules(default, "rdr pass on en0 all -> 127.0.0.1")

    def test_interfaces_cannot_bypass_pf(self):
        run.require_interfaces("lo0 en0 en1", "lo0 (skip)\nen0\nen1")
        with self.assertRaisesRegex(run.Blocked, "PF_SKIPPED_INTERFACE"):
            run.require_interfaces("lo0 en0", "lo0\nen0 (skip)")
        with self.assertRaisesRegex(run.Blocked, "PF_INTERFACE_INVENTORY"):
            run.require_interfaces("lo0 en0 en1", "lo0\nen0")

    def test_bad_policy_never_sends_canaries(self):
        firewall = run.Firewall("1")
        with patch.object(firewall, "check_policy", side_effect=run.Blocked("PF_EXISTING_STATES")), \
                patch.object(run, "send_canaries") as canaries:
            with self.assertRaisesRegex(run.Blocked, "PF_EXISTING_STATES"):
                firewall.verify()
            canaries.assert_not_called()

    def test_both_kernel_counters_must_advance(self):
        firewall = run.Firewall("1")
        before = "gridly_probe4 5 0 0\ngridly_probe6 5 0 0"
        for ipv4, ipv6 in [(0, 1), (1, 0), (1, 1)]:
            after = f"gridly_probe4 6 {ipv4} 99\ngridly_probe6 6 {ipv6} 99"
            with self.subTest(ipv4=ipv4, ipv6=ipv6), patch.object(firewall, "check_policy"), \
                    patch.object(run, "pf", side_effect=[before, after]), patch.object(run, "send_canaries"):
                if ipv4 and ipv6:
                    firewall.verify()
                else:
                    with self.assertRaisesRegex(run.Blocked, "PF_DUAL_STACK_PROBE"):
                        firewall.verify()

    def test_boot_cannot_lead_to_install_when_pf_recheck_fails(self):
        firewall = Mock()
        firewall.verify.side_effect = run.Blocked("PF_RULE_READBACK")
        with patch.object(run, "sim") as simulator:
            with self.assertRaisesRegex(run.Blocked, "PF_RULE_READBACK"):
                run.run_fixture("sim", None, None, firewall)
            self.assertEqual([call.args[0] for call in simulator.call_args_list], ["SIM_BOOT", "SIM_BOOT_STATUS"])


class SimulatorDiscoveryTests(unittest.TestCase):
    argv = ("/usr/bin/xcrun", "simctl", "list", "-j", "runtimes")
    marker = b"SYNTHETIC_PRIVATE_DISCOVERY_MARKER"

    def inventory(self, runtimes):
        return json.dumps({"runtimes": runtimes, "private": self.marker.decode()}).encode()

    def result(self, stdout):
        return subprocess.CompletedProcess(self.argv, 0, stdout, self.marker)

    def test_available_runtime_reports_only_fixed_status(self):
        inventory = self.inventory([
            {"identifier": "other-runtime", "isAvailable": True},
            {"identifier": run.RUNTIME, "isAvailable": True},
        ])
        output = io.StringIO()
        with patch.object(run.subprocess, "run", return_value=self.result(inventory)) as process, redirect_stdout(output):
            run.require_simulator_runtime()
        process.assert_called_once_with(
            self.argv, cwd=run.ROOT, env=run.ENV, stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=60, check=True,
        )
        self.assertEqual(output.getvalue(), "SIM_RUNTIME_AVAILABLE\n")

    def test_discovery_failures_stop_before_fixture_or_firewall_setup(self):
        cases = [
            ("timeout", subprocess.TimeoutExpired(self.argv, 60, output=self.marker, stderr=self.marker),
             "SIM_RUNTIME_TIMEOUT"),
            ("nonzero exit", subprocess.CalledProcessError(73, self.argv, output=self.marker, stderr=self.marker),
             "SIM_RUNTIME_COMMAND_FAILED exit_code=73"),
            ("launch failure", OSError(self.marker.decode()), "SIM_RUNTIME_COMMAND_FAILED"),
            ("missing", self.result(self.inventory([{"identifier": "other-runtime", "isAvailable": True}])),
             "SIM_RUNTIME_MISSING"),
            ("unavailable", self.result(self.inventory([{"identifier": run.RUNTIME, "isAvailable": False}])),
             "SIM_RUNTIME_MISSING"),
            ("invalid JSON", self.result(self.marker), "SIM_RUNTIME_INVALID_OUTPUT"),
            ("invalid UTF-8", self.result(b"\xff" + self.marker), "SIM_RUNTIME_INVALID_OUTPUT"),
            ("invalid inventory", self.result(b'{"runtimes": {}}'), "SIM_RUNTIME_INVALID_OUTPUT"),
            ("invalid row", self.result(self.inventory([{"identifier": run.RUNTIME, "isAvailable": "true"}])),
             "SIM_RUNTIME_INVALID_OUTPUT"),
            ("oversized inventory", self.result(b" " * (1024 * 1024) + self.marker), "SIM_RUNTIME_INVALID_OUTPUT"),
        ]
        sha = "1" * 40
        runner = {
            "GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted",
            "GITHUB_REPOSITORY": "DBMaps/liberty-county-map", "GITHUB_REF": run.BRANCH,
            "GITHUB_EVENT_NAME": "push", "GITHUB_RUN_ATTEMPT": "1",
            "GITHUB_SHA": sha, "GITHUB_RUN_ID": "123",
        }
        checkout = subprocess.CompletedProcess([], 0, sha + "\n", "")
        xcode = subprocess.CompletedProcess([], 0, "Xcode 26.5\nBuild version 17F42\n", "")
        for name, result, status in cases:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temp:
                stdout, stderr = io.StringIO(), io.StringIO()
                with (
                    patch.dict(run.os.environ, {**runner, "RUNNER_TEMP": temp}),
                    patch.object(run.os, "getuid", return_value=501, create=True),
                    patch.object(run.os, "umask"),
                    patch.object(run.platform, "system", return_value="Darwin"),
                    patch.object(run.platform, "machine", return_value="arm64"),
                    patch.object(run.signal, "signal"),
                    patch.object(run.subprocess, "run", side_effect=[checkout, xcode, result]) as process,
                    redirect_stdout(stdout), redirect_stderr(stderr), self.assertRaises(SystemExit) as exit_status,
                ):
                    runpy.run_path(run.__file__, run_name="__main__")
                self.assertEqual(exit_status.exception.code, 1)
                self.assertEqual(stdout.getvalue(), f"ARCGIS_IOS_SYNTHETIC_BLOCKED {status}\n")
                self.assertEqual(stderr.getvalue(), "")
                self.assertEqual([call.args[0] for call in process.call_args_list], [
                    ("/usr/bin/git", "rev-parse", "HEAD"), ("/usr/bin/xcodebuild", "-version"), self.argv,
                ])
                self.assertEqual([call.kwargs["timeout"] for call in process.call_args_list], [15, 15, 60])
                self.assertEqual(list(Path(temp).iterdir()), [])


class ExecutionOrderTests(unittest.TestCase):
    def test_preflight_isolation_and_cleanup_order(self):
        before_pf = ["CHECKOUT_SHA", "XCODE_VERSION", "SIM_RUNTIME", "SIMULATOR_SDK", "PF_LOAD"]
        cleanup = ["PF_FLUSH", "PF_RELEASE"]
        before_compile = before_pf + ["PF_ENABLE", "PF_PROBE", "PF_PROBE", "SWIFT_COMPILE"]
        before_fixture = before_compile + ["PF_PROBE", "SIM_CREATE", "FIXTURE"]
        delete = ["SIM_SHUTDOWN", "SIM_DELETE"]
        cases = [
            (None, None, before_fixture + ["MAC_PRIVATE_INPUT", "PF_PROBE"] + delete + cleanup),
            ("PF_LOAD", "PF_COMMAND", before_pf + ["PF_FLUSH"]),
            ("IPv4", "PF_DUAL_STACK_PROBE", before_pf + ["PF_ENABLE", "PF_PROBE"] + cleanup),
            ("IPv6 recheck", "PF_DUAL_STACK_PROBE", before_compile[:-1] + cleanup),
            ("SWIFT_COMPILE", "SWIFT_COMPILE", before_compile + cleanup),
            ("FIXTURE", "SYNTHETIC_FAIL", before_fixture + delete + cleanup),
            ("MAC_PRIVATE_INPUT", "MAC_PRIVATE_INPUT", before_fixture + ["MAC_PRIVATE_INPUT"] + delete + cleanup),
            ("SIM_DELETE", "SIM_DELETE", before_fixture + ["MAC_PRIVATE_INPUT", "PF_PROBE"] + delete),
        ]
        sha = "1" * 40
        runner = {
            "GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted",
            "GITHUB_REPOSITORY": "DBMaps/liberty-county-map", "GITHUB_REF": run.BRANCH,
            "GITHUB_EVENT_NAME": "push", "GITHUB_RUN_ATTEMPT": "1",
            "GITHUB_SHA": sha, "GITHUB_RUN_ID": "123",
        }
        for failure, status, expected in cases:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temp:
                events, packets = [], [0, 0]
                sdk = Path(temp) / "Xcode" / "SDK"
                sdk.mkdir(parents=True)
                stdout, stderr = io.StringIO(), io.StringIO()
                marker = "SYNTHETIC_PRIVATE_COMMAND_MARKER"

                def command(stage, *args, **options):
                    events.append(stage)
                    if stage == "SWIFT_COMPILE":
                        self.assertIn("swiftc", args)
                    if failure == stage and stage in ("SWIFT_COMPILE", "SIM_DELETE"):
                        raise run.Blocked(stage)
                    return {
                        "CHECKOUT_SHA": sha, "XCODE_VERSION": "Xcode 26.5\nBuild version 17F42\n",
                        "SIMULATOR_SDK": sdk.as_posix(), "SIM_CREATE": "12345678-1234-1234-1234-123456789ABC",
                        "MAC_PRIVATE_INPUT": marker if failure == stage else "MAC_PRIVATE_INPUT_PASS",
                    }.get(stage, "")

                def pf(*args, **options):
                    if args[-2:] == ("-f", "-"):
                        events.append("PF_LOAD")
                        if failure == "PF_LOAD":
                            raise run.Blocked("PF_COMMAND")
                    if args[0] == "-E":
                        events.append("PF_ENABLE")
                        return "Token: 123\n"
                    if args[-2:] == ("-s", "labels"):
                        return f"gridly_probe4 0 {packets[0]}\ngridly_probe6 0 {packets[1]}"
                    if args[-2:] == ("-F", "rules"):
                        events.append("PF_FLUSH")
                    if args == ("-X", "123"):
                        events.append("PF_RELEASE")
                    return ""

                def canaries():
                    events.append("PF_PROBE")
                    if failure != "IPv4":
                        packets[0] += 1
                    if failure != "IPv6 recheck" or events.count("PF_PROBE") == 1:
                        packets[1] += 1

                def fixture(*args):
                    events.append("FIXTURE")
                    if failure == "FIXTURE":
                        raise run.Blocked("SYNTHETIC_FAIL")

                with (
                    patch.dict(run.os.environ, {**runner, "RUNNER_TEMP": temp}), patch.dict(run.ENV),
                    patch.object(run.os, "getuid", return_value=501, create=True), patch.object(run.os, "umask"),
                    patch.object(run.platform, "system", return_value="Darwin"),
                    patch.object(run.platform, "machine", return_value="arm64"),
                    patch.object(run.platform, "mac_ver", return_value=("26.7.2", (), "")),
                    patch.object(run, "XCODE", sdk.parent.as_posix()),
                    patch.object(run, "command", side_effect=command),
                    patch.object(run, "require_simulator_runtime", side_effect=lambda: events.append("SIM_RUNTIME")),
                    patch.object(run.Firewall, "check_policy"), patch.object(run, "pf", side_effect=pf),
                    patch.object(run, "send_canaries", side_effect=canaries),
                    patch.object(run, "run_fixture", side_effect=fixture), redirect_stdout(stdout), redirect_stderr(stderr),
                ):
                    if status:
                        with self.assertRaisesRegex(run.Blocked, f"^{status}$"):
                            run.main()
                    else:
                        run.main()
                self.assertEqual(events, expected)
                self.assertEqual(stdout.getvalue(), "" if status else "ARCGIS_IOS_SYNTHETIC_PASS\n")
                self.assertEqual(stderr.getvalue(), "")
                report = Path(temp) / "gridly-arcgis-synthetic-result.json"
                self.assertEqual(report.exists(), status is None)
                if not status:
                    self.assertNotIn(marker, report.read_text(encoding="utf-8"))

    def test_fixture_rechecks_before_install_and_launch(self):
        device = "sim"
        for blocked in (True, False):
            with self.subTest(blocked=blocked), tempfile.TemporaryDirectory() as temp:
                home = Path(temp)
                data = home / "Library/Developer/CoreSimulator/Devices" / device / "data"
                data.mkdir(parents=True)
                events = []
                firewall = Mock()

                def verify():
                    events.append("PF_VERIFY")
                    if blocked and events.count("PF_VERIFY") == 2:
                        raise run.Blocked("PF_DUAL_STACK_PROBE")

                def sim(stage, *args, **options):
                    events.append(stage)
                    if stage == "SIM_FIXTURE_LAUNCH":
                        raise run.Blocked("LAUNCH_TEST_BOUNDARY")
                    return str(data) if stage == "SIM_DATA_CONTAINER" else ""

                firewall.verify.side_effect = verify
                with patch.object(run.Path, "home", return_value=home), patch.object(run, "sim", side_effect=sim):
                    with self.assertRaisesRegex(run.Blocked, "PF_DUAL_STACK_PROBE" if blocked else "LAUNCH_TEST_BOUNDARY"):
                        run.run_fixture(device, home / "Fixture.app", home, firewall)
                expected = ["SIM_BOOT", "SIM_BOOT_STATUS", "PF_VERIFY", "SIM_FIXTURE_INSTALL", "SIM_DATA_CONTAINER", "PF_VERIFY"]
                self.assertEqual(events, expected if blocked else expected + ["SIM_FIXTURE_LAUNCH"])


if __name__ == "__main__":
    unittest.main()
