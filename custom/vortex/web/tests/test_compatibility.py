import hashlib
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'custom/vortex'))
from web.integration import overlay

class Compatibility(unittest.TestCase):
    def test_changed_upstream_queue_or_native_hook_fails_with_actionable_diagnostic(self):
        import json
        contracts=json.loads((overlay.WEB/'contracts.json').read_text())
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            for name in contracts:
                destination=root/name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,destination)
            for name in ['app/state/download-queue.js','ps5-react/native/shared/host_api.cpp']:
                source=root/name;original=source.read_bytes();source.write_bytes(original+b'\n// incompatible upstream modification\n')
                with patch.object(overlay,'ROOT',root):
                    with self.assertRaisesRegex(ValueError,'Vortex Web integration incompatible'):overlay.verify()
                source.write_bytes(original)
    def test_missing_auth_or_frontend_cannot_silently_disable_extension(self):
        with tempfile.TemporaryDirectory() as folder:
            web=Path(folder)/'web';shutil.copytree(overlay.WEB,web,ignore=shutil.ignore_patterns('node_modules','__pycache__'))
            (web/'security/auth.js').unlink()
            with patch.object(overlay,'WEB',web):
                with self.assertRaisesRegex(ValueError,'extension missing'):overlay.verify()
    def test_private_abi_installed_once_and_original_framework_stays_unchanged(self):
        original=(ROOT/'ps5-react/native/shared/host_api.cpp').read_bytes()
        framework=overlay.framework_overlay();first=(framework/'native/shared/host_api.cpp').read_bytes()
        overlay.framework_overlay();second=(framework/'native/shared/host_api.cpp').read_bytes()
        self.assertEqual(first,second);self.assertEqual(first.count(b'vortex_web::install(ctx, global)'),1)
        self.assertEqual((ROOT/'ps5-react/native/shared/host_api.cpp').read_bytes(),original)
        self.assertNotIn(b'vortex_web::install',original)
    def test_replacement_contract_refuses_changed_integration_shape(self):
        with self.assertRaisesRegex(ValueError,'hook changed'):overlay.replace_once('new upstream API','old API','web API','native listener')

if __name__=='__main__':unittest.main()
