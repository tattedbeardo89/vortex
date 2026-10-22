#!/usr/bin/env python3
"""Merge upstream on a review branch; never reset, force-push, publish or auto-merge."""
import json
import os
from pathlib import Path
import subprocess
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
from baseline import describe, SOURCE_PATHS

BRANCH = 'integration/upstream'
UPSTREAM_URL = 'https://github.com/MyLuxy/overdrive.git'

def git(repo, *args, check=True):
    return subprocess.run(['git', *args], cwd=repo, text=True, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, check=check)

def integrate(repo, base='origin/main', upstream='upstream/main'):
    if (Path(repo)/'custom/vortex/upstream-baseline.json').exists():
        return integrate_snapshot(repo,base,upstream)
    if git(repo,'merge-base','--is-ancestor',upstream,base,check=False).returncode == 0:
        return {'state':'unchanged','tip':git(repo,'rev-parse',upstream).stdout.strip()}
    if git(repo,'status','--porcelain').stdout.strip(): raise RuntimeError('Sync requires a clean checkout')
    before=git(repo,'rev-parse','HEAD').stdout.strip()
    result={'state':'merged','tip':git(repo,'rev-parse',upstream).stdout.strip(),'conflicts':[]}
    for ref in (base,upstream):
        attempt=git(repo,'merge','--no-edit',ref,check=False)
        if attempt.returncode:
            result.update(state='conflict', conflicts=git(repo,'diff','--name-only','--diff-filter=U').stdout.splitlines(), detail=attempt.stdout[-5000:])
            # No side is chosen, and no partially merged file is committed.
            if git(repo,'rev-parse','--verify','MERGE_HEAD',check=False).returncode == 0:
                git(repo,'merge','--abort')
            return result
    protected=['custom/vortex','package.json','packaging/build.sh','.github/workflows','docs','ASSET_REPLACEMENT_GUIDE.md']
    changed=git(repo,'diff','--name-only',base,'HEAD','--',*protected).stdout.splitlines()
    if changed: result.update(state='review', protectedChanges=changed)
    return result

def integrate_snapshot(repo, base, upstream):
    """Propose a complete application/catalog snapshot; never mix revisions or update main."""
    repo=Path(repo)
    manifest=repo/'custom/vortex/upstream-baseline.json'
    tip=git(repo,'rev-parse',upstream).stdout.strip()
    if git(repo,'status','--porcelain').stdout.strip():raise RuntimeError('Sync requires a clean checkout')
    current=json.loads(manifest.read_text())
    if current['commit']==tip and git(repo,'merge-base','--is-ancestor',base,'HEAD',check=False).returncode==0:
        return {'state':'unchanged','tip':tip,'baseline':current}
    attempt=git(repo,'merge','--no-edit',base,check=False)
    if attempt.returncode:
        conflicts=git(repo,'diff','--name-only','--diff-filter=U').stdout.splitlines()
        if git(repo,'rev-parse','--verify','MERGE_HEAD',check=False).returncode==0:git(repo,'merge','--abort')
        return {'state':'conflict','tip':tip,'conflicts':conflicts,'detail':attempt.stdout[-5000:]}
    previous=json.loads(manifest.read_text())
    candidate=describe(tip,root=repo)
    # Restore the whole application, framework and upstream tools as one reviewed unit.
    # Keep Vortex workflows, packaging wrappers and diagnostics outside that source snapshot.
    git(repo,'restore','--source='+tip,'--staged','--worktree','--',*SOURCE_PATHS)
    manifest.write_text(json.dumps(candidate,indent=2)+'\n')
    from framework_test_overrides import apply as apply_test_overrides
    test_review = None
    try:
        apply_test_overrides(repo)
        git(repo,'add','--',*SOURCE_PATHS)
    except (ValueError, subprocess.CalledProcessError) as error:
        # Commit the intact candidate snapshot; baseline validation blocks an incompatible override.
        test_review = str(error)
    git(repo,'add','--','custom/vortex/upstream-baseline.json')
    if git(repo,'diff','--cached','--quiet',check=False).returncode:
        git(repo,'commit','-m','Propose upstream '+candidate['sourceVersion']+' source/catalog '+tip[:12])
    return {'state':'merged','tip':tip,'previousBaseline':previous,'baseline':candidate,'frameworkTestReview':test_review,
            'policy':'Review only; source and catalog advance together. Theme/contracts require compatibility checks.'}

def gh(repo,*args,check=True):
    return subprocess.run(['gh',*args],cwd=repo,text=True,capture_output=True,check=check)

