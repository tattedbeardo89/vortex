"""Exercise pinned metadata against real shallow and complete Git histories."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from baseline import describe


class BaselineHistory(unittest.TestCase):
    def test_pinned_metadata_requires_history_and_reads_application_version(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source'
            source.mkdir()
            def git(*args, cwd=source):
                return subprocess.check_output(['git', *args], cwd=cwd, stderr=subprocess.PIPE).decode().strip()
            git('init', '-b', 'fixture')
            git('config', 'user.email', 'fixture@example.invalid')
            git('config', 'user.name', 'Fixture')
            files = {'app/version.js': 'export var VERSION = "1.0.8";\n',
                     'version.js': 'export var VERSION = "9.9.9";\n',
                     'app/data/catalog.js': 'export var CATALOG = [];\n',
                     'ps5-react/fixture.txt': 'framework\n'}
            for name, content in files.items():
                path = source / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content)
            git('add', '.')
            git('commit', '-m', 'pinned source')
            pinned = git('rev-parse', 'HEAD')
            expected = describe(pinned, root=source)
            (source / 'later.txt').write_text('newer build\n')
            git('add', '.')
            git('commit', '-m', 'later build')
            shallow = root / 'shallow'
            git('clone', '--depth=1', source.as_uri(), str(shallow))
            self.assertEqual(git('rev-parse', '--is-shallow-repository', cwd=shallow), 'true')
            with self.assertRaises(subprocess.CalledProcessError):
                describe(pinned, root=shallow)
            git('fetch', '--unshallow', 'origin', cwd=shallow)
            actual = describe(pinned, root=shallow)
            self.assertEqual(actual, expected)
            self.assertEqual(actual['sourceVersion'], '1.0.8')
            self.assertEqual(actual['catalog']['moduleSha256'], expected['catalog']['moduleSha256'])
