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


if __name__ == "__main__":
    unittest.main()
