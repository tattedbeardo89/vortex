import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from branding import generate,CUSTOM,artwork

class AngularV(unittest.TestCase):
    def test_master_drives_deterministic_transparent_icon_native_paths_and_favicon(self):
        with tempfile.TemporaryDirectory() as folder:
            stage=Path(folder);(stage/'ui').mkdir()
            first=generate(stage)
            artwork.cache_clear()  # Independently encode again; do not merely compare cached output.
            self.assertEqual(first,generate(stage))
            self.assertEqual(first['masterSha256'],hashlib.sha256((CUSTOM/'branding/angular-v.svg').read_bytes()).hexdigest())
            self.assertEqual((stage/'vortex-web-assets/favicon.svg').read_bytes(),(CUSTOM/'branding/angular-v.svg').read_bytes())
            with Image.open(stage/'sce_sys/icon0.png') as icon:
                self.assertEqual(icon.size,(512,512));self.assertEqual(icon.getpixel((0,0))[3],0)
                self.assertGreater(sum(1 for p in icon.get_flattened_data() if p[3]>128),30000)
            for name in ['pic0.dds','pic1.dds']:
                with Image.open(stage/'sce_sys'/name) as image:
                    self.assertEqual(image.size,(3840,2160));self.assertEqual(image.getpixel((0,0)),(15,17,33,255))
                data=(stage/'sce_sys'/name).read_bytes()
                self.assertEqual(data[84:88],b'DX10');self.assertEqual(int.from_bytes(data[128:132],'little'),98)
            paths=(stage/'ui/vortex-emblem.js').read_text()
            self.assertIn('#6366f1',paths);self.assertIn('#a78bfa',paths)
            self.assertNotIn('YOUR CONSOLE, CONNECTED',(CUSTOM/'web/frontend/index.html').read_text())

    def test_bc7_mode6_decodes_with_independent_platform_decoder(self):
        from io import BytesIO
        from bc7 import encode
        values=[16,255,0]+list(range(0,256,21))[:13]
        source=Image.new('RGBA',(4,4));source.putdata([(v,v,v,255) for v in values])
        decoded=Image.open(BytesIO(encode(source)))
        self.assertLessEqual(max(abs(a-b) for p,q in zip(source.get_flattened_data(),decoded.get_flattened_data()) for a,b in zip(p,q)),10)
