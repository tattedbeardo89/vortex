#!/usr/bin/env python3
"""Describe and verify one complete upstream application/catalog source baseline."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / 'custom/vortex/upstream-baseline.json'
SOURCE_PATHS = ['app', 'ps5-react', 'tools', ':(exclude)tools/catalog-diagnostics']

def git(*args, root=ROOT):
    return subprocess.check_output(['git', *args], cwd=root)

def describe(ref, root=ROOT):
    commit = git('rev-parse', ref, root=root).decode().strip()
    version = re.search(r'"([0-9.]+)"', git('show', f'{commit}:app/version.js', root=root).decode())[1]
    def object_id(path):
        return git('rev-parse', f'{commit}:{path}', root=root).decode().strip()
    consumer = subprocess.run(['git','cat-file','-e',f'{commit}:app/state/catalog-update.js'],cwd=root,capture_output=True).returncode == 0
    return {'format':1, 'repository':'MyLuxy/overdrive', 'ref':ref, 'commit':commit, 'sourceVersion':version,
            'sourcePaths':SOURCE_PATHS, 'appTree':object_id('app'), 'frameworkTree':object_id('ps5-react'),
            'catalog':{'dataRevision':object_id('app/data'), 'moduleSha256':hashlib.sha256(git('show',f'{commit}:app/data/catalog.js',root=root)).hexdigest(),
                       'schema':'upstream JavaScript catalog + JSON releases/pages', 'schemaVersion':None,
                       'schemaVersionReason':'No separately numbered bundled schema in this upstream version',
                       'updateConsumer':consumer, 'updateCompatibilityVersion':version if consumer else None}}

def selected():
    return json.loads(FILE.read_text())

def verify():
    baseline = selected()
    expected = describe(baseline['commit'])
    expected['ref'] = baseline['ref']
    if baseline != expected:
        raise ValueError('Upstream baseline metadata does not match its pinned Git source')
    changed = git('diff','--name-only',baseline['commit'],'--',*SOURCE_PATHS).decode().splitlines()
    if changed:
        raise ValueError('Application/framework/tooling drift from selected upstream baseline: ' + ', '.join(changed[:12]))
    return baseline

if __name__ == '__main__':
    print(json.dumps(verify(), indent=2))
