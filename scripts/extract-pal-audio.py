#!/usr/bin/env python3
"""Decode original MUS.MKF (RIX/AdLib) and VOC.MKF. Requires AdPlug, C++, FFmpeg."""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import tempfile
import shlex

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/themes/pal/audio'
TRACKS = {'home': 5, 'dungeon': 19, 'battle': 36, 'boss': 46,
          'victory': 3, 'bossVictory': 2, 'defeat': 1}

def chunks(name):
    data = (ROOT / 'pal' / (name + '.MKF')).read_bytes()
    count = struct.unpack_from('<I', data)[0] // 4
    offsets = struct.unpack_from('<' + 'I' * count, data)
    assert offsets[-1] == len(data) and list(offsets) == sorted(offsets)
    return [data[a:b] for a, b in zip(offsets, offsets[1:])]

def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    mus, voc, data = chunks('MUS'), chunks('VOC'), chunks('DATA')
    # DOS PLAYERROLES in DATA chunk 3: seven trailing arrays of six sound IDs.
    roles = data[3]
    sounds = {name: struct.unpack_from('<H', roles, len(roles)-84+i*12)[0]
              for i, name in enumerate(['death', 'attack', 'weapon', 'critical', 'magic', 'cover', 'dying'])}
    manifest = {'music': {}, 'effects': {}, 'source': {name: hashlib.sha256((ROOT/'pal'/name).read_bytes()).hexdigest() for name in ['MUS.MKF','VOC.MKF','DATA.MKF']}, 'renderer': 'AdPlug 2.4 / OPL2 44100 Hz'}
    with tempfile.TemporaryDirectory(prefix='quest-pal-audio-') as temporary:
        temp = Path(temporary)
        flags = shlex.split(subprocess.check_output(['pkg-config','--cflags','--libs','adplug'], text=True))
        run('c++', '-std=c++17', str(ROOT/'scripts/render-pal-rix.cpp'), *flags, '-o', str(temp/'render'))
        for scene, index in TRACKS.items():
            rix, pcm = temp/f'{index}.rix', temp/f'{index}.pcm'
            assert mus[index][:2] == b'\xaaU'
            rix.write_bytes(mus[index])
            run(str(temp/'render'), str(rix), str(pcm))
            target = f'music-{index}.mp3'
            run('ffmpeg','-v','error','-y','-f','s16le','-ar','44100','-ac','1','-i',str(pcm),'-af','loudnorm=I=-20:TP=-2:LRA=11','-ar','44100','-codec:a','libmp3lame','-q:a','3',str(OUT/target))
            duration = pcm.stat().st_size / 2 / 44100
            manifest['music'][scene] = {'src': '/themes/pal/audio/'+target, 'archive': 'MUS.MKF', 'chunk': index, 'duration': round(duration,3), 'loop': scene not in ['victory','bossVictory','defeat']}
            print(f'{scene}: MUS #{index}, {duration:.1f}s', flush=True)
        for name, index in sounds.items():
            assert voc[index].startswith(b'Creative Voice File')
            source = temp/f'{index}.voc'
            source.write_bytes(voc[index])
            target = f'sound-{index}.wav'
            run('ffmpeg','-v','error','-y','-i',str(source),'-ar','22050','-ac','1',str(OUT/target))
            manifest['effects'][name] = {'src': '/themes/pal/audio/'+target, 'archive': 'VOC.MKF', 'chunk': index}
    (ROOT/'src/themes/pal-audio.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

if __name__ == '__main__':
    main()
