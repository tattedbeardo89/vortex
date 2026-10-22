"""Hash-reviewed test harness corrections; runtime/catalog source drift remains forbidden."""
import hashlib
import json
from pathlib import Path
import subprocess

MANIFEST = Path('custom/vortex/framework-test-overrides.json')
PATCH = Path('custom/vortex/overrides/framework-tests.patch')
# Only these test/harness files may differ from the selected source snapshot.
TEST_PATHS = {
    'ps5-react/runtime/js/native.test.mjs',
    'ps5-react/tools/test_network.py',
    'ps5-react/tools/test_images.py',
    'ps5-react/tools/test_archives.py',
    'ps5-react/tools/tests/image_client.cpp',
    'ps5-react/native/desktop/CMakeLists.txt',  # reviewed change is confined to the video-test target
}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def metadata(root):
    path = Path(root) / MANIFEST
    if not path.exists():
        return {}
    entries = json.loads(path.read_text())
    if not set(entries) <= TEST_PATHS:
        raise ValueError('Framework test override names an unapproved source path')
    return entries

def verify(root, ref):
    root = Path(root)
    entries = metadata(root)
    for name, item in entries.items():
        source = subprocess.run(['git', 'show', f'{ref}:{name}'], cwd=root, capture_output=True)
        if source.returncode:
            raise ValueError(f'Framework test override needs upstream review: {name} removed')
        original = source.stdout
        if sha(original) != item['upstreamSha256']:
            raise ValueError(f'Framework test override needs upstream review: {name}')
        if sha((root / name).read_bytes()) != item['patchedSha256']:
            raise ValueError(f'Framework test override missing or modified: {name}')
    return set(entries)

def apply(root):
    """Reapply only to the exact reviewed source after a complete upstream snapshot import."""
    root = Path(root)
    entries = metadata(root)
    if not entries:
        return
    for name in entries:
        if not (root / name).is_file():
            raise ValueError(f'Framework test override needs upstream review: {name} removed')
    actual = {name: sha((root / name).read_bytes()) for name in entries}
    if all(actual[name] == item['patchedSha256'] for name, item in entries.items()):
        return
    for name, item in entries.items():
        if actual[name] != item['upstreamSha256']:
            raise ValueError(f'Framework test override needs upstream review: {name}')
    patch = root / PATCH
    changed = subprocess.check_output(['git', 'apply', '--numstat', str(patch)], cwd=root, text=True)
    if {line.split('\t')[2] for line in changed.splitlines()} != set(entries):
        raise ValueError('Framework test patch changes paths outside its reviewed manifest')
    subprocess.run(['git', 'apply', '--check', str(patch)], cwd=root, check=True, capture_output=True)
    subprocess.run(['git', 'apply', str(patch)], cwd=root, check=True, capture_output=True)
    for name, item in entries.items():
        if sha((root / name).read_bytes()) != item['patchedSha256']:
            raise ValueError(f'Framework test patch output differs from reviewed hash: {name}')
