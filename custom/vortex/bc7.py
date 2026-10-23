"""Original deterministic BC7 mode-6 encoder for the flat, opaque Angular V backgrounds.

One RGBA subset, two 7-bit endpoints plus endpoint P bits, 4-bit interpolation
indices (3-bit anchor). No third-party artwork or binary encoder dependency.
"""
import struct

WEIGHTS=(0,4,9,13,17,21,26,30,34,38,43,47,51,55,60,64)
def block(data):
    colors=[tuple(data[i:i+4]) for i in range(0,64,4)]
    unique=list(dict.fromkeys(colors))
    a,b=max(((a,b) for a in unique for b in unique),key=lambda ab:sum((x-y)**2 for x,y in zip(*ab)))
    # Fixed odd P-bit preserves opaque alpha exactly; color error is at most one per endpoint.
    endpoints=[tuple(min(127,max(0,(v-1+1)//2)) for v in color) for color in (a,b)]
    expanded=[tuple((v<<1)|1 for v in color) for color in endpoints]
    palette=[tuple(((64-w)*a+w*b+32)>>6 for a,b in zip(*expanded)) for w in WEIGHTS]
    indices=[min(range(16),key=lambda i:sum((x-y)**2 for x,y in zip(color,palette[i]))) for color in colors]
    if indices[0]>=8:
        endpoints.reverse();indices=[15-i for i in indices]
    bits=1<<6;shift=7
    for channel in range(4):
        for endpoint in endpoints:
            bits|=endpoint[channel]<<shift;shift+=7
    bits|=3<<shift;shift+=2
    for i,value in enumerate(indices):
        bits|=value<<shift;shift+=3 if i==0 else 4
    assert shift==128
    return bits.to_bytes(16,'little')

def encode(image):
    assert image.mode=='RGBA' and image.width%4==0 and image.height%4==0
    data=image.tobytes();stride=image.width*4;cache={};chunks=[]
    for y in range(0,image.height,4):
        for x in range(0,stride,16):
            tile=b''.join(data[(y+i)*stride+x:(y+i)*stride+x+16] for i in range(4))
            if tile not in cache:cache[tile]=block(tile)
            chunks.append(cache[tile])
    payload=b''.join(chunks)
    header=[124,0x81007,image.height,image.width,len(payload),0,0]+[0]*11
    header += [32,4,int.from_bytes(b'DX10','little'),0,0,0,0,0]+[0x1000,0,0,0,0]
    return b'DDS '+struct.pack('<31I',*header)+struct.pack('<5I',98,3,0,1,1)+payload
