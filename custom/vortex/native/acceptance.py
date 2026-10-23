"""Real native controller and measured viewport acceptance, no screenshots or secrets in reports."""
import json
from pathlib import Path

REGISTRY=Path(__file__).with_name('navigation.js')

def run(control, records):
    # Read the production registry, not another hardcoded navigation order.
    import re
    rows=re.findall(r'id: "([a-z0-9]+)",\s*label: "([^"]+)"',REGISTRY.read_text())
    assert len(rows)==8
    ids=[row[0] for row in rows];labels=dict(rows)
    def wait():control('wait 500')
    def active(id):
        assert any(r.get('focusKey')=='nav:current' and r.get('text')==labels[id] and not r.get('inert') for r in records()), 'Incorrect active primary section: '+id
    def focus_visible():
        for _ in range(40):
            found=next((r for r in records() if r.get('focused') and not r.get('inert')),None)
            if found and found['width']>0 and found['height']>0 and found['x']>=32 and found['y']>=32 and found['x']+found['width']<=1888 and found['y']+found['height']<=1048:return found
            control('wait 100')
        raise AssertionError('Native focused control outside safe viewport: '+str({k:v for k,v in (found or {}).items() if k!='text'}))
    def open_section(id):
        row=next(r for r in records() if r.get('text')==labels[id] and not r.get('inert'))
        assert control('focus '+row['focusKey']).strip()=='ok'
        control('press confirm');wait();active(id)
    open_section('discover')
    for forward,button in [(True,'r1'),(False,'l1')]:
        current=0
        for _ in ids:
            control('press '+button);wait()
            current=(current+(1 if forward else -1))%len(ids)
            active(ids[current]);focus_visible()
    # Preserve the user's confirmed bottom-row entry. Use actual last first-column card.
    open_section('ps4')
    cards=[]
    for _ in range(30):
        cards=[r for r in records() if (r.get('focusKey') or '').startswith('card:') and not r.get('inert')]
        if cards:break
        control('wait 100')
    assert cards
    left=min(r['x'] for r in cards)
    card=max((r for r in cards if r['x']==left),key=lambda r:r['y'])
    control('focus '+card['focusKey']);wait();control('press left');wait()
    assert next(r for r in records() if r.get('focused'))['focusKey']=='nav:current'
    # Sidebar Down, then Cross, without teleporting directly to Downloads.
    for _ in range(len(ids)):
        row=next(r for r in records() if r.get('focused'))
        if row['text']=='Downloads':break
        control('press down');wait()
    assert row['text']=='Downloads'
    control('press confirm');wait();active('downloads')
    control('press r1');wait();active('settings')
    # All controller-reachable settings controls must be fully inside the viewport after reveal.
    control('focus web:toggle');wait()
    seen=set();last=None;measured=[]
    for _ in range(55):
        row=focus_visible()
        assert row['x']>=352, 'Settings focus escaped content viewport'
        measured.append({k:row[k] for k in ('x','y','width','height')})
        seen.add(row.get('focusKey') or row['text'])
        if row.get('focusKey')=='web:port-minus':
            for expected in ['web:port-plus','web:port-reset']:
                control('press right');wait();horizontal=focus_visible()
                assert horizontal.get('focusKey')==expected, 'Port row controller traversal failed'
                seen.add(expected);measured.append({k:horizontal[k] for k in ('x','y','width','height')})
            control('press left');control('press left');wait()
        if row.get('focusKey')=='web:artwork-check':
            control('press confirm');wait() # dynamic diagnostics resize the scroll content
        if row.get('focusKey')=='web:close':last=row;break
        control('press down');wait()
    assert last, 'Controller traversal cannot reach final Settings control'
    required={r['focusKey'] for r in records() if (r.get('focusKey') or '').startswith('web:') and not r.get('inert')}
    assert required <= seen, 'Controller skipped Settings controls: '+str(sorted(required-seen))
    control('press down');wait();assert focus_visible()['focusKey']=='web:close', 'Bottom scroll boundary escaped Settings'
    for _ in range(55):
        row=focus_visible()
        if row.get('focusKey')=='web:toggle':break
        control('press up');wait()
    assert row.get('focusKey')=='web:toggle', 'Controller cannot return to first Settings control'
    control('press up');wait();assert focus_visible()['focusKey']=='web:toggle'
    control('focus web:console-settings');wait();control('press confirm');wait()
    assert any((r.get('focusKey') or '').startswith('settings:') and r.get('focused') for r in records()), 'Original console settings modal did not receive focus'
    control('press r1');wait();active('settings')
    control('press back');wait()
    assert focus_visible()['focusKey']=='web:console-settings', 'Settings modal dismissal did not restore and reveal its origin'
    control('press l1');wait();active('downloads')
    # Settings is a section, not an invisible modal. Left enters its active sidebar row.
    open_section('settings');control('focus web:toggle');wait();control('press left');wait()
    assert next(r for r in records() if r.get('focused'))['focusKey']=='nav:current'
    control('press right');wait();focus_visible()
    control('press r1');wait();active('discover')
    # Genre and language modal ownership, and keyboard, must block section cycling.
    for key in ['nav:genres','nav:language']:
        control('focus '+key);control('press confirm');wait();control('press r1');wait();active('discover')
        control('press back');wait()
        assert next(r for r in records() if r.get('focused'))['focusKey']==key, 'Modal did not restore originating focus: '+key+' -> '+str(next((r.get('focusKey') for r in records() if r.get('focused')),None))
    control('focus nav:search');control('press confirm');wait()
    control('press r1');wait()
    assert any(r.get('focusKey')=='nav:current' and r.get('text')=='‹ Back to Vortex' for r in records())
    control('press back');wait()
    # App renders at a fixed 1920x1080 on PS5, then scales to the output. Validate BOTH
    # output projections of measured native bounds; this is not physical HDMI/overscan proof.
    output={}
    for width,height in [(1920,1080),(3840,2160)]:
        scale=width/1920
        assert all(r['x']*scale>=32*scale and r['y']*scale>=32*scale and (r['x']+r['width'])*scale<=width-32*scale and (r['y']+r['height'])*scale<=height-32*scale for r in measured)
        output[f'{width}x{height}']={'fixedRenderProjection':True,'physicalDisplayTested':False}
    return {'registryForwardAndReverseCycles':True,'bottomRowLeftSidebarDownDownloads':True,'settingsTraversalControls':len(seen),'settingsBoundsMeasured':True,'dynamicArtworkDiagnostics':True,'outputModes':output,'modalAndKeyboardIsolation':True,'hardwareTested':False}
