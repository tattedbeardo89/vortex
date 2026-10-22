"""Pinned historical counts and real filtering/update regressions (no HTTP)."""
import json
import os
import subprocess
from pathlib import Path
import tempfile
import unittest
from compare import BUILD, RELEASE, UPSTREAM, ROOT, evaluate, comparison

class CatalogRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.old=evaluate(RELEASE)
        cls.new=evaluate(BUILD)
        cls.latest=evaluate(UPSTREAM)

    def test_console_counts_reproduced(self):
        self.assertEqual(self.old['visible'], {'total':1148,'ps5':1009,'ps4':139})
        self.assertEqual(self.new['visible'], {'total':2105,'ps5':1123,'ps4':982})
        delta=comparison(self.old,self.new)
        self.assertEqual(delta['addedCounts'],{'ps5':114,'ps4':843})
        self.assertEqual(delta['removedCounts'],{'ps5':0,'ps4':0})

    def test_current_upstream_parity(self):
        self.assertEqual(self.new['hashes'],self.latest['hashes'])
        self.assertEqual(self.new['entries'],self.latest['entries'])
        self.assertEqual(self.new['visible'],self.latest['visible'])

    def test_no_source_and_paused_only_hidden_unless_edition_available(self):
        entries=self.new['entries']
        playable_works=set(self.new['eligibleWorkIds'])
        for entry in entries:
            with self.subTest(id=entry['id']):
                if entry['eligible']:
                    self.assertTrue(entry['visible'])
                elif entry['visible']:
                    self.assertIn(entry['work'],playable_works)
        self.assertEqual(self.new['hidden'],{'total':386,'ps5':29,'ps4':357})
        self.assertEqual(self.new['visibleByEditionFallback']['total'],22)
        self.assertEqual(self.new['visibleWithoutAnyEditionReleaseRows'],[])
        self.assertEqual(self.new['duplicateTitleIds'],[])
        self.assertEqual(self.new['visible']['total'],len([e for e in entries if e['visible']]))
        self.assertEqual(self.new['retainedTwins']['total'],403)  # not appended to primary list

    def test_working_application_filters_match_tested_upstream(self):
        env={**os.environ,'CATALOG_APP_ROOT':str(ROOT/'app'),
             'CATALOG_REACT_PATH':str(ROOT/'ps5-react/node_modules/react/index.js')}
        env.pop('CATALOG_UPDATE_FILE',None)
        env.pop('CATALOG_HOMEBREW_FILE',None)
        actual=json.loads(subprocess.check_output(['node',str(ROOT/'tools/catalog-diagnostics/evaluate.mjs')],env=env))
        baseline=json.loads((ROOT/'custom/vortex/upstream-baseline.json').read_text())
        expected=evaluate(baseline['commit'])
        self.assertEqual(actual['visible'],expected['visible'])
        self.assertEqual(actual['entries'],expected['entries'])
        self.assertEqual(actual['visibleWithoutAnyEditionReleaseRows'],[])

    def test_paused_sibling_policy_change_not_responsible_for_ps4_growth(self):
        self.assertEqual(self.new['policyMatrix']['releasePolicy'],{'total':2092,'ps5':1110,'ps4':982})
        self.assertEqual(self.new['policyMatrix']['currentPolicy'],self.new['visible'])

    def test_independent_cache_version_and_removal_before_filtering(self):
        update={'format':1,'version':'1.0.9','generated':'diagnostic-test','games':[],
                'removed':[next(e['id'] for e in self.new['entries'] if e['visible'] and e['platform']=='ps4')],
                'releases':{},'pages':{}}
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'catalog-update.json'
            def run():
                text=json.dumps(update);path.write_text(text)
                result=evaluate(BUILD,path)
                self.assertEqual(path.read_text(),text)  # read-only diagnostics, including invalid caches
                return result
            applied=run()
            self.assertEqual(applied['update']['appliedVersion'],'1.0.9')
            self.assertEqual(applied['visible'],{'total':2104,'ps5':1123,'ps4':981})
            update['version']='1.0.0'  # Vortex app version must not substitute for upstream compatibility
            self.assertEqual(run()['visible'],self.new['visible'])
            del update['version'];update['base']='old-schema'
            self.assertEqual(run()['visible'],self.new['visible'])

if __name__=='__main__':
    unittest.main()
