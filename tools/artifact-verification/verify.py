"""Independently read the hosted exFAT without mounting or modifying it."""
import hashlib, io, json, struct, sys, zipfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
ART=Path(sys.argv[1]); RUN=sys.argv[2]; SOURCE=sys.argv[3]
receipt_path=next(ART.rglob('PPSA99189.receipt.json'))
receipt=json.loads(receipt_path.read_text())
image=ART/'Vortex.exfat'; stream=image.open('rb'); header=stream.read(512)
assert header[3:11]==b'EXFAT   '
u32=lambda b,o:struct.unpack_from('<I',b,o)[0]
u64=lambda b,o:struct.unpack_from('<Q',b,o)[0]
sector=1<<header[108]; cluster=sector*(1<<header[109]); fat=u32(header,80)*sector; heap=u32(header,88)*sector; root=u32(header,96)
def read_at(offset,size):
    stream.seek(offset); data=stream.read(size); assert len(data)==size; return data
def cluster_at(n):
    assert n>=2; return heap+(n-2)*cluster
def read_chain(first,length=None,contiguous=False):
    if length==0:return b''
    if contiguous:return read_at(cluster_at(first),length)
    chunks=[]; seen=set(); number=first
    while number<0xfffffff8:
        assert number>=2 and number not in seen
        seen.add(number); chunks.append(read_at(cluster_at(number),cluster))
        if length is not None and len(chunks)*cluster>=length:break
        number=u32(read_at(fat+number*4,4),0)
    data=b''.join(chunks);return data if length is None else data[:length]
files={}
def walk(directory,prefix=''):
    offset=0
    while offset+32<=len(directory):
        entry=directory[offset:offset+32]
        if entry[0]==0:break
        if entry[0]!=0x85:offset+=32;continue
        count=entry[1]; secondary=[directory[offset+i*32:offset+(i+1)*32] for i in range(1,count+1)]
        ext=next(x for x in secondary if x[0]==0xc0)
        name=b''.join(x[2:32] for x in secondary if x[0]==0xc1).decode('utf-16-le')[:ext[3]]
        first=u32(ext,20);size=u64(ext,24);contiguous=bool(ext[1]&2);path=prefix+name
        if struct.unpack_from('<H',entry,4)[0]&0x10:walk(read_chain(first,size,contiguous),path+'/')
        else:
            assert path not in files; files[path]=(first,size,contiguous)
        offset+=(count+1)*32
walk(read_chain(root))
def read_file(name):return read_chain(*files[name])
sha=lambda data:hashlib.sha256(data).hexdigest()
file_sha=lambda p:hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
assert set(files)==set(receipt['files']), (set(files)-set(receipt['files']),set(receipt['files'])-set(files))
for name,expected in receipt['files'].items():assert sha(read_file(name))==expected,name
baseline=json.loads(read_file('VORTEX-BASELINE.json'))
assert baseline==json.loads((ROOT/'custom/vortex/upstream-baseline.json').read_text())
param=json.loads(read_file('sce_sys/param.json'));config=receipt['config']
for key in ['titleId','contentId']:assert param[key]==config[key]
assert param['contentVersion']==config['version']=='01.002.000'
assert param['localizedParameters']['en-US']['titleName']=='Vortex'
assert not any(Path(n).name=='web-devices.json' for n in files)
assert b'__vortexWebNative' in read_file('eboot.bin')
assert receipt['sources']['native/shared/vortex_web.hpp']==file_sha(ROOT/'custom/vortex/web/backend/server.hpp')
stage=ROOT/'.vortex/vortex';expected={}
for entry in config['resources']:
    if entry!='data' and not entry.startswith('data/'):continue
    source=stage/entry
    for p in (source.rglob('*') if source.is_dir() else [source]):
        if p.is_file():expected[str(p.relative_to(stage))]=file_sha(p)
actual={name:sha(read_file(name)) for name in files if name.startswith('data/')}
assert actual==expected
branding=json.loads(read_file('VORTEX-BRANDING.json'))
assert branding==json.loads((stage/'VORTEX-BRANDING.json').read_text())
assert branding['masterSha256']==file_sha(ROOT/'custom/vortex/branding/angular-v.svg')
for name,checksum in branding['generators'].items():assert checksum==file_sha(ROOT/'custom/vortex'/name)
for name,record in branding['files'].items():
    data=read_file(name);assert sha(data)==record['sha256']
    with Image.open(io.BytesIO(data)) as artwork:assert list(artwork.size)==record['dimensions']
    if name.endswith('.dds'):assert data[84:88]==b'DX10' and u32(data,128)==98
web=json.loads(read_file('VORTEX-WEB.json'))
assert web==json.loads((stage/'VORTEX-WEB.json').read_text())
for name,checksum in web['assets'].items():assert sha(read_file('vortex-web-assets/'+name))==checksum
assert read_file('vortex-web-assets/favicon.svg')==(ROOT/'custom/vortex/branding/angular-v.svg').read_bytes()
assert read_file('VORTEX-NOTICE.txt')==(ROOT/'custom/vortex/NOTICE.txt').read_bytes()
image_sha=file_sha(image)
with zipfile.ZipFile(ART/'update.zip') as package:
    assert sorted(package.namelist())==['Vortex.exfat','vortex-update.json']
    assert package.testzip() is None
    manifest=json.loads(package.read('vortex-update.json'))
    assert manifest==json.loads((ART/'vortex-update.json').read_text())
    assert manifest['upstream']==baseline
    assert manifest['titleId']==param['titleId'] and manifest['contentId']==param['contentId']
    assert manifest['version']=='1.2.0' and manifest['size']==image.stat().st_size
    with package.open('Vortex.exfat') as nested:assert hashlib.file_digest(nested,'sha256').hexdigest()==image_sha
report={'format':1,'sourceCommit':SOURCE,'run':f'https://github.com/tattedbeardo89/vortex/actions/runs/{RUN}',
'image':{'name':image.name,'bytes':image.stat().st_size,'sha256':image_sha},'update':{'name':'update.zip','bytes':(ART/'update.zip').stat().st_size,'sha256':file_sha(ART/'update.zip')},
'receiptFilesVerifiedInsideExfat':len(files),'catalogResourcesVerified':len(actual),'branding':branding,'identity':param['titleId'],'contentVersion':param['contentVersion'],
'webAssetsVerified':len(web['assets']),'nativeWebAbiPresent':True,'pairingDataAbsentFromPackage':True,'zipCrcAndImageEquality':True,'hardwareTested':False}
output=ART/'independent-verification.json';output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
summary={k:v for k,v in report.items() if k!='branding'}
print('::notice title=Independent artifact verification::'+json.dumps(summary,separators=(',',':')))
