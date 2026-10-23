import json,hashlib,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from inspect_installation import audit

class InstallationAudit(unittest.TestCase):
    def test_stale_staged_root_icon_is_distinguished_from_correct_mount_and_appmeta(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);ref=root/'reference';mount=root/'mounted';reg=root/'registered';stage=root/'staged'
            for path in [ref,mount/'sce_sys',reg,stage/'sce_sys']:path.mkdir(parents=True)
            identity={'titleId':'PPSA99189','contentId':'UP9000-PPSA99189_00-VORTEXPS50000000'}
            for path in [mount/'sce_sys',reg,stage/'sce_sys']:(path/'param.json').write_text(json.dumps(identity))
            (ref/'VORTEX-BUILD.json').write_text(json.dumps({'commit':'verified-source'}));(mount/'VORTEX-BUILD.json').write_text((ref/'VORTEX-BUILD.json').read_text())
            expected={}
            for name in ['icon0.png','pic0.dds','pic1.dds']:
                data=('verified artwork '+name).encode();expected['sce_sys/'+name]={'sha256':hashlib.sha256(data).hexdigest()}
                for path in [mount/'sce_sys',reg,stage/'sce_sys']:(path/name).write_bytes(data)
            (stage/'icon0.png').write_bytes(b'old icon')
            (ref/'VORTEX-BRANDING.json').write_text(json.dumps({'files':expected}))
            before={str(p):p.read_bytes() for p in root.rglob('*') if p.is_file()}
            result=audit(ref,mount,reg,stage)
            self.assertTrue(result['buildMatches']);self.assertTrue(result['registeredIdentityMatches']);self.assertTrue(result['stagedIdentityMatches'])
            self.assertTrue(result['artwork']['sce_sys/icon0.png']['registeredMatches'])
            self.assertTrue(result['stagedArtwork']['sce_sys/icon0.png']['matches']);self.assertFalse(result['stagedArtwork']['icon0.png']['matches'])
            self.assertFalse(result['hardwareVerifiedByThisTool'])
            self.assertEqual(before,{str(p):p.read_bytes() for p in root.rglob('*') if p.is_file()})
