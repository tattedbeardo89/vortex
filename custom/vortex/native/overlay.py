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
    for name in ['Sidebar.jsx','navigation.js']:shutil.copyfile(CUSTOM/'native'/name,dest/name)
    header=stage/'ui/Header.jsx';text=header.read_text()
    text="import { NativeSidebar } from '../vortex-native/Sidebar.jsx';\nimport { CONTENT, FULL } from '../vortex-native/navigation.js';\n"+text
    text=replace(text,'      children,\n','      jsx(View, {style: immersive || ["game","search","files"].includes(top.name) ? FULL : CONTENT, children}),\n')
    start=text.index('      /* @__PURE__ */ (0, jsx)(View, { style: immersive ?')
    end=text.index('\n    ] });',start)
    text=text[:start]+'''      jsx(NativeSidebar, {section, filters, on, down, top, immersive, onLanguage:()=>setChoosingLanguage(true),browsing,setBrowsing,onReturn:()=>nav.pop() || on.discover()})'''+text[end:]
    header.write_text(text)
    for name,replacements in LAYOUT.items():
        path=stage/name;text=path.read_text()
        for old,new in replacements:text=replace(text,old,new)
        path.write_text(text)
