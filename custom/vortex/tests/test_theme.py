import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest.mock import patch

CUSTOM=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(CUSTOM))
import overlay
import theme


def contrast(a,b):
    def luminance(color):
        channels=[int(color[i:i+2],16)/255 for i in (1,3,5)]
        linear=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in channels]
        return sum(c*w for c,w in zip(linear,(.2126,.7152,.0722)))
    high,low=sorted([luminance(a),luminance(b)],reverse=True)
    return (high+.05)/(low+.05)

class ThemeRegression(unittest.TestCase):
    def test_palette_text_and_focus_contrast(self):
        tokens=theme.theme_configuration()['tokens']
        for background in ['canvas','surface','surface2','surface3']:
            self.assertGreaterEqual(contrast(tokens['fg'],tokens[background]),4.5)
            self.assertGreaterEqual(contrast(tokens['focusStrong'],tokens[background]),3)
        for background in ['canvas','surface']:
            self.assertGreaterEqual(contrast(tokens['muted'],tokens[background]),4.5)
        for action in ['action','actionFocus']:
            self.assertGreaterEqual(contrast(tokens['onAction'],tokens[action]),4.5)

    def test_ui_source_changes_fail_closed(self):
        theme.verify_theme()
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'app/ui').mkdir(parents=True)
            (root/'app/ui/New.jsx').write_text('export const style={color:"#ffffff"};')
            with patch.object(theme,'ROOT',root):
                with self.assertRaisesRegex(ValueError,'source set changed'):theme.verify_theme()

    def test_no_unreviewed_color_is_silently_passed_through(self):
        with tempfile.TemporaryDirectory() as folder:
            stage=Path(folder);(stage/'ui').mkdir()
            (stage/'ui/New.jsx').write_text('export const style={color:"#123456"};')
            with self.assertRaisesRegex(ValueError,'Unreviewed UI color'):theme.apply_theme(stage)

    def test_ui_theme_preserves_component_structure_and_interactions(self):
        # Compare the full generated source after normalizing only permitted colors/branding.
        def normalize(text):
            text=re.sub(r'^import\s*\{\s*colors\s*\}\s*from[^\n]+\n','',text,flags=re.M)
            text=theme.COLOR.sub('COLOR',text)
            text=re.sub(r'colors\.[A-Za-z0-9_]+','COLOR',text)
            text=re.sub(r'Overdrive(?! CDN)','Vortex',text)
            text=text.replace('github.com/MyLuxy/overdrive','github.com/tattedbeardo89/vortex')
            text=text.replace('[overdrive]','[vortex]').replace('registerComponent("overdrive"','registerComponent("vortex"')
            text=text.replace("import { WebPanel, WebControl } from '../vortex-web/integration/WebPanel.jsx';\n",'')
            text=text.replace('      jsx(WebPanel, {}),\n','').replace('            jsx(WebControl, {}),\n','')
            text=text.replace('\nexport { featured as webFeatured };\n','').replace('\nexport { CHARTS as webCharts };\n','')
            return text
        for relative in json.loads((CUSTOM/'theme-contracts.json').read_text()):
            if relative=='ui/Splash.jsx':continue
            with self.subTest(file=relative):
                self.assertEqual(normalize((overlay.ROOT/'app'/relative).read_text()),normalize((overlay.OUTPUT/relative).read_text()))
        # Splash changes vector geometry only; all hooks/timing/animation callbacks stay upstream's.
        source=(overlay.ROOT/'app/ui/Splash.jsx').read_text()
        generated=(overlay.OUTPUT/'ui/Splash.jsx').read_text()
        strip_paths=lambda text:re.sub(r'd: "[^"]+"','d: "BRAND_PATH"',normalize(text))
        self.assertEqual(strip_paths(source),strip_paths(generated))

if __name__=='__main__':unittest.main()
