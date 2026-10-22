"""Verify the finite local environment/warning delivery without claiming M5 completion."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-23-rhythm-center'


def read(name):
    return json.loads((ROOT / name).read_text())


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def verify():
    package = read('dist/' + NAME + '.json')
    verification = read('docs/' + NAME + '-verification.json')
    assert verification['passed'] and verification['checkedFiles'] == 92
    assert sha('dist/' + package['archive']) == package['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        assert archive.testzip() is None
        for name, entry in package['files'].items():
            assert sha('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name) == entry['sha256'], name
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == entry['sha256']
            assert hashlib.sha256((Path(verification['extractedPath']) / name).read_bytes()).hexdigest() == entry['sha256']
    audio = read('docs/center-audio-audit.json')
    assert audio['passed'] and audio['equalPowerWithStereoPanner']
    for name, expected in audio['files'].items():
        assert sha(name) == expected
    tests = (ROOT / 'docs/center-audio-full-tests.txt').read_text()
    assert '# pass 276\n' in tests and '# fail 0\n' in tests
    ui = read('docs/rhythm-center-package-browser.json')
    assert not ui['console'] and not ui['newJsonExported']
    for name in ['desktop', 'mobile']:
        assert '群岛，再次相连' in ui[name]
        assert re.search(r'位置 X 7.8，Z 57.4；建筑 1；击败 3', ui[name])
        assert 'Value: 79, ID: hp' in ui[name]
    assert sha('docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    endurance = read('docs/rhythm-center-endurance.json')
    s = endurance['sample']
    assert not endurance['console'] and s['complete'] and s['authored'] and not s['hidden']
    assert s['targetMs'] == 600000 and 600000 <= s['activeMs'] < 601000
    assert len(s['stages']) == 5 and s['frames'] > 25000 and s['movingFraction'] > .85
    assert s['respawns'] == 0 and s['hitCount'] > 0 and s['damageTaken'] > 0
    assert s['stepsScheduled'] == s['stepAttempts'] and s['spatialScheduled'] == s['spatialAttempts']
    assert s['settled']['voices'] == 0 and s['settled']['pannersCreated'] == s['settled']['pannersReleased']
    assert all(c['glError'] == 0 and c['audio']['voices'] <= 12 for c in s['checkpoints'])
    files = ['src/audio.js', 'tests/rhythm-center-endurance.html', 'tools/verify_rhythm_center_delivery.py',
             'docs/center-audio-audit.json', 'docs/rhythm-center-package-browser.json', 'docs/rhythm-center-endurance.json']
    files += endurance['images'] + [row['image'].split('/tidelands/')[1] for row in ui['rows']]
    summary = {k: s[k] for k in ['activeMs', 'frames', 'movingFraction', 'distanceMeters', 'hitCount',
                               'damageTaken', 'respawns', 'p95Ms', 'maxMs', 'over50Ms', 'stepsScheduled',
                               'spatialScheduled', 'pannersCreated', 'pannersReleased', 'settled']}
    summary['heapMiB'] = [round(c['heapBytes'] / 1048576, 2) if c['heapBytes'] else None for c in s['checkpoints']]
    report = dict(passed=True, archive=package['archive'], archiveSha256=package['archiveSha256'],
                  runtimeFiles=92, fullTests=276, continuous=summary, ordinarySavePreserved=True,
                  newOrdinaryJsonExported=False, mainPathReplayed=False, physicalPhoneVerified=False,
                  audioListened=False, milestoneM5Complete=False, fullGoalComplete=False,
                  evidenceSha256={p: sha(p) for p in files},
                  scope='Finite combined local delivery; five teleported scripted load phases with revived enemy/weapon/food fixtures. Stage name is initial placement, not geographic containment. Natural heap snapshots and frame intervals, not VRAM/leak freedom/final motion or visual quality.')
    (ROOT / 'docs/rhythm-center-delivery-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    verify()
