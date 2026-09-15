#!/usr/bin/env python3
"""Extract local DOS PAL assets; requires Python + Pillow + a C compiler.

MKF / RLE format: https://github.com/sdlpal/sdlpal/blob/master/palcommon.c
YJ decoder: scripts/vendor/yj1.c (SDLPAL, GPL-3.0, offline helper only).
Game artwork remains the property of its original copyright holders.
No executable in pal/ is run. Original files are read without modification.
"""
import ctypes
import argparse
import json
from pathlib import Path
import struct
import subprocess
import tempfile
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/themes/pal'

def chunks(name):
    data = (ROOT / 'pal' / (name + '.MKF')).read_bytes()
    count = struct.unpack_from('<I', data)[0] // 4
    offsets = struct.unpack_from('<' + 'I' * count, data)
    return [data[a:b] for a, b in zip(offsets, offsets[1:])]

def rle(data, palette):
    if data[:4] == b'\x02\0\0\0':
        data = data[4:]
    w, h = struct.unpack_from('<HH', data)
    if not 0 < w <= 640 or not 0 < h <= 400:
        raise ValueError('Invalid RLE dimensions')
    pixels = bytearray(w * h * 4)
    cursor, offset = 0, 4
    while cursor < w * h:
        count = data[offset]
        offset += 1
        if count & 128 and count <= 128 + w:
            cursor += count - 128
        else:
            for index in data[offset:offset + count]:
                if cursor >= w * h:
                    break
                pixels[cursor*4:cursor*4+4] = bytes((*palette[index*3:index*3+3], 255))
                cursor += 1
            offset += count
    return Image.frombytes('RGBA', (w, h), bytes(pixels))

def contact(images, filename, cell=(160, 130), cols=8):
    canvas = Image.new('RGB', (cols*cell[0], ((len(images)+cols-1)//cols)*cell[1]), '#34454b')
    draw = ImageDraw.Draw(canvas)
    for i, (label, im) in enumerate(images):
        x, y = i % cols * cell[0], i // cols * cell[1]
        im = im.copy()
        im.thumbnail((cell[0]-8, cell[1]-22), Image.Resampling.NEAREST)
        canvas.paste(im, (x+(cell[0]-im.width)//2, y+16), im if im.mode=='RGBA' else None)
        draw.text((x+4, y+2), str(label), fill='white')
    canvas.save(filename)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--walking-only', action='store_true', help='Extract only the overworld hero')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    review = ROOT / 'artifacts/pal-extraction'
    review.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pal-decoder-') as temporary:
        library = Path(temporary) / 'yj1.so'
        subprocess.run(['cc', '-shared', '-fPIC', '-O2', str(ROOT/'scripts/vendor/yj1.c'), '-o', str(library)], check=True)
        decoder = ctypes.CDLL(str(library)).YJ1_Decompress
        decoder.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int]
        decoder.restype = ctypes.c_int
        def decompress(data):
            if data[:4] != b'YJ_1':
                return data
            size = struct.unpack_from('<I', data, 4)[0]
            if size > 4_000_000:
                raise ValueError('Invalid decompressed size')
            buffer = ctypes.create_string_buffer(size)
            if decoder(data, buffer, size) != size:
                raise ValueError('PAL decompression failed')
            return buffer.raw
        palette = [min(255, v*4) for v in chunks('PAT')[0][:768]]
        # DATA chunk 3: PLAYERROLES.rgwSpriteNum[0], the actual overworld Li Xiaoyao.
        walking_id = struct.unpack_from('<H', chunks('DATA')[3], 24)[0]
        raw = decompress(chunks('MGO')[walking_id])
        frame_count = struct.unpack_from('<H', raw)[0] - 1
        frames = [rle(raw[struct.unpack_from('<H', raw, i*2)[0]*2:], palette) for i in range(frame_count)]
        assert frame_count == 12, 'Expected four directions with three walk poses each'
        w, h = max(im.width for im in frames), max(im.height for im in frames)
        walking_sheet = Image.new('RGBA', (w*frame_count, h))
        for i, im in enumerate(frames):
            walking_sheet.paste(im, (i*w+(w-im.width)//2, h-im.height))
        walking_path = f'walking-{walking_id}.png'
        walking_sheet.save(OUT/walking_path)
        contact(list(enumerate(frames)), review/'walking.png', (96,110), 3)
        walking = {'src': walking_path, 'archive': 'MGO.MKF', 'chunk': walking_id, 'width': w, 'height': h, 'frames': frame_count,
                   'directions': {name: {'idle': i*3, 'walk': [i*3+1, i*3, i*3+2, i*3]} for i, name in enumerate(['down','left','up','right'])}}
        (ROOT/'src/themes/pal-walk.json').write_text(json.dumps(walking, indent=2)+'\n')
        if args.walking_only:
            print(f'Extracted MGO #{walking_id}: {frame_count} overworld walk frames ({w}x{h}).')
            return
        backgrounds = []
        for i, data in enumerate(chunks('FBP')):
            if not data:
                continue
            raw = decompress(data)
            if len(raw) != 64000:
                continue
            im = Image.frombytes('P', (320,200), raw)
            im.putpalette(palette)
            im.save(OUT/f'background-{i}.png')
            backgrounds.append((i, im.convert('RGB')))
        contact(backgrounds, review/'backgrounds.jpg', (192,140), 6)
        manifest = {'backgrounds': [i for i,_ in backgrounds], 'enemies': {}, 'players': {}}
        for archive, kind in [('ABC', 'enemies'), ('F', 'players')]:
            previews = []
            for index, data in enumerate(chunks(archive)):
                if not data:
                    continue
                raw = decompress(data)
                count = struct.unpack_from('<H', raw)[0]-1
                frames = []
                for frame in range(count):
                    offset = struct.unpack_from('<H', raw, frame*2)[0]*2
                    try:
                        frames.append(rle(raw[offset:], palette))
                    except (ValueError, IndexError, struct.error):
                        break
                if not frames:
                    continue
                w, h = max(im.width for im in frames), max(im.height for im in frames)
                sheet = Image.new('RGBA', (w*len(frames), h))
                for f, im in enumerate(frames):
                    sheet.paste(im, (f*w+(w-im.width)//2, h-im.height))
                path = f'{kind}-{index}.png'
                sheet.save(OUT/path)
                poses = []
                for f in sorted(set([0, min(1,len(frames)-1), min(8,len(frames)-1)])):
                    im = frames[f].crop(frames[f].getbbox())
                    pose = f'{kind}-{index}-pose-{f}.png'
                    im.save(OUT/pose)
                    poses.append({'frame':f,'src':pose,'width':im.width,'height':im.height})
                frames[0].save(OUT/f'{kind}-{index}-idle.png')
                manifest[kind][index] = {'src':path, 'width':w, 'height':h, 'frames':len(frames), 'poses':poses}
                previews.append((index, frames[0]))
            contact(previews, review/f'{kind}.png')
        # Portraits use the same daytime palette.
        for i in [0,1,2,3,4]:
            try:
                rle(chunks('RGM')[i], palette).save(OUT/f'portrait-{i}.png')
            except (ValueError, IndexError, struct.error):
                pass
        (OUT/'assets.json').write_text(json.dumps(manifest, indent=2)+'\n')
        (ROOT/'src/themes/pal-assets.json').write_text(json.dumps(manifest)+'\n')
        print(f'Extracted {len(backgrounds)} backgrounds, {len(manifest["enemies"])} enemy sprites, {len(manifest["players"])} player sprites.')

if __name__ == '__main__':
    main()
