"""Generate non-secret, reproducible identity; CI may supply one fixed build timestamp."""
import hashlib,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def generate(stage,brand,baseline):
    git=lambda *a:subprocess.check_output(['git',*a],cwd=ROOT,text=True).strip()
    frontend=hashlib.sha256(b''.join(p.name.encode()+p.read_bytes() for p in sorted((stage/'vortex-web-assets').iterdir()) if p.is_file())).hexdigest()
    record={'format':1,'version':brand['version'],'commit':git('rev-parse','HEAD'),
            'buildDate':os.environ.get('VORTEX_BUILD_DATE',git('show','-s','--format=%cI','HEAD')),
            'dateBasis':'build timestamp' if os.environ.get('VORTEX_BUILD_DATE') else 'source commit timestamp (reproducible)',
            'upstream':{'version':baseline['sourceVersion'],'commit':baseline['commit']},
            'webFrontendId':frontend,'apiVersion':1,'pairingSchema':1,
            'brandingRevision':hashlib.sha256((ROOT/'custom/vortex/branding/angular-v.svg').read_bytes()).hexdigest(),
            'nativeShell':1,'storagePolicy':2,
            'artwork':json.loads((stage/'VORTEX-BRANDING.json').read_text())['files']}
    (stage/'vortex-build.js').write_text('export const BUILD = Object.freeze('+json.dumps(record)+');\n')
    (stage/'VORTEX-BUILD.json').write_text(json.dumps(record,indent=2)+'\n')
    assets=stage/'vortex-web-assets';path=assets/'index.html';text=path.read_text()
    text=text.replace('<head>', '<head>\n<meta name="vortex-build" content="'+frontend+'">')
    text=text.replace('src="/app.js"','src="/app.js?v='+frontend[:16]+'"').replace('href="/styles.css"','href="/styles.css?v='+frontend[:16]+'"')
    path.write_text(text)
    manifest=stage/'VORTEX-WEB.json';data=json.loads(manifest.read_text());data['assets']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in assets.iterdir() if p.is_file()};manifest.write_text(json.dumps(data,indent=2)+'\n')
    config=stage/'app.json';data=json.loads(config.read_text());data['resources'].append('VORTEX-BUILD.json');config.write_text(json.dumps(data,indent=2)+'\n')
    return record
