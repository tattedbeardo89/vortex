#!/usr/bin/env python3
"""Replace reviewed UI color literals with semantic tokens; preserve layout and behavior."""
import hashlib
import json
import os
from pathlib import Path
import re

COLOR = re.compile(r'"(#[0-9a-fA-F]{3,8})"')
CUSTOM = Path(__file__).resolve().parent
ROOT = CUSTOM.parents[1]

def theme_configuration():
    return json.loads((CUSTOM/'theme.json').read_text())

def color_sources(root):
    return {str(p.relative_to(root)):p for p in root.rglob('*')
            if p.suffix in ('.js','.jsx') and 'data' not in p.relative_to(root).parts
            and p.name!='colors.js' and COLOR.search(p.read_text())}

def verify_theme():
    contracts=json.loads((CUSTOM/'theme-contracts.json').read_text())
    actual=color_sources(ROOT/'app')
    if set(actual)!=set(contracts):
        raise ValueError('UI color source set changed; review Vortex theme coverage before updating contracts')
    for name,path in actual.items():
        if hashlib.sha256(path.read_bytes()).hexdigest()!=contracts[name]:
            raise ValueError(f'UI theme source changed: {name}; review token compatibility')

def apply_theme(stage):
    theme=theme_configuration()
    mapping=theme['upstreamColors']
    tokens=theme['tokens']
    touched=[]
    for name,path in color_sources(stage).items():
        text=path.read_text()
        def replace(match):
            literal=match[1].lower()
            if literal not in mapping:
                raise ValueError(f'Unreviewed UI color {literal} in {name}')
            return 'colors.'+mapping[literal]
        text=COLOR.sub(replace,text)
        if name=='ui/Button.jsx':
            text=text.replace('primary: { backgroundColor: colors.fg }','primary: { backgroundColor: colors.action }')
            text=text.replace('primary: { backgroundColor: colors.focus }','primary: { backgroundColor: colors.actionFocus }')
            text=text.replace('primary: { fontFamily: "Inter-Regular", color: colors.accentFg }','primary: { fontFamily: "Inter-Regular", color: colors.onAction }')
            text=text.replace('variant === "primary" ? colors.accentFg','variant === "primary" ? colors.onAction')
        if name=='ui/FocusRing.jsx':
            for old,new in theme['focusOverrides'].items():
                text=text.replace('colors.'+old,'colors.'+new)
        if name=='ui/Toast.jsx':
            text=text.replace('failed ? { borderColor: colors.fgAlpha99 }','failed ? { borderColor: colors.error }')
        if not re.search(r'import\s*\{\s*colors\s*\}\s*from',text):
            relative=os.path.relpath(stage/'ui/colors.js',path.parent).replace(os.sep,'/')
            if not relative.startswith('.'):relative='./'+relative
            text=f"import {{ colors }} from '{relative}';\n"+text
        path.write_text(text)
        touched.append(name)
    (stage/'ui/colors.js').write_text('export const colors = Object.freeze('+json.dumps(tokens,indent=2)+');\n')
    return sorted(touched)
