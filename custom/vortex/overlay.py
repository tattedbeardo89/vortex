#!/usr/bin/env python3
"""Apply reviewed Vortex customization to a disposable copy, never upstream app/."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
CUSTOM = ROOT / 'custom/vortex'
OUTPUT = ROOT / '.vortex/vortex'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def configuration():
    brand = json.loads((CUSTOM / 'brand.json').read_text())
    if brand['name'] != 'Vortex' or not re.fullmatch(r'PPSA\d{5}', brand['titleId']) or brand['titleId'] == 'PPSA99058':
        raise ValueError('Invalid or conflicting Vortex identity')
    if not re.fullmatch(r'[A-Z]{2}\d{4}-' + brand['titleId'] + r'_00-[A-Z0-9]{16}', brand['contentId']):
        raise ValueError('Content ID does not match title ID')
    if not re.fullmatch(r'(0|[1-9]\d?)\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})', brand['version']):
        raise ValueError('Use stable major.minor.patch within PS5 metadata limits (99.999.999)')
    if brand['repository'] != 'tattedbeardo89/vortex' or brand['upstream'] != 'MyLuxy/overdrive':
        raise ValueError('Review repository policy before changing release/upstream identity')
    if brand['artifact'] != 'Vortex.exfat' or brand['updateAsset'] != 'update.zip':
        raise ValueError('Vortex artifact naming contract changed')
    return brand

def verify_contracts():
    contracts = json.loads((CUSTOM / 'contracts.json').read_text())
    errors = [name for name, sha in contracts.items() if not (ROOT / name).is_file() or digest(ROOT / name) != sha]
    if errors:
        raise ValueError('Upstream customized files changed; review overlay/patch compatibility before refreshing contracts:\n' + '\n'.join(errors))
    return contracts

def tree(path):
    return {str(p.relative_to(path)): digest(p) for p in path.rglob('*') if p.is_file()}

def audit_generated(stage):
    for path in stage.rglob('*'):
        if path.suffix not in ('.js', '.jsx') or 'data' in path.relative_to(stage).parts or '.test.' in path.name:
            continue
        for line in path.read_text().splitlines():
            if line.lstrip().startswith('//'):
                continue
            if re.search(r'\bOverdrive\b(?! CDN)', line):
                raise ValueError(f'Unreviewed application branding in {path.relative_to(stage)}')
    for path in (stage / 'state').glob('*.js'):
        if 'PPSA99058' in path.read_text():
            raise ValueError(f'Unreviewed upstream title identity: {path.name}')
        if path.name in ('update.js', 'updater.js', 'vortex-update-policy.js') and 'MyLuxy/overdrive' in path.read_text():
            raise ValueError(f'Upstream self-update source leaked into Vortex: {path.name}')

def prepare():
    brand = configuration()
    contracts = verify_contracts()
    OUTPUT.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='overlay-', dir=OUTPUT.parent) as tmp:
        stage = Path(tmp) / 'vortex'
        shutil.copytree(ROOT / 'app', stage)
        for patch in sorted((CUSTOM / 'patches').glob('*.patch')):
            subprocess.run(['git', 'apply', '--check', str(patch)], cwd=stage, check=True)
            subprocess.run(['git', 'apply', str(patch)], cwd=stage, check=True)
        for original in contracts:
            path = stage / Path(original).relative_to('app')
            if original in ('app/state/update.js', 'app/state/updater.js'):
                continue
            if path.suffix in ('.js', '.jsx', '.json') and path.name not in ('app.json', 'version.js'):
                text = path.read_text()
                # Display text only: the existing provider is still called Overdrive CDN.
                text = re.sub(r'Overdrive(?! CDN)', brand['name'], text)
                text = text.replace('PPSA99058', brand['titleId'])
                text = text.replace('/overdrive', '/vortex').replace('overdrive-update', 'vortex-update') if '/state/' in original else text
                # Preserve actual catalog update services and all data/provider identifiers.
                if original == 'app/state/catalog-update.js':
                    text = text.replace('raw.githubusercontent.com/MyLuxy/vortex/', 'raw.githubusercontent.com/MyLuxy/overdrive/')
                    text = text.replace("import { VERSION } from '../version.js';", "import { UPSTREAM_VERSION as VERSION } from '../version.js';")
                if '/locales/' in original or original == 'app/browse/BrowsePage.jsx':
                    text = text.replace('github.com/MyLuxy/overdrive', 'github.com/' + brand['repository'])
                if original == 'app/index.jsx':
                    text = text.replace('[overdrive]', '[vortex]').replace('registerComponent("overdrive"', 'registerComponent("vortex"')
                path.write_text(text)
        for source, destination in [('Logo.jsx', 'ui/Logo.jsx'), ('Splash.jsx', 'ui/Splash.jsx'),
                                    ('install-location.js', 'state/install-location.js'), ('update-policy.js', 'state/vortex-update-policy.js')]:
            shutil.copyfile(CUSTOM / 'runtime' / source, stage / destination)
        (stage / 'vortex-brand.js').write_text('export const BRAND = Object.freeze(' + json.dumps(brand, indent=2) + ');\n')
        (stage / 'ui/colors.js').write_text('export const colors = ' + json.dumps(brand['theme'], indent=2) + ';\n')
        for key, filename in [('icon', 'icon0.png'), ('selectedBackground', 'pic0.dds'), ('launchBackground', 'pic1.dds')]:
            asset = (ROOT / brand['assets'][key]).resolve()
            if not asset.is_relative_to(ROOT) or not asset.is_file():
                raise ValueError(f'Missing or unsafe artwork path: {key}')
            shutil.copyfile(asset, stage / 'sce_sys' / filename)
        upstream_version = (ROOT / 'app/version.js').read_text()
        (stage / 'version.js').write_text('export const VERSION = ' + json.dumps(brand['version']) + ';\nexport const UPSTREAM_VERSION = ' + json.dumps(re.search(r'\"([0-9.]+)\"', upstream_version)[1]) + ';\n')
        config = json.loads((stage / 'app.json').read_text())
        major, minor, patch = map(int, brand['version'].split('.'))
        shutil.copyfile(CUSTOM / 'NOTICE.txt', stage / 'VORTEX-NOTICE.txt')
        config['resources'] = [*config.get('resources', []), 'VORTEX-NOTICE.txt']
        config.update(name=brand['name'], titleId=brand['titleId'], contentId=brand['contentId'], version=f'{major:02}.{minor:03}.{patch:03}')
        (stage / 'app.json').write_text(json.dumps(config, indent=2) + '\n')
        report = {'format': 1, 'brand': brand['name'], 'titleId': brand['titleId'], 'repository': brand['repository'],
                  'version': brand['version'], 'upstreamVersion': re.search(r'"([0-9.]+)"', upstream_version)[1],
                  'customizedSources': contracts}
        (stage / '.vortex-generated.json').write_text(json.dumps(report, indent=2) + '\n')
        audit_generated(stage)
        if OUTPUT.exists():
            if not (OUTPUT / '.vortex-generated.json').is_file():
                raise ValueError(f'Refusing to overwrite unowned directory {OUTPUT}')
            if tree(OUTPUT) == tree(stage):
                print(f'Unchanged: {OUTPUT}')
                return OUTPUT
            shutil.rmtree(OUTPUT)
        shutil.move(stage, OUTPUT)
    print(f'Prepared {OUTPUT}')
    return OUTPUT

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check source contracts/config without writing')
    args = parser.parse_args()
    if args.check:
        configuration(); verify_contracts(); print('Vortex configuration and upstream contracts valid')
    else:
        prepare()
