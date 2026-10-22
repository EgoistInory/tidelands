"""Check native PCM evidence for the center-pan warning gain correction."""
import array
import hashlib
import json
import math
from pathlib import Path
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]


def verify():
    energies = {}
    for label, nodes in [('before', 5), ('after', 6)]:
        data = json.loads((ROOT / f'docs/center-audio-{label}.json').read_text())
        assert data['complete'] and data['disposed'] and data['remaining'] == 0
        assert data['created'] == data['disconnected'] == nodes
        with wave.open(str(ROOT / f'docs/center-audio-{label}.wav')) as wav:
            assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getnframes()) == (2, 2, 48000, 528000)
            pcm = array.array('h', wav.readframes(wav.getnframes()))
        if sys.byteorder != 'little':
            pcm.byteswap()
        events = {e['name']: e for e in data['events']}
        for i, event in enumerate(data['events']):
            for channel in range(2):
                values = [pcm[n * 2 + channel] / 32767 for n in range(round((.5 + i) * 48000), round((.9 + i) * 48000))]
                rms = math.sqrt(sum(v * v for v in values) / len(values))
                assert abs(rms - event['channels'][channel]['rms']) < 1 / 32767
        rms = lambda name, channel: events[name]['channels'][channel]['rms']
        assert rms('left', 0) > 3 * rms('left', 1)
        assert rms('right', 1) > 3 * rms('right', 0)
        assert rms('turn', 1) > 3 * rms('turn', 0)
        assert 0 < rms('far', 1) < rms('near', 1) * .4
        for name in ['paused', 'muted']:
            assert rms(name, 0) == rms(name, 1) == 0
        assert rms('fallback', 0) == rms('fallback', 1) > 0
        energy = lambda name: sum(c['rms'] ** 2 for c in events[name]['channels'])
        energies[label] = 10 * math.log10(energy('center') / energy('near'))
    assert 2.9 < energies['before'] < 3.1
    assert abs(energies['after']) < .01
    files = ['src/audio.js', 'tests/spatial-audio.test.js', 'tests/spatial-audio-review.html',
             'tools/verify_center_audio.py']
    files += [f'docs/center-audio-{label}.{extension}' for label in ['before', 'after'] for extension in ['json', 'wav']]
    result = dict(passed=True, centerVsSideEnergyDb=energies, equalPowerWithStereoPanner=True,
                  fallbackCentered=True, fallbackEqualPowerVerified=False, audioListened=False,
                  fullGoalComplete=False, scope='Native isolated fixed-slice cue per run; noise differs between runs. PCM quantization checked. Not whole mix, human listening or physical-device acceptance.',
                  files={p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in files})
    (ROOT / 'docs/center-audio-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    verify()
