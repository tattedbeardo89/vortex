"""Deterministic platform artwork from the original protected SVG master. Generated files stay untracked."""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw
CUSTOM=Path(__file__).resolve().parent

def generate(stage):
    master=CUSTOM/'branding/angular-v.svg'
    svg=ET.fromstring(master.read_bytes())
    assert svg.attrib['viewBox']=='0 0 32 32'
    polygons=[(p.attrib['fill'],[tuple(map(int,pair.split(','))) for pair in p.attrib['points'].split()]) for p in svg]
    paths=[{'fill':fill,'d':'M'+'L'.join(f'{x} {y}' for x,y in points)+'Z'} for fill,points in polygons]
    def emblem(size):
        image=Image.new('RGBA',(size*4,size*4),(0,0,0,0));draw=ImageDraw.Draw(image)
        for fill,points in polygons:draw.polygon([(x*size/8,y*size/8) for x,y in points],fill=fill)
        return image.resize((size,size),Image.Resampling.LANCZOS)
    art=stage/'sce_sys';art.mkdir(exist_ok=True)
    emblem(512).save(art/'icon0.png',compress_level=9)
    for name in ['pic0.dds','pic1.dds']:
        background=Image.new('RGBA',(1920,1080),'#0f1020');logo=emblem(400)
        background.alpha_composite(logo,((1920-400)//2,(1080-400)//2));background.save(art/name)
    assets=stage/'vortex-web-assets';assets.mkdir(exist_ok=True)
    (assets/'favicon.svg').write_bytes(master.read_bytes())
    (stage/'ui/vortex-emblem.js').write_text('export const EMBLEM = '+json.dumps(paths)+';\n')
    manifest={'format':1,'masterSha256':hashlib.sha256(master.read_bytes()).hexdigest(),'files':{}}
    for name in ['icon0.png','pic0.dds','pic1.dds']:
        path=art/name
        with Image.open(path) as image: dimensions=list(image.size)
        manifest['files']['sce_sys/'+name]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'dimensions':dimensions}
    (stage/'VORTEX-BRANDING.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest
