import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.lp104.inspect_nad_r23 import archive_inventory


class NadInspectionTest(unittest.TestCase):
    def test_inventory_is_complete_and_read_only(self):
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "nad-r23.zip"
            with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("NAD_R23/readme.txt", "documentation")
                archive.writestr("NAD_R23/NAD.gdb/a00000001.gdbtable", "table")
            original = archive_path.read_bytes()

            report = archive_inventory(archive_path)

            self.assertEqual(report["archiveType"], "ZIP")
            self.assertEqual(report["memberCount"], 2)
            self.assertEqual(report["geodatabases"], ["NAD_R23/NAD.gdb"])
            self.assertEqual(report["topLevelEntries"], ["NAD_R23"])
            self.assertEqual(archive_path.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
