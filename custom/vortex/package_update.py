#!/usr/bin/env python3
"""Package a verified Vortex exFAT image and its versioned identity manifest."""
import argparse
import json
import zipfile
from overlay import ROOT, configuration
from baseline import selected

MANIFEST = 'vortex-update.json'

def verify_package(path):
    brand = configuration()
    with zipfile.ZipFile(path) as package:
        if sorted(package.namelist()) != sorted([brand['artifact'], MANIFEST]):
            raise ValueError('Unexpected update archive entries')
        manifest = json.loads(package.read(MANIFEST))
        expected = {key: brand[key] for key in ('name', 'repository', 'titleId', 'contentId', 'version')}
        if any(manifest.get(key) != value for key, value in expected.items()) or manifest.get('format') != 1 or manifest.get('image') != brand['artifact']:
            raise ValueError('Vortex update manifest identity mismatch')
        if manifest.get('upstream') != selected():
            raise ValueError('Vortex update source/catalog baseline provenance mismatch')
        info = package.getinfo(brand['artifact'])
        if info.file_size != manifest['size'] or info.file_size < 1024 ** 2 or info.file_size % 512:
            raise ValueError('Invalid exFAT image size')
        with package.open(brand['artifact']) as image:
            if image.read(11)[3:] != b'EXFAT   ': raise ValueError('Not an exFAT image')
        if package.testzip() is not None: raise ValueError('Update ZIP CRC failure')
    return manifest

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    brand = configuration()
    path = ROOT / brand['updateAsset']
    if not args.verify:
        # Never package arbitrary images as Vortex. First validate the current native output.
        from validate import validate_built
        validate_built(brand)
        image = ROOT / brand['artifact']
        manifest = {'format': 1, **{k: brand[k] for k in ('name', 'repository', 'titleId', 'contentId', 'version')},
                    'image': image.name, 'size': image.stat().st_size, 'upstream': selected()}
        with image.open('rb') as stream:
            if stream.read(11)[3:] != b'EXFAT   ': raise ValueError('Not an exFAT image')
        manifest_path = ROOT / MANIFEST
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
        temporary = path.with_suffix('.zip.tmp')
        try:
            with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED) as package:
                package.write(image, image.name)
                package.write(manifest_path, MANIFEST)
            verify_package(temporary)
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)
    verify_package(path)
    print('PASS: Vortex update ZIP, exFAT header, manifest identity, size and CRC')

if __name__ == '__main__': main()
