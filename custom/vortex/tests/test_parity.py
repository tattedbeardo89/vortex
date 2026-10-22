import hashlib
import json
from pathlib import Path
import sys
import unittest

CUSTOM=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(CUSTOM))
from baseline import ROOT, verify
from overlay import OUTPUT
from parity import evaluate_directory
sys.path.insert(0,str(ROOT/'tools/catalog-diagnostics'))
from compare import evaluate

class BaselineParity(unittest.TestCase):
    def test_selected_source_and_catalog_trees_are_exact(self):
        baseline=verify()
        self.assertEqual((OUTPUT/'state/catalog-update.js').exists(),baseline['catalog']['updateConsumer'])
        for path in (ROOT/'app/data').rglob('*'):
            if path.is_file():self.assertEqual(path.read_bytes(),(OUTPUT/'data'/path.relative_to(ROOT/'app/data')).read_bytes())

    def test_homebrew_real_manifest_and_cache_behavior_parity(self):
        path=CUSTOM/'tests/fixtures/homebrew-index.json'
        provenance=json.loads((path.parent/'homebrew-provenance.json').read_text())
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),provenance['sha256'])
        baseline=verify()
        expected=evaluate(baseline['commit'],homebrew=path)
        actual=evaluate_directory(OUTPUT,homebrew=path)
        self.assertEqual(actual['homebrewCount'],provenance['visibleApps'])
        self.assertEqual(actual['homebrewEntries'],expected['homebrewEntries'])
        self.assertEqual(actual['visible'],expected['visible'])
        # v1.0.8 must ignore any stale 1.0.9 commercial catalog cache.
        if baseline['sourceVersion']=='1.0.8':
            self.assertFalse((OUTPUT/'state/catalog-update.js').exists())
        self.assertEqual((ROOT/'app/state/paused-hosts.js').read_bytes(),(OUTPUT/'state/paused-hosts.js').read_bytes())
        self.assertEqual((ROOT/'app/state/catalog.js').read_bytes(),(OUTPUT/'state/catalog.js').read_bytes())
        self.assertEqual((ROOT/'app/state/release-cache.js').read_bytes(),(OUTPUT/'state/release-cache.js').read_bytes())

if __name__=='__main__':unittest.main()
