import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
CUSTOM=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(CUSTOM))
spec=importlib.util.spec_from_file_location('vortex_run',CUSTOM/'run.py');runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
from validate import validate_catalog_resources

class NativeOutput(unittest.TestCase):
    def test_only_receipt_owned_vortex_output_is_cleaned(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);dist=root/'ps5-react/dist';app=dist/'PPSA99189';app.mkdir(parents=True)
            (app/'stale.json').write_text('older snapshot');other=dist/'other-title';other.mkdir()
            with patch.object(runner,'ROOT',root):
                with self.assertRaisesRegex(RuntimeError,'unowned'):runner.clean_native_output({'titleId':'PPSA99189'})
                self.assertTrue(app.exists())
                (dist/'PPSA99189.receipt.json').write_text(json.dumps({'title':'PPSA99189','app':'vortex'}))
                runner.clean_native_output({'titleId':'PPSA99189'});self.assertFalse(app.exists());self.assertTrue(other.exists())
    def test_output_symlink_cannot_delete_another_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);dist=root/'ps5-react/dist';dist.mkdir(parents=True);other=root/'other';other.mkdir()
            (dist/'PPSA99189').symlink_to(other,target_is_directory=True)
            with patch.object(runner,'ROOT',root):
                with self.assertRaisesRegex(RuntimeError,'Unsafe'):runner.clean_native_output({'titleId':'PPSA99189'})
            self.assertTrue(other.exists())
    def test_removed_catalog_resources_are_rejected_and_legitimate_additions_follow_source(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);stage=root/'stage';app=root/'built'
            for target in [stage,app]:(target/'data/pages').mkdir(parents=True)
            (stage/'app.json').write_text(json.dumps({'resources':['data/pages']}))
            (stage/'data/pages/current.json').write_text('{}');(app/'data/pages/current.json').write_text('{}')
            validate_catalog_resources(app,stage)
            stale=app/'data/pages/old.json';stale.write_text('{}')
            with self.assertRaisesRegex(AssertionError,'catalog resources differ'):validate_catalog_resources(app,stage)
            (stage/'data/pages/old.json').write_text('{}');validate_catalog_resources(app,stage)
