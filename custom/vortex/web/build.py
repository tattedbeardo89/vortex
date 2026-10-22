#!/usr/bin/env python3
"""Validate/package Vortex Web text assets and report exact integration provenance."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
CUSTOM=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(CUSTOM))
from overlay import ROOT, prepare
from baseline import selected
from web.integration.overlay import verify

def main():
    verify();app=prepare()
    for path in (CUSTOM/'web').rglob('*'):
        if path.suffix in ('.js','.mjs') and 'node_modules' not in path.parts:
            subprocess.run(['node','--check',str(path)],check=True,capture_output=True)
    assets=app/'vortex-web-assets'
    report={'format':1,'extensionAbi':1,'upstream':selected(),'frontend':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in assets.iterdir() if p.is_file()},'nativeHeaderSha256':hashlib.sha256((CUSTOM/'web/backend/server.hpp').read_bytes()).hexdigest(),'transport':'in-process nonblocking HTTP; render-thread state bridge','remoteAccessDefault':False,'hardwareTested':False}
    (ROOT/'.vortex/web-frontend.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS: Vortex Web frontend syntax, theme assets and protected API/native contracts')
if __name__=='__main__':main()
