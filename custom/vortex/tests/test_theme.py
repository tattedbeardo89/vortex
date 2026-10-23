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
        from native.overlay import LAYOUT
        for relative in json.loads((CUSTOM/'theme-contracts.json').read_text()):
            if relative=='ui/Splash.jsx':continue
            with self.subTest(file=relative):
                source=(overlay.ROOT/'app'/relative).read_text()
                generated=(overlay.OUTPUT/relative).read_text()
                if relative=='ui/Header.jsx':
                    generated=generated.replace("import { useNativeNavigation } from '../vortex-native/controller.js';\n",'')
                    generated=generated.replace('    const nativeNav = useNativeNavigation({top, section, filters, on, nav});\n','')
                    generated=generated.replace('      if (browsing || choosingLanguage) return true;\n','')
                    original_shoulder=source[source.index('      // Right-to-left the sections run leftward'):source.index('      return true;',source.index('      // Right-to-left the sections run leftward'))]
                    start=generated.index('      // Fixed vertical sidebar order')
                    end=generated.index('      return true;',start)
                    self.assertIn('nativeNav.step(action === "r1");',generated[start:end])
                    generated=generated[:start]+original_shoulder+generated[end:]
                    generated=generated.replace("import { NativeSidebar } from '../vortex-native/Sidebar.jsx';\n",'').replace("import { CONTENT, FULL } from '../vortex-native/navigation.js';\n",'')
                    generated=generated.replace('jsx(View, {style: immersive || ["game","search","files"].includes(top.name) ? FULL : CONTENT, children: jsx(FocusScope, {inert:nativeNav.opened,children})}),','children,')
                    # Original event/lifecycle logic is retained byte-for-byte; native navigation
                    # presentation is intentionally replaced and exercised by controller regressions.
                    source=source.split('      /* @__PURE__ */ (0, jsx)(View, { style: immersive ?')[0]
                    generated=generated.split('      jsx(NativeSidebar,')[0]
                for old,new in LAYOUT.get(relative,[]):
                    source=source.replace(new,old);generated=generated.replace(new,old)
                self.assertEqual(normalize(source),normalize(generated))
        # Splash changes vector geometry only; all hooks/timing/animation callbacks stay upstream's.
        source=(overlay.ROOT/'app/ui/Splash.jsx').read_text()
        generated=(overlay.OUTPUT/'ui/Splash.jsx').read_text()
        def strip_paths(text):
            text=normalize(text).replace("import { EMBLEM } from './vortex-emblem.js';\n",'')
            # Only the two vector Path property bags and their pivot are branding geometry.
            text=re.sub(r'\(Path, \{[^}]*\}', '(Path, {BRAND_GEOMETRY}', text)
            text=re.sub(r'var HUB = \{ x: [0-9.]+, y: [0-9.]+ \}', 'var HUB = {BRAND_PIVOT}',text)
            return text
        self.assertEqual(strip_paths(source),strip_paths(generated))

if __name__=='__main__':unittest.main()
