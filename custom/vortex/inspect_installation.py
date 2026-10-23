#!/usr/bin/env python3
"""Read-only audit of static files exported from a title mount and registered appmeta. Never reads pairing records."""
import argparse,hashlib,json
from pathlib import Path

def audit(reference,mounted,registered=None,staged=None):
    manifest=json.loads((reference/'VORTEX-BRANDING.json').read_text())
    expected=json.loads((reference/'VORTEX-BUILD.json').read_text())
    actual=json.loads((mounted/'VORTEX-BUILD.json').read_text()) if (mounted/'VORTEX-BUILD.json').is_file() else None
    result={'expectedBuild':expected,'mountedBuild':actual,'buildMatches':bool(actual and actual['commit']==expected['commit']),'hardwareVerifiedByThisTool':False,'artwork':{}}
    for name,record in manifest['files'].items():
        source=mounted/name;target=registered/Path(name).name if registered else None
        sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest() if p and p.is_file() else None
        result['artwork'][name]={'expected':record['sha256'],'mounted':sha(source),'registered':sha(target),'mountedMatches':sha(source)==record['sha256'],'registeredMatches':sha(target)==record['sha256'] if registered else None}
    def identity(path):
        try:
            info=json.loads(path.read_text())
            return info.get('titleId')=='PPSA99189' and info.get('contentId')=='UP9000-PPSA99189_00-VORTEXPS50000000'
        except (OSError,ValueError):return False
    result['mountedIdentityMatches']=identity(mounted/'sce_sys/param.json')
    result['registeredIdentityMatches']=identity(registered/'param.json') if registered else None
    result['stagedIdentityMatches']=identity(staged/'sce_sys/param.json') if staged else None
    result['stagedArtwork']={}
    if staged:
        for name,record in manifest['files'].items():
            paths=[name]+(['icon0.png'] if name=='sce_sys/icon0.png' else [])
            for path in paths:
                actual=sha(staged/path)
                result['stagedArtwork'][path]={'expected':record['sha256'],'actual':actual,'matches':actual==record['sha256']}
    return result
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--reference',type=Path,required=True);parser.add_argument('--mounted',type=Path,required=True);parser.add_argument('--registered',type=Path);parser.add_argument('--staged',type=Path);args=parser.parse_args();print(json.dumps(audit(args.reference,args.mounted,args.registered,args.staged),indent=2))
