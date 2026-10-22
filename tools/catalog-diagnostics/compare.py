#!/usr/bin/env python3
"""Compare pinned catalogs through their actual JS modules; never probe download hosts."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
RELEASE = '9f90d882771eb87f75579b10f951cc2dbe4daf2a'
BUILD = '7441739ec82dc90aa2864c9faea7ea004cb5fb8f'
UPSTREAM = 'c7e962db9a971a407f61d70473fade417de735ec'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def evaluate(ref, cache=None, homebrew=None):
    sha = git('rev-parse', ref).decode().strip()
    with tempfile.TemporaryDirectory(prefix='vortex-catalog-') as folder:
        with tarfile.open(fileobj=io.BytesIO(git('archive', sha, 'app'))) as archive:
            # Extract source and JSON only: no binary images or artifacts.
            for member in archive.getmembers():
                if member.isfile() and Path(member.name).suffix in {'.js', '.jsx', '.mjs', '.json'}:
                    archive.extract(member, folder, filter='data')
        env = {**os.environ, 'CATALOG_APP_ROOT': str(Path(folder)/'app'),
               'CATALOG_REACT_PATH': str(ROOT/'ps5-react/node_modules/react/index.js')}
        env.pop('CATALOG_UPDATE_FILE', None)
        env.pop('CATALOG_HOMEBREW_FILE', None)
        if homebrew:
            env['CATALOG_HOMEBREW_FILE'] = str(Path(homebrew).resolve())
        if cache:
            env['CATALOG_UPDATE_FILE'] = str(Path(cache).resolve())
        output = subprocess.check_output(['node', str(ROOT/'tools/catalog-diagnostics/evaluate.mjs')], env=env, cwd=ROOT)
        report = json.loads(output)
    report['commit'] = sha
    report['hashes'] = {}
    for path in ['app/data/catalog.js', 'app/state/catalog.js', 'app/state/paused-hosts.js', 'app/state/catalog-update.js']:
        result = subprocess.run(['git','show',f'{sha}:{path}'],cwd=ROOT,capture_output=True)
        report['hashes'][path] = hashlib.sha256(result.stdout).hexdigest() if result.returncode == 0 else None
    return report

def comparison(old, new):
    before = {g['id']:g for g in old['entries']}
    after = {g['id']:g for g in new['entries']}
    old_visible = {i for i,g in before.items() if g['visible']}
    new_visible = {i for i,g in after.items() if g['visible']}
    added = [after[i] for i in sorted(new_visible-old_visible)]
    removed = [before[i] for i in sorted(old_visible-new_visible)]
    def counts(rows):
        return {p:sum(g['platform']==p for g in rows) for p in ['ps5','ps4']}
    return {'added':added,'removed':removed,'addedCounts':counts(added),'removedCounts':counts(removed),
            'newPrimaryIds':counts([g for g in added if g['id'] not in before]),
            'previouslyHiddenIds':counts([g for g in added if g['id'] in before]),
            'addedWithEligibleDeclaredProvider':counts([g for g in added if g['eligible']]),
            'addedThroughEditionFallback':counts([g for g in added if not g['eligible']])}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--release',default=RELEASE)
    parser.add_argument('--vortex',default=BUILD)
    parser.add_argument('--upstream',default=UPSTREAM)
    parser.add_argument('--catalog-update',help='Read-only copy of the console catalog-update.json; applies only when version-compatible')
    parser.add_argument('--homebrew-cache',help='Optional read-only console homebrew.json for independently evaluated counts')
    parser.add_argument('--output',default='.vortex/catalog-comparison.json')
    args=parser.parse_args()
    snapshots={name:evaluate(ref,args.catalog_update,args.homebrew_cache) for name,ref in [('release',args.release),('vortex',args.vortex),('upstream',args.upstream)]}
    report={'schema':1,'availability':'Static declared-provider and release-row eligibility only; no host reachability checks.',
            'homebrew':{'observedOnConsole':{'overdrive':104,'vortex':104},'independentlyVerified':False,'reason':'Console homebrew caches were not supplied; commercial diagnostics do not alter or fetch homebrew.'},
            'cacheSupplied':bool(args.catalog_update),'snapshots':snapshots,
            'difference':comparison(snapshots['release'],snapshots['vortex'])}
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+'\n')
    for name,snapshot in snapshots.items():
        print(name,snapshot['commit'],json.dumps(snapshot['visible']))
    print('Report:',output)

if __name__=='__main__':
    main()
