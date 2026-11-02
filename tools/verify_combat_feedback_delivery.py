"""Verify the finite feedback delivery and its native UI proof, preserving old packages."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-11-03-combat-feedback'
PREVIOUS = 'tidelands-m5-2026-11-02-regional-landforms-r2'
ARCHIVE_SHA = 'f49d15377d9b6bc3d910ff10f689d6f810074b0b06ea980513604579a5ef14e8'


def read(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify():
    package = read('dist/' + NAME + '.json')
    previous = read('dist/' + PREVIOUS + '.json')
    assert sha(ROOT / 'dist' / package['archive']) == package['archiveSha256'] == ARCHIVE_SHA
    assert len(package['files']) == 209 and package['archiveEntries'] == 210
    changed = {p for p in set(package['files']) | set(previous['files'])
               if package['files'].get(p) != previous['files'].get(p)}
    assert changed == {'README.md', 'index.html', 'styles.css', 'src/main.js'}, changed
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        assert len(archive.infolist()) == 210 and archive.testzip() is None
        assert all(i.filename.startswith('tidelands-local/') and
                   '..' not in PurePosixPath(i.filename).parts and
                   not PurePosixPath(i.filename).is_absolute() for i in archive.infolist())
        for p, row in package['files'].items():
            assert hashlib.sha256(archive.read('tidelands-local/' + p)).hexdigest() == row['sha256'], p
            source = 'docs/LOCAL-DELIVERY.md' if p == 'README.md' else p
            assert sha(ROOT / source) == row['sha256'], source
            assert sha(ROOT / 'dist' / NAME / 'tidelands-local' / p) == row['sha256'], p
    assert sha(ROOT / 'dist' / previous['archive']) == previous['archiveSha256'] == 'a7b0356cf1b490a84b148c131a01e0ec320cec6ff6246a7881449833d2699eea'
    assert sha(ROOT / 'dist/tidelands-m5-2026-10-29-ground-support.zip') == 'ee606c25629a7b9f704fc504d661abea31264244b52027a9530253c60ca8301f'
    backup_sha = sha(ROOT / 'docs/beacon-footing-normal-save.json')
    assert backup_sha == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    before = read('docs/beacon-footing-normal-save.json')
    ui = read('docs/combat-feedback-package-native.json')
    assert ui['complete'] and ui['logs'] == [] and ui['runtimeOutsideBase'] == []
    assert ui['entry'].endswith('/dist/' + NAME + '/tidelands-local/')
    assert ui['backupSha256'] == backup_sha
    assert sha(ROOT / 'tools/run_combat_feedback_native.mjs') == ui['runnerSha256']
    for p, digest in ui['sources'].items():
        assert package['files'][p]['sha256'] == digest, p
    assert [r['name'] for r in ui['rows']] == ['desktop', 'mobile']
    summaries = []
    for row in ui['rows']:
        assert row['reloadExact'] and row['ui']['glError'] == 0
        assert not row['ui']['hidden'] and not row['ui']['overflow']
        assert row['ui']['viewport'] == ([1440, 900] if row['name'] == 'desktop' else [390, 844])
        saved = row['saved']
        assert saved['quest'] == before['quest'] == 6 and saved['kills'] == before['kills'] + 1 == 4
        assert saved['buildings'] == before['buildings'] and saved['respawn'] == before['respawn']
        assert saved['protectedUntil'] == before['protectedUntil']
        assert saved['inventory'] == dict(before['inventory'], fiber=8)
        assert next(e['hp'] for e in saved['enemies'] if e['id'] == 'enemy-52') == -6
        assert row['intervals'] and all(i['confirmedReplacement'] or i['ms'] >= 1000 for i in row['intervals'])
        assert any(not i['confirmedReplacement'] and i['ms'] >= 1000 for i in row['intervals'])
        for key in ['overlapImage', 'killImage']:
            image = row[key]
            assert sha(ROOT / 'dist/combat-feedback-package-native-2026-11-03' / image['image']) == image['sha256']
            a, h = (image['layout'][p] for p in ['attack-feedback', 'hurt-feedback'])
            assert not a['hidden'] and not h['hidden'] and a['text'] and h['text']
            assert a['rect']['right'] <= h['rect']['x'] and a['rect']['x'] >= 0
            assert h['rect']['right'] <= row['ui']['viewport'][0]
            toast = image['layout']['toast']
            assert toast['hidden'] or toast['rect']['bottom'] < a['rect']['y']
        summaries.append({'name': row['name'], 'viewport': row['ui']['viewport'],
                          'canvas': row['ui']['canvas'], 'intervals': row['intervals'],
                          'kills': saved['kills'], 'hp': saved['player']['hp'], 'reloadExact': True})
    tests = (ROOT / 'docs/combat-feedback-full-tests-node22.txt').read_text()
    assert '# tests 393' in tests and '# pass 393' in tests and '# fail 0' in tests
    packaging = (ROOT / 'docs/combat-feedback-package-tests.txt').read_text()
    assert 'Ran 7 tests' in packaging and packaging.rstrip().endswith('OK')
    motion = read('docs/combat-feedback-before-motion-audit.json')
    assert sha(ROOT / motion['sourceVideo']) == motion['sourceVideoSha256']
    assert len(motion['frames']) == motion['framesReviewed'] == 26
    for name, digest in motion['frames'].items():
        assert sha(ROOT / 'dist/r2-encounter-motion-2026-11-03' / name) == digest
    result = {'finiteFeedbackBatchAccepted': True, 'archive': package['archive'],
              'archiveBytes': package['archiveBytes'], 'archiveSha256': ARCHIVE_SHA,
              'runtimeInputs': 209, 'changedRuntimeInputs': sorted(changed),
              'referenceNode': '22.17.1', 'ruleTestsPassed': 393, 'packagingTestsPassed': 7,
              'nativeUi': summaries, 'packageRequestsStayedInsideBase': True,
              'previousPackagesAndBackupPreserved': True, 'imagesReviewed': 4,
              'naturalBodyContactAccepted': False, 'audioQualityAccepted': False,
              'milestoneM5Complete': False, 'fullGoalComplete': False}
    (ROOT / 'docs/combat-feedback-delivery-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    verify()
