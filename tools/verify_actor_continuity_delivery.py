"""Audit a finite source-clock fix without claiming natural motion or mesh contact."""
import hashlib
import json
import math
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-11-03-actor-continuity'
PREVIOUS = 'tidelands-m5-2026-11-03-creature-strike'
SHA = 'bea9854efb0b5ee6a5a4065d89f6a75a1c96f955ca7f54837070c6da83d9b8f3'
EVIDENCE = ROOT / 'docs/actor-continuity'


def read(p):
    return json.loads((ROOT / p).read_text())


def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def verify():
    package = read('dist/' + NAME + '.json')
    previous = read('dist/' + PREVIOUS + '.json')
    assert digest(ROOT / 'dist' / package['archive']) == package['archiveSha256'] == SHA
    assert package['archiveBytes'] == 170923807 and len(package['files']) == 209
    assert {p for p in package['files'] if package['files'][p] != previous['files'][p]} == {'README.md', 'src/authored-character.js'}
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        assert len(archive.infolist()) == package['archiveEntries'] == 210
        assert archive.testzip() is None
        for name, row in package['files'].items():
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == row['sha256']
            assert digest(ROOT / 'dist' / NAME / 'tidelands-local' / name) == row['sha256']
            assert digest(ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)) == row['sha256']
    for name, sha in [
        (PREVIOUS, '2ffaf5a98e607ad5dceef0edc35a02200374be2cb26ec2d0eed4cb0bae3ac3e1'),
        ('tidelands-m5-2026-11-03-combat-feedback', 'f49d15377d9b6bc3d910ff10f689d6f810074b0b06ea980513604579a5ef14e8'),
        ('tidelands-m5-2026-11-02-regional-landforms-r2', 'a7b0356cf1b490a84b148c131a01e0ec320cec6ff6246a7881449833d2699eea'),
        ('tidelands-m5-2026-10-29-ground-support', 'ee606c25629a7b9f704fc504d661abea31264244b52027a9530253c60ca8301f'),
    ]:
        assert digest(ROOT / 'dist' / (name + '.zip')) == sha
    assert digest(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'

    summary = read('docs/actor-continuity/summary.json')
    assert not summary['fullGoalComplete'] and not summary['naturalMotionAccepted']
    for label, receipt in summary['raw'].items():
        assert digest(ROOT / receipt['path']) == receipt['sha256']
        if label == 'final':
            for name, sha in receipt['sources'].items():
                assert digest(ROOT / name) == sha
    assert summary['raw']['baseline']['sources']['src/authored-character.js'] == previous['files']['src/authored-character.js']['sha256']
    assert len(summary['rows']) == 24
    for row in summary['rows']:
        old, final = row['baseline'], row['final']
        assert math.dist(old['impactWrist'], final['impactWrist']) < 1e-9
        assert math.dist(old['impactPelvis'], final['impactPelvis']) < 1e-9
        assert final['maxSoleError'] < .003 and final['crossingFrames'] == 0
        if row['action'] == 'attack':
            assert final['maxWristSpeed'] <= old['maxWristSpeed']
            assert final['impactPelvisVelocityJump'] < old['impactPelvisVelocityJump'] * .1
            if row['tool'] != 'hand':
                assert row['rejected']['maxWristSpeed'] > old['maxWristSpeed']
                assert final['minToolFloor'] > 0
        else:
            assert old == final
    for label in ['before', 'final']:
        report = read('docs/actor-continuity/' + label + '-browser.json')
        base = ROOT / ('dist/actor-action-portfolio-' + label + '-2026-11-03')
        assert report['complete'] and report['logs'] == [] and len(report['rows']) == 5
        for row in report['rows']:
            for sample in row['samples']:
                assert sample['authored'] and sample['worldUnchanged'] and not sample['hidden'] and sample['glError'] == 0
                assert digest(base / sample['image']) == sample['sha256']
        assert digest(base / report['mobile']['image']) == report['mobile']['sha256']
    before, final = [read('docs/actor-continuity/' + label + '-browser.json') for label in ['before', 'final']]
    for a, b in zip(before['rows'], final['rows']):
        for old, new in zip(a['samples'], b['samples']):
            for key in ['age', 'spec', 'player', 'inventory', 'enemies', 'camera', 'buffer', 'result']:
                assert old[key] == new[key]

    native = read('docs/actor-continuity/native.json')
    assert native['complete'] and native['logs'] == [] and native['runtimeOutsideBase'] == []
    assert NAME in native['entry'] and len(native['rows']) == 2
    for row in native['rows']:
        assert row['reloadExact'] and row['saved']['kills'] == 4
        assert row['saved']['inventory']['fiber'] == 8 and row['saved']['inventory']['berry'] == 3
        assert row['beforeFood']['hp'] == 37 and row['afterFood']['hp'] == row['saved']['player']['hp'] == 55
        base = ROOT / 'dist/actor-continuity-package-native-2026-11-03'
        assert digest(base / row['video']) == row['videoSha256']
        assert len(row['images']) == 4
        for sample in row['images']:
            assert digest(base / sample['image']) == sample['sha256']
            assert not sample['hidden'] and sample['glError'] == 0
    motion = read('docs/actor-continuity/motion.json')
    assert digest(ROOT / motion['video']) == motion['videoSha256'] and len(motion['frames']) == 24
    for frame in motion['frames']:
        assert digest(ROOT / frame['path']) == frame['sha256']
    for label, count in [('red', 0), ('targeted', 27), ('full', 401)]:
        assert re.search(r'^# pass ' + str(count) + r'$', (EVIDENCE / (label + '-tests.txt')).read_text(), re.M)
    assert 'Ran 7 tests' in (EVIDENCE / 'packaging-tests.txt').read_text()
    print('Actor continuity delivery: PASS (bounded source-clock seam; full M5/3A open)')


if __name__ == '__main__':
    verify()
