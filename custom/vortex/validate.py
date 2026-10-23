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
    branding=json.loads((app/'VORTEX-BRANDING.json').read_text())
    assert branding==json.loads((OUTPUT/'VORTEX-BRANDING.json').read_text())
    assert branding['masterSha256']==digest(CUSTOM/'branding/angular-v.svg')
    from PIL import Image
    for name,record in branding['files'].items():
        assert digest(app/name)==record['sha256']
        with Image.open(app/name) as image:
            assert list(image.size)==record['dimensions']==([512,512] if name.endswith('.png') else [1920,1080])
    assert json.loads((app / 'VORTEX-WEB.json').read_text()) == json.loads((OUTPUT / 'VORTEX-WEB.json').read_text())
    for name, checksum in json.loads((app / 'VORTEX-WEB.json').read_text())['assets'].items():
        assert digest(app / 'vortex-web-assets' / name) == checksum
    assert json.loads((app / 'VORTEX-BASELINE.json').read_text()) == json.loads((CUSTOM / 'upstream-baseline.json').read_text())
    assert (app / 'VORTEX-NOTICE.txt').read_text() == (CUSTOM / 'NOTICE.txt').read_text()
    subprocess.run([sys.executable, 'tools/verify.py', brand['titleId']], cwd=ROOT / '.vortex/framework', check=True)

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
    workflow = (ROOT / '.github/workflows/build.yml').read_text()
    assert brand['artifact'] in workflow and brand['titleId'] + '.receipt.json' in workflow
    assert 'Overdrive.exfat' not in workflow
    assert brand['version'] in (OUTPUT / 'version.js').read_text()
    assert 'FEED_OVERRIDES' not in (OUTPUT / 'state/update.js').read_text()
    assert brand['titleId'] in (OUTPUT / 'state/downloads.js').read_text()
    from baseline import verify as verify_baseline
    baseline = verify_baseline()
    consumer = OUTPUT / 'state/catalog-update.js'
    assert consumer.exists() == baseline['catalog']['updateConsumer']
    if consumer.exists():
        assert 'MyLuxy/overdrive/catalog/' in consumer.read_text()
        assert 'UPSTREAM_VERSION as VERSION' in consumer.read_text()
    assert '"overdrive cdn"' in (OUTPUT / 'game/sources.js').read_text()
    assert brand['name'] in (OUTPUT / 'vortex-brand.js').read_text()
    from web.integration.overlay import verify as verify_web
    verify_web()
    assert (OUTPUT / 'vortex-web/integration/WebPanel.jsx').is_file()
    assert 'jsx(WebPanel, {})' in (OUTPUT / 'ui/Header.jsx').read_text()
    assert 'vortex-web-assets' in config['resources']
    for path in (OUTPUT / 'i18n/locales').glob('*.json'):
        text = path.read_text()
        assert not re.search(r'Overdrive(?! CDN)', text), path
        assert 'github.com/MyLuxy/overdrive' not in text, path
    artwork_baseline = json.loads((CUSTOM / 'upstream-inventory.json').read_text())['base']
    # Existing binary artwork is retained; customization must not add binary images.
    changed = subprocess.check_output(['git', 'diff', '--numstat', artwork_baseline, '--'], cwd=ROOT, text=True)
    for line in changed.splitlines():
        added, deleted, name = line.split('\t', 2)
        assert not (added == '-' and Path(name).suffix.lower() in ('.png', '.jpg', '.jpeg', '.ico', '.webp', '.dds')), name
    if args.built: validate_built(brand)
    report = {'identity': {key: brand[key] for key in ('name', 'titleId', 'contentId', 'repository', 'artifact', 'version')},
              'upstreamBaseline': baseline, 'overlayIdempotent': True, 'nativeOutputVerified': args.built, 'hardwareTested': False}
    (ROOT / '.vortex/validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print('PASS: Vortex identity, release policy, provider preservation, locales, overlay idempotence and artwork policy')

if __name__ == '__main__': main()
