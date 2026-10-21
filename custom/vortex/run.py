#!/usr/bin/env python3
"""Vortex entrypoint; all native compilation remains in the upstream framework."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
from overlay import ROOT, OUTPUT, configuration, prepare

def run(argv, cwd=ROOT):
    subprocess.run([str(a) for a in argv], cwd=cwd, check=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'build', 'preview', 'dev'])
    parser.add_argument('--no-package', action='store_true')
    args = parser.parse_args()
    app = prepare()
    brand = configuration()
    if args.command == 'prepare': return
    if args.command in ('preview', 'dev'):
        os.environ.setdefault('CC', 'clang'); os.environ.setdefault('CXX', 'clang++')
        run([sys.executable, 'tools/cli.py', 'preview', '--app-dir', app,
             *(['--watch'] if args.command == 'dev' else [])], ROOT / 'ps5-react')
        return
    candidates = [Path(os.environ['LLVM'])] if os.environ.get('LLVM') else [
        Path('/usr/lib/llvm-18/bin'), Path('/opt/homebrew/opt/llvm@18/bin'), Path('/usr/local/opt/llvm@18/bin')]
    llvm = next((p for p in candidates if (p / 'clang').is_file() and (p / 'llvm-config').is_file()), None)
    if llvm is None: raise RuntimeError('Install LLVM 18, including lld, and set LLVM to its bin directory')
    version = subprocess.check_output([str(llvm / 'llvm-config'), '--version'], text=True).strip()
    if not version.startswith('18.'): raise RuntimeError('The pinned PS5 toolchain requires LLVM 18')
    run([sys.executable, 'tools/build_ps5.py', '--app-dir', app, '--llvm', llvm], ROOT / 'ps5-react')
    run([sys.executable, ROOT / 'custom/vortex/validate.py', '--built'])
    if args.no_package: return
    output = ROOT / brand['artifact']
    run(['sudo', 'bash', ROOT / 'packaging/make-exfat.sh', ROOT / 'ps5-react/dist' / brand['titleId'], output, brand['volumeLabel']])
    run(['sudo', 'chown', f'{os.getuid()}:{os.getgid()}', output])
    run([sys.executable, ROOT / 'custom/vortex/package_update.py'])

if __name__ == '__main__':
    main()
