"""Deterministic platform artwork from the original protected SVG master. Generated files stay untracked."""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, __version__ as pillow_version
from bc7 import encode
from functools import lru_cache
import io
CUSTOM=Path(__file__).resolve().parent

@lru_cache(maxsize=1)
def artwork(master_bytes):
    svg=ET.fromstring(master_bytes)
    assert svg.attrib['viewBox']=='0 0 32 32'
    polygons=[(p.attrib['fill'],[tuple(map(int,pair.split(','))) for pair in p.attrib['points'].split()]) for p in svg]
    paths=[{'fill':fill,'d':'M'+'L'.join(f'{x} {y}' for x,y in points)+'Z'} for fill,points in polygons]
    def emblem(size):
        image=Image.new('RGBA',(size*4,size*4),(0,0,0,0));draw=ImageDraw.Draw(image)
        for fill,points in polygons:draw.polygon([(x*size/8,y*size/8) for x,y in points],fill=fill)
        return image.resize((size,size),Image.Resampling.LANCZOS)
    icon=io.BytesIO();emblem(512).save(icon,format='PNG',compress_level=9)
    background=Image.new('RGBA',(3840,2160),'#0f1020');logo=emblem(800)
    background.alpha_composite(logo,((3840-800)//2,(2160-800)//2))
    return paths,icon.getvalue(),encode(background)

def generate(stage):
    master=CUSTOM/'branding/angular-v.svg'
    paths,icon,background=artwork(master.read_bytes())
    art=stage/'sce_sys';art.mkdir(exist_ok=True)
    (art/'icon0.png').write_bytes(icon)
    for name in ['pic0.dds','pic1.dds']:(art/name).write_bytes(background)
    assets=stage/'vortex-web-assets';assets.mkdir(exist_ok=True)
    (assets/'favicon.svg').write_bytes(master.read_bytes())
    (stage/'ui/vortex-emblem.js').write_text('export const EMBLEM = '+json.dumps(paths)+';\n')
    manifest={'format':1,'pillowVersion':pillow_version,'generators':{name:hashlib.sha256((CUSTOM/name).read_bytes()).hexdigest() for name in ['branding.py','bc7.py']},'masterSha256':hashlib.sha256(master.read_bytes()).hexdigest(),'files':{}}
    for name in ['icon0.png','pic0.dds','pic1.dds']:
        path=art/name
        with Image.open(path) as image: dimensions=list(image.size)
        manifest['files']['sce_sys/'+name]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'dimensions':dimensions}
    (stage/'VORTEX-BRANDING.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest
