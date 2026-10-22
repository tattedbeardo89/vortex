#!/usr/bin/env python3
"""Vortex entrypoint; all native compilation remains in the upstream framework."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import subprocess
import signal
import time
import sys
from overlay import ROOT, OUTPUT, configuration, prepare
from web.integration.overlay import framework_overlay

def run(argv, cwd=ROOT):
    subprocess.run([str(a) for a in argv], cwd=cwd, check=True)

def input_stamp():
    entries = []
    for root in (ROOT / 'app', ROOT / 'custom/vortex'):
        for path in root.rglob('*'):
            if path.is_file() and not {'__pycache__', 'node_modules'}.intersection(path.parts):
                try:
                    stat = path.stat()
                    entries.append((str(path), stat.st_mtime_ns, stat.st_size))
                except FileNotFoundError:
                    pass  # Editors can replace a file between traversal and stat.
    return tuple(sorted(entries))

def watch_overlay(command):
    # Upstream watches the staged app/runtime; this parent refreshes staging when source/custom inputs change.
    process = subprocess.Popen([str(a) for a in command], cwd=framework_overlay(), start_new_session=True)
    stamp = input_stamp()
    try:
        while process.poll() is None:
            time.sleep(0.3)
            changed = input_stamp()
            if changed == stamp: continue
            time.sleep(0.25)
            stamp = input_stamp()
            try:
                lock_path = ROOT / '.vortex/framework/.build/build.lock'
                lock_path.parent.mkdir(exist_ok=True)
                with lock_path.open('w') as lock:
                    fcntl.flock(lock, fcntl.LOCK_EX)
                    prepare()
                print('Vortex overlay refreshed; preview watcher will rebuild.', flush=True)
            except (ValueError, subprocess.CalledProcessError) as error:
                print(f'Overlay rejected input changes: {error}. Review source contracts and save to retry.', flush=True)
        if process.returncode: raise subprocess.CalledProcessError(process.returncode, command)
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGINT)
            try: process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGTERM); process.wait(timeout=5)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'build', 'preview', 'dev'])
    parser.add_argument('--no-package', action='store_true')
    args = parser.parse_args()
    app = prepare()
    brand = configuration()
    if args.command == 'prepare': return
    framework = framework_overlay()
    if args.command in ('preview', 'dev'):
        os.environ.setdefault('CC', 'clang'); os.environ.setdefault('CXX', 'clang++')
        command = [sys.executable, 'tools/cli.py', 'preview', '--app-dir', app,
                   *(['--watch'] if args.command == 'dev' else [])]
        if args.command == 'dev': watch_overlay(command)
        else: run(command, framework)
        return
    candidates = [Path(os.environ['LLVM'])] if os.environ.get('LLVM') else [
        Path('/usr/lib/llvm-18/bin'), Path('/opt/homebrew/opt/llvm@18/bin'), Path('/usr/local/opt/llvm@18/bin')]
    llvm = next((p for p in candidates if (p / 'clang').is_file() and (p / 'llvm-config').is_file()), None)
    if llvm is None: raise RuntimeError('Install LLVM 18, including lld, and set LLVM to its bin directory')
    version = subprocess.check_output([str(llvm / 'llvm-config'), '--version'], text=True).strip()
    if not version.startswith('18.'): raise RuntimeError('The pinned PS5 toolchain requires LLVM 18')
    run([sys.executable, 'tools/build_ps5.py', '--app-dir', app, '--llvm', llvm], framework)
    run([sys.executable, ROOT / 'custom/vortex/validate.py', '--built'])
    if args.no_package: return
    output = ROOT / brand['artifact']
    run(['sudo', 'bash', ROOT / 'packaging/make-exfat.sh', ROOT / 'ps5-react/dist' / brand['titleId'], output, brand['volumeLabel']])
    run(['sudo', 'chown', f'{os.getuid()}:{os.getgid()}', output])
    run([sys.executable, ROOT / 'custom/vortex/package_update.py'])

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Vortex preview stopped.')
