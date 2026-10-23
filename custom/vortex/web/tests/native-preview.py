#!/usr/bin/env python3
"""Drive real desktop QuickJS/native HTTP and shared state; never print credentials or generate images."""
import argparse
import http.client
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import time
ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT/'custom/vortex'))
from overlay import prepare
from web.integration.overlay import framework_overlay


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--running', action='store_true', help='Test the already-started isolated preview')
    parser.add_argument('--no-build', action='store_true', help='Use the existing compiled native preview and bundle')
    args = parser.parse_args()
    app = ROOT/'.vortex/vortex' if args.no_build else prepare()
    framework = ROOT/'.vortex/framework' if args.no_build else framework_overlay()
    process = None
    address = os.environ.get('PS5_DRIVE_SOCKET', '/tmp/vortex-web-preview.sock')
    env = {**os.environ, 'PS5_DRIVE_SOCKET': address, 'CC': 'clang', 'CXX': 'clang++'}
    drive = [sys.executable, 'tools/ps5_drive.py']

    def control(command):
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.settimeout(30)
            client.connect(address)
            client.sendall((command+'\n').encode())
            parts = []
            while data := client.recv(65536): parts.append(data)
        return b''.join(parts).decode()

    def records(): return json.loads(control('snapshot'))
    def select(label):
        found = next((row for row in records() if label in row.get('text', '')), None)
        assert found, 'Console Web control unavailable: '+label+'; Web entries: '+str([(r.get('focusKey'),r.get('text'),r.get('visible')) for r in records() if 'Web' in r.get('text','') and 'Pairing' not in r.get('text','')])
        if found.get('focusKey'):
            control('focus '+found['focusKey'])
            control('press confirm')
        else:
            control(f"click {round(found['x']+found['width']/2)} {round(found['y']+found['height']/2)}")
        control('wait 200')

    headers = {}
    def api(method, path, body=None):
        connection = http.client.HTTPConnection('127.0.0.1', 34189, timeout=20)
        try:
            connection.request(method, path, json.dumps(body) if body is not None else None,
                               {'Origin':'http://127.0.0.1:34189','Content-Type':'application/json',**headers})
            result = connection.getresponse()
            text = result.read().decode()
            return result.status, text, result.getheader('Set-Cookie')
        finally: connection.close()

    try:
        if args.no_build:
            directory = framework/'.build/vortex/desktop'
            with open(address+'.log','w') as log:
                process = subprocess.Popen([str(directory/'ps5-react-preview'),str(framework/'.build/vortex/generated/1920x1080/app.bundle.js')], cwd=directory, env={**env,'PS5_REACT_CONTROL':address,'PS5_REACT_SANDBOX':str(framework/'.build/vortex/sandbox')},stdout=log,stderr=subprocess.STDOUT)
            for _ in range(300):
                if process.poll() is not None: raise RuntimeError('Native preview exited; inspect its local log')
                try:
                    control('wait 0');break
                except OSError: time.sleep(0.1)
        elif not args.running:
            subprocess.run([*drive, 'start', '--app-dir', str(app)], cwd=framework, env=env, check=True)
        control('wait 6000')
        # Real controller/focus layout probe; no raster screenshots or browser embedding.
        labels=['Discover','All Games','PlayStation 5','PlayStation 4','Homebrew','Favorites','Downloads','Settings & Devices']
        for label in labels:
            row=next((r for r in records() if r.get('text')==label and r.get('visible')),None)
            assert row and 32 <= row['x'] < 320 and row['x']+row['width'] <= 320, 'Sidebar layout/focus item missing: '+label
        assert control('focus nav:ps4').strip()=='ok'
        control('press confirm');control('wait 400')
        assert any(r.get('focusKey')=='nav:current' and r.get('text')=='PlayStation 4' for r in records())
        cards=[r for r in records() if (r.get('focusKey') or '').startswith('card:') and r.get('visible')]
        assert cards and all(r['x']>=320 and r['x']+r['width']<=1888 for r in cards), 'Native catalog overlaps sidebar or television safe area'
        control('focus '+cards[0]['focusKey']);control('press left');control('wait 100')
        assert any(r.get('focusKey')=='nav:current' and r.get('focused') for r in records()), 'First-column Left did not reach sidebar'
        control('press r1');control('wait 200')
        assert any(r.get('focusKey')=='nav:current' and r.get('text')=='Top rated' for r in records()), 'Shoulder navigation was not preserved'
        control('focus nav:discover');control('press confirm');control('wait 300')
        # Search and detail screens retain full-width native keyboard/media layouts and Circle back.
        control('focus nav:search');control('press confirm');control('wait 300')
        control('press back');control('wait 300')
        assert control('focus nav:downloads').strip()=='ok'
        control('press confirm');control('wait 200');control('press back');control('wait 200')
        focused = control('focus nav:vortex-web').strip()
        assert focused == 'ok', 'Web navigation focus failed: '+focused
        control('press confirm')
        control('wait 200')
        if any('Disable Vortex Web' in row.get('text', '') for row in records()): select('Disable Vortex Web')
        select('Enable Vortex Web')
        code_row = next((row for row in records() if row.get('focusKey') == 'web:pair-code'), None)
        assert code_row, 'Native listener failed to produce a console pairing code'
        code = re.search(r'Pairing code: ([A-F0-9]{8})', code_row['text']).group(1)
        status, html, _ = api('GET', '/')
        assert status == 200 and 'Vortex' in html
        assert api('GET','/api/v1/catalog')[0] == 401
        status, text, cookie = api('POST','/api/v1/auth/pair',{'code':code,'name':'Native desktop regression'})
        assert status == 200 and cookie, 'Pairing failed in the native runtime'
        headers.update({'Cookie':cookie.split(';')[0], 'X-Vortex-CSRF':json.loads(text)['csrf']})
        status, text, _ = api('GET','/api/v1/status')
        info = json.loads(text)
        assert status == 200 and info['development'] is False
        status, text, _ = api('GET','/api/v1/catalog?platform=ps4&limit=1')
        catalog = json.loads(text)
        assert status == 200 and catalog['total'] == info['counts']['ps4']
        game = catalog['items'][0]['id']
        before = json.loads(api('GET','/api/v1/favorites')[1])
        wished = any(row['id'] == game for row in before['items'])
        assert api('POST','/api/v1/favorites',{'id':game,'wished':not wished})[0] == 200
        control('wait 200')
        after = json.loads(api('GET','/api/v1/favorites')[1])
        assert any(row['id'] == game for row in after['items']) is (not wished)
        assert api('POST','/api/v1/favorites',{'id':game,'wished':wished})[0] == 200
        status, text, _ = api('GET','/api/v1/downloads')
        assert status == 200 and json.loads(text)['development'] is False
        assert api('POST','/api/v1/downloads',{'gameId':game,'releaseId':'invalid','storageId':'invalid'})[0] == 400
        status,text,_=api('GET','/api/v1/diagnostics')
        diagnostic=json.loads(text)
        assert status==200 and diagnostic['build']['pairingSchema']==1 and diagnostic['build']['nativeShell']==1
        assert diagnostic['storage']['writable'] and 'devices' not in diagnostic and 'verifier' not in text
        assert api('POST','/api/v1/diagnostics/storage',{})[0]==200
        # Restart the actual native process, keeping its sandbox. This simulates a reboot's
        # process loss and storage reconstruction, not a physical PS5 power-loss guarantee.
        if not args.running and not args.no_build:
            subprocess.run([*drive,'stop'],cwd=framework,env=env,check=True,stdout=subprocess.DEVNULL)
            subprocess.run([*drive,'start','--app-dir',str(app)],cwd=framework,env=env,check=True,stdout=subprocess.DEVNULL)
            control('wait 6000')
            assert api('GET','/api/v1/auth/session')[0]==200, 'Browser authorization lost across native process restart'
            control('focus nav:vortex-web');control('press confirm');control('wait 200')
        assert api('GET','/favicon.svg')[1] == (ROOT/'custom/vortex/branding/angular-v.svg').read_text()
        select('Disable Vortex Web')
        select('Enable Vortex Web')
        assert api('GET','/api/v1/auth/session')[0] == 200, 'Pairing did not survive native listener restart'
        assert api('POST','/api/v1/auth/logout',{})[0] == 200
        assert api('GET','/api/v1/status')[0] == 401
        select('Disable Vortex Web')
        try:
            api('GET','/')
        except OSError:
            pass
        else:
            raise AssertionError('Native listener remained reachable after disabling')
        report = {'transport':'actual desktop native listener and QuickJS application', 'hardwareTested':False,
                  'counts':info['counts'],'development':False,'sharedFavorites':True,'actualQueueRead':True,
                  'transfersTested':False,'pairingRevocationAndShutdown':True,'persistentPairingAcrossListenerRestart':True,'angularVPackaged':True,'nativeSidebarControllerAndSafeArea':True,'persistentPairingAcrossNativeProcessRestart':not args.running and not args.no_build,'durableStorageProbe':True,'buildMetadataConsistent':True}
        (ROOT/'.vortex/web-native-preview.json').write_text(json.dumps(report,indent=2)+'\n')
        print('PASS: actual native/QuickJS static assets, pairing, catalog, shared favorites, queue read, rejection, logout and shutdown')
    finally:
        if process is not None:
            process.terminate()
            try: process.wait(timeout=5)
            except subprocess.TimeoutExpired: process.kill();process.wait(timeout=5)
        elif not args.running:
            subprocess.run([*drive,'stop'],cwd=framework,env=env,check=False,stdout=subprocess.DEVNULL)

if __name__ == '__main__': main()
