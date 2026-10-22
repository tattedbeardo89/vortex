"""Exact, reviewed integration hooks. Called only after the existing branding/theme overlay."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

CUSTOM=Path(__file__).resolve().parents[2]
ROOT=CUSTOM.parents[1]
WEB=CUSTOM/'web'
FRAMEWORK=ROOT/'.vortex/framework'

def verify():
    contracts=json.loads((WEB/'contracts.json').read_text())
    for name,sha in contracts.items():
        path=ROOT/name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=sha:
            raise ValueError(f'Vortex Web integration incompatible: {name}; review the native/state/UI adapter before refreshing its contract')
    required=['backend/server.hpp','backend/router.js','security/auth.js','frontend/index.html','frontend/app.js','frontend/styles.css','integration/WebPanel.jsx','integration/state-adapter.js','integration/native-adapter.js','integration/console-service.js','integration/native.js']
    for name in required:
        if not (WEB/name).is_file():raise ValueError('Vortex Web extension missing: '+name)

def replace_once(text,old,new,label):
    if text.count(old)!=1:raise ValueError('Vortex Web hook changed: '+label)
    return text.replace(old,new,1)

def app_overlay(stage,baseline):
    verify()
    for name in ['integration', 'security']:
        shutil.copytree(WEB/name, stage/'vortex-web'/name, ignore=shutil.ignore_patterns('__pycache__', '*.py'), dirs_exist_ok=True)
    (stage/'vortex-web/backend').mkdir(parents=True,exist_ok=True)
    shutil.copyfile(WEB/'backend/router.js',stage/'vortex-web/backend/router.js')
    assets=stage/'vortex-web-assets';assets.mkdir(exist_ok=True)
    theme=json.loads((CUSTOM/'theme.json').read_text())['tokens']
    css=':root{'+''.join(f'--{key}:{value};' for key,value in theme.items())+'}\n'
    for name in ['index.html','app.js','styles.css']:
        text=(WEB/'frontend'/name).read_text();(assets/name).write_text(css+text if name=='styles.css' else text)
    (stage/'vortex-baseline.js').write_text('export const BASELINE = '+json.dumps(baseline)+';\n')
    path=stage/'ui/Header.jsx';text=path.read_text()
    text="import { WebPanel, WebControl } from '../vortex-web/integration/WebPanel.jsx';\n"+text
    text=replace_once(text,'      children,\n','      children,\n      jsx(WebPanel, {}),\n','web lifecycle/settings panel')
    anchor='                focusKey: "nav:language",'
    start=text.rfind('            /* @__PURE__ */ (0, jsx)(',0,text.index(anchor))
    if start<0:raise ValueError('Vortex Web navigation hook changed')
    text=text[:start]+'            jsx(WebControl, {}),\n'+text[start:];path.write_text(text)
    path=stage/'state/store.jsx';text=path.read_text()
    text=replace_once(text,'      toggleWish: (id) =>','      webSetWish: (id, wished) => setWishlist((list) => {\n        const key = listedId(id);\n        const next = wished ? [...new Set([...list, key])] : list.filter(value => value !== key);\n        saveList("wishlist.json", "wishlist", next);\n        return next;\n      }),\n      toggleWish: (id) =>','idempotent shared favorites setter');path.write_text(text)
    for filename,export in [('browse/Spotlight.jsx','featured as webFeatured'),('browse/TopCharts.jsx','CHARTS as webCharts')]:
        with (stage/filename).open('a') as out:out.write('\nexport { '+export+' };\n')
    manifest={'format':1,'extensionAbi':1,'nativeSha256':hashlib.sha256((WEB/'backend/server.hpp').read_bytes()).hexdigest(),'contracts':json.loads((WEB/'contracts.json').read_text()),'assets':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in assets.iterdir() if p.is_file()}}
    (stage/'VORTEX-WEB.json').write_text(json.dumps(manifest,indent=2)+'\n')
    config=json.loads((stage/'app.json').read_text());config['resources'].extend(['vortex-web-assets','VORTEX-WEB.json']);(stage/'app.json').write_text(json.dumps(config,indent=2)+'\n')

def framework_overlay():
    verify();FRAMEWORK.mkdir(parents=True,exist_ok=True)
    if any(FRAMEWORK.iterdir()) and not (FRAMEWORK/'.vortex-framework.json').exists():raise ValueError('Refusing to overwrite unowned framework staging')
    files=subprocess.check_output(['git','ls-files','-z','ps5-react'],cwd=ROOT).decode().split('\0')
    for name in filter(None,files):
        source=ROOT/name;dest=FRAMEWORK/Path(name).relative_to('ps5-react')
        if source.is_file() and name!='ps5-react/native/shared/host_api.cpp':
            dest.parent.mkdir(parents=True,exist_ok=True)
            data=source.read_bytes()
            if not dest.exists() or dest.read_bytes()!=data:dest.write_bytes(data)
            shutil.copymode(source,dest)
    for name in ['.deps','.build','dist','node_modules','.venv']:
        target=ROOT/'ps5-react'/('.build/vortex-web-framework' if name=='.build' else name);target.mkdir(exist_ok=True,parents=True)
        link=FRAMEWORK/name
        if not link.exists():link.symlink_to(target,target_is_directory=True)
    previous=json.loads((FRAMEWORK/'.vortex-framework.json').read_text()) if (FRAMEWORK/'.vortex-framework.json').exists() else {}
    current=[str(Path(name).relative_to('ps5-react')) for name in filter(None,files) if (ROOT/name).is_file()]
    for name in set(previous.get('files',[]))-set(current):
        owned=FRAMEWORK/name
        if owned.is_file() and not owned.is_symlink():owned.unlink()
    source=FRAMEWORK/'native/shared/host_api.cpp';text=(ROOT/'ps5-react/native/shared/host_api.cpp').read_text()
    text=replace_once(text,'std::atomic<const char*> host::current_call', '#include "vortex_web.hpp"\n\nstd::atomic<const char*> host::current_call','native header')
    text=replace_once(text,'  JS_SetPropertyStr(ctx, global, "__ps5ReactNative", api);','  JS_SetPropertyStr(ctx, global, "__ps5ReactNative", api);\n  vortex_web::install(ctx, global);','native ABI installation')
    if not source.exists() or source.read_text()!=text:source.write_text(text)
    header=FRAMEWORK/'native/shared/vortex_web.hpp'
    if not header.exists() or header.read_bytes()!=(WEB/'backend/server.hpp').read_bytes():shutil.copyfile(WEB/'backend/server.hpp',header)
    report={'format':1,'files':current,'extensionAbi':1,'contracts':json.loads((WEB/'contracts.json').read_text()),'nativeSha256':hashlib.sha256((WEB/'backend/server.hpp').read_bytes()).hexdigest()}
    (FRAMEWORK/'.vortex-framework.json').write_text(json.dumps(report,indent=2)+'\n')
    return FRAMEWORK
