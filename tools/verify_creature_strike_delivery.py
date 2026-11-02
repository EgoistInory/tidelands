"""Verify the bounded creature strike batch; AABB overlap is not penetration proof."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-11-03-creature-strike'
PREVIOUS = 'tidelands-m5-2026-11-03-combat-feedback'
SHA = '2ffaf5a98e607ad5dceef0edc35a02200374be2cb26ec2d0eed4cb0bae3ac3e1'


def read(path):
    return json.loads((ROOT / path).read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def images(report, folder):
    assert report['complete'] and report['logs'] == [] and len(report['rows']) == 20
    for row in report['rows']:
        assert digest(ROOT / folder / row['image']) == row['sha256']
        assert row['authoredPlayer'] and row['worldUnchanged'] and not row['hidden'] and row['glError'] == 0
        assert abs(row['distance'] - row['contactDistance']) < 1e-8


def verify():
    package = read('dist/' + NAME + '.json')
    previous = read('dist/' + PREVIOUS + '.json')
    assert digest(ROOT / 'dist' / package['archive']) == package['archiveSha256'] == SHA
    assert len(package['files']) == 209 and package['archiveEntries'] == 210
    changed = {p for p in set(package['files']) | set(previous['files']) if package['files'].get(p) != previous['files'].get(p)}
    assert changed == {'README.md', 'src/creature.js'}, changed
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        assert len(archive.infolist()) == 210 and archive.testzip() is None
        assert all(i.filename.startswith('tidelands-local/') and '..' not in PurePosixPath(i.filename).parts and not PurePosixPath(i.filename).is_absolute() for i in archive.infolist())
        for p, row in package['files'].items():
            assert hashlib.sha256(archive.read('tidelands-local/' + p)).hexdigest() == row['sha256'], p
            assert digest(ROOT / ('docs/LOCAL-DELIVERY.md' if p == 'README.md' else p)) == row['sha256'], p
            assert digest(ROOT / 'dist' / NAME / 'tidelands-local' / p) == row['sha256'], p
    preserved = {previous['archive']: 'f49d15377d9b6bc3d910ff10f689d6f810074b0b06ea980513604579a5ef14e8',
                 'tidelands-m5-2026-11-02-regional-landforms-r2.zip': 'a7b0356cf1b490a84b148c131a01e0ec320cec6ff6246a7881449833d2699eea',
                 'tidelands-m5-2026-10-29-ground-support.zip': 'ee606c25629a7b9f704fc504d661abea31264244b52027a9530253c60ca8301f'}
    for p, sha in preserved.items():
        assert digest(ROOT / 'dist' / p) == sha, p
    backup_sha = digest(ROOT / 'docs/beacon-footing-normal-save.json')
    assert backup_sha == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    baseline = read('docs/close-encounter-baseline.json')
    final = read('docs/close-encounter-final.json')
    images(baseline, 'dist/close-encounter-review-2026-11-03')
    images(final, 'dist/close-encounter-strike-final-2026-11-03')
    for p, sha in baseline['sources'].items():
        actual = digest(ROOT / 'dist/close-encounter-review-2026-11-03/page-captured.html') if p.startswith('tests/') else previous['files'][p]['sha256']
        assert actual == sha, p
    for p, sha in final['sources'].items():
        assert digest(ROOT / p) == sha, p
    for old, new in zip(baseline['rows'], final['rows']):
        for key in ['type', 'phase', 'angle', 'kind', 'camera', 'buffer', 'player', 'enemy', 'initial', 'result', 'playerBox', 'creatureCoreBox']:
            assert old[key] == new[key], key
        if new['type'] == 'crab' and new['phase'] == 'enemy':
            assert old['fullGaps'][2] > .3 and new['fullGaps'][2] < 0
            assert old['coreBoxesSeparate'] and new['coreBoxesSeparate']
        else:
            assert old['creatureAllBox'] == new['creatureAllBox']
    ground = read('docs/close-encounter-ground-probe.json')
    assert ground['complete'] and ground['logs'] == [] and len(ground['rows']) == 6
    assert ground['sources']['src/creature.js'] == previous['files']['src/creature.js']['sha256']
    for row in ground['rows']:
        for foot in row['support']:
            assert abs(foot['visibleFloor'] - foot['rayFloor']) < 1e-5
            if foot['planted']:
                assert abs(foot['visibleGap']) < .02
    native = read('docs/creature-strike-package-native.json')
    assert native['complete'] and native['logs'] == [] and native['runtimeOutsideBase'] == []
    assert native['entry'].endswith('/dist/' + NAME + '/tidelands-local/') and native['backupSha256'] == backup_sha
    for p, sha in native['sources'].items():
        assert package['files'][p]['sha256'] == sha, p
    before = read('docs/beacon-footing-normal-save.json')
    assert [r['name'] for r in native['rows']] == ['desktop', 'mobile']
    summaries = []
    for row in native['rows']:
        assert row['reloadExact'] and len(row['images']) == 4
        assert row['manifestCreatureSha256'] == package['files']['src/creature.js']['sha256']
        assert {i['phase'] for i in row['images']} == {'windup', 'hurt', 'hit', 'withdraw'}
        for image in row['images']:
            assert not image['hidden'] and image['glError'] == 0
            assert digest(ROOT / 'dist/creature-strike-package-native-2026-11-03' / image['image']) == image['sha256']
        assert digest(ROOT / 'dist/creature-strike-package-native-2026-11-03' / row['video']) == row['videoSha256']
        saved = row['saved']
        assert saved['kills'] == before['kills'] + 1 == 4 and saved['quest'] == before['quest'] == 6
        assert saved['buildings'] == before['buildings'] and saved['protectedUntil'] == before['protectedUntil']
        assert saved['inventory'] == dict(before['inventory'], fiber=8)
        assert row['afterFood']['food'] == row['beforeFood']['food'] - 1
        summaries.append({'name': row['name'], 'viewport': row['viewport'], 'kills': saved['kills'], 'hp': saved['player']['hp'], 'foodHpBeforeAfter': [row['beforeFood']['hp'], row['afterFood']['hp']], 'reloadExact': True, 'videoSha256': row['videoSha256']})
    motion = read('docs/creature-strike-native-motion-audit.json')
    assert len(motion['frames']) == motion['framesReviewed'] == 21
    assert digest(ROOT / motion['sourceVideo']) == motion['sourceVideoSha256']
    for p, sha in motion['frames'].items():
        assert digest(ROOT / 'dist/creature-strike-native-motion-2026-11-03' / p) == sha
    tests = (ROOT / 'docs/creature-strike-full-tests.txt').read_text()
    assert '# tests 395' in tests and '# pass 395' in tests and '# fail 0' in tests
    focused = (ROOT / 'docs/creature-strike-focused-tests.txt').read_text()
    assert '# pass 26' in focused and '# fail 0' in focused
    assert 'Ran 7 tests' in (ROOT / 'docs/creature-strike-package-tests.txt').read_text()
    result = {'finiteCreatureStrikeAccepted': True, 'archive': package['archive'], 'archiveBytes': package['archiveBytes'], 'archiveSha256': SHA,
              'runtimeInputs': 209, 'changedRuntimeInputs': sorted(changed), 'ruleTests': 395, 'focusedTests': 26, 'packagingTests': 7,
              'staticImagesReviewed': 40, 'nativeImagesReviewed': 8, 'nativeMotionFramesReviewed': 21, 'native': summaries,
              'bodyCollisionInflated': False, 'groundSupportChanged': False, 'previousPackagesAndBackupPreserved': True,
              'fullTriangleContactAccepted': False, 'fullVideosWatched': False, 'audioAuditioned': False,
              'milestoneM5Complete': False, 'fullGoalComplete': False}
    (ROOT / 'docs/creature-strike-delivery-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    verify()
