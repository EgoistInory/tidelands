"""Verify short transient cancellation, preserving the unaccepted audition boundary."""
import array
import hashlib
import json
from pathlib import Path
import re
import sys
import wave
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-11-03-audio-interruption'
PREVIOUS = 'tidelands-m5-2026-11-03-actor-continuity'
SHA = 'ea99aa6904c0ea57560d1ce3874d7d469d9d2dcc5fe252d7cf82f5a5d27239d1'
EVIDENCE = ROOT / 'docs/audio-interruption'


def read(p):
    return json.loads((ROOT / p).read_text())


def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def verify():
    audit = read('docs/audio-interruption/sources.json')
    assert not audit['audioListened'] and not audit['fullGoalComplete']
    for name, sha in audit['sources'].items():
        assert digest(ROOT / name) == sha
    package, previous = [read('dist/' + n + '.json') for n in [NAME, PREVIOUS]]
    assert digest(ROOT / 'dist' / package['archive']) == package['archiveSha256'] == SHA
    assert package['archiveBytes'] == 170924119 and len(package['files']) == 209
    assert set(package['files']) == set(previous['files'])
    assert {p for p in package['files'] if package['files'][p] != previous['files'][p]} == {'README.md', 'src/audio.js'}
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        assert len(archive.infolist()) == package['archiveEntries'] == 210 and archive.testzip() is None
        for name, row in package['files'].items():
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == row['sha256']
            assert digest(ROOT / 'dist' / NAME / 'tidelands-local' / name) == row['sha256']
            assert digest(ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)) == row['sha256']
    assert digest(ROOT / 'dist' / (PREVIOUS + '.zip')) == 'bea9854efb0b5ee6a5a4065d89f6a75a1c96f955ca7f54837070c6da83d9b8f3'
    assert digest(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    reports = {}
    for label in ['before', 'after']:
        data = read('docs/audio-interruption/' + label + '-pcm.json');reports[label] = data
        assert data['complete'] and data['logs'] == [] and len(data['rows']) == 4
        expected = previous if label == 'before' else package
        assert data['sources']['src/audio.js'] == expected['files']['src/audio.js']['sha256']
        for row in data['rows']:
            p = EVIDENCE / (label + '-' + row['file']);assert digest(p) == row['sha256']
            assert row['disposed'] and row['remaining'] == 0 and row['full']['peak'] < 1
            with wave.open(str(p)) as wav:
                assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getnframes()) == (1, 2, 48000, 43200)
                pcm = array.array('h', wav.readframes(wav.getnframes()))
            if sys.byteorder != 'little':pcm.byteswap()
            tail = pcm[19200:24000]
            if label == 'after' and row['mode'] != 'menu-preserve':assert not any(tail)
            else:assert sum(x*x for x in tail) > 0
    for old, new in zip(reports['before']['rows'], reports['after']['rows']):
        assert old['attack'] == new['attack'] and old['events'] == new['events']
        if new['mode'] == 'menu-preserve':assert old['sha256'] == new['sha256']
        else:assert old['afterResume']['rms'] > .0001 and new['afterResume']['rms'] == 0
    main = read('docs/audio-interruption/main.json')
    assert main['complete'] and main['logs'] == [] and len(main['rows']) == 2 and NAME in main['runtime']
    assert main['audioSha256'] == digest(ROOT / 'src/audio.js')
    for row in main['rows']:
        assert row['interruptedWarnings'] and row['reloadExact']
        for warning in row['interruptedWarnings']:
            assert any(s['scheduledAt'] - s['calledAt'] <= .020001 for s in warning['stops'])
            assert next(r for r in row['resumed']['records'] if r['id'] == warning['id'])['endedAt'] is not None
        assert row['menuFood']['hp'] == 97 and row['beforeFood']['hp'] == 79
        assert row['saved']['inventory']['berry'] == 2 and row['saved']['kills'] == 3
        assert row['disposed']['sources'] == row['disposed']['releases'] == 0 and row['disposed']['context'] is None
        assert not row['final']['hidden'] and row['final']['glError'] == 0
        for image in row['images']:
            assert digest(ROOT / 'dist/audio-interruption-main-2026-11-03' / image['image']) == image['sha256']
    for label, count in [('red', 0), ('focused', 27), ('full', 403)]:
        assert re.search(r'^# pass ' + str(count) + r'$', (EVIDENCE / (label + '-tests.txt')).read_text(), re.M)
    assert 'Ran 7 tests' in (EVIDENCE / 'packaging-tests.txt').read_text()
    print('Audio interruption delivery: PASS (native PCM + traced package UI; audition/M5 open)')


if __name__ == '__main__':
    verify()
