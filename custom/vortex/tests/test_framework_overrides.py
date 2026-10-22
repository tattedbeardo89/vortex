import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

CUSTOM = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CUSTOM))
import baseline
import framework_test_overrides as fixes

class FrameworkTestOverrides(unittest.TestCase):
    def fixture(self, root):
        entries = fixes.metadata(baseline.ROOT)
        for name in entries:
            destination = root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(baseline.git('show', baseline.selected()['commit'] + ':' + name))
        for name in [fixes.MANIFEST, fixes.PATCH]:
            destination = root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(baseline.ROOT / name, destination)
        subprocess.run(['git', 'init', '-q'], cwd=root, check=True)
        subprocess.run(['git', 'add', '.'], cwd=root, check=True)
        subprocess.run(['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com',
                        'commit', '-qm', 'Original test snapshot'], cwd=root, check=True)
        return entries

    def test_exact_reviewed_patch_reapplies_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            entries = self.fixture(root)
            fixes.apply(root)
            self.assertEqual(fixes.verify(root, 'HEAD'), set(entries))
            before = {name: (root / name).read_bytes() for name in entries}
            fixes.apply(root)
            self.assertEqual(before, {name: (root / name).read_bytes() for name in entries})
            target = root / 'ps5-react/runtime/js/native.test.mjs'
            target.write_bytes(target.read_bytes() + b'\n// unreviewed change\n')
            with self.assertRaisesRegex(ValueError, 'missing or modified'):
                fixes.verify(root, 'HEAD')

    def test_changed_upstream_is_rejected_before_any_patch_is_applied(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            entries = self.fixture(root)
            target = root / 'ps5-react/runtime/js/native.test.mjs'
            target.write_bytes(target.read_bytes() + b'\n// upstream changed\n')
            before = {name: (root / name).read_bytes() for name in entries}
            with self.assertRaisesRegex(ValueError, 'needs upstream review'):
                fixes.apply(root)
            self.assertEqual(before, {name: (root / name).read_bytes() for name in entries})

    def test_test_exceptions_cannot_allow_runtime_drift(self):
        original = baseline.git
        def git(*args, **kwargs):
            data = original(*args, **kwargs)
            return data + b'ps5-react/runtime/js/native.js\n' if args[0] == 'diff' else data
        with patch.object(baseline, 'git', git):
            with self.assertRaisesRegex(ValueError, 'drift.*native.js'):
                baseline.verify()

    def test_capture_assertion_failure_does_not_poison_the_following_lan_test(self):
        source = (baseline.ROOT / 'ps5-react/runtime/js/native.test.mjs').read_text()
        assertion = "assert.deepEqual(calls, [['https://vikingfile.com/d/', '/Game.pkg', 180, [], false]]);"
        self.assertEqual(source.count(assertion), 1)
        source = source.replace(assertion, "assert.fail('intentional fixture failure');")
        for module in ['native.js', 'frame.js']:
            source = source.replace("'./" + module + "'", json.dumps((baseline.ROOT / 'ps5-react/runtime/js' / module).as_uri()))
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'native.test.mjs'
            file.write_text(source)
            result = subprocess.run(['node', '--test', '--test-reporter=tap',
                '--test-name-pattern=browser capture delivers|a LAN broadcast', str(file)],
                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('intentional fixture failure', result.stdout)
        self.assertRegex(result.stdout, r'(?m)^ok \d+ - a LAN broadcast')
        self.assertIn('# fail 1', result.stdout)

    def test_throttling_fixture_exercises_all_statuses_even_with_one_connection(self):
        import importlib.util
        import threading
        import urllib.request
        import urllib.error
        spec = importlib.util.spec_from_file_location('network_fixture', baseline.ROOT / 'ps5-react/tools/test_network.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        server = module.http.server.ThreadingHTTPServer(('127.0.0.1', 0), module.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        statuses = []
        try:
            for _ in range(4):
                request = urllib.request.Request(f'http://127.0.0.1:{server.server_port}/throttled',
                                                 headers={'Range': 'bytes=100-199'})
                try:
                    response = urllib.request.urlopen(request, timeout=10)
                except urllib.error.HTTPError as error:
                    response = error
                with response:
                    statuses.append(response.code)
                    body = response.read()
            self.assertEqual(statuses, [500, 503, 429, 206])
            self.assertEqual(body, module.DATA[100:200])
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=5)

    def test_runtime_file_cannot_be_added_to_test_manifest(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            file = root / fixes.MANIFEST
            file.parent.mkdir(parents=True)
            file.write_text(json.dumps({'ps5-react/runtime/js/native.js': {}}))
            with self.assertRaisesRegex(ValueError, 'unapproved source path'):
                fixes.metadata(root)

if __name__ == '__main__':
    unittest.main()