def main():
    repo=Path(__file__).resolve().parents[2]
    brand=json.loads((repo/'custom/vortex/brand.json').read_text())
    if os.environ.get('GITHUB_REPOSITORY') != brand['repository']: raise RuntimeError('Run synchronization only in the configured Vortex repository')
    git(repo,'fetch','origin','main')
    if git(repo,'remote','get-url','upstream',check=False).returncode:
        git(repo,'remote','add','upstream',UPSTREAM_URL)
    if git(repo,'remote','get-url','upstream').stdout.strip()!=UPSTREAM_URL: raise RuntimeError('Unexpected upstream remote')
    git(repo,'fetch','upstream','main')
    selected=json.loads(git(repo,'show','origin/main:custom/vortex/upstream-baseline.json').stdout)
    if selected['commit']==git(repo,'rev-parse','upstream/main').stdout.strip():
        print('Upstream already integrated; no branch or PR changes'); return
    git(repo,'config','user.name','Vortex upstream sync')
    git(repo,'config','user.email','vortex-sync@users.noreply.github.com')
    remote=git(repo,'ls-remote','--heads','origin','refs/heads/'+BRANCH).stdout.strip()
    if remote:
        git(repo,'fetch','origin',BRANCH)
        git(repo,'checkout','-b',BRANCH,'FETCH_HEAD')
    else: git(repo,'checkout','-b',BRANCH,'origin/main')
    result=integrate(repo)
    if result['state'] != 'conflict':
        env=dict(os.environ)
        for key in ('GH_TOKEN','GITHUB_TOKEN'): env.pop(key,None)
        checks=[]
        for command in ([sys.executable,'custom/vortex/overlay.py','--check'],['npm','run','test:vortex'],['npm','run','test:app'],['npm','run','test:catalog'],['npm','run','test:web']):
            run=subprocess.run(command,cwd=repo,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
            checks.append({'command':command,'exit':run.returncode,'output':run.stdout[-5000:]})
        result['checks']=checks
        if any(c['exit'] for c in checks): result['state']='validation-failed'
    report=repo/'.github/upstream-sync/status.md'
    report.parent.mkdir(exist_ok=True)
    body='# Upstream integration review\n\n' + 'Upstream: MyLuxy/overdrive main. No releases are published by this workflow.\n\n```json\n'+json.dumps(result,indent=2)+'\n```\n'
    # Successful test durations/temp paths change each run: keep the previous report for the same tip/state.
    if report.exists():
        try:
            previous=json.loads(report.read_text().split('```json\n',1)[1].split('\n```',1)[0])
            if all(previous.get(k)==result.get(k) for k in ('tip','state','conflicts','protectedChanges')):
                body=report.read_text()
        except (ValueError,IndexError): pass
    report.write_text(body)
    git(repo,'add','--',str(report.relative_to(repo)))
    if git(repo,'diff','--cached','--quiet',check=False).returncode:
        git(repo,'commit','-m','chore: report upstream integration '+result['tip'][:12])
    git(repo,'push','origin','HEAD:refs/heads/'+BRANCH)  # normal fast-forward push only
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as output:
            output.write('branch='+BRANCH+'\nsha='+git(repo,'rev-parse','HEAD').stdout.strip()+'\n')
    existing=json.loads(gh(repo,'pr','list','--repo',brand['repository'],'--state','open','--head',BRANCH,'--base','main','--json','number').stdout)
    pr_body=repo/'.vortex/sync-pr.md';pr_body.parent.mkdir(exist_ok=True)
    pr_body.write_text('Integrates upstream Overdrive improvements while retaining the Vortex overlay.\n\nStatus: **'+result['state']+'**. Review `.github/upstream-sync/status.md` for conflicts, customized-file changes and validation results.\n\nResolve all failing checks and confirm Vortex identity before merging. This PR does not publish a release.\n')
    if existing:
        patch_body=repo/'.vortex/sync-pr-update.json'
        patch_body.write_text(json.dumps({'body':pr_body.read_text()}))
        gh(repo,'api','--method','PATCH',f"repos/{brand['repository']}/pulls/{existing[0]['number']}",'--input',str(patch_body))
    else:
        gh(repo,'pr','create','--repo',brand['repository'],'--base','main','--head',BRANCH,
           '--draft','--title','Integrate upstream Overdrive updates','--body-file',str(pr_body))
    if result['state'] not in ('merged','unchanged'): raise SystemExit('Upstream integration needs review: '+result['state'])

if __name__=='__main__': main()
