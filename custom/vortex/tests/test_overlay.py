import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / 'overlay.py'
spec = importlib.util.spec_from_file_location('vortex_overlay', MODULE)
overlay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(overlay)

class OverlayContracts(unittest.TestCase):
    def test_detects_incompatible_upstream_before_copying(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root/'app').mkdir(); (root/'custom').mkdir()
            (root/'app/index.jsx').write_text('new upstream implementation')
            (root/'custom/contracts.json').write_text(json.dumps({'app/index.jsx':'old-digest'}))
            with patch.object(overlay,'ROOT',root), patch.object(overlay,'CUSTOM',root/'custom'):
                with self.assertRaisesRegex(ValueError,'customized files changed'):
                    overlay.verify_contracts()

    def test_new_upstream_branding_is_flagged_but_provider_name_is_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            stage=Path(tmp);(stage/'ui').mkdir()
            source=stage/'ui/New.jsx'
            source.write_text('const label = "Overdrive CDN";')
            overlay.audit_generated(stage)
            source.write_text('const label = "Overdrive";')
            with self.assertRaisesRegex(ValueError,'Unreviewed application branding'):
                overlay.audit_generated(stage)

    def test_identity_schema_and_upstream_are_distinct(self):
        brand=overlay.configuration()
        self.assertNotEqual(brand['titleId'],'PPSA99058')
        self.assertIn(brand['titleId'],brand['contentId'])
        self.assertNotEqual(brand['repository'],brand['upstream'])

if __name__ == '__main__': unittest.main()
