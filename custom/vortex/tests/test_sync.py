import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('sync',Path(__file__).resolve().parents[1]/'sync.py')
sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)
class MergeSafety(unittest.TestCase):
    def setup_repo(self,path):
        def git(*args):return sync.git(path,*args).stdout.strip()
        git('init','-b','main');git('config','user.name','test');git('config','user.email','test@example.com')
        (path/'app.txt').write_text('original\n');git('add','.');git('commit','-m','base')
        git('branch','upstream');git('checkout','-b','vortex')
        (path/'custom').mkdir();(path/'custom/brand').write_text('Vortex')
        git('add','.');git('commit','-m','brand');git('branch','vortex-base')
        return git
    def test_merge_preserves_customization_and_second_run_is_noop(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);g=self.setup_repo(p)
            g('checkout','upstream');(p/'feature.txt').write_text('new improvement');g('add','.');g('commit','-m','upstream')
            g('checkout','vortex')
            result=sync.integrate(p,'vortex-base','upstream');self.assertEqual(result['state'],'merged')
            self.assertEqual((p/'custom/brand').read_text(),'Vortex');self.assertTrue((p/'feature.txt').exists())
            head=g('rev-parse','HEAD');sync.integrate(p,'vortex-base','upstream');self.assertEqual(g('rev-parse','HEAD'),head)
    def test_conflict_aborts_without_choosing_side(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);g=self.setup_repo(p)
            (p/'app.txt').write_text('Vortex edit\n');g('add','.');g('commit','-m','local')
            g('checkout','upstream');(p/'app.txt').write_text('Upstream edit\n');g('add','.');g('commit','-m','upstream')
            g('checkout','vortex');head=g('rev-parse','HEAD')
            result=sync.integrate(p,'vortex-base','upstream')
            self.assertEqual(result['state'],'conflict');self.assertIn('app.txt',result['conflicts'])
            self.assertEqual(g('rev-parse','HEAD'),head);self.assertEqual((p/'app.txt').read_text(),'Vortex edit\n')
            self.assertEqual(g('status','--porcelain'),'')

class SnapshotSafety(unittest.TestCase):
    def test_catalog_only_changes_cannot_advance_without_application_snapshot(self):
        import json
        with tempfile.TemporaryDirectory() as folder:
            repo=Path(folder)
            def g(*args):return sync.git(repo,*args).stdout.strip()
            g('init','-b','main');g('config','user.name','test');g('config','user.email','test@example.com')
            for name,text in {'app/version.js':'export const VERSION = "1.0.8";','app/data/catalog.js':'old catalog',
                              'ps5-react/runtime.js':'old framework','tools/source.py':'old tool'}.items():
                path=repo/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
            g('add','.');g('commit','-m','upstream old');old=g('rev-parse','HEAD');g('branch','upstream')
            (repo/'custom/vortex').mkdir(parents=True)
            manifest=repo/'custom/vortex/upstream-baseline.json';manifest.write_text(json.dumps(sync.describe(old,root=repo)))
            (repo/'custom/vortex/brand.json').write_text('Vortex identity')
            (repo/'tools/catalog-diagnostics').mkdir();(repo/'tools/catalog-diagnostics/keep.py').write_text('diagnostics')
            g('add','.');g('commit','-m','Vortex layer');g('branch','vortex-base')
            g('checkout','upstream');(repo/'app/version.js').write_text('export const VERSION = "1.0.9";')
            (repo/'app/data/catalog.js').write_text('new catalog');(repo/'ps5-react/runtime.js').write_text('new framework')
            g('add','.');g('commit','-m','upstream new');tip=g('rev-parse','HEAD')
            g('checkout','main')
            result=sync.integrate(repo,'vortex-base','upstream')
            self.assertEqual(result['baseline']['sourceVersion'],'1.0.9')
            self.assertEqual(json.loads(manifest.read_text())['commit'],tip)
            self.assertEqual((repo/'app/data/catalog.js').read_text(),'new catalog')
            self.assertEqual((repo/'ps5-react/runtime.js').read_text(),'new framework')
            self.assertEqual((repo/'custom/vortex/brand.json').read_text(),'Vortex identity')
            self.assertTrue((repo/'tools/catalog-diagnostics/keep.py').exists())
            head=g('rev-parse','HEAD');self.assertEqual(sync.integrate(repo,'vortex-base','upstream')['state'],'unchanged')
            self.assertEqual(g('rev-parse','HEAD'),head)
