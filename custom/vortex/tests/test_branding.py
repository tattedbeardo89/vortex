import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from branding import generate,CUSTOM

class AngularV(unittest.TestCase):
    def test_master_drives_deterministic_transparent_icon_native_paths_and_favicon(self):
        with tempfile.TemporaryDirectory() as folder:
            stage=Path(folder);(stage/'ui').mkdir()
            first=generate(stage)
            self.assertEqual(first,generate(stage))
            self.assertEqual(first['masterSha256'],hashlib.sha256((CUSTOM/'branding/angular-v.svg').read_bytes()).hexdigest())
            self.assertEqual((stage/'vortex-web-assets/favicon.svg').read_bytes(),(CUSTOM/'branding/angular-v.svg').read_bytes())
            with Image.open(stage/'sce_sys/icon0.png') as icon:
                self.assertEqual(icon.size,(512,512));self.assertEqual(icon.getpixel((0,0))[3],0)
                self.assertGreater(sum(1 for p in icon.getdata() if p[3]>128),30000)
            for name in ['pic0.dds','pic1.dds']:
                with Image.open(stage/'sce_sys'/name) as image:self.assertEqual(image.size,(1920,1080))
            paths=(stage/'ui/vortex-emblem.js').read_text()
            self.assertIn('#6366f1',paths);self.assertIn('#a78bfa',paths)
            self.assertNotIn('YOUR CONSOLE, CONNECTED',(CUSTOM/'web/frontend/index.html').read_text())
