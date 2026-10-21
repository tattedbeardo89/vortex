#!/usr/bin/env python3
"""Fail closed on identity drift, upstream overlay conflicts and unintended binary artwork."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
from overlay import ROOT, CUSTOM, OUTPUT, configuration, digest, prepare, tree

def validate_built(brand):
    dist = ROOT / 'ps5-react/dist'
    app = dist / brand['titleId']
    param = json.loads((app / 'sce_sys/param.json').read_text())
    receipt = json.loads((dist / (brand['titleId'] + '.receipt.json')).read_text())
    config = json.loads((OUTPUT / 'app.json').read_text())
    assert param['titleId'] == brand['titleId']
    assert param['contentId'] == brand['contentId']
    assert param['contentVersion'] == config['version']
    assert param['localizedParameters']['en-US']['titleName'] == brand['name']
    assert receipt['title'] == brand['titleId'] and receipt['config'] == config
    assert receipt['app'] == 'vortex' and not receipt['hardware_tested']
    assert (app / 'VORTEX-NOTICE.txt').read_text() == (CUSTOM / 'NOTICE.txt').read_text()
    subprocess.run([sys.executable, 'tools/verify.py', brand['titleId']], cwd=ROOT / 'ps5-react', check=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--built', action='store_true')
    args = parser.parse_args()
    brand = configuration()
    prepare()
    before = tree(OUTPUT)
    prepare()
    assert tree(OUTPUT) == before, 'Overlay must be idempotent'
    config = json.loads((OUTPUT / 'app.json').read_text())
    for key in ('name', 'titleId', 'contentId'): assert config[key] == brand[key]
    assert brand['version'] in (OUTPUT / 'version.js').read_text()
    assert 'FEED_OVERRIDES' not in (OUTPUT / 'state/update.js').read_text()
    assert brand['titleId'] in (OUTPUT / 'state/downloads.js').read_text()
    assert 'MyLuxy/overdrive/catalog/' in (OUTPUT / 'state/catalog-update.js').read_text()
    assert '"overdrive cdn"' in (OUTPUT / 'game/sources.js').read_text()
    assert brand['name'] in (OUTPUT / 'vortex-brand.js').read_text()
    for path in (OUTPUT / 'i18n/locales').glob('*.json'):
        text = path.read_text()
        assert not re.search(r'Overdrive(?! CDN)', text), path
        assert 'github.com/MyLuxy/overdrive' not in text, path
    baseline = json.loads((CUSTOM / 'upstream-inventory.json').read_text())['base']
    # Existing binary artwork is retained; customization must not add binary images.
    changed = subprocess.check_output(['git', 'diff', '--numstat', baseline, '--'], cwd=ROOT, text=True)
    for line in changed.splitlines():
        added, deleted, name = line.split('\t', 2)
        assert not (added == '-' and Path(name).suffix.lower() in ('.png', '.jpg', '.jpeg', '.ico', '.webp', '.dds')), name
    if args.built: validate_built(brand)
    report = {'identity': {key: brand[key] for key in ('name', 'titleId', 'contentId', 'repository', 'artifact', 'version')},
              'overlayIdempotent': True, 'nativeOutputVerified': args.built, 'hardwareTested': False}
    (ROOT / '.vortex/validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print('PASS: Vortex identity, release policy, provider preservation, locales, overlay idempotence and artwork policy')

if __name__ == '__main__': main()
