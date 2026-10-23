import hashlib,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
CUSTOM=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(CUSTOM))
from native import overlay
class NativeShellContracts(unittest.TestCase):
    def test_upstream_navigation_or_card_change_requires_review(self):
        contracts=json.loads((CUSTOM/'native/contracts.json').read_text())
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for name in contracts:
                path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes((overlay.ROOT/name).read_bytes())
            with patch.object(overlay,'ROOT',root):
                overlay.verify()
                for name in ['app/state/nav.jsx','app/ui/GameCard.jsx']:
                    path=root/name;original=path.read_bytes();path.write_bytes(original+b'\n// changed controller contract\n')
                    with self.assertRaisesRegex(ValueError,'shell incompatible'):overlay.verify()
                    path.write_bytes(original)
    def test_build_identity_and_assets_share_the_packaged_frontend_revision(self):
        root=CUSTOM.parents[1];stage=root/'.vortex/vortex'
        record=json.loads((stage/'VORTEX-BUILD.json').read_text())
        self.assertIn(record['webFrontendId'],(stage/'vortex-web-assets/index.html').read_text())
        self.assertEqual(record['brandingRevision'],hashlib.sha256((CUSTOM/'branding/angular-v.svg').read_bytes()).hexdigest())
        self.assertEqual(record['pairingSchema'],1);self.assertEqual(record['storagePolicy'],2)
        self.assertIn('VORTEX-BUILD.json',json.loads((stage/'app.json').read_text())['resources'])
