#!/usr/bin/env python3
"""Create/update only a draft release. Published versions are immutable here."""
import argparse
import json
import os
from pathlib import Path
import subprocess
from overlay import configuration

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets-dir',type=Path,required=True)
    args=parser.parse_args();brand=configuration()
    if os.environ.get('GITHUB_REPOSITORY')!=brand['repository'] or os.environ.get('GITHUB_EVENT_NAME')!='workflow_dispatch':
        raise RuntimeError('Draft releases require manual execution in the configured Vortex repository')
    assets=args.assets_dir
    for name in (brand['artifact'],brand['updateAsset'],'vortex-update.json','validation.json'):
        if not (assets/name).is_file():raise RuntimeError('Missing release artifact '+name)
    manifest=json.loads((assets/'vortex-update.json').read_text())
    report=json.loads((assets/'validation.json').read_text())
    if manifest['version']!=brand['version'] or manifest['titleId']!=brand['titleId'] or not report['nativeOutputVerified']:
        raise RuntimeError('Release metadata does not match the verified build')
    tag='v'+brand['version'];repo=brand['repository']
    previous=subprocess.run(['gh','api',f'repos/{repo}/releases/tags/{tag}'],text=True,capture_output=True)
    notes=assets/'release-notes.md'
    notes.write_text(f'Vortex {tag}\n\nBuild: {os.environ["GITHUB_SHA"]}\n\nDRAFT: validate on a supported console before manual publication. Review docs/RELEASING.md for attribution, corresponding-source and redistribution requirements.\n\nInstall Vortex.exfat separately from Overdrive; title {brand["titleId"]}. update.zip contains the Vortex image and identity manifest.\n')
    if previous.returncode:
        if 'HTTP 404' not in previous.stderr:raise RuntimeError(previous.stderr)
        subprocess.run(['gh','release','create',tag,'--repo',repo,'--draft','--target',os.environ['GITHUB_SHA'],
            '--title',f'Vortex {tag}','--notes-file',str(notes)],check=True)
    else:
        release=json.loads(previous.stdout)
        if not release.get('draft'):raise RuntimeError('Refusing to modify a published Vortex release; bump the Vortex version')
        subprocess.run(['gh','release','edit',tag,'--repo',repo,'--draft','--target',os.environ['GITHUB_SHA'],
            '--title',f'Vortex {tag}','--notes-file',str(notes)],check=True)
    files=[str(p) for p in sorted(assets.iterdir()) if p.is_file() and p.name!='release-notes.md']
    subprocess.run(['gh','release','upload',tag,'--repo',repo,*files,'--clobber'],check=True)

if __name__=='__main__':main()
