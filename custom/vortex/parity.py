#!/usr/bin/env python3
"""Compare actual upstream and generated Vortex catalog modules, without network probes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from baseline import ROOT, verify
from overlay import OUTPUT, prepare

sys.path.insert(0,str(ROOT/'tools/catalog-diagnostics'))
from compare import evaluate

PARITY_FIELDS=['bundled','effective','update','visible','hidden','visibleByEditionFallback','retainedTwins',
               'duplicateTitleIds','alternateWorks','eligibleWorkIds','entries','visibleWithoutOwnReleaseRows',
               'visibleWithoutAnyEditionReleaseRows','homebrewCount','homebrewEntries']

def evaluate_directory(app, cache=None, homebrew=None):
    env={**os.environ,'CATALOG_APP_ROOT':str(app),
         'CATALOG_REACT_PATH':str(ROOT/'ps5-react/node_modules/react/index.js')}
    for key,value in [('CATALOG_UPDATE_FILE',cache),('CATALOG_HOMEBREW_FILE',homebrew)]:
        env.pop(key,None)
        if value:env[key]=str(Path(value).resolve())
    return json.loads(subprocess.check_output(['node',str(ROOT/'tools/catalog-diagnostics/evaluate.mjs')],env=env,cwd=ROOT))

def run(cache=None, homebrew=None):
    homebrew=homebrew or ROOT/'custom/vortex/tests/fixtures/homebrew-index.json'
    baseline=verify()
    prepare()
    expected=evaluate(baseline['commit'],cache,homebrew)
    actual=evaluate_directory(OUTPUT,cache,homebrew)
    for key in PARITY_FIELDS:
        if expected[key]!=actual[key]:raise AssertionError(f'Upstream/Vortex catalog parity failed: {key}')
    return {'format':1,'baseline':baseline,'vortexVersion':actual['version']['VERSION'],
            'upstreamVersion':actual['version']['UPSTREAM_VERSION'],'parityFields':PARITY_FIELDS,
            'parity':True,'visible':actual['visible'],'hidden':actual['hidden'],
            'bundled':actual['bundled'],'retainedTwins':actual['retainedTwins'],
            'update':actual['update'],'homebrewCount':actual['homebrewCount'],
            'homebrewCacheSha256':hashlib.sha256(Path(homebrew).read_bytes()).hexdigest(),
            'homebrewNote':'Same real JSON cache evaluated by both modules; defaults to the recorded public API snapshot, not a frozen runtime catalog.',
            'availability':'Declared-provider/release-row eligibility only; remote file reachability not tested'}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog-update')
    parser.add_argument('--homebrew-cache')
    parser.add_argument('--output',default='.vortex/catalog-parity.json')
    args=parser.parse_args()
    report=run(args.catalog_update,args.homebrew_cache)
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
