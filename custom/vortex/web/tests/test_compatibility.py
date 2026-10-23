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
    def test_snapshot_sync_preserves_web_and_framework_fixes_and_blocks_changed_hooks(self):
        import subprocess
        import sync
        from framework_test_overrides import verify as verify_test_overrides
        with tempfile.TemporaryDirectory() as folder:
            repo=Path(folder)/'repo'
            subprocess.run(['git','clone','--shared','--quiet',str(ROOT),str(repo)],check=True)
            def git(*args):return sync.git(repo,*args).stdout.strip()
            git('config','user.name','sync regression');git('config','user.email','test@example.com')
            git('branch','vortex-base');git('branch','vortex-test')
            import json
            baseline=json.loads((repo/'custom/vortex/upstream-baseline.json').read_text())
            git('checkout','-b','candidate',baseline['commit'])
            (repo/'tools/web-sync-regression.txt').write_text('compatible upstream tooling addition\n')
            git('add','.');git('commit','-m','Compatible upstream candidate')
            git('checkout','vortex-test')
            protected=list((repo/'custom/vortex/web').rglob('*'))+list((repo/'custom/vortex/branding').rglob('*'))+[repo/'custom/vortex'/name for name in ['branding.py','bc7.py','runtime/Logo.jsx','runtime/Splash.jsx']]
            before={str(p.relative_to(repo)):p.read_bytes() for p in protected if p.is_file()}
            result=sync.integrate_snapshot(repo,'vortex-base','candidate')
            self.assertEqual(result['state'],'merged');self.assertIsNone(result['frameworkTestReview'])
            verify_test_overrides(repo,'candidate')
            self.assertEqual(before,{name:(repo/name).read_bytes() for name in before})
            with patch.object(overlay,'ROOT',repo),patch.object(overlay,'WEB',repo/'custom/vortex/web'):overlay.verify()
            git('checkout','candidate')
            hook=repo/'ps5-react/native/shared/host_api.cpp';hook.write_bytes(hook.read_bytes()+b'\n// incompatible upstream host change\n')
            git('add','.');git('commit','-m','Incompatible upstream host candidate')
            git('checkout','vortex-test')
            sync.integrate_snapshot(repo,'vortex-base','candidate')
            with patch.object(overlay,'ROOT',repo),patch.object(overlay,'WEB',repo/'custom/vortex/web'):
                with self.assertRaisesRegex(ValueError,'Vortex Web integration incompatible'):overlay.verify()

    def test_replacement_contract_refuses_changed_integration_shape(self):
        with self.assertRaisesRegex(ValueError,'hook changed'):overlay.replace_once('new upstream API','old API','web API','native listener')

if __name__=='__main__':unittest.main()
