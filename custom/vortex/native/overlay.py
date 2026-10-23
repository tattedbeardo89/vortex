"""Reviewed native shell: change layout/navigation presentation, retain original screens/actions."""
import hashlib,json,shutil
from pathlib import Path
CUSTOM=Path(__file__).resolve().parents[1];ROOT=CUSTOM.parents[1]
# Every native integration source remains protected by exact upstream digests.
def verify():
    for name,expected in json.loads((CUSTOM/'native/contracts.json').read_text()).items():
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=expected:
            raise ValueError('Vortex native shell incompatible: '+name)

def replace(text,old,new):
    if old not in text:raise ValueError('Native shell hook changed: '+old[:70])
    return text.replace(old,new)

# Deliberate geometry only; no data/provider/queue logic changes.
LAYOUT={
 'browse/Catalog.jsx':[('var COLUMNS = 6;','var COLUMNS = 5;'),('var CARD_WIDTH = 182;','var CARD_WIDTH = 176;'),('var CARD_HEIGHT = 243 + DETAILED_CAPTION;','var CARD_HEIGHT = Math.round(CARD_WIDTH * 4 / 3) + DETAILED_CAPTION;')],
 'homebrew/HomebrewScreen.jsx':[('var COLUMNS = 6;','var COLUMNS = 5;'),('var CARD_WIDTH = 182;','var CARD_WIDTH = 176;'),('var CARD_HEIGHT = 243 + DETAILED_CAPTION;','var CARD_HEIGHT = Math.round(CARD_WIDTH * 4 / 3) + DETAILED_CAPTION;'),('width: 1400','width: 1320')],
 'browse/Spotlight.jsx':[('width: 1410','width: 1050')],
 'downloads/DownloadsScreen.jsx':[('width: 1356','width: 1020'),('width: 420','width: 300')],
 'ui/GameCard.jsx':[('rowStart ? focusKey : void 0','rowStart ? "nav:current" : void 0')],
}

def apply(stage):
    verify()
    dest=stage/'vortex-native';dest.mkdir(exist_ok=True)
    for name in ['Sidebar.jsx','navigation.js','controller.js']:shutil.copyfile(CUSTOM/'native'/name,dest/name)
    header=stage/'ui/Header.jsx';text=header.read_text()
    text="import { NativeSidebar } from '../vortex-native/Sidebar.jsx';\nimport { CONTENT, FULL } from '../vortex-native/navigation.js';\n"+text
    text="import { useNativeNavigation } from '../vortex-native/controller.js';\n"+text
    text=replace(text,'    const toastAction =', '    const nativeNav = useNativeNavigation({top, section, filters, on, nav});\n    const toastAction =')
    start=text.index('      // Right-to-left the sections run leftward')
    end=text.index('      return true;',start)
    text=text[:start]+'''      // Fixed vertical sidebar order, independent of text direction. Modals own their input.
      if (immersive || choosingLanguage || browsing || (!nativeNav.opened && ["search", "game", "files"].includes(top.name))) return false;
      nativeNav.step(action === "r1");
'''+text[end:]
    text=replace(text,'      children,\n','      jsx(View, {style: immersive || ["game","search","files"].includes(top.name) ? FULL : CONTENT, children: jsx(FocusScope, {inert:nativeNav.opened,children})}),\n')
    start=text.index('      /* @__PURE__ */ (0, jsx)(View, { style: immersive ?')
    end=text.index('\n    ] });',start)
    text=text[:start]+'''      jsx(NativeSidebar, {section, filters, on, down: nativeNav.down, current: nativeNav.current, activate: nativeNav.activate, top, immersive, onLanguage:()=>setChoosingLanguage(true),browsing,setBrowsing,onReturn:()=>nav.pop() || on.discover()})'''+text[end:]
    header.write_text(text)
    for name,replacements in LAYOUT.items():
        path=stage/name;text=path.read_text()
        for old,new in replacements:text=replace(text,old,new)
        path.write_text(text)
