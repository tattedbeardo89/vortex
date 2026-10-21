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
