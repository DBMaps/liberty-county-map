"""Fail-closed parity regressions, including real Apple codesign on macOS."""
import copy
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import apple_native_parity as parity


def fixture(signature_payload=b"signature-a"):
    slot = struct.pack(">2I", 0xFADE0C02, 8 + len(signature_payload)) + signature_payload
    blob = struct.pack(">5I", 0xFADE0CC0, 20 + len(slot), 1, 0, 20) + slot
    section = struct.pack("<16s16sQQ8I", b"__text", b"__TEXT", 0x100000100, 16, 256, 2, 0, 0, 0x80000400, 0, 0, 0)
    segment = struct.pack("<2I16s4Q4I", 0x19, 152, b"__TEXT", 0x100000000, 4096, 0, 272, 5, 5, 1, 0) + section
    signature = struct.pack("<4I", 0x1D, 16, 272, len(blob))
    header = struct.pack("<8I", 0xFEEDFACF, 0x0100000C, 0, 2, 2, 168, 0, 0)
    return (header + segment + signature).ljust(256, b"\0") + b"0123456789abcdef" + blob


class PortableParityTests(unittest.TestCase):
    def test_signature_changes_are_distinct_from_section_changes(self):
        a, b = fixture(), fixture(b"different-longer-signature")
        self.assertNotEqual(a, b)
        af, bf = parity.macho(a), parity.macho(b)
        self.assertEqual(af["sections"], bf["sections"])
        self.assertEqual(af["architecture"], bf["architecture"])
        self.assertNotEqual(af["signature"]["sha256"], bf["signature"]["sha256"])
        self.assertEqual(af["signature"]["offset"], 272)
        self.assertEqual(af["signature"]["slots"][0]["slot"], "0x0")

    def test_code_byte_change_is_detected(self):
        a = fixture()
        b = bytearray(a)
        b[260] ^= 1
        self.assertNotEqual(parity.macho(a)["sections"], parity.macho(bytes(b))["sections"])
        with self.assertRaisesRegex(AssertionError, "NON-SIGNATURE.*260"):
            parity.require_neutral_parity(a[:272], bytes(b[:272]))

    def test_metadata_or_trailing_byte_change_is_detected(self):
        for offset in (0, 20, 220, 271):
            a = fixture()[:272]
            b = bytearray(a)
            b[offset] ^= 1
            with self.assertRaisesRegex(AssertionError, "NON-SIGNATURE"):
                parity.require_neutral_parity(a, bytes(b))
        with self.assertRaisesRegex(AssertionError, "NON-SIGNATURE"):
            parity.require_neutral_parity(a, a + b"\0")

    def test_neutral_equality_is_exact(self):
        parity.require_neutral_parity(b"complete executable", b"complete executable")
        self.assertIsNone(parity.first_difference(b"same", b"same"))
        self.assertEqual(parity.first_difference(b"same", b"same!"), 4)

    def test_unknown_architecture_or_fat_binary_is_refused(self):
        for offset, value in ((0, 0xCAFEBABE), (4, 0x01000007)):
            body = bytearray(fixture())
            struct.pack_into("<I", body, offset, value)
            with self.assertRaisesRegex(AssertionError, "thin arm64"):
                parity.macho(bytes(body))

    def test_missing_or_unbounded_signature_is_refused(self):
        body = bytearray(fixture())
        struct.pack_into("<I", body, 184, 0)
        with self.assertRaisesRegex(AssertionError, "missing"):
            parity.macho(bytes(body))
        for offset, value in ((192, 260), (196, 0xFFFFFFFF), (20, 0xFFFFFFFF)):
            body = bytearray(fixture())
            struct.pack_into("<I", body, offset, value)
            with self.assertRaises(AssertionError):
                parity.macho(bytes(body))

    def test_entitlement_contract_rejects_wrong_identity_or_debug(self):
        valid = {"com.apple.developer.devicecheck.appattest-environment": "production",
                 "get-task-allow": False, "application-identifier": parity.TEAM + "." + parity.BUNDLE,
                 "com.apple.developer.team-identifier": parity.TEAM}
        parity.validate_entitlements(valid)
        for key, value in (("get-task-allow", True),
                           ("com.apple.developer.devicecheck.appattest-environment", "development"),
                           ("application-identifier", "wrong.app"),
                           ("com.apple.developer.team-identifier", "OTHER")):
            invalid = copy.deepcopy(valid)
            invalid[key] = value
            with self.assertRaises(AssertionError):
                parity.validate_entitlements(invalid)


@unittest.skipUnless(sys.platform == "darwin", "real Mach-O codesign regression requires macOS")
class AppleToolParityTests(unittest.TestCase):
    def test_real_resigning_passes_and_real_code_change_fails(self):
        with tempfile.TemporaryDirectory(prefix="gridly-parity-regression-") as temporary:
            work = Path(temporary)
            source = work / "main.c"
            source.write_text("int main(void) { return 0; }\n")
            a, b = work / "signed-a", work / "signed-b"
            subprocess.run(["xcrun", "clang", "-arch", "arm64", str(source), "-o", str(a)], check=True, capture_output=True)
            b.write_bytes(a.read_bytes())
            for path, identifier in ((a, "parity.fixture.a"), (b, "parity.fixture.b")):
                subprocess.run(["codesign", "--force", "--sign", "-", "--identifier", identifier, str(path)], check=True, capture_output=True)
                subprocess.run(["codesign", "--verify", "--strict", str(path)], check=True, capture_output=True)
            signed_a, signed_b = a.read_bytes(), b.read_bytes()
            self.assertNotEqual(signed_a, signed_b)
            self.assertEqual(parity.macho(signed_a)["sections"], parity.macho(signed_b)["sections"])
            neutral_a = parity.unsigned_copy(a, work / "neutral-a")
            neutral_b = parity.unsigned_copy(b, work / "neutral-b")
            parity.require_neutral_parity(neutral_a, neutral_b)
            self.assertIsNone(parity.macho(neutral_a, signed=False)["signature"])
            self.assertEqual(a.read_bytes(), signed_a)
            self.assertEqual(b.read_bytes(), signed_b)
            changed = bytearray(signed_b)
            text_section = next(s for s in parity.macho(signed_b)["sections"] if s["section"] == "__text")
            changed[text_section["offset"]] ^= 1
            b.write_bytes(changed)
            subprocess.run(["codesign", "--force", "--sign", "-", "--identifier", "parity.fixture.b", str(b)], check=True, capture_output=True)
            changed_neutral = parity.unsigned_copy(b, work / "changed-neutral")
            with self.assertRaisesRegex(AssertionError, "NON-SIGNATURE"):
                parity.require_neutral_parity(neutral_a, changed_neutral)


if __name__ == "__main__":
    unittest.main()
